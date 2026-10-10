// Modello interno di una seduta e della sua struttura (versione 2), indipendente da
// qualunque provider esterno. Modulo puro condiviso tra app ed Edge Function.
// La conversione verso Intervals.icu vive in intervals.ts: il testo del workout e' un
// formato di esportazione, non il modello su cui si lavora.
import { isISODate } from "./calendar.ts";

export const DISCIPLINES = ["running", "cycling", "swimming", "strength"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const TARGET_METRICS = ["power", "hr", "pace", "none"] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

export const STEP_ROLES = ["warmup", "work", "recovery", "steady", "cooldown"] as const;
export type StepRole = (typeof STEP_ROLES)[number];

export type StepDuration = { type: "time"; seconds: number } | { type: "distance"; meters: number };

/** Zona singola (zone) o intervallo di zone (zone..zone_to), da 1 a 7. La metrica e' quella
 * della seduta (primary_target): una seduta ha una sola metrica, come su Intervals.icu. */
export interface ZoneTarget {
  zone: number;
  zone_to?: number | null;
}

export interface WorkoutStep {
  kind: "step";
  role: StepRole;
  duration: StepDuration;
  target: ZoneTarget | null;
  cue?: string;
}

/** Ripetuta: un gruppo di step ripetuto `count` volte. Non annidabile (come su Intervals.icu). */
export interface WorkoutRepeat {
  kind: "repeat";
  count: number;
  label?: string;
  steps: WorkoutStep[];
}

export type WorkoutBlock = WorkoutStep | WorkoutRepeat;

export interface WorkoutStructure {
  version: 2;
  steps: WorkoutBlock[];
}

/** Contenuto di una seduta: tutto cio' che, se cambia, rende obsoleta la copia su Intervals.icu. */
export interface WorkoutContent {
  planned_date: string;
  discipline: Discipline;
  title: string;
  objective: string;
  notes_for_athlete: string;
  /** Solo per le sedute senza struttura (palestra): durata in minuti. */
  duration_min: number | null;
  structure: WorkoutStructure | null;
  primary_target: TargetMetric;
}

export function isDiscipline(value: unknown): value is Discipline {
  return typeof value === "string" && (DISCIPLINES as readonly string[]).includes(value);
}

/** Metrica dei target per disciplina (decisione del coach, 2026-10-10): bici in potenza se
 * l'atleta ha un FTP, altrimenti in frequenza cardiaca; corsa e nuoto in zone di passo;
 * palestra senza target. */
export function defaultTargetMetric(discipline: Discipline, hasFtp: boolean): TargetMetric {
  if (discipline === "cycling") return hasFtp ? "power" : "hr";
  if (discipline === "strength") return "none";
  return "pace";
}

/** Riconosce una o piu' zone in un testo libero ("Z2", "Z2-Z3", "Z1-2 (56-75% FTP)",
 * "Z2-Z3-Z4"): restituisce la minima e la massima, oppure null se non ci sono zone. */
export function parseZones(text: unknown): ZoneTarget | null {
  if (typeof text !== "string") return null;
  const found: number[] = [];
  const re = /Z\s*([1-7])(?:\s*[-–]\s*Z?\s*([1-7]))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.push(+m[1]);
    if (m[2]) found.push(+m[2]);
  }
  if (!found.length) return null;
  const zone = Math.min(...found);
  const zoneTo = Math.max(...found);
  return zoneTo > zone ? { zone, zone_to: zoneTo } : { zone };
}

export function zoneLabel(target: ZoneTarget | null | undefined): string {
  if (!target) return "";
  return target.zone_to && target.zone_to > target.zone ? `Z${target.zone}-Z${target.zone_to}` : `Z${target.zone}`;
}

/** Zona piu' alta del target: usata per colorare la struttura. */
export function peakZone(target: ZoneTarget | null | undefined): number | null {
  if (!target) return null;
  return Math.max(target.zone, target.zone_to ?? target.zone);
}

/** Step in sequenza, con le ripetute espanse. */
export function flattenSteps(structure: WorkoutStructure | null | undefined): WorkoutStep[] {
  const out: WorkoutStep[] = [];
  for (const block of structure?.steps ?? []) {
    if (block.kind === "repeat") {
      for (let i = 0; i < block.count; i++) out.push(...block.steps);
    } else {
      out.push(block);
    }
  }
  return out;
}

// Velocita' di riferimento per stimare la durata degli step a distanza (solo per mostrare
// un totale indicativo e proporzionare la barra; Intervals.icu calcola i propri tempi).
const SECONDS_PER_METER: Record<Discipline, number> = {
  running: 0.33, // 5:30/km
  cycling: 0.12, // 30 km/h
  swimming: 1.2, // 2:00/100m
  strength: 0.33
};

export function stepSeconds(step: WorkoutStep, discipline: Discipline): number {
  return step.duration.type === "time" ? step.duration.seconds : step.duration.meters * SECONDS_PER_METER[discipline];
}

export interface WorkoutTotals {
  /** Durata totale in secondi (stimata se ci sono step a distanza). */
  seconds: number;
  /** Metri degli step a distanza. */
  meters: number;
  estimated: boolean;
  /** true se tutti gli step sono a tempo. */
  allTime: boolean;
  /** true se tutti gli step sono a distanza. */
  allDistance: boolean;
}

export function workoutTotals(content: Pick<WorkoutContent, "discipline" | "duration_min" | "structure">): WorkoutTotals {
  const steps = flattenSteps(content.structure);
  if (!steps.length) {
    const seconds = (content.duration_min ?? 0) * 60;
    return { seconds, meters: 0, estimated: false, allTime: true, allDistance: false };
  }
  let seconds = 0;
  let meters = 0;
  let timeCount = 0;
  for (const s of steps) {
    seconds += stepSeconds(s, content.discipline);
    if (s.duration.type === "distance") meters += s.duration.meters;
    else timeCount++;
  }
  return {
    seconds: Math.round(seconds),
    meters,
    estimated: timeCount < steps.length,
    allTime: timeCount === steps.length,
    allDistance: timeCount === 0
  };
}

export type ValidationErrors = Record<string, string>;

function validateStep(step: WorkoutStep, path: string, errors: ValidationErrors): void {
  if (!(STEP_ROLES as readonly string[]).includes(step.role)) errors[path] = "Tipo di step non valido.";
  const d = step.duration;
  const value = d?.type === "time" ? d.seconds : d?.type === "distance" ? d.meters : NaN;
  if (!(value > 0) || !Number.isFinite(value)) {
    errors[path] = "Inserisci una durata maggiore di zero.";
    return;
  }
  if (!step.target) {
    errors[path] = "Scegli una zona.";
    return;
  }
  const { zone, zone_to } = step.target;
  if (!Number.isInteger(zone) || zone < 1 || zone > 7) errors[path] = "La zona va da 1 a 7.";
  else if (zone_to != null && (!Number.isInteger(zone_to) || zone_to < zone || zone_to > 7)) {
    errors[path] = "La zona finale deve essere uguale o superiore a quella iniziale.";
  }
}

/** Errori di validazione per campo. Chiavi: title, planned_date, duration_min, structure,
 * "step:<i>" per uno step, "step:<i>.<j>" per uno step dentro una ripetuta. */
export function validateWorkout(content: WorkoutContent): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!content.title.trim()) errors.title = "Il nome della seduta è obbligatorio.";
  if (!isISODate(content.planned_date)) errors.planned_date = "Data non valida.";
  if (!isDiscipline(content.discipline)) errors.discipline = "Disciplina non valida.";
  if (content.discipline === "strength") {
    if (!(content.duration_min && content.duration_min > 0)) errors.duration_min = "Indica la durata in minuti.";
    return errors;
  }
  const blocks = content.structure?.steps ?? [];
  if (!blocks.length) {
    errors.structure = "Aggiungi almeno uno step.";
    return errors;
  }
  blocks.forEach((block, i) => {
    if (block.kind === "repeat") {
      if (!Number.isInteger(block.count) || block.count < 1) errors[`step:${i}`] = "Indica almeno una ripetizione.";
      else if (!block.steps.length) errors[`step:${i}`] = "La ripetuta non contiene step.";
      block.steps.forEach((s, j) => validateStep(s, `step:${i}.${j}`, errors));
    } else {
      validateStep(block, `step:${i}`, errors);
    }
  });
  return errors;
}

export function contentOf<T extends WorkoutContent>(w: T): WorkoutContent {
  return {
    planned_date: w.planned_date,
    discipline: w.discipline,
    title: w.title,
    objective: w.objective,
    notes_for_athlete: w.notes_for_athlete,
    duration_min: w.duration_min,
    structure: w.structure,
    primary_target: w.primary_target
  };
}
