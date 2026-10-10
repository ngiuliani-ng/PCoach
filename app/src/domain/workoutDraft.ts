// Lettura tollerante degli step proposti da Claude nella struttura v2. Non lancia mai: cio' che
// non si riesce a leggere diventa uno step non valido (durata 0 o zona assente), che la
// validazione mostra al coach invece di scartarlo in silenzio.
import type { Discipline, StepRole, WorkoutBlock, WorkoutContent, WorkoutStep, WorkoutStructure, ZoneTarget } from "@shared/workouts/structure.ts";
import { STEP_ROLES, parseZones } from "@shared/workouts/structure.ts";

/** Seduta da inserire (generazione): contenuto piu' i campi di stato iniziali. */
export interface NewWorkout extends WorkoutContent {
  slot: number;
  status: "draft";
  needs_review: string | null;
  change_note: string | null;
}

export function readZone(raw: unknown, rawTo?: unknown): ZoneTarget | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 7) {
    const to = typeof rawTo === "number" && Number.isInteger(rawTo) && rawTo > raw && rawTo <= 7 ? rawTo : null;
    return to ? { zone: raw, zone_to: to } : { zone: raw };
  }
  if (typeof raw !== "string") return null;
  return parseZones(typeof rawTo === "string" && rawTo ? `${raw}-${rawTo}` : raw);
}

function positive(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

type RawStep = Record<string, unknown>;

export function readStep(raw: RawStep, fallbackRole: StepRole): WorkoutStep {
  const role: StepRole = typeof raw.role === "string" && (STEP_ROLES as readonly string[]).includes(raw.role)
    ? (raw.role as StepRole)
    : fallbackRole;
  const seconds = positive(raw.duration_sec);
  const meters = positive(raw.distance_m);
  const duration = seconds ? { type: "time" as const, seconds: Math.round(seconds) }
    : meters ? { type: "distance" as const, meters: Math.round(meters) }
    : { type: "time" as const, seconds: 0 };
  const step: WorkoutStep = { kind: "step", role, duration, target: readZone(raw.zone, raw.zone_to) };
  const cue = typeof raw.cue === "string" ? raw.cue.trim() : "";
  if (cue) step.cue = cue.slice(0, 80);
  return step;
}

/** Converte gli step della proposta: step semplici e ripetute con i propri step. */
export function readStructure(rawSteps: unknown): WorkoutStructure | null {
  if (!Array.isArray(rawSteps) || !rawSteps.length) return null;
  const blocks: WorkoutBlock[] = [];
  for (const raw of rawSteps) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as RawStep;
    if (r.kind === "repeat") {
      const count = typeof r.count === "number" ? r.count : 1;
      const inner = Array.isArray(r.steps)
        ? r.steps.filter((s): s is RawStep => !!s && typeof s === "object").map((s) => readStep(s, "work"))
        : [];
      const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : undefined;
      blocks.push({ kind: "repeat", count: Math.max(1, Math.round(count)), ...(label ? { label } : {}), steps: inner });
    } else {
      blocks.push(readStep(r, "steady"));
    }
  }
  return blocks.length ? { version: 2, steps: blocks } : null;
}

export function disciplineFallbackTitle(discipline: Discipline): string {
  return { running: "Corsa", cycling: "Bici", swimming: "Nuoto", strength: "Palestra" }[discipline];
}
