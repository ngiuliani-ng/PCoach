// Disponibilita' dell'atleta e calendario del periodo da pianificare.
// Claude sbaglia a ricavare il giorno della settimana da una data (verificato il 2026-10-10:
// piani interi sfalsati di un giorno). Per questo il prompt riceve il calendario gia' calcolato
// e ogni proposta viene ricontrollata qui, in modo deterministico, contro i vincoli dell'atleta.
import { addDaysISO, dayIndex, daysBetween, DAY_KEYS, weekdayName, type DayKeyName } from "@shared/workouts/calendar.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import { workoutTotals } from "@shared/workouts/structure.ts";
import type { AthleteTrainingProfile } from "../schema/types.generated";
import { loadChangeText, weekOf, type PlanWeek } from "./planWeeks";
import type { LoadProgression } from "@shared/feedback/params.ts";

type Constraints = AthleteTrainingProfile["constraints"] | null | undefined;

export function dayName(date: string): string {
  return weekdayName(date);
}

export function isDayKey(value: unknown): value is DayKeyName {
  return typeof value === "string" && (DAY_KEYS as readonly string[]).includes(value);
}

/** La data con il giorno della settimana indicato piu' vicina a `date` (da -3 a +3 giorni). */
export function alignToDay(date: string, day: DayKeyName): string {
  const offset = ((DAY_KEYS.indexOf(day) - dayIndex(date) + 10) % 7) - 3;
  return addDaysISO(date, offset);
}

interface DayRule {
  available: boolean;
  maxMinutes: number | null;
  usual: string;
}

function rulesByDay(constraints: Constraints): Partial<Record<DayKeyName, DayRule>> {
  const rules: Partial<Record<DayKeyName, DayRule>> = {};
  for (const d of constraints?.days_available ?? []) {
    if (!isDayKey(d.day)) continue;
    const max = typeof d.max_duration_minutes === "number" && d.max_duration_minutes > 0 ? d.max_duration_minutes : null;
    rules[d.day] = { available: d.active !== false, maxMinutes: max, usual: (d.fixed_activity ?? "").trim() };
  }
  return rules;
}

export interface CalendarDay {
  data: string;
  giorno: string;
  disponibile: boolean;
  durata_massima_min: number | null;
  attivita_abituale: string;
  /** Settimana del piano e fase del ciclo di carico e scarico, se note. */
  settimana?: number;
  fase?: string;
  /** Variazione di carico attesa in quella settimana, con le percentuali dell'atleta. */
  variazione_carico?: string;
  /** Gara in programma quel giorno (nome e priorita'). */
  gara?: string;
}

/** Calendario del periodo da passare a Claude: ogni data con giorno, vincoli e, se note,
 * settimana del piano e fase del ciclo, gia' risolti. */
export function planningCalendar(constraints: Constraints, fromDate: string, toDate: string, weeks: PlanWeek[] = [], progression?: LoadProgression): CalendarDay[] {
  const rules = rulesByDay(constraints);
  return Array.from({ length: daysBetween(fromDate, toDate) + 1 }, (_, i) => {
    const date = addDaysISO(fromDate, i);
    const rule = rules[DAY_KEYS[dayIndex(date)]];
    const week = weekOf(weeks, date);
    return {
      data: date,
      giorno: dayName(date),
      disponibile: rule ? rule.available : true,
      durata_massima_min: rule?.maxMinutes ?? null,
      attivita_abituale: rule?.usual ?? "",
      ...(week ? { settimana: week.number, fase: week.phase } : {}),
      ...(week && progression && loadChangeText(week, progression) ? { variazione_carico: loadChangeText(week, progression) } : {}),
      ...(week?.race && week.phase === "gara" && week.race.date === date ? { gara: `${week.race.name} (priorità ${week.race.priority})` } : {})
    };
  });
}

/** Per ogni seduta (per indice), il motivo per cui non rispetta la disponibilita' dell'atleta:
 * giorno non disponibile, oppure durata complessiva del giorno oltre il massimo. */
export function availabilityIssues(
  workouts: Pick<WorkoutContent, "planned_date" | "discipline" | "structure" | "duration_min">[],
  constraints: Constraints
): Map<number, string> {
  const rules = rulesByDay(constraints);
  const minutesByDate = new Map<string, number>();
  workouts.forEach((w) => {
    minutesByDate.set(w.planned_date, (minutesByDate.get(w.planned_date) ?? 0) + Math.round(workoutTotals(w).seconds / 60));
  });
  const issues = new Map<number, string>();
  workouts.forEach((w, i) => {
    const rule = rules[DAY_KEYS[dayIndex(w.planned_date)]];
    const day = dayName(w.planned_date);
    if (rule && !rule.available) {
      issues.set(i, `Il ${day} non è un giorno disponibile per l'atleta.`);
      return;
    }
    const total = minutesByDate.get(w.planned_date) ?? 0;
    if (rule?.maxMinutes && total > rule.maxMinutes) {
      issues.set(i, `Il ${day} l'atleta ha al massimo ${rule.maxMinutes} minuti: le sedute del giorno ne fanno ${total}.`);
    }
  });
  return issues;
}
