<script setup lang="ts">
// Profilo › Discipline: sport praticati, livello e volumi settimanali.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { TRAINING_SPORT_OPTIONS, LEVEL_OPTIONS, VOLUME_UNITS, disciplineIcon, disciplineLabel } from "../../constants";
import IconButton from "../ui/IconButton.vue";
import { Plus, Trash2 } from "lucide-vue-next";

const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);

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
</script>

<template>
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
</template>
