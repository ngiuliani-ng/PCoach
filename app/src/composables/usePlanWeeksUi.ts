// Stato di apertura/chiusura delle settimane nella vista grafica del piano (§8).
// Deliberatamente fuori da AthleteTrainingProfile: e' puro stato di interfaccia,
// non deve mai comparire nel confronto dirty ne' essere persistito sul profilo.
// Pattern a stato di modulo condiviso, come useToast/useConnectionStatus/useIntervalsSync.
import { reactive } from "vue";
import type { PlanViewModel } from "../services/planViewModel";
import { defaultOpenWeekIndex } from "../services/planViewModel";

const openWeeksByAthlete = reactive(new Map<string, Set<number>>());

export function usePlanWeeksUi() {
  function ensureInit(athleteId: string, plan: PlanViewModel, todayISO: string): Set<number> {
    let set = openWeeksByAthlete.get(athleteId);
    if (!set) {
      set = new Set<number>();
      const defaultIndex = defaultOpenWeekIndex(plan, todayISO);
      if (defaultIndex !== null) set.add(defaultIndex);
      openWeeksByAthlete.set(athleteId, set);
    }
    return set;
  }

  function isOpen(athleteId: string, plan: PlanViewModel, todayISO: string, weekIndex: number): boolean {
    return ensureInit(athleteId, plan, todayISO).has(weekIndex);
  }

  function toggle(athleteId: string, plan: PlanViewModel, todayISO: string, weekIndex: number): void {
    const set = ensureInit(athleteId, plan, todayISO);
    if (set.has(weekIndex)) set.delete(weekIndex);
    else set.add(weekIndex);
    openWeeksByAthlete.set(athleteId, new Set(set));
  }

  function openAll(athleteId: string, plan: PlanViewModel): void {
    openWeeksByAthlete.set(athleteId, new Set(plan.weeks.map((w) => w.index)));
  }

  function closeAll(athleteId: string): void {
    openWeeksByAthlete.set(athleteId, new Set());
  }

  function reset(athleteId: string): void {
    openWeeksByAthlete.delete(athleteId);
  }

  return { isOpen, toggle, openAll, closeAll, reset };
}
