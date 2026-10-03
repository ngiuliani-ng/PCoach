// Toast globale minimale: stato reattivo condiviso + funzione showToast(), equivalente
// al #toast + showToast() del legacy index.html.
import { ref } from "vue";

const message = ref("");
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string) {
  message.value = msg;
  visible.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    visible.value = false;
  }, 2200);
}

export function useToast() {
  return { message, visible };
}
