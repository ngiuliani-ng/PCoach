<script setup lang="ts">
// Le due regioni live restano sempre nel DOM (solo il testo cambia), altrimenti gli
// screen reader non annunciano il messaggio: status per le info, alert per gli errori.
import { X } from "lucide-vue-next";
import { useToast } from "../../composables/useToast";
const { message, visible, kind, dismiss } = useToast();
</script>

<template>
  <div class="toast" :class="{ show: visible, error: kind === 'error' }">
    <span role="status" class="toast-text">{{ visible && kind === "info" ? message : "" }}</span>
    <span role="alert" class="toast-text">{{ visible && kind === "error" ? message : "" }}</span>
    <button
      v-if="visible && kind === 'error'"
      type="button"
      class="toast-close"
      aria-label="Chiudi messaggio"
      @click="dismiss"
    ><X :size="16" aria-hidden="true" /></button>
  </div>
</template>
