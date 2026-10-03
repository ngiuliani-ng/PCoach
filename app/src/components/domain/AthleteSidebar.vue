<script setup lang="ts">
// Sidebar semplice (Fase 1): elenco atleti, pulsanti nuovo/impostazioni, stato connessione testuale.
// La macchina a stati completa (pallino animato, 4 stati) arriva in Fase 2.
import { useAthletesStore } from "../../stores/athletes";
import { confirmDialog } from "../../composables/useConfirmDialog";
import { showToast } from "../../composables/useToast";

const athletes = useAthletesStore();

const emit = defineEmits<{ (e: "open-settings"): void }>();

function onNew() {
  athletes.newAthlete();
}

async function onDelete(id: string, name: string) {
  const confirmed = await confirmDialog(`Eliminare la scheda di "${name}"? L'operazione non è reversibile.`);
  if (!confirmed) return;
  const result = await athletes.deleteAthlete(id);
  showToast(result.message);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>PCoach</h1>
      <p>Gestione schede atleta</p>
    </div>
    <ul class="athlete-list">
      <li v-if="athletes.sortedList.length === 0" class="empty-list">Nessun atleta ancora. Crea la prima scheda.</li>
      <li
        v-for="a in athletes.sortedList"
        :key="a.id"
        class="athlete-item"
        :class="{ active: athletes.currentId === a.id }"
        @click="athletes.openAthlete(a.id)"
      >
        <div class="meta">
          <span class="name">{{ a.name }}</span>
          <span class="sub">{{ a.id }}</span>
        </div>
        <button type="button" class="del-btn" title="Elimina" @click.stop="onDelete(a.id, a.name)">✕</button>
      </li>
    </ul>
    <div style="padding: 10px 12px 0; display: flex; flex-direction: column; gap: 8px">
      <button type="button" class="secondary" @click="onNew">+ Nuovo atleta</button>
      <button type="button" class="ghost" @click="emit('open-settings')">Impostazioni</button>
    </div>
    <div class="conn-status">{{ athletes.dbAvailable ? "Connesso a Supabase." : "Supabase non configurato." }}</div>
  </aside>
</template>
