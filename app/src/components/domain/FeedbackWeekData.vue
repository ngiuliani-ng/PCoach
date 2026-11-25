<script setup lang="ts">
// Dati della settimana per il coach (ADR 0046), dal contratto calcolato da PCoach (feedback_input):
// volume per disciplina rispetto al piano, intensita' prevista e svolta, benessere e RPE rispetto alla
// media di 28 giorni, carico di Intervals.icu e confronto con la settimana precedente.
// Descrittivi come il contratto: nessun colore di giudizio (bene/male) sui valori. Ogni grafico ha i
// numeri scritti accanto, cosi' si legge anche senza colori.
import { computed } from "vue";
import type { FeedbackInput } from "@shared/feedback/contract.ts";
import { disciplineLabel, formatSigned } from "../../constants";

// part: quale voce dei «Dettagli» della settimana (FeedbackWeek.vue) mostrare.
const props = defineProps<{ input: FeedbackInput; part: "volume" | "wellness" }>();

interface Volume { planned_min: number; matched_min: number; extra_min: number; volume_ratio: number | null }
interface Intensity { domains: string; planned: number[] | null; observed: number[] | null; basis_min: number; reportable: boolean }
interface Compare { week_mean: number; baseline_mean_28d: number | null; change_pct: number | null; week_days: number }

const num = (v: number, digits = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

// ---------- Volume per disciplina ----------
const volumes = computed(() => {
  const rows = Object.entries((props.input.metrics?.by_discipline ?? {}) as Record<string, Volume>)
    .map(([d, v]) => ({ d, label: disciplineLabel(d), ...v }))
    .filter((v) => v.planned_min > 0 || v.matched_min > 0 || v.extra_min > 0);
  const max = Math.max(1, ...rows.map((v) => Math.max(v.planned_min, v.matched_min + v.extra_min)));
  return rows.map((v) => ({
    ...v,
    plannedW: (v.planned_min / max) * 100,
    doneW: (v.matched_min / max) * 100,
    extraW: (v.extra_min / max) * 100,
    text: v.planned_min > 0
      ? `${num(v.matched_min)} su ${num(v.planned_min)} min · ${pct(v.volume_ratio)}`
      : "nessuna seduta prevista"
  }));
});

// ---------- Intensita' ----------
const DOMAINS = ["Bassa", "Media", "Alta"] as const;
const intensities = computed(() => Object.entries((props.input.metrics?.intensity ?? {}) as Record<string, Intensity>)
  .filter(([, v]) => v.planned || v.observed)
  .map(([d, v]) => ({ d, label: disciplineLabel(d), ...v })));
const shareText = (s: number[] | null) => (s ? s.map((x, i) => `${DOMAINS[i].toLowerCase()} ${Math.round(x * 100)}%`).join(" · ") : "—");

// ---------- Benessere e RPE ----------
const wellness = computed(() => {
  const r = props.input.response;
  if (!r?.wellness || !r.rpe) return [];
  const w = r.wellness;
  const tile = (label: string, c: Compare | null, unit: string, digits = 0) => ({
    label,
    value: c ? `${num(c.week_mean, digits)}${unit}` : "—",
    detail: !c ? "nessun dato"
      : c.change_pct !== null && c.baseline_mean_28d !== null ? `${formatSigned(c.change_pct)}% sulla media di 28 giorni (${num(c.baseline_mean_28d, digits)}${unit})`
      : `${c.week_days} giorni con il dato, media di 28 giorni non disponibile`
  });
  const rpe = r.rpe;
  return [
    tile("HRV", w.hrv as Compare | null, " ms"),
    tile("Frequenza a riposo", w.resting_hr as Compare | null, " bpm"),
    tile("Sonno", w.sleep_hours as Compare | null, " h", 1),
    {
      label: "RPE medio",
      value: rpe.mean !== null ? num(rpe.mean, 1) : "—",
      detail: rpe.of ? `inserito in ${rpe.rated} attività su ${rpe.of}` : "nessuna attività"
    }
  ];
});

// ---------- Carico e confronto con la settimana precedente ----------
const load = computed(() => props.input.metrics?.load_status ?? null);
const trend = computed(() => {
  const t = props.input.metrics?.trend;
  if (!t?.endurance_minutes) return null;
  const e = t.endurance_minutes;
  const change = e.change_pct !== null ? ` (${formatSigned(e.change_pct)}%)` : "";
  const expected = t.expected_change_pct ? ` · atteso da ${formatSigned(t.expected_change_pct.min_pct)}% a ${formatSigned(t.expected_change_pct.max_pct)}%` : "";
  return {
    value: `${num(e.current)} min contro ${num(e.previous)}${change}`,
    detail: t.comparable ? `${t.comparison_reason}${expected}` : `non confrontabile: ${t.comparison_reason}`
  };
});
</script>

<template>
  <div class="week-data">

    <div v-if="part === 'volume' && volumes.length" class="week-data-group">
      <p class="week-data-label">Volume rispetto al piano</p>
      <ul class="vol-rows">
        <li v-for="v in volumes" :key="v.d" class="vol-row">
          <span class="vol-name">{{ v.label }}</span>
          <span class="vol-track" aria-hidden="true">
            <span class="vol-planned" :style="{ width: v.plannedW + '%' }"></span>
            <span class="vol-done" :style="{ width: v.doneW + '%' }"></span>
            <span v-if="v.extra_min" class="vol-extra" :style="{ left: v.doneW + '%', width: v.extraW + '%' }"></span>
          </span>
          <span class="vol-text">{{ v.text }}<template v-if="v.extra_min"> · +{{ v.extra_min }} min extra</template></span>
        </li>
      </ul>
      <ul class="chart-legend week-data-legend" aria-hidden="true">
        <li><i class="swatch" style="background: var(--accent)"></i>Svolto nelle sedute</li>
        <li><i class="swatch swatch-outline"></i>Previsto</li>
        <li v-if="volumes.some((v) => v.extra_min)"><i class="swatch swatch-hatch"></i>Attività extra</li>
      </ul>
    </div>

    <div v-if="part === 'volume' && intensities.length" class="week-data-group">
      <p class="week-data-label">Intensità prevista e svolta</p>
      <div v-for="it in intensities" :key="it.d" class="int-block">
        <p class="int-name">{{ it.label }} <span class="review-muted">· {{ it.domains }}</span></p>
        <div v-for="[name, shares] in ([['Previsto', it.planned], ['Svolto', it.observed]] as const)" :key="name" class="int-row">
          <span class="int-kind">{{ name }}</span>
          <span v-if="shares" class="int-bar" aria-hidden="true">
            <span v-for="(s, i) in shares" v-show="s > 0" :key="i" class="int-seg" :class="`int-${i}`" :style="{ flexGrow: s }"></span>
          </span>
          <span v-else class="int-bar int-empty" aria-hidden="true"></span>
          <span class="int-text">{{ shareText(shares) }}</span>
        </div>
        <p v-if="!it.reportable" class="helper-text">Svolto su {{ it.basis_min }} minuti con i dati delle zone: troppo pochi per confrontarlo con il previsto.</p>
      </div>
      <ul class="chart-legend week-data-legend" aria-hidden="true">
        <li><i class="swatch" style="background: var(--chart-int-low)"></i>Bassa</li>
        <li><i class="swatch" style="background: var(--chart-int-mid)"></i>Media</li>
        <li><i class="swatch" style="background: var(--chart-int-high)"></i>Alta</li>
      </ul>
    </div>

    <div v-if="part === 'wellness' && wellness.length" class="week-data-group">
      <p class="week-data-label">Benessere e RPE</p>
      <dl class="stat-tiles">
        <div v-for="t in wellness" :key="t.label" class="stat-tile">
          <dt>{{ t.label }}</dt>
          <dd class="stat-value">{{ t.value }}</dd>
          <dd class="stat-detail">{{ t.detail }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="part === 'wellness' && (load || trend)" class="week-data-group">
      <p class="week-data-label">Carico e settimana precedente</p>
      <dl class="stat-tiles">
        <div v-if="load" class="stat-tile">
          <dt>Fitness (CTL)</dt>
          <dd class="stat-value">{{ load.ctl_start !== null ? `${num(load.ctl_start, 1)} → ` : "" }}{{ num(load.ctl_end, 1) }}</dd>
          <dd class="stat-detail">media del carico a 42 giorni, da Intervals.icu</dd>
        </div>
        <div v-if="load && load.atl_end !== null" class="stat-tile">
          <dt>Fatica (ATL)</dt>
          <dd class="stat-value">{{ num(load.atl_end, 1) }}</dd>
          <dd class="stat-detail">media del carico a 7 giorni, a fine settimana</dd>
        </div>
        <div v-if="trend" class="stat-tile stat-tile-wide">
          <dt>Endurance rispetto alla settimana prima</dt>
          <dd class="stat-value">{{ trend.value }}</dd>
          <dd class="stat-detail">{{ trend.detail }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
