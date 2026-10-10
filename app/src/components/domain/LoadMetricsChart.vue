<script setup lang="ts">
// Grafico carico in SVG puro (ADR 0016): CTL (fitness) come linea piena color inchiostro,
// ATL (fatica) come linea sottile, TSB (forma) come banda tra lo zero e il valore, cosi'
// il segno si legge dalla posizione rispetto allo zero senza un colore dedicato. Gli
// allenamenti al giorno stanno in una striscia separata sotto il grafico. Crosshair e
// tooltip al passaggio del mouse o al tocco. Nessun preserveAspectRatio="none": il box CSS
// mantiene lo stesso rapporto del viewBox (aspect-ratio in base.css), quindi niente distorsione.
import { computed, ref } from "vue";
import { formatDate, formatSigned } from "../../constants";

type Entry = { date: string; ctl?: number; atl?: number; tsb?: number; workouts_count?: number };

const props = defineProps<{ log: Entry[] }>();

const W = 600, H = 200, padL = 34, padR = 8, padT = 10;
const STRIP_H = 14, STRIP_GAP = 8, DATE_H = 16;
const innerW = W - padL - padR;
const innerH = H - padT - STRIP_GAP - STRIP_H - DATE_H;
const stripTop = padT + innerH + STRIP_GAP;

const sorted = computed(() => [...props.log].sort((a, b) => (a.date || "").localeCompare(b.date || "")));

// Passo "tondo" (1, 2, 5 × 10^n) per le etichette dell'asse y.
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

const scale = computed(() => {
  const values: number[] = [];
  sorted.value.forEach((e) => {
    if (e.ctl != null) values.push(e.ctl);
    if (e.atl != null) values.push(e.atl);
    if (e.tsb != null) values.push(e.tsb);
  });
  const rawMin = values.length ? Math.min(0, ...values) : -10;
  const rawMax = values.length ? Math.max(10, ...values) : 10;
  const step = niceStep((rawMax - rawMin) / 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { min, max, ticks };
});

function x(i: number): number {
  const n = sorted.value.length;
  if (n <= 1) return padL + innerW / 2;
  return padL + (i / (n - 1)) * innerW;
}
function y(v: number): number {
  const { min, max } = scale.value;
  const ratio = (v - min) / (max - min || 1);
  return padT + innerH - ratio * innerH;
}
const maxWorkouts = computed(() => Math.max(1, ...sorted.value.map((e) => e.workouts_count || 0)));
function barHeight(count: number): number {
  return (count / maxWorkouts.value) * STRIP_H;
}

function pathFor(key: "ctl" | "atl"): string {
  const pts = sorted.value
    .map((e, i) => (e[key] != null ? `${x(i)},${y(e[key] as number)}` : null))
    .filter(Boolean);
  return pts.length ? "M" + pts.join(" L") : "";
}

const tsbArea = computed(() => {
  const pts = sorted.value
    .map((e, i) => (e.tsb != null ? { x: x(i), y: y(e.tsb) } : null))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 2) return "";
  const zero = y(0);
  return `M${pts[0].x},${zero} ` + pts.map((p) => `L${p.x},${p.y}`).join(" ") + ` L${pts.at(-1)!.x},${zero} Z`;
});

// Ultimo valore noto di ciascuna serie, mostrato nella legenda.
function latest(key: "ctl" | "atl" | "tsb"): number | null {
  for (let i = sorted.value.length - 1; i >= 0; i--) {
    const v = sorted.value[i][key];
    if (v != null) return v;
  }
  return null;
}
const current = computed(() => ({ ctl: latest("ctl"), atl: latest("atl"), tsb: latest("tsb") }));
const summary = computed(() => {
  const c = current.value;
  const parts = [];
  if (c.ctl != null) parts.push(`fitness ${Math.round(c.ctl)}`);
  if (c.atl != null) parts.push(`fatica ${Math.round(c.atl)}`);
  if (c.tsb != null) parts.push(`forma ${formatSigned(c.tsb)}`);
  return `Grafico del carico dal ${formatDate(sorted.value[0]?.date)} al ${formatDate(sorted.value.at(-1)?.date)}. Valori attuali: ${parts.join(", ")}.`;
});

const hoverIndex = ref<number | null>(null);
const tooltipX = ref(50); // percentuale, non px: il box renderizzato è più stretto del viewBox su mobile

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
  const clampedX = Math.min(Math.max(x(nearest), 70), W - 70);
  tooltipX.value = (clampedX / W) * 100;
}
function onMouseMove(ev: MouseEvent) {
  updateHover(relXFromClientX(ev.currentTarget as SVGSVGElement, ev.clientX));
}
function onLeave() {
  hoverIndex.value = null;
}
function onTouchMove(ev: TouchEvent) {
  const touch = ev.touches[0];
  if (!touch) return;
  updateHover(relXFromClientX(ev.currentTarget as SVGSVGElement, touch.clientX));
}

const hoverEntry = computed(() => (hoverIndex.value !== null ? sorted.value[hoverIndex.value] : null));
function fmt(v: number | undefined): string {
  return v == null ? "—" : String(Math.round(v));
}
</script>

<template>
  <div class="chart-wrap">
    <div v-if="!sorted.length" class="chart-empty">
      <slot name="empty"><p>Nessun dato di carico.</p></slot>
    </div>
    <template v-else>
      <svg
        class="load-chart"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="summary"
        @mousemove="onMouseMove"
        @mouseleave="onLeave"
        @touchstart="onTouchMove"
        @touchmove="onTouchMove"
        @touchend="onLeave"
        @touchcancel="onLeave"
      >
        <g v-for="t in scale.ticks" :key="'tick-' + t">
          <line
            :x1="padL" :x2="W - padR" :y1="y(t)" :y2="y(t)"
            :stroke="t === 0 ? 'var(--text-muted)' : 'var(--border)'"
            :stroke-width="t === 0 ? 1 : 0.75"
          />
          <text :x="padL - 6" :y="y(t) + 3.5" font-size="10" fill="var(--text-muted)" text-anchor="end" class="chart-num">{{ t }}</text>
        </g>
        <path v-if="tsbArea" :d="tsbArea" fill="var(--chart-tsb)" />
        <path :d="pathFor('atl')" fill="none" stroke="var(--chart-atl)" stroke-width="1.25" />
        <path :d="pathFor('ctl')" fill="none" stroke="var(--chart-ctl)" stroke-width="2.25" />
        <rect
          v-for="(e, i) in sorted"
          :key="'bar-' + i"
          :x="x(i) - 1.5"
          :width="3"
          :y="stripTop + STRIP_H - barHeight(e.workouts_count || 0)"
          :height="barHeight(e.workouts_count || 0)"
          fill="var(--chart-bar)"
        />
        <text :x="padL" :y="H - 3" font-size="10" fill="var(--text-muted)">{{ formatDate(sorted[0].date) }}</text>
        <text :x="W - padR" :y="H - 3" font-size="10" fill="var(--text-muted)" text-anchor="end">{{ formatDate(sorted.at(-1)?.date) }}</text>
        <line v-if="hoverIndex !== null" :x1="x(hoverIndex)" :x2="x(hoverIndex)" :y1="padT" :y2="stripTop + STRIP_H" stroke="var(--text-muted)" stroke-dasharray="2,2" />
      </svg>
      <div class="chart-tooltip" :class="{ visible: hoverEntry }" :style="{ left: tooltipX + '%' }" aria-hidden="true">
        <template v-if="hoverEntry">
          <div class="chart-tooltip-date">{{ formatDate(hoverEntry.date) }}</div>
          <dl>
            <dt>Fitness (CTL)</dt><dd>{{ fmt(hoverEntry.ctl) }}</dd>
            <dt>Fatica (ATL)</dt><dd>{{ fmt(hoverEntry.atl) }}</dd>
            <dt>Forma (TSB)</dt><dd>{{ hoverEntry.tsb == null ? "—" : formatSigned(hoverEntry.tsb) }}</dd>
            <dt>Allenamenti</dt><dd>{{ hoverEntry.workouts_count ?? 0 }}</dd>
          </dl>
        </template>
      </div>
      <ul class="chart-legend">
        <li><i class="swatch swatch-line" style="background: var(--chart-ctl)"></i>Fitness (CTL)<strong v-if="current.ctl != null">{{ Math.round(current.ctl) }}</strong></li>
        <li><i class="swatch swatch-line swatch-thin" style="background: var(--chart-atl)"></i>Fatica (ATL)<strong v-if="current.atl != null">{{ Math.round(current.atl) }}</strong></li>
        <li><i class="swatch" style="background: var(--chart-tsb)"></i>Forma (TSB)<strong v-if="current.tsb != null">{{ formatSigned(current.tsb) }}</strong></li>
        <li><i class="swatch swatch-bar" style="background: var(--chart-bar)"></i>Allenamenti al giorno</li>
      </ul>
    </template>
  </div>
</template>
