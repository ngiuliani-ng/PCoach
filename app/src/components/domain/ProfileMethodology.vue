<script setup lang="ts">
// Profilo › Metodologia: distribuzione dell'intensità, schema di carico e scarico, progressione del carico.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { INTENSITY_OPTIONS } from "../../constants";
import { parseLoadPattern } from "../../domain/planWeeks";

const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);

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
</script>

<template>
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
</template>
