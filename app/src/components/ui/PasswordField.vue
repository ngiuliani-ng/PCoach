<script setup lang="ts">
// Campo password riutilizzabile con pulsante mostra/nascondi (usato per chiavi API).
// Va etichettato con <label :for="inputId">, non avvolto in una <label>: il pulsante
// interno finirebbe nel nome accessibile del campo.
import { ref } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";

defineProps<{ modelValue: string | undefined; inputId: string; placeholder?: string }>();
defineEmits<{ (e: "update:modelValue", value: string): void }>();

const visible = ref(false);
</script>

<template>
  <div class="password-field">
    <input
      :id="inputId"
      :type="visible ? 'text' : 'password'"
      class="mono-input"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button type="button" class="icon-btn password-toggle" :aria-label="visible ? 'Nascondi la chiave' : 'Mostra la chiave'" :aria-pressed="visible" @click="visible = !visible">
      <EyeOff v-if="visible" :size="16" aria-hidden="true" />
      <Eye v-else :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.password-field {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.password-field .mono-input {
  flex: 1;
}
.password-toggle {
  flex: none;
  line-height: 1;
}
</style>
