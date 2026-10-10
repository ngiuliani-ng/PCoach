<script setup lang="ts">
// Riga di una seduta nella settimana o nello storico: icona disciplina, nome, durata,
// obiettivo, barra della struttura e stati. Tutta la riga apre la seduta; "Approva" e'
// un pulsante separato (non annidato) per le bozze valide.
import { computed } from "vue";
import type { SyncRow } from "@shared/workouts/sync.ts";
import { validateWorkout, workoutTotals } from "@shared/workouts/structure.ts";
import type { WorkoutRecord } from "../../stores/workouts";
import { disciplineIcon, disciplineLabel, formatDate } from "../../constants";
import { formatMeters, formatMinutes } from "../../domain/workoutState";
import { isActiveStatus } from "../../domain/regeneration";
import StructureBar from "./StructureBar.vue";
import WorkoutBadges from "./WorkoutBadges.vue";
import { Check } from "lucide-vue-next";

const props = defineProps<{ workout: WorkoutRecord; sync?: SyncRow | null; showDate?: boolean; readonly?: boolean }>();
const emit = defineEmits<{ (e: "open", id: string): void; (e: "approve", id: string): void }>();

const totals = computed(() => workoutTotals(props.workout));
const active = computed(() => isActiveStatus(props.workout.status));
const canApprove = computed(
  () => !props.readonly && props.workout.status === "draft" && !props.workout.needs_review && !Object.keys(validateWorkout(props.workout)).length
);
const dayText = computed(() => {
  const d = new Date(props.workout.planned_date + "T12:00:00");
  return `${new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(d)} ${formatDate(props.workout.planned_date, false)}`;
});
</script>

<template>
  <div class="w-row" :class="{ inactive: !active }">
    <button type="button" class="w-row-open" :aria-label="`Apri ${workout.title}, ${dayText}`" @click="emit('open', workout.id)">
      <component
        :is="disciplineIcon(workout.discipline)"
        :size="16"
        class="w-row-icon"
        role="img"
        :aria-label="disciplineLabel(workout.discipline)"
      />
      <span class="w-row-main">
        <span class="w-row-title">{{ workout.title || "Seduta senza nome" }}</span>
        <span class="w-row-stats">
          <span v-if="showDate">{{ dayText }}</span>
          <span v-if="totals.seconds">{{ formatMinutes(totals.seconds) }}{{ totals.estimated ? " stimati" : "" }}</span>
          <span v-if="totals.meters">{{ formatMeters(totals.meters) }}</span>
          <span v-if="workout.objective">{{ workout.objective }}</span>
        </span>
        <StructureBar v-if="workout.structure" :discipline="workout.discipline" :structure="workout.structure" variant="mini" />
        <WorkoutBadges :workout="workout" :sync="sync" />
      </span>
    </button>
    <button v-if="canApprove" type="button" class="secondary w-row-approve" @click="emit('approve', workout.id)">
      <Check :size="16" aria-hidden="true" />Approva
    </button>
  </div>
</template>
