<script setup lang="ts">
// Tab «Feedback» della scheda (ADR 0046): l'andamento dell'aderenza delle ultime settimane, poi
// l'elenco delle settimane (WeeklyReviews). I feedback li legge la scheda (AthleteEditor), non la tab.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useReviewsStore } from "../../stores/reviews";
import AdherenceTrend from "./AdherenceTrend.vue";
import WeeklyReviews from "./WeeklyReviews.vue";

defineProps<{ athleteId: string }>();
const reviews = useReviewsStore();
const route = useRoute();
const router = useRouter();
const focusedId = computed(() => (typeof route.query.feedback === "string" ? route.query.feedback : null));

/** Un clic su una settimana del grafico la apre nell'elenco, come un link «Apri il feedback». */
function openWeek(id: string) {
  void router.replace({ query: { ...route.query, feedback: id } });
}
</script>

<template>
  <AdherenceTrend v-if="reviews.current.length" :reviews="reviews.current" :selected="focusedId" @open="openWeek" />
  <WeeklyReviews :athlete-id="athleteId" />
</template>
