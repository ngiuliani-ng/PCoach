// Controlli deterministici sulle settimane di una proposta di Claude (decisione del coach D-02,
// ADR 0022): segnalano, non correggono. Le regole sono quelle che il prompt chiede di rispettare
// (sedute a settimana, variazione di carico della fase); la decisione resta al coach.
import { addDaysISO } from "@shared/workouts/calendar.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import type { PaceContext } from "@shared/workouts/thresholds.ts";
import { workoutTotals } from "@shared/workouts/structure.ts";
import type { LoadProgression } from "@shared/feedback/params.ts";
import type { PlanWeek } from "./planWeeks";

/** Punti percentuali di tolleranza sulla variazione di volume attesa. */
export const VOLUME_TOLERANCE_PCT = 5;

type Planned = Pick<WorkoutContent, "planned_date" | "discipline" | "structure" | "duration_min">;

const short = (date: string) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;

function isFull(w: PlanWeek): boolean {
  return w.from === w.weekStart && w.to === addDaysISO(w.weekStart, 6);
}

/**
 * Avvisi sulle settimane complete del periodo: numero di sedute diverso da quello indicato per
 * l'atleta, e variazione di volume fra due settimane consecutive del ciclo fuori da quella attesa
 * (con le percentuali dell'atleta e una tolleranza). Tapering, gara e raccordo non si controllano.
 */
export function weeklyIssues(weeks: PlanWeek[], workouts: Planned[], sessionsTarget: number | null | undefined, progression: LoadProgression, pace?: PaceContext | null): string[] {
  const issues: string[] = [];
  const inWeek = (w: PlanWeek) => workouts.filter((x) => x.planned_date >= w.from && x.planned_date <= w.to);
  const minutes = (w: PlanWeek) => Math.round(inWeek(w).reduce((t, x) => t + workoutTotals(x, pace).seconds, 0) / 60);
  const regular = (w: PlanWeek) => isFull(w) && !w.race && w.phase !== "raccordo";

  for (const w of weeks.filter(regular)) {
    const n = inWeek(w).length;
    if (sessionsTarget && sessionsTarget > 0 && n !== sessionsTarget) {
      issues.push(`Settimana del ${short(w.weekStart)}: ${n} ${n === 1 ? "seduta" : "sedute"}, l'atleta ne prevede ${sessionsTarget}.`);
    }
  }

  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1];
    const cur = weeks[i];
    if (!regular(prev) || !regular(cur) || prev.cycleWeek === null || cur.cycleWeek === null || prev.isDeload) continue;
    const before = minutes(prev);
    if (before <= 0) continue;
    const change = Math.round(((minutes(cur) - before) / before) * 100);
    const [lo, hi] = cur.isDeload
      ? [-progression.deload_decrease_pct, -progression.deload_decrease_pct]
      : [progression.increase_min_pct, progression.increase_max_pct];
    if (change < lo - VOLUME_TOLERANCE_PCT || change > hi + VOLUME_TOLERANCE_PCT) {
      const expected = lo === hi ? `${lo > 0 ? "+" : ""}${lo}%` : `+${lo}-${hi}%`;
      issues.push(`Settimana del ${short(cur.weekStart)} (${cur.phase}): volume ${change > 0 ? "+" : ""}${change}% rispetto alla precedente, atteso ${expected}.`);
    }
  }
  return issues;
}
