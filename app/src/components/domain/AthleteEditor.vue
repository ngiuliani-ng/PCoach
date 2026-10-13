<script setup lang="ts">
// Editor scheda atleta, diviso in tre viste (ADR 0016, ADR 0017):
// - Panoramica: cio' che il coach consulta ogni giorno (carico e forma, settimana in corso, feedback);
// - Piano: le sedute, settimana per settimana, con generazione, revisione e sincronizzazione;
// - Profilo: i dati dell'atleta che si compilano di rado, in sezioni comprimibili; il contenuto di
//   ogni sezione e' una componente Profile*.vue (audit UX-55), qui restano ordine, riepiloghi e stato condiviso.
// L'header con nome, stato di salvataggio e "Salva" resta sticky in entrambe le viste.
// Atleta e vista vengono dalla rotta (router.ts): /atleta/:id/:tab, oppure /atleta/nuovo per la bozza.
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAthletesStore } from "../../stores/athletes";
import { useWorkoutsStore } from "../../stores/workouts";
import { useSettingsStore } from "../../stores/settings";
import { useReviewsStore } from "../../stores/reviews";
import { fullName, formatDate, disciplineLabel, todayISO } from "../../constants";
import { parseLoadPattern } from "../../domain/planWeeks";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { showToast, showResultToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import LoadMetricsChart from "./LoadMetricsChart.vue";
import PlanTab from "./PlanTab.vue";
import WorkoutRow from "./WorkoutRow.vue";
import WeeklyReviews from "./WeeklyReviews.vue";
import type { AthleteTab } from "../../router";
import AnomaliesTab from "./AnomaliesTab.vue";
import { useAthleteAnomalies } from "../../composables/useAthleteAnomalies";
import { useZoneChange } from "../../composables/useZoneChange";
import PageSection from "../ui/PageSection.vue";
import SectionNav from "../ui/SectionNav.vue";
import GuidePanel from "../ui/GuidePanel.vue";
import { useSections, scrollToSection } from "../../composables/useSections";
import { useQueryLayer } from "../../composables/useQueryLayer";
import { isGuideKey, type GuideKey } from "../../help/guide";
import {
  constraintsSummary, disciplinesSummary, goalsSummary, identitySummary, methodologySummary, notesSummary, statusSummary, thresholdsSummary
} from "../../domain/profileSummaries";
import ProfileIdentity from "./ProfileIdentity.vue";
import ProfileIntervals from "./ProfileIntervals.vue";
import ProfileDisciplines from "./ProfileDisciplines.vue";
import ProfileThresholds, { type ThresholdSport } from "./ProfileThresholds.vue";
import ProfileTrainingStatus from "./ProfileTrainingStatus.vue";
import ProfileGoals from "./ProfileGoals.vue";
import ProfileConstraints from "./ProfileConstraints.vue";
import ProfileMethodology from "./ProfileMethodology.vue";
import { CloudCheck, Download, Trash2 } from "lucide-vue-next";

const athletes = useAthletesStore();
const workouts = useWorkoutsStore();
const route = useRoute();
const router = useRouter();

// ---------- Scheda indicata dalla rotta ----------
const isNewRoute = computed(() => route.name === "new-athlete");
const routeId = computed(() => (isNewRoute.value ? null : String(route.params.id)));
watch(
  [routeId, isNewRoute, () => athletes.loaded, () => !!(routeId.value && athletes.athletes[routeId.value])],
  () => {
    if (isNewRoute.value) {
      if (!(athletes.currentId === null && athletes.currentProfile)) athletes.newAthlete();
      return;
    }
    const id = routeId.value!;
    if (athletes.currentId === id && athletes.currentProfile) return;
    if (athletes.athletes[id]) athletes.openAthlete(id);
    else if (athletes.loaded) {
      showToast("Questa scheda non esiste più.");
      void router.replace({ name: "home" });
    }
  },
  { immediate: true }
);
// La scheda in memoria e' quella della rotta: durante il caricamento non se ne mostra un'altra.
const ready = computed(() => !!athletes.currentProfile && (isNewRoute.value ? athletes.currentId === null : athletes.currentId === routeId.value));
const profile = computed(() => athletes.currentProfile!);

// ---------- Viste (Panoramica / Piano / Profilo) ----------
type Tab = AthleteTab;
// «Anomalie» solo per una scheda salvata: una bozza non ha sedute, feedback ne' Intervals.icu.
const TABS = computed<[Tab, string][]>(() => [
  ["panoramica", "Panoramica"], ["piano", "Piano"], ["profilo", "Profilo"],
  ...(athletes.currentId ? [["anomalie", "Anomalie"] as [Tab, string]] : [])
]);
// Una bozza non ha ancora dati da consultare: si parte dal Profilo.
const draftTab = ref<Tab>("profilo");
const tab = computed<Tab>({
  get: () => (isNewRoute.value ? draftTab.value : ((route.params.tab as Tab) || "panoramica")),
  set: (value) => {
    if (isNewRoute.value) draftTab.value = value;
    else void router.replace({ name: "athlete", params: { id: routeId.value, tab: value } });
  }
});
function onTabKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  const list = TABS.value;
  const i = list.findIndex(([key]) => key === tab.value);
  tab.value = list[(i + (event.key === "ArrowRight" ? 1 : list.length - 1)) % list.length][0];
  nextTick(() => document.getElementById(`tab-${tab.value}`)?.focus());
}
// ---------- Sezioni del Profilo (D-02) e guida (D-04) ----------
const PROFILE_SECTIONS = [
  { id: "sec-identita", title: "Identità" }, { id: "sec-intervals", title: "Intervals.icu" },
  { id: "sec-discipline", title: "Discipline" }, { id: "sec-soglie", title: "Soglie e zone" },
  { id: "sec-stato", title: "Stato di allenamento" }, { id: "sec-obiettivi", title: "Obiettivi" },
  { id: "sec-vincoli", title: "Vincoli e disponibilità" }, { id: "sec-metodologia", title: "Metodologia" },
  { id: "sec-note", title: "Note libere" }, { id: "sec-gestione", title: "Gestione scheda" }
];
// Sezioni sempre chiuse all'arrivo, anche per una bozza e cambiando atleta (scelta del coach).
const sections = useSections();
const { isOpen, toggle, reveal } = sections;
watch(() => route.params.id ?? route.name, () => sections.closeAll());
async function goToSection(sectionId: string) {
  tab.value = "profilo";
  await scrollToSection(sectionId, reveal, nextTick);
}
// Link a una sezione del Profilo (?sezione=…, dalla pagina «Da fare»): la apre e la porta in vista.
watch(
  [ready, () => route.query.sezione],
  async ([ok, id]) => {
    if (!ok || typeof id !== "string" || !PROFILE_SECTIONS.some((s) => s.id === id)) return;
    await goToSection(id);
  },
  { immediate: true }
);
const guideLayer = useQueryLayer("guida");
const guideKey = computed(() => (isGuideKey(guideLayer.value.value) ? guideLayer.value.value : null));
const openGuide = (key: GuideKey) => guideLayer.open(key);

// ---------- Riepilogo nell'intestazione ----------
const disciplinesText = computed(() =>
  profile.value.disciplines.map((d) => disciplineLabel(d.sport)).filter(Boolean).join(", ")
);
// Data dell'ultimo salvataggio in forma corta per il telefono: senza l'anno, se e' quello in corso.
const savedShort = computed(() => {
  const date = profile.value.meta.updated_at ?? "";
  return formatDate(date, date.slice(0, 4) !== todayISO().slice(0, 4));
});
const nextEvent = computed(() => {
  const today = todayISO();
  return (profile.value.goals.target_events || [])
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
});

// ---------- Soglie: la disciplina mostrata (la scelgono anche le anomalie) ----------
const thresholdSport = ref<ThresholdSport>("running");
// Schema di carico e scarico non riconosciuto: la sezione Metodologia lo segnala e si apre da sola.
const loadPatternInvalid = computed(() => !parseLoadPattern(profile.value.methodology_preferences.load_deload_pattern));

// ---------- Intervals.icu ----------
// Sincronizzazione automatica (§7.2/§7.4): la chiave attiva/aggiorna da sola in base ai
// trigger previsti (digitazione con debounce, apertura scheda, pressione "Genera piano").
const intervalsSync = useIntervalsSync();
const intervalsSyncing = computed(() => intervalsSync.isSyncing(athletes.currentId));
const intervalsKeyStatus = computed(() => intervalsSync.statusFor(athletes.currentId));
const hasIntervalsKey = computed(() => !!profile.value.integrations?.intervals_icu_api_key);
const intervalsStatusText = computed(() => {
  if (intervalsSyncing.value) return "Sincronizzazione in corso…";
  const status = intervalsKeyStatus.value;
  if (status === "valid") return "Chiave valida.";
  if (status === "invalid") return "Chiave non valida: copiala di nuovo da Intervals.icu.";
  if (status === "offline") return "Non verificabile ora: rete non disponibile.";
  return "";
});

const intervalsSummary = computed(() =>
  !hasIntervalsKey.value ? "Nessuna chiave: niente carico né invio delle sedute" : intervalsStatusText.value.replace(/\.$/, "") || "Chiave inserita"
);

watch(
  () => athletes.currentProfile?.integrations?.intervals_icu_api_key,
  (apiKey) => intervalsSync.syncDebounced(athletes.currentId, apiKey)
);

watch(
  () => athletes.currentId,
  (id) => intervalsSync.syncNow(id, athletes.athletes[id ?? ""]?.integrations?.intervals_icu_api_key),
  { immediate: true }
);

async function onReloadRemote() {
  if (athletes.isDirty) {
    const confirmed = await confirmDialog(
      "Hai modifiche non salvate che andranno perse se ricarichi i dati più recenti. Continuare?",
      { confirmLabel: "Ricarica e scarta le modifiche", cancelLabel: "Mantieni le modifiche" }
    );
    if (!confirmed) return;
  }
  athletes.reloadCurrentFromRemote();
  showToast("Scheda ricaricata con i dati più recenti.");
}

// ---------- Sedute ----------
// Le sedute vivono in tabelle proprie (ADR 0017): si caricano all'apertura della scheda. Subito
// dopo, le sedute recenti abbinate con certezza a un'attivita' di Intervals.icu risultano svolte
// senza aprire «Sincronizza settimana» (ADR 0019).
const settings = useSettingsStore();
// Con l'invio email attivo l'indirizzo serve (decisione del coach D-05), ma la scheda si salva anche senza.
const emailMissing = computed(() => settings.savedEmailEnabled && !profile.value.identity.email?.trim());
watch(
  () => athletes.currentId,
  async (id) => {
    await workouts.load(id);
    if (id && id === athletes.currentId) {
      await workouts.recordCompletions(athletes.athletes[id]?.integrations?.intervals_icu_api_key, settings.settings.feedback_params);
    }
  },
  { immediate: true }
);
const thisWeek = computed(() => {
  const start = weekStartISO(todayISO());
  const end = addDaysISO(start, 6);
  return workouts.workouts.filter((w) => w.planned_date >= start && w.planned_date <= end && (w.status === "draft" || w.status === "approved"));
});

// ---------- Azioni sulla scheda ----------
const { saveProfile } = useZoneChange();
async function onSave() {
  const wasNew = athletes.currentId === null;
  const result = await saveProfile();
  if (result.cancelled) return;
  showResultToast(result);
  // Il primo salvataggio assegna l'id: la bozza diventa la scheda dell'atleta, nella stessa vista.
  if (result.ok && wasNew && athletes.currentId) {
    void router.replace({ name: "athlete", params: { id: athletes.currentId, tab: draftTab.value } });
  }
}
async function onDelete() {
  if (!athletes.currentId) return;
  const confirmed = await confirmDialog(
    `Eliminare la scheda di "${fullName(profile.value.identity)}"? L'operazione non è reversibile.`,
    { confirmLabel: "Elimina scheda" }
  );
  if (!confirmed) return;
  const result = await athletes.deleteAthlete(athletes.currentId);
  showResultToast(result);
  if (result.ok) void router.replace({ name: "home" });
}
// Una seduta dalla Panoramica: si apre nel Piano, e «indietro» torna alla Panoramica.
function openWorkout(id: string) {
  void router.push({ name: "athlete", params: { id: routeId.value, tab: "piano" }, query: { seduta: id } });
}
function onExport() {
  athletes.exportCurrent();
}

// Una sezione con un errore da correggere si apre da sola (poi si puo' richiudere).
watch(() => ready.value && loadPatternInvalid.value, (bad) => bad && reveal("sec-metodologia"), { immediate: true });
watch(() => intervalsKeyStatus.value === "invalid", (bad) => bad && reveal("sec-intervals"), { immediate: true });

// ---------- Anomalie (ADR 0031) ----------
const anomalies = useAthleteAnomalies({
  openThresholds: (discipline) => {
    thresholdSport.value = discipline;
    void goToSection("sec-soglie");
  },
  openIntervalsKey: () => void goToSection("sec-intervals"),
  openIdentity: () => void goToSection("sec-identita"),
  openFeedback: (reviewId) => void router.push({ name: "athlete", params: { id: routeId.value, tab: "panoramica" }, query: { feedback: reviewId } }),
  // push e non replace: «indietro» chiude il pannello e torna alle anomalie.
  openWorkout: (id) => void router.push({ name: "athlete", params: { id: routeId.value, tab: "piano" }, query: { seduta: id } })
});
const anomalyCount = anomalies.count;
const reviewsStore = useReviewsStore();
// Si decide all'apertura della scheda: dopo l'approvazione il feedback resta dov'era, senza saltare in fondo.
const feedbackFirst = ref(false);
watch(
  () => [reviewsStore.athleteId, reviewsStore.loading] as const,
  ([id, loading]) => {
    if (id === athletes.currentId && !loading) feedbackFirst.value = reviewsStore.current.some((r) => r.status === "draft");
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="!ready" class="placeholder"><p>Caricamento…</p></div>
  <div class="form-wrap" v-else>
    <header class="page-header">
      <h1>{{ fullName(profile.identity) || "Nuovo atleta" }}</h1>
      <div class="page-header-actions">
        <span v-if="athletes.isDirty" class="unsaved-badge">Modifiche non salvate</span>
        <!-- La data dell'ultimo salvataggio sta accanto a «Salva», dove si capisce che riguarda la scheda (audit UX-05). -->
        <!-- Su telefono: icona e data corta («1 set»), il testo intero resta per i lettori di schermo. -->
        <span v-else-if="tab === 'profilo' && athletes.currentId" class="saved-note">
          <CloudCheck :size="16" class="saved-icon" aria-hidden="true" />
          <span class="saved-long">Scheda salvata il {{ formatDate(profile.meta.updated_at) }}</span>
          <span class="saved-short" aria-hidden="true">{{ savedShort }}</span>
        </span>
        <!-- Salva i dati del Profilo: fuori da quella vista compare solo se ci sono modifiche da salvare. -->
        <button v-if="tab === 'profilo' || athletes.isDirty" type="button" class="primary" :disabled="!athletes.isDirty" @click="onSave">{{ tab === "profilo" ? "Salva" : "Salva il profilo" }}</button>
      </div>
    </header>
    <p v-if="athletes.hasRemoteUpdate" class="update-banner" role="status">
      Questa scheda è stata modificata altrove.
      <button type="button" class="link-btn" @click="onReloadRemote">Ricarica i dati più recenti</button>
    </p>
    <!-- Su telefono solo il prossimo evento: le tab restano in alto (audit UX-05). -->
    <p v-if="disciplinesText || nextEvent || !athletes.currentId" class="page-sub" :class="{ 'event-less': !nextEvent && athletes.currentId }">
      <span v-if="disciplinesText" class="wide-only">{{ disciplinesText }}</span>
      <span v-if="nextEvent">Prossimo evento: {{ nextEvent.name || "senza nome" }}, {{ formatDate(nextEvent.date) }}</span>
      <span v-if="!athletes.currentId">Bozza non ancora salvata</span>
    </p>

    <div class="tabs" role="tablist" aria-label="Sezioni della scheda" @keydown="onTabKeydown">
      <button
        v-for="[key, label] in TABS"
        :key="key"
        :id="`tab-${key}`"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="tab === key"
        :aria-controls="`panel-${key}`"
        :tabindex="tab === key ? 0 : -1"
        @click="tab = key"
      >{{ label }}<span v-if="key === 'anomalie' && anomalyCount" class="tab-count" :aria-label="`, ${anomalyCount} da sistemare`">{{ anomalyCount }}</span></button>
    </div>

    <!-- ===================== Panoramica ===================== -->
    <div v-show="tab === 'panoramica'" id="panel-panoramica" role="tabpanel" aria-labelledby="tab-panoramica">
      <!-- Con un feedback da approvare, il feedback e' la prima cosa della Panoramica (audit UX-10). -->
      <WeeklyReviews v-if="athletes.currentId && feedbackFirst" :athlete-id="athletes.currentId" />
      <section class="block">
        <h3>Carico e forma</h3>
        <LoadMetricsChart :log="profile.training_status!.load_metrics_log as never">
          <template #empty>
            <p v-if="!hasIntervalsKey">
              Nessun dato di carico. Il carico arriva da Intervals.icu:
              <button type="button" class="link-btn" @click="goToSection('sec-intervals')">aggiungi la chiave nel Profilo</button>.
            </p>
            <p v-else-if="intervalsSyncing">Sincronizzazione con Intervals.icu in corso…</p>
            <p v-else>Nessun dato di carico ricevuto da Intervals.icu per questo atleta.</p>
          </template>
        </LoadMetricsChart>
      </section>

      <section class="block">
        <h3>Questa settimana</h3>
        <p v-if="!athletes.currentId" class="helper-text">Salva la scheda per pianificare le sedute.</p>
        <p v-else-if="!thisWeek.length" class="helper-text">
          Nessuna seduta in programma questa settimana.
          <button type="button" class="link-btn" @click="tab = 'piano'">Apri il piano</button>
        </p>
        <template v-else>
          <div class="week-unit">
            <WorkoutRow v-for="w in thisWeek" :key="w.id" :workout="w" :sync="workouts.syncRows[w.id]" show-date readonly @open="openWorkout" />
          </div>
          <button type="button" class="link-btn overview-plan-link" @click="tab = 'piano'">Apri il piano</button>
        </template>
      </section>

      <WeeklyReviews v-if="athletes.currentId && !feedbackFirst" :athlete-id="athletes.currentId" />
    </div>

    <!-- ===================== Piano ===================== -->
    <div v-if="tab === 'piano'" id="panel-piano" role="tabpanel" aria-labelledby="tab-piano">
      <PlanTab v-if="athletes.currentId" @go-profile="goToSection" />
      <p v-else class="helper-text">Salva la scheda per pianificare le sedute.</p>
    </div>

    <!-- ===================== Anomalie ===================== -->
    <div v-if="tab === 'anomalie'" id="panel-anomalie" role="tabpanel" aria-labelledby="tab-anomalie">
      <AnomaliesTab :anomalies="anomalies.anomalies.value" :checking="anomalies.checking.value" :busy="anomalies.busy.value" />
    </div>

    <!-- ===================== Profilo ===================== -->
    <!-- Sezioni comprimibili con riepilogo e guida per gruppo (decisioni del coach D-02, D-04). -->
    <div v-show="tab === 'profilo'" id="panel-profilo" role="tabpanel" aria-labelledby="tab-profilo">
      <SectionNav :sections="PROFILE_SECTIONS" @go="goToSection" />

      <PageSection id="sec-identita" title="Identità" :open="isOpen('sec-identita')" :summary="identitySummary(profile)"
        :attention="emailMissing" guide @toggle="toggle('sec-identita')" @guide="openGuide('profilo-identita')">
        <ProfileIdentity :email-missing="emailMissing" />
      </PageSection>

      <PageSection id="sec-intervals" title="Intervals.icu" :open="isOpen('sec-intervals')" :summary="intervalsSummary"
        :attention="intervalsKeyStatus === 'invalid' || !hasIntervalsKey" guide @toggle="toggle('sec-intervals')" @guide="openGuide('profilo-intervals')">
        <ProfileIntervals :status-text="intervalsStatusText" :invalid="intervalsKeyStatus === 'invalid'" />
      </PageSection>

      <PageSection id="sec-discipline" title="Discipline" :open="isOpen('sec-discipline')" :summary="disciplinesSummary(profile)"
        guide @toggle="toggle('sec-discipline')" @guide="openGuide('profilo-discipline')">
        <ProfileDisciplines />
      </PageSection>

      <PageSection id="sec-soglie" title="Soglie e zone" :open="isOpen('sec-soglie')" :summary="thresholdsSummary(profile)"
        guide @toggle="toggle('sec-soglie')" @guide="openGuide('profilo-soglie')">
        <ProfileThresholds v-model:sport="thresholdSport" />
      </PageSection>

      <PageSection id="sec-stato" title="Stato di allenamento" :open="isOpen('sec-stato')" :summary="statusSummary(profile)"
        guide @toggle="toggle('sec-stato')" @guide="openGuide('profilo-stato')">
        <ProfileTrainingStatus />
      </PageSection>

      <PageSection id="sec-obiettivi" title="Obiettivi" :open="isOpen('sec-obiettivi')" :summary="goalsSummary(profile)"
        guide @toggle="toggle('sec-obiettivi')" @guide="openGuide('profilo-obiettivi')">
        <ProfileGoals />
      </PageSection>

      <PageSection id="sec-vincoli" title="Vincoli e disponibilità" :open="isOpen('sec-vincoli')" :summary="constraintsSummary(profile)"
        guide @toggle="toggle('sec-vincoli')" @guide="openGuide('profilo-vincoli')">
        <ProfileConstraints />
      </PageSection>

      <PageSection id="sec-metodologia" title="Metodologia" :open="isOpen('sec-metodologia')" :summary="methodologySummary(profile)"
        :attention="loadPatternInvalid" guide @toggle="toggle('sec-metodologia')" @guide="openGuide('profilo-metodologia')">
        <ProfileMethodology />
      </PageSection>

      <PageSection id="sec-note" title="Note libere" :open="isOpen('sec-note')" :summary="notesSummary(profile)"
        guide @toggle="toggle('sec-note')" @guide="openGuide('profilo-note')">
        <textarea v-model="profile.notes_free_text" rows="4" aria-label="Note libere"></textarea>
      </PageSection>

      <PageSection id="sec-gestione" title="Gestione scheda" :open="isOpen('sec-gestione')" summary="Esporta o elimina la scheda"
        @toggle="toggle('sec-gestione')">
        <div class="action-bar">
          <button type="button" class="secondary" @click="onExport"><Download :size="16" aria-hidden="true" />Esporta JSON</button>
          <button type="button" class="danger" v-if="athletes.currentId" @click="onDelete"><Trash2 :size="16" aria-hidden="true" />Elimina scheda</button>
        </div>
      </PageSection>
    </div>

    <GuidePanel v-if="guideKey" :key="guideKey" :guide-key="guideKey" @close="guideLayer.close()" />
  </div>
</template>
