// Toast globale minimale: stato reattivo condiviso + funzione showToast(). I messaggi informativi
// spariscono da soli dopo un tempo che cresce con la lunghezza del testo e si fermano finche' il puntatore
// o il focus sono sul toast; gli errori, e i messaggi che chiedono di fare qualcosa, restano finche'
// l'utente non li chiude (design-ui.md § Componenti generici; audit A-08, decisione D-02).
import { ref } from "vue";

export type ToastKind = "info" | "error";

/** Tempo minimo di un messaggio informativo, piu' il tempo di lettura per carattere, fino a un massimo. */
const INFO_MIN_MS = 4000;
const INFO_PER_CHAR_MS = 60;
const INFO_MAX_MS = 10_000;
/** Alla ripresa dopo una pausa resta almeno questo tempo per finire di leggere. */
const RESUME_MIN_MS = 2000;

export function infoDuration(msg: string): number {
  return Math.min(INFO_MAX_MS, INFO_MIN_MS + INFO_PER_CHAR_MS * msg.length);
}

const message = ref("");
const visible = ref(false);
const kind = ref<ToastKind>("info");
let timer: ReturnType<typeof setTimeout> | undefined;
let remaining = 0;
let startedAt = 0;
let paused = false;

function startTimer() {
  startedAt = Date.now();
  timer = setTimeout(() => {
    visible.value = false;
  }, remaining);
}

export function showToast(msg: string, toastKind: ToastKind = "info") {
  message.value = msg;
  kind.value = toastKind;
  visible.value = true;
  clearTimeout(timer);
  paused = false;
  if (toastKind === "info") {
    remaining = infoDuration(msg);
    startTimer();
  }
}

// Esito di un'operazione dello store ({ ok, message }): errore persistente se ok e' false.
export function showResultToast(result: { ok: boolean; message: string }) {
  showToast(result.message, result.ok ? "info" : "error");
}

/** Puntatore o focus sul toast: il tempo si ferma. */
export function pauseToast() {
  if (!visible.value || kind.value !== "info" || paused) return;
  paused = true;
  clearTimeout(timer);
  remaining -= Date.now() - startedAt;
}

/** Puntatore e focus fuori dal toast: riparte il tempo che restava, con un minimo per rileggere. */
export function resumeToast() {
  if (!paused) return;
  paused = false;
  if (!visible.value || kind.value !== "info") return;
  remaining = Math.max(remaining, RESUME_MIN_MS);
  startTimer();
}

export function dismissToast() {
  clearTimeout(timer);
  paused = false;
  visible.value = false;
}

export function useToast() {
  return { message, visible, kind, dismiss: dismissToast, pause: pauseToast, resume: resumeToast };
}
