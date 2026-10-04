import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from "vue";

// Deve combaciare con la media query mobile in styles/base.css.
const MOBILE_MEDIA_QUERY = "(max-width: 720px)";

/**
 * Stato e comportamento del drawer mobile della sidebar: apertura/chiusura,
 * chiusura con Esc, blocco dello scroll della pagina sottostante, gestione del
 * focus (dentro il drawer all'apertura, sull'hamburger alla chiusura) e reset
 * automatico quando la finestra torna a larghezza desktop.
 */
export function useMobileSidebar(options: { sidebarId: string; toggleEl: Ref<HTMLElement | null> }) {
  const open = ref(false);
  let mql: MediaQueryList | null = null;

  function openSidebar() {
    open.value = true;
  }
  function closeSidebar() {
    open.value = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") closeSidebar();
  }

  function onBreakpointChange(event: MediaQueryListEvent) {
    if (!event.matches) closeSidebar();
  }

  watch(open, async (isOpen) => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen) {
      document.addEventListener("keydown", onKeydown);
      await nextTick();
      document.getElementById(options.sidebarId)?.focus();
    } else {
      document.removeEventListener("keydown", onKeydown);
      // Riporta il focus sull'hamburger solo se siamo ancora in layout mobile
      // (alla chiusura per resize verso desktop il pulsante non esiste piu').
      if (mql?.matches) {
        await nextTick();
        options.toggleEl.value?.focus();
      }
    }
  });

  onMounted(() => {
    mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    mql.addEventListener("change", onBreakpointChange);
  });
  onUnmounted(() => {
    mql?.removeEventListener("change", onBreakpointChange);
    document.removeEventListener("keydown", onKeydown);
    document.body.style.overflow = "";
  });

  return { open, openSidebar, closeSidebar };
}
