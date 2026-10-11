<script setup lang="ts">
// Pagina iniziale senza un atleta aperto: indica cosa fare (i comandi sono nell'elenco degli atleti).
import { useAthletesStore } from "../../stores/athletes";

const athletes = useAthletesStore();
</script>

<template>
  <div class="placeholder">
    <p v-if="!athletes.loaded">Caricamento…</p>
    <template v-else-if="athletes.sortedList.length">
      <h2>Scegli un atleta</h2>
      <p>Apri una scheda dall'elenco per vedere carico, piano e feedback.</p>
    </template>
    <template v-else>
      <h2>Nessun atleta</h2>
      <p>Crea la prima scheda con «Nuovo atleta» nell'elenco: nome, discipline e obiettivi bastano per generare un piano.</p>
    </template>
  </div>
</template>
