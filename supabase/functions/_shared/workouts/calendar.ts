// Calendario delle sedute: date come stringhe "YYYY-MM-DD" nel calendario locale dell'atleta.
// Modulo puro condiviso tra app (Vite/Vitest) ed Edge Function (Deno): nessuna dipendenza.
// L'aritmetica lavora a mezzogiorno UTC, cosi' nessun fuso orario puo' spostare il giorno
// (con la mezzanotte locale serializzata in UTC, in Italia "domani" tornava "oggi").

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toNoonUTC(date: string): Date {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Data non valida: ${date}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
}

function fromNoonUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Data di oggi nel fuso indicato (default: quello del dispositivo). */
export function todayISO(timeZone?: string, now: Date = new Date()): string {
  // en-CA formatta come YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDaysISO(date: string, days: number): string {
  const d = toNoonUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromNoonUTC(d);
}

/** Giorno della settimana con lunedi' = 0 ... domenica = 6 (settimana ISO). */
export function dayIndex(date: string): number {
  return (toNoonUTC(date).getUTCDay() + 6) % 7;
}

/** Lunedi' della settimana che contiene la data. */
export function weekStartISO(date: string): string {
  return addDaysISO(date, -dayIndex(date));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toNoonUTC(to).getTime() - toNoonUTC(from).getTime()) / 86_400_000);
}

export const DAY_KEYS = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"] as const;
export type DayKeyName = (typeof DAY_KEYS)[number];

export function dayKey(date: string): DayKeyName {
  return DAY_KEYS[dayIndex(date)];
}
