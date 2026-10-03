// Integrazione con Intervals.icu: sincronizzazione CTL/ATL/TSB da mostrare nella
// scheda atleta. Porting diretto della logica di index.html, isolata dal DOM per
// essere testabile e riusabile dagli store. Il confronto piano/reale per il feedback
// settimanale è ora lato backend (Edge Function weekly-feedback, Fase 7).
import { addDaysISO, todayISO } from "../constants";
import type { AthleteTrainingProfile } from "../schema/types.generated";

type LoadMetricsEntry = NonNullable<
  NonNullable<AthleteTrainingProfile["training_status"]>["load_metrics_log"]
>[number];

export type IntervalsSyncResult =
  | { ok: true; updatedCount: number; log: LoadMetricsEntry[] }
  | { ok: false; error: string };

function latestLogEntry(log: LoadMetricsEntry[]): LoadMetricsEntry | undefined {
  return [...log].sort((a, b) => (a.date || "").localeCompare(b.date || "")).at(-1);
}

export async function refreshFromIntervalsIcu(
  apiKey: string,
  currentLog: LoadMetricsEntry[]
): Promise<IntervalsSyncResult | { ok: true; updatedCount: 0; log: LoadMetricsEntry[]; upToDate: true }> {
  const latest = latestLogEntry(currentLog);
  const oldest = latest && latest.date ? addDaysISO(latest.date, 1) : addDaysISO(todayISO(), -30);
  const newest = todayISO();
  if (oldest > newest) {
    return { ok: true, updatedCount: 0, log: currentLog, upToDate: true };
  }

  try {
    const auth = "Basic " + btoa("API_KEY:" + apiKey);
    const [wellnessRes, activitiesRes] = await Promise.all([
      fetch(`https://intervals.icu/api/v1/athlete/0/wellness?oldest=${oldest}&newest=${newest}`, { headers: { Authorization: auth } }),
      fetch(`https://intervals.icu/api/v1/athlete/0/activities?oldest=${oldest}&newest=${newest}`, { headers: { Authorization: auth } })
    ]);

    if (wellnessRes.status === 401 || activitiesRes.status === 401) {
      return { ok: false, error: "API key di Intervals.icu non valida." };
    }
    if (!wellnessRes.ok || !activitiesRes.ok) {
      return { ok: false, error: `Errore Intervals.icu (wellness ${wellnessRes.status}, activities ${activitiesRes.status}).` };
    }

    const wellness: Array<{ id: string; ctl?: number; atl?: number }> = await wellnessRes.json();
    const activities: Array<{ start_date_local?: string }> = await activitiesRes.json();

    const workoutsByDate: Record<string, number> = {};
    activities.forEach((a) => {
      const date = a.start_date_local?.slice(0, 10);
      if (!date) return;
      workoutsByDate[date] = (workoutsByDate[date] || 0) + 1;
    });

    const log = [...currentLog];
    let updatedCount = 0;
    wellness.forEach((w) => {
      const date = w.id;
      if (!date || w.ctl == null || w.atl == null) return;
      const existingIdx = log.findIndex((e) => e.date === date);
      if (existingIdx >= 0 && log[existingIdx].source === "manual") return;
      const entry: LoadMetricsEntry = {
        date,
        source: "intervals_icu_sync",
        ctl: w.ctl,
        atl: w.atl,
        tsb: Math.round((w.ctl - w.atl) * 10) / 10,
        workouts_count: workoutsByDate[date] || 0,
        note: "Sincronizzato da Intervals.icu"
      };
      if (existingIdx >= 0) log[existingIdx] = entry;
      else log.push(entry);
      updatedCount++;
    });
    log.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    return { ok: true, updatedCount, log };
  } catch {
    return { ok: false, error: "Impossibile contattare Intervals.icu (rete o CORS)." };
  }
}
