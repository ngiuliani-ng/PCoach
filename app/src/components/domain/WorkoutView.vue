<script setup lang="ts">
// Seduta in sola lettura (ADR 0047): è come si apre il pannello. Data, disciplina, obiettivo, struttura
// con la barra delle zone e un elenco di step leggibile (zona e, se la scheda ha la soglia, watt o
// passo), note per l'atleta. Per modificare si passa all'editor con «Modifica».
import { computed } from "vue";
import type { WorkoutBlock, WorkoutContent, WorkoutStep } from "@shared/workouts/structure.ts";
import { peakZone, workoutTotals, zoneLabel } from "@shared/workouts/structure.ts";
import type { PaceContext } from "@shared/workouts/thresholds.ts";
import { disciplineIcon, disciplineLabel, formatDate } from "../../constants";
import { ROLE_LABELS, TARGET_LABELS, formatMeters, formatMinutes } from "../../domain/workoutState";
import { missingScaleNote, scaleFor, targetRange, thresholdLabel, type ZoneScales } from "../../domain/zoneTargets";
import StructureBar from "./StructureBar.vue";
import { Repeat } from "lucide-vue-next";

const props = defineProps<{ content: WorkoutContent; pace?: PaceContext | null; scales?: ZoneScales | null }>();

const totals = computed(() => workoutTotals(props.content, props.pace));
const day = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.content.planned_date ?? "");
  if (!m) return props.content.planned_date;
  const text = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(+m[1], +m[2] - 1, +m[3]));
  return text.charAt(0).toUpperCase() + text.slice(1);
});
const metric = computed(() => props.content.primary_target);
// Soglia usata, con la data della rilevazione: quella valida nel giorno della seduta (ADR 0047).
const basis = computed(() => {
  const label = thresholdLabel(props.content.discipline, metric.value, props.scales);
  const since = scaleFor(props.content.discipline, metric.value, props.scales)?.since;
  return label && since ? `${label}, rilevazione del ${formatDate(since)}` : label;
});
const note = computed(() => missingScaleNote(props.content.discipline, metric.value, props.scales));

function duration(step: WorkoutStep): string {
  if (step.duration.type === "distance") return formatMeters(step.duration.meters);
  const s = step.duration.seconds;
  if (s % 60 === 0) return formatMinutes(s);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
const absolute = (step: WorkoutStep) => targetRange(step.target, props.content.discipline, metric.value, props.scales);
const stripe = (step: WorkoutStep) => {
  const z = peakZone(step.target);
  return z ? `var(--zone-${z})` : "var(--zone-unknown)";
};
function isRepeat(b: WorkoutBlock): b is Extract<WorkoutBlock, { kind: "repeat" }> {
  return b.kind === "repeat";
}
</script>

<template>
  <div class="wv">
    <p class="wv-meta">
      <span>{{ day }}</span>
      <span class="wv-dot" aria-hidden="true">·</span>
      <span class="wv-discipline"><component :is="disciplineIcon(content.discipline)" :size="16" aria-hidden="true" />{{ disciplineLabel(content.discipline) }}</span>
    </p>
    <p v-if="content.objective" class="wv-objective">{{ content.objective }}</p>

    <section class="drawer-section">
      <template v-if="content.discipline === 'strength'">
        <div class="drawer-section-head">
          <h2>Durata</h2>
          <span class="muted">{{ content.duration_min ? formatMinutes(content.duration_min * 60) : "Non indicata" }}</span>
        </div>
      </template>
      <template v-else>
        <div class="drawer-section-head">
          <h2>Struttura</h2>
          <span class="muted">{{ formatMinutes(totals.seconds) }}{{ totals.estimated ? " stimati" : "" }}<template v-if="totals.meters">, {{ formatMeters(totals.meters) }} a distanza</template></span>
        </div>
        <StructureBar :discipline="content.discipline" :structure="content.structure" :pace="pace" />
        <p v-if="TARGET_LABELS[metric]" class="wv-basis">
          Target in {{ TARGET_LABELS[metric].toLowerCase() }}<template v-if="basis"> · {{ basis }}</template><template v-else-if="note"> · {{ note }}</template>
        </p>

        <p v-if="!content.structure?.steps.length" class="helper-text">Nessuno step.</p>
        <ol v-else class="wv-list">
          <li v-for="(block, i) in content.structure.steps" :key="i">
            <div v-if="isRepeat(block)" class="wv-repeat">
              <p class="wv-repeat-head">
                <Repeat :size="14" aria-hidden="true" />
                <strong>{{ block.count }} ×</strong>
                <span v-if="block.label">{{ block.label }}</span>
              </p>
              <ol class="wv-list">
                <li v-for="(step, j) in block.steps" :key="j" class="wv-step">
                  <span class="wv-stripe" :style="{ background: stripe(step) }" aria-hidden="true"></span>
                  <span class="wv-what">
                    <span class="wv-role">{{ ROLE_LABELS[step.role] }}</span>
                    <span class="wv-dur">{{ duration(step) }}</span>
                    <span v-if="step.cue" class="wv-cue">{{ step.cue }}</span>
                  </span>
                  <span class="wv-target">
                    <span class="wv-zone">{{ zoneLabel(step.target) || "Senza zona" }}</span>
                    <span v-if="absolute(step)" class="wv-abs">{{ absolute(step) }}</span>
                  </span>
                </li>
              </ol>
            </div>
            <div v-else class="wv-step">
              <span class="wv-stripe" :style="{ background: stripe(block) }" aria-hidden="true"></span>
              <span class="wv-what">
                <span class="wv-role">{{ ROLE_LABELS[block.role] }}</span>
                <span class="wv-dur">{{ duration(block) }}</span>
                <span v-if="block.cue" class="wv-cue">{{ block.cue }}</span>
              </span>
              <span class="wv-target">
                <span class="wv-zone">{{ zoneLabel(block.target) || "Senza zona" }}</span>
                <span v-if="absolute(block)" class="wv-abs">{{ absolute(block) }}</span>
              </span>
            </div>
          </li>
        </ol>
      </template>
    </section>

    <section class="drawer-section">
      <h2>{{ content.discipline === "strength" ? "Esercizi e istruzioni per l'atleta" : "Note per l'atleta" }}</h2>
      <p v-if="content.notes_for_athlete" class="wv-notes">{{ content.notes_for_athlete }}</p>
      <p v-else class="helper-text">Nessuna nota.</p>
    </section>
  </div>
</template>

<style scoped>
.wv { display: flex; flex-direction: column; gap: var(--sp-4); }
.wv-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1) var(--sp-2); margin: 0; font-size: var(--fs-sm); color: var(--text-muted); }
.wv-discipline { display: inline-flex; align-items: center; gap: var(--sp-1); }
.wv-objective { margin: 0; font-size: var(--fs-md); }
.wv-basis { margin: 0; font-size: var(--fs-sm); color: var(--text-muted); }
.wv-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.wv-step {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.wv-stripe { align-self: stretch; border-radius: 2px; }
.wv-what { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--sp-2); min-width: 0; }
.wv-role { font-weight: 600; }
.wv-dur { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.wv-cue { flex-basis: 100%; font-size: var(--fs-sm); color: var(--text-muted); }
.wv-target { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.wv-zone { font-weight: 600; font-variant-numeric: tabular-nums; }
.wv-abs { font-size: var(--fs-sm); color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.wv-repeat {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--surface-2) 55%, var(--bg));
}
.wv-repeat-head { display: flex; align-items: center; gap: var(--sp-1); margin: 0 0 var(--sp-1); font-size: var(--fs-sm); color: var(--text-muted); }
.wv-repeat-head strong { color: var(--text); }
.wv-notes { margin: 0; white-space: pre-line; }
</style>
