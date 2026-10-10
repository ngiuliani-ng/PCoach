// Classificazione delle operazioni di "Sincronizza settimana" e stato di sincronizzazione di
// una seduta. Modulo puro condiviso: l'app lo usa per l'anteprima e i badge, l'Edge Function
// intervals-sync per ricontrollare ogni operazione prima di eseguirla.
import type { WorkoutContent } from "./structure.ts";
import { validateWorkout } from "./structure.ts";

export type WorkoutStatus = "draft" | "approved" | "cancelled" | "superseded";

export interface SyncRow {
  workout_id: string;
  remote_event_id: number | null;
  synced_revision: number;
  synced_date: string | null;
  remote_updated: string | null;
  state: "synced" | "error" | "removed" | "unlinked";
  pending_delete: boolean;
  create_uncertain: boolean;
  last_error: string | null;
  last_warning: string | null;
}

export interface SyncableWorkout extends WorkoutContent {
  id: string;
  status: WorkoutStatus;
  revision: number;
  completed_at: string | null;
  needs_review: string | null;
}

export interface RemoteEventState {
  id: number;
  updated: string | null;
}

export interface RemoteSnapshot {
  events: RemoteEventState[];
  /** Id di eventi memorizzati in PCoach che Intervals.icu non ha piu' (404). */
  missingIds: number[];
}

export type SyncOpKind =
  | "create" // approvata, non ancora su Intervals.icu
  | "update" // approvata, modificata o spostata dopo l'ultimo invio, oppure invio precedente fallito
  | "conflict" // modificata su Intervals.icu dopo l'ultimo invio
  | "remote_missing" // l'evento non esiste piu' su Intervals.icu
  | "delete" // annullata o sostituita, ancora su Intervals.icu
  | "same" // nulla da fare
  | "skip_draft" // da revisionare: non si invia
  | "blocked"; // struttura non valida o da verificare

export interface SyncOp {
  workoutId: string;
  kind: SyncOpKind;
  /** Dettaglio leggibile (motivo del blocco, revisioni, errore precedente). */
  detail: string;
  /** Per le operazioni con scelta: selezionata di default nell'anteprima. */
  selected: boolean;
}

export type LocalSyncState =
  | "none" // mai inviata
  | "synced"
  | "outdated" // revisione o data cambiate dopo l'invio
  | "error"
  | "pending_delete"
  | "removed"
  | "unlinked";

/** Stato di sincronizzazione noto senza interrogare Intervals.icu (per badge e filtri). */
export function localSyncState(
  w: Pick<SyncableWorkout, "status" | "revision" | "planned_date">,
  row: SyncRow | null | undefined
): LocalSyncState | null {
  const active = w.status === "draft" || w.status === "approved";
  if (!row) return active ? "none" : null;
  if (row.pending_delete) return "pending_delete";
  if (row.state === "removed") return "removed";
  if (row.state === "unlinked") return active ? "unlinked" : null;
  if (row.state === "error") return "error";
  if (!active) return null;
  if (row.remote_event_id == null) return "none";
  if (w.revision > row.synced_revision || (row.synced_date && row.synced_date !== w.planned_date)) return "outdated";
  return "synced";
}

export function classifySyncOp(
  w: SyncableWorkout,
  row: SyncRow | null | undefined,
  remote: RemoteSnapshot | null
): SyncOp | null {
  const op = (kind: SyncOpKind, detail = "", selected = true): SyncOp => ({ workoutId: w.id, kind, detail, selected });
  const remoteId = row?.remote_event_id ?? null;
  const missing = remoteId != null && !!remote?.missingIds.includes(remoteId);
  const remoteEvent = remoteId != null ? remote?.events.find((e) => e.id === remoteId) : undefined;

  if (w.status === "cancelled" || w.status === "superseded") {
    if (row?.pending_delete && remoteId != null) return op("delete", w.status === "superseded" ? "superseded" : "cancelled");
    return null;
  }
  if (w.status === "draft") return op("skip_draft", w.needs_review || "draft", false);

  // Approvata.
  const errors = validateWorkout(w);
  if (w.needs_review) return op("blocked", w.needs_review, false);
  if (Object.keys(errors).length) return op("blocked", Object.values(errors)[0], false);
  // Una seduta gia' svolta non si tocca su Intervals.icu: l'evento e' abbinato all'attivita'.
  if (w.completed_at) return op("same", "completed", false);
  if (row?.state === "unlinked") return op("same", "unlinked", false);
  if (remoteId == null) return op("create", row?.create_uncertain ? "uncertain" : row?.state === "error" ? "retry" : "");
  if (missing) return op("remote_missing", "", true);
  if (remoteEvent && row?.remote_updated && remoteEvent.updated && remoteEvent.updated !== row.remote_updated) {
    return op("conflict", "", true);
  }
  if (row?.state === "error") return op("update", "retry");
  if (w.revision > (row?.synced_revision ?? 0)) return op("update", `${row?.synced_revision ?? 0}:${w.revision}`);
  if (row?.synced_date && row.synced_date !== w.planned_date) return op("update", "moved");
  return op("same", "", false);
}

export function classifyWeek(
  workouts: SyncableWorkout[],
  rows: Record<string, SyncRow | undefined>,
  remote: RemoteSnapshot | null
): SyncOp[] {
  return workouts
    .map((w) => classifySyncOp(w, rows[w.id], remote))
    .filter((o): o is SyncOp => o !== null);
}

/** Operazioni che "Sincronizza" eseguira' davvero, date le scelte del coach. */
export function isRunnable(op: SyncOp): boolean {
  if (op.kind === "create" || op.kind === "update") return true;
  if (op.kind === "conflict" || op.kind === "remote_missing" || op.kind === "delete") return op.selected;
  return false;
}
