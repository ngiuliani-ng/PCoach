// Livelli aperti sopra una pagina (pannello della seduta, dialoghi del piano) tenuti in un parametro
// di query: «indietro» li chiude e un ricaricamento li riapre (decisione del coach D-UX-5).
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useQueryLayer(key: string) {
  const route = useRoute();
  const router = useRouter();
  const value = computed(() => {
    const v = route.query[key];
    return typeof v === "string" && v ? v : null;
  });

  /** Apre il livello con una nuova voce della cronologia (o la sostituisce se il livello e' gia' aperto). */
  function open(v: string) {
    const location = { query: { ...route.query, [key]: v } };
    void (value.value ? router.replace(location) : router.push(location));
  }

  /**
   * Chiude il livello. Se la voce precedente della cronologia e' la stessa pagina senza il livello si
   * torna indietro, cosi' chiusura e «indietro» restano allineati; altrimenti (link diretto o
   * ricaricamento) si sostituisce la voce.
   */
  function close() {
    const query = { ...route.query };
    delete query[key];
    const target = router.resolve({ path: route.path, query }).fullPath;
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back === target) router.back();
    else void router.replace(target);
  }

  return { value, open, close };
}
