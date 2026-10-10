// Comportamento comune di pannelli e dialoghi modali (design-ui.md, Accessibilità):
// all'apertura il focus entra nel modale, Tab resta dentro, Esc chiude, alla chiusura il
// focus torna all'elemento che lo aveva aperto.
import { nextTick, onBeforeUnmount, onMounted, type Ref } from "vue";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

export function useModalFocus(root: Ref<HTMLElement | null>, onEscape: () => void, initial?: Ref<HTMLElement | null>) {
  let returnFocus: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent) {
    if (!root.value) return;
    // Un dialogo di conferma aperto sopra ha la precedenza.
    if (document.querySelector(".confirm-overlay")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...root.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMounted(async () => {
    returnFocus = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", onKeydown);
    document.body.style.overflow = "hidden";
    await nextTick();
    (initial?.value ?? root.value?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  });
  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeydown);
    document.body.style.overflow = "";
    returnFocus?.focus?.();
  });
}
