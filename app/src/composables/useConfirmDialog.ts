// Dialog di conferma globale minimale, pilotato da una singola istanza condivisa.
// L'etichetta di ogni scelta descrive l'azione ("Elimina", "Chiudi senza salvare", ...): mai un
// generico "OK" ne' un'etichetta che non corrisponde all'azione.
import { ref } from "vue";

export type ChoiceTone = "primary" | "danger" | "secondary";

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  tone: ChoiceTone;
}

export interface ConfirmOptions {
  confirmLabel: string;
  cancelLabel?: string;
  /** Stile del pulsante di conferma: rosso solo per le azioni distruttive. */
  tone?: ChoiceTone;
}

const message = ref("");
const visible = ref(false);
const choices = ref<Choice[]>([]);
const cancelLabel = ref("Annulla");
let resolver: ((value: string | null) => void) | null = null;

/**
 * Domanda con piu' scelte oltre all'annullamento. Restituisce il valore della scelta, o null se
 * il coach annulla (pulsante, Esc o clic fuori dal dialog).
 */
export function choiceDialog<T extends string>(msg: string, options: Choice<T>[], cancel = "Annulla"): Promise<T | null> {
  // Una domanda ancora aperta viene annullata: una sola domanda alla volta.
  resolver?.(null);
  message.value = msg;
  choices.value = options;
  cancelLabel.value = cancel;
  visible.value = true;
  return new Promise((resolve) => {
    resolver = resolve as (value: string | null) => void;
  });
}

export async function confirmDialog(msg: string, options: ConfirmOptions): Promise<boolean> {
  const answer = await choiceDialog(msg, [{ value: "ok", label: options.confirmLabel, tone: options.tone ?? "danger" }], options.cancelLabel ?? "Annulla");
  return answer === "ok";
}

export function useConfirmDialog() {
  function resolve(value: string | null) {
    visible.value = false;
    resolver?.(value);
    resolver = null;
  }
  return { message, visible, choices, cancelLabel, resolve };
}
