import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from "vue";

// Deve combaciare con la media query mobile in styles/base.css.
const MOBILE_MEDIA_QUERY = "(max-width: 720px)";

// Stato condiviso: chi porta il coach a un campo da correggere chiude prima il drawer (closeMobileSidebarFor).
const open = ref(false);
/** Alla prossima chiusura il focus non torna sull'hamburger: lo prende il campo da correggere. */
let skipFocusRestore = false;

/**
 * Chiude il drawer mobile per portare il coach a un punto della pagina (ad esempio un campo con un errore):
 * il contenuto sotto il drawer e' inerte finche' e' aperto (audit A-12).
 */
export function closeMobileSidebarFor() {
  if (!open.value) return;
  skipFocusRestore = true;
  open.value = false;
}

/**
 * Stato e comportamento del drawer mobile della sidebar: apertura/chiusura,
 * chiusura con Esc, blocco dello scroll della pagina sottostante, gestione del
 * focus (dentro il drawer all'apertura, sull'hamburger alla chiusura) e reset
 * automatico quando la finestra torna a larghezza desktop.
 */
export function useMobileSidebar(options: { sidebarId: string; toggleEl: Ref<HTMLElement | null> }) {
  /** Layout mobile: la barra e' un drawer (chiusa e' inerte, aperta rende inerte il resto: audit A-02, A-12). */
  const isMobile = ref(false);
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
    isMobile.value = event.matches;
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
      // (alla chiusura per resize verso desktop il pulsante non esiste piu'), salvo che il focus debba
      // andare a un campo della pagina (closeMobileSidebarFor).
      const restore = !skipFocusRestore;
      skipFocusRestore = false;
      if (restore && mql?.matches) {
        await nextTick();
        options.toggleEl.value?.focus();
      }
    }
  });

  onMounted(() => {
    mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    isMobile.value = mql.matches;
    mql.addEventListener("change", onBreakpointChange);
  });
  onUnmounted(() => {
    mql?.removeEventListener("change", onBreakpointChange);
    document.removeEventListener("keydown", onKeydown);
    document.body.style.overflow = "";
  });

  return { open, isMobile, openSidebar, closeSidebar };
}
