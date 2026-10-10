<script setup lang="ts">
// Editor della struttura di una seduta: elenco di step e ripetute con campi validati, al posto
// della sintassi testuale di Intervals.icu (che resta visibile come anteprima nel pannello).
// Modifica in place la struttura ricevuta, che appartiene alla bozza del pannello.
import type { StepRole, WorkoutBlock, WorkoutStep, WorkoutStructure } from "@shared/workouts/structure.ts";
import { STEP_ROLES, peakZone } from "@shared/workouts/structure.ts";
import { ROLE_LABELS } from "../../domain/workoutState";
import { ArrowDown, ArrowUp, Plus, Repeat, Trash2 } from "lucide-vue-next";

const props = defineProps<{ structure: WorkoutStructure; errors: Record<string, string>; readonly?: boolean }>();

type Unit = "min" | "s" | "km" | "m";
const ZONES = [1, 2, 3, 4, 5, 6, 7];

function unitOf(step: WorkoutStep): Unit {
  if (step.duration.type === "time") return step.duration.seconds % 60 === 0 ? "min" : "s";
  return step.duration.meters >= 1000 && step.duration.meters % 100 === 0 ? "km" : "m";
}
function setValue(step: WorkoutStep, raw: string, unit: Unit) {
  const v = Math.max(0, Number(raw.replace(",", ".")) || 0);
  step.duration = unit === "min" ? { type: "time", seconds: Math.round(v * 60) }
    : unit === "s" ? { type: "time", seconds: Math.round(v) }
    : unit === "km" ? { type: "distance", meters: Math.round(v * 1000) }
    : { type: "distance", meters: Math.round(v) };
}
function setUnit(step: WorkoutStep, unit: Unit) {
  const wasTime = step.duration.type === "time";
  const isTime = unit === "min" || unit === "s";
  if (wasTime === isTime) return; // stessa grandezza: la durata resta, cambia solo come si legge
  step.duration = isTime ? { type: "time", seconds: 600 } : { type: "distance", meters: 1000 };
}
// Un cambio d'unita' tra minuti e secondi (o km e metri) non cambia la durata: per farlo
// vedere, il valore mostrato viene riconvertito con l'unita' scelta.
function onUnitChange(step: WorkoutStep, unit: Unit, input: HTMLInputElement | null) {
  setUnit(step, unit);
  const display = unit === "min" && step.duration.type === "time" ? step.duration.seconds / 60
    : unit === "s" && step.duration.type === "time" ? step.duration.seconds
    : unit === "km" && step.duration.type === "distance" ? step.duration.meters / 1000
    : step.duration.type === "distance" ? step.duration.meters : 0;
  if (input) input.value = String(+display.toFixed(2));
  unitOverrides.set(step, unit);
}
const unitOverrides = new WeakMap<WorkoutStep, Unit>();
function currentUnit(step: WorkoutStep): Unit {
  const o = unitOverrides.get(step);
  if (o && (o === "min" || o === "s") === (step.duration.type === "time")) return o;
  return unitOf(step);
}
function displayValue(step: WorkoutStep): number {
  const u = currentUnit(step);
  if (step.duration.type === "time") return +(u === "min" ? step.duration.seconds / 60 : step.duration.seconds).toFixed(2);
  return +(u === "km" ? step.duration.meters / 1000 : step.duration.meters).toFixed(2);
}

function setZone(step: WorkoutStep, raw: string) {
  const z = Number(raw);
  if (!z) { step.target = null; return; }
  const to = step.target?.zone_to;
  step.target = to && to > z ? { zone: z, zone_to: to } : { zone: z };
}
function setZoneTo(step: WorkoutStep, raw: string) {
  if (!step.target) return;
  const z = Number(raw);
  step.target = z && z > step.target.zone ? { zone: step.target.zone, zone_to: z } : { zone: step.target.zone };
}
function setCue(step: WorkoutStep, value: string) {
  if (value.trim()) step.cue = value;
  else delete step.cue;
}

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
          <div class="step-fields">
            <select :value="step.role" :disabled="readonly" aria-label="Tipo di step" @change="step.role = ($event.target as HTMLSelectElement).value as StepRole">
              <option v-for="r in ['work', 'recovery', 'steady']" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
            </select>
            <input class="step-num" type="number" min="0" step="any" :value="displayValue(step)" :disabled="readonly" aria-label="Durata"
              :class="{ invalid: errors[`step:${i}.${j}`] && !(step.duration.type === 'time' ? step.duration.seconds : step.duration.meters) }"
              @input="setValue(step, ($event.target as HTMLInputElement).value, currentUnit(step))" />
            <select :value="currentUnit(step)" :disabled="readonly" aria-label="Unità"
              @change="onUnitChange(step, ($event.target as HTMLSelectElement).value as Unit, ($event.target as HTMLElement).previousElementSibling as HTMLInputElement)">
              <option value="min">min</option><option value="s">s</option><option value="km">km</option><option value="m">m</option>
            </select>
            <select :value="step.target?.zone ?? ''" :disabled="readonly" aria-label="Zona" :class="{ invalid: errors[`step:${i}.${j}`] && !step.target }"
              @change="setZone(step, ($event.target as HTMLSelectElement).value)">
              <option value="">Zona…</option>
              <option v-for="z in ZONES" :key="z" :value="z">Z{{ z }}</option>
            </select>
            <select :value="step.target?.zone_to ?? ''" :disabled="readonly || !step.target" aria-label="Fino alla zona"
              @change="setZoneTo(step, ($event.target as HTMLSelectElement).value)">
              <option value="">fino a…</option>
              <option v-for="z in ZONES.filter((x) => x > (step.target?.zone ?? 7))" :key="z" :value="z">Z{{ z }}</option>
            </select>
            <input class="step-cue" :value="step.cue ?? ''" :disabled="readonly" placeholder="Indicazione per l'atleta" aria-label="Indicazione per l'atleta"
              @input="setCue(step, ($event.target as HTMLInputElement).value)" />
          </div>
          <span class="step-tools" v-if="!readonly">
            <button type="button" class="icon-btn" aria-label="Sposta su" @click="move(block.steps, j, -1)"><ArrowUp :size="16" aria-hidden="true" /></button>
            <button type="button" class="icon-btn" aria-label="Rimuovi lo step" @click="block.steps.splice(j, 1)"><Trash2 :size="16" aria-hidden="true" /></button>
          </span>
          <p v-if="errors[`step:${i}.${j}`]" class="helper-text error-text step-error">{{ errors[`step:${i}.${j}`] }}</p>
        </div>
        <button v-if="!readonly" type="button" class="add-row" @click="block.steps.push(newStep('recovery', 1, 2))"><Plus :size="16" aria-hidden="true" />Step nella ripetuta</button>
      </div>

      <div v-else class="step-row">
        <span class="step-swatch" :style="{ background: swatch(block) }" aria-hidden="true"></span>
        <div class="step-fields">
          <select :value="block.role" :disabled="readonly" aria-label="Tipo di step" @change="block.role = ($event.target as HTMLSelectElement).value as StepRole">
            <option v-for="r in STEP_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
          </select>
          <input class="step-num" type="number" min="0" step="any" :value="displayValue(block)" :disabled="readonly" aria-label="Durata"
            :class="{ invalid: errors[`step:${i}`] && !(block.duration.type === 'time' ? block.duration.seconds : block.duration.meters) }"
            @input="setValue(block, ($event.target as HTMLInputElement).value, currentUnit(block))" />
          <select :value="currentUnit(block)" :disabled="readonly" aria-label="Unità"
            @change="onUnitChange(block, ($event.target as HTMLSelectElement).value as Unit, ($event.target as HTMLElement).previousElementSibling as HTMLInputElement)">
            <option value="min">min</option><option value="s">s</option><option value="km">km</option><option value="m">m</option>
          </select>
          <select :value="block.target?.zone ?? ''" :disabled="readonly" aria-label="Zona" :class="{ invalid: errors[`step:${i}`] && !block.target }"
            @change="setZone(block, ($event.target as HTMLSelectElement).value)">
            <option value="">Zona…</option>
            <option v-for="z in ZONES" :key="z" :value="z">Z{{ z }}</option>
          </select>
          <select :value="block.target?.zone_to ?? ''" :disabled="readonly || !block.target" aria-label="Fino alla zona"
            @change="setZoneTo(block, ($event.target as HTMLSelectElement).value)">
            <option value="">fino a…</option>
            <option v-for="z in ZONES.filter((x) => x > (block.target?.zone ?? 7))" :key="z" :value="z">Z{{ z }}</option>
          </select>
          <input class="step-cue" :value="block.cue ?? ''" :disabled="readonly" placeholder="Indicazione per l'atleta" aria-label="Indicazione per l'atleta"
            @input="setCue(block, ($event.target as HTMLInputElement).value)" />
        </div>
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
.step-fields { display: flex; flex-wrap: wrap; gap: var(--sp-2); min-width: 0; }
.step-fields select, .step-fields input { width: auto; min-height: 32px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-sm); }
.step-num { width: 76px !important; }
.step-cue { flex: 1 1 160px; }
.step-tools { display: flex; }
.step-error { grid-column: 2 / -1; margin: 0; }
.invalid { border-color: var(--danger) !important; }
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
</style>
