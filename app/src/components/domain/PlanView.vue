<script setup lang="ts">
// Vista grafica del piano di allenamento (§8): intestazione, controlli
// apri/chiudi tutte + ancora alla settimana corrente, elenco settimane
// comprimibili. Usata sia per il piano salvato sia per l'anteprima prima
// della conferma (stateKey distingue le due in usePlanWeeksUi).
import { computed } from "vue";
import { buildPlanViewModel } from "../../services/planViewModel";
import { todayISO } from "../../constants";
import { usePlanWeeksUi } from "../../composables/usePlanWeeksUi";
import PlanWeekBlock from "./PlanWeekBlock.vue";

const props = defineProps<{ trainingPlan: unknown; stateKey: string }>();

const today = todayISO();
const vm = computed(() => buildPlanViewModel(props.trainingPlan, today));
const weeksUi = usePlanWeeksUi();

const hasCurrentWeek = computed(() => !!vm.value?.weeks.some((w) => w.isCurrent));

function isOpen(weekIndex: number): boolean {
  if (!vm.value) return false;
  return weeksUi.isOpen(props.stateKey, vm.value, today, weekIndex);
}
function toggle(weekIndex: number): void {
  if (!vm.value) return;
  weeksUi.toggle(props.stateKey, vm.value, today, weekIndex);
}
function openAll(): void {
  if (vm.value) weeksUi.openAll(props.stateKey, vm.value);
}
function closeAll(): void {
  weeksUi.closeAll(props.stateKey);
}
function scrollToCurrent(): void {
  document.getElementById("plan-week-current")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
</script>

<template>
  <div class="plan-view">
    <p v-if="!vm" class="helper-text">Nessun piano generato.</p>
    <template v-else>
      <div class="plan-view-header">
        <strong>{{ vm.planName }}</strong>
        <span class="helper-text" style="margin: 0">{{ vm.weeks.length }} settimane<template v-if="vm.startDate"> · da {{ vm.startDate }}</template></span>
      </div>
      <div class="plan-view-controls">
        <button type="button" class="link-btn" @click="openAll">Apri tutte</button>
        <button type="button" class="link-btn" @click="closeAll">Chiudi tutte</button>
        <button v-if="hasCurrentWeek" type="button" class="link-btn" @click="scrollToCurrent">Vai alla settimana corrente</button>
      </div>
      <p v-if="!vm.weeks.length" class="helper-text">Il piano non contiene settimane.</p>
      <PlanWeekBlock
        v-for="w in vm.weeks"
        :key="w.index"
        :week="w"
        :open="isOpen(w.index)"
        @toggle="toggle(w.index)"
      />
    </template>
  </div>
</template>

<style scoped>
.plan-view-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.plan-view-controls {
  display: flex;
  gap: 14px;
  margin-bottom: 12px;
  font-size: 12px;
}
</style>
