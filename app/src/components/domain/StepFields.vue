<script lang="ts">
import type { WorkoutStep } from "@shared/workouts/structure.ts";

type Unit = "min" | "s" | "km" | "m";
// Unita' scelta dal coach per uno step (minuti o secondi, km o metri): la durata salvata e' la stessa,
// cambia solo come si legge. Condivisa fra le righe, perche' spostando uno step la riga cambia.
const unitOverrides = new WeakMap<WorkoutStep, Unit>();
</script>

<script setup lang="ts">
// Campi di uno step nell'editor della struttura: tipo, durata, unita', zona (con l'intervallo solo se
// serve) e indicazione per l'atleta. Etichette visibili e compatte (audit UX-25): su desktop solo sulla
// prima riga di ogni gruppo, su telefono su ogni riga. Modifica lo step in place, come StepEditor.
import type { StepRole } from "@shared/workouts/structure.ts";
import { ROLE_LABELS } from "../../domain/workoutState";
import { Plus } from "lucide-vue-next";

const props = defineProps<{
  step: WorkoutStep;
  roles: readonly StepRole[];
  readonly?: boolean;
  maxZone?: number;
  durationInvalid?: boolean;
  zoneInvalid?: boolean;
  /** Prima riga del gruppo: etichette visibili anche su desktop. */
  first?: boolean;
}>();

// Solo le zone del sistema dell'atleta per la disciplina (D-UX-3); una zona gia' oltre resta visibile.
const zoneMax = () => props.maxZone ?? 7;
function zoneChoices(current: number | null | undefined): number[] {
  const list = Array.from({ length: zoneMax() }, (_, i) => i + 1);
  return current && current > zoneMax() ? [...list, current] : list;
}
const zoneText = (z: number) => (z > zoneMax() ? `Z${z}, oltre le ${zoneMax()} zone` : `Z${z}`);

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
// «Intervallo»: la zona diventa un intervallo, dalla zona scelta alla successiva; si allarga dal selettore.
const canAddRange = () => !!props.step.target && props.step.target.zone < zoneMax() && !props.step.target.zone_to;
function addRange(step: WorkoutStep) {
  if (step.target) step.target = { zone: step.target.zone, zone_to: step.target.zone + 1 };
}
function setCue(step: WorkoutStep, value: string) {
  if (value.trim()) step.cue = value;
  else delete step.cue;
}
</script>

<template>
  <div class="step-fields" :class="{ first }">
    <div class="step-field">
      <span class="step-label" aria-hidden="true">Tipo</span>
      <select :value="step.role" :disabled="readonly" aria-label="Tipo di step" @change="step.role = ($event.target as HTMLSelectElement).value as StepRole">
        <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
      </select>
    </div>
    <div class="step-field">
      <span class="step-label" aria-hidden="true">Durata</span>
      <span class="step-pair">
        <input class="step-num" type="number" min="0" step="any" :value="displayValue(step)" :disabled="readonly" aria-label="Durata"
          :class="{ invalid: durationInvalid }"
          @input="setValue(step, ($event.target as HTMLInputElement).value, currentUnit(step))" />
        <select :value="currentUnit(step)" :disabled="readonly" aria-label="Unità"
          @change="onUnitChange(step, ($event.target as HTMLSelectElement).value as Unit, ($event.target as HTMLElement).previousElementSibling as HTMLInputElement)">
          <option value="min">min</option><option value="s">s</option><option value="km">km</option><option value="m">m</option>
        </select>
      </span>
    </div>
    <div class="step-field">
      <span class="step-label" aria-hidden="true">Zona</span>
      <span class="step-pair">
        <select :value="step.target?.zone ?? ''" :disabled="readonly" aria-label="Zona" :class="{ invalid: zoneInvalid }"
          @change="setZone(step, ($event.target as HTMLSelectElement).value)">
          <option value="">Zona…</option>
          <option v-for="z in zoneChoices(step.target?.zone)" :key="z" :value="z">{{ zoneText(z) }}</option>
        </select>
        <!-- Il limite superiore compare solo per un intervallo di zone: «Z2 fino a Z3». -->
        <template v-if="step.target?.zone_to">
          <span class="step-to" aria-hidden="true">fino a</span>
          <select :value="step.target.zone_to" :disabled="readonly" aria-label="Fino alla zona"
            @change="setZoneTo(step, ($event.target as HTMLSelectElement).value)">
            <option value="">nessun intervallo</option>
            <option v-for="z in zoneChoices(step.target.zone_to).filter((x) => x > step.target!.zone)" :key="z" :value="z">{{ zoneText(z) }}</option>
          </select>
        </template>
        <button v-else-if="!readonly && canAddRange()" type="button" class="link-btn step-range" aria-label="Intervallo di zone: aggiungi il limite superiore"
          @click="addRange(step)"><Plus :size="14" aria-hidden="true" />Intervallo</button>
      </span>
    </div>
    <div class="step-field step-cue">
      <span class="step-label" aria-hidden="true">Indicazione</span>
      <input :value="step.cue ?? ''" :disabled="readonly" placeholder="Per l'atleta, facoltativa" aria-label="Indicazione per l'atleta"
        @input="setCue(step, ($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>

<style scoped>
.step-fields { display: flex; flex-wrap: wrap; gap: var(--sp-2); min-width: 0; }
.step-field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
/* Etichette compatte: su desktop solo sulla prima riga del gruppo; su telefono su ogni riga (sotto). */
.step-label { display: none; font-size: var(--fs-xs); color: var(--text-muted); line-height: 1.3; }
.first .step-label { display: block; }
.step-pair { display: flex; align-items: center; gap: var(--sp-1); }
.step-fields select, .step-fields input { width: auto; min-height: 32px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-sm); }
.step-num { width: 76px !important; }
.step-cue { flex: 1 1 160px; }
.step-cue input { width: 100%; }
.step-to { font-size: var(--fs-sm); color: var(--text-muted); white-space: nowrap; }
.step-range { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-sm); white-space: nowrap; }
.invalid { border-color: var(--danger) !important; }
@media (max-width: 560px) {
  .step-label { display: block; }
}
/* Touch: stesso testo da 16px e altezza da 44px degli altri campi (base.css). */
@media (pointer: coarse) {
  .step-fields select, .step-fields input { min-height: 44px; font-size: var(--fs-lg); }
}
</style>
