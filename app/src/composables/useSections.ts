// Sezioni comprimibili di una pagina lunga (Profilo, Impostazioni; decisione del coach D-02): quali
// sono aperte resta per la sessione del browser, cosi' tornando sulla pagina la si ritrova com'era.
// sessionStorage puo' mancare o rifiutare la scrittura: in quel caso valgono le sezioni predefinite.
import { reactive } from "vue";

export function useSections(page: string, defaults: () => string[]) {
  const key = `pcoach.sezioni.${page}`;
  let stored: string[] | null = null;
  try {
    const raw = sessionStorage.getItem(key);
    stored = raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    stored = null;
  }
  const open = reactive(new Set<string>(Array.isArray(stored) ? stored : defaults()));

  function persist() {
    try {
      sessionStorage.setItem(key, JSON.stringify([...open]));
    } catch {
      // Solo una comodita': senza memoria le sezioni ripartono da quelle predefinite.
    }
  }

  const isOpen = (id: string) => open.has(id);
  function toggle(id: string) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
    persist();
  }
  function reveal(id: string) {
    open.add(id);
    persist();
  }
  function setAll(ids: string[], value: boolean) {
    for (const id of ids) {
      if (value) open.add(id);
      else open.delete(id);
    }
    persist();
  }

  return { isOpen, toggle, reveal, setAll };
}

/** Apre una sezione e la porta in vista (link dalle anomalie, dall'indice). */
export async function scrollToSection(id: string, reveal: (id: string) => void, nextTick: () => Promise<void>) {
  reveal(id);
  await nextTick();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
