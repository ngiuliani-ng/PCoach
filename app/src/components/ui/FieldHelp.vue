<script setup lang="ts">
// Aiuto contestuale di un campo: una riga sempre visibile (niente hover, funziona al tocco) e, se c'e',
// un approfondimento in un <details>, apribile da tastiera e annunciato dai lettori di schermo.
// I testi vivono in help/fieldHelp.ts.
import { computed } from "vue";
import { FIELD_HELP, type FieldHelpKey } from "../../help/fieldHelp";

const props = defineProps<{ field: FieldHelpKey }>();
const help = computed(() => FIELD_HELP[props.field] as { text: string; more?: string });
</script>

<template>
  <div class="field-help">
    <p class="helper-text">{{ help.text }}</p>
    <details v-if="help.more" class="field-help-more">
      <summary>Come lo usa PCoach</summary>
      <p class="helper-text">{{ help.more }}</p>
    </details>
  </div>
</template>

<style scoped>
.field-help { margin: var(--sp-1) 0 var(--sp-3); max-width: 70ch; }
.field-help > .helper-text { margin: 0; }
.field-help-more { margin-top: var(--sp-1); }
.field-help-more summary { cursor: pointer; font-size: var(--fs-xs); color: var(--text-muted); text-decoration: underline; text-underline-offset: 2px; }
.field-help-more .helper-text { margin: var(--sp-1) 0 0; }
</style>
