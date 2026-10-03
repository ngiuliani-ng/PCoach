<script setup lang="ts">
import { useConfirmDialog } from "../../composables/useConfirmDialog";
const { message, visible, resolve } = useConfirmDialog();
</script>

<template>
  <div class="confirm-overlay" v-if="visible" @click.self="resolve(false)">
    <div class="confirm-box">
      <p>{{ message }}</p>
      <div class="confirm-actions">
        <button class="secondary" @click="resolve(false)">Annulla</button>
        <button class="danger" @click="resolve(true)">Elimina</button>
      </div>
    </div>
  </div>
</template>
