<script setup lang="ts">
// Editor della struttura di una seduta: elenco di step e ripetute con campi validati, al posto
// della sintassi testuale di Intervals.icu (che resta visibile come anteprima nel pannello).
// Modifica in place la struttura ricevuta, che appartiene alla bozza del pannello. I campi di ogni
// step sono in StepFields.vue.
import type { StepRole, WorkoutBlock, WorkoutStep, WorkoutStructure } from "@shared/workouts/structure.ts";
import { STEP_ROLES, peakZone } from "@shared/workouts/structure.ts";
import StepFields from "./StepFields.vue";
import { ArrowDown, ArrowUp, Plus, Repeat, Trash2 } from "lucide-vue-next";

const props = defineProps<{ structure: WorkoutStructure; errors: Record<string, string>; readonly?: boolean; maxZone?: number }>();

function newStep(role: StepRole, zone: number, minutes: number): WorkoutStep {
  return { kind: "step", role, duration: { type: "time", seconds: minutes * 60 }, target: { zone } };
}
function addStep() {
  props.structure.steps.push(newStep("steady", 2, 10));
}
function addRepeat() {
  props.structure.steps.push({ kind: "repeat", count: 4, label: "Serie principale", steps: [newStep("work", 4, 3), newStep("recovery", 1, 2)] });
}
function move(list: unknown[], i: number, delta: number) {
  const j = i + delta;
  if (j < 0 || j >= list.length) return;
  const [item] = list.splice(i, 1);
  list.splice(j, 0, item);
}
function swatch(step: WorkoutStep) {
  const z = peakZone(step.target);
  return z ? `var(--zone-${z})` : "var(--zone-unknown)";
}
// Primo step di un gruppo (in cima, o dopo una ripetuta): porta le etichette dei campi su desktop.
const startsGroup = (i: number) => i === 0 || props.structure.steps[i - 1].kind === "repeat";
const REPEAT_ROLES: StepRole[] = ["work", "recovery", "steady"];
function isRepeat(b: WorkoutBlock): b is Extract<WorkoutBlock, { kind: "repeat" }> {
  return b.kind === "repeat";
}
</script>

<template>
  <div class="step-editor">
    <template v-for="(block, i) in structure.steps" :key="i">
      <div v-if="isRepeat(block)" class="step-repeat">
        <div class="step-repeat-head">
          <input class="step-repeat-label" :value="block.label ?? ''" :disabled="readonly" aria-label="Nome della ripetuta" placeholder="Serie"
            @input="block.label = ($event.target as HTMLInputElement).value" />
          <input class="step-num" type="number" min="1" :value="block.count" :disabled="readonly" aria-label="Ripetizioni"
            @input="block.count = Math.max(0, Math.round(Number(($event.target as HTMLInputElement).value) || 0))" />
          <span class="step-times">volte</span>
          <span class="step-tools" v-if="!readonly">
            <button type="button" class="icon-btn" aria-label="Sposta su la ripetuta" @click="move(structure.steps, i, -1)"><ArrowUp :size="16" aria-hidden="true" /></button>
            <button type="button" class="icon-btn" aria-label="Sposta giù la ripetuta" @click="move(structure.steps, i, 1)"><ArrowDown :size="16" aria-hidden="true" /></button>
            <button type="button" class="icon-btn" aria-label="Rimuovi la ripetuta" @click="structure.steps.splice(i, 1)"><Trash2 :size="16" aria-hidden="true" /></button>
          </span>
        </div>
        <p v-if="errors[`step:${i}`]" class="helper-text error-text">{{ errors[`step:${i}`] }}</p>
        <div v-for="(step, j) in block.steps" :key="j" class="step-row">
          <span class="step-swatch" :style="{ background: swatch(step) }" aria-hidden="true"></span>
          <StepFields :step="step" :roles="REPEAT_ROLES" :readonly="readonly" :max-zone="maxZone" :first="j === 0"
            :duration-invalid="!!errors[`step:${i}.${j}`] && !(step.duration.type === 'time' ? step.duration.seconds : step.duration.meters)"
            :zone-invalid="!!errors[`step:${i}.${j}`] && !step.target" />
          <span class="step-tools" v-if="!readonly">
            <button type="button" class="icon-btn" aria-label="Sposta su" @click="move(block.steps, j, -1)"><ArrowUp :size="16" aria-hidden="true" /></button>
            <button type="button" class="icon-btn" aria-label="Sposta giù" @click="move(block.steps, j, 1)"><ArrowDown :size="16" aria-hidden="true" /></button>
            <button type="button" class="icon-btn" aria-label="Rimuovi lo step" @click="block.steps.splice(j, 1)"><Trash2 :size="16" aria-hidden="true" /></button>
          </span>
          <p v-if="errors[`step:${i}.${j}`]" class="helper-text error-text step-error">{{ errors[`step:${i}.${j}`] }}</p>
        </div>
        <button v-if="!readonly" type="button" class="add-row" @click="block.steps.push(newStep('recovery', 1, 2))"><Plus :size="16" aria-hidden="true" />Step nella ripetuta</button>
      </div>

      <div v-else class="step-row">
        <span class="step-swatch" :style="{ background: swatch(block) }" aria-hidden="true"></span>
        <StepFields :step="block" :roles="STEP_ROLES" :readonly="readonly" :max-zone="maxZone" :first="startsGroup(i)"
          :duration-invalid="!!errors[`step:${i}`] && !(block.duration.type === 'time' ? block.duration.seconds : block.duration.meters)"
          :zone-invalid="!!errors[`step:${i}`] && !block.target" />
        <span class="step-tools" v-if="!readonly">
          <button type="button" class="icon-btn" aria-label="Sposta su" @click="move(structure.steps, i, -1)"><ArrowUp :size="16" aria-hidden="true" /></button>
          <button type="button" class="icon-btn" aria-label="Sposta giù" @click="move(structure.steps, i, 1)"><ArrowDown :size="16" aria-hidden="true" /></button>
          <button type="button" class="icon-btn" aria-label="Rimuovi lo step" @click="structure.steps.splice(i, 1)"><Trash2 :size="16" aria-hidden="true" /></button>
        </span>
        <p v-if="errors[`step:${i}`]" class="helper-text error-text step-error">{{ errors[`step:${i}`] }}</p>
      </div>
    </template>

    <div v-if="!readonly" class="step-add">
      <button type="button" class="add-row" @click="addStep"><Plus :size="16" aria-hidden="true" />Aggiungi step</button>
      <button type="button" class="add-row" @click="addRepeat"><Repeat :size="16" aria-hidden="true" />Aggiungi ripetuta</button>
    </div>
  </div>
</template>

<style scoped>
.step-editor { display: flex; flex-direction: column; gap: var(--sp-2); }
.step-row {
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr) auto;
  gap: var(--sp-2);
  align-items: start;
  padding: var(--sp-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.step-swatch { align-self: stretch; border-radius: 3px; }
.step-num { width: 76px !important; }
.step-tools { display: flex; }
.step-error { grid-column: 2 / -1; margin: 0; }
.step-repeat {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--surface-2) 55%, var(--bg));
}
.step-repeat-head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; font-size: var(--fs-sm); }
.step-repeat-head input { width: auto; min-height: 32px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-sm); }
.step-repeat-label { flex: 1 1 160px; font-weight: 600; }
.step-times { color: var(--text-muted); }
.step-repeat .step-tools { margin-left: auto; }
.step-add { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-4); }
/* Touch: stesso testo da 16px e altezza da 44px degli altri campi (base.css). */
@media (pointer: coarse) {
  .step-repeat-head input { min-height: 44px; font-size: var(--fs-lg); }
}
</style>
