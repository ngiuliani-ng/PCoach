<script setup lang="ts">
// Blocco settimana comprimibile (§8): intestazione con week_label, range date,
// badge "Scarico", riepilogo (sessioni/ore/km per disciplina); contenuto sessioni
// visibile solo se aperta. Apertura/chiusura gestita dal chiamante (PlanView),
// cosi' lo stato resta nello store/composable UI e non qui.
import type { WeekViewModel } from "../../services/planViewModel";
import { disciplineLabel, formatDate } from "../../constants";
import PlanSessionCard from "./PlanSessionCard.vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";

defineProps<{ week: WeekViewModel; open: boolean }>();
defineEmits<{ (e: "toggle"): void }>();

function hours(min: number): string {
  return (min / 60).toLocaleString("it-IT", { maximumFractionDigits: 1 });
}
function km(value: number): string {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}
</script>

<template>
  <div class="plan-week" :class="{ current: week.isCurrent }" :id="week.isCurrent ? 'plan-week-current' : undefined">
    <button type="button" class="plan-week-header" @click="$emit('toggle')" :aria-expanded="open">
      <span class="plan-week-caret">
        <ChevronDown v-if="open" :size="16" aria-hidden="true" />
        <ChevronRight v-else :size="16" aria-hidden="true" />
      </span>
      <span class="plan-week-title">
        {{ week.weekLabel }}
        <span v-if="week.isCurrent" class="current-badge">Questa settimana</span>
        <span v-if="week.isDeload" class="deload-badge">Scarico</span>
      </span>
      <span class="plan-week-range">
        <template v-if="week.startDate">{{ formatDate(week.startDate, false) }} – {{ formatDate(week.endDate, false) }}</template>
      </span>
      <span class="plan-week-summary">
        <span>{{ week.summary.sessionCount }} sessioni</span>
        <span>{{ hours(week.summary.totalDurationMin) }} h</span>
        <span v-for="(value, disc) in week.summary.distanceByDiscipline" :key="disc">{{ disciplineLabel(String(disc)) }} {{ km(value) }} km</span>
      </span>
    </button>
    <div v-if="open" class="plan-week-body">
      <p v-if="!week.sessions.length" class="helper-text">Nessuna sessione in questa settimana.</p>
      <PlanSessionCard v-for="(s, i) in week.sessions" :key="i" :session="s" />
    </div>
  </div>
</template>

<style scoped>
.plan-week {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: var(--sp-2);
  background: var(--surface);
  overflow: hidden;
}
.plan-week.current { border-color: var(--accent); }
.plan-week-header {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    "caret title range"
    ".     summary summary";
  align-items: baseline;
  gap: var(--sp-1) var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  color: var(--text);
}
.plan-week-header:hover { background: var(--surface-2); }
.plan-week-caret { grid-area: caret; color: var(--text-muted); align-self: center; display: flex; }
.plan-week-title {
  grid-area: title;
  font-weight: 600;
  font-size: var(--fs-md);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-2);
}
.plan-week-range { grid-area: range; color: var(--text-muted); white-space: nowrap; }
.plan-week-summary {
  grid-area: summary;
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--sp-4);
  color: var(--text-muted);
}
.current-badge, .deload-badge {
  font-size: var(--fs-xs);
  font-weight: 500;
  padding: 1px var(--sp-2);
  border-radius: 999px;
}
.current-badge { color: var(--accent); border: 1px solid currentColor; }
.deload-badge { color: var(--text-muted); background: var(--surface-2); }
.plan-week-body { border-top: 1px solid var(--border); }
.plan-week-body > .helper-text { margin: var(--sp-3) var(--sp-4); }
</style>
