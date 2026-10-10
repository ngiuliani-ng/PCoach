<script setup lang="ts">
// Pannello di una seduta: modifica di dati e struttura, approvazione, annullamento,
// anteprima del testo per Intervals.icu e cronologia. Si lavora su una bozza locale; il
// salvataggio e' condizionato alla revisione (vedi stores/workouts.ts).
import { computed, onMounted, reactive, ref } from "vue";
import type { Discipline, WorkoutContent } from "@shared/workouts/structure.ts";
import { DISCIPLINES, contentOf, defaultTargetMetric, validateWorkout, workoutTotals } from "@shared/workouts/structure.ts";
import { intervalsDescription } from "@shared/workouts/intervals.ts";
import { localSyncState } from "@shared/workouts/sync.ts";
import { useWorkoutsStore, type WorkoutEventRecord } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { useModalFocus } from "../../composables/useModalFocus";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { showToast } from "../../composables/useToast";
import { disciplineIcon, disciplineLabel, formatDate, todayISO } from "../../constants";
import { TARGET_LABELS, formatMinutes, formatMeters, execState } from "../../domain/workoutState";
import { hasFtp } from "../../domain/athlete";
import StepEditor from "./StepEditor.vue";
import StructureBar from "./StructureBar.vue";
import WorkoutBadges from "./WorkoutBadges.vue";
import { Ban, Check, RotateCcw, Trash2, X } from "lucide-vue-next";

const props = defineProps<{ workoutId: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "open", id: string): void }>();

// Copia profonda di dati reattivi (structuredClone non accetta i proxy di Vue).
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const store = useWorkoutsStore();
const athletes = useAthletesStore();
const root = ref<HTMLElement | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
useModalFocus(root, () => void requestClose(), titleInput);

const original = computed(() => store.byId(props.workoutId)!);
const draft = reactive<WorkoutContent & { locked: boolean }>({ ...clone(contentOf(original.value)), locked: original.value.locked });
const saving = ref(false);

const editable = computed(() => original.value.status === "draft" || original.value.status === "approved");
const errors = computed(() => (editable.value ? validateWorkout(draft) : {}));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const changed = computed(
  () => JSON.stringify({ ...contentOf(draft), locked: draft.locked }) !== JSON.stringify({ ...contentOf(original.value), locked: original.value.locked })
);
const totals = computed(() => workoutTotals(draft));
const syncRow = computed(() => store.syncRows[props.workoutId] ?? null);
const syncState = computed(() => localSyncState(original.value, syncRow.value));
const intervalsText = computed(() => intervalsDescription(draft));
const replacement = computed(() => (original.value.superseded_by ? store.byId(original.value.superseded_by) : null));
const dateClash = computed(
  () => draft.planned_date !== original.value.planned_date && store.workouts.some((w) => w.id !== props.workoutId && w.planned_date === draft.planned_date && (w.status === "draft" || w.status === "approved"))
);
const canMarkDone = computed(() => original.value.status === "approved" && original.value.planned_date <= todayISO() && original.value.completion_source !== "intervals");

function onDisciplineChange(value: string) {
  const d = value as Discipline;
  const wasStrength = draft.discipline === "strength";
  draft.discipline = d;
  if (d === "strength") {
    draft.duration_min = draft.duration_min ?? (Math.round(totals.value.seconds / 60) || 45);
    draft.structure = null;
    draft.primary_target = "none";
  } else {
    if (wasStrength || !draft.structure) {
      draft.structure = { version: 2, steps: [{ kind: "step", role: "steady", duration: { type: "time", seconds: (draft.duration_min ?? 45) * 60 }, target: { zone: 2 } }] };
      draft.duration_min = null;
    }
    draft.primary_target = defaultTargetMetric(d, hasFtp(athletes.athletes[original.value.athlete_id]));
  }
}

async function save(approve: boolean) {
  if (hasErrors.value || saving.value) return;
  saving.value = true;
  const patch: Record<string, unknown> = { ...clone(contentOf(draft)), locked: draft.locked };
  if (draft.planned_date !== original.value.planned_date) patch.slot = store.freeSlot(draft.planned_date, props.workoutId);
  if (approve) patch.status = "approved";
  // Una seduta corretta dal coach non ha piu' bisogno di verifica.
  if (original.value.needs_review && !hasErrors.value) patch.needs_review = null;
  const result = await store.update(props.workoutId, patch);
  saving.value = false;
  if (!result.ok) {
    showToast(result.message, "error");
    emit("close");
    return;
  }
  const outdated = localSyncState(result.value, store.syncRows[props.workoutId]) === "outdated";
  showToast(approve ? "Seduta approvata." : outdated ? "Modifiche salvate: da aggiornare su Intervals.icu." : "Modifiche salvate.");
  emit("close");
}

async function requestClose() {
  if (changed.value && editable.value) {
    const ok = await confirmDialog("Chiudere la seduta senza salvare le modifiche?", { confirmLabel: "Chiudi senza salvare", cancelLabel: "Continua a modificare" });
    if (!ok) return;
  }
  emit("close");
}

async function onCancelWorkout() {
  const remote = syncRow.value?.remote_event_id != null && !original.value.completed_at;
  const ok = await confirmDialog(
    `Annullare «${original.value.title}» del ${formatDate(original.value.planned_date, false)}? Resta nello storico.${remote ? " È già su Intervals.icu: la rimozione ti verrà proposta in «Sincronizza settimana»." : ""}`,
    { confirmLabel: "Annulla seduta", cancelLabel: "Mantieni" }
  );
  if (!ok) return;
  const r = await store.cancel(props.workoutId, "");
  showToast(r.ok ? "Seduta annullata." : r.message, r.ok ? "info" : "error");
  emit("close");
}

async function onDeleteDraft() {
  const ok = await confirmDialog("Eliminare questa bozza? Non è mai stata approvata né inviata, quindi non resta nello storico.", { confirmLabel: "Elimina bozza", cancelLabel: "Mantieni" });
  if (!ok) return;
  const r = await store.deleteDraft(props.workoutId);
  showToast(r.ok ? "Bozza eliminata." : r.message, r.ok ? "info" : "error");
  emit("close");
}

async function onRestore() {
  const r = await store.restore(props.workoutId);
  showToast(r.ok ? "Seduta ripristinata come bozza." : r.message, r.ok ? "info" : "error");
  if (r.ok) Object.assign(draft, clone(contentOf(r.value)), { locked: r.value.locked });
}

async function onToggleDone() {
  const r = await store.setCompleted(props.workoutId, !original.value.completed_at);
  if (!r.ok) showToast(r.message, "error");
}

// ---------- Cronologia ----------
const events = ref<WorkoutEventRecord[]>([]);
onMounted(async () => {
  events.value = await store.events(props.workoutId);
});
const EVENT_LABELS: Record<string, string> = {
  created: "Creata", edited: "Modificata", moved: "Spostata", approved: "Approvata", cancelled: "Annullata",
  superseded: "Sostituita", restored: "Ripristinata come bozza", plan_changed: "Passata a un altro piano",
  locked: "Bloccata per le rigenerazioni", unlocked: "Sbloccata", completed: "Segnata come svolta",
  uncompleted: "Segnata come non svolta", synced: "Intervals.icu", sync_failed: "Intervals.icu", remote_deleted: "Intervals.icu"
};
const FIELD_LABELS: Record<string, string> = {
  planned_date: "data", discipline: "disciplina", title: "nome", objective: "obiettivo", notes_for_athlete: "note",
  duration_min: "durata", structure: "struttura", primary_target: "metrica dei target"
};
function diffText(e: WorkoutEventRecord): string {
  if (!e.before || !e.after) return "";
  const keys = Object.keys(FIELD_LABELS).filter((k) => JSON.stringify((e.before as Record<string, unknown>)[k]) !== JSON.stringify((e.after as Record<string, unknown>)[k]));
  return keys.map((k) => k === "planned_date" ? `data dal ${formatDate(String(e.before!.planned_date), false)} al ${formatDate(String(e.after!.planned_date), false)}` : FIELD_LABELS[k]).join(", ");
}
function when(at: string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}
const exec = computed(() => execState(original.value, todayISO()));
</script>

<template>
  <div class="sheet-backdrop" @click="requestClose"></div>
  <aside ref="root" class="workout-drawer" role="dialog" aria-modal="true" aria-labelledby="wd-title-label">
    <header class="drawer-head">
      <component :is="disciplineIcon(draft.discipline)" :size="18" class="drawer-icon" role="img" :aria-label="disciplineLabel(draft.discipline)" />
      <label id="wd-title-label" class="visually-hidden" for="wd-title">Nome della seduta</label>
      <input id="wd-title" ref="titleInput" v-model="draft.title" class="drawer-title" :disabled="!editable" />
      <button type="button" class="icon-btn" aria-label="Chiudi" @click="requestClose"><X :size="18" aria-hidden="true" /></button>
    </header>

    <div class="drawer-body">
      <p class="drawer-status">
        <WorkoutBadges :workout="original" :sync="syncRow" />
        <span class="w-badge plain">Revisione {{ original.revision }}</span>
      </p>
      <p v-if="errors.title" class="helper-text error-text">{{ errors.title }}</p>

      <div v-if="original.status === 'superseded'" class="drawer-note">
        Sostituita da una rigenerazione: resta nello storico e non si modifica.
        <button v-if="replacement" type="button" class="link-btn" @click="emit('open', replacement.id)">Apri «{{ replacement.title }}»</button>
      </div>
      <div v-else-if="original.status === 'cancelled'" class="drawer-note">
        Annullata: resta nello storico.
        <button type="button" class="secondary" @click="onRestore"><RotateCcw :size="16" aria-hidden="true" />Ripristina come bozza</button>
      </div>
      <div v-if="original.needs_review" class="drawer-note warn">{{ original.needs_review }}</div>
      <div v-if="syncRow?.last_error && syncState === 'error'" class="drawer-note error">{{ syncRow.last_error }}</div>
      <div v-if="syncRow?.last_warning" class="drawer-note warn">{{ syncRow.last_warning }}</div>

      <div class="field-row">
        <label class="field"><span class="field-label">Data</span><input type="date" v-model="draft.planned_date" :disabled="!editable" /></label>
        <label class="field">
          <span class="field-label">Disciplina</span>
          <select :value="draft.discipline" :disabled="!editable" @change="onDisciplineChange(($event.target as HTMLSelectElement).value)">
            <option v-for="d in DISCIPLINES" :key="d" :value="d">{{ disciplineLabel(d) }}</option>
          </select>
        </label>
      </div>
      <p v-if="dateClash" class="helper-text">Quel giorno c'è già un'altra seduta: questa diventa la seconda del giorno.</p>
      <label class="field"><span class="field-label">Obiettivo della seduta</span><input v-model="draft.objective" :disabled="!editable" /></label>

      <section class="drawer-section">
        <template v-if="draft.discipline === 'strength'">
          <label class="field">
            <span class="field-label">Durata (minuti)</span>
            <input type="number" min="1" :value="draft.duration_min ?? ''" :disabled="!editable"
              @input="draft.duration_min = Number(($event.target as HTMLInputElement).value) || null" />
          </label>
          <p v-if="errors.duration_min" class="helper-text error-text">{{ errors.duration_min }}</p>
        </template>
        <template v-else>
          <div class="drawer-section-head">
            <h3>Struttura</h3>
            <span class="muted">{{ formatMinutes(totals.seconds) }}{{ totals.estimated ? " stimati" : "" }}<template v-if="totals.meters">, {{ formatMeters(totals.meters) }} a distanza</template></span>
          </div>
          <div class="field">
            <span class="field-label" id="wd-metric">Target espressi in</span>
            <div class="segmented" role="group" aria-labelledby="wd-metric">
              <button v-for="m in (['power', 'hr', 'pace'] as const)" :key="m" type="button" :aria-pressed="draft.primary_target === m" :disabled="!editable" @click="draft.primary_target = m">{{ TARGET_LABELS[m] }}</button>
            </div>
          </div>
          <StructureBar :discipline="draft.discipline" :structure="draft.structure" />
          <StepEditor v-if="draft.structure" :structure="draft.structure" :errors="errors" :readonly="!editable" />
          <p v-if="errors.structure" class="helper-text error-text">{{ errors.structure }}</p>
        </template>
      </section>

      <label class="field">
        <span class="field-label">{{ draft.discipline === "strength" ? "Esercizi e istruzioni per l'atleta" : "Note per l'atleta" }}</span>
        <textarea v-model="draft.notes_for_athlete" rows="3" :disabled="!editable"></textarea>
      </label>
      <label v-if="editable" class="checkbox-line">
        <input type="checkbox" v-model="draft.locked" />
        Mantienila se ripianifico il programma
      </label>
      <p v-if="canMarkDone" class="drawer-done">
        {{ exec === "done" ? "Segnata come svolta a mano." : "Non risulta svolta su Intervals.icu." }}
        <button type="button" class="link-btn" @click="onToggleDone">{{ exec === "done" ? "Segna come non svolta" : "Segna come svolta" }}</button>
      </p>

      <details class="drawer-section icu-preview">
        <summary>Testo inviato a Intervals.icu</summary>
        <p class="helper-text">Data {{ formatDate(draft.planned_date) }}, nome «{{ draft.title }}». Le zone si riferiscono a quelle impostate sull'account Intervals.icu dell'atleta.</p>
        <pre class="mono-input icu-text">{{ intervalsText || "Nessun testo: la seduta non ha struttura né note." }}</pre>
      </details>

      <section class="drawer-section">
        <h3>Cronologia</h3>
        <p v-if="!events.length" class="helper-text">Nessun evento registrato.</p>
        <ul v-else class="timeline">
          <li v-for="e in events" :key="e.id">
            <time :datetime="e.at">{{ when(e.at) }}</time>
            <span>
              <strong>{{ EVENT_LABELS[e.type] || e.type }}</strong>
              <template v-if="diffText(e)">: {{ diffText(e) }}</template>
              <template v-if="e.note">. {{ e.note }}</template>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <footer class="drawer-foot">
      <template v-if="editable">
        <button v-if="original.status === 'draft' && !syncRow" type="button" class="ghost danger-text" @click="onDeleteDraft"><Trash2 :size="16" aria-hidden="true" />Elimina bozza</button>
        <button v-else type="button" class="ghost danger-text" @click="onCancelWorkout"><Ban :size="16" aria-hidden="true" />Annulla seduta</button>
        <span class="drawer-spacer"></span>
        <button type="button" class="secondary" :disabled="!changed || hasErrors || saving" @click="save(false)">Salva modifiche</button>
        <button v-if="original.status === 'draft'" type="button" class="primary" :disabled="hasErrors || saving" @click="save(true)">
          <Check :size="16" aria-hidden="true" />{{ changed ? "Salva e approva" : "Approva" }}
        </button>
      </template>
      <template v-else>
        <span class="drawer-spacer"></span>
        <button type="button" class="secondary" @click="emit('close')">Chiudi</button>
      </template>
    </footer>
  </aside>
</template>
