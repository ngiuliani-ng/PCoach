// Trasformazione pura training_plan (JSON) -> view-model per la vista grafica del
// piano (Fase 6, §8). Non deve mai lanciare eccezioni: dati mancanti o malformati
// degradano verso valori "vuoti" (null/[]/stringhe di default), mai verso un crash.
// `todayISO` e' passato esplicitamente (mai `new Date()` interno) per restare pura
// e testabile in modo deterministico.
import type { AthleteTrainingProfile, TrainingStep } from "../schema/types.generated";

type TrainingPlan = NonNullable<AthleteTrainingProfile["training_plan"]>;
type TrainingWeek = NonNullable<TrainingPlan["weeks"]>[number];
type TrainingSessionLike = NonNullable<TrainingWeek["sessions"]>[number];
type SimpleStepLike = { duration_sec?: number | null; distance_m?: number | null; zone?: string; description?: string };

export interface SegmentViewModel {
  kind: string;
  zone: string;
  label: string;
  durationSec: number | null;
  widthPercent: number;
}

export interface SessionViewModel {
  date: string | null;
  day: string | null;
  sessionType: string;
  discipline: string;
  isStructured: boolean;
  targetZone: string;
  targetDurationMin: number | null;
  targetDistanceKm: number | null;
  notes: string;
  segments: SegmentViewModel[];
  stepsText: string[];
  totalDurationSec: number | null;
}

export interface WeekSummary {
  sessionCount: number;
  totalDurationMin: number;
  distanceByDiscipline: Record<string, number>;
}

export interface WeekViewModel {
  index: number;
  weekNumber: number | null;
  weekLabel: string;
  isDeload: boolean;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  summary: WeekSummary;
  sessions: SessionViewModel[];
}

export interface PlanViewModel {
  planName: string;
  startDate: string | null;
  weeks: WeekViewModel[];
}

const MIN_WEIGHT = 1;

function isValidDateStr(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  return !Number.isNaN(Date.parse(value));
}

function stepWeight(step: SimpleStepLike): number {
  if (typeof step.duration_sec === "number" && step.duration_sec > 0) return step.duration_sec;
  if (typeof step.distance_m === "number" && step.distance_m > 0) return step.distance_m;
  return MIN_WEIGHT;
}

function formatMinutesLabel(durationSec: unknown): string {
  return typeof durationSec === "number" ? String(Math.round(durationSec / 60)) : "?";
}

function flattenSteps(steps: TrainingStep[]): { segments: SegmentViewModel[]; stepsText: string[] } {
  type FlatSegment = { kind: string; zone: string; durationSec: number | null; weight: number };
  const flat: FlatSegment[] = [];
  const stepsText: string[] = [];

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const kind = typeof step.kind === "string" ? step.kind : "block";

    if (kind === "repeat") {
      const repetitions = typeof step.repetitions === "number" && step.repetitions > 0 ? Math.round(step.repetitions) : 1;
      const work = step.work && typeof step.work === "object" ? (step.work as SimpleStepLike) : null;
      const recovery = step.recovery && typeof step.recovery === "object" ? (step.recovery as SimpleStepLike) : null;

      for (let i = 0; i < repetitions; i++) {
        if (work) {
          flat.push({ kind: "work", zone: work.zone || "", durationSec: work.duration_sec ?? null, weight: stepWeight(work) });
        }
        if (recovery) {
          flat.push({ kind: "recovery", zone: recovery.zone || "", durationSec: recovery.duration_sec ?? null, weight: stepWeight(recovery) });
        }
      }

      const workText = work ? `${formatMinutesLabel(work.duration_sec)}' ${work.zone || "?"}` : null;
      const recoveryText = recovery ? `${formatMinutesLabel(recovery.duration_sec)}' ${recovery.zone || "?"}` : null;
      const parts = [workText, recoveryText].filter(Boolean).join(" / ");
      stepsText.push(parts ? `${repetitions} × (${parts})` : `${repetitions} ripetizioni`);
    } else {
      const zone = typeof step.zone === "string" ? step.zone : "";
      flat.push({ kind, zone, durationSec: step.duration_sec ?? null, weight: stepWeight(step) });
      const label = step.description || zone || kind;
      stepsText.push(`${formatMinutesLabel(step.duration_sec)}' ${label}`);
    }
  }

  const totalWeight = flat.reduce((sum, s) => sum + s.weight, 0) || 1;
  const segments: SegmentViewModel[] = flat.map((s) => ({
    kind: s.kind,
    zone: s.zone,
    label: s.zone || s.kind,
    durationSec: s.durationSec,
    widthPercent: (s.weight / totalWeight) * 100,
  }));

  return { segments, stepsText };
}

function toSessionViewModel(session: TrainingSessionLike): SessionViewModel {
  const isStructured = !!session?.is_structured;
  const rawSteps = Array.isArray(session?.steps) ? (session.steps as TrainingStep[]) : [];
  const { segments, stepsText } = isStructured ? flattenSteps(rawSteps) : { segments: [], stepsText: [] };
  const totalDurationSec = segments.length
    ? segments.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) || null
    : null;

  return {
    date: isValidDateStr(session?.date) ? (session.date as string) : null,
    day: typeof session?.day === "string" ? session.day : null,
    sessionType: typeof session?.session_type === "string" ? session.session_type : "",
    discipline: typeof session?.discipline === "string" ? session.discipline : "",
    isStructured,
    targetZone: typeof session?.target_zone === "string" ? session.target_zone : "",
    targetDurationMin: typeof session?.target_duration_min === "number" ? session.target_duration_min : null,
    targetDistanceKm: typeof session?.target_distance_km === "number" ? session.target_distance_km : null,
    notes: typeof session?.notes === "string" ? session.notes : "",
    segments,
    stepsText,
    totalDurationSec,
  };
}

function computeWeekDateRange(sessions: SessionViewModel[]): { startDate: string | null; endDate: string | null } {
  const validDates = sessions.map((s) => s.date).filter((d): d is string => !!d);
  if (validDates.length === 0) return { startDate: null, endDate: null };
  const sorted = [...validDates].sort();
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
}

function computeIsCurrent(startDate: string | null, endDate: string | null, todayISO: string): boolean {
  if (!startDate || !endDate || !isValidDateStr(todayISO)) return false;
  return todayISO >= startDate && todayISO <= endDate;
}

function toWeekViewModel(week: TrainingWeek, index: number, todayISO: string): WeekViewModel {
  const rawSessions = Array.isArray(week?.sessions) ? week.sessions : [];
  const sessions = rawSessions.map(toSessionViewModel);
  const { startDate, endDate } = computeWeekDateRange(sessions);
  const weekNumber = typeof week?.week_number === "number" ? week.week_number : null;

  const distanceByDiscipline: Record<string, number> = {};
  let totalDurationMin = 0;
  for (const s of sessions) {
    if (s.targetDurationMin != null) totalDurationMin += s.targetDurationMin;
    else if (s.totalDurationSec != null) totalDurationMin += s.totalDurationSec / 60;
    if (s.targetDistanceKm != null && s.discipline) {
      distanceByDiscipline[s.discipline] = (distanceByDiscipline[s.discipline] || 0) + s.targetDistanceKm;
    }
  }

  return {
    index,
    weekNumber,
    weekLabel: typeof week?.week_label === "string" && week.week_label ? week.week_label : `Settimana ${weekNumber ?? index + 1}`,
    isDeload: !!week?.is_deload,
    startDate,
    endDate,
    isCurrent: computeIsCurrent(startDate, endDate, todayISO),
    summary: { sessionCount: sessions.length, totalDurationMin: Math.round(totalDurationMin), distanceByDiscipline },
    sessions,
  };
}

/** Indice della settimana da aprire di default: quella marcata `isCurrent`,
 * altrimenti la piu' vicina tra le future (startDate >= oggi), altrimenti nessuna. */
export function defaultOpenWeekIndex(plan: PlanViewModel, todayISO: string): number | null {
  const current = plan.weeks.find((w) => w.isCurrent);
  if (current) return current.index;
  const futureWeeks = plan.weeks
    .filter((w): w is WeekViewModel & { startDate: string } => !!w.startDate && w.startDate >= todayISO)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return futureWeeks.length ? futureWeeks[0].index : null;
}

export function buildPlanViewModel(trainingPlan: unknown, todayISO: string): PlanViewModel | null {
  if (!trainingPlan || typeof trainingPlan !== "object") return null;
  const plan = trainingPlan as TrainingPlan;
  if (!Array.isArray(plan.weeks)) return null;

  return {
    planName: typeof plan.plan_name === "string" && plan.plan_name ? plan.plan_name : "Piano senza nome",
    startDate: isValidDateStr(plan.start_date) ? (plan.start_date as string) : null,
    weeks: plan.weeks.map((w, i) => toWeekViewModel(w, i, todayISO)),
  };
}

/** Mappa una stringa di zona libera (es. "Z4", "zona 2") su una variabile CSS
 * --zone-N (1-7); fallback neutro per stringhe non interpretabili. */
export function zoneColorVar(zone: string | null | undefined): string {
  if (!zone) return "var(--zone-unknown)";
  const match = /(\d)/.exec(zone);
  if (!match) return "var(--zone-unknown)";
  const n = Math.min(7, Math.max(1, parseInt(match[1], 10)));
  return `var(--zone-${n})`;
}
