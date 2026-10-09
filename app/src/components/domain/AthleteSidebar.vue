<script setup lang="ts">
// Sidebar definitiva (Fase 2, §5 del documento di migrazione): card "Nuovo atleta" fissa in
// cima, bozza inline selezionata, impostazioni, stato app con pallino a 4 stati.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { useAuthStore } from "../../stores/auth";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { showToast } from "../../composables/useToast";
import { CONNECTION_STATUS_LABELS, useConnectionStatus } from "../../composables/useConnectionStatus";
import { fullName } from "../../constants";
import IconButton from "../ui/IconButton.vue";
import { Settings, LogOut, X, UserPlus } from "lucide-vue-next";

const athletes = useAthletesStore();
const auth = useAuthStore();
const { status } = useConnectionStatus();

const emit = defineEmits<{ (e: "open-settings"): void }>();

const isDraftOpen = computed(() => athletes.currentId === null && athletes.currentProfile !== null);
const draftName = computed(() => fullName(athletes.currentProfile?.identity) || "(bozza senza nome)");
const statusLabel = computed(() => CONNECTION_STATUS_LABELS[status.value]);

// Se c'e' una bozza di nuovo atleta non salvata, chiede conferma prima di scartarla
// (solo se contiene dati: una bozza intonsa viene scartata in silenzio).
async function guardDraftDiscard(): Promise<boolean> {
  if (!isDraftOpen.value) return true;
  if (!athletes.isDirty) {
    athletes.closeEditor();
    return true;
  }
  const confirmed = await confirmDialog("C'è una bozza di nuovo atleta non salvata. Chiuderla senza salvare?");
  if (confirmed) athletes.closeEditor();
  return confirmed;
}

async function onNew() {
  if (isDraftOpen.value) return;
  if (!(await guardDraftDiscard())) return;
  athletes.newAthlete();
}

async function onSelect(id: string) {
  if (athletes.currentId === id) return;
  if (!(await guardDraftDiscard())) return;
  athletes.openAthlete(id);
}

async function onOpenSettings() {
  if (!(await guardDraftDiscard())) return;
  emit("open-settings");
}

async function onDelete(id: string, name: string) {
  const confirmed = await confirmDialog(`Eliminare la scheda di "${name}"? L'operazione non è reversibile.`);
  if (!confirmed) return;
  const result = await athletes.deleteAthlete(id);
  showToast(result.message);
}
</script>

<template>
  <!-- id e tabindex servono al drawer mobile: aria-controls dell'hamburger e focus
       programmatico all'apertura (vedi useMobileSidebar). -->
  <aside id="athlete-sidebar" class="sidebar" tabindex="-1">
    <div class="sidebar-header">
      <h1>PCoach</h1>
    </div>
    <div class="sidebar-separator"></div>
    <ul class="athlete-list">
      <li class="athlete-item new-athlete-card" :class="{ active: isDraftOpen }" @click="onNew">
        <span class="new-athlete-label"><UserPlus :size="15" aria-hidden="true" style="margin-right: 6px; vertical-align: -2px;" />Nuovo atleta</span>
      </li>
      <li v-if="isDraftOpen" class="athlete-item active draft-card">
        <div class="meta">
          <span class="name">{{ draftName }}</span>
          <span class="sub">Bozza non salvata</span>
        </div>
      </li>
      <li v-if="athletes.sortedList.length === 0 && !isDraftOpen" class="empty-list">
        Nessun atleta ancora. Crea la prima scheda.
      </li>
      <li
        v-for="a in athletes.sortedList"
        :key="a.id"
        class="athlete-item"
        :class="{ active: athletes.currentId === a.id }"
        @click="onSelect(a.id)"
      >
        <div class="meta">
          <span class="name">{{ a.name }}</span>
          <span class="sub">{{ a.id }}</span>
        </div>
        <button type="button" class="del-btn" aria-label="Elimina" @click.stop="onDelete(a.id, a.name)"><X :size="14" aria-hidden="true" /></button>
      </li>
    </ul>
    <div class="sidebar-separator"></div>
    <footer class="sidebar-footer">
      <div class="conn-status" aria-live="polite">
        <span class="status-dot" :class="[status, { pulsing: status === 'online' }]" aria-hidden="true"></span>
        <span>{{ statusLabel }}</span>
      </div>
      <div class="sidebar-footer-icons">
        <IconButton label="Impostazioni" @click="onOpenSettings">
          <Settings :size="18" aria-hidden="true" />
        </IconButton>
        <IconButton label="Esci" @click="auth.signOut()">
          <LogOut :size="18" aria-hidden="true" />
        </IconButton>
      </div>
    </footer>
  </aside>
</template>
