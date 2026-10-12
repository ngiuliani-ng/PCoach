<script setup lang="ts">
// Tab «Anomalie» della scheda (ADR 0031, 0033): le anomalie dell'atleta raggruppate per cio' che
// fermano, ognuna con l'azione per sistemarla. L'elenco lo calcola useAthleteAnomalies, che da'
// anche il numero nell'etichetta della tab.
import { computed } from "vue";
import type { Anomaly, AnomalyGroup } from "../../composables/useAthleteAnomalies";
import { CircleAlert, TriangleAlert } from "lucide-vue-next";

const props = defineProps<{ anomalies: Anomaly[]; checking: boolean; busy: boolean }>();

const GROUPS: { key: AnomalyGroup; title: string; help: string }[] = [
  { key: "both", title: "Fermano il feedback e l'invio a Intervals.icu", help: "Finché restano, il feedback del lunedì non parte e le sedute non vanno sul calendario dell'atleta." },
  { key: "feedback", title: "Fermano il feedback settimanale", help: "Il feedback del lunedì non parte, o non arriva all'atleta, finché restano." },
  { key: "sync", title: "Fermano l'invio a Intervals.icu", help: "Le sedute coinvolte restano in PCoach: l'atleta non le vede sul suo calendario." }
];
const groups = computed(() => GROUPS.map((g) => ({ ...g, items: props.anomalies.filter((a) => a.group === g.key) })).filter((g) => g.items.length));
</script>

<template>
  <div class="anomalies">
    <p v-if="checking" class="helper-text" role="status">Controllo zone e soglie su Intervals.icu…</p>
    <section v-if="!anomalies.length && !checking" class="block">
      <h3>Nessuna anomalia</h3>
      <p class="helper-text">
        Qui compaiono zone o soglie diverse da Intervals.icu, soglie mancanti, sedute da verificare, invii non riusciti e feedback
        fermi, con l'azione per sistemarli.
      </p>
    </section>
    <section v-for="g in groups" :key="g.key" class="block">
      <h3>{{ g.title }}</h3>
      <p class="helper-text">{{ g.help }}</p>
      <ul class="anomaly-unit">
        <li v-for="a in g.items" :key="a.key" class="anomaly" :class="a.tone">
          <component :is="a.tone === 'err' ? CircleAlert : TriangleAlert" :size="16" class="anomaly-icon" aria-hidden="true" />
          <div class="anomaly-main">
            <p class="anomaly-title">{{ a.title }}</p>
            <p class="anomaly-detail">{{ a.detail }}</p>
            <ul v-if="a.items?.length" class="anomaly-items">
              <li v-for="i in a.items" :key="i.id">
                <button type="button" class="link-btn" @click="i.open">{{ i.text }}</button>
                <span v-if="i.reason" class="anomaly-reason">{{ i.reason }}</span>
              </li>
            </ul>
            <div v-if="a.actions.length" class="anomaly-actions">
              <template v-for="act in a.actions" :key="act.label">
                <button v-if="act.kind === 'write'" type="button" class="secondary" :disabled="busy" @click="act.run">{{ act.label }}</button>
                <button v-else type="button" class="link-btn" @click="act.run">{{ act.label }}</button>
              </template>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
