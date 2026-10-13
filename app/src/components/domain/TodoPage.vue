<script setup lang="ts">
// Pagina iniziale «Da fare» (decisione del coach D-01): per ogni atleta cio' che chiede un'azione, con
// il link al punto esatto. Prima cio' che e' fallito, poi cio' che va sistemato, poi le approvazioni.
import { computed, onMounted } from "vue";
import { formatDate } from "../../constants";
import { useAthletesStore } from "../../stores/athletes";
import { useTodoStore } from "../../stores/todo";
import { CircleAlert, CircleCheck, Clock, TriangleAlert } from "lucide-vue-next";

const athletes = useAthletesStore();
const todo = useTodoStore();
onMounted(() => void todo.refresh());

const ICONS = { err: CircleAlert, warn: TriangleAlert, info: Clock };

// Chiave, zone e soglie si controllano su Intervals.icu ogni 30 minuti e all'apertura di una scheda (ADR 0037).
const checkNote = computed(() => {
  if (!todo.lastCheckAt) return "Chiave, zone e soglie si controllano su Intervals.icu ogni 30 minuti: il primo controllo non è ancora avvenuto.";
  const at = new Date(todo.lastCheckAt);
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(at);
  const day = at.toDateString() === new Date().toDateString() ? "oggi" : formatDate(todo.lastCheckAt.slice(0, 10));
  return `Chiave, zone e soglie controllate su Intervals.icu ${day} alle ${time}; il controllo si ripete ogni 30 minuti.`;
});
</script>

<template>
  <div class="form-wrap todo-page">
    <p v-if="!athletes.loaded" class="placeholder">Caricamento…</p>
    <div v-else-if="!athletes.sortedList.length" class="placeholder">
      <h1>Nessun atleta</h1>
      <p>Crea la prima scheda con «Nuovo atleta» nell'elenco: nome, discipline e obiettivi bastano per generare un piano.</p>
    </div>
    <template v-else>
      <header class="page-header">
        <h1>Da fare</h1>
      </header>
      <p v-if="todo.error" class="drawer-note error" role="alert">{{ todo.error }}</p>
      <p v-else-if="!todo.loaded" class="helper-text">Controllo gli atleti…</p>
      <section v-else-if="!todo.list.length" class="block todo-empty">
        <CircleCheck :size="20" aria-hidden="true" />
        <div>
          <h2>Niente da fare</h2>
          <p class="helper-text">Qui compaiono feedback da approvare, sedute in bozza o da verificare, invii non riusciti e dati mancanti di tutti gli atleti.</p>
        </div>
      </section>
      <template v-else>
      <section v-for="a in todo.list" :key="a.id" class="block todo-athlete">
        <h2><RouterLink :to="{ name: 'athlete', params: { id: a.id } }">{{ a.name }}</RouterLink></h2>
        <ul class="anomaly-unit">
          <li v-for="item in a.items" :key="item.key" class="anomaly" :class="item.tone">
            <component :is="ICONS[item.tone]" :size="16" class="anomaly-icon" aria-hidden="true" />
            <div class="anomaly-main">
              <p class="anomaly-title">{{ item.title }}</p>
              <p v-if="item.detail" class="anomaly-detail">{{ item.detail }}</p>
              <ul class="anomaly-items">
                <li v-for="l in item.links" :key="l.text"><RouterLink :to="l.to">{{ l.text }}</RouterLink></li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
      </template>
      <p v-if="todo.loaded && !todo.error" class="helper-text todo-note">{{ checkNote }}</p>
    </template>
  </div>
</template>
