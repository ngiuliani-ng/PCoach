// Contratto feedback_input (ADR 0019): tutto cio' che il modello riceve e che si salva con la
// valutazione per poterla riprodurre. Ogni numero e' calcolato qui, con numeratori e
// denominatori espliciti; il modello non ricalcola nulla.
import { addDaysISO, daysBetween, weekdayName } from "../workouts/calendar.ts";
import type { Discipline, TargetMetric, WorkoutStep } from "../workouts/structure.ts";
import { flattenSteps, stepSeconds } from "../workouts/structure.ts";
import type { PaceContext } from "../workouts/thresholds.ts";
import { matchWeek } from "./match.ts";
import { isUnmappedType, normalizeActivities } from "./normalize.ts";
import type { ZoneCount, ZoneDiscipline } from "../workouts/zones.ts";
import { zoneBands, type FeedbackParams, type LoadProgression, type ZoneBands } from "./params.ts";
import {
  ANALYSIS_VERSION, type ActivityResult, type Anomaly, type CoachChange, type ForbiddenClaim, type NormalizedActivity,
  type Period, type PlannedWorkout, type PlanWindow, type RawActivity, type RawWellness, type SessionResult, type Topic
} from "./types.ts";

export interface AthleteInfo {
  id: string;
  display_name: string;
  intensity_model: string;
  load_pattern: string;
  progression: LoadProgression;
  /** Sistema di zone per disciplina (corsa e bici dalla scheda, nuoto 7): decide i domini d'intensita'. */
  zone_counts: Record<ZoneDiscipline, ZoneCount>;
  /** Soglie correnti in PCoach, per segnalare differenze con quelle usate da Intervals.icu. */
  ftp_watts: number | null;
  lthr_bpm: number | null;
  /** Date degli eventi obiettivo (gare). */
  event_dates: string[];
}

export interface AnalysisInput {
  athlete: AthleteInfo;
  period: Period;
  /** Oggi nel fuso del coach, al momento della valutazione. */
  today: string;
  evaluated_at: string;
  timezone: string;
  workouts: PlannedWorkout[];
  excluded_drafts: number;
  coach_changes: CoachChange[];
  plans: PlanWindow[];
  /** Attivita' dal lunedi' della settimana precedente alla fine del periodo. */
  activities: RawActivity[];
  /** Benessere dai 35 giorni prima dell'inizio alla fine del periodo. */
  wellness: RawWellness[];
  params: FeedbackParams;
  /** Scale di passo dell'atleta per la durata degli step a distanza (ADR 0030). */
  pace?: PaceContext | null;
}

const ENDURANCE: Discipline[] = ["running", "cycling", "swimming"];
const DONE = new Set(["completed", "over", "partial", "short", "moved"]);
const OBSERVED = new Set(["matched", "ambiguous", "extra", "substitute", "out_of_plan"]);
const FORBIDDEN: ForbiddenClaim[] = ["recovery_diagnosis", "overtraining", "injury_risk", "fitness_change", "missed_session_as_fact", "causal_attribution"];

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const ratio = (num: number, den: number) => (den > 0 ? round(num / den, 2) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function inPlanFn(plans: PlanWindow[]) {
  return (date: string) => plans.some((p) => p.start_date <= date && (p.end_date === null || p.end_date >= date));
}

function weekMeta(plans: PlanWindow[], weekStart: string) {
  for (const p of plans) {
    const m = p.weeks_meta.find((x) => x.week_start === weekStart);
    if (m) return m;
  }
  return null;
}

/** Dominio di intensita' di una zona nel sistema di zone dato: 0 bassa, 1 media, 2 alta. */
export function domainOf(zone: number, b: ZoneBands): 0 | 1 | 2 {
  return zone <= b.low_max ? 0 : zone <= b.moderate_max ? 1 : 2;
}

/** Descrizione dei domini, salvata nel contratto: chi legge sa con quale regola si e' contato. */
export function domainsLabel(b: ZoneBands): string {
  const high = b.moderate_max < b.zones ? `, alta ≥ Z${b.moderate_max + 1}` : "";
  return `${b.zones} zone: bassa ≤ Z${b.low_max}, media Z${b.low_max + 1}-Z${b.moderate_max}${high}`;
}

function plannedDomains(steps: WorkoutStep[], discipline: Discipline, b: ZoneBands, pace?: PaceContext | null): number[] {
  const out = [0, 0, 0];
  for (const s of steps) {
    if (!s.target) continue;
    const from = s.target.zone;
    const to = Math.max(from, s.target.zone_to ?? from);
    const sec = stepSeconds(s, discipline, pace) / (to - from + 1);
    for (let z = from; z <= to; z++) out[domainOf(z, b)] += sec;
  }
  return out;
}

function observedDomains(zones: number[], b: ZoneBands): number[] {
  const out = [0, 0, 0];
  zones.forEach((sec, i) => { out[domainOf(i + 1, b)] += sec; });
  return out;
}

const shares = (xs: number[]) => {
  const total = xs.reduce((s, x) => s + x, 0);
  return total > 0 ? xs.map((x) => round(x / total, 2)) : null;
};

function intensityMetric(discipline: Discipline, workouts: PlannedWorkout[], acts: NormalizedActivity[]): TargetMetric | null {
  const counts = new Map<TargetMetric, number>();
  workouts.filter((w) => w.discipline === discipline && w.primary_target !== "none")
    .forEach((w) => counts.set(w.primary_target, (counts.get(w.primary_target) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  if (discipline === "cycling") return acts.length && acts.every((a) => a.sensors.power) ? "power" : "hr";
  if (discipline === "running" || discipline === "swimming") return "pace";
  return null;
}

function deviationOf(r: number | null, p: FeedbackParams) {
  if (r === null) return null;
  const pct = Math.abs(r - 1) * 100;
  return {
    direction: r >= 1 ? "above" : "below",
    level: pct >= p.deviation_notable_pct ? "notable" : pct >= p.deviation_minor_pct ? "minor" : "in_line"
  };
}

export function buildFeedbackInput(a: AnalysisInput) {
  const p = a.params;
  const prevStart = addDaysISO(a.period.start, -7);
  const prevEnd = addDaysISO(a.period.start, -1);
  const inPlan = inPlanFn(a.plans);

  const current = normalizeActivities(a.activities, a.period);
  const previous = normalizeActivities(a.activities, { start: prevStart, end: prevEnd });
  const { sessions, activities } = matchWeek({ workouts: a.workouts, activities: current, today: a.today, params: p, zones: a.athlete.zone_counts, pace: a.pace, inPlan });
  const actById = new Map(current.map((x) => [x.id, x]));
  const observedActs = activities.filter((r) => OBSERVED.has(r.classification)).map((r) => actById.get(r.activity_id)!);

  // ---------- Sedute ----------
  const count = (...o: string[]) => sessions.filter((s) => o.includes(s.outcome)).length;
  const pending = count("pending");
  const past = sessions.length - pending;
  const unknown = count("data_unavailable", "ambiguous");
  const done = count("completed", "over", "moved");
  const denominator = past - unknown;
  const sessionCounts = {
    assigned: sessions.length, past, pending,
    completed: count("completed", "over"), partial: count("partial", "short"), moved: count("moved"),
    substituted: count("substituted"), not_recorded: count("not_recorded"),
    data_unavailable: count("data_unavailable"), ambiguous: count("ambiguous"), unknown,
    extra: activities.filter((r) => r.classification === "extra").length
  };
  const completion_rate = {
    numerator: done, denominator,
    value: ratio(done, denominator),
    reportable: denominator > 0 && past > 0 && (unknown / past) * 100 <= p.unknown_max_share_pct,
    definition: "(completate + oltre + spostate) / (sedute passate − indeterminate); le extra non contano"
  };

  // ---------- Volume e carico per disciplina ----------
  const disciplines = [...new Set<Discipline>([
    ...sessions.map((s) => s.discipline),
    ...observedActs.map((x) => x.discipline).filter((d): d is Discipline => d !== "other")
  ])];
  const pastSessions = sessions.filter((s) => s.outcome !== "pending");
  const by_discipline: Record<string, unknown> = {};
  for (const d of disciplines) {
    const planned_min = pastSessions.filter((s) => s.discipline === d).reduce((t, s) => t + s.planned_minutes, 0);
    const matched_min = pastSessions.filter((s) => s.discipline === d && DONE.has(s.outcome)).reduce((t, s) => t + (s.done_minutes ?? 0), 0);
    const acts = observedActs.filter((x) => x.discipline === d);
    const extraIds = new Set(activities.filter((r) => r.classification === "extra" || r.classification === "substitute").map((r) => r.activity_id));
    const r = ratio(matched_min, planned_min);
    by_discipline[d] = {
      planned_min, matched_min,
      volume_ratio: r,
      deviation: deviationOf(r, p),
      observed_min: Math.round(acts.reduce((t, x) => t + x.minutes, 0)),
      extra_min: Math.round(acts.filter((x) => extraIds.has(x.id)).reduce((t, x) => t + x.minutes, 0)),
      load_sum: Math.round(acts.reduce((t, x) => t + (x.load ?? 0), 0)),
      load_method: "icu_training_load (Intervals.icu; il metodo dipende dal tipo di attività: non sommabile fra discipline)",
      session_rpe_sum: acts.some((x) => x.session_rpe != null) ? Math.round(acts.reduce((t, x) => t + (x.session_rpe ?? 0), 0)) : null
    };
  }

  // ---------- Distribuzione dell'intensita' (3 domini, stessa metrica) ----------
  const intensity: Record<string, unknown> = {};
  for (const d of disciplines.filter((x) => x !== "strength")) {
    const acts = observedActs.filter((x) => x.discipline === d);
    const metric = intensityMetric(d, a.workouts, acts);
    if (!metric || metric === "none") continue;
    const bands = zoneBands(p, a.athlete.zone_counts[d as ZoneDiscipline]);
    const plannedSteps = a.workouts
      .filter((w) => w.discipline === d && w.primary_target === metric && sessions.find((s) => s.workout_id === w.id)?.outcome !== "pending")
      .flatMap((w) => flattenSteps(w.structure));
    const planned = plannedDomains(plannedSteps, d, bands, a.pace);
    const observed = [0, 0, 0];
    let basisSec = 0;
    for (const x of acts) {
      const zones = metric === "power" && !x.sensors.power ? null : x.zone_seconds[metric];
      if (!zones) continue;
      observedDomains(zones, bands).forEach((v, i) => { observed[i] += v; });
      basisSec += zones.reduce((s, v) => s + v, 0);
    }
    intensity[d] = {
      metric,
      domains: domainsLabel(bands),
      planned: shares(planned),
      observed: shares(observed),
      basis_min: Math.round(basisSec / 60),
      reportable: basisSec / 60 >= p.min_distribution_minutes && shares(observed) !== null
    };
  }

  // ---------- Tendenza: confronto con la settimana precedente ----------
  const prevObserved = previous.filter((x) => x.status === "ok" && x.discipline !== "other");
  const curMeta = weekMeta(a.plans, a.period.start);
  const prevMeta = weekMeta(a.plans, prevStart);
  const raceWeek = a.athlete.event_dates.some((d) => d >= prevStart && d <= a.period.end);
  const complete = a.today > a.period.end;
  const twoWeeks = Array.from({ length: 14 }, (_, i) => addDaysISO(prevStart, i));
  const partlyOutsidePlan = twoWeeks.some((d) => !inPlan(d));
  let expected: { min_pct: number; max_pct: number } | null = null;
  let comparison_reason = "fase non nota: confronto solo descrittivo";
  if (raceWeek) comparison_reason = "gara in una delle due settimane: confronto non significativo";
  else if (!complete) comparison_reason = "settimana non ancora conclusa: confronto non significativo";
  else if (partlyOutsidePlan) comparison_reason = "una delle due settimane è in parte fuori dal piano: confronto non significativo";
  else if (curMeta && prevMeta) {
    const pr = a.athlete.progression;
    if (curMeta.is_deload && !prevMeta.is_deload) {
      expected = { min_pct: -pr.deload_decrease_pct - p.deviation_minor_pct, max_pct: -pr.deload_decrease_pct + p.deviation_minor_pct };
      comparison_reason = "settimana di scarico dopo una di carico";
    } else if (!curMeta.is_deload && prevMeta.is_deload) {
      comparison_reason = "nuovo ciclo dopo lo scarico: atteso un aumento, senza percentuale prefissata";
    } else if (!curMeta.is_deload && !prevMeta.is_deload) {
      expected = { min_pct: pr.increase_min_pct, max_pct: pr.increase_max_pct };
      comparison_reason = "due settimane di carico consecutive";
    } else comparison_reason = "due settimane di scarico consecutive";
  }
  const totalOf = (xs: NormalizedActivity[]) => Math.round(xs.filter((x) => ENDURANCE.includes(x.discipline as Discipline)).reduce((t, x) => t + x.minutes, 0));
  const curTotal = totalOf(observedActs);
  const prevTotal = totalOf(prevObserved);
  const changePct = prevTotal > 0 ? round(((curTotal - prevTotal) / prevTotal) * 100) : null;
  const trend = {
    previous_week: prevStart,
    current_phase: curMeta ? { label: curMeta.label, is_deload: curMeta.is_deload, cycle_week: curMeta.cycle_week ?? null } : null,
    previous_phase: prevMeta ? { label: prevMeta.label, is_deload: prevMeta.is_deload, cycle_week: prevMeta.cycle_week ?? null } : null,
    comparable: !raceWeek && complete && !partlyOutsidePlan && prevTotal > 0,
    comparison_reason,
    endurance_minutes: { current: curTotal, previous: prevTotal, change_pct: changePct },
    expected_change_pct: expected,
    within_expected: expected && changePct !== null && complete && !partlyOutsidePlan ? (changePct < expected.min_pct ? "below" : changePct > expected.max_pct ? "above" : "within") : null,
    by_discipline: Object.fromEntries(ENDURANCE.map((d) => {
      const c = Math.round(observedActs.filter((x) => x.discipline === d).reduce((t, x) => t + x.minutes, 0));
      const pv = Math.round(prevObserved.filter((x) => x.discipline === d).reduce((t, x) => t + x.minutes, 0));
      return [d, { current_min: c, previous_min: pv, change_pct: pv > 0 ? round(((c - pv) / pv) * 100) : null }];
    }).filter(([, v]) => (v as { current_min: number; previous_min: number }).current_min + (v as { previous_min: number }).previous_min > 0))
  };

  // ---------- Carico di Intervals.icu (descrittivo) ----------
  const wellByDate = new Map(a.wellness.map((w) => [w.id, w]));
  const dayBefore = wellByDate.get(prevEnd);
  const lastDay = wellByDate.get(a.period.end) ?? [...a.wellness].filter((w) => w.id <= a.period.end).sort((x, y) => x.id.localeCompare(y.id)).at(-1);
  const load_status = lastDay?.ctl != null
    ? {
      source: "Intervals.icu",
      ctl_start: dayBefore?.ctl != null ? round(dayBefore.ctl, 1) : null,
      ctl_end: round(lastDay.ctl, 1),
      atl_end: lastDay.atl != null ? round(lastDay.atl, 1) : null,
      end_date: lastDay.id,
      note: "medie mobili del carico (42 e 7 giorni): descrivono il carico, non la forma né il rischio"
    }
    : null;

  // ---------- Risposta dell'atleta ----------
  const rated = observedActs.filter((x) => x.rpe != null);
  const rpe_coverage = observedActs.length ? round(rated.length / observedActs.length, 2) : 0;
  const weekDays = a.wellness.filter((w) => w.id >= a.period.start && w.id <= a.period.end);
  const baseDays = a.wellness.filter((w) => w.id >= addDaysISO(a.period.start, -28) && w.id < a.period.start);
  const compare = (pick: (w: RawWellness) => number | null | undefined, digits = 0) => {
    const wk = weekDays.map(pick).filter((v): v is number => typeof v === "number");
    const bs = baseDays.map(pick).filter((v): v is number => typeof v === "number");
    const m = mean(wk);
    const b = mean(bs);
    return m === null ? null : {
      week_mean: round(m, digits), week_days: wk.length,
      baseline_mean_28d: b === null || bs.length < 14 ? null : round(b, digits), baseline_days: bs.length,
      change_pct: b && bs.length >= 14 && wk.length >= 3 ? round(((m - b) / b) * 100) : null
    };
  };
  const wellnessDays = weekDays.filter((w) => w.hrv != null || w.restingHR != null || w.sleepSecs != null).length;
  const response = {
    rpe: { coverage: rpe_coverage, rated: rated.length, of: observedActs.length, mean: rated.length ? round(mean(rated.map((x) => x.rpe!))!, 1) : null, scale: "RPE 1-10 inserito dall'atleta su Intervals.icu" },
    wellness: {
      days_with_data: wellnessDays,
      hrv: compare((w) => w.hrv),
      resting_hr: compare((w) => w.restingHR),
      sleep_hours: compare((w) => (w.sleepSecs != null ? w.sleepSecs / 3600 : null), 1)
    },
    available: rpe_coverage * 100 >= p.min_rpe_coverage_pct || wellnessDays >= p.min_wellness_days,
    note: "dati descrittivi: una settimana non basta per conclusioni su recupero o adattamento"
  };

  // ---------- Qualita' dei dati e anomalie ----------
  const unavailable = activities.filter((r) => r.classification === "unavailable").length;
  const duplicates = activities.filter((r) => r.classification === "duplicate").length;
  const anomalies: Anomaly[] = [];
  if (unavailable) anomalies.push({ code: "activities_unavailable", detail: `${unavailable} attività senza dati via API (ad esempio importate da Strava).` });
  if (duplicates) anomalies.push({ code: "duplicate_removed", detail: `${duplicates} attività doppie escluse.` });
  const unmapped = [...new Set(current.filter((x) => isUnmappedType(x.provider_type)).map((x) => x.provider_type))];
  if (unmapped.length) anomalies.push({ code: "unmapped_type", detail: `Tipi di attività non riconosciuti: ${unmapped.join(", ")}.` });
  if (sessionCounts.ambiguous) anomalies.push({ code: "ambiguous_match", detail: `${sessionCounts.ambiguous} sedute non attribuibili con certezza alle attività dello stesso giorno.` });
  if (!complete) anomalies.push({ code: "early_evaluation", detail: `Valutazione eseguita il ${a.today}, prima della fine della settimana (${a.period.end}).` });
  if (a.coach_changes.length) anomalies.push({ code: "plan_changed_midweek", detail: `${a.coach_changes.length} modifiche del coach alle sedute durante la settimana.` });
  const outside = Array.from({ length: daysBetween(a.period.start, a.period.end) + 1 }, (_, i) => addDaysISO(a.period.start, i)).filter((d) => !inPlan(d));
  if (outside.length) anomalies.push({ code: "period_outside_plan", detail: `${outside.length} giorni della settimana fuori dal piano: le attività di quei giorni non sono extra.` });
  for (const s of sessions) if (s.quality?.reason) anomalies.push({ code: "metric_mismatch", detail: `${s.title} (${s.date}): ${s.quality.reason}.` });
  const ftps = current.filter((x) => x.discipline === "cycling" && x.ftp).map((x) => x.ftp!);
  if (a.athlete.ftp_watts && ftps.length && Math.abs(ftps.at(-1)! - a.athlete.ftp_watts) / a.athlete.ftp_watts > 0.03) {
    anomalies.push({ code: "threshold_mismatch", detail: `FTP ${a.athlete.ftp_watts} W in PCoach, ${ftps.at(-1)} W su Intervals.icu: le zone di potenza seguono Intervals.icu.` });
  }
  const lthrs = current.filter((x) => x.discipline === "running" && x.lthr).map((x) => x.lthr!);
  if (a.athlete.lthr_bpm && lthrs.length && Math.abs(lthrs.at(-1)! - a.athlete.lthr_bpm) / a.athlete.lthr_bpm > 0.03) {
    anomalies.push({ code: "threshold_mismatch", detail: `Soglia anaerobica ${a.athlete.lthr_bpm} bpm in PCoach, ${lthrs.at(-1)} bpm su Intervals.icu (corsa).` });
  }

  const level = past > 0 && unknown === past ? "insufficient" : unavailable || unknown || !complete ? "partial" : "complete";
  const limitations: string[] = [];
  if (!response.available) limitations.push("Mancano dati su come l'atleta ha risposto (RPE, benessere): nessuna conclusione sul recupero; si può chiedere.");
  if (unavailable) limitations.push("Alcune attività non sono leggibili via API: le sedute di quei giorni non si possono valutare.");
  if (sessionCounts.ambiguous) limitations.push("Alcune sedute non sono attribuibili con certezza alle attività svolte.");
  if (!completion_rate.reportable && past > 0) limitations.push("Troppe sedute indeterminate: il tasso di completamento non si comunica.");
  if (!complete) limitations.push("La settimana non è ancora finita: i giorni restanti non sono valutabili.");
  if (anomalies.some((x) => x.code === "threshold_mismatch")) limitations.push("Le soglie in PCoach e su Intervals.icu non coincidono: il tempo nelle zone segue Intervals.icu.");

  const allowed: Topic[] = ["adherence", "volume"];
  if (Object.values(intensity).some((v) => (v as { reportable: boolean }).reportable)) allowed.push("intensity");
  if (sessions.some((s) => s.quality && s.quality.ratio !== null)) allowed.push("key_sessions");
  if (trend.comparable) allowed.push("trend");
  if (load_status) allowed.push("load_status");
  if (response.available) allowed.push("response");

  return {
    contract: "feedback_input" as const,
    version: "1.0.0",
    analysis_version: ANALYSIS_VERSION,
    generated_at: a.evaluated_at,
    athlete: { id: a.athlete.id, display_name: a.athlete.display_name, timezone: a.timezone, intensity_model: a.athlete.intensity_model, load_pattern: a.athlete.load_pattern, progression: a.athlete.progression },
    period: { ...a.period, start_weekday: "lunedì", end_weekday: "domenica", complete, evaluated_on: a.today, evaluated_on_weekday: weekdayName(a.today) },
    params: p,
    plan: { plan_ids: a.plans.map((x) => x.id), week_meta: curMeta },
    sessions: sessions as SessionResult[],
    coach_changes: a.coach_changes,
    excluded: { draft: a.excluded_drafts },
    activities: activities.map((r) => {
      const x = actById.get(r.activity_id);
      return {
        ...r,
        provider_type: x?.provider_type ?? "", source: x?.source ?? "",
        start_local: x?.start_local ?? "",
        load: x?.load ?? null, rpe: x?.rpe ?? null, elevation_m: x?.elevation_m ?? null,
        meters: x?.meters != null ? Math.round(x.meters) : null,
        sensors: x?.sensors ?? null
      };
    }) as (ActivityResult & Record<string, unknown>)[],
    metrics: { sessions: sessionCounts, completion_rate, by_discipline, intensity, trend, load_status },
    response,
    data_quality: { level, activities_unavailable: unavailable, duplicates_removed: duplicates, unknown_sessions: unknown },
    anomalies,
    limitations,
    allowed_topics: allowed,
    forbidden_claims: FORBIDDEN,
    untrusted_text: current.filter((x) => x.name).map((x) => ({ ref: `activity:${x.id}`, field: "name", value: x.name }))
  };
}

export type FeedbackInput = ReturnType<typeof buildFeedbackInput>;
