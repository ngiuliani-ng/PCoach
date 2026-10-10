<script setup lang="ts">
// Gate di accesso minimale (Fase 9): un solo utente coach, nessuna sign-up qui.
import { ref } from "vue";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const email = ref("");
const password = ref("");
const submitting = ref(false);

async function onSubmit() {
  if (submitting.value) return;
  submitting.value = true;
  await auth.signIn(email.value.trim(), password.value);
  submitting.value = false;
}
</script>

<template>
  <div class="login-wrap">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1>PCoach</h1>
      <p class="helper-text">Accedi con le credenziali del coach.</p>
      <label class="field">
        <span class="field-label">Email</span>
        <input type="email" v-model="email" autocomplete="username" required />
      </label>
      <label class="field">
        <span class="field-label">Password</span>
        <input type="password" v-model="password" autocomplete="current-password" required />
      </label>
      <p v-if="auth.error" class="login-error" role="alert">{{ auth.error }}</p>
      <button type="submit" class="primary" :disabled="submitting">{{ submitting ? "Accesso in corso…" : "Accedi" }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: calc(100vh - var(--titlebar-h));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.login-card {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.login-card h1 {
  margin: 0;
  font-size: var(--fs-2xl);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.login-card .helper-text { margin: calc(-1 * var(--sp-2)) 0 0; }
.login-error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  margin: 0;
}
</style>
