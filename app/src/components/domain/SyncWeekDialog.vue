<script setup lang="ts">
// "Sincronizza settimana" (ADR 0017): anteprima con lo stato remoto, scelte del coach per
// conflitti e rimozioni, esecuzione una seduta alla volta con esito per riga, nuovo tentativo
// solo sulle non riuscite. Nulla parte verso Intervals.icu finche' il coach non conferma.
import { computed, onMounted, ref } from "vue";
import type { RemoteSnapshot, SyncOp, SyncOpKind } from "@shared/workouts/sync.ts";
import { classifyWeek, isRunnable } from "@shared/workouts/sync.ts";
import { addDaysISO } from "@shared/workouts/calendar.ts";
import { useWorkoutsStore } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { useModalFocus } from "../../composables/useModalFocus";
import { applyOperation, previewWeek, type ApplyOp } from "../../services/intervalsSync";
import { disciplineIcon, disciplineLabel, formatDate } from "../../constants";
import { Check, CloudUpload, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-vue-next";

const props = defineProps<{ weekStart: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useWorkoutsStore();
const athletes = useAthletesStore();
const root = ref<HTMLElement | null>(null);
useModalFocus(root, () => { if (phase.value !== "running") emit("close"); });

type Phase = "loading" | "error" | "preview" | "running" | "done";
type Outcome = { state: "run" | "ok" | "ko"; text: string; warning?: string | null };
const phase = ref<Phase>("loading");
const loadError = ref("");
const ops = ref<SyncOp[]>([]);
const outcomes = ref<Record<string, Outcome>>({});
const weekEnd = computed(() => addDaysISO(props.weekStart, 6));

async function load() {
  phase.value = "loading";
  const athleteId = athletes.currentId!;
  const res = await previewWeek(athleteId, props.weekStart);
  if (!res.ok) {
    loadError.value = res.error;
    phase.value = "error";
    return;
  }
  await store.reload(); // la preview puo' aver registrato sedute svolte
  ops.value = classify(res.data.remote);
  outcomes.value = {};
  phase.value = "preview";
}
function classify(remote: RemoteSnapshot): SyncOp[] {
  // Le sedute della settimana, piu' quelle spostate altrove il cui evento e' ancora in questa.
  const scope = store.workouts.filter((w) => {
    const row = store.syncRows[w.id];
    return (w.planned_date >= props.weekStart && w.planned_date <= weekEnd.value)
      || (row?.synced_date && row.synced_date >= props.weekStart && row.synced_date <= weekEnd.value && row.remote_event_id != null);
  });
  return classifyWeek(scope, store.syncRows, remote);
}
onMounted(load);

const GROUPS: [SyncOpKind, string][] = [
  ["conflict", "Modificate su Intervals.icu"],
  ["remote_missing", "Sparite da Intervals.icu"],
  ["create", "Da creare"],
  ["update", "Da aggiornare"],
  ["delete", "Da rimuovere da Intervals.icu"],
  ["blocked", "Bloccate, da correggere"],
  ["skip_draft", "Non verranno inviate"],
  ["same", "Già allineate"]
];
const groups = computed(() => GROUPS.map(([kind, label]) => ({ kind, label, items: ops.value.filter((o) => o.kind === kind) })).filter((g) => g.items.length));
const runnable = computed(() => ops.value.filter(isRunnable));
const deletions = computed(() => runnable.value.filter((o) => o.kind === "delete").length);
const failed = computed(() => ops.value.filter((o) => outcomes.value[o.workoutId]?.state === "ko"));
const succeeded = computed(() => ops.value.filter((o) => outcomes.value[o.workoutId]?.state === "ok"));

function workout(id: string) {
  return store.byId(id)!;
}
function detail(op: SyncOp): string {
  const w = workout(op.workoutId);
  switch (op.kind) {
    case "create":
      return op.detail === "uncertain" ? "Il tentativo precedente non ha avuto risposta: prima di crearla controllo se esiste già, per non duplicarla."
        : op.detail === "retry" ? "Il tentativo precedente non è riuscito." : "Approvata, non ancora su Intervals.icu.";
    case "update": {
      if (op.detail === "moved") return "Spostata di data dopo l'invio.";
      if (op.detail === "retry") return "Il tentativo precedente non è riuscito.";
      const [from, to] = op.detail.split(":");
      return `Modificata dopo l'invio (revisione ${from} → ${to}).`;
    }
    case "conflict": return "Su Intervals.icu è stata cambiata dopo l'ultimo invio.";
    case "remote_missing": return "Su Intervals.icu non esiste più: forse l'ha rimossa l'atleta.";
    case "delete": return w.status === "superseded" ? "Sostituita da una rigenerazione." : "Annullata in PCoach.";
    case "blocked": return op.detail;
    case "skip_draft": return w.needs_review || "Da revisionare: approvala per inviarla.";
    default:
      return op.detail === "completed" ? "Svolta: non si modifica su Intervals.icu." : op.detail === "unlinked" ? "Scollegata da Intervals.icu." : "Nessuna differenza dall'ultimo invio.";
  }
}
function applyKind(op: SyncOp): ApplyOp {
  return op.kind === "conflict" ? "overwrite" : op.kind === "remote_missing" ? "recreate" : op.kind === "delete" ? "delete" : op.kind === "create" ? "create" : "update";
}
const DONE_TEXT: Record<ApplyOp, string> = { create: "Creata", update: "Aggiornata", overwrite: "Sovrascritta", recreate: "Ricreata", delete: "Rimossa" };

async function run(only?: SyncOp[]) {
  const todo = only ?? runnable.value;
  phase.value = "running";
  for (const op of todo) {
    const w = workout(op.workoutId);
    outcomes.value[op.workoutId] = { state: "run", text: "In corso" };
    const kind = applyKind(op);
    const res = await applyOperation(w.athlete_id, w.id, kind, w.revision);
    outcomes.value[op.workoutId] = res.ok
      ? { state: "ok", text: DONE_TEXT[kind], warning: res.data.warning }
      : { state: "ko", text: res.error };
  }
  await store.reload();
  phase.value = "done";
}

function dayText(date: string) {
  return `${new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(new Date(date + "T12:00:00"))} ${formatDate(date, false)}`;
}
const title = computed(() => `Sincronizza la settimana ${formatDate(props.weekStart, false)} – ${formatDate(weekEnd.value, false)}`);
</script>

<template>
  <div class="sheet-backdrop" @click="phase !== 'running' && emit('close')"></div>
  <div class="dialog-wrap">
    <div ref="root" class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="sync-title">
      <header class="dialog-head">
        <div>
          <h3 id="sync-title">{{ title }}</h3>
          <p>{{ phase === "done" ? "Esito di ogni operazione." : "Ecco cosa verrà inviato a Intervals.icu. Nulla parte finché non confermi." }}</p>
        </div>
        <button v-if="phase !== 'running'" type="button" class="icon-btn" aria-label="Chiudi" @click="emit('close')"><X :size="18" aria-hidden="true" /></button>
      </header>

      <div class="dialog-body" aria-live="polite">
        <p v-if="phase === 'loading'" class="progress-line"><LoaderCircle :size="18" class="spin" aria-hidden="true" />Leggo il calendario di Intervals.icu…</p>
        <div v-else-if="phase === 'error'" class="drawer-note error">{{ loadError }}</div>
        <template v-else>
          <p v-if="phase === 'done'" class="summary-line">
            {{ failed.length ? `${succeeded.length} riuscit${succeeded.length === 1 ? "a" : "e"}, ${failed.length} non riuscit${failed.length === 1 ? "a" : "e"}` : succeeded.length === 1 ? "L'operazione è riuscita." : `Tutte le ${succeeded.length} operazioni sono riuscite.` }}
          </p>
          <p v-if="!ops.length" class="helper-text">Nessuna seduta in questa settimana.</p>
          <div v-for="g in groups" :key="g.kind" class="op-group">
            <h4>{{ g.label }} <span class="count">{{ g.items.length }}</span></h4>
            <ul class="op-list">
              <li v-for="op in g.items" :key="op.workoutId">
                <component :is="disciplineIcon(workout(op.workoutId).discipline)" :size="16" class="op-icon" role="img" :aria-label="disciplineLabel(workout(op.workoutId).discipline)" />
                <div>
                  <span class="op-what">{{ dayText(workout(op.workoutId).planned_date) }}, {{ workout(op.workoutId).title }}</span>
                  <span class="op-why">{{ detail(op) }}</span>
                </div>
                <span v-if="outcomes[op.workoutId]" class="outcome" :class="outcomes[op.workoutId].state">
                  <LoaderCircle v-if="outcomes[op.workoutId].state === 'run'" :size="14" class="spin" aria-hidden="true" />
                  <Check v-else-if="outcomes[op.workoutId].state === 'ok'" :size="14" aria-hidden="true" />
                  <TriangleAlert v-else :size="14" aria-hidden="true" />
                  {{ outcomes[op.workoutId].state === "ko" ? "Non riuscita" : outcomes[op.workoutId].text }}
                </span>
                <div v-if="phase === 'preview' && op.kind === 'conflict'" class="op-choice">
                  <label><input type="radio" :name="`c-${op.workoutId}`" :checked="op.selected" @change="op.selected = true" />Sovrascrivi con la versione di PCoach</label>
                  <label><input type="radio" :name="`c-${op.workoutId}`" :checked="!op.selected" @change="op.selected = false" />Lascia quella di Intervals.icu per ora</label>
                </div>
                <div v-if="phase === 'preview' && op.kind === 'remote_missing'" class="op-choice">
                  <label><input type="radio" :name="`m-${op.workoutId}`" :checked="op.selected" @change="op.selected = true" />Ricreala su Intervals.icu</label>
                  <label><input type="radio" :name="`m-${op.workoutId}`" :checked="!op.selected" @change="op.selected = false" />Non inviarla per ora</label>
                </div>
                <div v-if="phase === 'preview' && op.kind === 'delete'" class="op-choice">
                  <label><input type="checkbox" v-model="op.selected" />Rimuovi da Intervals.icu</label>
                </div>
                <p v-if="outcomes[op.workoutId]?.state === 'ko'" class="op-error">{{ outcomes[op.workoutId].text }}</p>
                <p v-if="outcomes[op.workoutId]?.warning" class="op-warning">{{ outcomes[op.workoutId].warning }}</p>
              </li>
            </ul>
          </div>
        </template>
      </div>

      <footer class="dialog-foot">
        <template v-if="phase === 'error'">
          <button type="button" class="secondary" @click="emit('close')">Chiudi</button>
          <button type="button" class="primary" @click="load"><RotateCcw :size="16" aria-hidden="true" />Riprova</button>
        </template>
        <template v-else-if="phase === 'preview' || phase === 'loading'">
          <button type="button" class="secondary" @click="emit('close')">Annulla</button>
          <button type="button" class="primary" :disabled="phase === 'loading' || !runnable.length" @click="run()">
            <CloudUpload :size="16" aria-hidden="true" />
            <template v-if="runnable.length">Sincronizza {{ runnable.length }} {{ runnable.length === 1 ? "seduta" : "sedute" }}<template v-if="deletions">, di cui {{ deletions }} da rimuovere</template></template>
            <template v-else>Niente da sincronizzare</template>
          </button>
        </template>
        <button v-else-if="phase === 'running'" type="button" class="secondary" disabled>Sincronizzazione in corso…</button>
        <template v-else>
          <button v-if="failed.length" type="button" class="secondary" @click="run(failed)">
            <RotateCcw :size="16" aria-hidden="true" />Riprova {{ failed.length === 1 ? "la non riuscita" : `le ${failed.length} non riuscite` }}
          </button>
          <button type="button" class="primary" @click="emit('close')">Chiudi</button>
        </template>
      </footer>
    </div>
  </div>
</template>
