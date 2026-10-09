<script setup lang="ts">
// Campo password riutilizzabile con pulsante mostra/nascondi (usato per chiavi API,
// a partire dalla sezione "Connessione con app esterne", §7.2).
import { ref } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";

defineProps<{ modelValue: string | undefined; placeholder?: string }>();
defineEmits<{ (e: "update:modelValue", value: string): void }>();

const visible = ref(false);
</script>

<template>
  <div class="password-field">
    <input
      :type="visible ? 'text' : 'password'"
      class="mono-input"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button type="button" class="icon-btn password-toggle" :aria-label="visible ? 'Nascondi' : 'Mostra'" @click="visible = !visible">
      <EyeOff v-if="visible" :size="16" aria-hidden="true" />
      <Eye v-else :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.password-field {
  display: flex;
  align-items: center;
  gap: 6px;
}
.password-field .mono-input {
  flex: 1;
}
.password-toggle {
  flex: none;
  line-height: 1;
}
</style>
