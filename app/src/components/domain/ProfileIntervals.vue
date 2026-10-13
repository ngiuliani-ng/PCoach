<script setup lang="ts">
// Profilo › Intervals.icu: la chiave API dell'atleta. Lo stato della verifica arriva dall'editor, che
// lo usa anche per la Panoramica e le anomalie (useIntervalsSync).
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import PasswordField from "../ui/PasswordField.vue";

defineProps<{ statusText: string; invalid: boolean }>();
const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);
</script>

<template>
  <div class="field">
    <label class="field-label" for="intervals-api-key">Chiave API di Intervals.icu</label>
    <PasswordField v-model="profile.integrations!.intervals_icu_api_key as string" input-id="intervals-api-key" />
  </div>
  <p v-if="statusText" class="helper-text status-text" :class="{ 'error-text': invalid }">{{ statusText }}</p>
</template>
