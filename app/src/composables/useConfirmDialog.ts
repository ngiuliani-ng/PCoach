// Dialog di conferma globale minimale, pilotato da una singola istanza condivisa.
// L'etichetta del pulsante di conferma descrive l'azione ("Elimina", "Chiudi senza
// salvare", ...): mai un generico "OK" ne' un'etichetta che non corrisponde all'azione.
import { ref } from "vue";

export interface ConfirmOptions {
  confirmLabel: string;
  cancelLabel?: string;
}

const message = ref("");
const visible = ref(false);
const confirmLabel = ref("");
const cancelLabel = ref("Annulla");
let resolver: ((value: boolean) => void) | null = null;

export function confirmDialog(msg: string, options: ConfirmOptions): Promise<boolean> {
  // Una conferma ancora aperta viene annullata: una sola domanda alla volta.
  resolver?.(false);
  message.value = msg;
  confirmLabel.value = options.confirmLabel;
  cancelLabel.value = options.cancelLabel ?? "Annulla";
  visible.value = true;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function useConfirmDialog() {
  function resolve(value: boolean) {
    visible.value = false;
    resolver?.(value);
    resolver = null;
  }
  return { message, visible, confirmLabel, cancelLabel, resolve };
}
