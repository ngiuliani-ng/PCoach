<script setup lang="ts">
// Riga di una sessione del piano (§8), dentro il blocco settimana: icona disciplina, giorno
// e data, tipo, durata, distanza e chip zona; note pieghevoli. Sessioni strutturate
// aggiungono una barra segmentata proporzionale alla durata (colori di zona) + lista
// testuale degli step (accessibile, non solo visiva).
import { computed, ref } from "vue";
import type { SessionViewModel } from "../../services/planViewModel";
import { zoneColorVar } from "../../services/planViewModel";
import { DAY_LABELS, disciplineIcon, disciplineLabel, formatDate } from "../../constants";

const props = defineProps<{ session: SessionViewModel }>();

const notesOpen = ref(false);

const dayText = computed(() => {
  const d = props.session.day;
  return DAY_LABELS.find(([k]) => k === d)?.[1] ?? d ?? "";
});

const durationText = computed(() => {
  const s = props.session;
  if (s.totalDurationSec != null) return `${Math.round(s.totalDurationSec / 60)} min`;
  if (s.targetDurationMin != null) return `${s.targetDurationMin} min`;
  return "";
});
const distanceText = computed(() =>
  props.session.targetDistanceKm != null ? `${props.session.targetDistanceKm.toLocaleString("it-IT")} km` : ""
);
</script>

<template>
  <div class="plan-session">
    <div class="plan-session-head">
      <component
        :is="disciplineIcon(session.discipline)"
        :size="16"
        class="discipline-icon"
        role="img"
        :aria-label="disciplineLabel(session.discipline) || 'Disciplina non indicata'"
      />
      <span class="plan-session-day">
        {{ dayText || "Giorno non indicato" }}
        <span v-if="session.date" class="plan-session-date">{{ formatDate(session.date, false) }}</span>
      </span>
      <span class="plan-session-type">{{ session.sessionType || "Allenamento" }}</span>
      <span class="plan-session-stats">
        <span v-if="durationText">{{ durationText }}</span>
        <span v-if="distanceText">{{ distanceText }}</span>
        <span
          v-if="session.targetZone"
          class="zone-chip"
          :style="{ borderColor: zoneColorVar(session.targetZone) }"
        >{{ session.targetZone }}</span>
      </span>
    </div>

    <template v-if="session.isStructured && session.segments.length">
      <div class="segment-bar" role="img" :aria-label="session.stepsText.join(', ')">
        <span
          v-for="(seg, i) in session.segments"
          :key="i"
          class="segment"
          :style="{ flexGrow: seg.widthPercent, background: zoneColorVar(seg.zone) }"
        ></span>
      </div>
      <ul class="step-list">
        <li v-for="(t, i) in session.stepsText" :key="i">{{ t }}</li>
      </ul>
    </template>

    <button
      v-if="session.notes"
      type="button"
      class="link-btn plan-session-notes-toggle"
      :aria-expanded="notesOpen"
      @click="notesOpen = !notesOpen"
    >{{ notesOpen ? "Nascondi note" : "Mostra note" }}</button>
    <p v-if="session.notes && notesOpen" class="plan-session-notes">{{ session.notes }}</p>
  </div>
</template>

<style scoped>
.plan-session {
  padding: var(--sp-3) var(--sp-4);
  font-size: var(--fs-sm);
}
.plan-session + .plan-session { border-top: 1px solid var(--border); }
.plan-session-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
}
.discipline-icon { color: var(--text-muted); flex-shrink: 0; }
.plan-session-day { font-weight: 600; width: 128px; flex-shrink: 0; }
.plan-session-date { color: var(--text-muted); font-weight: 400; margin-left: var(--sp-1); }
.plan-session-type { flex: 1; min-width: 120px; }
.plan-session-stats { display: flex; align-items: center; gap: var(--sp-3); color: var(--text-muted); }
.zone-chip {
  border: 2px solid var(--zone-unknown);
  border-radius: 999px;
  padding: 0 var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--text);
}
.segment-bar {
  display: flex;
  height: 12px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-top: var(--sp-2);
  background: var(--surface-2);
}
.segment { min-width: 6px; }
.segment + .segment { border-left: 1px solid var(--surface); }
.step-list {
  margin: var(--sp-2) 0 0;
  padding-left: var(--sp-5);
  color: var(--text-muted);
}
.plan-session-notes-toggle { font-size: var(--fs-xs); margin-top: var(--sp-2); color: var(--text-muted); }
.plan-session-notes { margin: var(--sp-2) 0 0; white-space: pre-wrap; max-width: 70ch; }
</style>
