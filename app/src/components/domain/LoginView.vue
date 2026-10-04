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
      <div>
        <label>Email</label>
        <input type="email" v-model="email" class="mono-input" autocomplete="username" required />
      </div>
      <div>
        <label>Password</label>
        <input type="password" v-model="password" class="mono-input" autocomplete="current-password" required />
      </div>
      <p v-if="auth.error" class="login-error" role="alert">{{ auth.error }}</p>
      <button type="submit" class="primary" :disabled="submitting">{{ submitting ? "Accesso in corso…" : "Accedi" }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
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
  gap: 12px;
}
.login-card h1 {
  margin: 0;
}
.login-error {
  color: #c0392b;
  margin: 0;
}
</style>
