<script setup lang="ts">
// Editor scheda atleta, diviso in tre viste (ADR 0016, ADR 0017):
// - Panoramica: cio' che il coach consulta ogni giorno (carico e forma, settimana in corso, feedback);
// - Piano: le sedute, settimana per settimana, con generazione, revisione e sincronizzazione;
// - Profilo: i dati dell'atleta che si compilano di rado (identita', discipline, soglie,
//   stato, obiettivi, vincoli, metodologia, note) e la gestione della scheda.
// L'header con nome, stato di salvataggio e "Salva" resta sticky in entrambe le viste.
// Atleta e vista vengono dalla rotta (router.ts): /atleta/:id/:tab, oppure /atleta/nuovo per la bozza.
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAthletesStore } from "../../stores/athletes";
import { useWorkoutsStore } from "../../stores/workouts";
import { useSettingsStore } from "../../stores/settings";
import { useReviewsStore } from "../../stores/reviews";
import {
  TRAINING_SPORT_OPTIONS, LEVEL_OPTIONS, VOLUME_UNITS,
  OBJECTIVE_OPTIONS, SHARED_OBJECTIVE_OPTIONS, EVENT_DISCIPLINE_OPTIONS, EVENT_PRIORITIES,
  LIFESTYLE_FACTOR_OPTIONS, DAY_LABELS, RUN_THRESHOLD_FIELDS, BIKE_THRESHOLD_FIELDS, SWIM_THRESHOLD_FIELDS,
  PERIODIZATION_LABELS, INTENSITY_OPTIONS,
  fullName, formatDate, disciplineIcon, disciplineLabel, todayISO, numOrNull
} from "../../constants";
import { DEFAULT_TAPER_WEEKS, parseLoadPattern } from "../../domain/planWeeks";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { showToast, showResultToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import MetricLogList from "./MetricLogList.vue";
import LoadMetricsChart from "./LoadMetricsChart.vue";
import PlanTab from "./PlanTab.vue";
import WorkoutRow from "./WorkoutRow.vue";
import WeeklyReviews from "./WeeklyReviews.vue";
import PasswordField from "../ui/PasswordField.vue";
import type { AthleteTab } from "../../router";
import IconButton from "../ui/IconButton.vue";
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
import { Download, Plus, Trash2 } from "lucide-vue-next";

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
// Aperte all'inizio le sezioni che si aggiornano spesso; le altre mostrano il riepilogo.
const sections = useSections("profilo", () => ["sec-soglie", "sec-obiettivi", "sec-vincoli"]);
// Una bozza si compila tutta: le sezioni partono aperte.
const draftClosed = reactive(new Set<string>());
const isOpen = (id: string) => (isNewRoute.value ? !draftClosed.has(id) : sections.isOpen(id));
function toggle(id: string) {
  if (!isNewRoute.value) return sections.toggle(id);
  if (draftClosed.has(id)) draftClosed.delete(id);
  else draftClosed.add(id);
}
function reveal(id: string) {
  if (isNewRoute.value) draftClosed.delete(id);
  else sections.reveal(id);
}
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
const nextEvent = computed(() => {
  const today = todayISO();
  return (profile.value.goals.target_events || [])
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
});

// ---------- Obiettivi ----------
// Solo una scelta del coach sulla stessa scheda, non l'apertura di una scheda diversa.
watch(
  () => [athletes.currentProfile, athletes.currentProfile?.goals.primary_objective] as const,
  ([current, newVal], [previous]) => {
    if (!current || current !== previous) return;
    profile.value.goals.periodization_model = newVal === "preparazione_gara" ? "race_peak_taper" : "continuous_improvement";
    if (newVal === "preparazione_gara" && (!profile.value.goals.target_events || profile.value.goals.target_events.length === 0)) {
      profile.value.goals.target_events = [{ name: "", date: "", discipline: "running", distance_or_duration: "", priority: "A", target_result: "" }];
    }
    if (profile.value.goals.secondary_objective === newVal) {
      profile.value.goals.secondary_objective = "";
    }
  }
);

const secondaryOptions = computed(() => SHARED_OBJECTIVE_OPTIONS.filter(([v]) => v !== profile.value.goals.primary_objective));
const showTargetEvents = computed(() => profile.value.goals.primary_objective === "preparazione_gara");

function addDiscipline() {
  profile.value.disciplines.push({
    sport: "running", level: "principiante", years_practice: undefined,
    current_weekly_volume: { value: undefined, unit: "km" },
    peak_weekly_volume_last_12_months: { value: undefined, unit: "km" }
  });
}
function removeDiscipline(i: number) {
  profile.value.disciplines.splice(i, 1);
}

function addTargetEvent() {
  profile.value.goals.target_events = profile.value.goals.target_events || [];
  profile.value.goals.target_events.push({ name: "", date: "", discipline: "running", distance_or_duration: "", priority: "B", target_result: "" });
}
function removeTargetEvent(i: number) {
  profile.value.goals.target_events?.splice(i, 1);
}

function toggleLifestyleFactor(value: string) {
  const list = profile.value.training_status?.lifestyle_factors || [];
  const idx = list.indexOf(value as never);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value as never);
  if (profile.value.training_status) profile.value.training_status.lifestyle_factors = list;
}

// ---------- Schema di carico e scarico ----------
// Due selettori al posto del testo libero (decisione D-UX-2): il valore resta la stringa "N:M" letta
// da parseLoadPattern; un valore salvato non riconosciuto e' segnalato invece di essere ignorato.
const LOAD_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];
const DELOAD_WEEKS = [1, 2, 3, 4];
const loadPattern = computed(() => parseLoadPattern(profile.value.methodology_preferences.load_deload_pattern));
function setLoadPattern(part: "load" | "deload", raw: string) {
  const current = loadPattern.value ?? { load: 3, deload: 1 };
  const next = { ...current, [part]: Number(raw) };
  profile.value.methodology_preferences.load_deload_pattern = `${next.load}:${next.deload}`;
}

// ---------- Soglie: una sezione, una disciplina alla volta ----------
type ThresholdSport = "running" | "cycling" | "swimming";
const THRESHOLD_SPORTS: [ThresholdSport, string][] = [["running", "Corsa"], ["cycling", "Bici"], ["swimming", "Nuoto"]];
const thresholdSport = ref<ThresholdSport>("running");
const THRESHOLD_FIELDS = { running: RUN_THRESHOLD_FIELDS, cycling: BIKE_THRESHOLD_FIELDS, swimming: SWIM_THRESHOLD_FIELDS };
const zoneSystem = computed({
  get: () => (thresholdSport.value === "swimming" ? "7-zone" : profile.value.physiological_thresholds?.[thresholdSport.value]?.zone_system ?? "7-zone"),
  set: (value) => {
    if (thresholdSport.value !== "swimming") profile.value.physiological_thresholds![thresholdSport.value]!.zone_system = value as "3-zone" | "5-zone" | "7-zone";
  }
});

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
watch(() => ready.value && !loadPattern.value, (bad) => bad && reveal("sec-metodologia"), { immediate: true });
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
        <!-- Salva i dati del Profilo: fuori da quella vista compare solo se ci sono modifiche da salvare. -->
        <button v-if="tab === 'profilo' || athletes.isDirty" type="button" class="primary" :disabled="!athletes.isDirty" @click="onSave">{{ tab === "profilo" ? "Salva" : "Salva il profilo" }}</button>
      </div>
    </header>
    <p v-if="athletes.hasRemoteUpdate" class="update-banner" role="status">
      Questa scheda è stata modificata altrove.
      <button type="button" class="link-btn" @click="onReloadRemote">Ricarica i dati più recenti</button>
    </p>
    <p class="page-sub">
      <span v-if="disciplinesText">{{ disciplinesText }}</span>
      <span v-if="nextEvent">Prossimo evento: {{ nextEvent.name || "senza nome" }}, {{ formatDate(nextEvent.date) }}</span>
      <span v-if="athletes.currentId">Aggiornata il {{ formatDate(profile.meta.updated_at) }}</span>
      <span v-else>Bozza non ancora salvata</span>
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
        <div class="field-row">
          <label class="field"><span class="field-label">Nome</span><input type="text" v-model="profile.identity.nome" /></label>
          <label class="field"><span class="field-label">Cognome</span><input type="text" v-model="profile.identity.cognome" /></label>
          <label class="field"><span class="field-label">Email</span><input type="email" v-model="profile.identity.email" /></label>
        </div>
        <p v-if="emailMissing" class="helper-text error-text">L'invio via email è attivo: senza indirizzo il feedback approvato non arriva all'atleta.</p>
        <div class="field-row">
          <label class="field"><span class="field-label">Anno di nascita</span><input type="number" v-model.number="profile.identity.birth_year" /></label>
          <label class="field">
            <span class="field-label">Sesso biologico</span>
            <select v-model="profile.identity.biological_sex">
              <option value="unspecified">Non specificato</option>
              <option value="male">Maschile</option>
              <option value="female">Femminile</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field"><span class="field-label">Altezza (cm)</span><input type="number" v-model.number="profile.identity.height_cm" /></label>
          <label class="field"><span class="field-label">Peso (kg)</span><input type="number" v-model.number="profile.identity.weight_kg" /></label>
        </div>
      </PageSection>

      <PageSection id="sec-intervals" title="Intervals.icu" :open="isOpen('sec-intervals')" :summary="intervalsSummary"
        :attention="intervalsKeyStatus === 'invalid' || !hasIntervalsKey" guide @toggle="toggle('sec-intervals')" @guide="openGuide('profilo-intervals')">
        <div class="field">
          <label class="field-label" for="intervals-api-key">Chiave API di Intervals.icu</label>
          <PasswordField v-model="profile.integrations!.intervals_icu_api_key as string" input-id="intervals-api-key" />
        </div>
        <p v-if="intervalsStatusText" class="helper-text status-text" :class="{ 'error-text': intervalsKeyStatus === 'invalid' }">{{ intervalsStatusText }}</p>
      </PageSection>

      <PageSection id="sec-discipline" title="Discipline" :open="isOpen('sec-discipline')" :summary="disciplinesSummary(profile)"
        guide @toggle="toggle('sec-discipline')" @guide="openGuide('profilo-discipline')">
        <div v-for="(d, i) in profile.disciplines" :key="i" class="unit">
          <div class="unit-head">
            <span class="unit-title">
              <component :is="disciplineIcon(d.sport)" :size="16" aria-hidden="true" />
              {{ disciplineLabel(d.sport) }}
            </span>
            <IconButton :label="`Rimuovi ${disciplineLabel(d.sport)}`" @click="removeDiscipline(i)">
              <Trash2 :size="16" aria-hidden="true" />
            </IconButton>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">Sport</span>
              <select v-model="d.sport">
                <option v-for="[v, l] in TRAINING_SPORT_OPTIONS" :key="v" :value="v">{{ l }}</option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">Livello</span>
              <select v-model="d.level">
                <option v-for="[v, l] in LEVEL_OPTIONS" :key="v" :value="v">{{ l }}</option>
              </select>
            </label>
            <label class="field"><span class="field-label">Anni di pratica</span><input type="number" v-model.number="d.years_practice" /></label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">Volume settimanale attuale</span>
              <input type="number" v-model.number="d.current_weekly_volume!.value" />
            </label>
            <label class="field">
              <span class="field-label">Unità</span>
              <select v-model="d.current_weekly_volume!.unit">
                <option v-for="u in VOLUME_UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">Picco settimanale negli ultimi 12 mesi</span>
              <input type="number" v-model.number="d.peak_weekly_volume_last_12_months!.value" />
            </label>
            <label class="field">
              <span class="field-label">Unità</span>
              <select v-model="d.peak_weekly_volume_last_12_months!.unit">
                <option v-for="u in VOLUME_UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </label>
          </div>
        </div>
        <button type="button" class="add-row" @click="addDiscipline"><Plus :size="16" aria-hidden="true" />Aggiungi disciplina</button>
      </PageSection>

      <PageSection id="sec-soglie" title="Soglie e zone" :open="isOpen('sec-soglie')" :summary="thresholdsSummary(profile)"
        guide @toggle="toggle('sec-soglie')" @guide="openGuide('profilo-soglie')">
        <div class="segmented" role="group" aria-label="Disciplina delle soglie">
          <button
            v-for="[key, label] in THRESHOLD_SPORTS"
            :key="key"
            type="button"
            :aria-pressed="thresholdSport === key"
            @click="thresholdSport = key"
          >{{ label }}</button>
        </div>
        <div class="field-row">
          <label v-if="thresholdSport !== 'swimming'" class="field">
            <span class="field-label">Sistema di zone</span>
            <select v-model="zoneSystem">
              <option value="3-zone">3 zone</option>
              <option value="5-zone">5 zone</option>
              <option value="7-zone">7 zone</option>
            </select>
          </label>
          <label v-else class="field">
            <span class="field-label">Sistema di zone</span>
            <select disabled aria-describedby="swim-zone-note">
              <option>7 zone</option>
            </select>
            <span id="swim-zone-note" class="helper-text">Il nuoto usa sempre 7 zone.</span>
          </label>
        </div>
        <MetricLogList
          :key="thresholdSport"
          v-model="profile.physiological_thresholds![thresholdSport]!.thresholds_log as never"
          :field-defs="THRESHOLD_FIELDS[thresholdSport]"
        />
      </PageSection>

      <PageSection id="sec-stato" title="Stato di allenamento" :open="isOpen('sec-stato')" :summary="statusSummary(profile)"
        guide @toggle="toggle('sec-stato')" @guide="openGuide('profilo-stato')">
        <label class="checkbox-line">
          <input type="checkbox" v-model="profile.training_status!.detraining_period!.active" />
          In questo momento ha un calo degli allenamenti
        </label>
        <div class="field-row" v-if="profile.training_status!.detraining_period!.active">
          <label class="field"><span class="field-label">Durata (settimane)</span><input type="number" v-model.number="profile.training_status!.detraining_period!.duration_weeks" /></label>
          <label class="field">
            <span class="field-label">Causa</span>
            <select v-model="profile.training_status!.detraining_period!.cause">
              <option value="lavoro">Lavoro</option>
              <option value="infortunio">Infortunio</option>
              <option value="malattia">Malattia</option>
              <option value="viaggio">Viaggio</option>
              <option value="motivazionale">Motivazionale</option>
              <option value="altro">Altro</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Severità</span>
            <select v-model="profile.training_status!.detraining_period!.severity">
              <option value="stop_totale">Stop totale</option>
              <option value="forte_riduzione">Forte riduzione</option>
              <option value="lieve_riduzione">Lieve riduzione</option>
            </select>
          </label>
        </div>

        <h4 class="subsection-title">Fattori di vita</h4>
        <div class="checkbox-grid">
          <label v-for="[v, l] in LIFESTYLE_FACTOR_OPTIONS" :key="v" class="checkbox-line">
            <input
              type="checkbox"
              :checked="(profile.training_status!.lifestyle_factors || []).includes(v as never)"
              @change="toggleLifestyleFactor(v)"
            />
            {{ l }}
          </label>
        </div>
        <label class="field">
          <span class="field-label">Nota sui fattori di vita</span>
          <textarea v-model="profile.training_status!.lifestyle_factors_note"></textarea>
        </label>
      </PageSection>

      <PageSection id="sec-obiettivi" title="Obiettivi" :open="isOpen('sec-obiettivi')" :summary="goalsSummary(profile)"
        guide @toggle="toggle('sec-obiettivi')" @guide="openGuide('profilo-obiettivi')">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Obiettivo principale</span>
            <select v-model="profile.goals.primary_objective">
              <option v-for="[v, l] in OBJECTIVE_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
          </label>
          <label v-if="profile.goals.primary_objective === 'altro'" class="field">
            <span class="field-label">Dettaglio dell'obiettivo principale</span>
            <input type="text" v-model="profile.goals.primary_objective_detail" />
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Obiettivo secondario</span>
            <select v-model="profile.goals.secondary_objective">
              <option value="">Nessuno</option>
              <option v-for="[v, l] in secondaryOptions" :key="v" :value="v">{{ l }}</option>
            </select>
          </label>
          <label v-if="profile.goals.secondary_objective === 'altro'" class="field">
            <span class="field-label">Dettaglio dell'obiettivo secondario</span>
            <input type="text" v-model="profile.goals.secondary_objective_detail" />
          </label>
        </div>
        <p class="field-static">
          <span class="field-label">Periodizzazione</span>
          {{ PERIODIZATION_LABELS[profile.goals.periodization_model] || profile.goals.periodization_model }}
        </p>

        <template v-if="showTargetEvents">
          <h4 class="subsection-title">Eventi target</h4>
          <div v-for="(ev, i) in profile.goals.target_events" :key="i" class="unit">
            <div class="unit-head">
              <span class="unit-title">{{ ev.name || "Evento senza nome" }}</span>
              <IconButton :label="`Rimuovi ${ev.name || 'evento senza nome'}`" @click="removeTargetEvent(i)">
                <Trash2 :size="16" aria-hidden="true" />
              </IconButton>
            </div>
            <div class="field-row">
              <label class="field"><span class="field-label">Nome</span><input type="text" v-model="ev.name" /></label>
              <label class="field"><span class="field-label">Data</span><input type="date" v-model="ev.date" /></label>
              <label class="field">
                <span class="field-label">Disciplina</span>
                <select v-model="ev.discipline">
                  <option v-for="[v, l] in EVENT_DISCIPLINE_OPTIONS" :key="v" :value="v">{{ l }}</option>
                </select>
              </label>
            </div>
            <div class="field-row">
              <label class="field"><span class="field-label">Distanza o durata</span><input type="text" v-model="ev.distance_or_duration" /></label>
              <label class="field">
                <span class="field-label">Priorità</span>
                <select v-model="ev.priority">
                  <option v-for="p in EVENT_PRIORITIES" :key="p" :value="p">{{ p }}</option>
                </select>
              </label>
              <label class="field"><span class="field-label">Risultato target</span><input type="text" v-model="ev.target_result" /></label>
            </div>
            <div class="field-row">
              <label class="field">
                <span class="field-label">Settimane di tapering</span>
                <input type="number" min="0" max="4" step="1" :placeholder="`predefinito: ${DEFAULT_TAPER_WEEKS[ev.priority ?? 'C'] ?? 0}`"
                  :value="ev.taper_weeks ?? ''" @input="ev.taper_weeks = numOrNull(($event.target as HTMLInputElement).value) ?? undefined" />
              </label>
              <label class="field">
                <span class="field-label">Calo del volume nel tapering (%)</span>
                <input type="number" min="0" max="80" step="1" placeholder="lo decide Claude"
                  :value="ev.taper_volume_decrease_pct ?? ''" @input="ev.taper_volume_decrease_pct = numOrNull(($event.target as HTMLInputElement).value) ?? undefined" />
              </label>
            </div>
          </div>
          <button type="button" class="add-row" @click="addTargetEvent"><Plus :size="16" aria-hidden="true" />Aggiungi evento</button>
        </template>
      </PageSection>

      <PageSection id="sec-vincoli" title="Vincoli e disponibilità" :open="isOpen('sec-vincoli')" :summary="constraintsSummary(profile)"
        guide @toggle="toggle('sec-vincoli')" @guide="openGuide('profilo-vincoli')">
        <div v-for="day in profile.constraints.days_available" :key="day.day" class="day-row" :class="{ inactive: !day.active }">
          <span class="day-label">{{ DAY_LABELS.find(([k]) => k === day.day)?.[1] }}</span>
          <label class="checkbox-line"><input type="checkbox" v-model="day.active" /> Disponibile</label>
          <label class="field"><span class="field-label">Durata massima (min)</span><input type="number" v-model.number="day.max_duration_minutes" /></label>
          <label class="field"><span class="field-label">Attività abituale</span><input type="text" v-model="day.fixed_activity" /></label>
        </div>
        <div class="field-row">
          <label class="field"><span class="field-label">Sessioni a settimana (obiettivo)</span><input type="number" v-model.number="profile.constraints.sessions_per_week_target" /></label>
        </div>
      </PageSection>

      <PageSection id="sec-metodologia" title="Metodologia" :open="isOpen('sec-metodologia')" :summary="methodologySummary(profile)"
        :attention="!loadPattern" guide @toggle="toggle('sec-metodologia')" @guide="openGuide('profilo-metodologia')">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Distribuzione dell'intensità</span>
            <select v-model="profile.methodology_preferences.intensity_distribution_model">
              <option v-for="[v, l] in INTENSITY_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Settimane di carico</span>
            <select :value="loadPattern?.load ?? ''" @change="setLoadPattern('load', ($event.target as HTMLSelectElement).value)">
              <option v-if="!loadPattern" value="" disabled>Da scegliere</option>
              <option v-for="n in LOAD_WEEKS" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Settimane di scarico</span>
            <select :value="loadPattern?.deload ?? ''" @change="setLoadPattern('deload', ($event.target as HTMLSelectElement).value)">
              <option v-if="!loadPattern" value="" disabled>Da scegliere</option>
              <option v-for="n in DELOAD_WEEKS" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
        </div>
        <p v-if="!loadPattern" class="helper-text error-text">
          Lo schema salvato «{{ profile.methodology_preferences.load_deload_pattern || "vuoto" }}» non è riconosciuto: finché non scegli le settimane, il piano non avrà fasi di carico e scarico.
        </p>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Aumento fra settimane di carico (% minimo)</span>
            <input type="number" min="0" max="50" step="1" v-model.number="profile.methodology_preferences.load_increase_min_pct" placeholder="predefinito: 5" />
          </label>
          <label class="field">
            <span class="field-label">Aumento fra settimane di carico (% massimo)</span>
            <input type="number" min="0" max="50" step="1" v-model.number="profile.methodology_preferences.load_increase_max_pct" placeholder="predefinito: 10" />
          </label>
          <label class="field">
            <span class="field-label">Calo nella settimana di scarico (%)</span>
            <input type="number" min="5" max="80" step="1" v-model.number="profile.methodology_preferences.deload_decrease_pct" placeholder="predefinito: 33" />
          </label>
        </div>
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
