<script setup lang="ts">
// Generazione del piano (ADR 0017, 0018) in tre modi: primo piano, prosecuzione dopo il piano
// attivo, ripianificazione da una data che sostituisce le sedute. Tre passi:
// 1. parametri: data di ripartenza, settimane, motivo, sedute da mantenere;
// 2. proposta di Claude, salvata subito in plan_generations (si ritrova dopo un ricaricamento);
// 3. anteprima delle differenze e applicazione in un'unica transazione (apply_plan_generation).
// Nulla cambia finche' il coach non applica la proposta.
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { useWorkoutsStore, type GenerationKind, type GenerationRecord } from "../../stores/workouts";
import { useAthletesStore } from "../../stores/athletes";
import { useSettingsStore } from "../../stores/settings";
import { useReviewsStore } from "../../stores/reviews";
import { useModalFocus } from "../../composables/useModalFocus";
import { useIntervalsSync } from "../../composables/useIntervalsSync";
import { showToast } from "../../composables/useToast";
import { addDaysISO, DEFAULT_PLAN_PREFERENCES, formatDate, todayISO } from "../../constants";
import { buildPlanPrompt, promptAsText } from "../../services/planPrompt";
import { callClaudeProxy, copyToClipboardFallback, extractJsonBlock } from "../../services/claude";
import { hasFtp, zoneLimits } from "../../domain/athlete";
import { continueFromDate, cycleAnchor, MAX_PLAN_WEEKS, parseLoadPattern, planMaxTokens, planWeeks, raceEvents } from "../../domain/planWeeks";
import type { DiffDay, Proposal } from "../../domain/regeneration";
import { buildApplyPayload, defaultKeep, diffCounts, isForcedKeep, parseProposal, regenerationCandidates, regenerationDiff } from "../../domain/regeneration";
import { workoutTotals } from "@shared/workouts/structure.ts";
import { loadProgressionOf } from "@shared/feedback/params.ts";
import { formatMinutes } from "../../domain/workoutState";
import { ChevronLeft, LoaderCircle, Sparkles, X } from "lucide-vue-next";

const props = defineProps<{ kind: GenerationKind }>();
const emit = defineEmits<{ (e: "close"): void; (e: "applied", fromDate: string): void }>();

const store = useWorkoutsStore();
const athletes = useAthletesStore();
const settings = useSettingsStore();
const root = ref<HTMLElement | null>(null);
useModalFocus(root, () => { if (!busy()) emit("close"); });
// Durante la chiamata a Claude o l'applicazione il dialogo non si chiude, nemmeno con «indietro».
const busy = () => starting.value || step.value === "generating" || applying.value;
onBeforeRouteUpdate((to) => to.query.dialogo !== undefined || !busy());
onBeforeRouteLeave(() => !busy());

const athleteId = computed(() => athletes.currentId!);
// La scheda salvata, non quella in modifica (decisione D-UX-4): Claude riceve cio' che resta tracciato.
// Con modifiche non salvate, PlanTab chiede prima se salvarle.
const profile = computed(() => athletes.athletes[athleteId.value]);
// Uno schema di carico non riconosciuto toglie le fasi del ciclo: va detto prima di generare.
const patternMissing = computed(() => !parseLoadPattern(profile.value.methodology_preferences?.load_deload_pattern));
// Una proposta in sospeso riapre il dialogo nel modo in cui era stata chiesta.
const kind = ref<GenerationKind>(props.kind);
const replan = computed(() => kind.value === "regenerate");
const TITLES: Record<GenerationKind, string> = { initial: "Genera il piano", continue: "Prosegui il piano", regenerate: "Ripianifica da una data" };

type Step = "params" | "generating" | "paste" | "preview";
const step = ref<Step>("params");
const fromDate = ref(props.kind === "continue"
  ? continueFromDate(store.activePlan?.end_date, store.workouts.filter((w) => w.status === "draft" || w.status === "approved").map((w) => w.planned_date), todayISO())
  : addDaysISO(todayISO(), 1));
const weeks = ref(props.kind === "regenerate" ? 2 : MAX_PLAN_WEEKS);
const reason = ref("");
const keep = ref<Record<string, boolean>>({});
const generationId = ref<string | null>(null);
const proposal = ref<Proposal | null>(null);
const pastedText = ref("");
const promptText = ref("");
const applying = ref(false);
// Dal clic su «Genera la proposta» alla chiamata a Claude (sincronizzazione del carico, registrazione):
// il pulsante resta disattivato, un secondo clic non crea un'altra generazione.
const starting = ref(false);
const resumed = ref<GenerationRecord | null>(null);

const candidates = computed(() => regenerationCandidates(store.workouts, fromDate.value));
function resetKeep() {
  const k: Record<string, boolean> = {};
  candidates.value.forEach((w) => { k[w.id] = defaultKeep(w); });
  keep.value = k;
}
onMounted(async () => {
  resetKeep();
  const pending = await store.pendingGeneration(athleteId.value);
  // Una proposta che parte da una data ormai passata non si riprende: applicarla sostituirebbe
  // sedute dei giorni trascorsi senza attivita' registrata.
  if (pending && pending.from_date < todayISO()) {
    await store.discardGeneration(pending.id);
    showToast(`La proposta del ${formatDate(pending.created_at.slice(0, 10))} partiva dal ${formatDate(pending.from_date, false)}, una data già passata: è stata scartata.`);
    return;
  }
  if (pending && pending.proposal) {
    resumed.value = pending;
    kind.value = pending.kind;
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
  // Solo le approvate: una bozza mai approvata l'atleta non l'ha mai vista.
  store.workouts.filter((w) => w.status === "approved" && w.planned_date < fromDate.value && w.planned_date >= addDaysISO(fromDate.value, -14))
);

// Scale di passo dell'atleta: durata degli step a distanza come Intervals.icu (ADR 0030).
const pace = computed(() => athletes.paceContexts[athleteId.value] ?? null);

// Vincoli dell'atleta e sedute mantenute: la proposta viene ricontrollata contro entrambi.
function parseOptions(from: string, w: number) {
  return {
    fromDate: from, weeks: w, hasFtp: hasFtp(profile.value), constraints: profile.value.constraints, fixed: keptWorkouts.value,
    planWeeks: weeksOfPlan(from, w), progression: loadProgressionOf(profile.value.methodology_preferences),
    zoneLimits: zoneLimits(profile.value), pace: pace.value
  };
}

// Numero e fase del ciclo di carico e scarico di ogni settimana, calcolati qui e non da Claude:
// il ciclo prosegue da quello del piano attivo (ripianificazione o finestra successiva).
function weeksOfPlan(from: string, w: number) {
  const pattern = parseLoadPattern(profile.value.methodology_preferences?.load_deload_pattern);
  return planWeeks(from, w, pattern, cycleAnchor(store.activePlan?.weeks_meta, from), raceEvents(profile.value.goals?.target_events));
}

function candidateReason(w: (typeof candidates.value)[number]): string {
  if (w.completed_at) return "Svolta: resta com'è";
  if (w.locked) return "Bloccata dal coach";
  const s = store.syncRows[w.id];
  if (s?.remote_event_id != null) return "Su Intervals.icu: se la sostituisci, la rimozione ti verrà proposta in «Sincronizza settimana»";
  return w.status === "draft" ? "Bozza" : "Approvata";
}

async function generate() {
  if (starting.value) return;
  starting.value = true;
  try {
    await startGeneration();
  } finally {
    starting.value = false;
  }
}

async function startGeneration() {
  const w = Math.max(1, Math.min(MAX_PLAN_WEEKS, Math.round(weeks.value || 1)));
  weeks.value = w;
  // Carico aggiornato prima di chiedere il piano (trigger di sincronizzazione "generazione").
  await useIntervalsSync().syncNow(athleteId.value, profile.value.integrations?.intervals_icu_api_key);
  const preferences = settings.settings.plan_generation_prompt_template;
  const reviews = await useReviewsStore().analysesBefore(athleteId.value, fromDate.value);
  const prompt = buildPlanPrompt(
    profile.value,
    { weeks: w, fromDate: fromDate.value, reason: reason.value, fixed: keptWorkouts.value, recent: recentWorkouts.value, reviews, planWeeks: weeksOfPlan(fromDate.value, w), pace: pace.value },
    preferences
  );
  const maxTokens = planMaxTokens(w);
  const created = await store.createGeneration({
    athleteId: athleteId.value, kind: kind.value, fromDate: fromDate.value,
    weeks: w, reason: reason.value.trim(), keptIds: keptIds.value, model: settings.settings.claude_model,
    prompt, preferencesDefault: preferences.trim() === DEFAULT_PLAN_PREFERENCES.trim(), maxTokens
  });
  if (!created.ok) { showToast(created.message, "error"); return; }
  generationId.value = created.value;

  if (!settings.hasClaudeKey) {
    promptText.value = promptAsText(prompt);
    const copied = await copyToClipboardFallback(promptText.value);
    showToast(copied ? "Claude non è configurato: prompt copiato negli appunti. Incolla qui la risposta." : "Claude non è configurato: copia il prompt qui sotto e incolla la risposta.");
    step.value = "paste";
    return;
  }
  step.value = "generating";
  const result = await callClaudeProxy(prompt, maxTokens, settings.settings.claude_model);
  if (!result.ok) {
    await store.saveGenerationResult(created.value, { status: "failed", error: result.error });
    showToast(result.error, "error");
    step.value = "params";
    return;
  }
  await store.saveGenerationResult(created.value, { response_model: result.model, response_id: result.id, stop_reason: result.stopReason, usage: result.usage });
  handleResponse(result.text, result.truncated);
}

async function copyPrompt() {
  showToast((await copyToClipboardFallback(promptText.value)) ? "Prompt copiato negli appunti." : "Copia non riuscita: seleziona il testo e copialo a mano.");
}

async function handleResponse(text: string, truncated = false) {
  const id = generationId.value!;
  const raw = extractJsonBlock(text);
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
  showToast(`Nuova programmazione applicata: ${added} ${added === 1 ? "seduta" : "sedute"} in bozza.`);
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
  <div class="sheet-backdrop" @click="step === 'params' && !starting && emit('close')"></div>
  <div class="dialog-wrap">
    <div ref="root" class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="regen-title">
      <header class="dialog-head">
        <div>
          <h3 id="regen-title">{{ TITLES[kind] }}</h3>
          <p>{{ step === "preview" ? "Controlla cosa cambia prima di applicare." : replan ? "Scegli da quando ripartire e cosa tenere." : kind === "continue" ? "Le nuove settimane si aggiungono dopo il piano attivo, senza cambiarlo." : "Scegli da quando partire e per quante settimane." }}</p>
        </div>
        <button v-if="!busy()" type="button" class="icon-btn" aria-label="Chiudi" @click="emit('close')"><X :size="18" aria-hidden="true" /></button>
      </header>

      <div class="dialog-body">
        <template v-if="step === 'params'">
          <div class="field-row">
            <label class="field"><span class="field-label">{{ replan ? "Ripianifica da" : "Primo giorno" }}</span>
              <input type="date" :min="todayISO()" :value="fromDate" @change="onFromDateChange(($event.target as HTMLInputElement).value)" /></label>
            <label class="field"><span class="field-label">Settimane da generare</span><input type="number" min="1" :max="MAX_PLAN_WEEKS" v-model.number="weeks" /></label>
          </div>
          <div v-if="patternMissing" class="drawer-note warn" role="note">
            Lo schema di carico e scarico dell'atleta non è riconosciuto: le settimane non avranno una fase e Claude deciderà da solo carichi e scarichi. Sceglilo nel Profilo, sezione Metodologia.
          </div>
          <p class="helper-text">Al massimo {{ MAX_PLAN_WEEKS }} settimane per volta.<template v-if="kind !== 'continue'"> Quando stanno per finire, usa «Prosegui il piano»: Claude parte da come sono andate le ultime settimane e il ciclo di carico e scarico continua da dove era rimasto.</template></p>
          <label class="field"><span class="field-label">{{ replan ? "Cosa è cambiato" : "Indicazioni per Claude (facoltative)" }}</span>
            <textarea v-model="reason" rows="2" :placeholder="!replan ? '' : 'Ad esempio: affaticamento dopo la gara, ridurre l\'intensità per due settimane'"></textarea></label>
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
          <p class="progress-line"><LoaderCircle :size="18" class="spin" aria-hidden="true" />Claude sta preparando {{ weeks }} settimane dal {{ formatDate(fromDate, false) }}…</p>
          <p class="helper-text">Può richiedere fino a due minuti. La proposta viene salvata appena arriva: se chiudi la pagina la ritrovi riaprendo questo dialogo. Nulla cambia finché non la applichi.</p>
        </template>

        <template v-else-if="step === 'paste'">
          <label class="field"><span class="field-label">Prompt da incollare in Claude</span><textarea class="mono-input" rows="6" readonly :value="promptText"></textarea></label>
          <button type="button" class="secondary" @click="copyPrompt">Copia il prompt</button>
          <label class="field"><span class="field-label">Risposta di Claude</span><textarea class="mono-input" rows="8" v-model="pastedText"></textarea></label>
        </template>

        <template v-else-if="proposal">
          <p v-if="resumed" class="helper-text">Proposta del {{ formatDate(resumed.created_at.slice(0, 10)) }}, non ancora applicata.</p>
          <p class="summary-line">{{ counts.keep }} mantenute, {{ counts.replace }} sostituite, {{ counts.add }} aggiunte, {{ counts.remove }} tolte</p>
          <div v-if="proposal.warnings.length" class="drawer-note warn proposal-warnings" role="note">
            <strong>{{ proposal.warnings.length === 1 ? "Un punto da controllare" : `${proposal.warnings.length} punti da controllare` }}</strong>
            <ul>
              <li v-for="w in proposal.warnings" :key="w">{{ w }}</li>
            </ul>
          </div>
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
                  <template v-else-if="i.kind === 'add'"><span class="kind add">Aggiunta</span><span>{{ i.neu.title }}, {{ formatMinutes(workoutTotals(i.neu, pace).seconds) }}</span><span v-if="i.neu.needs_review" class="diff-warn">{{ i.neu.needs_review }}</span></template>
                  <template v-else-if="i.kind === 'replace'"><span class="kind add">Sostituita</span><span class="old">{{ i.old.title }}</span><span>{{ i.neu.title }}, {{ formatMinutes(workoutTotals(i.neu, pace).seconds) }}</span><span v-if="i.neu.needs_review" class="diff-warn">{{ i.neu.needs_review }}</span></template>
                  <template v-else><span class="kind rem">Tolta</span><span class="old">{{ i.old.title }}</span></template>
                </div>
              </div>
            </div>
          </div>
          <p class="helper-text">
            Le sedute nuove arrivano come bozze da approvare. Quelle sostituite restano nello storico<template v-if="oldPlan">, nel piano «{{ oldPlan.name }}», che verrà chiuso al {{ formatDate(addDaysISO(fromDate, -1), false) }}</template>.
          </p>
        </template>
      </div>

      <footer class="dialog-foot">
        <template v-if="step === 'params'">
          <button type="button" class="secondary" :disabled="starting" @click="emit('close')">Annulla</button>
          <button type="button" class="primary" :disabled="starting" @click="generate">
            <LoaderCircle v-if="starting" :size="16" class="spin" aria-hidden="true" /><Sparkles v-else :size="16" aria-hidden="true" />{{ starting ? "Preparo la richiesta…" : "Genera la proposta" }}
          </button>
        </template>
        <template v-else-if="step === 'paste'">
          <button type="button" class="secondary" @click="backToParams">Indietro</button>
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
