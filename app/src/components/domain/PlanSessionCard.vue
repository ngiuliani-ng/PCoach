<script setup lang="ts">
// Card compatta per una sessione del piano (§8): icona disciplina, chip zona,
// durata/distanza, note pieghevoli. Sessioni strutturate aggiungono una barra
// segmentata proporzionale alla durata + lista testuale degli step (accessibile,
// non solo visiva).
import { computed, ref } from "vue";
import type { SegmentViewModel, SessionViewModel } from "../../services/planViewModel";
import { zoneColorVar } from "../../services/planViewModel";
import { disciplineIcon } from "../../constants";

const props = defineProps<{ session: SessionViewModel }>();

const notesOpen = ref(false);

function segmentTitle(seg: SegmentViewModel): string {
  if (seg.durationSec == null) return seg.label;
  return `${seg.label} · ${Math.round(seg.durationSec / 60)} min`;
}

const durationOrDistanceText = computed(() => {
  const s = props.session;
  if (s.totalDurationSec != null) return `${Math.round(s.totalDurationSec / 60)}'`;
  if (s.targetDurationMin != null) return `${s.targetDurationMin}'`;
  if (s.targetDistanceKm != null) return `${s.targetDistanceKm} km`;
  return "—";
});
</script>

<template>
  <div class="plan-session">
    <div class="plan-session-head">
      <span class="plan-session-day">
        <span class="discipline-icon" role="img" :aria-label="session.discipline">{{ disciplineIcon(session.discipline) }}</span>
        {{ session.day || "—" }}<span v-if="session.date" class="plan-session-date"> · {{ session.date }}</span>
      </span>
      <span class="plan-session-type">{{ session.sessionType || "Allenamento" }}</span>
      <span class="plan-session-stats">
        {{ durationOrDistanceText }}
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
          :title="segmentTitle(seg)"
        ></span>
      </div>
      <ul class="step-list">
        <li v-for="(t, i) in session.stepsText" :key="i">{{ t }}</li>
      </ul>
    </template>
    <p v-else-if="!session.isStructured" class="helper-text plan-session-meta">
      Zona: {{ session.targetZone || "—" }}
      <template v-if="session.targetDurationMin != null"> · Durata: {{ session.targetDurationMin }}'</template>
      <template v-if="session.targetDistanceKm != null"> · Distanza: {{ session.targetDistanceKm }} km</template>
    </p>

    <button
      v-if="session.notes"
      type="button"
      class="link-btn plan-session-notes-toggle"
      @click="notesOpen = !notesOpen"
    >{{ notesOpen ? "Nascondi note" : "Mostra note" }}</button>
    <p v-if="session.notes && notesOpen" class="plan-session-notes">{{ session.notes }}</p>
  </div>
</template>

<style scoped>
.plan-session {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--surface);
}
.plan-session-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.plan-session-day { font-weight: 500; display: flex; align-items: center; gap: 6px; }
.discipline-icon { font-size: 14px; }
.plan-session-date { color: var(--text-muted); font-weight: 400; }
.plan-session-type { color: var(--text-muted); flex: 1; min-width: 80px; }
.plan-session-stats { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); }
.zone-chip {
  border: 1.5px solid var(--zone-unknown);
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 11px;
  font-family: var(--font-ui);
}
.segment-bar {
  display: flex;
  height: 14px;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
  background: var(--surface-2);
}
.segment { min-width: 6px; }
.segment + .segment { border-left: 1px solid var(--surface); }
.step-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.plan-session-meta { margin: 8px 0 0; }
.plan-session-notes-toggle { font-size: 11.5px; margin-top: 6px; }
.plan-session-notes { font-size: 12.5px; margin: 6px 0 0; white-space: pre-wrap; }
</style>
