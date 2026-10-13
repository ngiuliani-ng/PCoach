<script setup lang="ts">
// Sezione comprimibile di una pagina lunga (D-02): l'intestazione e' un pulsante che apre e chiude;
// chiusa, mostra una riga di riepilogo del contenuto. A destra l'icona Info apre la guida del gruppo
// (D-04). Il contenuto resta nel DOM anche chiuso (v-show): i campi non perdono stato ne' validazione.
import { Info, ChevronRight } from "lucide-vue-next";
import IconButton from "./IconButton.vue";

// level: 2 per una sezione della pagina, 3 sotto un titolo di gruppo come «Avanzate» (audit A-10).
withDefaults(defineProps<{ id: string; title: string; open: boolean; summary?: string; guide?: boolean; attention?: boolean; level?: 2 | 3 }>(), { level: 2 });
defineEmits<{ (e: "toggle"): void; (e: "guide"): void }>();
</script>

<template>
  <section :id="id" class="block page-section" :class="{ closed: !open }">
    <div class="section-head">
      <component :is="level === 3 ? 'h3' : 'h2'" class="section-title">
        <button type="button" class="section-toggle" :aria-expanded="open" :aria-controls="`${id}-body`" @click="$emit('toggle')">
          <ChevronRight :size="18" class="section-caret" aria-hidden="true" />
          <span class="section-name">{{ title }}</span>
          <span v-if="!open && summary" class="section-summary" :class="{ 'has-anomaly': attention }">{{ summary }}</span>
        </button>
      </component>
      <IconButton v-if="guide" :label="`Guida: ${title}`" @click="$emit('guide')"><Info :size="18" aria-hidden="true" /></IconButton>
    </div>
    <div v-show="open" :id="`${id}-body`" class="section-body">
      <slot />
    </div>
  </section>
</template>
