<script setup lang="ts">
// Shell principale: sidebar + area di lavoro, scelta dalla rotta (vedi router.ts).
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAthletesStore } from "./stores/athletes";
import { useSettingsStore } from "./stores/settings";
import { useReviewsStore } from "./stores/reviews";
import { useAuthStore } from "./stores/auth";
import { useTodoStore } from "./stores/todo";
import { useMobileSidebar } from "./composables/useMobileSidebar";
import AthleteSidebar from "./components/domain/AthleteSidebar.vue";
import LoginView from "./components/domain/LoginView.vue";
import ToastHost from "./components/ui/ToastHost.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import { Menu } from "lucide-vue-next";

const athletes = useAthletesStore();
const settings = useSettingsStore();
const auth = useAuthStore();
const todo = useTodoStore();
const route = useRoute();
const sidebarToggleEl = ref<HTMLElement | null>(null);
const {
  open: mobileSidebarOpen,
  openSidebar: openMobileSidebar,
  closeSidebar: closeMobileSidebar,
} = useMobileSidebar({ sidebarId: "athlete-sidebar", toggleEl: sidebarToggleEl });

// Chiudere o ricaricare la pagina con modifiche non salvate: avviso del browser (decisione D-UX-1).
const reviews = useReviewsStore();
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!athletes.isDirty && !settings.isDirty && !reviews.hasUnsavedText) return;
  event.preventDefault();
  event.returnValue = "";
}
onMounted(() => {
  auth.init();
  window.addEventListener("beforeunload", onBeforeUnload);
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));

watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (ok) {
      athletes.init();
      settings.load();
      void todo.refresh();
    }
  },
  { immediate: true }
);

// Su mobile ogni cambio di pagina chiude l'elenco degli atleti. Il «Da fare» si rilegge: quello che il
// coach ha sistemato sparisce dalla home e dal numero accanto all'atleta (D-01).
watch(() => route.path, () => {
  closeMobileSidebar();
  if (auth.isAuthenticated) void todo.refresh();
});
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
    <AthleteSidebar :class="{ open: mobileSidebarOpen }" @close="closeMobileSidebar" />
    <main class="main">
      <RouterView />
    </main>
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-loading {
  min-height: calc(100vh - var(--titlebar-h));
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
