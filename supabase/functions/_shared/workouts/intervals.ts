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

function stepLine(step: WorkoutStep, metric: TargetMetric): string {
  const cue = cleanCue(step.cue) || ROLE_CUE[step.role] || "";
  const target = step.target ? ` ${zoneLabel(step.target)}${ZONE_SUFFIX[metric]}` : "";
  return `- ${cue ? cue + " " : ""}${formatIntervalsDuration(step)}${target}`;
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

/** Numero di step attesi dopo l'interpretazione di Intervals.icu (ripetute contate una volta,
 * come nel workout_doc). Serve a verificare che il testo sia stato letto come previsto. */
export function expectedTopLevelSteps(content: Pick<WorkoutContent, "structure" | "discipline">): number {
  if (content.discipline === "strength") return 0;
  return content.structure?.steps.length ?? 0;
}
