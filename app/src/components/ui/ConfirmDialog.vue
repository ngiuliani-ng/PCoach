<script setup lang="ts">
// Dialog modale di conferma: all'apertura il focus va su "Annulla" (la scelta non
// distruttiva), Tab resta dentro il dialog, Esc annulla e alla chiusura il focus
// torna all'elemento che lo aveva aperto.
import { nextTick, ref, watch } from "vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";

const { message, visible, confirmLabel, cancelLabel, resolve } = useConfirmDialog();
const boxEl = ref<HTMLElement | null>(null);
const cancelEl = ref<HTMLButtonElement | null>(null);
let returnFocusEl: HTMLElement | null = null;

watch(visible, async (isVisible) => {
  if (isVisible) {
    returnFocusEl = document.activeElement as HTMLElement | null;
    await nextTick();
    cancelEl.value?.focus();
  } else {
    returnFocusEl?.focus();
    returnFocusEl = null;
  }
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    resolve(false);
    return;
  }
  if (event.key !== "Tab" || !boxEl.value) return;
  const focusable = boxEl.value.querySelectorAll<HTMLElement>("button");
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <div class="confirm-overlay" v-if="visible" @click.self="resolve(false)">
    <div
      ref="boxEl"
      class="confirm-box"
      role="alertdialog"
      aria-modal="true"
      aria-describedby="confirm-message"
      @keydown="onKeydown"
    >
      <p id="confirm-message">{{ message }}</p>
      <div class="confirm-actions">
        <button ref="cancelEl" type="button" class="secondary" @click="resolve(false)">{{ cancelLabel }}</button>
        <button type="button" class="danger" @click="resolve(true)">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
