<script setup lang="ts">
// Stati di una seduta come badge con icona e testo (mai solo colore). Il colore segnala solo
// cio' che richiede attenzione: --warning da revisionare o da aggiornare, --danger errori.
// Gli stati "a posto" sono neutri (ADR 0017, design-ui.md).
import { computed } from "vue";
import type { SyncRow } from "@shared/workouts/sync.ts";
import { localSyncState } from "@shared/workouts/sync.ts";
import type { WorkoutRecord } from "../../stores/workouts";
import { execState } from "../../domain/workoutState";
import { todayISO } from "../../constants";
import { Ban, Check, CircleCheck, CircleDashed, Cloud, CloudOff, PencilLine, RefreshCw, Replace, TriangleAlert, Lock } from "lucide-vue-next";

const props = defineProps<{ workout: WorkoutRecord; sync?: SyncRow | null }>();

type Badge = { key: string; text: string; tone: "warn" | "err" | "neutral" | "plain"; icon: unknown };

const badges = computed<Badge[]>(() => {
  const w = props.workout;
  const out: Badge[] = [];
  if (w.status === "draft") out.push({ key: "draft", text: "Da revisionare", tone: "warn", icon: PencilLine });
  if (w.status === "approved") out.push({ key: "approved", text: "Approvata", tone: "neutral", icon: Check });
  if (w.status === "cancelled") out.push({ key: "cancelled", text: "Annullata", tone: "plain", icon: Ban });
  if (w.status === "superseded") out.push({ key: "superseded", text: "Sostituita", tone: "plain", icon: Replace });
  if (w.needs_review && (w.status === "draft" || w.status === "approved")) out.push({ key: "review", text: "Struttura da verificare", tone: "warn", icon: TriangleAlert });
  if (w.locked) out.push({ key: "locked", text: "Bloccata", tone: "plain", icon: Lock });
  const s = localSyncState(w, props.sync);
  if (s === "none" && w.status === "approved") out.push({ key: "s", text: "Non su Intervals.icu", tone: "plain", icon: CloudOff });
  if (s === "synced") out.push({ key: "s", text: "Su Intervals.icu", tone: "neutral", icon: Cloud });
  if (s === "outdated") out.push({ key: "s", text: "Da aggiornare su Intervals.icu", tone: "warn", icon: RefreshCw });
  if (s === "error") out.push({ key: "s", text: "Invio non riuscito", tone: "err", icon: TriangleAlert });
  if (s === "pending_delete") out.push({ key: "s", text: "Da rimuovere da Intervals.icu", tone: "warn", icon: CloudOff });
  if (s === "removed") out.push({ key: "s", text: "Rimossa da Intervals.icu", tone: "plain", icon: CloudOff });
  if (s === "unlinked") out.push({ key: "s", text: "Scollegata da Intervals.icu", tone: "plain", icon: CloudOff });
  const e = execState(w, todayISO());
  if (e === "done") out.push({ key: "e", text: "Svolta", tone: "neutral", icon: CircleCheck });
  if (e === "missed") out.push({ key: "e", text: "Non svolta", tone: "plain", icon: CircleDashed });
  return out;
});
</script>

<template>
  <span class="workout-badges">
    <span v-for="b in badges" :key="b.key + b.text" class="w-badge" :class="b.tone">
      <component :is="b.icon" :size="14" aria-hidden="true" />{{ b.text }}
    </span>
  </span>
</template>
