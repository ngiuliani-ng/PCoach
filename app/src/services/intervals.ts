// Integrazione con Intervals.icu: sincronizzazione CTL/ATL/TSB da mostrare nella scheda
// atleta. Gli ultimi giorni si rileggono sempre: un'attivita' caricata in ritardo cambia il
// carico dei giorni gia' salvati. Il feedback settimanale legge il carico da se'
// (Edge Function weekly-feedback, ADR 0019).
import { todayISO } from "../constants";
import type { AthleteTrainingProfile } from "../schema/types.generated";
import type { RawActivity } from "@shared/feedback/types.ts";
import { mergeLoadMetrics, RESYNC_DAYS, syncWindowStart } from "@shared/workouts/loadMetrics.ts";

type LoadMetricsEntry = NonNullable<
  NonNullable<AthleteTrainingProfile["training_status"]>["load_metrics_log"]
>[number];

export type IntervalsSyncResult =
  | { ok: true; updatedCount: number; log: LoadMetricsEntry[] }
  | { ok: false; error: string };

// Finestra di lettura e unione del log condivise con il controllo periodico del server (ADR 0037).
export { RESYNC_DAYS, syncWindowStart };

export async function refreshFromIntervalsIcu(
  apiKey: string,
  currentLog: LoadMetricsEntry[]
): Promise<IntervalsSyncResult | { ok: true; updatedCount: 0; log: LoadMetricsEntry[]; upToDate: true }> {
  const newest = todayISO();
  const oldest = syncWindowStart(currentLog, newest);

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

    const wellness: Array<{ id: string; ctl?: number | null; atl?: number | null }> = await wellnessRes.json();
    const activities: Array<{ start_date_local?: string }> = await activitiesRes.json();

    const { log, updatedCount } = mergeLoadMetrics(currentLog, wellness, activities);
    if (!updatedCount) return { ok: true, updatedCount: 0, log: currentLog, upToDate: true };
    return { ok: true, updatedCount, log };
  } catch {
    return { ok: false, error: "Impossibile contattare Intervals.icu (rete o CORS)." };
  }
}

/** Attivita' svolte fra due date (incluse), per registrare le sedute svolte all'apertura della scheda. */
export async function fetchActivities(apiKey: string, oldest: string, newest: string): Promise<{ ok: true; activities: RawActivity[] } | { ok: false }> {
  try {
    const res = await fetch(`https://intervals.icu/api/v1/athlete/0/activities?oldest=${oldest}&newest=${newest}`, {
      headers: { Authorization: "Basic " + btoa("API_KEY:" + apiKey) }
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return Array.isArray(data) ? { ok: true, activities: data as RawActivity[] } : { ok: false };
  } catch {
    return { ok: false };
  }
}
