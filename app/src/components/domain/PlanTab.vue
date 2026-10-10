<script setup lang="ts">
// Tab "Piano" della scheda atleta (ADR 0017): settimana con una riga per giorno e le sedute,
// oppure storico filtrabile; da qui si aprono il pannello della seduta e i dialoghi
// "Ripianifica" e "Sincronizza settimana".
import { computed, ref } from "vue";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { localSyncState } from "@shared/workouts/sync.ts";
import { validateWorkout, workoutTotals } from "@shared/workouts/structure.ts";
import { useWorkoutsStore, type WorkoutRecord } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { showToast } from "../../composables/useToast";
import { DAY_LABELS, formatDate, todayISO } from "../../constants";
import { execState, formatMinutes } from "../../domain/workoutState";
import { isActiveStatus } from "../../domain/regeneration";
import WorkoutRow from "./WorkoutRow.vue";
import WorkoutDrawer from "./WorkoutDrawer.vue";
import RegenerateDialog from "./RegenerateDialog.vue";
import SyncWeekDialog from "./SyncWeekDialog.vue";
import { CalendarSync, CheckCheck, ChevronLeft, ChevronRight, CloudUpload, Sparkles } from "lucide-vue-next";

const emit = defineEmits<{ (e: "go-profile", section: string): void }>();

const store = useWorkoutsStore();
const athletes = useAthletesStore();

const today = todayISO();
const mode = ref<"week" | "history">("week");
const weekStart = ref(weekStartISO(today));
const openId = ref<string | null>(null);
const dialog = ref<"regen" | "sync" | null>(null);

const weekEnd = computed(() => addDaysISO(weekStart.value, 6));
const hasKey = computed(() => !!athletes.currentProfile?.integrations?.intervals_icu_api_key);
const hasAnything = computed(() => store.workouts.length > 0 || store.plans.length > 0);
const hasActiveWorkouts = computed(() => store.workouts.some((w) => isActiveStatus(w.status)));

const inWeek = computed(() => store.workouts.filter((w) => w.planned_date >= weekStart.value && w.planned_date <= weekEnd.value));
const activeInWeek = computed(() => inWeek.value.filter((w) => isActiveStatus(w.status)));
const approvableDrafts = computed(() =>
  activeInWeek.value.filter((w) => w.status === "draft" && !w.needs_review && !Object.keys(validateWorkout(w)).length)
);
const toSyncCount = computed(() =>
  inWeek.value.filter((w) => {
    const s = localSyncState(w, store.syncRows[w.id]);
    return (w.status === "approved" && !w.completed_at && (s === "none" || s === "outdated" || s === "error")) || s === "pending_delete";
  }).length
);
const weekSeconds = computed(() => activeInWeek.value.reduce((sum, w) => sum + workoutTotals(w).seconds, 0));
const weekPlan = computed(() => {
  const ids = new Set(activeInWeek.value.map((w) => w.plan_id).filter(Boolean));
  return store.plans.find((p) => ids.has(p.id) && p.status === "active") ?? store.plans.find((p) => ids.has(p.id)) ?? null;
});
const weekMeta = computed(() => weekPlan.value?.weeks_meta.find((m) => m.week_start === weekStart.value) ?? null);
const days = computed(() =>
  DAY_LABELS.map(([, label], i) => {
    const date = addDaysISO(weekStart.value, i);
    const items = inWeek.value
      .filter((w) => w.planned_date === date)
      .sort((a, b) => Number(isActiveStatus(b.status)) - Number(isActiveStatus(a.status)) || a.slot - b.slot);
    return { date, label, items };
  })
);

function shiftWeek(delta: number) {
  weekStart.value = addDaysISO(weekStart.value, delta * 7);
}
async function approve(id: string) {
  const r = await store.approve([id]);
  showToast(r.ok ? "Seduta approvata." : r.message, r.ok ? "info" : "error");
}
async function approveWeek() {
  const r = await store.approve(approvableDrafts.value.map((w) => w.id));
  showToast(r.ok ? `${r.value === 1 ? "Una seduta approvata" : r.value + " sedute approvate"}.` : r.message, r.ok ? "info" : "error");
}
function onApplied(fromDate: string) {
  dialog.value = null;
  mode.value = "week";
  weekStart.value = weekStartISO(fromDate);
}

// ---------- Storico ----------
type Filter = { key: string; label: string; test: (w: WorkoutRecord) => boolean };
const FILTERS: Filter[] = [
  { key: "all", label: "Tutte", test: () => true },
  { key: "review", label: "Da revisionare", test: (w) => w.status === "draft" },
  { key: "needs_review", label: "Struttura da verificare", test: (w) => !!w.needs_review && isActiveStatus(w.status) },
  { key: "approved", label: "Approvate", test: (w) => w.status === "approved" },
  { key: "synced", label: "Su Intervals.icu", test: (w) => localSyncState(w, store.syncRows[w.id]) === "synced" },
  { key: "outdated", label: "Da aggiornare", test: (w) => localSyncState(w, store.syncRows[w.id]) === "outdated" },
  { key: "error", label: "Errori di sincronizzazione", test: (w) => localSyncState(w, store.syncRows[w.id]) === "error" },
  { key: "done", label: "Svolte", test: (w) => execState(w, today) === "done" },
  { key: "missed", label: "Non svolte", test: (w) => execState(w, today) === "missed" },
  { key: "planned", label: "In programma", test: (w) => execState(w, today) === "planned" || execState(w, today) === "today" },
  { key: "closed", label: "Annullate o sostituite", test: (w) => !isActiveStatus(w.status) }
];
const filter = ref("all");
const planFilter = ref("all");
const historyBase = computed(() => store.workouts.filter((w) => planFilter.value === "all" || w.plan_id === planFilter.value));
const historyGroups = computed(() => {
  const f = FILTERS.find((x) => x.key === filter.value)!;
  const groups = new Map<string, WorkoutRecord[]>();
  historyBase.value
    .filter(f.test)
    .sort((a, b) => b.planned_date.localeCompare(a.planned_date) || a.slot - b.slot)
    .forEach((w) => {
      const ws = weekStartISO(w.planned_date);
      if (!groups.has(ws)) groups.set(ws, []);
      groups.get(ws)!.push(w);
    });
  return [...groups.entries()];
});
function planLabel(p: (typeof store.plans)[number]) {
  if (p.status === "active") return `${p.name} (attivo)`;
  return p.end_date ? `${p.name}, chiuso al ${formatDate(p.end_date, false)}` : `${p.name} (archiviato)`;
}
function rangeText(ws: string) {
  return `${formatDate(ws, false)} – ${formatDate(addDaysISO(ws, 6), false)}`;
}
</script>

<template>
  <div class="plan-tab">
    <div class="plan-toolbar">
      <div v-if="mode === 'week'" class="week-nav">
        <button type="button" class="icon-btn" aria-label="Settimana precedente" @click="shiftWeek(-1)"><ChevronLeft :size="18" aria-hidden="true" /></button>
        <span class="week-title" aria-live="polite">{{ rangeText(weekStart) }}</span>
        <button type="button" class="icon-btn" aria-label="Settimana successiva" @click="shiftWeek(1)"><ChevronRight :size="18" aria-hidden="true" /></button>
        <button v-if="weekStart !== weekStartISO(today)" type="button" class="ghost" @click="weekStart = weekStartISO(today)">Oggi</button>
      </div>
      <div class="segmented plan-mode" role="group" aria-label="Vista del piano">
        <button type="button" :aria-pressed="mode === 'week'" @click="mode = 'week'">Settimana</button>
        <button type="button" :aria-pressed="mode === 'history'" @click="mode = 'history'">Storico</button>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="secondary" @click="dialog = 'regen'">
          <template v-if="hasActiveWorkouts"><CalendarSync :size="16" aria-hidden="true" />Ripianifica da…</template>
          <template v-else><Sparkles :size="16" aria-hidden="true" />Genera il piano</template>
        </button>
        <button v-if="mode === 'week'" type="button" class="primary" :disabled="!hasKey || !inWeek.length" @click="dialog = 'sync'">
          <CloudUpload :size="16" aria-hidden="true" />Sincronizza settimana
        </button>
      </div>
    </div>

    <p v-if="store.loadError" class="drawer-note error">{{ store.loadError }}</p>
    <p v-else-if="store.loading && !hasAnything" class="helper-text">Carico le sedute…</p>

    <template v-else-if="mode === 'week'">
      <p class="week-meta">
        <span v-if="weekPlan"><strong>{{ weekPlan.name }}</strong><template v-if="weekMeta?.label">, {{ weekMeta.label }}</template></span>
        <span v-if="weekMeta?.is_deload" class="deload-badge">Scarico</span>
        <span v-if="activeInWeek.length">{{ activeInWeek.length }} {{ activeInWeek.length === 1 ? "seduta" : "sedute" }}, {{ formatMinutes(weekSeconds) }}</span>
        <span v-if="toSyncCount">{{ toSyncCount }} da sincronizzare</span>
        <span v-else-if="activeInWeek.length && hasKey">Allineata con Intervals.icu</span>
      </p>
      <p v-if="!hasKey && inWeek.length" class="helper-text">
        Per sincronizzare serve la chiave Intervals.icu dell'atleta:
        <button type="button" class="link-btn" @click="emit('go-profile', 'sec-intervals')">aggiungila nel Profilo</button>.
      </p>
      <div v-if="approvableDrafts.length" class="attention" role="note">
        <span>{{ approvableDrafts.length === 1 ? "Una seduta è da revisionare" : `${approvableDrafts.length} sedute sono da revisionare` }}: non verranno inviate a Intervals.icu finché non le approvi.</span>
        <button type="button" class="secondary" @click="approveWeek"><CheckCheck :size="16" aria-hidden="true" />Approva {{ approvableDrafts.length === 1 ? "la seduta" : `le ${approvableDrafts.length}` }}</button>
      </div>

      <div v-if="!hasAnything" class="unit plan-empty">
        <p><strong>Nessun piano.</strong> Scegli da quando partire e per quante settimane: Claude propone le sedute, tu le controlli e le approvi.</p>
        <button type="button" class="primary" @click="dialog = 'regen'"><Sparkles :size="16" aria-hidden="true" />Genera il piano</button>
      </div>
      <div v-else-if="!inWeek.length" class="unit plan-empty"><p>Nessuna seduta in questa settimana.</p></div>
      <div v-else class="week-unit">
        <div v-for="d in days" :key="d.date" class="week-day" :class="{ today: d.date === today }">
          <div class="week-day-label">
            {{ d.label }}<span class="week-day-date">{{ formatDate(d.date, false) }}</span>
            <span v-if="d.date === today" class="today-tag">Oggi</span>
          </div>
          <div class="week-day-items">
            <p v-if="!d.items.length" class="rest">Riposo</p>
            <WorkoutRow v-for="w in d.items" :key="w.id" :workout="w" :sync="store.syncRows[w.id]" @open="openId = $event" @approve="approve" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="history-tools">
        <label class="field history-plan">
          <span class="field-label">Piano</span>
          <select v-model="planFilter">
            <option value="all">Tutti i piani</option>
            <option v-for="p in store.plans" :key="p.id" :value="p.id">{{ planLabel(p) }}</option>
          </select>
        </label>
      </div>
      <div class="filters" role="group" aria-label="Filtra le sedute">
        <button v-for="f in FILTERS" :key="f.key" type="button" class="chip" :aria-pressed="filter === f.key" @click="filter = f.key">
          {{ f.label }}<span class="chip-count">{{ historyBase.filter(f.test).length }}</span>
        </button>
      </div>
      <div v-if="!historyGroups.length" class="unit plan-empty"><p>Nessuna seduta corrisponde al filtro.</p></div>
      <div v-for="[ws, items] in historyGroups" :key="ws" class="history-week">
        <h4>{{ rangeText(ws) }}</h4>
        <div class="week-unit">
          <WorkoutRow v-for="w in items" :key="w.id" :workout="w" :sync="store.syncRows[w.id]" show-date @open="openId = $event" @approve="approve" />
        </div>
      </div>
    </template>

    <WorkoutDrawer v-if="openId" :key="openId" :workout-id="openId" @close="openId = null" @open="openId = $event" />
    <RegenerateDialog v-if="dialog === 'regen'" @close="dialog = null" @applied="onApplied" />
    <SyncWeekDialog v-if="dialog === 'sync'" :week-start="weekStart" @close="dialog = null" />
  </div>
</template>
