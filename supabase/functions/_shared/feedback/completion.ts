// Sedute da registrare come svolte (ADR 0019): solo quelle abbinate con certezza a un'attivita'
// di Intervals.icu (evento abbinato su Intervals.icu, oppure stesso giorno e stessa disciplina con
// una sola coppia possibile). Regola unica per l'analisi del feedback e per l'apertura della scheda.
import { addDaysISO } from "../workouts/calendar.ts";
import { matchWeek } from "./match.ts";
import { normalizeActivities } from "./normalize.ts";
import { DEFAULT_FEEDBACK_PARAMS, type FeedbackParams } from "./params.ts";
import type { PlannedWorkout, RawActivity, SessionResult } from "./types.ts";

export interface Completion {
  workout_id: string;
  activity_id: string;
  /** Inizio dell'attivita' in UTC. */
  completed_at: string;
}

const DONE_OUTCOMES = new Set(["completed", "over", "partial", "short"]);

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
    out.push({ workout_id: w.id, activity_id: s.activity_ids[0], completed_at: raw?.start_date ?? `${s.date}T12:00:00Z` });
  }
  return out;
}

/** Giorni riletti all'apertura della scheda. */
export const RECENT_COMPLETION_DAYS = 14;

/** Completamenti certi delle sedute approvate degli ultimi giorni, da oggi all'indietro. */
export function recentCompletions(
  workouts: PlannedWorkout[], activities: RawActivity[], today: string, params: FeedbackParams = DEFAULT_FEEDBACK_PARAMS
): Completion[] {
  const window = { start: addDaysISO(today, -(RECENT_COMPLETION_DAYS - 1)), end: today };
  const inWindow = workouts.filter((w) => w.planned_date >= window.start && w.planned_date <= window.end);
  const { sessions } = matchWeek({
    workouts: inWindow, activities: normalizeActivities(activities, window), today, params, inPlan: () => true
  });
  return completionsFrom(sessions, inWindow, activities);
}
