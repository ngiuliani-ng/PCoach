<script setup lang="ts">
// Andamento dell'aderenza nella tab Feedback (ADR 0046): una barra per settimana, le ultime 8.
// Una sola serie, quindi niente legenda: il titolo la nomina. Barre in HTML, non in SVG, perche' ogni
// settimana e' un pulsante (tastiera, lettori di schermo) che apre quella settimana nell'elenco.
// Il valore e' scritto sull'ultima settimana e in un tooltip al passaggio o al focus; il nome
// accessibile di ogni pulsante contiene valore e stato, e l'elenco delle settimane resta la vista testuale.
import { computed, ref } from "vue";
import type { ReviewRecord } from "../../stores/reviews";
import { adherenceOf, coachAdherence } from "@shared/feedback/adherence.ts";
import { addDaysISO } from "@shared/workouts/calendar.ts";
import { formatDate } from "../../constants";
import { reviewStatusLabel } from "../../domain/feedbackText";

const props = defineProps<{ reviews: ReviewRecord[]; selected?: string | null }>();
const emit = defineEmits<{ open: [id: string] }>();

const WEEKS = 8;

interface Week { id: string; start: string; pct: number | null; adherence: string; status: string; short: string; range: string }

const weeks = computed<Week[]>(() => {
  // L'ultima revisione di ogni settimana.
  const latest = new Map<string, ReviewRecord>();
  for (const r of props.reviews) {
    const prev = latest.get(r.period_start);
    if (!prev || r.revision > prev.revision) latest.set(r.period_start, r);
  }
  return [...latest.values()]
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .slice(-WEEKS)
    .map((r) => {
      const a = r.input?.metrics ? adherenceOf(r.input.metrics) : null;
      return {
        id: r.id,
        start: r.period_start,
        pct: a?.pct ?? null,
        adherence: a ? coachAdherence(a) : "Aderenza non ancora calcolata",
        status: reviewStatusLabel(r),
        short: formatDate(r.period_start, false),
        range: `${formatDate(r.period_start, false)} – ${formatDate(addDaysISO(r.period_start, 6))}`
      };
    });
});

const hover = ref<number | null>(null);
const hovered = computed(() => (hover.value !== null ? weeks.value[hover.value] : null));
/** Posizione del tooltip in percentuale della larghezza, tenuto dentro il riquadro ai bordi. */
const tooltipLeft = computed(() => {
  if (hover.value === null) return 50;
  const n = weeks.value.length;
  return Math.min(Math.max(((hover.value + 0.5) / n) * 100, 18), 82);
});
const last = computed(() => weeks.value.length - 1);
</script>

<template>
  <section class="block adherence-trend" aria-labelledby="trend-title">
    <h2 id="trend-title">Aderenza delle ultime settimane</h2>
    <div class="trend-card">
    <div class="trend-plot" @mouseleave="hover = null">
      <!-- Griglia recessiva: 0, 50 e 100%. -->
      <div class="trend-grid" aria-hidden="true">
        <span v-for="t in [100, 50, 0]" :key="t" class="trend-gridline" :style="{ bottom: t + '%' }"><span class="trend-tick">{{ t }}%</span></span>
      </div>
      <ol class="trend-cols">
        <li v-for="(w, i) in weeks" :key="w.id">
          <button
            type="button"
            class="trend-col"
            :class="{ selected: selected === w.id }"
            :aria-current="selected === w.id ? 'true' : undefined"
            :aria-label="`Settimana ${w.range}: ${w.adherence}. ${w.status}. Apri il feedback`"
            @click="emit('open', w.id)"
            @mouseenter="hover = i"
            @focus="hover = i"
            @blur="hover = null"
          >
            <span class="trend-area" aria-hidden="true">
              <span v-if="w.pct !== null" class="trend-bar" :style="{ height: Math.max(w.pct, 1) + '%' }">
                <span v-if="i === last" class="trend-value">{{ w.pct }}%</span>
              </span>
              <span v-else class="trend-nc">n.c.</span>
            </span>
            <span class="trend-week" aria-hidden="true">{{ w.short }}</span>
          </button>
        </li>
      </ol>
      <div class="chart-tooltip trend-tooltip" :class="{ visible: hovered }" :style="{ left: tooltipLeft + '%' }" aria-hidden="true">
        <template v-if="hovered">
          <div class="chart-tooltip-date">{{ hovered.range }}</div>
          <div>{{ hovered.adherence }}</div>
          <div class="review-muted">{{ hovered.status }}</div>
        </template>
      </div>
    </div>
    </div>
    <p class="helper-text">Sedute svolte sulle sedute valutabili; un clic su una settimana la apre qui sotto. «n.c.»: non calcolabile.</p>
  </section>
</template>
