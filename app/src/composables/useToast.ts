// Toast globale minimale: stato reattivo condiviso + funzione showToast(). I messaggi
// informativi spariscono da soli; gli errori restano finche' l'utente non li chiude,
// cosi' non scompaiono prima di essere letti (design-ui.md § Componenti generici).
import { ref } from "vue";

export type ToastKind = "info" | "error";

const INFO_DURATION_MS = 2600;

const message = ref("");
const visible = ref(false);
const kind = ref<ToastKind>("info");
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string, toastKind: ToastKind = "info") {
  message.value = msg;
  kind.value = toastKind;
  visible.value = true;
  clearTimeout(timer);
  if (toastKind === "info") {
    timer = setTimeout(() => {
      visible.value = false;
    }, INFO_DURATION_MS);
  }
}

// Esito di un'operazione dello store ({ ok, message }): errore persistente se ok e' false.
export function showResultToast(result: { ok: boolean; message: string }) {
  showToast(result.message, result.ok ? "info" : "error");
}

export function dismissToast() {
  clearTimeout(timer);
  visible.value = false;
}

export function useToast() {
  return { message, visible, kind, dismiss: dismissToast };
}
