<script setup lang="ts">
// Impostazioni (decisioni del coach D-02, D-04): due gruppi d'uso comune, Claude e generazione e
// Feedback settimanale, poi «Avanzate» con le regole che cambiano i calcoli per tutti gli atleti.
// Ogni gruppo e' una sezione comprimibile con riepilogo e guida (icona Info).
import { computed, nextTick, ref, watch } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { DEFAULT_FEEDBACK_PARAMS, validateFeedbackParams, type FeedbackParams } from "@shared/feedback/params.ts";
import { showResultToast, showToast } from "../../composables/useToast";
import { useRoute } from "vue-router";
import { supabaseUrl } from "../../services/supabase";
import { APP_BUILD_DATE, APP_COMMIT, APP_ENVIRONMENT, APP_VERSION, reportLine } from "../../version";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { saveSettings } from "../../composables/useSettingsSave";
import { useSections, scrollToSection } from "../../composables/useSections";
import { useQueryLayer } from "../../composables/useQueryLayer";
import { DEFAULT_PLAN_PREFERENCES, formatDate } from "../../constants";
import { SUPPORTED_MODELS } from "@shared/claude/models.ts";
import { isValidTimeZone } from "@shared/feedback/period.ts";
import { ZONE_COUNTS } from "@shared/workouts/zones.ts";
import { defaultZoneModels } from "@shared/workouts/zoneModels.ts";
import { isGuideKey, type GuideKey } from "../../help/guide";
import PasswordField from "../ui/PasswordField.vue";
import PageSection from "../ui/PageSection.vue";
import SaveStatus from "../ui/SaveStatus.vue";
import SectionNav from "../ui/SectionNav.vue";
import GuidePanel from "../ui/GuidePanel.vue";
import ZoneModelsEditor from "./ZoneModelsEditor.vue";

const settings = useSettingsStore();
const paramErrors = computed(() => validateFeedbackParams(settings.settings.feedback_params));

type ParamField = [keyof FeedbackParams, string];
const MAIN_PARAMS: ParamField[] = [
  ["completed_min_pct", "Seduta svolta da (% della durata)"],
  ["completed_max_pct", "Seduta svolta fino a (% della durata)"],
  ["partial_min_pct", "Seduta svolta in parte da (% della durata)"],
  ["deviation_minor_pct", "Scostamento di volume lieve da (%)"],
  ["deviation_notable_pct", "Scostamento di volume rilevante da (%)"]
];
const DATA_PARAMS: ParamField[] = [
  ["unknown_max_share_pct", "Sedute non valutabili oltre cui non si dà il tasso di completamento (%)"],
  ["min_rpe_coverage_pct", "Attività con RPE per parlare della risposta dell'atleta (%)"],
  ["min_wellness_days", "Giorni con dati di benessere per parlarne (su 7)"],
  ["min_distribution_minutes", "Minuti minimi per la distribuzione dell'intensità"]
];
// Domini d'intensita' per sistema di zone (ADR 0028): una riga per sistema, in tabella.
const ZONE_PARAMS = ZONE_COUNTS.map((n) => ({
  zones: n,
  low: `z${n}_low_max` as keyof FeedbackParams,
  moderate: `z${n}_moderate_max` as keyof FeedbackParams
}));
const CLASSIFICATION_KEYS = [...MAIN_PARAMS, ...DATA_PARAMS].map(([k]) => k);
const INTENSITY_KEYS = ZONE_PARAMS.flatMap((r) => [r.low, r.moderate]);

// Il feedback parte sempre il lunedi', per la settimana appena conclusa (decisione D-11): si sceglie solo l'ora.
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
// Fusi riconosciuti dal browser (gli stessi di Intl sul server): un valore scritto a mano e sbagliato
// fermerebbe il feedback automatico. Un valore salvato non valido resta visibile, segnalato.
const ZONES: string[] = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? ["Europe/Rome"];
const tzValid = computed(() => isValidTimeZone(settings.settings.weekly_feedback_timezone));
const tzOptions = computed(() => (ZONES.includes(settings.settings.weekly_feedback_timezone) ? ZONES : [settings.settings.weekly_feedback_timezone, ...ZONES]));

// ---------- Sezioni, riepiloghi e guida ----------
const SECTIONS = [
  { id: "imp-claude", title: "Claude e generazione" },
  { id: "imp-feedback", title: "Feedback settimanale" },
  { id: "imp-classificazione", title: "Classificazione delle sedute" },
  { id: "imp-intensita", title: "Intensità per sistema di zone" },
  { id: "imp-modelli", title: "Modelli di zone" },
  { id: "imp-info", title: "Informazioni" }
];
// Sezioni sempre chiuse all'arrivo (scelta del coach): i riepiloghi dicono cosa c'e' dentro.
const sections = useSections();
const go = (id: string) => scrollToSection(id, sections.reveal, nextTick);
// Link a una sezione (?sezione=…, ad esempio la versione nella barra laterale).
const route = useRoute();
watch(() => route.query.sezione, (id) => {
  if (typeof id === "string" && SECTIONS.some((s) => s.id === id)) void go(id);
}, { immediate: true });

// ---------- Informazioni (ADR 0036): versione, build, server ----------
const buildDate = formatDate(APP_BUILD_DATE.slice(0, 10));
const serverVersion = ref<string | null>(null);
const serverChecked = ref(false);
// La versione delle funzioni arriva nell'intestazione della risposta a una richiesta OPTIONS: nessun dato,
// nessuna chiave. Si legge solo quando la sezione e' aperta.
async function loadServerVersion() {
  if (serverChecked.value || !supabaseUrl) return;
  serverChecked.value = true;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/weekly-feedback`, { method: "OPTIONS" });
    serverVersion.value = res.headers.get("x-pcoach-version");
  } catch {
    serverVersion.value = null;
  }
}
watch(() => sections.isOpen("imp-info"), (open) => open && void loadServerVersion(), { immediate: true });
const infoSummary = computed(() => `Versione ${APP_VERSION}, build ${APP_COMMIT} del ${buildDate}`);
async function copyReport() {
  const text = reportLine(undefined, serverVersion.value);
  try {
    await navigator.clipboard.writeText(text);
    showToast("Informazioni copiate: incollale nella segnalazione.");
  } catch {
    showToast(`Copia non riuscita. Copia a mano: ${text}`, "error");
  }
}
const guideLayer = useQueryLayer("guida");
const guideKey = computed(() => (isGuideKey(guideLayer.value.value) ? guideLayer.value.value : null));
const openGuide = (key: GuideKey) => guideLayer.open(key);

const modelLabel = computed(() => SUPPORTED_MODELS.find((m) => m.id === settings.settings.claude_model)?.label ?? settings.settings.claude_model);
const claudeSummary = computed(() => `${settings.hasClaudeKey ? "Chiave salvata" : "Nessuna chiave: la generazione copia il prompt"}; ${modelLabel.value}`);
const feedbackSummary = computed(() =>
  `Lunedì alle ${settings.settings.weekly_feedback_time} (${settings.settings.weekly_feedback_timezone}); email ${settings.settings.weekly_feedback_email_enabled ? "attiva" : "disattivata"}`
);
function customText(n: number, singular: string, plural: string) {
  return n === 0 ? "Valori predefiniti" : `${n} ${n === 1 ? singular : plural}`;
}
const customParams = (keys: (keyof FeedbackParams)[]) => keys.filter((k) => settings.settings.feedback_params[k] !== DEFAULT_FEEDBACK_PARAMS[k]).length;
const classificationSummary = computed(() => customText(customParams(CLASSIFICATION_KEYS), "valore personalizzato", "valori personalizzati"));
const intensitySummary = computed(() => customText(customParams(INTENSITY_KEYS), "valore personalizzato", "valori personalizzati"));
const customModels = computed(() => {
  const defaults = defaultZoneModels();
  let n = 0;
  for (const [key, byCount] of Object.entries(settings.settings.zone_models)) {
    for (const [count, m] of Object.entries(byCount)) {
      const d = (defaults as Record<string, Record<string, { preset: string; bounds: number[] }>>)[key]?.[count];
      if (m && d && (m.preset !== d.preset || m.bounds.join() !== d.bounds.join())) n++;
    }
  }
  return n;
});
const modelsSummary = computed(() => (customModels.value ? `${customModels.value} ${customModels.value === 1 ? "modello diverso" : "modelli diversi"} dai predefiniti` : "Modelli predefiniti"));

// ---------- Ripristini: stessa regola per tutti (audit UX-42) ----------
// Si chiede conferma solo se ci sono valori personalizzati da perdere; nulla si salva senza «Salva impostazioni».
async function confirmReset(message: string, label: string): Promise<boolean> {
  return confirmDialog(message, { confirmLabel: label, cancelLabel: "Mantieni i miei" });
}
async function resetPreferences() {
  const current = settings.settings.plan_generation_prompt_template.trim();
  if (current && current !== DEFAULT_PLAN_PREFERENCES.trim() && !(await confirmReset("Sostituire le tue preferenze con quelle predefinite?", "Ripristina le predefinite"))) return;
  settings.settings.plan_generation_prompt_template = DEFAULT_PLAN_PREFERENCES;
}
async function resetParams(keys: (keyof FeedbackParams)[], what: string) {
  if (customParams(keys) && !(await confirmReset(`Riportare ai valori predefiniti ${what}?`, "Ripristina i predefiniti"))) return;
  for (const k of keys) settings.settings.feedback_params[k] = DEFAULT_FEEDBACK_PARAMS[k];
}
async function resetModels() {
  if (customModels.value && !(await confirmReset("Riportare tutti i modelli di zone ai predefiniti?", "Ripristina i predefiniti"))) return;
  settings.settings.zone_models = defaultZoneModels();
}

// Una sezione con un valore da correggere si apre da sola (poi si puo' richiudere).
watch(() => CLASSIFICATION_KEYS.some((k) => paramErrors.value[k]), (bad) => bad && sections.reveal("imp-classificazione"), { immediate: true });
watch(() => INTENSITY_KEYS.some((k) => paramErrors.value[k]), (bad) => bad && sections.reveal("imp-intensita"), { immediate: true });
watch(() => !tzValid.value, (bad) => bad && sections.reveal("imp-feedback"), { immediate: true });

async function onSave() {
  const result = await saveSettings();
  if (!result.cancelled) showResultToast(result);
}
</script>

<template>
  <div class="form-wrap">
    <header class="page-header">
      <h1>Impostazioni</h1>
      <div class="page-header-actions">
        <SaveStatus v-if="settings.isDirty" state="unsaved" text="Modifiche non salvate" />
        <SaveStatus v-else state="saved" text="Impostazioni salvate" />
        <!-- Su telefono il pulsante dice solo «Salva», cosi' il titolo resta leggibile. -->
        <button type="button" class="primary" :disabled="!settings.isDirty" aria-label="Salva impostazioni" @click="onSave">
          <span class="label-long">Salva impostazioni</span><span class="label-short" aria-hidden="true">Salva</span>
        </button>
      </div>
    </header>
    <SectionNav :sections="SECTIONS" @go="go" />

    <PageSection id="imp-claude" title="Claude e generazione" :open="sections.isOpen('imp-claude')" :summary="claudeSummary"
      guide @toggle="sections.toggle('imp-claude')" @guide="openGuide('impostazioni-claude')">
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="claude-api-key">{{ settings.hasClaudeKey ? "Nuova chiave API di Claude" : "Chiave API di Claude" }}</label>
          <PasswordField v-model="settings.settings.claude_api_key" input-id="claude-api-key" described-by="claude-key-note" />
          <span id="claude-key-note" class="helper-text">{{ settings.hasClaudeKey ? "Una chiave è già salvata: lascia vuoto per mantenerla." : "Nessuna chiave salvata." }}</span>
        </div>
        <label class="field">
          <span class="field-label">Modello</span>
          <select v-model="settings.settings.claude_model">
            <option v-for="m in SUPPORTED_MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">Preferenze per generare il piano</span>
        <textarea v-model="settings.settings.plan_generation_prompt_template" rows="6"></textarea>
      </label>
      <button type="button" class="link-btn" @click="resetPreferences">Ripristina le preferenze predefinite</button>
    </PageSection>

    <PageSection id="imp-feedback" title="Feedback settimanale" :open="sections.isOpen('imp-feedback')" :summary="feedbackSummary"
      :attention="!tzValid" guide @toggle="sections.toggle('imp-feedback')" @guide="openGuide('impostazioni-feedback')">
      <div class="field-row">
        <label class="field">
          <span class="field-label">Ora del lunedì</span>
          <select v-model="settings.settings.weekly_feedback_time">
            <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Fuso orario</span>
          <select v-model="settings.settings.weekly_feedback_timezone" :aria-invalid="!tzValid">
            <option v-for="z in tzOptions" :key="z" :value="z">{{ z }}</option>
          </select>
          <span v-if="!tzValid" class="error-text helper-text">Fuso non riconosciuto: il feedback usa Europe/Rome finché non ne scegli uno dall'elenco.</span>
        </label>
      </div>
      <label class="checkbox-line">
        <input type="checkbox" v-model="settings.settings.weekly_feedback_email_enabled" />
        Invia via email all'atleta il feedback che approvi
      </label>
      <label class="field">
        <span class="field-label">Tono del feedback</span>
        <textarea v-model="settings.settings.weekly_feedback_prompt_template" rows="4"></textarea>
      </label>
    </PageSection>

    <div class="advanced-head">
      <h2>Avanzate</h2>
      <p class="helper-text">Regole che cambiano i calcoli per tutti gli atleti. Di solito i valori predefiniti vanno bene.</p>
    </div>

    <PageSection id="imp-classificazione" title="Classificazione delle sedute" :open="sections.isOpen('imp-classificazione')"
      :summary="classificationSummary" :attention="CLASSIFICATION_KEYS.some((k) => paramErrors[k])" guide
      @toggle="sections.toggle('imp-classificazione')" @guide="openGuide('impostazioni-classificazione')">
      <div class="field-row">
        <label v-for="[key, label] in MAIN_PARAMS" :key="key" class="field">
          <span class="field-label">{{ label }}</span>
          <input type="number" step="1" v-model.number="settings.settings.feedback_params[key]" :aria-invalid="!!paramErrors[key]" />
          <span v-if="paramErrors[key]" class="error-text helper-text">{{ paramErrors[key] }}</span>
        </label>
      </div>
      <h4 class="subsection-title">Qualità dei dati</h4>
      <div class="field-row">
        <label v-for="[key, label] in DATA_PARAMS" :key="key" class="field">
          <span class="field-label">{{ label }}</span>
          <input type="number" step="1" v-model.number="settings.settings.feedback_params[key]" :aria-invalid="!!paramErrors[key]" />
          <span v-if="paramErrors[key]" class="error-text helper-text">{{ paramErrors[key] }}</span>
        </label>
      </div>
      <button type="button" class="link-btn" @click="resetParams(CLASSIFICATION_KEYS, 'le soglie di classificazione e di qualità dei dati')">Ripristina le soglie predefinite</button>
    </PageSection>

    <PageSection id="imp-intensita" title="Intensità per sistema di zone" :open="sections.isOpen('imp-intensita')"
      :summary="intensitySummary" :attention="INTENSITY_KEYS.some((k) => paramErrors[k])" guide
      @toggle="sections.toggle('imp-intensita')" @guide="openGuide('impostazioni-intensita')">
      <table class="intensity-table">
        <thead>
          <tr><th scope="col">Sistema</th><th scope="col" id="int-low">Bassa fino alla zona</th><th scope="col" id="int-mod">Media fino alla zona</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in ZONE_PARAMS" :key="row.zones">
            <th scope="row" :id="`int-${row.zones}`">{{ row.zones }} zone</th>
            <td>
              <input type="number" step="1" min="1" :max="row.zones" v-model.number="settings.settings.feedback_params[row.low]"
                :aria-labelledby="`int-${row.zones} int-low`" :aria-invalid="!!paramErrors[row.low]" />
              <span v-if="paramErrors[row.low]" class="error-text helper-text">{{ paramErrors[row.low] }}</span>
            </td>
            <td>
              <input type="number" step="1" min="1" :max="row.zones" v-model.number="settings.settings.feedback_params[row.moderate]"
                :aria-labelledby="`int-${row.zones} int-mod`" :aria-invalid="!!paramErrors[row.moderate]" />
              <span v-if="paramErrors[row.moderate]" class="error-text helper-text">{{ paramErrors[row.moderate] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="link-btn" @click="resetParams(INTENSITY_KEYS, 'le fasce d\'intensità')">Ripristina le fasce predefinite</button>
    </PageSection>

    <PageSection id="imp-modelli" title="Modelli di zone" :open="sections.isOpen('imp-modelli')" :summary="modelsSummary"
      guide @toggle="sections.toggle('imp-modelli')" @guide="openGuide('impostazioni-modelli')">
      <ZoneModelsEditor />
      <button type="button" class="link-btn" @click="resetModels">Ripristina i modelli predefiniti</button>
    </PageSection>

    <PageSection id="imp-info" title="Informazioni" :open="sections.isOpen('imp-info')" :summary="infoSummary" @toggle="sections.toggle('imp-info')">
      <dl class="app-info">
        <dt>Versione</dt><dd>{{ APP_VERSION }}<template v-if="APP_ENVIRONMENT"> ({{ APP_ENVIRONMENT }})</template></dd>
        <dt>Build</dt><dd><span class="mono">{{ APP_COMMIT }}</span> del {{ buildDate }}</dd>
        <dt>Server</dt>
        <dd>
          <template v-if="serverVersion">{{ serverVersion }}<template v-if="serverVersion !== APP_VERSION"> (diversa dall'app)</template></template>
          <template v-else-if="serverChecked">non disponibile</template>
          <template v-else>…</template>
        </dd>
      </dl>
      <button type="button" class="secondary" @click="copyReport">Copia per una segnalazione</button>
    </PageSection>

    <GuidePanel v-if="guideKey" :key="guideKey" :guide-key="guideKey" @close="guideLayer.close()" />
  </div>
</template>
