<script setup lang="ts">
// Stato del salvataggio accanto al pulsante «Salva» (scheda atleta, Impostazioni), sempre con una nuvola
// (richiesta del coach): salvato, modifiche non salvate, bozza mai salvata. Su telefono restano la nuvola
// e il testo corto, se c'e'; il testo intero resta per i lettori di schermo (stili in base.css).
import { computed } from "vue";
import { CloudAlert, CloudCheck, CloudOff } from "lucide-vue-next";

const props = defineProps<{ state: "saved" | "unsaved" | "draft"; text: string; short?: string }>();
const icon = computed(() => ({ saved: CloudCheck, unsaved: CloudAlert, draft: CloudOff })[props.state]);
</script>

<template>
  <span class="save-status" :class="state">
    <component :is="icon" :size="16" class="save-icon" aria-hidden="true" />
    <span class="save-long">{{ text }}</span>
    <span v-if="short" class="save-short" aria-hidden="true">{{ short }}</span>
  </span>
</template>
