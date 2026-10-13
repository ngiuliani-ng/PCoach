<script setup lang="ts">
// Pagina iniziale senza un atleta aperto: indica cosa fare (i comandi sono nell'elenco degli atleti).
import { useAthletesStore } from "../../stores/athletes";

const athletes = useAthletesStore();
</script>

<template>
  <div class="placeholder">
    <p v-if="!athletes.loaded">Caricamento…</p>
    <template v-else-if="athletes.sortedList.length">
      <h1>Scegli un atleta</h1>
      <p>Apri una scheda dall'elenco per vedere carico, piano e feedback.</p>
    </template>
    <template v-else>
      <h1>Nessun atleta</h1>
      <p>Crea la prima scheda con «Nuovo atleta» nell'elenco: nome, discipline e obiettivi bastano per generare un piano.</p>
    </template>
  </div>
</template>
