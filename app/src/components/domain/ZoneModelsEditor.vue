<script setup lang="ts">
// Modelli di zone per allineare Intervals.icu a PCoach (ADR 0029): per ogni misura e sistema di
// zone, un modello noto (preset) o limiti personalizzati, in percentuale della soglia. Spiegazione nella
// guida della sezione, ripristino in SettingsPanel.
import { watch } from "vue";
import { useSettingsStore } from "../../stores/settings";
import { boundsError, presetsFor, ZONE_MODEL_INFO, ZONE_MODEL_KEYS, ZONE_PRESETS, type ZoneModelKey } from "@shared/workouts/zoneModels.ts";
import type { ZoneCount } from "@shared/workouts/zones.ts";

const settings = useSettingsStore();

const model = (key: ZoneModelKey, n: ZoneCount) => settings.settings.zone_models[key][n]!;

function presetOf(key: ZoneModelKey, id: string) {
  return ZONE_PRESETS[key].find((p) => p.id === id);
}

function choosePreset(key: ZoneModelKey, n: ZoneCount, id: string) {
  const p = presetOf(key, id);
  settings.settings.zone_models[key][n] = p ? { preset: p.id, bounds: [...p.bounds] } : { preset: "custom", bounds: [...model(key, n).bounds] };
}

/** Un limite cambiato a mano rende il modello personalizzato, salvo che torni uguale a un preset. */
function setBound(key: ZoneModelKey, n: ZoneCount, i: number, value: number) {
  const bounds = [...model(key, n).bounds];
  bounds[i] = value;
  const same = presetsFor(key, n).find((p) => p.bounds.length === bounds.length && p.bounds.every((b, j) => b === bounds[j]));
  settings.settings.zone_models[key][n] = { preset: same?.id ?? "custom", bounds };
}

// Una misura con un limite non valido si apre da sola, cosi' l'errore sotto i campi si vede (audit A-14);
// non si richiude quando l'errore sparisce, per non chiuderla mentre il coach scrive.
const detailsEls: Partial<Record<ZoneModelKey, HTMLDetailsElement>> = {};
const invalidKeys = () => ZONE_MODEL_KEYS.filter((key) => ZONE_MODEL_INFO[key].counts.some((n) => boundsError(key, n, model(key, n).bounds)));
watch(invalidKeys, (keys) => keys.forEach((key) => { const el = detailsEls[key]; if (el) el.open = true; }), { immediate: true, flush: "post" });
</script>

<template>
  <details v-for="key in ZONE_MODEL_KEYS" :key="key" :ref="(el) => { if (el) detailsEls[key] = el as HTMLDetailsElement; }" class="review-sessions zone-models">
    <summary>{{ ZONE_MODEL_INFO[key].label }} <span class="helper-text">({{ ZONE_MODEL_INFO[key].unit }})</span></summary>
    <div v-for="n in ZONE_MODEL_INFO[key].counts" :key="n" class="zone-model">
      <label class="field">
        <span class="field-label">Modello a {{ n }} zone</span>
        <select :value="model(key, n).preset" @change="choosePreset(key, n, ($event.target as HTMLSelectElement).value)">
          <option v-for="p in presetsFor(key, n)" :key="p.id" :value="p.id">{{ p.label }}</option>
          <option value="custom">Personalizzato</option>
        </select>
      </label>
      <div class="zone-bounds" role="group" :aria-label="`${ZONE_MODEL_INFO[key].label}, ${n} zone: limiti in percentuale`">
        <label v-for="(b, i) in model(key, n).bounds" :key="i" class="field">
          <span class="field-label">Z{{ i + 1 }} fino a</span>
          <input type="number" step="0.1" :value="b" :aria-invalid="!!boundsError(key, n, model(key, n).bounds)"
            @input="setBound(key, n, i, Number(($event.target as HTMLInputElement).value))" />
        </label>
        <span class="zone-bounds-last helper-text">Z{{ n }} oltre</span>
      </div>
      <p v-if="boundsError(key, n, model(key, n).bounds)" class="error-text helper-text">{{ boundsError(key, n, model(key, n).bounds) }}</p>
      <p v-else-if="presetOf(key, model(key, n).preset)" class="helper-text">Fonte: {{ presetOf(key, model(key, n).preset)!.source }}</p>
    </div>
  </details>
</template>
