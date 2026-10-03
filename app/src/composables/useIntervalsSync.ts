// Sincronizzazione automatica con Intervals.icu (§7.4): sostituisce il pulsante manuale
// rimosso da "Stato di allenamento". Invocata dai trigger previsti (chiave inserita o
// modificata, apertura scheda, "Genera piano"); il quarto trigger (job di feedback
// settimanale) e' lato backend, fuori dallo scope di questo composable.
// Dedup per atleta (nessuna chiamata concorrente sullo stesso id) + debounce sulla
// digitazione della API key; non blocca mai l'interfaccia. Espone anche un esito leggero
// per chiave (valida/non valida/non verificabile offline) che il chiamante puo' mostrare
// accanto al campo.
import { reactive, ref } from "vue";
import { useAthletesStore } from "../stores/athletes";
import { refreshFromIntervalsIcu } from "../services/intervals";

const DEBOUNCE_MS = 1500;

export type IntervalsKeyStatus = "valid" | "invalid" | "offline";

const syncingIds = ref(new Set<string>());
const keyStatus = reactive(new Map<string, IntervalsKeyStatus>());
const inFlightIds = new Set<string>();
let debounceHandle: ReturnType<typeof setTimeout> | null = null;

export function useIntervalsSync() {
  const athletes = useAthletesStore();

  function isSyncing(athleteId: string | null | undefined): boolean {
    return !!athleteId && syncingIds.value.has(athleteId);
  }

  function statusFor(athleteId: string | null | undefined): IntervalsKeyStatus | undefined {
    return athleteId ? keyStatus.get(athleteId) : undefined;
  }

  async function runSync(athleteId: string, apiKey: string): Promise<void> {
    if (inFlightIds.has(athleteId)) return;
    inFlightIds.add(athleteId);
    syncingIds.value.add(athleteId);
    try {
      const currentLog = athletes.athletes[athleteId]?.training_status?.load_metrics_log || [];
      const result = await refreshFromIntervalsIcu(apiKey, currentLog);
      if (!result.ok) {
        keyStatus.set(athleteId, result.error.includes("non valida") ? "invalid" : "offline");
        return;
      }
      keyStatus.set(athleteId, "valid");
      if (!("upToDate" in result) && athletes.currentId === athleteId) {
        await athletes.syncLoadMetrics(result.log);
      }
    } finally {
      inFlightIds.delete(athleteId);
      syncingIds.value.delete(athleteId);
    }
  }

  function syncNow(athleteId: string | null | undefined, apiKey: string | null | undefined): Promise<void> {
    if (!athleteId || !apiKey) return Promise.resolve();
    return runSync(athleteId, apiKey);
  }

  function syncDebounced(athleteId: string | null | undefined, apiKey: string | null | undefined): void {
    if (!athleteId || !apiKey) return;
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      debounceHandle = null;
      void syncNow(athleteId, apiKey);
    }, DEBOUNCE_MS);
  }

  return { isSyncing, statusFor, syncNow, syncDebounced };
}
