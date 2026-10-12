// Conversione di una seduta PCoach in un evento del calendario Intervals.icu.
// Modulo puro condiviso tra app (anteprima del testo nell'editor) ed Edge Function
// intervals-sync (invio reale), cosi' l'anteprima e' esattamente cio' che viene inviato.
//
// Formato verificato il 2026-10-10:
// - campi dell'evento (EventEx) dalla specifica OpenAPI ufficiale: category, start_date_local,
//   type, name, description, moving_time, distance, target, external_id;
// - sintassi del testo del workout dal forum di Intervals.icu (workout builder): "- 10m Z2",
//   "m" = minuti, distanze "2km"/"400mtr", "Z2 HR"/"Z2 Pace", ripetute con intestazione "Nx"
//   e una riga vuota prima e dopo, niente ripetute annidate, testo prima della durata = indicazione.
// - verificato su un account di prova il 2026-10-13 (ADR 0032): Intervals.icu legge come durata il
//   primo token che le somiglia, anche dentro l'indicazione ("1000m" = 1000 minuti, "8'" = 8 minuti).
//   Il separatore "<!>" chiude l'indicazione: quello che lo precede resta testo dello step. Nelle
//   intestazioni delle ripetute il testo non viene interpretato, e "<!>" resterebbe scritto.
import type { Discipline, TargetMetric, WorkoutContent, WorkoutStep } from "./structure.ts";
import { workoutTotals, zoneLabel } from "./structure.ts";

export const INTERVALS_TYPES: Record<Discipline, string> = {
  running: "Run",
  cycling: "Ride",
  swimming: "Swim",
  strength: "WeightTraining"
};

const TARGET_FIELD: Record<TargetMetric, string | undefined> = {
  power: "POWER",
  hr: "HR",
  pace: "PACE",
  none: undefined
};

// Su Intervals.icu una zona senza suffisso e' di potenza.
const ZONE_SUFFIX: Record<TargetMetric, string> = { power: "", hr: " HR", pace: " Pace", none: "" };

const ROLE_CUE: Partial<Record<WorkoutStep["role"], string>> = {
  warmup: "Riscaldamento",
  cooldown: "Defaticamento"
};

export function externalIdFor(workoutId: string): string {
  return `pcoach:${workoutId}`;
}

export function formatIntervalsDuration(step: WorkoutStep): string {
  if (step.duration.type === "distance") {
    const m = Math.round(step.duration.meters);
    return m >= 1000 && m % 100 === 0 ? `${m / 1000}km` : `${m}mtr`;
  }
  const total = Math.round(step.duration.seconds);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? h + "h" : ""}${min ? min + "m" : ""}${s ? s + "s" : ""}` || "0s";
}

// L'indicazione precede la durata sulla stessa riga: niente a capo, niente trattino iniziale
// (che Intervals.icu leggerebbe come un nuovo step).
function cleanCue(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").replace(/^[-\s]+/, "").trim();
}

// Nell'indicazione di uno step si tolgono i segni che Intervals.icu interpreta: il separatore "<!>"
// e "^" dei suggerimenti a tempo.
function cleanStepCue(text: string | undefined): string {
  return cleanCue((text ?? "").replaceAll("<!>", " ").replaceAll("^", " "));
}

function stepLine(step: WorkoutStep, metric: TargetMetric): string {
  const cue = cleanStepCue(step.cue) || ROLE_CUE[step.role] || "";
  const target = step.target ? ` ${zoneLabel(step.target)}${ZONE_SUFFIX[metric]}` : "";
  // "<!>" separa l'indicazione dalla definizione: i numeri dell'indicazione restano testo (ADR 0032).
  return `- ${cue ? cue + "<!> " : ""}${formatIntervalsDuration(step)}${target}`;
}

/** Testo del workout nella sintassi di Intervals.icu (vuoto per le sedute senza struttura). */
export function intervalsWorkoutText(content: Pick<WorkoutContent, "structure" | "primary_target">): string {
  const lines: string[] = [];
  for (const block of content.structure?.steps ?? []) {
    if (block.kind === "repeat") {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      lines.push(`${cleanCue(block.label) || "Serie"} ${block.count}x`);
      for (const s of block.steps) lines.push(stepLine(s, content.primary_target));
      lines.push("");
    } else {
      lines.push(stepLine(block, content.primary_target));
    }
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function intervalsDescription(content: WorkoutContent): string {
  const notes = content.notes_for_athlete.trim();
  const text = content.discipline === "strength" ? "" : intervalsWorkoutText(content);
  return [notes, text].filter(Boolean).join("\n\n");
}

export interface IntervalsEventPayload {
  category: "WORKOUT";
  start_date_local: string;
  type: string;
  name: string;
  description: string;
  external_id: string;
  moving_time?: number;
  distance?: number;
  target?: string;
}

export function buildIntervalsEvent(workoutId: string, content: WorkoutContent): IntervalsEventPayload {
  const totals = workoutTotals(content);
  const event: IntervalsEventPayload = {
    category: "WORKOUT",
    start_date_local: `${content.planned_date}T00:00:00`,
    type: INTERVALS_TYPES[content.discipline],
    name: content.title.trim(),
    description: intervalsDescription(content),
    external_id: externalIdFor(workoutId)
  };
  // Durata e distanza solo quando sono esatte: con step misti Intervals.icu le calcola da se'.
  if (totals.allTime && totals.seconds > 0) event.moving_time = totals.seconds;
  if (totals.allDistance && totals.meters > 0) event.distance = totals.meters;
  const target = TARGET_FIELD[content.primary_target];
  if (target && content.discipline !== "strength") event.target = target;
  return event;
}

/** Impronta del contenuto inviato a Intervals.icu (FNV-1a sul JSON dell'evento): se cambia anche
 * solo la conversione, la seduta torna da aggiornare (ADR 0032). */
export function intervalsPayloadHash(payload: IntervalsEventPayload): string {
  const text = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Step come lo restituisce Intervals.icu nel workout_doc (solo i campi usati). */
export interface IcuDocStep {
  duration?: number | null;
  distance?: number | null;
  reps?: number | null;
  steps?: IcuDocStep[] | null;
}

function describe(step: WorkoutStep): string {
  if (step.duration.type === "distance") return `${Math.round(step.duration.meters)} m`;
  const s = Math.round(step.duration.seconds);
  return s % 60 ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"` : `${s / 60}'`;
}

function describeDoc(d: IcuDocStep): string {
  if (d.distance) return `${Math.round(d.distance)} m`;
  const s = Math.round(d.duration ?? 0);
  return s % 60 ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"` : `${s / 60}'`;
}

/** true se Intervals.icu ha letto lo step come definito: stessa durata (a tempo) o stessa distanza. */
function sameStep(step: WorkoutStep, d: IcuDocStep | undefined): boolean {
  if (!d) return false;
  if (step.duration.type === "distance") return Math.abs((d.distance ?? 0) - step.duration.meters) <= 1;
  return !d.distance && Math.abs((d.duration ?? 0) - step.duration.seconds) <= 1;
}

/**
 * Verifica di ritorno (ADR 0032): confronta, step per step, la struttura della seduta con quella che
 * Intervals.icu ha letto dal testo (workout_doc). Restituisce il primo scostamento, oppure null.
 */
export function workoutDocIssue(content: Pick<WorkoutContent, "structure" | "discipline">, doc: IcuDocStep[] | null | undefined): string | null {
  if (content.discipline === "strength" || !Array.isArray(doc)) return null;
  const blocks = content.structure?.steps ?? [];
  if (doc.length !== blocks.length) return `Intervals.icu ha letto ${doc.length} step invece di ${blocks.length}: controlla la seduta sul suo calendario.`;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const d = doc[i];
    if (block.kind === "repeat") {
      if ((d.reps ?? 0) !== block.count || (d.steps?.length ?? 0) !== block.steps.length) {
        return `Intervals.icu ha letto la ripetuta ${i + 1} in modo diverso (${d.reps ?? 0} × ${d.steps?.length ?? 0} step invece di ${block.count} × ${block.steps.length}): controlla la seduta sul suo calendario.`;
      }
      for (let j = 0; j < block.steps.length; j++) {
        if (!sameStep(block.steps[j], d.steps![j])) {
          return `Intervals.icu ha letto lo step ${j + 1} della ripetuta ${i + 1} come ${describeDoc(d.steps![j])} invece di ${describe(block.steps[j])}: controlla la seduta sul suo calendario.`;
        }
      }
    } else if (!sameStep(block, d)) {
      return `Intervals.icu ha letto lo step ${i + 1} come ${describeDoc(d)} invece di ${describe(block)}: controlla la seduta sul suo calendario.`;
    }
  }
  return null;
}
