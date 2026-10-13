<script setup lang="ts">
// Profilo › Identità: anagrafica dell'atleta. Con l'invio email attivo l'indirizzo serve (D-05), ma la
// scheda si salva anche senza: qui c'e' solo l'avviso.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";

defineProps<{ emailMissing: boolean }>();
const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);
</script>

<template>
  <div class="field-row">
    <label class="field"><span class="field-label">Nome</span><input type="text" v-model="profile.identity.nome" /></label>
    <label class="field"><span class="field-label">Cognome</span><input type="text" v-model="profile.identity.cognome" /></label>
    <label class="field"><span class="field-label">Email</span><input type="email" v-model="profile.identity.email" /></label>
  </div>
  <p v-if="emailMissing" class="helper-text error-text">L'invio via email è attivo: senza indirizzo il feedback approvato non arriva all'atleta.</p>
  <div class="field-row">
    <label class="field"><span class="field-label">Anno di nascita</span><input type="number" v-model.number="profile.identity.birth_year" /></label>
    <label class="field">
      <span class="field-label">Sesso biologico</span>
      <select v-model="profile.identity.biological_sex">
        <option value="unspecified">Non specificato</option>
        <option value="male">Maschile</option>
        <option value="female">Femminile</option>
      </select>
    </label>
  </div>
  <div class="field-row">
    <label class="field"><span class="field-label">Altezza (cm)</span><input type="number" v-model.number="profile.identity.height_cm" /></label>
    <label class="field"><span class="field-label">Peso (kg)</span><input type="number" v-model.number="profile.identity.weight_kg" /></label>
  </div>
</template>
