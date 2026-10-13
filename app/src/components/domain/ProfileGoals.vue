<script setup lang="ts">
// Profilo › Obiettivi: obiettivo principale e secondario, periodizzazione che ne deriva ed eventi target
// (solo per la preparazione a una gara), con tapering per evento.
import { computed, watch } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import {
  OBJECTIVE_OPTIONS, SHARED_OBJECTIVE_OPTIONS, EVENT_DISCIPLINE_OPTIONS, EVENT_PRIORITIES, PERIODIZATION_LABELS, numOrNull
} from "../../constants";
import { DEFAULT_TAPER_WEEKS } from "../../domain/planWeeks";
import IconButton from "../ui/IconButton.vue";
import { Plus, Trash2 } from "lucide-vue-next";

const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);

// Solo una scelta del coach sulla stessa scheda, non l'apertura di una scheda diversa.
watch(
  () => [athletes.currentProfile, athletes.currentProfile?.goals.primary_objective] as const,
  ([current, newVal], [previous]) => {
    if (!current || current !== previous) return;
    profile.value.goals.periodization_model = newVal === "preparazione_gara" ? "race_peak_taper" : "continuous_improvement";
    if (newVal === "preparazione_gara" && (!profile.value.goals.target_events || profile.value.goals.target_events.length === 0)) {
      profile.value.goals.target_events = [{ name: "", date: "", discipline: "running", distance_or_duration: "", priority: "A", target_result: "" }];
    }
    if (profile.value.goals.secondary_objective === newVal) {
      profile.value.goals.secondary_objective = "";
    }
  }
);

const secondaryOptions = computed(() => SHARED_OBJECTIVE_OPTIONS.filter(([v]) => v !== profile.value.goals.primary_objective));
const showTargetEvents = computed(() => profile.value.goals.primary_objective === "preparazione_gara");

function addTargetEvent() {
  profile.value.goals.target_events = profile.value.goals.target_events || [];
  profile.value.goals.target_events.push({ name: "", date: "", discipline: "running", distance_or_duration: "", priority: "B", target_result: "" });
}
function removeTargetEvent(i: number) {
  profile.value.goals.target_events?.splice(i, 1);
}
</script>

<template>
  <div class="field-row">
    <label class="field">
      <span class="field-label">Obiettivo principale</span>
      <select v-model="profile.goals.primary_objective">
        <option v-for="[v, l] in OBJECTIVE_OPTIONS" :key="v" :value="v">{{ l }}</option>
      </select>
    </label>
    <label v-if="profile.goals.primary_objective === 'altro'" class="field">
      <span class="field-label">Dettaglio dell'obiettivo principale</span>
      <input type="text" v-model="profile.goals.primary_objective_detail" />
    </label>
  </div>
  <div class="field-row">
    <label class="field">
      <span class="field-label">Obiettivo secondario</span>
      <select v-model="profile.goals.secondary_objective">
        <option value="">Nessuno</option>
        <option v-for="[v, l] in secondaryOptions" :key="v" :value="v">{{ l }}</option>
      </select>
    </label>
    <label v-if="profile.goals.secondary_objective === 'altro'" class="field">
      <span class="field-label">Dettaglio dell'obiettivo secondario</span>
      <input type="text" v-model="profile.goals.secondary_objective_detail" />
    </label>
  </div>
  <p class="field-static">
    <span class="field-label">Periodizzazione</span>
    {{ PERIODIZATION_LABELS[profile.goals.periodization_model] || profile.goals.periodization_model }}
  </p>

  <template v-if="showTargetEvents">
    <h4 class="subsection-title">Eventi target</h4>
    <div v-for="(ev, i) in profile.goals.target_events" :key="i" class="unit">
      <div class="unit-head">
        <span class="unit-title">{{ ev.name || "Evento senza nome" }}</span>
        <IconButton :label="`Rimuovi ${ev.name || 'evento senza nome'}`" @click="removeTargetEvent(i)">
          <Trash2 :size="16" aria-hidden="true" />
        </IconButton>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Nome</span><input type="text" v-model="ev.name" /></label>
        <label class="field"><span class="field-label">Data</span><input type="date" v-model="ev.date" /></label>
        <label class="field">
          <span class="field-label">Disciplina</span>
          <select v-model="ev.discipline">
            <option v-for="[v, l] in EVENT_DISCIPLINE_OPTIONS" :key="v" :value="v">{{ l }}</option>
          </select>
        </label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Distanza o durata</span><input type="text" v-model="ev.distance_or_duration" /></label>
        <label class="field">
          <span class="field-label">Priorità</span>
          <select v-model="ev.priority">
            <option v-for="p in EVENT_PRIORITIES" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label class="field"><span class="field-label">Risultato target</span><input type="text" v-model="ev.target_result" /></label>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Settimane di tapering</span>
          <input type="number" min="0" max="4" step="1" :placeholder="`predefinito: ${DEFAULT_TAPER_WEEKS[ev.priority ?? 'C'] ?? 0}`"
            :value="ev.taper_weeks ?? ''" @input="ev.taper_weeks = numOrNull(($event.target as HTMLInputElement).value) ?? undefined" />
        </label>
        <label class="field">
          <span class="field-label">Calo del volume nel tapering (%)</span>
          <input type="number" min="0" max="80" step="1" placeholder="lo decide Claude"
            :value="ev.taper_volume_decrease_pct ?? ''" @input="ev.taper_volume_decrease_pct = numOrNull(($event.target as HTMLInputElement).value) ?? undefined" />
        </label>
      </div>
    </div>
    <button type="button" class="add-row" @click="addTargetEvent"><Plus :size="16" aria-hidden="true" />Aggiungi evento</button>
  </template>
</template>
