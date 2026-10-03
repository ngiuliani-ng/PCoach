<script setup lang="ts">
// Shell principale: sidebar + area di lavoro (placeholder / impostazioni / scheda atleta).
import { onMounted, ref, watch } from "vue";
import { useAthletesStore } from "./stores/athletes";
import { useSettingsStore } from "./stores/settings";
import AthleteSidebar from "./components/domain/AthleteSidebar.vue";
import AthleteEditor from "./components/domain/AthleteEditor.vue";
import SettingsPanel from "./components/domain/SettingsPanel.vue";
import ToastHost from "./components/ui/ToastHost.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";

const athletes = useAthletesStore();
const settings = useSettingsStore();
const showSettings = ref(false);

onMounted(() => {
  athletes.init();
  settings.load();
});

function openSettings() {
  showSettings.value = true;
}
watch(
  () => athletes.currentProfile,
  (profile) => {
    if (profile) showSettings.value = false;
  }
);
</script>

<template>
  <div class="app">
    <AthleteSidebar @open-settings="openSettings" />
    <main class="main">
      <SettingsPanel v-if="showSettings" />
      <AthleteEditor v-else-if="athletes.currentProfile" />
      <div v-else class="placeholder">
        <span class="big-emoji">👤</span>
        <p>Seleziona un atleta dalla barra laterale oppure creane uno nuovo.</p>
      </div>
    </main>
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>
