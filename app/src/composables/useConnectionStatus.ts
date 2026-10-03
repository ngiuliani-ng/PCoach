// Stato di connessione dell'app (§5 del documento di migrazione): macchina a stati pura
// + composable con health-check periodico al DB. navigator.onLine da solo non basta
// (dice se c'e' una rete, non se Supabase risponde): verifichiamo con una query minima.
import { computed, onMounted, ref } from "vue";
import { configured, supabase } from "../services/supabase";

export type ConnectionStatus = "unconfigured" | "offline" | "error" | "online";

export function computeConnectionStatus(
  isConfigured: boolean,
  navigatorOnline: boolean,
  dbReachable: boolean
): ConnectionStatus {
  if (!isConfigured) return "unconfigured";
  if (!navigatorOnline) return "offline";
  if (!dbReachable) return "error";
  return "online";
}

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  unconfigured: "Unconfigured",
  offline: "Offline",
  error: "Error",
  online: "Online"
};

const HEALTH_CHECK_INTERVAL_MS = 30000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

const navigatorOnline = ref(typeof navigator === "undefined" ? true : navigator.onLine);
const dbReachable = ref(false);
const status = computed(() => computeConnectionStatus(configured, navigatorOnline.value, dbReachable.value));

let started = false;

async function checkDb() {
  if (!configured || !supabase) {
    dbReachable.value = false;
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const { error } = await supabase
      .from("athletes")
      .select("id", { head: true, count: "exact" })
      .abortSignal(controller.signal);
    dbReachable.value = !error;
  } catch {
    dbReachable.value = false;
  } finally {
    clearTimeout(timeout);
  }
}

function handleOnline() {
  navigatorOnline.value = true;
  checkDb();
}
function handleOffline() {
  navigatorOnline.value = false;
  dbReachable.value = false;
}
function handleVisibility() {
  if (document.visibilityState === "visible") checkDb();
}

function startHealthCheck() {
  if (started) return;
  started = true;
  checkDb();
  setInterval(checkDb, HEALTH_CHECK_INTERVAL_MS);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibility);
}

export function useConnectionStatus() {
  onMounted(startHealthCheck);
  return { status };
}
