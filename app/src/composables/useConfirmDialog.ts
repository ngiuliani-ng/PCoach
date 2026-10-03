// Dialog di conferma globale minimale: equivalente a showConfirmDialog() nel legacy
// (overlay + box con Annulla/Elimina), pilotato da una singola istanza condivisa.
import { ref } from "vue";

const message = ref("");
const visible = ref(false);
let resolver: ((value: boolean) => void) | null = null;

export function confirmDialog(msg: string): Promise<boolean> {
  message.value = msg;
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
  return { message, visible, resolve };
}
