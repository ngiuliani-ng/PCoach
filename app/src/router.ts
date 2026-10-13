// Navigazione (decisione del coach D-UX-5): atleta, vista della scheda, Impostazioni, pannello della
// seduta e dialoghi del piano stanno nell'URL. Ricaricare o riaprire la PWA riporta alla stessa vista,
// e «indietro» chiude pannelli e dialoghi invece di uscire dall'app.
// Cronologia con hash: GitHub Pages non riscrive i percorsi, un ricaricamento su /PCoach/atleta/...
// darebbe 404.
import { createRouter, createWebHashHistory, type RouteLocationNormalized, type Router } from "vue-router";
import TodoPage from "./components/domain/TodoPage.vue";
import AthleteEditor from "./components/domain/AthleteEditor.vue";
import SettingsPanel from "./components/domain/SettingsPanel.vue";
import { useAthletesStore } from "./stores/athletes";
import { useSettingsStore } from "./stores/settings";
import { useReviewsStore } from "./stores/reviews";
import { choiceDialog } from "./composables/useConfirmDialog";
import { showResultToast } from "./composables/useToast";
import { useZoneChange } from "./composables/useZoneChange";
import { saveSettings } from "./composables/useSettingsSave";
import { fullName } from "./constants";

export type AthleteTab = "panoramica" | "piano" | "profilo" | "anomalie";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: TodoPage },
    { path: "/impostazioni", name: "settings", component: SettingsPanel },
    { path: "/atleta/nuovo", name: "new-athlete", component: AthleteEditor },
    { path: "/atleta/:id/:tab(panoramica|piano|profilo|anomalie)?", name: "athlete", component: AthleteEditor },
    { path: "/:pathMatch(.*)*", redirect: "/" }
  ]
});

/** Scheda (atleta o bozza) mostrata da una rotta, o null se la rotta non mostra una scheda. */
function profileKey(route: RouteLocationNormalized): string | null {
  if (route.name === "new-athlete") return "nuovo";
  if (route.name === "athlete") return String(route.params.id);
  return null;
}

/**
 * Uscita dalla scheda con modifiche non salvate (decisione D-UX-1): salvare, scartare o restare.
 * true se si puo' proseguire.
 */
export async function confirmLeaveProfile(): Promise<boolean> {
  if (!(await confirmLeaveFeedbackText())) return false;
  const athletes = useAthletesStore();
  if (!athletes.isDirty) return true;
  const name = fullName(athletes.currentProfile?.identity) || "nuovo atleta";
  const choice = await choiceDialog(
    `Hai modifiche non salvate alla scheda di ${name}.`,
    [
      { value: "discard", label: "Esci senza salvare", tone: "danger" },
      { value: "save", label: "Salva e continua", tone: "primary" }
    ],
    "Resta"
  );
  if (choice === "discard") {
    athletes.discardChanges();
    return true;
  }
  if (choice === "save") {
    const result = await useZoneChange().saveProfile();
    if (result.cancelled) return false;
    showResultToast(result);
    return result.ok;
  }
  return false;
}

/**
 * Testo di un feedback in bozza non ancora salvato (ADR 0038): si prova a salvarlo subito; se il
 * salvataggio non riesce, il coach sceglie se uscire perdendo le correzioni o restare.
 */
async function confirmLeaveFeedbackText(): Promise<boolean> {
  const reviews = useReviewsStore();
  if (!reviews.hasUnsavedText || (await reviews.flushAllTexts())) return true;
  const choice = await choiceDialog(
    "Le correzioni al testo del feedback non sono state salvate.",
    [{ value: "discard", label: "Esci senza salvare", tone: "danger" }],
    "Resta"
  );
  if (choice !== "discard") return false;
  reviews.discardTexts();
  return true;
}

/** Uscita dalle Impostazioni con modifiche non salvate: stesse scelte della scheda. */
export async function confirmLeaveSettings(): Promise<boolean> {
  const settings = useSettingsStore();
  if (!settings.isDirty) return true;
  const choice = await choiceDialog(
    "Hai modifiche non salvate nelle Impostazioni.",
    [
      { value: "discard", label: "Esci senza salvare", tone: "danger" },
      { value: "save", label: "Salva e continua", tone: "primary" }
    ],
    "Resta"
  );
  if (choice === "discard") {
    settings.discardChanges();
    return true;
  }
  if (choice === "save") {
    const result = await saveSettings();
    if (result.cancelled) return false;
    showResultToast(result);
    return result.ok;
  }
  return false;
}

export function installNavigationGuards(r: Router) {
  r.beforeEach(async (to, from) => {
    // Prima navigazione (apertura o ricaricamento): niente da proteggere.
    if (!from.matched.length) return true;
    const fromKey = profileKey(from);
    if (fromKey && fromKey !== profileKey(to) && !(await confirmLeaveProfile())) return false;
    if (from.name === "settings" && to.name !== "settings" && !(await confirmLeaveSettings())) return false;
    return true;
  });
  r.afterEach((to) => {
    // Una bozza di nuovo atleta vive solo nella sua rotta: uscendo (gia' confermato) si chiude.
    const athletes = useAthletesStore();
    if (to.name !== "new-athlete" && athletes.currentId === null && athletes.currentProfile) athletes.closeEditor();
  });
}
