// Tipi dell'analisi del feedback settimanale (ADR 0019): dati in ingresso, attivita'
// normalizzate, abbinamenti e contratto passato al modello e salvato con la valutazione.
import type { Discipline, TargetMetric, WorkoutStructure } from "../workouts/structure.ts";

export const ANALYSIS_VERSION = "1.2.0";

export interface Period {
  start: string; // lunedi'
  end: string; // domenica
}

/** Seduta approvata del periodo, come letta dal database. */
export interface PlannedWorkout {
  id: string;
  revision: number;
  planned_date: string;
  slot: number;
  discipline: Discipline;
  title: string;
  objective: string;
  duration_min: number | null;
  structure: WorkoutStructure | null;
  primary_target: TargetMetric;
  completed_at: string | null;
  /** Evento su Intervals.icu (workout_sync.remote_event_id), se inviata. */
  remote_event_id: number | null;
}

/** Modifica del coach a una seduta del periodo durante il periodo (da workout_events). */
export interface CoachChange {
  workout_id: string;
  type: string;
  at: string;
  note: string | null;
}

/** Finestra di un piano (training_plans): i giorni coperti sono "nel piano". */
export interface PlanWindow {
  id: string;
  start_date: string;
  end_date: string | null;
  status: string;
  weeks_meta: { week_start: string; label: string; is_deload: boolean; cycle_week?: number }[];
}

/** Attivita' come restituita da GET /athlete/0/activities (solo i campi usati). */
export interface RawActivity {
  id?: string | number;
  start_date_local?: string;
  start_date?: string;
  type?: string;
  source?: string;
  _note?: string;
  name?: string;
  moving_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
  icu_training_load?: number | null;
  icu_rpe?: number | null;
  feel?: number | null;
  session_rpe?: number | null;
  paired_event_id?: number | null;
  device_watts?: boolean | null;
  has_heartrate?: boolean | null;
  icu_zone_times?: { id: string; secs: number }[] | null;
  icu_hr_zone_times?: number[] | null;
  pace_zone_times?: number[] | null;
  gap_zone_times?: number[] | null;
  use_gap_zone_times?: boolean | null;
  icu_ftp?: number | null;
  lthr?: number | null;
}

/** Giorno di benessere da GET /athlete/0/wellness (solo i campi usati). */
export interface RawWellness {
  id: string; // data
  ctl?: number | null;
  atl?: number | null;
  hrv?: number | null;
  restingHR?: number | null;
  sleepSecs?: number | null;
  sleepQuality?: number | null;
  fatigue?: number | null;
  soreness?: number | null;
  stress?: number | null;
  mood?: number | null;
  motivation?: number | null;
}

export type ActivityDiscipline = Discipline | "other";
export type ActivityStatus = "ok" | "unavailable" | "duplicate";

export interface ZoneSeconds {
  power: number[] | null;
  hr: number[] | null;
  pace: number[] | null;
}

export interface NormalizedActivity {
  id: string;
  date: string;
  start_local: string;
  start_utc: string | null;
  source: string;
  provider_type: string;
  discipline: ActivityDiscipline;
  minutes: number;
  meters: number | null;
  elevation_m: number | null;
  zone_seconds: ZoneSeconds;
  load: number | null;
  rpe: number | null;
  feel: number | null;
  session_rpe: number | null;
  sensors: { hr: boolean; power: boolean; pace: boolean };
  paired_event_id: number | null;
  ftp: number | null;
  lthr: number | null;
  name: string;
  status: ActivityStatus;
  duplicate_of?: string;
}

export type SessionOutcome =
  | "completed"
  | "over"
  | "partial"
  | "short"
  | "moved"
  | "substituted"
  | "not_recorded"
  | "data_unavailable"
  | "pending"
  | "ambiguous";

export type MatchMethod = "paired_event" | "same_day" | "same_day_order" | "split" | "moved" | "substitution";
export type Confidence = "confirmed" | "high" | "medium" | "low";

export interface SessionResult {
  workout_id: string;
  revision: number;
  date: string;
  /** Giorno della settimana in italiano, calcolato da PCoach (il modello lo sbaglia). */
  weekday: string;
  discipline: Discipline;
  title: string;
  outcome: SessionOutcome;
  activity_ids: string[];
  method: MatchMethod | null;
  confidence: Confidence | null;
  planned_minutes: number;
  planned_meters: number | null;
  done_minutes: number | null;
  /** Rapporto svolto/prescritto (tempo, o distanza per le sedute a sola distanza). */
  ratio: number | null;
  ratio_basis: "time" | "distance" | null;
  /** Seduta di qualita': lavoro oltre l'intensita' bassa del sistema di zone dell'atleta. */
  key_session: boolean;
  quality: { metric: TargetMetric; from_zone: number; planned_min: number; done_min: number | null; ratio: number | null; reason?: string } | null;
}

/** ambiguous: svolta ma non attribuibile a una seduta precisa (conta nel volume, non e' extra). */
export type ActivityClass = "matched" | "ambiguous" | "extra" | "substitute" | "out_of_plan" | "other" | "unavailable" | "duplicate";

export interface ActivityResult {
  activity_id: string;
  date: string;
  weekday: string;
  discipline: ActivityDiscipline;
  minutes: number;
  classification: ActivityClass;
  workout_id?: string;
  substitutes?: string;
}

export interface Anomaly {
  code:
    | "activities_unavailable"
    | "duplicate_removed"
    | "unmapped_type"
    | "ambiguous_match"
    | "early_evaluation"
    | "plan_changed_midweek"
    | "period_outside_plan"
    | "metric_mismatch"
    | "threshold_mismatch";
  detail: string;
}

export type ForbiddenClaim =
  | "recovery_diagnosis"
  | "overtraining"
  | "injury_risk"
  | "fitness_change"
  | "missed_session_as_fact"
  | "causal_attribution";

export type Topic = "adherence" | "volume" | "intensity" | "key_sessions" | "trend" | "load_status" | "response";
