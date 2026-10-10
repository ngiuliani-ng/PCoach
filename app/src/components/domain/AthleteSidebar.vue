<script setup lang="ts">
// Sidebar definitiva (Fase 2, §5 del documento di migrazione): card "Nuovo atleta" fissa in
// cima, bozza inline selezionata, impostazioni, stato app con pallino a 4 stati.
// Ogni card e' un <button> (selezione da tastiera); l'eliminazione e' un pulsante fratello,
// non annidato, perche' un button non puo' contenerne un altro.
import { computed } from "vue";
import { useAthletesStore } from "../../stores/athletes";
import { useAuthStore } from "../../stores/auth";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { showResultToast } from "../../composables/useToast";
import { CONNECTION_STATUS_LABELS, useConnectionStatus } from "../../composables/useConnectionStatus";
import { disciplineLabel, fullName, formatSigned } from "../../constants";
import IconButton from "../ui/IconButton.vue";
import { Settings, LogOut, X, UserPlus } from "lucide-vue-next";

const athletes = useAthletesStore();
const auth = useAuthStore();
const { status } = useConnectionStatus();

const emit = defineEmits<{ (e: "open-settings"): void }>();

const isDraftOpen = computed(() => athletes.currentId === null && athletes.currentProfile !== null);
const draftName = computed(() => fullName(athletes.currentProfile?.identity) || "Bozza senza nome");
const statusLabel = computed(() => CONNECTION_STATUS_LABELS[status.value]);

// Sotto il nome: discipline praticate e ultimo TSB noto, su righe proprie (cosi' il TSB
// e' sempre allineato a sinistra, qualunque sia la lunghezza del nome).
const items = computed(() =>
  athletes.sortedList.map((a) => {
    const p = athletes.athletes[a.id];
    const disciplines = (p?.disciplines || []).map((d) => disciplineLabel(d.sport)).join(", ");
    const log = [...(p?.training_status?.load_metrics_log || [])]
      .filter((e) => e.tsb != null)
      .sort((x, y) => (x.date || "").localeCompare(y.date || ""));
    const tsb = log.at(-1)?.tsb;
    return { ...a, disciplines, tsb: tsb != null ? formatSigned(tsb) : null };
  })
);

// Se c'e' una bozza di nuovo atleta non salvata, chiede conferma prima di scartarla
// (solo se contiene dati: una bozza intonsa viene scartata in silenzio).
async function guardDraftDiscard(): Promise<boolean> {
  if (!isDraftOpen.value) return true;
  if (!athletes.isDirty) {
    athletes.closeEditor();
    return true;
  }
  const confirmed = await confirmDialog("C'è una bozza di nuovo atleta non salvata. Chiuderla senza salvare?", {
    confirmLabel: "Chiudi senza salvare",
    cancelLabel: "Continua a modificare",
  });
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
  const confirmed = await confirmDialog(`Eliminare la scheda di "${name}"? L'operazione non è reversibile.`, {
    confirmLabel: "Elimina scheda",
  });
  if (!confirmed) return;
  showResultToast(await athletes.deleteAthlete(id));
}
</script>

<template>
  <!-- id e tabindex servono al drawer mobile: aria-controls dell'hamburger e focus
       programmatico all'apertura (vedi useMobileSidebar). -->
  <aside id="athlete-sidebar" class="sidebar" tabindex="-1" aria-label="Atleti">
    <div class="sidebar-header">
      <h1>PCoach</h1>
    </div>
    <div class="sidebar-separator"></div>
    <ul class="athlete-list">
      <li class="athlete-item new-athlete-card" :class="{ active: isDraftOpen }">
        <button type="button" class="athlete-select" :aria-pressed="isDraftOpen" @click="onNew">
          <UserPlus :size="16" aria-hidden="true" />Nuovo atleta
        </button>
      </li>
      <li v-if="isDraftOpen" class="athlete-item active draft-card">
        <span class="athlete-select" aria-current="true">
          <span class="meta">
            <span class="name">{{ draftName }}</span>
            <span class="sub">Bozza non salvata</span>
          </span>
        </span>
      </li>
      <li v-if="items.length === 0 && !isDraftOpen" class="empty-list">
        Nessun atleta. Crea la prima scheda con «Nuovo atleta».
      </li>
      <li
        v-for="a in items"
        :key="a.id"
        class="athlete-item"
        :class="{ active: athletes.currentId === a.id }"
      >
        <button
          type="button"
          class="athlete-select"
          :aria-current="athletes.currentId === a.id ? 'true' : undefined"
          @click="onSelect(a.id)"
        >
          <span class="meta">
            <span class="name">{{ a.name }}</span>
            <span class="sub">{{ a.disciplines || "Nessuna disciplina" }}</span>
            <span v-if="a.tsb" class="sub">TSB {{ a.tsb }}</span>
          </span>
        </button>
        <button type="button" class="del-btn" :aria-label="`Elimina ${a.name}`" @click="onDelete(a.id, a.name)">
          <X :size="14" aria-hidden="true" />
        </button>
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
