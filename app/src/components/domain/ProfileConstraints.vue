<script setup lang="ts">
// Profilo › Vincoli e disponibilità: giorni disponibili, durata massima e attività abituale per giorno.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { DAY_LABELS } from "../../constants";

const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);
</script>

<template>
  <div v-for="day in profile.constraints.days_available" :key="day.day" class="day-row" :class="{ inactive: !day.active }">
    <span class="day-label">{{ DAY_LABELS.find(([k]) => k === day.day)?.[1] }}</span>
    <label class="checkbox-line"><input type="checkbox" v-model="day.active" /> Disponibile</label>
    <label class="field"><span class="field-label">Durata massima (min)</span><input type="number" v-model.number="day.max_duration_minutes" /></label>
    <label class="field"><span class="field-label">Attività abituale</span><input type="text" v-model="day.fixed_activity" /></label>
  </div>
  <div class="field-row">
    <label class="field"><span class="field-label">Sessioni a settimana (obiettivo)</span><input type="number" v-model.number="profile.constraints.sessions_per_week_target" /></label>
  </div>
</template>
