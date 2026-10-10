// Conversione tollerante di step "grezzi" (piano legacy o risposta di Claude) nella
// struttura v2. Non lancia mai: cio' che non si riesce a leggere diventa uno step non valido
// (durata 0 o zona assente), che la validazione mostra al coach invece di scartarlo in silenzio.
import type {
  Discipline, StepRole, WorkoutBlock, WorkoutContent, WorkoutStep, WorkoutStructure, ZoneTarget
} from "@shared/workouts/structure.ts";
import { STEP_ROLES, parseZones } from "@shared/workouts/structure.ts";

/** Seduta da inserire (import, generazione): contenuto piu' i campi di stato iniziali. */
export interface NewWorkout extends WorkoutContent {
  slot: number;
  status: "draft" | "approved";
  needs_review: string | null;
  legacy: unknown;
  change_note: string | null;
}

// Parole usate nei piani esistenti al posto di una zona, con un significato univoco.
const ZONE_WORDS: Record<string, number> = { recovery: 1, riposo: 1, recupero: 1 };

export function readZone(raw: unknown, rawTo?: unknown): ZoneTarget | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 7) {
    const to = typeof rawTo === "number" && Number.isInteger(rawTo) && rawTo > raw && rawTo <= 7 ? rawTo : null;
    return to ? { zone: raw, zone_to: to } : { zone: raw };
  }
  if (typeof raw !== "string") return null;
  const parsed = parseZones(typeof rawTo === "string" && rawTo ? `${raw}-${rawTo}` : raw);
  if (parsed) return parsed;
  const word = raw.trim().toLowerCase();
  return word in ZONE_WORDS ? { zone: ZONE_WORDS[word] } : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

type RawStep = Record<string, unknown>;

export function readStep(raw: RawStep, fallbackRole: StepRole, fallbackZone: unknown): WorkoutStep {
  const roleRaw = typeof raw.role === "string" ? raw.role : typeof raw.kind === "string" ? raw.kind : "";
  const role: StepRole = (STEP_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as StepRole)
    : roleRaw === "block" ? "work" : fallbackRole;
  const seconds = num(raw.duration_sec);
  const meters = num(raw.distance_m);
  const duration = seconds ? { type: "time" as const, seconds: Math.round(seconds) }
    : meters ? { type: "distance" as const, meters: Math.round(meters) }
    : { type: "time" as const, seconds: 0 };
  const target = readZone(raw.zone, raw.zone_to) ?? readZone(raw.description) ?? readZone(fallbackZone);
  const cue = typeof raw.cue === "string" ? raw.cue : typeof raw.description === "string" ? raw.description : "";
  const step: WorkoutStep = { kind: "step", role, duration, target };
  if (cue.trim() && !parseZones(cue)) step.cue = cue.trim().slice(0, 80);
  return step;
}

/** Converte una lista di step grezzi; accetta sia il formato v2 (steps annidati nelle
 * ripetute) sia quello legacy (repeat con work/recovery). */
export function readStructure(rawSteps: unknown, fallbackZone: unknown): WorkoutStructure | null {
  if (!Array.isArray(rawSteps) || !rawSteps.length) return null;
  const blocks: WorkoutBlock[] = [];
  for (const raw of rawSteps) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as RawStep;
    if (r.kind === "repeat") {
      const count = typeof r.count === "number" ? r.count : typeof r.repetitions === "number" ? r.repetitions : 1;
      let inner: WorkoutStep[] = [];
      if (Array.isArray(r.steps)) {
        inner = r.steps.filter((s): s is RawStep => !!s && typeof s === "object").map((s) => readStep(s, "work", fallbackZone));
      } else {
        if (r.work && typeof r.work === "object") inner.push(readStep(r.work as RawStep, "work", fallbackZone));
        if (r.recovery && typeof r.recovery === "object") inner.push(readStep({ ...(r.recovery as RawStep), role: "recovery" }, "recovery", null));
      }
      const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : undefined;
      blocks.push({ kind: "repeat", count: Math.max(1, Math.round(count)), ...(label ? { label } : {}), steps: inner });
    } else {
      blocks.push(readStep(r, "steady", fallbackZone));
    }
  }
  return blocks.length ? { version: 2, steps: blocks } : null;
}

/** Struttura minima per una seduta senza step: un blocco continuo a tempo o a distanza. */
export function singleBlockStructure(durationMin: unknown, distanceKm: unknown, zone: unknown): WorkoutStructure | null {
  const min = num(durationMin);
  const km = num(distanceKm);
  if (!min && !km) return null;
  const step: WorkoutStep = {
    kind: "step",
    role: "steady",
    duration: min ? { type: "time", seconds: Math.round(min * 60) } : { type: "distance", meters: Math.round(km! * 1000) },
    target: readZone(zone)
  };
  return { version: 2, steps: [step] };
}

export function disciplineFallbackTitle(discipline: Discipline): string {
  return { running: "Corsa", cycling: "Bici", swimming: "Nuoto", strength: "Palestra" }[discipline];
}
