<script setup lang="ts">
// Profilo › Identità: anagrafica dell'atleta. Con l'invio email attivo l'indirizzo serve (D-05), ma la
// scheda si salva anche senza: qui c'e' solo l'avviso.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";

defineProps<{ emailMissing: boolean }>();
const athletes = useAthletesStore();
const profile = computed(() => athletes.currentProfile!);
// Dopo un salvataggio rifiutato, l'errore resta sul campo finche' il nome manca (audit A-06).
const nameError = computed(() => athletes.nameRequiredAttempts > 0 && !profile.value.identity.nome?.trim());
</script>

<template>
  <div class="field-row">
    <!-- Etichetta con for: l'errore resta fuori dal nome accessibile del campo. -->
    <div class="field">
      <label class="field-label" for="athlete-nome">Nome</label>
      <input id="athlete-nome" type="text" v-model="profile.identity.nome" :aria-invalid="nameError" :aria-describedby="nameError ? 'athlete-nome-error' : undefined" />
      <span v-if="nameError" id="athlete-nome-error" class="error-text helper-text">Il nome è obbligatorio per salvare la scheda.</span>
    </div>
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
