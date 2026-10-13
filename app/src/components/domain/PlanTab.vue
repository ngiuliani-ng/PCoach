<script setup lang="ts">
// Tab "Piano" della scheda atleta (ADR 0017): settimana con una riga per giorno e le sedute,
// oppure storico filtrabile; da qui si aprono il pannello della seduta e i dialoghi
// "Ripianifica" e "Sincronizza settimana".
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { localSyncState } from "@shared/workouts/sync.ts";
import { validateWorkout, workoutTotals } from "@shared/workouts/structure.ts";
import { useWorkoutsStore, type GenerationKind, type WorkoutRecord } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { showResultToast, showToast } from "../../composables/useToast";
import { choiceDialog } from "../../composables/useConfirmDialog";
import { DAY_LABELS, formatDate, todayISO } from "../../constants";
import { useQueryLayer } from "../../composables/useQueryLayer";
import { useZoneChange } from "../../composables/useZoneChange";
import { execState, formatMinutes, isPartlyDone, STATE_LABELS } from "../../domain/workoutState";
import { isActiveStatus } from "../../domain/regeneration";
import WorkoutRow from "./WorkoutRow.vue";
import WorkoutDrawer from "./WorkoutDrawer.vue";
import RegenerateDialog from "./RegenerateDialog.vue";
import SyncWeekDialog from "./SyncWeekDialog.vue";
import { CalendarPlus, CalendarSync, CheckCheck, ChevronLeft, ChevronRight, CloudUpload, Sparkles } from "lucide-vue-next";

const emit = defineEmits<{ (e: "go-profile", section: string): void }>();

const store = useWorkoutsStore();
const athletes = useAthletesStore();

const today = todayISO();
const mode = ref<"week" | "history">("week");
// Settimana iniziale dal link (?settimana=AAAA-MM-GG, dalla pagina «Da fare»), altrimenti quella di oggi.
const route = useRoute();
const linkedWeek = typeof route.query.settimana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(route.query.settimana) ? route.query.settimana : null;
const weekStart = ref(weekStartISO(linkedWeek ?? today));
// Pannello della seduta e dialoghi nell'URL (?seduta=…, ?dialogo=…): «indietro» li chiude.
const workoutLayer = useQueryLayer("seduta");
const dialogLayer = useQueryLayer("dialogo");
const openId = computed(() => (workoutLayer.value.value && store.byId(workoutLayer.value.value) ? workoutLayer.value.value : null));
const DIALOG_KINDS: Record<string, GenerationKind> = { genera: "initial", prosegui: "continue", ripianifica: "regenerate" };
const genKind = computed<GenerationKind>(() => DIALOG_KINDS[dialogLayer.value.value ?? ""] ?? "initial");
const dialog = computed<"regen" | "sync" | null>(() =>
  dialogLayer.value.value === "sincronizza" ? "sync" : dialogLayer.value.value && dialogLayer.value.value in DIALOG_KINDS ? "regen" : null
);
const { saveProfile } = useZoneChange();
// Claude riceve la scheda salvata (decisione D-UX-4): con modifiche non salvate si sceglie prima se salvarle.
async function openGeneration(kind: GenerationKind) {
  if (athletes.isDirty) {
    const choice = await choiceDialog(
      "La scheda dell'atleta ha modifiche non salvate. Claude riceve la scheda salvata: vuoi salvarle prima di generare?",
      [
        { value: "saved", label: "Genera con i dati salvati", tone: "secondary" },
        { value: "save", label: "Salva e genera", tone: "primary" }
      ]
    );
    if (!choice) return;
    if (choice === "save") {
      const result = await saveProfile();
      if (result.cancelled) return;
      showResultToast(result);
      if (!result.ok) return;
    }
  }
  dialogLayer.open(Object.keys(DIALOG_KINDS).find((k) => DIALOG_KINDS[k] === kind)!);
}

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
const weekSeconds = computed(() => activeInWeek.value.reduce((sum, w) => sum + workoutTotals(w, athletes.paceContexts[w.athlete_id]).seconds, 0));
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
  dialogLayer.close();
  mode.value = "week";
  weekStart.value = weekStartISO(fromDate);
}

// ---------- Storico ----------
// Un solo selettore al posto dei filtri a chip (D-03: pochi controlli nello storico), con i filtri
// raggruppati per asse e il conteggio di ognuno.
type Filter = { key: string; label: string; test: (w: WorkoutRecord) => boolean };
const ALL: Filter = { key: "all", label: "Tutte", test: () => true };
const FILTER_GROUPS: { label: string; filters: Filter[] }[] = [
  { label: "Da sistemare", filters: [
    { key: "review", label: "Bozze", test: (w) => w.status === "draft" },
    { key: "needs_review", label: STATE_LABELS.needsReview, test: (w) => !!w.needs_review && isActiveStatus(w.status) },
    { key: "outdated", label: "Da aggiornare su Intervals.icu", test: (w) => localSyncState(w, store.syncRows[w.id]) === "outdated" },
    { key: "error", label: "Invii non riusciti", test: (w) => localSyncState(w, store.syncRows[w.id]) === "error" }
  ] },
  { label: "Approvazione e invio", filters: [
    { key: "approved", label: "Approvate", test: (w) => w.status === "approved" },
    { key: "synced", label: "Su Intervals.icu", test: (w) => localSyncState(w, store.syncRows[w.id]) === "synced" }
  ] },
  { label: "Esecuzione", filters: [
    { key: "planned", label: "In programma", test: (w) => execState(w, today) === "planned" || execState(w, today) === "today" },
    { key: "done", label: "Svolte", test: (w) => execState(w, today) === "done" },
    { key: "partial", label: "Svolte in parte", test: (w) => isPartlyDone(w) },
    { key: "unrecorded", label: "Non registrate", test: (w) => execState(w, today) === "unrecorded" }
  ] },
  { label: "Chiuse", filters: [{ key: "closed", label: "Annullate o sostituite", test: (w) => !isActiveStatus(w.status) }] }
];
const FILTERS: Filter[] = [ALL, ...FILTER_GROUPS.flatMap((g) => g.filters)];
const countOf = (f: Filter) => historyBase.value.filter(f.test).length;
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
        <template v-if="hasActiveWorkouts">
          <button type="button" class="secondary" @click="openGeneration('continue')"><CalendarPlus :size="16" aria-hidden="true" />Prosegui il piano</button>
          <button type="button" class="secondary" @click="openGeneration('regenerate')"><CalendarSync :size="16" aria-hidden="true" />Ripianifica da…</button>
        </template>
        <button v-else type="button" class="secondary" @click="openGeneration('initial')"><Sparkles :size="16" aria-hidden="true" />Genera il piano</button>
        <button v-if="mode === 'week' && inWeek.length" type="button" class="primary" :disabled="!hasKey" @click="dialogLayer.open('sincronizza')">
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
        <span>{{ approvableDrafts.length === 1 ? "Una seduta è in bozza" : `${approvableDrafts.length} sedute sono in bozza` }}: non verranno inviate a Intervals.icu finché non le approvi.</span>
        <button type="button" class="secondary" @click="approveWeek"><CheckCheck :size="16" aria-hidden="true" />Approva {{ approvableDrafts.length === 1 ? "la seduta" : `le ${approvableDrafts.length}` }}</button>
      </div>

      <div v-if="!hasAnything" class="unit plan-empty">
        <p><strong>Nessun piano.</strong> Scegli da quando partire e per quante settimane: Claude propone le sedute, tu le controlli e le approvi.</p>
        <button type="button" class="primary" @click="openGeneration('initial')"><Sparkles :size="16" aria-hidden="true" />Genera il piano</button>
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
            <WorkoutRow v-for="w in d.items" :key="w.id" :workout="w" :sync="store.syncRows[w.id]" @open="workoutLayer.open($event)" @approve="approve" />
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
        <label class="field history-plan">
          <span class="field-label">Sedute</span>
          <select v-model="filter">
            <option :value="ALL.key">{{ ALL.label }} ({{ countOf(ALL) }})</option>
            <optgroup v-for="g in FILTER_GROUPS" :key="g.label" :label="g.label">
              <option v-for="f in g.filters" :key="f.key" :value="f.key">{{ f.label }} ({{ countOf(f) }})</option>
            </optgroup>
          </select>
        </label>
      </div>
      <div v-if="!historyGroups.length" class="unit plan-empty"><p>Nessuna seduta corrisponde al filtro.</p></div>
      <div v-for="[ws, items] in historyGroups" :key="ws" class="history-week">
        <h2>{{ rangeText(ws) }}</h2>
        <div class="week-unit">
          <WorkoutRow v-for="w in items" :key="w.id" :workout="w" :sync="store.syncRows[w.id]" show-date @open="workoutLayer.open($event)" @approve="approve" />
        </div>
      </div>
    </template>

    <WorkoutDrawer v-if="openId" :key="openId" :workout-id="openId" @close="workoutLayer.close()" @open="workoutLayer.open($event)" />
    <RegenerateDialog v-if="dialog === 'regen'" :key="genKind" :kind="genKind" @close="dialogLayer.close()" @applied="onApplied" />
    <SyncWeekDialog v-if="dialog === 'sync'" :week-start="weekStart" @close="dialogLayer.close()" />
  </div>
</template>
