<script setup lang="ts">
// Stato del salvataggio accanto al pulsante «Salva» (scheda atleta, Impostazioni): solo una nuvola
// colorata (decisione del coach), diversa anche nel disegno, cosi' non dipende dal solo colore:
// spunta in --accent se salvato, punto esclamativo in --danger con modifiche, barrata in grigio per una
// bozza mai salvata. La frase resta per i lettori di schermo.
import { computed } from "vue";
import { CloudAlert, CloudCheck, CloudOff } from "lucide-vue-next";

const props = defineProps<{ state: "saved" | "unsaved" | "draft"; text: string }>();
const icon = computed(() => ({ saved: CloudCheck, unsaved: CloudAlert, draft: CloudOff })[props.state]);
</script>

<template>
  <span class="save-status" :class="state">
    <component :is="icon" :size="20" class="save-icon" aria-hidden="true" />
    <span class="visually-hidden">{{ text }}</span>
  </span>
</template>
