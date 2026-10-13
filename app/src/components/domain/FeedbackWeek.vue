<script setup lang="ts">
// Una settimana del feedback settimanale (ADR 0019, ADR 0038). La bozza da approvare e quella in
// preparazione sono aperte; le settimane chiuse (approvate, non riuscite) sono una riga che si apre con
// un clic, con l'errore e la sua azione sempre visibili (audit FB-04, FB-07). Il testo della bozza vive
// nello store e si salva in automatico mentre il coach scrive.
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useReviewsStore, type ReviewRecord } from "../../stores/reviews";
import { showResultToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { disciplineLabel, formatDate } from "../../constants";
import { addDaysISO } from "@shared/workouts/calendar.ts";
import type { SessionOutcome } from "@shared/feedback/types.ts";
import { countsSentence } from "../../domain/feedbackText";
import { ChevronRight, CircleCheck, CircleDashed, LoaderCircle, Mail, PencilLine, RefreshCw, TriangleAlert } from "lucide-vue-next";

const props = defineProps<{
  review: ReviewRecord;
  emailOn: boolean;
  hasEmail: boolean;
  /** Revisione precedente della stessa settimana gia' arrivata all'atleta (decisione D-07). */
  sentBefore?: ReviewRecord;
  /** Aperta da un link (?feedback=ID). */
  focused?: boolean;
}>();
const reviews = useReviewsStore();
const r = computed(() => props.review);

type Tone = "warn" | "err" | "neutral" | "plain";
const badge = computed((): { text: string; tone: Tone; icon: unknown } => {
  const x = r.value;
  if (x.status === "draft") return { text: "Da approvare", tone: "warn", icon: PencilLine };
  if (x.status === "approved") {
    if (x.delivery_status === "sent") return { text: "Inviato all'atleta", tone: "neutral", icon: Mail };
    if (x.delivery_status === "failed" || x.delivery_status === "skipped") return { text: "Approvato, email non inviata", tone: "err", icon: TriangleAlert };
    return { text: "Approvato", tone: "neutral", icon: CircleCheck };
  }
  if (x.status === "pending" || x.status === "analyzed") return { text: "In preparazione", tone: "plain", icon: LoaderCircle };
  if (x.status === "skipped") return { text: "Nessuna seduta da valutare", tone: "plain", icon: CircleDashed };
  return { text: "Non riuscito", tone: "err", icon: TriangleAlert };
});

// Dove si aggiunge l'email dell'atleta: Profilo, sezione Identita' aperta (come «Aggiungila nel Profilo» nelle anomalie).
const identityLink = computed(() => ({ name: "athlete", params: { id: r.value.athlete_id, tab: "profilo" }, query: { sezione: "sec-identita" } }));
const weekLabel = (start: string) => `${formatDate(start, false)} – ${formatDate(addDaysISO(start, 6))}`;
const isDraft = computed(() => r.value.status === "draft");
const isPreparing = computed(() => r.value.status === "pending" || r.value.status === "analyzed");
const isFailed = computed(() => r.value.status === "analysis_failed" || r.value.status === "generation_failed");
const emailFailed = computed(() => r.value.status === "approved" && (r.value.delivery_status === "failed" || r.value.delivery_status === "skipped"));
/** Settimana chiusa: una riga che si apre con un clic. Una settimana senza sedute non ha altro da mostrare. */
const collapsible = computed(() => r.value.status === "approved" || isFailed.value);
const open = ref(false);
watch(() => props.focused, (f) => { if (f) open.value = true; }, { immediate: true });
const showBody = computed(() => !collapsible.value || open.value);
// Riga chiusa: la data d'invio, o la versione per una bozza rigenerata.
const meta = computed(() => {
  const x = r.value;
  if (x.status === "approved" && x.delivery_status === "sent" && x.delivered_at) return `inviato il ${formatDate(x.delivered_at.slice(0, 10))}`;
  if (x.status === "approved" && x.approved_at) return `approvato il ${formatDate(x.approved_at.slice(0, 10))}`;
  return "";
});

const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  completed: "Svolta",
  over: "Svolta, più lunga del previsto",
  partial: "Svolta in parte",
  short: "Molto più breve del previsto",
  moved: "Probabilmente spostata",
  substituted: "Al suo posto un'altra disciplina",
  not_recorded: "Nessuna attività registrata",
  data_unavailable: "Dato non disponibile",
  pending: "In programma",
  ambiguous: "Non attribuibile con certezza"
};
const CAUTION = new Set<SessionOutcome>(["not_recorded", "data_unavailable", "ambiguous", "substituted", "short"]);
function minutes(n: number | null | undefined): string {
  if (n == null) return "";
  return n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")} min` : `${n} min`;
}
const counts = computed(() => countsSentence(r.value.input?.metrics));
const limitations = computed(() => (r.value.output?.limitations?.length ? r.value.output.limitations : r.value.input?.limitations ?? []));

// ---------- Bozza: testo salvato in automatico (ADR 0038) ----------
const text = computed({
  get: () => reviews.texts[r.value.id] ?? r.value.coach_text ?? r.value.output_text ?? "",
  set: (value: string) => reviews.editText(r.value.id, value)
});
// Il campo cresce con il testo: niente scorrimento dentro il riquadro (audit FB-05).
const textarea = ref<HTMLTextAreaElement | null>(null);
function autosize() {
  const el = textarea.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}
// Una larghezza diversa (finestra, telefono ruotato) cambia gli a capo: si ricalcola l'altezza.
let lastWidth = 0;
const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(([entry]) => {
  if (entry.contentRect.width !== lastWidth) { lastWidth = entry.contentRect.width; autosize(); }
});
// Il campo compare anche dopo il montaggio (una bozza appena preparata).
watch(textarea, (el, old) => {
  if (old) observer?.unobserve(old);
  if (el) { observer?.observe(el); autosize(); }
}, { flush: "post" });
onBeforeUnmount(() => observer?.disconnect());
watch(text, () => void nextTick(autosize));

const resend = reactive<Record<string, boolean>>({});
/** Scelta del coach: inviare questa versione (se l'email e' attiva). */
const wantsSend = computed(() => !props.sentBefore || !!resend[r.value.id]);
const willSend = computed(() => props.emailOn && props.hasEmail && wantsSend.value);
const busy = computed(() => reviews.busy === r.value.id);

async function onApprove() {
  showResultToast(await reviews.approve(r.value.id, text.value, wantsSend.value));
}
async function onRegenerate() {
  const x = r.value;
  if (x.status === "draft" && reviews.isEdited(x.id)) {
    const ok = await confirmDialog("Rigenerando, Claude riscrive il testo e perdi le tue correzioni.", { confirmLabel: "Rigenera e perdi le correzioni", cancelLabel: "Annulla" });
    if (!ok) return;
  } else if (x.delivery_status === "sent") {
    const ok = await confirmDialog(
      `L'atleta ha già ricevuto questo feedback${x.delivered_at ? ` il ${formatDate(x.delivered_at.slice(0, 10))}` : ""}. Rigenerandolo prepari una nuova versione da approvare: all'approvazione sceglierai se inviarla.`,
      { confirmLabel: "Rigenera", cancelLabel: "Annulla", tone: "primary" }
    );
    if (!ok) return;
  }
  showResultToast(await reviews.regenerate(x.id));
}
async function onRetry() {
  showResultToast(await reviews.retry(r.value.id));
}
</script>

<template>
  <li :id="`feedback-${review.id}`" class="feedback-item" :class="{ closed: collapsible && !open }">
    <div class="feedback-head">
      <button v-if="collapsible" type="button" class="feedback-toggle" :aria-expanded="open" :aria-controls="`feedback-${review.id}-body`" @click="open = !open">
        <ChevronRight :size="16" class="section-caret" aria-hidden="true" />
        <time :datetime="review.period_start">{{ weekLabel(review.period_start) }}</time>
      </button>
      <time v-else :datetime="review.period_start">{{ weekLabel(review.period_start) }}</time>
      <span class="w-badge" :class="badge.tone">
        <component :is="badge.icon" :size="14" aria-hidden="true" />{{ badge.text }}
      </span>
      <span v-if="review.revision > 1" class="review-muted">versione {{ review.revision }}</span>
      <span v-if="meta" class="review-muted">{{ meta }}</span>
    </div>

    <!-- Errori e loro azione: visibili anche con la riga chiusa (audit FB-07). -->
    <p v-if="emailFailed" class="error-text feedback-alert">
      Email non inviata. {{ review.delivery_error || "Motivo sconosciuto." }}
      <button v-if="hasEmail" type="button" class="link-btn" :disabled="reviews.busy !== null" @click="onRetry">Riprova l'invio</button>
      <template v-else> <RouterLink :to="identityLink">Aggiungi l'indirizzo nel Profilo</RouterLink>, poi riprova.</template>
    </p>
    <div v-if="isFailed" class="feedback-alert">
      <p class="error-text">{{ review.error || "Valutazione non riuscita." }}</p>
      <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRetry">
        <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true" />Riprova
      </button>
    </div>

    <p v-if="isPreparing" class="helper-text">
      PCoach sta preparando il feedback: questa sezione si aggiorna da sola.
      <button type="button" class="link-btn" @click="reviews.refresh()">Aggiorna ora</button>
    </p>

    <div v-if="review.status !== 'skipped' && !isPreparing" v-show="showBody" :id="`feedback-${review.id}-body`" class="feedback-body">
      <p v-if="counts" class="review-counts">{{ counts }}</p>

      <details v-if="review.input?.sessions.length" class="review-sessions">
        <summary>Sedute della settimana</summary>
        <ul>
          <li v-for="s in review.input.sessions" :key="s.workout_id">
            <span class="review-session-date">{{ formatDate(s.date, false) }}</span>
            <span>{{ s.title || disciplineLabel(s.discipline) }}</span>
            <span :class="{ 'review-caution': CAUTION.has(s.outcome) }">{{ OUTCOME_LABELS[s.outcome] }}</span>
            <span v-if="s.done_minutes != null" class="review-muted">{{ minutes(s.done_minutes) }} su {{ minutes(s.planned_minutes) }}</span>
            <span v-else-if="s.planned_minutes" class="review-muted">previsti {{ minutes(s.planned_minutes) }}</span>
          </li>
        </ul>
      </details>

      <div v-if="limitations.length" class="review-limits">
        <p class="review-limits-title">Limiti dei dati:</p>
        <ul><li v-for="l in limitations" :key="l">{{ l }}</li></ul>
      </div>

      <p v-if="review.output?.summary" class="review-summary"><strong>Sintesi per te:</strong> {{ review.output.summary }}</p>

      <template v-if="isDraft">
        <label class="field review-text">
          <span class="field-label">Testo per l'atleta (modificabile)</span>
          <textarea ref="textarea" v-model="text" rows="4" @blur="reviews.flushText(review.id)"></textarea>
        </label>
        <!-- Decide se «Approva» invia: sta prima del pulsante (audit FB-06). -->
        <label v-if="emailOn && hasEmail && sentBefore" class="checkbox-line">
          <input type="checkbox" v-model="resend[review.id]" />
          Invia anche questa versione: l'atleta ha già ricevuto la versione {{ sentBefore.revision }}{{ sentBefore.delivered_at ? ` il ${formatDate(sentBefore.delivered_at.slice(0, 10))}` : "" }}
        </label>
        <!-- Cosa succede approvando: prima dei pulsanti, come la casella del reinvio (audit A-18). -->
        <p v-if="!emailOn" class="helper-text">L'invio via email è disattivato in Impostazioni: approvando, il feedback resta solo qui.</p>
        <p v-else-if="!hasEmail" class="helper-text error-text">L'atleta non ha un indirizzo email: approvando, il feedback non gli arriva e resta fra le anomalie. <RouterLink :to="identityLink">Aggiungi l'indirizzo nel Profilo</RouterLink>, poi «Riprova l'invio».</p>
        <div class="review-actions">
          <button type="button" class="primary" :disabled="reviews.busy !== null || !text.trim()" @click="onApprove">
            <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true" />{{ willSend ? "Approva e invia" : "Approva" }}
          </button>
          <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRegenerate">
            <RefreshCw :size="16" aria-hidden="true" />Rigenera
          </button>
        </div>
      </template>

      <template v-else-if="review.status === 'approved'">
        <p class="feedback-note">{{ review.output_text }}</p>
        <div class="review-actions">
          <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRegenerate"><RefreshCw :size="16" aria-hidden="true" />Rigenera</button>
        </div>
      </template>
    </div>
  </li>
</template>
