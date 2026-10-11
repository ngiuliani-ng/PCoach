// Abbinamento deterministico fra sedute approvate e attivita' (ADR 0019, regole R1-R7 di
// docs/audit/2026-10-feedback/04). Ogni attivita' appartiene al massimo a una seduta; una
// seduta senza attivita' non e' mai "non svolta": e' "non registrata", "dato non disponibile"
// o "in programma". Nei casi che le regole non separano l'esito e' "ambiguo".
import { addDaysISO, daysBetween, weekdayName } from "../workouts/calendar.ts";
import { flattenSteps, stepSeconds, workoutTotals } from "../workouts/structure.ts";
import type { FeedbackParams } from "./params.ts";
import type {
  ActivityResult, Confidence, MatchMethod, NormalizedActivity, PlannedWorkout, SessionOutcome, SessionResult
} from "./types.ts";

/** Giorni di distanza entro cui una seduta puo' essere stata spostata (nella stessa settimana). */
const MOVE_WINDOW_DAYS = 2;
/** Rapporto di durata compatibile con un abbinamento non confermato da Intervals.icu. */
const COMPATIBLE: [number, number] = [0.5, 1.5];

export interface MatchInput {
  workouts: PlannedWorkout[];
  activities: NormalizedActivity[];
  /** Data della valutazione (oggi nel fuso del coach): le sedute da oggi in poi sono "in programma". */
  today: string;
  params: FeedbackParams;
  /** true se il giorno e' coperto da un piano. */
  inPlan: (date: string) => boolean;
}

export interface MatchResult {
  sessions: SessionResult[];
  activities: ActivityResult[];
}

function plannedOf(w: PlannedWorkout) {
  const totals = workoutTotals(w);
  return {
    minutes: Math.round(totals.seconds / 60),
    meters: totals.allDistance && totals.meters > 0 ? totals.meters : null
  };
}

function ratioOf(w: PlannedWorkout, acts: NormalizedActivity[]): { ratio: number | null; basis: "time" | "distance" | null } {
  const planned = plannedOf(w);
  if (planned.meters) {
    const meters = acts.reduce((s, a) => s + (a.meters ?? 0), 0);
    if (meters > 0) return { ratio: round2(meters / planned.meters), basis: "distance" };
  }
  if (planned.minutes > 0) return { ratio: round2(acts.reduce((s, a) => s + a.minutes, 0) / planned.minutes), basis: "time" };
  return { ratio: null, basis: null };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const compatible = (r: number | null) => r === null || (r >= COMPATIBLE[0] && r <= COMPATIBLE[1]);

export function outcomeOf(ratio: number | null, p: FeedbackParams): SessionOutcome {
  if (ratio === null) return "completed";
  if (ratio > p.completed_max_pct / 100) return "over";
  if (ratio >= p.completed_min_pct / 100) return "completed";
  if (ratio >= p.partial_min_pct / 100) return "partial";
  return "short";
}

/** Seduta di qualita' e zona da cui si misura il lavoro di qualita' (o null). */
export function qualityZone(w: PlannedWorkout, p: FeedbackParams): number | null {
  const zones = flattenSteps(w.structure)
    .filter((s) => s.role === "work" && s.target && s.target.zone > p.low_zone_max)
    .map((s) => s.target!.zone);
  return zones.length ? Math.min(...zones) : null;
}

function quality(w: PlannedWorkout, acts: NormalizedActivity[], p: FeedbackParams): SessionResult["quality"] {
  const from = qualityZone(w, p);
  if (from === null) return null;
  const plannedSec = flattenSteps(w.structure)
    .filter((s) => s.target && s.target.zone >= from)
    .reduce((sum, s) => sum + stepSeconds(s, w.discipline), 0);
  const base = { metric: w.primary_target, from_zone: from, planned_min: Math.round(plannedSec / 60) };
  if (!acts.length) return { ...base, done_min: null, ratio: null };
  const metric = w.primary_target;
  if (metric === "none") return { ...base, done_min: null, ratio: null, reason: "seduta senza metrica di intensità" };
  if (metric === "power" && acts.some((a) => !a.sensors.power)) {
    return { ...base, done_min: null, ratio: null, reason: "potenza non misurata da un misuratore" };
  }
  let done = 0;
  for (const a of acts) {
    const zones = a.zone_seconds[metric];
    if (!zones) return { ...base, done_min: null, ratio: null, reason: `tempo nelle zone di ${metric === "hr" ? "frequenza cardiaca" : metric === "pace" ? "passo" : "potenza"} non disponibile` };
    done += zones.slice(from - 1).reduce((s, x) => s + x, 0);
  }
  const doneMin = Math.round(done / 60);
  return { ...base, done_min: doneMin, ratio: base.planned_min > 0 ? round2(doneMin / base.planned_min) : null };
}

export function matchWeek(input: MatchInput): MatchResult {
  const { params: p, today } = input;
  const workouts = [...input.workouts].sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.slot - b.slot);
  const usable = input.activities.filter((a) => a.status === "ok" && a.discipline !== "other");
  const freeActs = new Set(usable.map((a) => a.id));
  const results = new Map<string, SessionResult>();
  const ambiguousActs = new Set<string>();
  const substitutes = new Map<string, string>();

  const base = (w: PlannedWorkout): SessionResult => {
    const planned = plannedOf(w);
    return {
      workout_id: w.id, revision: w.revision, date: w.planned_date, weekday: weekdayName(w.planned_date), discipline: w.discipline, title: w.title,
      outcome: "not_recorded", activity_ids: [], method: null, confidence: null,
      planned_minutes: planned.minutes, planned_meters: planned.meters, done_minutes: null,
      ratio: null, ratio_basis: null, key_session: qualityZone(w, p) !== null, quality: null
    };
  };
  const assign = (w: PlannedWorkout, acts: NormalizedActivity[], method: MatchMethod, confidence: Confidence, outcome?: SessionOutcome) => {
    const { ratio, basis } = ratioOf(w, acts);
    acts.forEach((a) => freeActs.delete(a.id));
    results.set(w.id, {
      ...base(w),
      outcome: outcome ?? outcomeOf(ratio, p),
      activity_ids: acts.map((a) => a.id),
      method, confidence,
      done_minutes: Math.round(acts.reduce((s, a) => s + a.minutes, 0)),
      ratio, ratio_basis: basis,
      quality: quality(w, acts, p)
    });
  };
  const isFree = (w: PlannedWorkout) => !results.has(w.id);
  const freeOn = (date: string, discipline: string) =>
    usable.filter((a) => freeActs.has(a.id) && a.date === date && a.discipline === discipline);

  // R1: evento abbinato su Intervals.icu.
  for (const w of workouts) {
    if (w.remote_event_id == null) continue;
    const a = usable.find((x) => freeActs.has(x.id) && x.paired_event_id === w.remote_event_id);
    if (a) assign(w, [a], "paired_event", "confirmed");
  }

  // R2-R4: stesso giorno e stessa disciplina.
  const groups = new Map<string, PlannedWorkout[]>();
  for (const w of workouts.filter(isFree)) {
    const key = `${w.planned_date}|${w.discipline}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  for (const [key, ws] of groups) {
    const [date, discipline] = key.split("|");
    const acts = freeOn(date, discipline).sort((a, b) => a.start_local.localeCompare(b.start_local));
    if (!acts.length) continue;
    if (ws.length === 1 && acts.length === 1) {
      assign(ws[0], acts, "same_day", "high");
    } else if (ws.length === acts.length) {
      const ordered = [...ws].sort((a, b) => a.slot - b.slot);
      if (ordered.every((w, i) => compatible(ratioOf(w, [acts[i]]).ratio))) ordered.forEach((w, i) => assign(w, [acts[i]], "same_day_order", "medium"));
      else markAmbiguous(ws, acts);
    } else if (ws.length === 1) {
      const { ratio } = ratioOf(ws[0], acts);
      if (ratio === null || (ratio >= p.partial_min_pct / 100 && ratio <= p.completed_max_pct / 100)) assign(ws[0], acts, "split", "medium");
      else markAmbiguous(ws, acts);
    } else {
      markAmbiguous(ws, acts);
    }
  }
  function markAmbiguous(ws: PlannedWorkout[], acts: NormalizedActivity[]) {
    for (const w of ws) results.set(w.id, { ...base(w), outcome: "ambiguous", activity_ids: acts.map((a) => a.id) });
    acts.forEach((a) => { freeActs.delete(a.id); ambiguousActs.add(a.id); });
  }

  // R5: spostamento entro la settimana, solo per sedute gia' passate.
  for (const w of workouts.filter((x) => isFree(x) && x.planned_date < today)) {
    const candidates = usable
      .filter((a) => freeActs.has(a.id) && a.discipline === w.discipline && a.date !== w.planned_date)
      .filter((a) => Math.abs(daysBetween(w.planned_date, a.date)) <= MOVE_WINDOW_DAYS)
      .filter((a) => !workouts.some((o) => o.id !== w.id && isFree(o) && o.planned_date === a.date && o.discipline === a.discipline))
      .filter((a) => compatible(ratioOf(w, [a]).ratio))
      .sort((a, b) =>
        Math.abs(daysBetween(w.planned_date, a.date)) - Math.abs(daysBetween(w.planned_date, b.date)) ||
        Math.abs(1 - (ratioOf(w, [a]).ratio ?? 1)) - Math.abs(1 - (ratioOf(w, [b]).ratio ?? 1))
      );
    if (candidates.length) assign(w, [candidates[0]], "moved", "low", "moved");
  }

  // R6: sostituzione con un'altra disciplina nello stesso giorno (non conta come completata).
  for (const w of workouts.filter((x) => isFree(x) && x.planned_date < today)) {
    const a = usable.find((x) => freeActs.has(x.id) && x.date === w.planned_date && x.discipline !== w.discipline);
    if (!a) continue;
    freeActs.delete(a.id);
    substitutes.set(a.id, w.id);
    results.set(w.id, { ...base(w), outcome: "substituted", activity_ids: [a.id], method: "substitution", confidence: "low" });
  }

  // R7: sedute rimaste senza attivita'.
  for (const w of workouts.filter(isFree)) {
    const unavailableSameDay = input.activities.some(
      (a) => a.status === "unavailable" && a.date === w.planned_date && (a.discipline === w.discipline || a.discipline === "other")
    );
    const outcome: SessionOutcome = w.planned_date >= today ? "pending" : unavailableSameDay ? "data_unavailable" : "not_recorded";
    results.set(w.id, { ...base(w), outcome });
  }

  const matchedBy = new Map<string, string>();
  for (const r of results.values()) {
    if (r.outcome !== "ambiguous" && r.outcome !== "substituted") r.activity_ids.forEach((id) => matchedBy.set(id, r.workout_id));
  }
  const activities: ActivityResult[] = input.activities.map((a) => {
    const common = { activity_id: a.id, date: a.date, weekday: weekdayName(a.date), discipline: a.discipline, minutes: Math.round(a.minutes) };
    if (a.status === "unavailable") return { ...common, classification: "unavailable" };
    if (a.status === "duplicate") return { ...common, classification: "duplicate" };
    if (matchedBy.has(a.id)) return { ...common, classification: "matched", workout_id: matchedBy.get(a.id) };
    if (substitutes.has(a.id)) return { ...common, classification: "substitute", substitutes: substitutes.get(a.id) };
    if (ambiguousActs.has(a.id)) return { ...common, classification: "ambiguous" };
    if (a.discipline === "other") return { ...common, classification: "other" };
    return { ...common, classification: input.inPlan(a.date) ? "extra" : "out_of_plan" };
  });
  return { sessions: workouts.map((w) => results.get(w.id)!), activities };
}

/** Lunedi'-domenica come elenco di date, per comodita' dei chiamanti. */
export function datesOf(start: string, end: string): string[] {
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDaysISO(start, i));
}
