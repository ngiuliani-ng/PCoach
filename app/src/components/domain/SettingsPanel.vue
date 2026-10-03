<script setup lang="ts">
// Pannello impostazioni: chiave/modello Claude e template prompt (piano + feedback).
import { useSettingsStore } from "../../stores/settings";
import { showToast } from "../../composables/useToast";

const settings = useSettingsStore();

async function onSave() {
  const result = await settings.save();
  showToast(result.message);
}
</script>

<template>
  <div class="form-wrap">
    <div class="form-header">
      <h2>Impostazioni</h2>
    </div>
    <section class="block">
      <h3>Integrazione Claude</h3>
      <div class="field-row">
        <div>
          <label>Claude API key</label>
          <input type="password" v-model="settings.settings.claude_api_key" class="mono-input" />
        </div>
        <div>
          <label>Modello</label>
          <input type="text" v-model="settings.settings.claude_model" class="mono-input" />
        </div>
      </div>
      <p class="helper-text">Se la chiave non è configurata, la generazione di piano/feedback userà il flusso con copia negli appunti.</p>
    </section>
    <section class="block">
      <h3>Prompt generazione piano</h3>
      <textarea v-model="settings.settings.plan_generation_prompt_template" rows="8"></textarea>
    </section>
    <section class="block">
      <h3>Prompt feedback settimanale</h3>
      <textarea v-model="settings.settings.weekly_feedback_prompt_template" rows="6"></textarea>
    </section>
    <div class="action-bar">
      <button type="button" class="primary" @click="onSave">Salva impostazioni</button>
    </div>
  </div>
</template>
