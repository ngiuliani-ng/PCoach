<script setup lang="ts">
// Shell principale: sidebar + area di lavoro (placeholder / impostazioni / scheda atleta).
import { onMounted, ref, watch } from "vue";
import { useAthletesStore } from "./stores/athletes";
import { useSettingsStore } from "./stores/settings";
import { useAuthStore } from "./stores/auth";
import { useMobileSidebar } from "./composables/useMobileSidebar";
import AthleteSidebar from "./components/domain/AthleteSidebar.vue";
import AthleteEditor from "./components/domain/AthleteEditor.vue";
import SettingsPanel from "./components/domain/SettingsPanel.vue";
import LoginView from "./components/domain/LoginView.vue";
import ToastHost from "./components/ui/ToastHost.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import { Menu, User } from "lucide-vue-next";

const athletes = useAthletesStore();
const settings = useSettingsStore();
const auth = useAuthStore();
const showSettings = ref(false);
const sidebarToggleEl = ref<HTMLElement | null>(null);
const {
  open: mobileSidebarOpen,
  openSidebar: openMobileSidebar,
  closeSidebar: closeMobileSidebar,
} = useMobileSidebar({ sidebarId: "athlete-sidebar", toggleEl: sidebarToggleEl });

onMounted(() => {
  auth.init();
});

watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (ok) {
      athletes.init();
      settings.load();
    }
  },
  { immediate: true }
);

function openSettings() {
  showSettings.value = true;
  closeMobileSidebar();
}
watch(
  () => athletes.currentProfile,
  (profile) => {
    if (profile) showSettings.value = false;
    closeMobileSidebar();
  }
);
</script>

<template>
  <div v-if="auth.loading" class="app-loading">
    <p>Caricamento…</p>
  </div>
  <LoginView v-else-if="!auth.isAuthenticated" />
  <div v-else class="app">
    <button
      v-show="!mobileSidebarOpen"
      ref="sidebarToggleEl"
      type="button"
      class="sidebar-toggle"
      :aria-expanded="mobileSidebarOpen"
      aria-controls="athlete-sidebar"
      aria-label="Apri la barra laterale"
      @click="openMobileSidebar"
    ><Menu :size="20" aria-hidden="true" /></button>
    <Transition name="backdrop-fade">
      <div v-if="mobileSidebarOpen" class="sidebar-backdrop" aria-hidden="true" @click="closeMobileSidebar"></div>
    </Transition>
    <AthleteSidebar :class="{ open: mobileSidebarOpen }" @open-settings="openSettings" />
    <main class="main">
      <SettingsPanel v-if="showSettings" />
      <AthleteEditor v-else-if="athletes.currentProfile" />
      <div v-else class="placeholder">
        <User :size="44" stroke-width="1.5" class="placeholder-icon" aria-hidden="true" style="margin-bottom: 12px; opacity: 0.6;" />
        <p>Seleziona un atleta dalla barra laterale oppure creane uno nuovo.</p>
      </div>
    </main>
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
