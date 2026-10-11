// Sedute da registrare come svolte (ADR 0019, 0021): solo quelle abbinate con certezza a
// un'attivita' di Intervals.icu (evento abbinato su Intervals.icu, oppure stesso giorno e stessa
// disciplina con una sola coppia possibile). Regola unica per l'analisi del feedback, l'apertura
// della scheda e l'anteprima di «Sincronizza settimana». Con la seduta si salvano l'esito rispetto
// al prescritto (una seduta molto ridotta e' «svolta in parte») e i dati dell'attivita', fra cui
// l'RPE, che la generazione successiva passa a Claude.
import { addDaysISO } from "../workouts/calendar.ts";
import { matchWeek } from "./match.ts";
import { normalizeActivities } from "./normalize.ts";
import { DEFAULT_FEEDBACK_PARAMS, type FeedbackParams } from "./params.ts";
import type { PlannedWorkout, RawActivity, SessionResult } from "./types.ts";

export type CompletionOutcome = "completed" | "over" | "partial" | "short";

/** Dati dell'attivita' abbinata, salvati sulla seduta (colonne di workouts). */
export interface ActivitySnapshot {
  activity_minutes: number | null;
  activity_meters: number | null;
  activity_load: number | null;
  activity_rpe: number | null;
}

export interface Completion {
  workout_id: string;
  activity_id: string;
  /** Inizio dell'attivita' in UTC. */
  completed_at: string;
  outcome: CompletionOutcome;
  /** Rapporto svolto/prescritto (tempo, o distanza per le sedute a sola distanza). */
  ratio: number | null;
  snapshot: ActivitySnapshot;
}

const DONE_OUTCOMES = new Set<string>(["completed", "over", "partial", "short"]);

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function activitySnapshot(raw: RawActivity | undefined): ActivitySnapshot {
  const seconds = num(raw?.moving_time);
  return {
    activity_minutes: seconds !== null ? Math.round(seconds / 6) / 10 : null,
    activity_meters: num(raw?.distance) !== null ? Math.round(raw!.distance as number) : null,
    activity_load: num(raw?.icu_training_load),
    activity_rpe: num(raw?.icu_rpe)
  };
}

/** Colonne di workouts da scrivere per una seduta svolta. */
export function completionColumns(c: Completion): Record<string, unknown> {
  return {
    completed_at: c.completed_at,
    completed_activity_id: c.activity_id,
    completion_source: "intervals",
    completion_outcome: c.outcome,
    completion_ratio: c.ratio,
    ...c.snapshot
  };
}

/** Completamenti certi fra le sedute abbinate; esclude quelle gia' registrate come svolte. */
export function completionsFrom(sessions: SessionResult[], workouts: PlannedWorkout[], activities: RawActivity[]): Completion[] {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const out: Completion[] = [];
  for (const s of sessions) {
    const w = byId.get(s.workout_id);
    if (!w || w.completed_at || !s.activity_ids.length) continue;
    if (s.confidence !== "confirmed" && s.confidence !== "high") continue;
    if (!DONE_OUTCOMES.has(s.outcome)) continue;
    const raw = activities.find((a) => String(a.id) === s.activity_ids[0]);
    out.push({
      workout_id: w.id,
      activity_id: s.activity_ids[0],
      completed_at: raw?.start_date ?? `${s.date}T12:00:00Z`,
      outcome: s.outcome as CompletionOutcome,
      ratio: s.ratio,
      snapshot: activitySnapshot(raw)
    });
  }
  return out;
}

/** Completamenti certi delle sedute approvate in un intervallo di giorni (fino a oggi). */
export function completionsIn(
  workouts: PlannedWorkout[], activities: RawActivity[], window: { start: string; end: string }, today: string,
  params: FeedbackParams = DEFAULT_FEEDBACK_PARAMS
): Completion[] {
  const inWindow = workouts.filter((w) => w.planned_date >= window.start && w.planned_date <= window.end);
  const { sessions } = matchWeek({
    workouts: inWindow, activities: normalizeActivities(activities, window), today, params, inPlan: () => true
  });
  return completionsFrom(sessions, inWindow, activities);
}

/** Giorni riletti all'apertura della scheda. */
export const RECENT_COMPLETION_DAYS = 14;

/** Completamenti certi delle sedute approvate degli ultimi giorni, da oggi all'indietro. */
export function recentCompletions(
  workouts: PlannedWorkout[], activities: RawActivity[], today: string, params: FeedbackParams = DEFAULT_FEEDBACK_PARAMS
): Completion[] {
  return completionsIn(workouts, activities, { start: addDaysISO(today, -(RECENT_COMPLETION_DAYS - 1)), end: today }, today, params);
}

/** Seduta gia' registrata come svolta, con i dati dell'attivita' salvati. */
export interface RecordedWorkout extends Partial<ActivitySnapshot> {
  id: string;
  completion_source: string | null;
  completed_activity_id: string | null;
}

/**
 * Sedute registrate da Intervals.icu i cui dati dell'attivita' sono cambiati: ad esempio l'RPE
 * inserito dall'atleta dopo che la seduta e' stata riconosciuta come svolta.
 */
export function snapshotRefreshes(workouts: RecordedWorkout[], activities: RawActivity[]): { workout_id: string; snapshot: ActivitySnapshot }[] {
  const out: { workout_id: string; snapshot: ActivitySnapshot }[] = [];
  for (const w of workouts) {
    if (w.completion_source !== "intervals" || !w.completed_activity_id) continue;
    const raw = activities.find((a) => String(a.id) === w.completed_activity_id);
    if (!raw) continue;
    const snap = activitySnapshot(raw);
    const changed = (Object.keys(snap) as (keyof ActivitySnapshot)[]).some((k) => (w[k] ?? null) !== snap[k]);
    if (changed) out.push({ workout_id: w.id, snapshot: snap });
  }
  return out;
}
