<script setup lang="ts">
// Avviso nella scheda quando le zone su Intervals.icu non coincidono con il sistema di zone della
// scheda (ADR 0029). Il confronto parte all'apertura della scheda e usa il profilo salvato; il
// coach sceglie se adottare in PCoach le zone di Intervals.icu o portare Intervals.icu a PCoach.
import { computed, ref, watch } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { useSettingsStore } from "../../stores/settings";
import { hasFtp } from "../../domain/athlete";
import { applyZones, readZones } from "../../services/intervalsSync";
import { showResultToast, showToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { useZoneChange } from "../../composables/useZoneChange";
import {
  icuZonesUpdate, presetsFor, resolveZoneModels, sportSettingsFor, ZONE_MODEL_INFO, ZONE_PRESETS, zoneChecks,
  type IcuSportSettings, type ZoneCheck
} from "@shared/workouts/zoneModels.ts";
import type { ZoneCount } from "@shared/workouts/zones.ts";

const athletes = useAthletesStore();
const settings = useSettingsStore();
const zoneChange = useZoneChange();

const icu = ref<IcuSportSettings[] | null>(null);
const busy = ref(false);
let request = 0;

const saved = computed(() => (athletes.currentId ? athletes.athletes[athletes.currentId] : null));
const apiKey = computed(() => saved.value?.integrations?.intervals_icu_api_key?.trim() ?? "");

async function load() {
  const id = athletes.currentId;
  const mine = ++request;
  icu.value = null;
  if (!id || !apiKey.value) return;
  const res = await readZones(id);
  // Una lettura non riuscita non mostra nulla: la chiave non valida e' gia' segnalata nel Profilo.
  if (mine === request && res.ok) icu.value = res.data.settings;
}
watch([() => athletes.currentId, apiKey], load, { immediate: true });

const checks = computed<ZoneCheck[]>(() => (icu.value && saved.value ? zoneChecks(saved.value, hasFtp(saved.value), icu.value) : []));
const mismatches = computed(() => checks.value.filter((c) => !c.aligned));

const disciplineWord = (c: ZoneCheck) => c.label.split(" (")[0].toLowerCase();
const intervalsText = (c: ZoneCheck) => (c.intervals === null ? "nessuna zona" : `${c.intervals} zone`);

async function usePCoach(c: ZoneCheck) {
  if (athletes.isDirty) {
    showToast("Salva o annulla prima le modifiche della scheda.");
    return;
  }
  if (c.discipline === "swimming") return;
  const n = c.intervals as ZoneCount;
  // Con un piano in corso le sedute da svolgere tornano da verificare: l'avviso e' nella stessa conferma.
  const warning = zoneChange.warningFor([{ discipline: c.discipline, from: c.pcoach, to: n }]);
  const ok = await confirmDialog(
    `Impostare ${n} zone per ${disciplineWord(c)} in PCoach, come su Intervals.icu? Da ora generazione, editor e feedback usano Z1-Z${n}.${warning ? " " + warning : ""}`,
    { confirmLabel: `Usa ${n} zone in PCoach`, tone: "primary" }
  );
  const profile = athletes.currentProfile;
  if (!ok || !profile) return;
  profile.physiological_thresholds![c.discipline]!.zone_system = `${n}-zone`;
  showResultToast(await zoneChange.saveProfile(true));
}

function describe(c: ZoneCheck, bounds: number[]): string {
  const unit = ZONE_MODEL_INFO[c.key].field === "hr_zones" ? " bpm" : "%";
  const upper = bounds.slice(0, -1).map((b, i) => `Z${i + 1} fino a ${b.toLocaleString("it-IT")}${unit}`);
  return `${upper.join(", ")}, Z${bounds.length} oltre`;
}

async function useIntervals(c: ZoneCheck) {
  const id = athletes.currentId;
  const sport = icu.value ? sportSettingsFor(icu.value, c.discipline) : undefined;
  if (!id || !sport) return;
  // Si scrivono i modelli salvati in Impostazioni (gli stessi che legge il server).
  const models = resolveZoneModels(JSON.parse(settings.baseline).zone_models);
  const update = icuZonesUpdate(c.key, c.pcoach, models, sport);
  if (!update.ok) {
    showToast(update.error);
    return;
  }
  const model = models[c.key][c.pcoach]!;
  const preset = ZONE_PRESETS[c.key].find((p) => p.id === model.preset && p.zones === c.pcoach);
  const ok = await confirmDialog(
    `Portare a ${c.pcoach} zone ${c.label.toLowerCase()} su Intervals.icu? Nuove zone (${preset?.label ?? "modello personalizzato"}): ${describe(c, update.bounds)}. Cambiano le zone dell'atleta su Intervals.icu, anche quelle che vede l'atleta.`,
    { confirmLabel: "Aggiorna Intervals.icu", tone: "primary" }
  );
  if (!ok) return;
  busy.value = true;
  const res = await applyZones(id, c.discipline, c.key, c.pcoach);
  busy.value = false;
  if (!res.ok || !res.data.ok) {
    showToast(res.ok ? res.data.error ?? "Aggiornamento non riuscito." : res.error);
    await load();
    return;
  }
  showToast(`Zone aggiornate su Intervals.icu: ${c.pcoach} zone per ${disciplineWord(c)}.`);
  await load();
}

/** Modello che PCoach scriverebbe su Intervals.icu, per il testo del pulsante. */
const modelLabel = (c: ZoneCheck) => {
  const m = settings.settings.zone_models[c.key][c.pcoach];
  return ZONE_PRESETS[c.key].find((p) => p.id === m?.preset && p.zones === c.pcoach)?.label ?? presetsFor(c.key, c.pcoach)[0]?.label ?? "";
};
</script>

<template>
  <div v-if="mismatches.length" class="update-banner zone-align" role="status">
    <p><strong>Zone diverse da Intervals.icu.</strong> PCoach e Intervals.icu devono usare lo stesso numero di zone, altrimenti le sedute e il feedback non corrispondono a ciò che vede l'atleta.</p>
    <ul>
      <li v-for="c in mismatches" :key="c.discipline">
        <span>{{ c.label }}: {{ c.pcoach }} zone in PCoach, {{ intervalsText(c) }} su Intervals.icu.</span>
        <span class="zone-align-actions">
          <button v-if="c.canUseIntervals" type="button" class="link-btn" :disabled="busy" @click="usePCoach(c)">Usa {{ c.intervals }} zone in PCoach</button>
          <button v-if="!c.intervalsBlocked" type="button" class="link-btn" :disabled="busy" :title="modelLabel(c)" @click="useIntervals(c)">Porta Intervals.icu a {{ c.pcoach }} zone</button>
          <span v-else class="helper-text">{{ c.intervalsBlocked }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>
