<script setup lang="ts">
// Tab «Anomalie» della scheda (ADR 0031, 0033, 0034): un solo elenco, prima cio' che e' gia' fallito e
// poi cio' che va sistemato. Ogni voce dice cosa ferma e porta l'azione per sistemarla. L'elenco lo
// calcola useAthleteAnomalies, che da' anche il numero nell'etichetta della tab.
import { ANOMALY_STOPS, type Anomaly } from "../../composables/useAthleteAnomalies";
import { CircleAlert, TriangleAlert } from "lucide-vue-next";

defineProps<{ anomalies: Anomaly[]; checking: boolean; busy: boolean }>();
</script>

<template>
  <div class="anomalies">
    <p v-if="checking" class="helper-text" role="status">Controllo zone e soglie su Intervals.icu…</p>
    <section v-if="!anomalies.length && !checking" class="block">
      <h3>Nessuna anomalia</h3>
      <p class="helper-text">
        Qui compaiono zone o soglie diverse da Intervals.icu, soglie o email mancanti, sedute da verificare, invii non riusciti e
        feedback fermi, con l'azione per sistemarli.
      </p>
    </section>
    <ul v-else-if="anomalies.length" class="anomaly-unit">
      <li v-for="a in anomalies" :key="a.key" class="anomaly" :class="a.tone">
        <component :is="a.tone === 'err' ? CircleAlert : TriangleAlert" :size="16" class="anomaly-icon" aria-hidden="true" />
        <div class="anomaly-main">
          <p class="anomaly-title">{{ a.title }}</p>
          <p class="anomaly-stops">Ferma: {{ ANOMALY_STOPS[a.group] }}</p>
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
  </div>
</template>
