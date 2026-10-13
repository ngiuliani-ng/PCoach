<script setup lang="ts">
// Guida di un gruppo di dati (D-04): pannello a destra, a tutto schermo su mobile, con una voce per
// campo. Si apre dall'icona Info della sezione e sta nell'URL (?guida=…): «indietro» la chiude senza
// lasciare la pagina, e le modifiche non salvate restano dove sono.
import { computed, ref } from "vue";
import { GUIDES, type GuideKey } from "../../help/guide";
import { FIELD_HELP } from "../../help/fieldHelp";
import { useModalFocus } from "../../composables/useModalFocus";
import { X } from "lucide-vue-next";

const props = defineProps<{ guideKey: GuideKey }>();
const emit = defineEmits<{ (e: "close"): void }>();

const guide = computed(() => GUIDES[props.guideKey]);
const entries = computed(() =>
  guide.value.entries.map((e) => ({ ...e, ...(FIELD_HELP[e.help] as { text: string; more?: string }) }))
);

const root = ref<HTMLElement | null>(null);
useModalFocus(root, () => emit("close"));
</script>

<template>
  <div class="sheet-backdrop" @click="emit('close')"></div>
  <aside ref="root" class="workout-drawer guide-panel" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <header class="drawer-head">
      <h2 id="guide-title" class="guide-title">{{ guide.title }}</h2>
      <button type="button" class="icon-btn" aria-label="Chiudi la guida" @click="emit('close')"><X :size="18" aria-hidden="true" /></button>
    </header>
    <div class="drawer-body guide-body">
      <section v-for="e in entries" :key="e.help" class="guide-entry">
        <h3>{{ e.label }}</h3>
        <p>{{ e.text }}</p>
        <p v-if="e.more" class="guide-more">{{ e.more }}</p>
      </section>
    </div>
  </aside>
</template>
