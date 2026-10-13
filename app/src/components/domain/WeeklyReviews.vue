<script setup lang="ts">
// Feedback settimanale dell'atleta (ADR 0019): per ogni settimana l'esito delle sedute calcolato
// da PCoach, le limitazioni dei dati e il testo scritto da Claude, che il coach rivede e approva.
// Solo l'approvazione invia l'email all'atleta (se attiva in Impostazioni).
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQueryLayer } from "../../composables/useQueryLayer";
import IconButton from "../ui/IconButton.vue";
import { useReviewsStore, type ReviewRecord } from "../../stores/reviews";
import { useSettingsStore } from "../../stores/settings";
import { useAthletesStore } from "../../stores/athletes";
import { showResultToast } from "../../composables/useToast";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { disciplineLabel, formatDate, todayISO } from "../../constants";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import type { SessionOutcome } from "@shared/feedback/types.ts";
import { CircleCheck, CircleDashed, Info, LoaderCircle, Mail, PencilLine, RefreshCw, TriangleAlert } from "lucide-vue-next";

const props = defineProps<{ athleteId: string | null }>();
const reviews = useReviewsStore();
const settings = useSettingsStore();

watch(() => props.athleteId, (id) => void reviews.load(id), { immediate: true });


// Valutazioni in preparazione sul server: si rileggono da sole ogni 30 secondi finche' ce n'e' una.
const REFRESH_MS = 30_000;
const preparing = computed(() => reviews.current.some((r) => r.status === "pending" || r.status === "analyzed"));
let timer: ReturnType<typeof setInterval> | null = null;
watch(preparing, (on) => {
  if (timer) clearInterval(timer);
  timer = on ? setInterval(() => void reviews.refresh(), REFRESH_MS) : null;
}, { immediate: true });
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

const VISIBLE = 4;
const showAll = ref(false);
const list = computed(() => (showAll.value ? reviews.current : reviews.current.slice(0, VISIBLE)));

// Link a una settimana precisa (?feedback=ID, dalla pagina «Da fare» e dalle anomalie: audit UX-14).
const route = useRoute();
const guideLayer = useQueryLayer("guida");
watch(
  [() => route.query.feedback, () => reviews.current.length],
  async ([id]) => {
    if (typeof id !== "string" || !reviews.current.length) return;
    const i = reviews.current.findIndex((r) => r.id === id);
    if (i < 0) return;
    if (i >= VISIBLE) showAll.value = true;
    await nextTick();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`feedback-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  },
  { immediate: true }
);

// Settimane valutabili: le ultime sei, compresa quella in corso.
const weekOptions = computed(() => {
  const thisWeek = weekStartISO(todayISO());
  return Array.from({ length: 6 }, (_, i) => addDaysISO(thisWeek, -7 * i));
});
const chosenWeek = ref(addDaysISO(weekStartISO(todayISO()), -7));
const weekLabel = (start: string) => `${formatDate(start, false)} – ${formatDate(addDaysISO(start, 6))}`;

// Testo modificabile delle bozze, per valutazione.
const drafts = reactive<Record<string, string>>({});
watch(() => reviews.reviews, (rows) => {
  for (const r of rows) if (r.status === "draft" && drafts[r.id] === undefined) drafts[r.id] = r.output_text ?? "";
}, { immediate: true });

type Tone = "warn" | "err" | "neutral" | "plain";
function statusBadge(r: ReviewRecord): { text: string; tone: Tone; icon: unknown } {
  if (r.status === "draft") return { text: "Da approvare", tone: "warn", icon: PencilLine };
  if (r.status === "approved") {
    if (r.delivery_status === "sent") return { text: "Inviato all'atleta", tone: "neutral", icon: Mail };
    if (r.delivery_status === "failed" || r.delivery_status === "skipped") return { text: "Approvato, email non inviata", tone: "err", icon: TriangleAlert };
    return { text: "Approvato", tone: "neutral", icon: CircleCheck };
  }
  if (r.status === "pending" || r.status === "analyzed") return { text: "In preparazione", tone: "plain", icon: LoaderCircle };
  if (r.status === "skipped") return { text: "Nessuna seduta da valutare", tone: "plain", icon: CircleDashed };
  return { text: "Non riuscito", tone: "err", icon: TriangleAlert };
}

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

function countsText(r: ReviewRecord): string[] {
  const m = r.input?.metrics;
  if (!m) return [];
  const s = m.sessions;
  const parts = [`${s.assigned} ${s.assigned === 1 ? "seduta assegnata" : "sedute assegnate"}`];
  if (s.completed + s.moved) parts.push(`${s.completed + s.moved} svolte`);
  if (s.partial) parts.push(`${s.partial} in parte`);
  if (s.not_recorded) parts.push(`${s.not_recorded} senza attività registrata`);
  if (s.unknown) parts.push(`${s.unknown} non valutabili`);
  if (s.pending) parts.push(`${s.pending} in programma`);
  if (s.extra) parts.push(`${s.extra} ${s.extra === 1 ? "attività extra" : "attività extra"}`);
  if (m.completion_rate.reportable && m.completion_rate.value !== null) parts.push(`completamento ${Math.round(m.completion_rate.value * 100)}%`);
  return parts;
}

function minutes(n: number | null | undefined): string {
  if (n == null) return "";
  return n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")} min` : `${n} min`;
}

function limitations(r: ReviewRecord): string[] {
  return r.output?.limitations?.length ? r.output.limitations : r.input?.limitations ?? [];
}

const emailOn = computed(() => settings.settings.weekly_feedback_email_enabled);
// Senza indirizzo dell'atleta il server non invia (delivery «skipped»): il pulsante non deve promettere l'invio.
const athletes = useAthletesStore();
const hasEmail = computed(() => !!athletes.athletes[props.athleteId ?? ""]?.identity?.email?.trim());
const busy = (id: string) => reviews.busy === id;

async function onCreate() {
  showResultToast(await reviews.create(chosenWeek.value));
}
// Revisione precedente della stessa settimana gia' arrivata all'atleta (decisione D-07): si chiede
// ogni volta se inviare anche la nuova, con una scelta esplicita invece di un invio automatico.
function sentBefore(r: ReviewRecord): ReviewRecord | undefined {
  return reviews.reviews.find((x) => x.period_start === r.period_start && x.id !== r.id && x.delivery_status === "sent");
}
const resend = reactive<Record<string, boolean>>({});
/** Scelta del coach: inviare questa versione (se l'email e' attiva). */
const wantsSend = (r: ReviewRecord) => !sentBefore(r) || !!resend[r.id];
const willSend = (r: ReviewRecord) => emailOn.value && hasEmail.value && wantsSend(r);

async function onApprove(r: ReviewRecord) {
  showResultToast(await reviews.approve(r.id, drafts[r.id] ?? r.output_text ?? "", wantsSend(r)));
}
async function onRegenerate(r: ReviewRecord) {
  if (r.delivery_status === "sent") {
    const ok = await confirmDialog(
      `L'atleta ha già ricevuto questo feedback${r.delivered_at ? ` il ${formatDate(r.delivered_at.slice(0, 10))}` : ""}. Rigenerandolo prepari una nuova versione da approvare: all'approvazione sceglierai se inviarla.`,
      { confirmLabel: "Rigenera", cancelLabel: "Annulla", tone: "primary" }
    );
    if (!ok) return;
  }
  delete drafts[r.id];
  showResultToast(await reviews.regenerate(r.id));
}
async function onRetry(r: ReviewRecord) {
  showResultToast(await reviews.retry(r.id));
}
</script>

<template>
  <section class="block" id="sec-feedback">
    <div class="section-head">
      <h3 class="section-title">Feedback settimanale</h3>
      <IconButton label="Guida: Feedback settimanale" @click="guideLayer.open('panoramica-feedback')"><Info :size="18" aria-hidden="true" /></IconButton>
    </div>

    <p v-if="!reviews.loading && !reviews.current.length" class="helper-text">Nessun feedback ancora per questo atleta.</p>
    <ul v-else class="feedback-list">
      <li v-for="r in list" :id="`feedback-${r.id}`" :key="r.id" class="feedback-item">
        <p class="feedback-head">
          <time :datetime="r.period_start">{{ weekLabel(r.period_start) }}</time>
          <span class="w-badge" :class="statusBadge(r).tone">
            <component :is="statusBadge(r).icon" :size="14" aria-hidden="true" />{{ statusBadge(r).text }}
          </span>
          <span v-if="r.revision > 1">versione {{ r.revision }}</span>
        </p>

        <p v-if="countsText(r).length" class="review-counts">
          <span v-for="t in countsText(r)" :key="t">{{ t }}</span>
        </p>

        <details v-if="r.input?.sessions.length" class="review-sessions">
          <summary>Sedute della settimana</summary>
          <ul>
            <li v-for="s in r.input.sessions" :key="s.workout_id">
              <span class="review-session-date">{{ formatDate(s.date, false) }}</span>
              <span>{{ s.title || disciplineLabel(s.discipline) }}</span>
              <span :class="{ 'review-caution': CAUTION.has(s.outcome) }">{{ OUTCOME_LABELS[s.outcome] }}</span>
              <span v-if="s.done_minutes != null" class="review-muted">{{ minutes(s.done_minutes) }} su {{ minutes(s.planned_minutes) }}</span>
              <span v-else-if="s.planned_minutes" class="review-muted">previsti {{ minutes(s.planned_minutes) }}</span>
            </li>
          </ul>
        </details>

        <ul v-if="limitations(r).length && r.status !== 'skipped'" class="review-limits">
          <li v-for="l in limitations(r)" :key="l">{{ l }}</li>
        </ul>

        <p v-if="r.output?.summary" class="review-summary"><strong>Per te:</strong> {{ r.output.summary }}</p>

        <template v-if="r.status === 'draft'">
          <label class="field review-text">
            <span class="field-label">Testo per l'atleta (modificabile)</span>
            <textarea v-model="drafts[r.id]" rows="8"></textarea>
          </label>
          <div class="review-actions">
            <button type="button" class="primary" :disabled="reviews.busy !== null || !drafts[r.id]?.trim()" @click="onApprove(r)">
              <LoaderCircle v-if="busy(r.id)" :size="16" class="spin" aria-hidden="true" />{{ willSend(r) ? "Approva e invia" : "Approva" }}
            </button>
            <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRegenerate(r)">
              <RefreshCw :size="16" aria-hidden="true" />Rigenera
            </button>
          </div>
          <label v-if="emailOn && hasEmail && sentBefore(r)" class="checkbox-line">
            <input type="checkbox" v-model="resend[r.id]" />
            Invia anche questa versione: l'atleta ha già ricevuto la versione {{ sentBefore(r)!.revision }}{{ sentBefore(r)!.delivered_at ? ` il ${formatDate(sentBefore(r)!.delivered_at!.slice(0, 10))}` : "" }}
          </label>
          <p v-if="!emailOn" class="helper-text">L'invio via email è disattivato in Impostazioni: approvando, il feedback resta solo qui.</p>
          <p v-else-if="!hasEmail" class="helper-text error-text">L'atleta non ha un indirizzo email: approvando, il feedback non gli arriva e resta fra le anomalie. Aggiungi l'indirizzo nel Profilo, sezione Identità, poi «Riprova l'invio».</p>
        </template>

        <template v-else-if="r.status === 'approved'">
          <p class="feedback-note">{{ r.output_text }}</p>
          <p v-if="r.delivery_status === 'sent' && r.delivered_at" class="helper-text">Inviato il {{ formatDate(r.delivered_at.slice(0, 10)) }}.</p>
          <p v-else-if="r.delivery_status === 'failed' || r.delivery_status === 'skipped'" class="error-text">
            Email non inviata: {{ r.delivery_error || "motivo sconosciuto" }}
            <button v-if="hasEmail" type="button" class="link-btn" :disabled="reviews.busy !== null" @click="onRetry(r)">Riprova l'invio</button>
            <template v-else> Aggiungi l'indirizzo nel Profilo, sezione Identità, poi riprova.</template>
          </p>
          <div class="review-actions">
            <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRegenerate(r)"><RefreshCw :size="16" aria-hidden="true" />Rigenera</button>
          </div>
        </template>

        <template v-else-if="r.status === 'analysis_failed' || r.status === 'generation_failed'">
          <p class="error-text">{{ r.error || "Valutazione non riuscita." }}</p>
          <div class="review-actions">
            <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onRetry(r)">
              <LoaderCircle v-if="busy(r.id)" :size="16" class="spin" aria-hidden="true" />Riprova
            </button>
          </div>
        </template>

        <p v-else-if="r.status === 'skipped'" class="helper-text">In quella settimana non c'erano sedute approvate.</p>
        <p v-else class="helper-text">
          PCoach sta preparando il feedback: questa sezione si aggiorna da sola.
          <button type="button" class="link-btn" @click="reviews.refresh()">Aggiorna ora</button>
        </p>
      </li>
    </ul>
    <button v-if="reviews.current.length > VISIBLE" type="button" class="link-btn" @click="showAll = !showAll">
      {{ showAll ? "Mostra solo i più recenti" : `Mostra tutti (${reviews.current.length})` }}
    </button>
    <!-- L'azione rara dopo quella frequente (audit UX-10): prima si approva, poi si prepara un'altra settimana. -->
    <h4 class="subsection-title">Prepara il feedback di un'altra settimana</h4>
    <div class="review-create">
      <label class="field">
        <span class="field-label">Settimana</span>
        <select v-model="chosenWeek">
          <option v-for="w in weekOptions" :key="w" :value="w">{{ weekLabel(w) }}</option>
        </select>
      </label>
      <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onCreate">
        <LoaderCircle v-if="busy('new')" :size="16" class="spin" aria-hidden="true" />Prepara il feedback
      </button>
    </div>
  </section>
</template>
