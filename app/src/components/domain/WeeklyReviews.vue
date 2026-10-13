<script setup lang="ts">
// Feedback settimanale dell'atleta (ADR 0019, ADR 0038): l'elenco delle settimane, una per riga
// (FeedbackWeek.vue), e la preparazione di una settimana che non ha ancora un feedback.
// Solo l'approvazione invia l'email all'atleta (se attiva in Impostazioni).
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQueryLayer } from "../../composables/useQueryLayer";
import IconButton from "../ui/IconButton.vue";
import FeedbackWeek from "./FeedbackWeek.vue";
import { useReviewsStore, type ReviewRecord } from "../../stores/reviews";
import { useSettingsStore } from "../../stores/settings";
import { useAthletesStore } from "../../stores/athletes";
import { showResultToast } from "../../composables/useToast";
import { formatDate, todayISO } from "../../constants";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { Info, LoaderCircle } from "lucide-vue-next";

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
const focusedId = computed(() => (typeof route.query.feedback === "string" ? route.query.feedback : null));
watch(
  [focusedId, () => reviews.current.length],
  async ([id]) => {
    if (!id || !reviews.current.length) return;
    const i = reviews.current.findIndex((r) => r.id === id);
    if (i < 0) return;
    if (i >= VISIBLE) showAll.value = true;
    await nextTick();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`feedback-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  },
  { immediate: true }
);

// «Prepara il feedback»: solo le ultime sei settimane (compresa quella in corso) che non ne hanno uno (audit FB-03).
const weekOptions = computed(() => {
  const thisWeek = weekStartISO(todayISO());
  const taken = new Set(reviews.current.map((r) => r.period_start));
  return Array.from({ length: 6 }, (_, i) => addDaysISO(thisWeek, -7 * i)).filter((w) => !taken.has(w));
});
const chosenWeek = ref("");
watch(weekOptions, (opts) => { if (!opts.includes(chosenWeek.value)) chosenWeek.value = opts[0] ?? ""; }, { immediate: true });
const weekLabel = (start: string) => `${formatDate(start, false)} – ${formatDate(addDaysISO(start, 6))}`;

const emailOn = computed(() => settings.settings.weekly_feedback_email_enabled);
// Senza indirizzo dell'atleta il server non invia (delivery «skipped»): il pulsante non deve promettere l'invio.
const athletes = useAthletesStore();
const hasEmail = computed(() => !!athletes.athletes[props.athleteId ?? ""]?.identity?.email?.trim());

// Revisione precedente della stessa settimana gia' arrivata all'atleta (decisione D-07).
function sentBefore(r: ReviewRecord): ReviewRecord | undefined {
  return reviews.reviews.find((x) => x.period_start === r.period_start && x.id !== r.id && x.delivery_status === "sent");
}

async function onCreate() {
  if (chosenWeek.value) showResultToast(await reviews.create(chosenWeek.value));
}
</script>

<template>
  <section class="block" id="sec-feedback">
    <div class="section-head">
      <h2 class="section-title">Feedback settimanale</h2>
      <IconButton label="Guida: Feedback settimanale" @click="guideLayer.open('panoramica-feedback')"><Info :size="18" aria-hidden="true" /></IconButton>
    </div>

    <p v-if="!reviews.loading && !reviews.current.length" class="helper-text">Nessun feedback ancora per questo atleta.</p>
    <ul v-else class="feedback-list">
      <FeedbackWeek v-for="r in list" :key="r.id" :review="r" :email-on="emailOn" :has-email="hasEmail"
        :sent-before="r.status === 'draft' ? sentBefore(r) : undefined" :focused="focusedId === r.id" />
    </ul>
    <button v-if="reviews.current.length > VISIBLE" type="button" class="link-btn" @click="showAll = !showAll">
      {{ showAll ? "Mostra solo i più recenti" : `Mostra tutti (${reviews.current.length})` }}
    </button>
    <!-- L'azione rara dopo quella frequente (audit UX-10): prima si approva, poi si prepara un'altra settimana.
         Solo a caricamento finito: prima il selettore proporrebbe anche le settimane che hanno gia' un feedback. -->
    <h3 class="subsection-title">Prepara il feedback di un'altra settimana</h3>
    <p v-if="reviews.loading" class="helper-text">Caricamento…</p>
    <p v-else-if="!weekOptions.length" class="helper-text">Le ultime sei settimane hanno già un feedback: per rifarne uno usa «Rigenera».</p>
    <div v-else class="review-create">
      <label class="field">
        <span class="field-label">Settimana</span>
        <select v-model="chosenWeek">
          <option v-for="w in weekOptions" :key="w" :value="w">{{ weekLabel(w) }}</option>
        </select>
      </label>
      <button type="button" class="secondary" :disabled="reviews.busy !== null" @click="onCreate">
        <LoaderCircle v-if="reviews.busy === 'new'" :size="16" class="spin" aria-hidden="true" />Prepara il feedback
      </button>
    </div>
  </section>
</template>
