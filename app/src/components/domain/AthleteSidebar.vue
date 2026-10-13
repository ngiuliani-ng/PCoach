<script setup lang="ts">
// Elenco degli atleti: "Nuovo atleta" in cima, la bozza non salvata, gli atleti, lo stato della
// connessione, Impostazioni ed Esci. Ogni voce e' un <button> che naviga (router.ts): le conferme
// per le modifiche non salvate le chiedono le guardie di navigazione, non questo componente.
// L'eliminazione di una scheda sta solo nel Profilo (Gestione scheda): nell'elenco resta la navigazione.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAthletesStore } from "../../stores/athletes";
import { useAuthStore } from "../../stores/auth";
import { useTodoStore } from "../../stores/todo";
import { CONNECTION_STATUS_LABELS, useConnectionStatus } from "../../composables/useConnectionStatus";
import { disciplineLabel, fullName, formatSigned } from "../../constants";
import { confirmLeaveProfile, confirmLeaveSettings } from "../../router";
import IconButton from "../ui/IconButton.vue";
import { APP_VERSION } from "../../version";
import { Settings, LogOut, UserPlus, ListTodo } from "lucide-vue-next";

const athletes = useAthletesStore();
const auth = useAuthStore();
const todo = useTodoStore();
const route = useRoute();
const router = useRouter();
const { status } = useConnectionStatus();

const emit = defineEmits<{ (e: "close"): void }>();

const isDraftOpen = computed(() => route.name === "new-athlete");
const isHome = computed(() => route.name === "home");
// Un solo contatore globale (scelta del coach): grigio se ci sono solo approvazioni, giallo se da
// qualche parte c'e' anche una sola anomalia da sistemare.
const todoTotal = computed(() => todo.list.reduce((n, a) => n + a.count, 0));
const todoHasAnomaly = computed(() => todo.list.some((a) => a.items.some((i) => i.tone !== "info")));
const todoLabel = computed(() =>
  todoTotal.value ? `Da fare, ${todoTotal.value} in tutto, ${todoHasAnomaly.value ? "con anomalie da sistemare" : "solo da approvare"}` : "Da fare"
);
const openId = computed(() => (route.name === "athlete" ? String(route.params.id) : null));
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

// Una voce gia' aperta chiude solo l'elenco su mobile; le altre navigano.
function go(location: Parameters<typeof router.push>[0], alreadyThere: boolean) {
  if (alreadyThere) emit("close");
  else void router.push(location);
}

async function onSignOut() {
  if (!(await confirmLeaveProfile()) || !(await confirmLeaveSettings())) return;
  await auth.signOut();
}
</script>

<template>
  <!-- id e tabindex servono al drawer mobile: aria-controls dell'hamburger e focus
       programmatico all'apertura (vedi useMobileSidebar). -->
  <aside id="athlete-sidebar" class="sidebar" tabindex="-1" aria-label="Atleti">
    <div class="sidebar-header">
      <RouterLink class="brand" :to="{ name: 'home' }">PCoach</RouterLink>
    </div>
    <div class="sidebar-separator"></div>
    <ul class="athlete-list">
      <!-- La pagina iniziale «Da fare» (D-01), con il totale di tutti gli atleti. -->
      <li class="athlete-item todo-item" :class="{ active: isHome }">
        <button type="button" class="athlete-select" :aria-current="isHome ? 'page' : undefined" :aria-label="todoLabel" @click="go({ name: 'home' }, isHome)">
          <ListTodo :size="16" aria-hidden="true" />Da fare<span v-if="todoTotal" class="todo-count" :class="{ attention: todoHasAnomaly }" aria-hidden="true">{{ todoTotal }}</span>
        </button>
      </li>
      <li class="athlete-item new-athlete-card" :class="{ active: isDraftOpen }">
        <button type="button" class="athlete-select" :aria-pressed="isDraftOpen" @click="go({ name: 'new-athlete' }, isDraftOpen)">
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
        :class="{ active: openId === a.id }"
      >
        <button
          type="button"
          class="athlete-select"
          :aria-current="openId === a.id ? 'page' : undefined"
          @click="go({ name: 'athlete', params: { id: a.id } }, openId === a.id)"
        >
          <span class="meta">
            <span class="name">{{ a.name }}</span>
            <span class="sub">{{ a.disciplines || "Nessuna disciplina" }}</span>
            <span v-if="a.tsb" class="sub">TSB {{ a.tsb }}</span>
          </span>
        </button>
      </li>
    </ul>
    <div class="sidebar-separator"></div>
    <footer class="sidebar-footer">
      <div class="conn-status" aria-live="polite">
        <span class="status-dot" :class="[status, { pulsing: status === 'online' }]" aria-hidden="true"></span>
        <span>{{ statusLabel }}</span>
      </div>
      <!-- Versione dell'app (ADR 0036): discreta, porta a Impostazioni › Informazioni. -->
      <RouterLink class="app-version" :to="{ name: 'settings', query: { sezione: 'imp-info' } }" :aria-label="`Versione ${APP_VERSION}, informazioni sull'app`">
        Versione {{ APP_VERSION }}
      </RouterLink>
      <div class="sidebar-footer-icons">
        <IconButton label="Impostazioni" @click="go({ name: 'settings' }, route.name === 'settings')">
          <Settings :size="18" aria-hidden="true" />
        </IconButton>
        <IconButton label="Esci" @click="onSignOut">
          <LogOut :size="18" aria-hidden="true" />
        </IconButton>
      </div>
    </footer>
  </aside>
</template>
