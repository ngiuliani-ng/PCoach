<script setup lang="ts">
// Le due regioni live restano sempre nel DOM (solo il testo cambia), altrimenti gli
// screen reader non annunciano il messaggio: status per le info, alert per gli errori.
// Puntatore o focus sul toast lo fermano; il pulsante lo chiude, anche da tastiera (audit A-08).
import { X } from "lucide-vue-next";
import { useToast } from "../../composables/useToast";
const { message, visible, kind, dismiss, pause, resume } = useToast();

function onFocusOut(event: FocusEvent) {
  const host = event.currentTarget as HTMLElement;
  if (!host.contains(event.relatedTarget as Node | null)) resume();
}
</script>

<template>
  <div class="toast" :class="{ show: visible, error: kind === 'error' }" @mouseenter="pause" @mouseleave="resume" @focusin="pause" @focusout="onFocusOut">
    <span role="status" class="toast-text">{{ visible && kind === "info" ? message : "" }}</span>
    <span role="alert" class="toast-text">{{ visible && kind === "error" ? message : "" }}</span>
    <button
      v-if="visible"
      type="button"
      class="toast-close"
      aria-label="Chiudi messaggio"
      @click="dismiss"
    ><X :size="16" aria-hidden="true" /></button>
  </div>
</template>
