<script setup lang="ts">
// Struttura di una seduta come barre per zona (l'elemento visivamente forte della pagina,
// ADR 0016): larghezza proporzionale alla durata, colore e altezza dalla zona. Il testo
// equivalente e' nell'aria-label; nella variante "mini" la barra e' piatta e decorativa.
import { computed } from "vue";
import type { Discipline, WorkoutStructure } from "@shared/workouts/structure.ts";
import { flattenSteps, peakZone, stepSeconds } from "@shared/workouts/structure.ts";
import { formatMinutes } from "../../domain/workoutState";

const props = defineProps<{ discipline: Discipline; structure: WorkoutStructure | null; variant?: "mini" | "full" }>();

const segments = computed(() => {
  const steps = flattenSteps(props.structure);
  const total = steps.reduce((sum, s) => sum + stepSeconds(s, props.discipline), 0) || 1;
  return steps.map((s) => {
    const zone = peakZone(s.target);
    return {
      grow: (stepSeconds(s, props.discipline) / total) * 100,
      color: zone ? `var(--zone-${zone})` : "var(--zone-unknown)",
      height: zone ? 18 + zone * 12 : 14
    };
  });
});
const label = computed(() => {
  const steps = flattenSteps(props.structure);
  const total = steps.reduce((sum, s) => sum + stepSeconds(s, props.discipline), 0);
  return `Struttura: ${steps.length} step, ${formatMinutes(total)}`;
});
</script>

<template>
  <div v-if="variant === 'mini'" class="structure-mini" aria-hidden="true">
    <span v-for="(s, i) in segments" :key="i" :style="{ flexGrow: s.grow, background: s.color }"></span>
  </div>
  <div v-else class="structure-bar" role="img" :aria-label="segments.length ? label : 'Nessuno step'">
    <span v-if="!segments.length" class="structure-empty">Nessuno step</span>
    <span v-for="(s, i) in segments" :key="i" :style="{ flexGrow: s.grow, background: s.color, height: s.height + '%' }"></span>
  </div>
</template>

<style scoped>
.structure-mini {
  display: flex;
  height: 8px;
  max-width: 420px;
  margin-top: var(--sp-2);
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface-2);
}
.structure-mini span { min-width: 3px; }
.structure-mini span + span { border-left: 1px solid var(--surface); }
.structure-bar {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 64px;
  padding: var(--sp-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.structure-bar span { min-width: 3px; border-radius: 2px 2px 0 0; }
.structure-bar .structure-empty { align-self: center; color: var(--text-muted); font-size: var(--fs-sm); background: none; }
</style>
