<script setup lang="ts">
// Generazione e rigenerazione controllata (ADR 0017), in tre passi:
// 1. parametri: data di ripartenza, settimane, motivo, sedute da mantenere;
// 2. proposta di Claude, salvata subito in plan_generations (si ritrova dopo un ricaricamento);
// 3. anteprima delle differenze e applicazione in un'unica transazione (apply_plan_generation).
// Nulla cambia finche' il coach non applica la proposta.
import { computed, onMounted, ref } from "vue";
import { useWorkoutsStore, type GenerationRecord } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { useSettingsStore } from "../../stores/settings";
import { useModalFocus } from "../../composables/useModalFocus";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import { showToast } from "../../composables/useToast";
import { addDaysISO, formatDate, todayISO, TRAINING_PLAN_JSON_SHAPE } from "../../constants";
import { buildPlanPrompt } from "../../services/planPrompt";
import { callClaudeProxy, copyToClipboardFallback, extractJsonBlock } from "../../services/claude";
import { hasFtp } from "../../domain/athlete";
import { blockMaxTokens, mergeBlockResponses, planBlocks } from "../../domain/planBlocks";
import type { NewWorkout } from "../../domain/workoutDraft";
import type { DiffDay, Proposal } from "../../domain/regeneration";
import { buildApplyPayload, defaultKeep, diffCounts, isForcedKeep, parseProposal, regenerationCandidates, regenerationDiff } from "../../domain/regeneration";
import { workoutTotals } from "@shared/workouts/structure.ts";
import { formatMinutes } from "../../domain/workoutState";
import { ChevronLeft, LoaderCircle, Sparkles, X } from "lucide-vue-next";

const emit = defineEmits<{ (e: "close"): void; (e: "applied", fromDate: string): void }>();

const store = useWorkoutsStore();
const athletes = useAthletesStore();
const settings = useSettingsStore();
const root = ref<HTMLElement | null>(null);
useModalFocus(root, () => { if (step.value !== "generating" && !applying.value) emit("close"); });

const athleteId = computed(() => athletes.currentId!);
// Il profilo aperto (con eventuali modifiche non ancora salvate), come per la generazione precedente.
const profile = computed(() => athletes.currentProfile!);
const isInitial = computed(() => !store.activePlan && !store.workouts.some((w) => w.status === "draft" || w.status === "approved"));

type Step = "params" | "generating" | "paste" | "preview";
const step = ref<Step>("params");
const fromDate = ref(addDaysISO(todayISO(), 1));
const weeks = ref(isInitial.value ? 8 : 2);
const reason = ref("");
const keep = ref<Record<string, boolean>>({});
const generationId = ref<string | null>(null);
const proposal = ref<Proposal | null>(null);
const pastedText = ref("");
const promptText = ref("");
const applying = ref(false);
const resumed = ref<GenerationRecord | null>(null);
// Generazione a blocchi: blocco in corso e numero di blocchi (vedi domain/planBlocks).
const progress = ref({ current: 0, count: 1 });

const candidates = computed(() => regenerationCandidates(store.workouts, fromDate.value));
function resetKeep() {
  const k: Record<string, boolean> = {};
  candidates.value.forEach((w) => { k[w.id] = defaultKeep(w); });
  keep.value = k;
}
onMounted(async () => {
  resetKeep();
  const pending = await store.pendingGeneration(athleteId.value);
  if (pending && pending.proposal) {
    resumed.value = pending;
    fromDate.value = pending.from_date;
    weeks.value = pending.weeks;
    reason.value = pending.reason;
    const kept = new Set(pending.kept_workout_ids);
    const k: Record<string, boolean> = {};
    candidates.value.forEach((w) => { k[w.id] = kept.has(w.id) || isForcedKeep(w); });
    keep.value = k;
    generationId.value = pending.id;
    const parsed = parseProposal(pending.proposal, parseOptions(pending.from_date, pending.weeks));
    if (!("error" in parsed)) {
      proposal.value = parsed;
      step.value = "preview";
    }
  }
});

function onFromDateChange(value: string) {
  fromDate.value = value < todayISO() ? todayISO() : value;
  resetKeep();
}
const keptIds = computed(() => candidates.value.filter((w) => keep.value[w.id] || isForcedKeep(w)).map((w) => w.id));
const keptWorkouts = computed(() => candidates.value.filter((w) => keptIds.value.includes(w.id)));
const recentWorkouts = computed(() =>
  store.workouts.filter((w) => (w.status === "draft" || w.status === "approved") && w.planned_date < fromDate.value && w.planned_date >= addDaysISO(fromDate.value, -14))
);

// Vincoli dell'atleta e sedute mantenute: la proposta viene ricontrollata contro entrambi.
function parseOptions(from: string, w: number) {
  return { fromDate: from, weeks: w, hasFtp: hasFtp(profile.value), constraints: profile.value.constraints, fixed: keptWorkouts.value };
}

function candidateReason(w: (typeof candidates.value)[number]): string {
  if (w.completed_at) return "Svolta: resta com'è";
  if (w.locked) return "Bloccata dal coach";
  const s = store.syncRows[w.id];
  if (s?.remote_event_id != null) return "Su Intervals.icu: se la sostituisci, la rimozione ti verrà proposta in «Sincronizza settimana»";
  return w.status === "draft" ? "Da revisionare" : "Approvata";
}

async function generate() {
  const w = Math.max(1, Math.min(12, Math.round(weeks.value || 1)));
  weeks.value = w;
  // Carico aggiornato prima di chiedere il piano (trigger di sincronizzazione "generazione").
  await useIntervalsSync().syncNow(athleteId.value, profile.value.integrations?.intervals_icu_api_key);
  const prompt = buildPlanPrompt(
    profile.value,
    { weeks: w, fromDate: fromDate.value, reason: reason.value, fixed: keptWorkouts.value, recent: recentWorkouts.value },
    TRAINING_PLAN_JSON_SHAPE,
    settings.settings.plan_generation_prompt_template
  );
  const created = await store.createGeneration({
    athleteId: athleteId.value, kind: isInitial.value ? "initial" : "regenerate", fromDate: fromDate.value,
    weeks: w, reason: reason.value.trim(), keptIds: keptIds.value, model: settings.settings.claude_model
  });
  if (!created.ok) { showToast(created.message, "error"); return; }
  generationId.value = created.value;

  if (!settings.settings.claude_api_key) {
    promptText.value = prompt;
    const copied = await copyToClipboardFallback(prompt);
    showToast(copied ? "Claude non è configurato: prompt copiato negli appunti. Incolla qui la risposta." : "Claude non è configurato: copia il prompt qui sotto e incolla la risposta.");
    step.value = "paste";
    return;
  }
  step.value = "generating";
  // Un piano lungo supera il limite di durata della Edge Function: lo si chiede in blocchi
  // consecutivi, passando a ogni blocco le sedute proposte nei precedenti.
  const blocks = planBlocks(fromDate.value, w);
  const raws: unknown[] = [];
  const texts: string[] = [];
  const proposed: NewWorkout[] = [];
  let truncated = false;
  for (const b of blocks) {
    progress.value = { current: b.index + 1, count: b.count };
    const blockTo = addDaysISO(b.fromDate, b.weeks * 7 - 1);
    const blockPrompt = b.count === 1 ? prompt : buildPlanPrompt(
      profile.value,
      {
        weeks: b.weeks, fromDate: b.fromDate, reason: reason.value,
        fixed: keptWorkouts.value.filter((k) => k.planned_date >= b.fromDate && k.planned_date <= blockTo),
        recent: [...recentWorkouts.value, ...proposed.map((p) => ({ ...p, completed_at: null }))],
        block: { index: b.index, count: b.count, firstWeek: b.firstWeek, totalWeeks: w, planFrom: fromDate.value }
      },
      TRAINING_PLAN_JSON_SHAPE,
      settings.settings.plan_generation_prompt_template
    );
    const result = await callClaudeProxy(blockPrompt, blockMaxTokens(b.weeks), settings.settings.claude_model);
    const where = b.count > 1 ? ` (parte ${b.index + 1} di ${b.count})` : "";
    if (!result.ok) {
      await store.saveGenerationResult(created.value, { raw_response: texts.join("\n\n") || undefined, status: "failed", error: result.error + where });
      showToast(result.error + where, "error");
      step.value = "params";
      return;
    }
    texts.push(result.text);
    truncated ||= result.truncated;
    const raw = extractJsonBlock(result.text);
    if (b.count > 1 && raw) {
      const parsed = parseProposal(raw, parseOptions(b.fromDate, b.weeks));
      if (!("error" in parsed)) proposed.push(...parsed.workouts);
    }
    raws.push(raw);
    if (!raw) break;
  }
  if (raws.some((r) => !r)) {
    handleResponse(texts.join("\n\n"), truncated, null);
    return;
  }
  handleResponse(texts.join("\n\n"), truncated, blocks.length > 1 ? mergeBlockResponses(raws) : raws[0]);
}

// `raw` gia' estratto (generazione a blocchi); se assente lo si estrae dal testo incollato.
async function handleResponse(text: string, truncated = false, extracted?: unknown) {
  const id = generationId.value!;
  const raw = extracted === undefined ? extractJsonBlock(text) : extracted;
  if (!raw) {
    await store.saveGenerationResult(id, { raw_response: text, status: "failed", error: "JSON non valido" });
    showToast(truncated
      ? "Risposta di Claude troncata per limite di token: riduci le settimane o riprova."
      : "La risposta di Claude non è un JSON valido: riprova.", "error");
    step.value = "params";
    return;
  }
  const parsed = parseProposal(raw, parseOptions(fromDate.value, weeks.value));
  if ("error" in parsed) {
    await store.saveGenerationResult(id, { raw_response: text, status: "failed", error: parsed.error });
    showToast(parsed.error, "error");
    step.value = "params";
    return;
  }
  await store.saveGenerationResult(id, { raw_response: text, proposal: raw });
  proposal.value = parsed;
  step.value = "preview";
}

const diff = computed<DiffDay[]>(() => (proposal.value ? regenerationDiff(candidates.value, new Set(keptIds.value), proposal.value.workouts) : []));
const counts = computed(() => diffCounts(diff.value));
const remoteRemovals = computed(() =>
  diff.value.flatMap((d) => d.items).filter((i) => (i.kind === "replace" || i.kind === "remove") && store.syncRows[i.old.id]?.remote_event_id != null).length
);
const oldPlan = computed(() => store.activePlan);

async function apply() {
  if (!proposal.value || !generationId.value || applying.value) return;
  applying.value = true;
  const payload = buildApplyPayload({
    generationId: generationId.value, athleteId: athleteId.value, fromDate: fromDate.value,
    weeks: weeks.value, proposal: proposal.value, diff: diff.value
  });
  const result = await store.applyGeneration(payload);
  applying.value = false;
  if (!result.ok) {
    showToast(result.message, "error");
    if (result.message.includes("ricalcola")) step.value = "params";
    return;
  }
  const added = payload.insert.length;
  showToast(`Nuova programmazione applicata: ${added} ${added === 1 ? "seduta" : "sedute"} da revisionare.`);
  emit("applied", fromDate.value);
}

// Tornare ai parametri richiede una nuova proposta: quella attuale viene scartata.
async function backToParams() {
  if (generationId.value) await store.discardGeneration(generationId.value);
  generationId.value = null;
  proposal.value = null;
  resumed.value = null;
  step.value = "params";
}

async function discard() {
  if (generationId.value) await store.discardGeneration(generationId.value);
  showToast("Proposta scartata: nessuna seduta modificata.");
  emit("close");
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(new Date(date + "T12:00:00"));
}
</script>

<template>
  <div class="sheet-backdrop" @click="step === 'params' && emit('close')"></div>
  <div class="dialog-wrap">
    <div ref="root" class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="regen-title">
      <header class="dialog-head">
        <div>
          <h3 id="regen-title">{{ isInitial ? "Genera il piano" : "Ripianifica da una data" }}</h3>
          <p>{{ step === "preview" ? "Controlla cosa cambia prima di applicare." : isInitial ? "Scegli da quando partire e per quante settimane." : "Scegli da quando ripartire e cosa tenere." }}</p>
        </div>
        <button v-if="step !== 'generating'" type="button" class="icon-btn" aria-label="Chiudi" @click="emit('close')"><X :size="18" aria-hidden="true" /></button>
      </header>

      <div class="dialog-body">
        <template v-if="step === 'params'">
          <div class="field-row">
            <label class="field"><span class="field-label">{{ isInitial ? "Primo giorno" : "Ripianifica da" }}</span>
              <input type="date" :min="todayISO()" :value="fromDate" @change="onFromDateChange(($event.target as HTMLInputElement).value)" /></label>
            <label class="field"><span class="field-label">Settimane da generare</span><input type="number" min="1" max="12" v-model.number="weeks" /></label>
          </div>
          <label class="field"><span class="field-label">{{ isInitial ? "Indicazioni per Claude (facoltative)" : "Cosa è cambiato" }}</span>
            <textarea v-model="reason" rows="2" :placeholder="isInitial ? '' : 'Ad esempio: affaticamento dopo la gara, ridurre l\'intensità per due settimane'"></textarea></label>
          <div v-if="candidates.length" class="op-group">
            <h4>Sedute dal {{ formatDate(fromDate, false) }} in poi <span class="count">{{ candidates.length }}</span></h4>
            <p class="helper-text">Le sedute che mantieni vengono passate a Claude come vincoli fissi. Quelle prima del {{ formatDate(fromDate, false) }} non vengono toccate.</p>
            <div class="op-list keep-list">
              <label v-for="w in candidates" :key="w.id">
                <input type="checkbox" :checked="keep[w.id] || isForcedKeep(w)" :disabled="isForcedKeep(w)" @change="keep[w.id] = ($event.target as HTMLInputElement).checked" />
                <span><strong>{{ dayLabel(w.planned_date) }} {{ formatDate(w.planned_date, false) }}</strong>, {{ w.title }}
                  <span class="why">{{ candidateReason(w) }}</span></span>
              </label>
            </div>
          </div>
        </template>

        <template v-else-if="step === 'generating'">
          <p class="progress-line"><LoaderCircle :size="18" class="spin" aria-hidden="true" />Claude sta preparando {{ weeks }} settimane dal {{ formatDate(fromDate, false) }}<template v-if="progress.count > 1">: parte {{ progress.current }} di {{ progress.count }}</template>…</p>
          <p class="helper-text">Ogni parte richiede circa un minuto. La proposta viene salvata quando sono pronte tutte: da quel momento, se chiudi la pagina, la ritrovi riaprendo questo dialogo. Nulla cambia finché non la applichi.</p>
        </template>

        <template v-else-if="step === 'paste'">
          <label class="field"><span class="field-label">Prompt da incollare in Claude</span><textarea class="mono-input" rows="6" readonly :value="promptText"></textarea></label>
          <label class="field"><span class="field-label">Risposta di Claude</span><textarea class="mono-input" rows="8" v-model="pastedText"></textarea></label>
        </template>

        <template v-else-if="proposal">
          <p v-if="resumed" class="helper-text">Proposta del {{ formatDate(resumed.created_at.slice(0, 10)) }}, non ancora applicata.</p>
          <p class="summary-line">{{ counts.keep }} mantenute, {{ counts.replace }} sostituite, {{ counts.add }} aggiunte, {{ counts.remove }} tolte</p>
          <p v-for="w in proposal.warnings" :key="w" class="helper-text">{{ w }}</p>
          <div v-if="remoteRemovals" class="drawer-note warn">
            {{ remoteRemovals === 1 ? "Una seduta sostituita o tolta è" : `${remoteRemovals} sedute sostituite o tolte sono` }} già su Intervals.icu.
            Applicando la proposta {{ remoteRemovals === 1 ? "verrà segnata" : "verranno segnate" }} «Da rimuovere»: la rimozione avviene solo quando confermi «Sincronizza settimana».
          </div>
          <div class="op-list">
            <div v-for="d in diff" :key="d.date" class="diff-day">
              <div class="diff-date">{{ dayLabel(d.date) }}<span>{{ formatDate(d.date, false) }}</span></div>
              <div class="diff-items">
                <div v-for="(i, n) in d.items" :key="n" class="diff-item">
                  <template v-if="i.kind === 'keep'"><span class="kind keep">Mantenuta</span><span>{{ i.old.title }}</span></template>
                  <template v-else-if="i.kind === 'add'"><span class="kind add">Aggiunta</span><span>{{ i.neu.title }}, {{ formatMinutes(workoutTotals(i.neu).seconds) }}</span><span v-if="i.neu.needs_review" class="diff-warn">{{ i.neu.needs_review }}</span></template>
                  <template v-else-if="i.kind === 'replace'"><span class="kind add">Sostituita</span><span class="old">{{ i.old.title }}</span><span>{{ i.neu.title }}, {{ formatMinutes(workoutTotals(i.neu).seconds) }}</span><span v-if="i.neu.needs_review" class="diff-warn">{{ i.neu.needs_review }}</span></template>
                  <template v-else><span class="kind rem">Tolta</span><span class="old">{{ i.old.title }}</span></template>
                </div>
              </div>
            </div>
          </div>
          <p class="helper-text">
            Le sedute nuove arrivano come bozze da revisionare. Quelle sostituite restano nello storico<template v-if="oldPlan">, nel piano «{{ oldPlan.name }}», che verrà chiuso al {{ formatDate(addDaysISO(fromDate, -1), false) }}</template>.
          </p>
        </template>
      </div>

      <footer class="dialog-foot">
        <template v-if="step === 'params'">
          <button type="button" class="secondary" @click="emit('close')">Annulla</button>
          <button type="button" class="primary" @click="generate"><Sparkles :size="16" aria-hidden="true" />Genera la proposta</button>
        </template>
        <template v-else-if="step === 'paste'">
          <button type="button" class="secondary" @click="step = 'params'">Indietro</button>
          <button type="button" class="primary" :disabled="!pastedText.trim()" @click="handleResponse(pastedText)">Leggi la risposta</button>
        </template>
        <template v-else-if="step === 'preview'">
          <button type="button" class="ghost dialog-left" :disabled="applying" @click="backToParams"><ChevronLeft :size="16" aria-hidden="true" />Modifica i parametri</button>
          <button type="button" class="secondary" :disabled="applying" @click="discard">Scarta la proposta</button>
          <button type="button" class="primary" :disabled="applying" @click="apply">{{ applying ? "Applicazione in corso…" : "Applica la nuova programmazione" }}</button>
        </template>
      </footer>
    </div>
  </div>
</template>
