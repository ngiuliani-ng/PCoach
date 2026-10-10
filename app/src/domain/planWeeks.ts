// Settimane del piano e ciclo di carico e scarico (funzioni pure).
// Le settimane del piano sono settimane di calendario (da lunedi'). La fase di ognuna (carico 2 di 3,
// scarico...) la calcola PCoach dallo schema dell'atleta (ad esempio 3:1) e la passa a Claude nel
// calendario: Claude non deve ricavarla da solo. Il ciclo e' ancorato al piano attivo (`cycle_week`
// salvato in weeks_meta), cosi' una generazione successiva o una ripianificazione a meta' ciclo
// prosegue dalla settimana giusta invece di ripartire da "carico 1".
import { addDaysISO, dayIndex, daysBetween, weekStartISO } from "@shared/workouts/calendar.ts";

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

export interface PlanWeek {
  /** 0 per i pochi giorni prima del primo lunedi' (raccordo), poi dalla 1. */
  number: number;
  /** Lunedi' della settimana. */
  weekStart: string;
  /** Primo e ultimo giorno della settimana dentro il periodo pianificato. */
  from: string;
  to: string;
  /** "carico 2 di 3", "scarico", "raccordo", oppure "" senza uno schema riconoscibile. */
  phase: string;
  isDeload: boolean;
  cycleWeek: number | null;
}

/**
 * Settimane di calendario del periodo. Se il periodo inizia da lunedi' a giovedi', quella settimana
 * e' la 1; se inizia da venerdi' a domenica, quei giorni sono un raccordo (settimana 0) e la 1 parte
 * dal lunedi' successivo. Il ciclo prosegue dall'ancora del piano attivo se c'e', altrimenti parte
 * dalla settimana 1 (e il raccordo resta fuori dal ciclo).
 */
export function planWeeks(fromDate: string, weeks: number, pattern: LoadPattern | null, anchor: CycleAnchor | null = null): PlanWeek[] {
  const toDate = addDaysISO(fromDate, weeks * 7 - 1);
  const firstMonday = weekStartISO(fromDate);
  const offset = dayIndex(fromDate) <= 3 ? 1 : 0;
  const base = anchor ?? { weekStart: offset ? firstMonday : addDaysISO(firstMonday, 7), cycleWeek: 1 };
  const result: PlanWeek[] = [];
  for (let start = firstMonday; start <= toDate; start = addDaysISO(start, 7)) {
    const number = daysBetween(firstMonday, start) / 7 + offset;
    let phase = "";
    let isDeload = false;
    let cycleWeek: number | null = null;
    if (number === 0 && !anchor) phase = "raccordo";
    else if (pattern) {
      const length = pattern.load + pattern.deload;
      const pos = (((base.cycleWeek - 1 + daysBetween(base.weekStart, start) / 7) % length) + length) % length;
      cycleWeek = pos + 1;
      isDeload = pos >= pattern.load;
      phase = isDeload ? "scarico" : `carico ${pos + 1} di ${pattern.load}`;
    }
    const end = addDaysISO(start, 6);
    result.push({ number, weekStart: start, from: start < fromDate ? fromDate : start, to: end > toDate ? toDate : end, phase, isDeload, cycleWeek });
  }
  return result;
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
    return w.cycleWeek === null
      ? { week_start: w.weekStart, label, is_deload: claude?.is_deload ?? false }
      : { week_start: w.weekStart, label, is_deload: w.isDeload, cycle_week: w.cycleWeek };
  });
}
