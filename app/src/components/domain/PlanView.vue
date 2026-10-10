<script setup lang="ts">
// Vista grafica del piano di allenamento (§8): intestazione, controlli
// apri/chiudi tutte + ancora alla settimana corrente, elenco settimane
// comprimibili. Usata sia per il piano salvato sia per l'anteprima prima
// della conferma (stateKey distingue le due in usePlanWeeksUi).
import { computed } from "vue";
import { buildPlanViewModel } from "../../services/planViewModel";
import { formatDate, todayISO } from "../../constants";
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
    <p v-if="!vm" class="helper-text"><slot name="empty">Nessun piano.</slot></p>
    <template v-else>
      <div class="plan-view-header">
        <strong>{{ vm.planName }}</strong>
        <span class="plan-view-meta">{{ vm.weeks.length }} settimane<template v-if="vm.startDate">, dal {{ formatDate(vm.startDate) }}</template></span>
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
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  margin-bottom: var(--sp-2);
}
.plan-view-header strong { font-size: var(--fs-md); font-weight: 600; }
.plan-view-meta { color: var(--text-muted); font-size: var(--fs-sm); }
.plan-view-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  margin-bottom: var(--sp-3);
  font-size: var(--fs-sm);
  color: var(--text-muted);
}
</style>
