// Settimane del piano e ciclo di carico e scarico (funzioni pure).
// Le settimane del piano sono settimane di calendario (da lunedi'). La fase di ognuna (carico 2 di 3,
// scarico...) la calcola PCoach dallo schema dell'atleta (ad esempio 3:1) e la passa a Claude nel
// calendario: Claude non deve ricavarla da solo. Il ciclo e' ancorato al piano attivo (`cycle_week`
// salvato in weeks_meta), cosi' una generazione successiva o una ripianificazione a meta' ciclo
// prosegue dalla settimana giusta invece di ripartire da "carico 1".
import { addDaysISO, dayIndex, daysBetween, isISODate, weekStartISO } from "@shared/workouts/calendar.ts";
import type { LoadProgression } from "@shared/feedback/params.ts";

/** Settimane massime per generazione: un ciclo 3:1 intero. Claude scrive circa 25-30 s per
 * settimana di sedute e una chiamata a claude-proxy non puo' superare 150 s. */
export const MAX_PLAN_WEEKS = 4;
/** Token di risposta concessi per settimana (piu' 2000 per apertura e chiusura del JSON). */
export const TOKENS_PER_WEEK = 4000;

export function planMaxTokens(weeks: number): number {
  return Math.min(64000, weeks * TOKENS_PER_WEEK + 2000);
}

export interface LoadPattern {
  load: number;
  deload: number;
}

/** Schema di carico e scarico scritto dal coach ("3:1", "2/1"); null se non interpretabile. */
export function parseLoadPattern(text: string | null | undefined): LoadPattern | null {
  const m = /(\d+)\s*[:/]\s*(\d+)/.exec(text ?? "");
  if (!m) return null;
  const load = Number(m[1]);
  const deload = Number(m[2]);
  return load >= 1 && load <= 8 && deload >= 1 && deload <= 4 ? { load, deload } : null;
}

/** Settimana del ciclo (da 1) di una settimana di calendario gia' pianificata. */
export interface CycleAnchor {
  weekStart: string;
  cycleWeek: number;
}

/** Settimana di un piano salvato (training_plans.weeks_meta). */
export interface StoredWeekMeta {
  week_start: string;
  label: string;
  is_deload: boolean;
  /** Settimana del ciclo di carico e scarico, da 1; assente senza uno schema riconoscibile. */
  cycle_week?: number;
}

/** Ancora del ciclo dal piano attivo: l'ultima settimana con il ciclo noto fino a quella di `fromDate`. */
export function cycleAnchor(meta: StoredWeekMeta[] | null | undefined, fromDate: string): CycleAnchor | null {
  const limit = weekStartISO(fromDate);
  const known = (meta ?? [])
    .filter((m) => typeof m.cycle_week === "number" && m.cycle_week >= 1 && m.week_start <= limit)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  const last = known.at(-1);
  return last ? { weekStart: last.week_start, cycleWeek: last.cycle_week! } : null;
}

/** Gara dell'atleta con il suo tapering (decisione del coach D-03, ADR 0022). */
export interface RaceEvent {
  date: string;
  name: string;
  priority: string;
  /** Settimane di tapering prima della settimana di gara. */
  taperWeeks: number;
  /** Calo del volume nel tapering rispetto all'ultima settimana di carico; null = lo decide Claude. */
  taperDecreasePct: number | null;
}

/** Settimane di tapering predefinite per priorita', se la gara non le indica. */
export const DEFAULT_TAPER_WEEKS: Record<string, number> = { A: 2, B: 1, C: 0 };

/** Gare valide della scheda (data ISO), con i default di tapering per priorita'. */
export function raceEvents(events: { date?: string; name?: string; priority?: string; taper_weeks?: number; taper_volume_decrease_pct?: number }[] | null | undefined): RaceEvent[] {
  return (events ?? [])
    .filter((e) => isISODate(e.date))
    .map((e) => {
      const priority = e.priority ?? "C";
      const weeks = typeof e.taper_weeks === "number" && Number.isInteger(e.taper_weeks) && e.taper_weeks >= 0 && e.taper_weeks <= 4 ? e.taper_weeks : DEFAULT_TAPER_WEEKS[priority] ?? 0;
      const pct = typeof e.taper_volume_decrease_pct === "number" && e.taper_volume_decrease_pct > 0 && e.taper_volume_decrease_pct <= 80 ? e.taper_volume_decrease_pct : null;
      return { date: e.date as string, name: (e.name ?? "").trim() || "gara", priority, taperWeeks: weeks, taperDecreasePct: pct };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface PlanWeek {
  /** 0 per i pochi giorni prima del primo lunedi' (raccordo), poi dalla 1. */
  number: number;
  /** Lunedi' della settimana. */
  weekStart: string;
  /** Primo e ultimo giorno della settimana dentro il periodo pianificato. */
  from: string;
  to: string;
  /** "carico 2 di 3", "scarico", "raccordo", "tapering", "gara", oppure "" senza uno schema riconoscibile. */
  phase: string;
  isDeload: boolean;
  cycleWeek: number | null;
  /** Gara a cui si riferiscono le settimane di tapering e di gara (il ciclo e' sospeso). */
  race?: RaceEvent;
  /** Settimane mancanti alla settimana di gara, per il tapering (1 = quella prima della gara). */
  weeksToRace?: number;
}

/**
 * Settimane di calendario del periodo. Se il periodo inizia da lunedi' a giovedi', quella settimana
 * e' la 1; se inizia da venerdi' a domenica, quei giorni sono un raccordo (settimana 0) e la 1 parte
 * dal lunedi' successivo. Il ciclo prosegue dall'ancora del piano attivo se c'e', altrimenti parte
 * dalla settimana 1 (e il raccordo resta fuori dal ciclo).
 *
 * Gare (D-03): la settimana che contiene una gara e' «gara», le `taperWeeks` precedenti sono «tapering».
 * In quelle settimane il ciclo e' sospeso (non avanza); dopo una gara di priorita' A riparte da
 * «carico 1». Una gara A gia' passata fra l'ancora e l'inizio del periodo fa ripartire il ciclo.
 */
export function planWeeks(fromDate: string, weeks: number, pattern: LoadPattern | null, anchor: CycleAnchor | null = null, races: RaceEvent[] = []): PlanWeek[] {
  const toDate = addDaysISO(fromDate, weeks * 7 - 1);
  const firstMonday = weekStartISO(fromDate);
  const offset = dayIndex(fromDate) <= 3 ? 1 : 0;
  let base = anchor ?? { weekStart: offset ? firstMonday : addDaysISO(firstMonday, 7), cycleWeek: 1 };
  const pastA = races.filter((r) => r.priority === "A" && anchor && weekStartISO(r.date) > anchor.weekStart && weekStartISO(r.date) < firstMonday).at(-1);
  if (pastA) base = { weekStart: addDaysISO(weekStartISO(pastA.date), 7), cycleWeek: 1 };
  let paused = 0;
  const result: PlanWeek[] = [];
  for (let start = firstMonday; start <= toDate; start = addDaysISO(start, 7)) {
    const number = daysBetween(firstMonday, start) / 7 + offset;
    const end = addDaysISO(start, 6);
    const range = { number, weekStart: start, from: start < fromDate ? fromDate : start, to: end > toDate ? toDate : end };
    const raceWeek = races.find((r) => weekStartISO(r.date) === start);
    const taper = !raceWeek
      ? races.map((r) => ({ r, k: daysBetween(start, weekStartISO(r.date)) / 7 })).find(({ r, k }) => k >= 1 && k <= r.taperWeeks)
      : undefined;
    if (raceWeek || taper) {
      const race = raceWeek ?? taper!.r;
      result.push({ ...range, phase: raceWeek ? "gara" : "tapering", isDeload: true, cycleWeek: null, race, ...(taper ? { weeksToRace: taper.k } : {}) });
      paused++;
      if (raceWeek?.priority === "A") {
        base = { weekStart: addDaysISO(start, 7), cycleWeek: 1 };
        paused = 0;
      }
      continue;
    }
    let phase = "";
    let isDeload = false;
    let cycleWeek: number | null = null;
    if (number === 0 && !anchor) phase = "raccordo";
    else if (pattern) {
      const length = pattern.load + pattern.deload;
      const pos = (((base.cycleWeek - 1 + daysBetween(base.weekStart, start) / 7 - paused) % length) + length) % length;
      cycleWeek = pos + 1;
      isDeload = pos >= pattern.load;
      phase = isDeload ? "scarico" : `carico ${pos + 1} di ${pattern.load}`;
    }
    result.push({ ...range, phase, isDeload, cycleWeek });
  }
  return result;
}

/**
 * Primo giorno per proseguire il piano: il giorno dopo l'ultima data coperta (fine del piano attivo
 * o ultima seduta attiva), ma mai prima di domani.
 */
export function continueFromDate(planEnd: string | null | undefined, activeDates: string[], today: string): string {
  const last = [planEnd ?? "", ...activeDates].reduce((a, b) => (b > a ? b : a), "");
  const tomorrow = addDaysISO(today, 1);
  const next = last ? addDaysISO(last, 1) : tomorrow;
  return next > tomorrow ? next : tomorrow;
}

/** Variazione di carico attesa in una settimana, con le percentuali scelte per l'atleta. */
export function loadChangeText(w: PlanWeek, p: LoadProgression): string {
  if (w.phase === "raccordo") return "settimana leggera";
  if (w.race && w.phase === "gara") return `settimana della gara «${w.race.name}» (${w.race.date}, priorità ${w.race.priority})`;
  if (w.race && w.phase === "tapering") {
    const left = `${w.weeksToRace} ${w.weeksToRace === 1 ? "settimana" : "settimane"} alla settimana della gara «${w.race.name}» (${w.race.date})`;
    return w.race.taperDecreasePct !== null ? `tapering: volume −${w.race.taperDecreasePct}% rispetto all'ultima settimana di carico, ${left}` : `tapering: volume in calo, ${left}`;
  }
  if (w.isDeload) return `volume −${p.deload_decrease_pct}% rispetto all'ultima settimana di carico`;
  if (w.cycleWeek === 1) return "inizio ciclo: carico simile alla seconda settimana di carico del ciclo precedente, o di partenza se è il primo ciclo";
  if (w.cycleWeek) return `carico +${p.increase_min_pct}-${p.increase_max_pct}% rispetto alla settimana precedente`;
  return "";
}

/** Numero e fase della settimana che contiene la data. */
export function weekOf(all: PlanWeek[], date: string): PlanWeek | undefined {
  return all.find((w) => date >= w.from && date <= w.to);
}

/**
 * Settimane da salvare nel piano: una per settimana del periodo, con l'etichetta di Claude e, se lo
 * schema e' noto, scarico e settimana del ciclo calcolati da PCoach (che fanno da ancora la volta dopo).
 */
export function withPhases(fromClaude: StoredWeekMeta[], all: PlanWeek[]): StoredWeekMeta[] {
  return all.map((w) => {
    const claude = fromClaude.find((m) => m.week_start === w.weekStart);
    const label = claude?.label || (w.phase ? w.phase[0].toUpperCase() + w.phase.slice(1) : "");
    if (w.race) return { week_start: w.weekStart, label, is_deload: true };
    return w.cycleWeek === null
      ? { week_start: w.weekStart, label, is_deload: claude?.is_deload ?? false }
      : { week_start: w.weekStart, label, is_deload: w.isDeload, cycle_week: w.cycleWeek };
  });
}
