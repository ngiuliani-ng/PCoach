<script lang="ts">
export type ThresholdSport = "running" | "cycling" | "swimming";
</script>

<script setup lang="ts">
// Profilo › Soglie e zone: una disciplina alla volta, con il sistema di zone e lo storico delle
// rilevazioni. La disciplina mostrata e' un v-model: le anomalie aprono la sezione sulla disciplina giusta.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { RUN_THRESHOLD_FIELDS, BIKE_THRESHOLD_FIELDS, SWIM_THRESHOLD_FIELDS } from "../../constants";
import MetricLogList from "./MetricLogList.vue";

const sport = defineModel<ThresholdSport>("sport", { required: true });
const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);

const THRESHOLD_SPORTS: [ThresholdSport, string][] = [["running", "Corsa"], ["cycling", "Bici"], ["swimming", "Nuoto"]];
const THRESHOLD_FIELDS = { running: RUN_THRESHOLD_FIELDS, cycling: BIKE_THRESHOLD_FIELDS, swimming: SWIM_THRESHOLD_FIELDS };
const zoneSystem = computed({
  get: () => (sport.value === "swimming" ? "7-zone" : profile.value.physiological_thresholds?.[sport.value]?.zone_system ?? "7-zone"),
  set: (value) => {
    if (sport.value !== "swimming") profile.value.physiological_thresholds![sport.value]!.zone_system = value as "3-zone" | "5-zone" | "7-zone";
  }
});
</script>

<template>
  <div class="segmented" role="group" aria-label="Disciplina delle soglie">
    <button
      v-for="[key, label] in THRESHOLD_SPORTS"
      :key="key"
      type="button"
      :aria-pressed="sport === key"
      @click="sport = key"
    >{{ label }}</button>
  </div>
  <div class="field-row">
    <label v-if="sport !== 'swimming'" class="field">
      <span class="field-label">Sistema di zone</span>
      <select v-model="zoneSystem">
        <option value="3-zone">3 zone</option>
        <option value="5-zone">5 zone</option>
        <option value="7-zone">7 zone</option>
      </select>
    </label>
    <label v-else class="field">
      <span class="field-label">Sistema di zone</span>
      <select disabled aria-describedby="swim-zone-note">
        <option>7 zone</option>
      </select>
      <span id="swim-zone-note" class="helper-text">Il nuoto usa sempre 7 zone.</span>
    </label>
  </div>
  <MetricLogList
    :key="sport"
    v-model="profile.physiological_thresholds![sport]!.thresholds_log as never"
    :field-defs="THRESHOLD_FIELDS[sport]"
  />
</template>
