<script setup lang="ts">
// Pannello impostazioni: chiave/modello Claude e template prompt (piano + feedback).
import { useSettingsStore } from "../../stores/settings";
import { showResultToast } from "../../composables/useToast";
import { DAY_LABELS } from "../../constants";
import PasswordField from "../ui/PasswordField.vue";

const settings = useSettingsStore();

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
          <label class="field-label" for="claude-api-key">Chiave API di Claude</label>
          <PasswordField v-model="settings.settings.claude_api_key" input-id="claude-api-key" />
        </div>
        <label class="field">
          <span class="field-label">Modello</span>
          <input type="text" v-model="settings.settings.claude_model" class="mono-input" />
        </label>
      </div>
      <p class="helper-text">Senza chiave, «Genera piano» copia il prompt negli appunti: puoi incollarlo in Claude a mano.</p>
    </section>
    <section class="block">
      <h3>Prompt per generare il piano</h3>
      <textarea v-model="settings.settings.plan_generation_prompt_template" rows="8" aria-label="Prompt per generare il piano"></textarea>
    </section>
    <section class="block">
      <h3>Prompt per il feedback settimanale</h3>
      <textarea v-model="settings.settings.weekly_feedback_prompt_template" rows="6" aria-label="Prompt per il feedback settimanale"></textarea>
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
        Invia il feedback anche via email all'atleta
      </label>
      <p class="helper-text">Il feedback viene generato dal server ogni settimana, nel giorno e all'ora indicati. Puoi cambiarli qui in qualsiasi momento.</p>
    </section>
  </div>
</template>
