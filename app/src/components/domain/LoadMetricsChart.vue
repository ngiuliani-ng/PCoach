<script setup lang="ts">
// Grafico carico (CTL/ATL/TSB + conteggio allenamenti) in SVG puro, con crosshair
// e tooltip al passaggio del mouse o al tocco. Nessun preserveAspectRatio="none":
// il box CSS mantiene lo stesso rapporto del viewBox (aspect-ratio in base.css),
// cosi' meet/slice/none sono equivalenti e non c'e' distorsione (§10 Fase 8).
import { computed, ref } from "vue";

type Entry = { date: string; ctl?: number; atl?: number; tsb?: number; workouts_count?: number };

const props = defineProps<{ log: Entry[] }>();

const W = 600, H = 180, padL = 30, padR = 8, padT = 10, padB = 18;
const innerW = W - padL - padR;
const innerH = H - padT - padB;

const sorted = computed(() => [...props.log].sort((a, b) => (a.date || "").localeCompare(b.date || "")));

const valueRange = computed(() => {
  const values: number[] = [];
  sorted.value.forEach((e) => {
    if (e.ctl != null) values.push(e.ctl);
    if (e.atl != null) values.push(e.atl);
    if (e.tsb != null) values.push(e.tsb);
  });
  if (values.length === 0) return { min: -10, max: 10 };
  const min = Math.min(0, ...values);
  const max = Math.max(10, ...values);
  const pad = (max - min) * 0.1 || 5;
  return { min: min - pad, max: max + pad };
});

function x(i: number): number {
  const n = sorted.value.length;
  if (n <= 1) return padL + innerW / 2;
  return padL + (i / (n - 1)) * innerW;
}
function y(v: number): number {
  const { min, max } = valueRange.value;
  const ratio = (v - min) / (max - min || 1);
  return padT + innerH - ratio * innerH;
}
function yZero(): number {
  return y(0);
}
const maxWorkouts = computed(() => Math.max(1, ...sorted.value.map((e) => e.workouts_count || 0)));
function barHeight(count: number): number {
  return (count / maxWorkouts.value) * innerH * 0.35;
}

function pathFor(key: "ctl" | "atl"): string {
  const pts = sorted.value
    .map((e, i) => (e[key] != null ? `${x(i)},${y(e[key] as number)}` : null))
    .filter(Boolean);
  return pts.length ? "M" + pts.join(" L") : "";
}

const hoverIndex = ref<number | null>(null);
const tooltipX = ref(50); // percentuale, non px: il box renderizzato è più stretto del viewBox su mobile
const tooltipY = ref(4);

function relXFromClientX(svg: SVGSVGElement, clientX: number): number {
  const rect = svg.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * W;
}
function updateHover(relX: number) {
  const n = sorted.value.length;
  if (n === 0) return;
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(x(i) - relX);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  hoverIndex.value = nearest;
  const clampedX = Math.min(Math.max(x(nearest), 60), W - 60);
  tooltipX.value = (clampedX / W) * 100;
}
function onMouseMove(ev: MouseEvent) {
  updateHover(relXFromClientX(ev.currentTarget as SVGSVGElement, ev.clientX));
}
function onMouseLeave() {
  hoverIndex.value = null;
}
function onTouchMove(ev: TouchEvent) {
  const touch = ev.touches[0];
  if (!touch) return;
  updateHover(relXFromClientX(ev.currentTarget as SVGSVGElement, touch.clientX));
}
function onTouchEnd() {
  hoverIndex.value = null;
}

const hoverEntry = computed(() => (hoverIndex.value !== null ? sorted.value[hoverIndex.value] : null));
</script>

<template>
  <div class="chart-wrap">
    <svg
      class="load-chart"
      :viewBox="`0 0 ${W} ${H}`"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchMove"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <line :x1="padL" :x2="W - padR" :y1="yZero()" :y2="yZero()" stroke="var(--border)" stroke-dasharray="3,3" />
      <rect
        v-for="(e, i) in sorted"
        :key="'bar-' + i"
        :x="x(i) - 2"
        :width="4"
        :y="padT + innerH - barHeight(e.workouts_count || 0)"
        :height="barHeight(e.workouts_count || 0)"
        fill="var(--chart-bar)"
      />
      <path :d="pathFor('ctl')" fill="none" stroke="var(--chart-ctl)" stroke-width="2" />
      <path :d="pathFor('atl')" fill="none" stroke="var(--chart-atl)" stroke-width="2" />
      <template v-if="sorted.length">
        <text :x="padL" :y="H - 4" font-size="10" fill="var(--text-muted)">{{ sorted[0].date }}</text>
        <text :x="W - padR" :y="H - 4" font-size="10" fill="var(--text-muted)" text-anchor="end">{{ sorted.at(-1)?.date }}</text>
      </template>
      <text
        v-else
        :x="W / 2"
        :y="padT + innerH / 2"
        text-anchor="middle"
        fill="var(--text-muted)"
        font-size="11"
      >
        <tspan :x="W / 2" dy="-0.6em">Nessun dato di carico.</tspan>
        <tspan :x="W / 2" dy="1.3em">Inserisci la API key in "Connessione con app esterne".</tspan>
      </text>
      <line v-if="hoverIndex !== null" :x1="x(hoverIndex)" :x2="x(hoverIndex)" :y1="padT" :y2="padT + innerH" stroke="var(--text-muted)" stroke-dasharray="2,2" />
    </svg>
    <div class="chart-tooltip" :class="{ visible: hoverEntry }" :style="{ left: tooltipX + '%', top: tooltipY + 'px' }">
      <template v-if="hoverEntry">
        <div>{{ hoverEntry.date }}</div>
        <div>CTL {{ hoverEntry.ctl ?? "—" }} · ATL {{ hoverEntry.atl ?? "—" }} · TSB {{ hoverEntry.tsb ?? "—" }}</div>
        <div>Allenamenti: {{ hoverEntry.workouts_count ?? 0 }}</div>
      </template>
    </div>
    <div class="chart-legend">
      <span><i class="swatch" style="background: var(--chart-ctl)"></i>CTL (fitness)</span>
      <span><i class="swatch" style="background: var(--chart-atl)"></i>ATL (fatica)</span>
      <span><i class="swatch" style="background: var(--chart-bar)"></i>Allenamenti/giorno</span>
    </div>
  </div>
</template>
