<script setup lang="ts">
// Indice delle sezioni di una pagina lunga (D-02): a destra della colonna, solo dove c'e' spazio (vedi
// base.css). Sugli schermi stretti l'indice sono le intestazioni stesse, che chiuse occupano una riga.
defineProps<{ sections: { id: string; title: string }[] }>();
defineEmits<{ (e: "go", id: string): void }>();
</script>

<template>
  <nav class="section-nav" aria-label="Sezioni della pagina">
    <ul>
      <li v-for="s in sections" :key="s.id">
        <button type="button" class="link-btn" @click="$emit('go', s.id)">{{ s.title }}</button>
      </li>
    </ul>
  </nav>
</template>
