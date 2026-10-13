<script setup lang="ts">
// Profilo › Stato di allenamento: calo degli allenamenti in corso e fattori di vita.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { LIFESTYLE_FACTOR_OPTIONS } from "../../constants";

const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);

function toggleLifestyleFactor(value: string) {
  const list = profile.value.training_status?.lifestyle_factors || [];
  const idx = list.indexOf(value as never);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value as never);
  if (profile.value.training_status) profile.value.training_status.lifestyle_factors = list;
}
</script>

<template>
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

  <h3 class="subsection-title">Fattori di vita</h3>
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
</template>
