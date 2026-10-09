<script setup lang="ts">
// Blocco settimana comprimibile (§8): intestazione con week_label, range date,
// badge "Scarico", riepilogo (sessioni/ore/km per disciplina); contenuto sessioni
// visibile solo se aperta. Apertura/chiusura gestita dal chiamante (PlanView),
// cosi' lo stato resta nello store/composable UI e non qui.
import type { WeekViewModel } from "../../services/planViewModel";
import PlanSessionCard from "./PlanSessionCard.vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";

defineProps<{ week: WeekViewModel; open: boolean }>();
defineEmits<{ (e: "toggle"): void }>();

function shortDate(iso: string | null): string {
  if (!iso) return "?";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}
</script>

<template>
  <div class="plan-week" :class="{ current: week.isCurrent }" :id="week.isCurrent ? 'plan-week-current' : undefined">
    <button type="button" class="plan-week-header" @click="$emit('toggle')" :aria-expanded="open">
      <span class="plan-week-title">
        {{ week.weekLabel }}
        <span class="plan-week-range">{{ shortDate(week.startDate) }}–{{ shortDate(week.endDate) }}</span>
        <span v-if="week.isDeload" class="deload-badge">Scarico</span>
      </span>
      <span class="plan-week-summary">
        {{ week.summary.sessionCount }} sessioni · {{ (week.summary.totalDurationMin / 60).toFixed(1) }} h
        <template v-for="(km, disc) in week.summary.distanceByDiscipline" :key="disc">
          · {{ disc }}: {{ km.toFixed(1) }} km
        </template>
      </span>
      <span class="plan-week-caret">
        <ChevronDown v-if="open" :size="16" aria-hidden="true" />
        <ChevronRight v-else :size="16" aria-hidden="true" />
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
  border-radius: 8px;
  margin-bottom: 10px;
  background: var(--bg);
  overflow: hidden;
}
.plan-week.current { border-color: var(--accent); }
.plan-week-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-ui);
  color: var(--text);
}
.plan-week-title { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; }
.plan-week-range { font-weight: 400; color: var(--text-muted); font-family: var(--font-mono); font-size: 11.5px; }
.deload-badge {
  display: inline-block;
  color: var(--warning);
  background: var(--warning-bg);
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 999px;
}
.plan-week-summary { flex: 1; font-size: 11.5px; color: var(--text-muted); text-align: right; }
.plan-week-caret { color: var(--text-muted); flex-shrink: 0; }
.plan-week-body { padding: 4px 14px 14px; }

@media (max-width: 480px) {
  .plan-week-header { flex-wrap: wrap; }
  .plan-week-title { order: 1; }
  .plan-week-caret { order: 2; margin-left: auto; }
  .plan-week-summary { order: 3; flex: 1 1 100%; text-align: left; margin-top: 2px; }
}
</style>
