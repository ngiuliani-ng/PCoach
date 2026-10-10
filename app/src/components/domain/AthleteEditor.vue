<script setup lang="ts">
// Editor scheda atleta, diviso in tre viste (ADR 0016, ADR 0017):
// - Panoramica: cio' che il coach consulta ogni giorno (carico e forma, settimana in corso, feedback);
// - Piano: le sedute, settimana per settimana, con generazione, revisione e sincronizzazione;
// - Profilo: i dati dell'atleta che si compilano di rado (identita', discipline, soglie,
//   stato, obiettivi, vincoli, metodologia, note) e la gestione della scheda.
// L'header con nome, stato di salvataggio e "Salva" resta sticky in entrambe le viste.
import { computed, nextTick, ref, watch } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { useWorkoutsStore } from "../../stores/workouts";
import {
  TRAINING_SPORT_OPTIONS, LEVEL_OPTIONS, VOLUME_UNITS,
  OBJECTIVE_OPTIONS, SHARED_OBJECTIVE_OPTIONS, EVENT_DISCIPLINE_OPTIONS, EVENT_PRIORITIES,
  LIFESTYLE_FACTOR_OPTIONS, DAY_LABELS, RUN_THRESHOLD_FIELDS, BIKE_THRESHOLD_FIELDS, SWIM_THRESHOLD_FIELDS,
  PERIODIZATION_LABELS,
  fullName, formatDate, disciplineIcon, disciplineLabel, todayISO
} from "../../constants";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { showToast, showResultToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import MetricLogList from "./MetricLogList.vue";
import LoadMetricsChart from "./LoadMetricsChart.vue";
import PlanTab from "./PlanTab.vue";
import WorkoutRow from "./WorkoutRow.vue";
import PasswordField from "../ui/PasswordField.vue";
import IconButton from "../ui/IconButton.vue";
import { Download, Plus, Trash2 } from "lucide-vue-next";

const athletes = useAthletesStore();
const workouts = useWorkoutsStore();

const profile = computed(() => athletes.currentProfile!);

// ---------- Viste (Panoramica / Piano / Profilo) ----------
type Tab = "overview" | "plan" | "profile";
const TABS: [Tab, string][] = [["overview", "Panoramica"], ["plan", "Piano"], ["profile", "Profilo"]];
const tab = ref<Tab>("overview");
// Il primo salvataggio di una bozza assegna un id: non deve far cambiare vista.
let keepTabOnNextIdChange = false;
watch(
  () => athletes.currentId,
  (id) => {
    if (keepTabOnNextIdChange) {
      keepTabOnNextIdChange = false;
      return;
    }
    // Una bozza non ha ancora dati da consultare: si parte dal Profilo.
    tab.value = id ? "overview" : "profile";
  },
  { immediate: true }
);
function onTabKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  const i = TABS.findIndex(([key]) => key === tab.value);
  tab.value = TABS[(i + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0];
  nextTick(() => document.getElementById(`tab-${tab.value}`)?.focus());
}
async function goToSection(sectionId: string) {
  tab.value = "profile";
  await nextTick();
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
watch(
  () => profile.value.goals.primary_objective,
  (newVal) => {
    if (!profile.value) return;
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

// ---------- Soglie: una sezione, una disciplina alla volta ----------
type ThresholdSport = "running" | "cycling" | "swimming";
const THRESHOLD_SPORTS: [ThresholdSport, string][] = [["running", "Corsa"], ["cycling", "Bici"], ["swimming", "Nuoto"]];
const thresholdSport = ref<ThresholdSport>("running");

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

watch(
  () => profile.value.integrations?.intervals_icu_api_key,
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
// Le sedute vivono in tabelle proprie (ADR 0017): si caricano all'apertura della scheda.
watch(() => athletes.currentId, (id) => void workouts.load(id), { immediate: true });
const thisWeek = computed(() => {
  const start = weekStartISO(todayISO());
  const end = addDaysISO(start, 6);
  return workouts.workouts.filter((w) => w.planned_date >= start && w.planned_date <= end && (w.status === "draft" || w.status === "approved"));
});

// ---------- Feedback ----------
const feedbackShowAll = ref(false);
const FEEDBACK_VISIBLE_COUNT = 5;
const sortedFeedback = computed(() =>
  [...(profile.value.weekly_feedback_log || [])].sort((a, b) => b.date.localeCompare(a.date))
);
const visibleFeedback = computed(() =>
  feedbackShowAll.value ? sortedFeedback.value : sortedFeedback.value.slice(0, FEEDBACK_VISIBLE_COUNT)
);
const hasHiddenFeedback = computed(() => sortedFeedback.value.length > FEEDBACK_VISIBLE_COUNT);

// ---------- Azioni sulla scheda ----------
async function onSave() {
  if (athletes.currentId === null) keepTabOnNextIdChange = true;
  const result = await athletes.saveCurrent();
  if (!result.ok && athletes.currentId === null) keepTabOnNextIdChange = false;
  showResultToast(result);
}
async function onDelete() {
  if (!athletes.currentId) return;
  const confirmed = await confirmDialog(
    `Eliminare la scheda di "${fullName(profile.value.identity)}"? L'operazione non è reversibile.`,
    { confirmLabel: "Elimina scheda" }
  );
  if (!confirmed) return;
  showResultToast(await athletes.deleteAthlete(athletes.currentId));
}
function onExport() {
  athletes.exportCurrent();
}
</script>

<template>
  <div class="form-wrap" v-if="profile">
    <header class="page-header">
      <h2>{{ fullName(profile.identity) || "Nuovo atleta" }}</h2>
      <div class="page-header-actions">
        <span v-if="athletes.isDirty" class="unsaved-badge">Modifiche non salvate</span>
        <button type="button" class="primary" :disabled="!athletes.isDirty" @click="onSave">Salva</button>
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
      >{{ label }}</button>
    </div>

    <!-- ===================== Panoramica ===================== -->
    <div v-show="tab === 'overview'" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
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
          <button type="button" class="link-btn" @click="tab = 'plan'">Apri il piano</button>
        </p>
        <template v-else>
          <div class="week-unit">
            <WorkoutRow v-for="w in thisWeek" :key="w.id" :workout="w" :sync="workouts.syncRows[w.id]" show-date readonly @open="tab = 'plan'" />
          </div>
          <button type="button" class="link-btn overview-plan-link" @click="tab = 'plan'">Apri il piano</button>
        </template>
      </section>

      <section class="block">
        <h3>Feedback settimanale</h3>
        <p v-if="!sortedFeedback.length" class="helper-text">
          Nessun feedback finora. Il confronto tra piano e allenamenti svolti viene generato in automatico ogni settimana, nel giorno e all'ora scelti in Impostazioni.
        </p>
        <ul v-else class="feedback-list">
          <li v-for="f in visibleFeedback" :key="f.date" class="feedback-item">
            <p class="feedback-head">
              <time :datetime="f.date">{{ formatDate(f.date) }}</time>
              <span>{{ f.generated_by === "claude" ? "Generato da Claude" : "Inserito a mano" }}</span>
            </p>
            <p class="feedback-note">{{ f.note }}</p>
          </li>
        </ul>
        <button v-if="hasHiddenFeedback" type="button" class="link-btn" @click="feedbackShowAll = !feedbackShowAll">
          {{ feedbackShowAll ? "Mostra solo i più recenti" : `Mostra tutti (${sortedFeedback.length})` }}
        </button>
      </section>
    </div>

    <!-- ===================== Piano ===================== -->
    <div v-if="tab === 'plan'" id="panel-plan" role="tabpanel" aria-labelledby="tab-plan">
      <PlanTab v-if="athletes.currentId" @go-profile="goToSection" />
      <p v-else class="helper-text">Salva la scheda per pianificare le sedute.</p>
    </div>

    <!-- ===================== Profilo ===================== -->
    <div v-show="tab === 'profile'" id="panel-profile" role="tabpanel" aria-labelledby="tab-profile">
      <section class="block">
        <h3>Identità</h3>
        <div class="field-row">
          <label class="field"><span class="field-label">Nome</span><input type="text" v-model="profile.identity.nome" /></label>
          <label class="field"><span class="field-label">Cognome</span><input type="text" v-model="profile.identity.cognome" /></label>
          <label class="field"><span class="field-label">Email</span><input type="email" v-model="profile.identity.email" /></label>
        </div>
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
      </section>

      <section class="block" id="sec-intervals">
        <h3>Intervals.icu</h3>
        <div class="field">
          <label class="field-label" for="intervals-api-key">Chiave API di Intervals.icu</label>
          <PasswordField v-model="profile.integrations!.intervals_icu_api_key as string" input-id="intervals-api-key" />
        </div>
        <p v-if="intervalsStatusText" class="helper-text status-text" :class="{ 'error-text': intervalsKeyStatus === 'invalid' }">{{ intervalsStatusText }}</p>
        <p class="helper-text">Con la chiave, il carico di allenamento si aggiorna da solo quando la inserisci, quando apri la scheda e quando generi un piano, e le sedute approvate si possono inviare al calendario dell'atleta con «Sincronizza settimana».</p>
      </section>

      <section class="block">
        <h3>Discipline</h3>
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
          <p class="helper-text">Il volume di oggi, non quello storico: serve a capire da dove si riparte.</p>
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
          <p class="helper-text">Il volume massimo raggiunto: è il riferimento per la crescita del carico.</p>
        </div>
        <button type="button" class="add-row" @click="addDiscipline"><Plus :size="16" aria-hidden="true" />Aggiungi disciplina</button>
      </section>

      <section class="block">
        <h3>Soglie e zone fisiologiche</h3>
        <div class="segmented" role="group" aria-label="Disciplina delle soglie">
          <button
            v-for="[key, label] in THRESHOLD_SPORTS"
            :key="key"
            type="button"
            :aria-pressed="thresholdSport === key"
            @click="thresholdSport = key"
          >{{ label }}</button>
        </div>
        <template v-if="thresholdSport === 'running'">
          <div class="field-row">
            <label class="field">
              <span class="field-label">Sistema di zone</span>
              <select v-model="profile.physiological_thresholds!.running!.zone_system">
                <option value="3-zone">3 zone</option>
                <option value="5-zone">5 zone</option>
                <option value="7-zone">7 zone</option>
              </select>
            </label>
          </div>
          <MetricLogList v-model="profile.physiological_thresholds!.running!.thresholds_log as never" :field-defs="RUN_THRESHOLD_FIELDS" />
        </template>
        <template v-else-if="thresholdSport === 'cycling'">
          <div class="field-row">
            <label class="field">
              <span class="field-label">Sistema di zone</span>
              <select v-model="profile.physiological_thresholds!.cycling!.zone_system">
                <option value="3-zone">3 zone</option>
                <option value="5-zone">5 zone</option>
                <option value="7-zone">7 zone</option>
              </select>
            </label>
          </div>
          <MetricLogList v-model="profile.physiological_thresholds!.cycling!.thresholds_log as never" :field-defs="BIKE_THRESHOLD_FIELDS" />
        </template>
        <MetricLogList v-else v-model="profile.physiological_thresholds!.swimming!.thresholds_log as never" :field-defs="SWIM_THRESHOLD_FIELDS" />
      </section>

      <section class="block">
        <h3>Stato di allenamento</h3>
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
      </section>

      <section class="block">
        <h3>Obiettivi</h3>
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
        <p class="helper-text">Deriva dall'obiettivo principale: «Preparazione gara» porta a picco e scarico, gli altri obiettivi a un miglioramento continuo.</p>

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
          </div>
          <button type="button" class="add-row" @click="addTargetEvent"><Plus :size="16" aria-hidden="true" />Aggiungi evento</button>
        </template>
      </section>

      <section class="block">
        <h3>Vincoli e disponibilità</h3>
        <div v-for="day in profile.constraints.days_available" :key="day.day" class="day-row" :class="{ inactive: !day.active }">
          <span class="day-label">{{ DAY_LABELS.find(([k]) => k === day.day)?.[1] }}</span>
          <label class="checkbox-line"><input type="checkbox" v-model="day.active" /> Disponibile</label>
          <label class="field"><span class="field-label">Durata massima (min)</span><input type="number" v-model.number="day.max_duration_minutes" /></label>
          <label class="field"><span class="field-label">Attività già prevista</span><input type="text" v-model="day.fixed_activity" /></label>
        </div>
        <div class="field-row">
          <label class="field"><span class="field-label">Sessioni a settimana (obiettivo)</span><input type="number" v-model.number="profile.constraints.sessions_per_week_target" /></label>
        </div>
      </section>

      <section class="block">
        <h3>Metodologia</h3>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Distribuzione dell'intensità</span>
            <select v-model="profile.methodology_preferences.intensity_distribution_model">
              <option value="polarizzato_80_20">Polarizzato 80/20</option>
              <option value="piramidale">Piramidale</option>
              <option value="soglia_prevalente">Soglia prevalente</option>
              <option value="misto">Misto</option>
            </select>
          </label>
          <label class="field"><span class="field-label">Schema carico e scarico</span><input type="text" v-model="profile.methodology_preferences.load_deload_pattern" /></label>
        </div>
      </section>

      <section class="block">
        <h3>Note libere</h3>
        <textarea v-model="profile.notes_free_text" rows="4" aria-label="Note libere"></textarea>
      </section>

      <section class="block">
        <h3>Gestione scheda</h3>
        <div class="action-bar">
          <button type="button" class="secondary" @click="onExport"><Download :size="16" aria-hidden="true" />Esporta JSON</button>
          <button type="button" class="danger" v-if="athletes.currentId" @click="onDelete"><Trash2 :size="16" aria-hidden="true" />Elimina scheda</button>
        </div>
      </section>
    </div>
  </div>
</template>
