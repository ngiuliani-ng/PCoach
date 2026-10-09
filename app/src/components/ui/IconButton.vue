<script setup lang="ts">
// Pulsante-icona quadrato riutilizzabile (es. footer della sidebar). L'icona va
// passata nello slot (es. componente Lucide); "label" alimenta aria-label (nessun tooltip title).
defineProps<{ label: string }>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button type="button" class="icon-square-btn" :aria-label="label" @click="$emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.icon-square-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.icon-square-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}
.icon-square-btn:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
