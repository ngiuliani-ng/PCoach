// Carico (CTL, ATL, TSB) da Intervals.icu, condiviso fra l'app (apertura della scheda) e il controllo
// periodico del server (Edge Function athlete-checks, ADR 0037). Funzioni pure: la lettura da
// Intervals.icu la fa chi le chiama.
import { addDaysISO } from "./calendar.ts";

export interface LoadMetricsEntry {
  date: string;
  source?: string;
  ctl?: number;
  atl?: number;
  tsb?: number;
  workouts_count?: number;
  note?: string;
  [key: string]: unknown;
}

export interface IcuWellness {
  id: string;
  ctl?: number | null;
  atl?: number | null;
}

/** Giorni riletti a ogni sincronizzazione anche se gia' presenti nel log. */
export const RESYNC_DAYS = 14;

/** Primo giorno da leggere: il giorno dopo l'ultima voce, ma non oltre RESYNC_DAYS giorni fa. */
export function syncWindowStart<T extends { date?: string }>(log: T[], today: string): string {
  const latest = [...log].sort((a, b) => (a.date || "").localeCompare(b.date || "")).at(-1);
  const resync = addDaysISO(today, -(RESYNC_DAYS - 1));
  if (!latest?.date) return addDaysISO(today, -30);
  const next = addDaysISO(latest.date, 1);
  return next < resync ? next : resync;
}

/**
 * Unisce al log i valori letti da Intervals.icu: un giorno inserito a mano non si tocca, un giorno
 * gia' uguale non conta come aggiornato. Restituisce il log ordinato per data e quante voci sono cambiate.
 */
export function mergeLoadMetrics<T extends LoadMetricsEntry>(
  currentLog: T[],
  wellness: IcuWellness[],
  activities: { start_date_local?: string }[]
): { log: T[]; updatedCount: number } {
  const workoutsByDate: Record<string, number> = {};
  for (const a of activities) {
    const date = a.start_date_local?.slice(0, 10);
    if (date) workoutsByDate[date] = (workoutsByDate[date] || 0) + 1;
  }
  const log = [...currentLog];
  let updatedCount = 0;
  for (const w of wellness) {
    const date = w.id;
    if (!date || w.ctl == null || w.atl == null) continue;
    const i = log.findIndex((e) => e.date === date);
    if (i >= 0 && log[i].source === "manual") continue;
    const old = i >= 0 ? log[i] : undefined;
    if (old && old.ctl === w.ctl && old.atl === w.atl && old.workouts_count === (workoutsByDate[date] || 0)) continue;
    const entry = {
      date,
      source: "intervals_icu_sync",
      ctl: w.ctl,
      atl: w.atl,
      tsb: Math.round((w.ctl - w.atl) * 10) / 10,
      workouts_count: workoutsByDate[date] || 0,
      note: "Sincronizzato da Intervals.icu"
    } as T;
    if (i >= 0) log[i] = entry;
    else log.push(entry);
    updatedCount++;
  }
  log.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return { log, updatedCount };
}
