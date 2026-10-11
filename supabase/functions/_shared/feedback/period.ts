// Periodo valutato e finestra di esecuzione del feedback settimanale (ADR 0019).
import { addDaysISO, dayIndex, todayISO, weekStartISO } from "../workouts/calendar.ts";
import type { Period } from "./types.ts";

/** Settimana di calendario (lunedi'-domenica) che contiene ieri: di lunedi' e' la settimana
 * appena conclusa; negli altri giorni e' quella in corso, valutata come parziale. */
export function reviewPeriod(today: string): Period {
  const start = weekStartISO(addDaysISO(today, -1));
  return { start, end: addDaysISO(start, 6) };
}

export function periodOf(weekStart: string): Period {
  return { start: weekStart, end: addDaysISO(weekStart, 6) };
}

export function isMonday(date: string): boolean {
  return dayIndex(date) === 0;
}

const DAY_KEYS_BY_EN: Record<string, string> = {
  Monday: "lunedi", Tuesday: "martedi", Wednesday: "mercoledi", Thursday: "giovedi",
  Friday: "venerdi", Saturday: "sabato", Sunday: "domenica"
};

/** Giorno ("lunedi"...) e ora ("08") correnti nel fuso indicato. */
export function localDayHour(now: Date, timeZone: string): { day: string; hour: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", hour12: false }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  let hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  if (hour === "24") hour = "00";
  return { day: DAY_KEYS_BY_EN[weekday] ?? "", hour: hour.padStart(2, "0"), date: todayISO(timeZone, now) };
}

/** true dal giorno e dall'ora configurati fino alla fine di quel giorno: un'invocazione oraria
 * mancata non fa saltare la settimana (ADR 0008). */
export function inScheduleWindow(now: Date, timeZone: string, day: string, time: string): boolean {
  const cur = localDayHour(now, timeZone);
  return cur.day === day && cur.hour >= time.slice(0, 2).padStart(2, "0");
}
