<script setup lang="ts">
// Pannello impostazioni: chiave/modello Claude, template dei prompt, feedback settimanale e
// soglie della sua analisi (ADR 0019).
import { computed } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { DEFAULT_FEEDBACK_PARAMS, validateFeedbackParams, type FeedbackParams } from "@shared/feedback/params.ts";
import { showResultToast } from "../../composables/useToast";
import { DAY_LABELS, DEFAULT_PLAN_PREFERENCES } from "../../constants";
import { SUPPORTED_MODELS } from "@shared/claude/models.ts";
import PasswordField from "../ui/PasswordField.vue";

const settings = useSettingsStore();
const paramErrors = computed(() => validateFeedbackParams(settings.settings.feedback_params));

type ParamField = [keyof FeedbackParams, string, string];
const MAIN_PARAMS: ParamField[] = [
  ["completed_min_pct", "Seduta svolta da (% della durata)", "%"],
  ["completed_max_pct", "Seduta svolta fino a (% della durata)", "%"],
  ["partial_min_pct", "Seduta svolta in parte da (% della durata)", "%"],
  ["deviation_minor_pct", "Scostamento di volume lieve da (%)", "%"],
  ["deviation_notable_pct", "Scostamento di volume rilevante da (%)", "%"]
];
const DATA_PARAMS: ParamField[] = [
  ["unknown_max_share_pct", "Sedute non valutabili oltre cui non si dà il tasso di completamento (%)", "%"],
  ["min_rpe_coverage_pct", "Attività con RPE per parlare della risposta dell'atleta (%)", "%"],
  ["min_wellness_days", "Giorni con dati di benessere per parlarne (su 7)", "gg"],
  ["min_distribution_minutes", "Minuti minimi per la distribuzione dell'intensità", "min"],
  ["low_zone_max", "Intensità bassa fino alla zona", "Z"],
  ["moderate_zone_max", "Intensità media fino alla zona", "Z"]
];
function resetParams() {
  settings.settings.feedback_params = { ...DEFAULT_FEEDBACK_PARAMS };
}

async function onSave() {
  showResultToast(await settings.save());
}
</script>

<template>
  <div class="form-wrap">
    <header class="page-header">
      <h2>Impostazioni</h2>
      <div class="page-header-actions">
        <button type="button" class="primary" @click="onSave">Salva impostazioni</button>
      </div>
    </header>
    <section class="block">
      <h3>Claude</h3>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="claude-api-key">{{ settings.hasClaudeKey ? "Nuova chiave API di Claude" : "Chiave API di Claude" }}</label>
          <PasswordField v-model="settings.settings.claude_api_key" input-id="claude-api-key" />
          <span class="helper-text">{{ settings.hasClaudeKey ? "Una chiave è già salvata: lascia vuoto per mantenerla." : "Nessuna chiave salvata." }}</span>
        </div>
        <label class="field">
          <span class="field-label">Modello</span>
          <select v-model="settings.settings.claude_model">
            <option v-for="m in SUPPORTED_MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
        </label>
      </div>
      <p class="helper-text">Solo modelli verificati con la generazione e con il feedback. Senza chiave, «Genera piano» copia il prompt negli appunti: puoi incollarlo in Claude a mano.</p>
    </section>
    <section class="block">
      <h3>Preferenze per generare il piano</h3>
      <textarea v-model="settings.settings.plan_generation_prompt_template" rows="6" aria-label="Preferenze per generare il piano"></textarea>
      <p class="helper-text">Come preferisci impostare le settimane: scarico, ripartenza del ciclo, uso del carico recente. Dati dell'atleta, calendario, disponibilità, fasi del ciclo e formato della risposta li aggiunge PCoach e non dipendono da questo testo. <span v-pre>{{nome_atleta}}</span> diventa il nome.</p>
      <button type="button" class="link-btn" @click="settings.settings.plan_generation_prompt_template = DEFAULT_PLAN_PREFERENCES">Ripristina le preferenze predefinite</button>
    </section>
    <section class="block">
      <h3>Tono del feedback settimanale</h3>
      <textarea v-model="settings.settings.weekly_feedback_prompt_template" rows="4" aria-label="Tono del feedback settimanale"></textarea>
      <p class="helper-text">Come scrivere all'atleta: tono, lunghezza, priorità. <span v-pre>{{nome_atleta}}</span> diventa il nome. Cosa il feedback può affermare lo decidono i dati calcolati da PCoach, non questo testo.</p>
    </section>
    <section class="block">
      <h3>Soglie del feedback</h3>
      <p class="helper-text">Regole pratiche, non valori fisiologici: decidono come PCoach classifica le sedute e gli scostamenti prima che Claude scriva il testo.</p>
      <div class="field-row">
        <label v-for="[key, label] in MAIN_PARAMS" :key="key" class="field">
          <span class="field-label">{{ label }}</span>
          <input type="number" step="1" v-model.number="settings.settings.feedback_params[key]" :aria-invalid="!!paramErrors[key]" />
          <span v-if="paramErrors[key]" class="error-text helper-text">{{ paramErrors[key] }}</span>
        </label>
      </div>
      <details class="review-sessions">
        <summary>Soglie sulla qualità dei dati</summary>
        <div class="field-row">
          <label v-for="[key, label] in DATA_PARAMS" :key="key" class="field">
            <span class="field-label">{{ label }}</span>
            <input type="number" step="1" v-model.number="settings.settings.feedback_params[key]" :aria-invalid="!!paramErrors[key]" />
            <span v-if="paramErrors[key]" class="error-text helper-text">{{ paramErrors[key] }}</span>
          </label>
        </div>
      </details>
      <button type="button" class="link-btn" @click="resetParams">Ripristina i valori predefiniti</button>
    </section>
    <section class="block">
      <h3>Feedback settimanale automatico</h3>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Giorno</span>
          <select v-model="settings.settings.weekly_feedback_day">
            <option v-for="[v, l] in DAY_LABELS" :key="v" :value="v">{{ l }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Ora</span>
          <input type="time" v-model="settings.settings.weekly_feedback_time" />
        </label>
        <label class="field">
          <span class="field-label">Fuso orario</span>
          <input type="text" v-model="settings.settings.weekly_feedback_timezone" class="mono-input" />
        </label>
      </div>
      <label class="checkbox-line">
        <input type="checkbox" v-model="settings.settings.weekly_feedback_email_enabled" />
        Invia via email all'atleta il feedback che approvi
      </label>
      <p class="helper-text">Nel giorno e all'ora indicati il server prepara il feedback della settimana appena conclusa (da lunedì a domenica). Lo trovi da rivedere nella Panoramica di ogni atleta: niente parte senza la tua approvazione.</p>
    </section>
  </div>
</template>
