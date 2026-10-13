// Sezioni comprimibili di una pagina lunga (Profilo, Impostazioni; decisione del coach D-02): ogni volta
// che si arriva sulla pagina sono tutte chiuse (scelta del coach). Si aprono a mano, da un link che porta a
// una sezione o da sole quando contengono un errore da correggere.
import { reactive } from "vue";

export function useSections() {
  const open = reactive(new Set<string>());

  const isOpen = (id: string) => open.has(id);
  function toggle(id: string) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
  }
  function reveal(id: string) {
    open.add(id);
  }
  function closeAll() {
    open.clear();
  }

  return { isOpen, toggle, reveal, closeAll };
}

/** Apre una sezione e la porta in vista (link dalle anomalie, dall'indice, dalla pagina «Da fare»). */
export async function scrollToSection(id: string, reveal: (id: string) => void, nextTick: () => Promise<void>) {
  reveal(id);
  await nextTick();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
