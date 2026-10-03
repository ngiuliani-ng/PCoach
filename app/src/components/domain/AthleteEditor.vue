<script setup lang="ts">
// Editor scheda atleta: parità funzionale con il form del legacy index.html.
// Sezioni: Identità, Discipline, Soglie, Stato di allenamento, Obiettivi,
// Vincoli, Metodologia, Note, Piano assegnato, Feedback settimanale.
import { computed, ref, watch } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { useSettingsStore } from "../../stores/settings";
import {
  TRAINING_SPORT_OPTIONS, LEVEL_OPTIONS, VOLUME_UNITS,
  OBJECTIVE_OPTIONS, SHARED_OBJECTIVE_OPTIONS, EVENT_DISCIPLINE_OPTIONS, EVENT_PRIORITIES,
  LIFESTYLE_FACTOR_OPTIONS, DAY_LABELS, RUN_THRESHOLD_FIELDS, BIKE_THRESHOLD_FIELDS, SWIM_THRESHOLD_FIELDS,
  TRAINING_PLAN_JSON_SHAPE, todayISO, addDaysISO, fullName
} from "../../constants";
import { callClaudeProxy, extractJsonBlock, copyToClipboardFallback } from "../../services/claude";
import { fetchLastWeekActivities, plannedWeekFromPlan } from "../../services/intervals";
import { buildPlanPrompt, buildFeedbackPrompt } from "../../services/planPrompt";
import { showToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import MetricLogList from "./MetricLogList.vue";
import LoadMetricsChart from "./LoadMetricsChart.vue";
import PasswordField from "../ui/PasswordField.vue";

const athletes = useAthletesStore();
const settings = useSettingsStore();

const profile = computed(() => athletes.currentProfile!);

watch(
  () => profile.value.goals.primary_objective,
  (newVal, oldVal) => {
    if (!profile.value) return;
    profile.value.goals.periodization_model = newVal === "preparazione_gara" ? "race_peak_taper" : "continuous_improvement";
    if (newVal === "preparazione_gara" && (!profile.value.goals.target_events || profile.value.goals.target_events.length === 0)) {
      profile.value.goals.target_events = [{ name: "", date: "", discipline: "running", distance_or_duration: "", priority: "A", target_result: "" }];
    }
    if (profile.value.goals.secondary_objective === newVal) {
      profile.value.goals.secondary_objective = "";
    }
    void oldVal;
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

// Sincronizzazione Intervals.icu automatica (§7.2/§7.4): niente più pulsante manuale,
// la chiave attiva/aggiorna da sola in base ai trigger previsti (digitazione con
// debounce qui sotto, apertura scheda, pressione "Genera piano").
const intervalsSync = useIntervalsSync();
const intervalsSyncing = computed(() => intervalsSync.isSyncing(athletes.currentId));
const intervalsKeyStatus = computed(() => intervalsSync.statusFor(athletes.currentId));
const intervalsStatusText = computed(() => {
  if (intervalsSyncing.value) return "Sincronizzazione in corso…";
  const status = intervalsKeyStatus.value;
  if (status === "valid") return "API key valida.";
  if (status === "invalid") return "API key non valida.";
  if (status === "offline") return "Non verificabile al momento (rete non disponibile).";
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
      "Hai modifiche non salvate che andranno perse se ricarichi i dati più recenti. Continuare?"
    );
    if (!confirmed) return;
  }
  athletes.reloadCurrentFromRemote();
  showToast("Scheda aggiornata con i dati più recenti.");
}

const planWeeks = ref(8);
const generatingPlan = ref(false);
const planPreviewText = ref("");
const showPlanPreview = ref(false);

async function generatePlan() {
  await intervalsSync.syncNow(athletes.currentId, profile.value.integrations?.intervals_icu_api_key);
  const prompt = buildPlanPrompt(profile.value, planWeeks.value || 8, TRAINING_PLAN_JSON_SHAPE, settings.settings.plan_generation_prompt_template);
  if (!settings.settings.claude_api_key) {
    const copied = await copyToClipboardFallback(prompt);
    showToast(copied ? "Claude non configurato: prompt copiato negli appunti." : "Claude non configurato e copia negli appunti non riuscita.");
    return;
  }
  generatingPlan.value = true;
  const result = await callClaudeProxy(prompt, 8000, settings.settings.claude_model);
  generatingPlan.value = false;
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const parsed = extractJsonBlock(result.text);
  if (!parsed) {
    showToast("Risposta di Claude non interpretabile come JSON.");
    return;
  }
  planPreviewText.value = JSON.stringify(parsed, null, 2);
  showPlanPreview.value = true;
}
function confirmPlanPreview() {
  try {
    profile.value.training_plan = JSON.parse(planPreviewText.value);
    showPlanPreview.value = false;
  } catch {
    showToast("JSON non valido, correggi prima di confermare.");
  }
}
function discardPlanPreview() {
  showPlanPreview.value = false;
}

const comparingWeek = ref(false);
async function compareWeekWithPlan() {
  const apiKey = profile.value.integrations?.intervals_icu_api_key;
  if (!apiKey) {
    showToast("Inserisci prima la API key di Intervals.icu (sezione Connessione con app esterne).");
    return;
  }
  if (!profile.value.training_plan) {
    showToast("Genera prima un piano di allenamento.");
    return;
  }
  comparingWeek.value = true;
  const actRes = await fetchLastWeekActivities(apiKey);
  if (!actRes.ok) {
    comparingWeek.value = false;
    showToast(actRes.error);
    return;
  }
  const newest = todayISO();
  const oldest = addDaysISO(newest, -7);
  const plannedWeek = plannedWeekFromPlan(profile.value.training_plan, oldest, newest);
  const prompt = buildFeedbackPrompt(profile.value, plannedWeek, actRes.activities, settings.settings.weekly_feedback_prompt_template);
  if (!settings.settings.claude_api_key) {
    comparingWeek.value = false;
    const copied = await copyToClipboardFallback(prompt);
    showToast(copied ? "Claude non configurato: prompt copiato negli appunti." : "Claude non configurato e copia negli appunti non riuscita.");
    return;
  }
  const result = await callClaudeProxy(prompt, 1024, settings.settings.claude_model);
  comparingWeek.value = false;
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  profile.value.weekly_feedback_log = profile.value.weekly_feedback_log || [];
  profile.value.weekly_feedback_log.push({ date: newest, note: result.text, generated_by: "claude" });
  showToast("Feedback generato.");
}
function removeFeedback(i: number) {
  profile.value.weekly_feedback_log?.splice(i, 1);
}
const sortedFeedback = computed(() =>
  [...(profile.value.weekly_feedback_log || [])].sort((a, b) => b.date.localeCompare(a.date))
);

async function onSave() {
  const result = await athletes.saveCurrent();
  showToast(result.message);
}
async function onDelete() {
  if (!athletes.currentId) return;
  const confirmed = await confirmDialog(`Eliminare la scheda di "${fullName(profile.value.identity)}"? L'operazione non è reversibile.`);
  if (!confirmed) return;
  const result = await athletes.deleteAthlete(athletes.currentId);
  showToast(result.message);
}
function onExport() {
  athletes.exportCurrent();
}
</script>

<template>
  <div class="form-wrap" v-if="profile">
    <div class="form-header">
      <h2>{{ fullName(profile.identity) || "Nuovo atleta" }}</h2>
      <span v-if="profile.meta.athlete_id" class="athlete-id-tag">{{ profile.meta.athlete_id }}</span>
    </div>
    <p class="updated-line">Ultimo aggiornamento: {{ profile.meta.updated_at }}</p>
    <div v-if="athletes.isDirty || athletes.hasRemoteUpdate" class="sticky-bar">
      <span v-if="athletes.isDirty" class="unsaved-badge">Modifiche non salvate</span>
      <span v-if="athletes.hasRemoteUpdate" class="update-badge">
        Dati aggiornati disponibili —
        <button type="button" class="link-btn" @click="onReloadRemote">Aggiorna</button>
      </span>
    </div>

    <section class="block">
      <h3>Identità</h3>
      <div class="field-row">
        <div>
          <label>Nome</label>
          <input type="text" v-model="profile.identity.nome" />
        </div>
        <div>
          <label>Cognome</label>
          <input type="text" v-model="profile.identity.cognome" />
        </div>
        <div>
          <label>Email</label>
          <input type="email" v-model="profile.identity.email" />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Anno di nascita</label>
          <input type="number" v-model.number="profile.identity.birth_year" />
        </div>
        <div>
          <label>Sesso biologico</label>
          <select v-model="profile.identity.biological_sex">
            <option value="unspecified">Non specificato</option>
            <option value="male">Maschile</option>
            <option value="female">Femminile</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Altezza (cm)</label>
          <input type="number" v-model.number="profile.identity.height_cm" />
        </div>
        <div>
          <label>Peso (kg)</label>
          <input type="number" v-model.number="profile.identity.weight_kg" />
        </div>
      </div>
    </section>

    <section class="block">
      <h3>Connessione con app esterne</h3>
      <div class="field-row">
        <div>
          <label>API key Intervals.icu</label>
          <PasswordField v-model="profile.integrations!.intervals_icu_api_key as string" />
          <p v-if="intervalsStatusText" class="helper-text">{{ intervalsStatusText }}</p>
        </div>
      </div>
      <p class="helper-text">La sincronizzazione del carico di allenamento parte automaticamente quando inserisci o modifichi la chiave, quando apri la scheda e quando generi un piano.</p>
    </section>

    <section class="block">
      <h3>Discipline</h3>
      <div v-for="(d, i) in profile.disciplines" :key="i" class="discipline-card">
        <div class="discipline-card-head">
          <span>Disciplina {{ i + 1 }}</span>
          <button type="button" class="icon-btn" @click="removeDiscipline(i)">Rimuovi</button>
        </div>
        <div class="field-row">
          <div>
            <label>Sport</label>
            <select v-model="d.sport">
              <option v-for="[v, l] in TRAINING_SPORT_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
          </div>
          <div>
            <label>Livello</label>
            <select v-model="d.level">
              <option v-for="[v, l] in LEVEL_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
          </div>
          <div>
            <label>Anni di pratica</label>
            <input type="number" v-model.number="d.years_practice" />
          </div>
        </div>
        <div class="field-row">
          <div>
            <label>Volume settimanale attuale /settimana</label>
            <input type="number" v-model.number="d.current_weekly_volume!.value" />
          </div>
          <div>
            <label>Unità</label>
            <select v-model="d.current_weekly_volume!.unit">
              <option v-for="u in VOLUME_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
        <p class="helper-text">Volume reale attuale (non storico): serve a capire da dove si riparte.</p>
        <div class="field-row">
          <div>
            <label>Picco settimanale (ultimi 12 mesi) /settimana</label>
            <input type="number" v-model.number="d.peak_weekly_volume_last_12_months!.value" />
          </div>
          <div>
            <label>Unità</label>
            <select v-model="d.peak_weekly_volume_last_12_months!.unit">
              <option v-for="u in VOLUME_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
        <p class="helper-text">Volume massimo raggiunto negli ultimi 12 mesi: riferimento per il ramp-up.</p>
      </div>
      <button type="button" class="add-row" @click="addDiscipline">+ Aggiungi disciplina</button>
    </section>

    <section class="block">
      <h3>Soglie e zone fisiologiche — Corsa</h3>
      <div class="field-row">
        <div>
          <label>Sistema zone</label>
          <select v-model="profile.physiological_thresholds!.running!.zone_system">
            <option value="3-zone">3 zone</option>
            <option value="5-zone">5 zone</option>
            <option value="7-zone">7 zone</option>
          </select>
        </div>
      </div>
      <MetricLogList v-model="profile.physiological_thresholds!.running!.thresholds_log as never" :field-defs="RUN_THRESHOLD_FIELDS" />
    </section>

    <section class="block">
      <h3>Soglie e zone fisiologiche — Bici</h3>
      <div class="field-row">
        <div>
          <label>Sistema zone</label>
          <select v-model="profile.physiological_thresholds!.cycling!.zone_system">
            <option value="3-zone">3 zone</option>
            <option value="5-zone">5 zone</option>
            <option value="7-zone">7 zone</option>
          </select>
        </div>
      </div>
      <MetricLogList v-model="profile.physiological_thresholds!.cycling!.thresholds_log as never" :field-defs="BIKE_THRESHOLD_FIELDS" />
    </section>

    <section class="block">
      <h3>Soglie e zone fisiologiche — Nuoto</h3>
      <MetricLogList v-model="profile.physiological_thresholds!.swimming!.thresholds_log as never" :field-defs="SWIM_THRESHOLD_FIELDS" />
    </section>

    <section class="block">
      <h3>Stato di allenamento attuale</h3>
      <div class="checkbox-line" style="margin-bottom: 12px">
        <input type="checkbox" id="detrain-active" v-model="profile.training_status!.detraining_period!.active" />
        <label for="detrain-active" style="margin: 0">In questo momento sta vivendo un calo di allenamenti</label>
      </div>
      <div class="field-row" v-if="profile.training_status!.detraining_period!.active">
        <div>
          <label>Durata (settimane)</label>
          <input type="number" v-model.number="profile.training_status!.detraining_period!.duration_weeks" />
        </div>
        <div>
          <label>Causa</label>
          <select v-model="profile.training_status!.detraining_period!.cause">
            <option value="lavoro">Lavoro</option>
            <option value="infortunio">Infortunio</option>
            <option value="malattia">Malattia</option>
            <option value="viaggio">Viaggio</option>
            <option value="motivazionale">Motivazionale</option>
            <option value="altro">Altro</option>
          </select>
        </div>
        <div>
          <label>Severità</label>
          <select v-model="profile.training_status!.detraining_period!.severity">
            <option value="stop_totale">Stop totale</option>
            <option value="forte_riduzione">Forte riduzione</option>
            <option value="lieve_riduzione">Lieve riduzione</option>
          </select>
        </div>
      </div>

      <div class="subsection-title">Carico (CTL/ATL/TSB)</div>
      <LoadMetricsChart :log="profile.training_status!.load_metrics_log as never" />

      <div class="subsection-title">Fattori di vita</div>
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
      <div class="field-row">
        <div style="grid-column: 1 / -1">
          <label>Nota fattori di vita</label>
          <textarea v-model="profile.training_status!.lifestyle_factors_note"></textarea>
        </div>
      </div>
    </section>

    <section class="block">
      <h3>Obiettivi</h3>
      <div class="field-row">
        <div>
          <label>Obiettivo principale</label>
          <select v-model="profile.goals.primary_objective">
            <option v-for="[v, l] in OBJECTIVE_OPTIONS" :key="v" :value="v">{{ l }}</option>
          </select>
        </div>
        <div v-if="profile.goals.primary_objective === 'altro'">
          <label>Dettaglio obiettivo principale</label>
          <input type="text" v-model="profile.goals.primary_objective_detail" />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Obiettivo secondario</label>
          <select v-model="profile.goals.secondary_objective">
            <option value="">Nessuno</option>
            <option v-for="[v, l] in secondaryOptions" :key="v" :value="v">{{ l }}</option>
          </select>
        </div>
        <div v-if="profile.goals.secondary_objective === 'altro'">
          <label>Dettaglio obiettivo secondario</label>
          <input type="text" v-model="profile.goals.secondary_objective_detail" />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Modello di periodizzazione</label>
          <input type="text" :value="profile.goals.periodization_model" readonly />
        </div>
      </div>

      <template v-if="showTargetEvents">
        <div class="subsection-title">Eventi target</div>
        <div v-for="(ev, i) in profile.goals.target_events" :key="i" class="discipline-card">
          <div class="discipline-card-head">
            <span>Evento {{ i + 1 }}</span>
            <button type="button" class="icon-btn" @click="removeTargetEvent(i)">Rimuovi</button>
          </div>
          <div class="field-row">
            <div>
              <label>Nome</label>
              <input type="text" v-model="ev.name" />
            </div>
            <div>
              <label>Data</label>
              <input type="date" v-model="ev.date" />
            </div>
            <div>
              <label>Disciplina</label>
              <select v-model="ev.discipline">
                <option v-for="[v, l] in EVENT_DISCIPLINE_OPTIONS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div>
              <label>Distanza/durata</label>
              <input type="text" v-model="ev.distance_or_duration" />
            </div>
            <div>
              <label>Priorità</label>
              <select v-model="ev.priority">
                <option v-for="p in EVENT_PRIORITIES" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label>Risultato target</label>
              <input type="text" v-model="ev.target_result" />
            </div>
          </div>
        </div>
        <button type="button" class="add-row" @click="addTargetEvent">+ Aggiungi evento</button>
      </template>
    </section>

    <section class="block">
      <h3>Vincoli e disponibilità</h3>
      <div v-for="day in profile.constraints.days_available" :key="day.day" class="day-row">
        <label class="day-label">{{ DAY_LABELS.find(([k]) => k === day.day)?.[1] }}</label>
        <label class="checkbox-line"><input type="checkbox" v-model="day.active" /> Disponibile</label>
        <div>
          <label>Durata max (min)</label>
          <input type="number" v-model.number="day.max_duration_minutes" />
        </div>
        <div>
          <label>Attività attualmente prevista</label>
          <input type="text" v-model="day.fixed_activity" />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Sessioni/settimana target</label>
          <input type="number" v-model.number="profile.constraints.sessions_per_week_target" />
        </div>
      </div>
    </section>

    <section class="block">
      <h3>Metodologia</h3>
      <div class="field-row">
        <div>
          <label>Modello distribuzione intensità</label>
          <select v-model="profile.methodology_preferences.intensity_distribution_model">
            <option value="polarizzato_80_20">Polarizzato 80/20</option>
            <option value="piramidale">Piramidale</option>
            <option value="soglia_prevalente">Soglia prevalente</option>
            <option value="misto">Misto</option>
          </select>
        </div>
        <div>
          <label>Schema carico/scarico</label>
          <input type="text" v-model="profile.methodology_preferences.load_deload_pattern" />
        </div>
      </div>
    </section>

    <section class="block">
      <h3>Note libere</h3>
      <textarea v-model="profile.notes_free_text" rows="4"></textarea>
    </section>

    <section class="block">
      <h3>Piano assegnato</h3>
      <p v-if="profile.training_plan">{{ profile.training_plan.plan_name || "Piano senza nome" }} — {{ profile.training_plan.weeks?.length || 0 }} settimane</p>
      <p v-else class="helper-text">Nessun piano generato.</p>
      <div class="field-row">
        <div>
          <label>Settimane da generare</label>
          <input type="number" v-model.number="planWeeks" />
        </div>
      </div>
      <button type="button" class="primary" :disabled="generatingPlan" @click="generatePlan">
        {{ generatingPlan ? "Generazione in corso…" : "Genera piano" }}
      </button>
      <div v-if="showPlanPreview" style="margin-top: 12px">
        <label>Anteprima piano (JSON)</label>
        <textarea v-model="planPreviewText" rows="10" class="mono-input"></textarea>
        <div class="action-bar">
          <button type="button" class="primary" @click="confirmPlanPreview">Conferma piano</button>
          <button type="button" class="ghost" @click="discardPlanPreview">Scarta</button>
        </div>
      </div>
    </section>

    <section class="block">
      <h3>Feedback settimanale</h3>
      <button type="button" class="secondary" :disabled="comparingWeek" @click="compareWeekWithPlan">
        {{ comparingWeek ? "Confronto in corso…" : "Confronta settimana con il piano" }}
      </button>
      <div v-for="(f, i) in sortedFeedback" :key="i" class="discipline-card" style="margin-top: 10px">
        <div class="discipline-card-head">
          <span>{{ f.date }} · {{ f.generated_by === "claude" ? "Claude" : "Manuale" }}</span>
          <button type="button" class="icon-btn" @click="removeFeedback(profile.weekly_feedback_log!.indexOf(f))">Rimuovi</button>
        </div>
        <p style="margin: 0; white-space: pre-wrap">{{ f.note }}</p>
      </div>
    </section>

    <div class="action-bar">
      <button type="button" class="primary" :disabled="!athletes.isDirty" @click="onSave">Salva</button>
      <button type="button" class="secondary" @click="onExport">Esporta JSON</button>
      <button type="button" class="danger" v-if="athletes.currentId" @click="onDelete">Elimina</button>
    </div>
  </div>
</template>
