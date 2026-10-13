<script setup lang="ts">
// Spiegazione di un singolo campo dentro un pannello modale (dove una guida sopra il pannello sarebbe
// un livello di troppo): l'icona Info apre e chiude il testo sotto, che di default non si vede (D-04).
import { computed, ref } from "vue";
import { FIELD_HELP, type FieldHelpKey } from "../../help/fieldHelp";
import { Info } from "lucide-vue-next";

const props = defineProps<{ field: FieldHelpKey; label: string }>();
const open = ref(false);
const help = computed(() => FIELD_HELP[props.field] as { text: string; more?: string });
const id = `info-${props.field.replace(/[^a-z0-9]/gi, "-")}`;
</script>

<template>
  <button type="button" class="icon-btn info-toggle" :aria-label="`Informazioni: ${label}`" :aria-expanded="open" :aria-controls="id" @click="open = !open">
    <Info :size="16" aria-hidden="true" />
  </button>
  <div v-show="open" :id="id" class="info-text">
    <p>{{ help.text }}</p>
    <p v-if="help.more">{{ help.more }}</p>
  </div>
</template>
