// Store delle sedute dell'atleta aperto (ADR 0017): sedute, piani, stato di sincronizzazione.
// Ogni modifica e' condizionata alla revisione nota (update ... eq("revision", r)): se la seduta
// e' cambiata altrove, l'update non trova righe e il coach viene avvisato invece di sovrascrivere.
// Revisione e cronologia le gestisce il database (trigger in 0004_workouts.sql).
import { defineStore } from "pinia";
import { supabase } from "../services/supabase";
import type { SyncRow, SyncableWorkout } from "@shared/workouts/sync.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import type { ApplyPayload, WeekMeta } from "../domain/regeneration";

export interface WorkoutRecord extends SyncableWorkout {
  athlete_id: string;
  plan_id: string | null;
  generation_id: string | null;
  slot: number;
  superseded_by: string | null;
  locked: boolean;
  completed_activity_id: string | null;
  completion_source: "intervals" | "manual" | null;
  created_at: string;
  updated_at: string;
}

export interface PlanRecord {
  id: string;
  athlete_id: string;
  name: string;
  status: "active" | "ended" | "archived";
  start_date: string;
  end_date: string | null;
  ended_at: string | null;
  end_reason: string | null;
  weeks_meta: WeekMeta[];
  created_at: string;
}

export interface WorkoutEventRecord {
  id: number;
  workout_id: string;
  at: string;
  type: string;
  revision: number;
  before: Partial<WorkoutContent> | null;
  after: Partial<WorkoutContent> | null;
  note: string | null;
}

/** initial: primo piano; continue: prosegue dopo il piano attivo; regenerate: sostituisce da una data. */
export type GenerationKind = "initial" | "continue" | "regenerate";

export interface GenerationRecord {
  id: string;
  athlete_id: string;
  kind: GenerationKind;
  from_date: string;
  weeks: number;
  reason: string;
  kept_workout_ids: string[];
  proposal: unknown;
  status: "proposed" | "applied" | "discarded" | "failed";
  created_at: string;
}

export type Result<T = undefined> = { ok: true; value: T; message?: string } | { ok: false; message: string };

const WORKOUT_COLUMNS =
  "id, athlete_id, plan_id, generation_id, planned_date, slot, discipline, title, objective, notes_for_athlete, duration_min, structure, primary_target, status, superseded_by, locked, needs_review, completed_at, completed_activity_id, completion_source, revision, created_at, updated_at";

const CONFLICT_MESSAGE = "La seduta è stata modificata altrove: ricarico i dati, riapri la seduta e riapplica le modifiche.";

function normalize(row: Record<string, unknown>): WorkoutRecord {
  return { ...(row as unknown as WorkoutRecord), duration_min: row.duration_min == null ? null : Number(row.duration_min) };
}

export const useWorkoutsStore = defineStore("workouts", {
  state: () => ({
    athleteId: null as string | null,
    workouts: [] as WorkoutRecord[],
    plans: [] as PlanRecord[],
    syncRows: {} as Record<string, SyncRow>,
    loading: false,
    loadError: ""
  }),
  getters: {
    activePlan(state): PlanRecord | null {
      return state.plans.find((p) => p.status === "active") ?? null;
    },
    byId(state): (id: string) => WorkoutRecord | undefined {
      return (id) => state.workouts.find((w) => w.id === id);
    }
  },
  actions: {
    async load(athleteId: string | null) {
      if (this.athleteId !== athleteId) {
        this.workouts = [];
        this.plans = [];
        this.syncRows = {};
      }
      this.athleteId = athleteId;
      if (!athleteId || !supabase) return;
      this.loading = true;
      this.loadError = "";
      const [w, p, s] = await Promise.all([
        supabase.from("workouts").select(WORKOUT_COLUMNS).eq("athlete_id", athleteId).order("planned_date").order("slot"),
        supabase.from("training_plans").select("*").eq("athlete_id", athleteId).order("start_date", { ascending: false }),
        supabase.from("workout_sync").select("*, workouts!inner(athlete_id)").eq("workouts.athlete_id", athleteId)
      ]);
      this.loading = false;
      if (this.athleteId !== athleteId) return; // nel frattempo e' stato aperto un altro atleta
      if (w.error || p.error || s.error) {
        this.loadError = "Non riesco a leggere le sedute: controlla la connessione e riprova.";
        return;
      }
      this.workouts = (w.data ?? []).map((r) => normalize(r as Record<string, unknown>));
      this.plans = (p.data ?? []) as PlanRecord[];
      const rows: Record<string, SyncRow> = {};
      (s.data ?? []).forEach((r) => {
        const { workouts: _join, ...row } = r as SyncRow & { workouts: unknown };
        rows[row.workout_id] = row;
      });
      this.syncRows = rows;
    },

    async reload() {
      await this.load(this.athleteId);
    },

    /** Aggiorna una seduta solo se e' ancora alla revisione nota. */
    async update(id: string, patch: Partial<WorkoutRecord>, note: string | null = null): Promise<Result<WorkoutRecord>> {
      const current = this.byId(id);
      if (!current || !supabase) return { ok: false, message: "Seduta non trovata." };
      const { data, error } = await supabase
        .from("workouts")
        .update({ ...patch, change_note: note })
        .eq("id", id)
        .eq("revision", current.revision)
        .select(WORKOUT_COLUMNS);
      if (error) {
        const duplicate = error.code === "23505";
        return { ok: false, message: duplicate ? "Quel giorno ha già una seduta in quella posizione: riprova." : "Salvataggio non riuscito: controlla la connessione e riprova." };
      }
      if (!data || !data.length) {
        await this.reload();
        return { ok: false, message: CONFLICT_MESSAGE };
      }
      const updated = normalize(data[0] as Record<string, unknown>);
      this.workouts = this.workouts.map((w) => (w.id === id ? updated : w));
      await this.refreshSyncRow(id);
      return { ok: true, value: updated };
    },

    async refreshSyncRow(id: string) {
      if (!supabase) return;
      const { data } = await supabase.from("workout_sync").select("*").eq("workout_id", id).maybeSingle();
      const rows = { ...this.syncRows };
      if (data) rows[id] = data as SyncRow;
      else delete rows[id];
      this.syncRows = rows;
    },

    /** Primo slot libero nel giorno, escludendo la seduta stessa. */
    freeSlot(date: string, excludeId?: string): number {
      const used = new Set(
        this.workouts
          .filter((w) => w.id !== excludeId && w.planned_date === date && (w.status === "draft" || w.status === "approved"))
          .map((w) => w.slot)
      );
      let slot = 0;
      while (used.has(slot)) slot++;
      return slot;
    },

    async approve(ids: string[]): Promise<Result<number>> {
      let done = 0;
      for (const id of ids) {
        const r = await this.update(id, { status: "approved" });
        if (!r.ok) return { ok: false, message: done ? `${done} approvate, poi: ${r.message}` : r.message };
        done++;
      }
      return { ok: true, value: done };
    },

    async cancel(id: string, reason: string) {
      return this.update(id, { status: "cancelled" }, reason.trim() || "Annullata dal coach");
    },

    async restore(id: string) {
      const w = this.byId(id);
      if (!w) return { ok: false as const, message: "Seduta non trovata." };
      return this.update(id, { status: "draft", slot: this.freeSlot(w.planned_date, id) }, "Ripristinata come bozza");
    },

    /** Elimina una bozza mai approvata e mai inviata: e' l'unica cancellazione fisica. */
    async deleteDraft(id: string): Promise<Result> {
      const w = this.byId(id);
      if (!w || !supabase) return { ok: false, message: "Seduta non trovata." };
      if (w.status !== "draft" || this.syncRows[id]) return { ok: false, message: "Si eliminano solo le bozze mai inviate: annulla la seduta invece." };
      const { data, error } = await supabase.from("workouts").delete().eq("id", id).eq("revision", w.revision).eq("status", "draft").select("id");
      if (error || !data?.length) {
        await this.reload();
        return { ok: false, message: error ? "Eliminazione non riuscita." : CONFLICT_MESSAGE };
      }
      this.workouts = this.workouts.filter((x) => x.id !== id);
      return { ok: true, value: undefined };
    },

    async setCompleted(id: string, completed: boolean) {
      return this.update(id, completed
        ? { completed_at: new Date().toISOString(), completion_source: "manual", completed_activity_id: null }
        : { completed_at: null, completion_source: null, completed_activity_id: null });
    },

    async events(id: string): Promise<WorkoutEventRecord[]> {
      if (!supabase) return [];
      const { data } = await supabase.from("workout_events").select("*").eq("workout_id", id).order("at", { ascending: false }).order("id", { ascending: false });
      return (data ?? []) as WorkoutEventRecord[];
    },

    // ---------- Generazioni ----------
    async createGeneration(g: { athleteId: string; kind: GenerationKind; fromDate: string; weeks: number; reason: string; keptIds: string[]; model: string }): Promise<Result<string>> {
      if (!supabase) return { ok: false, message: "Supabase non configurato." };
      const { data, error } = await supabase.from("plan_generations").insert({
        athlete_id: g.athleteId, kind: g.kind, from_date: g.fromDate, weeks: g.weeks, reason: g.reason,
        kept_workout_ids: g.keptIds, model: g.model, status: "proposed"
      }).select("id").single();
      if (error || !data) return { ok: false, message: "Non riesco a registrare la generazione: riprova." };
      return { ok: true, value: (data as { id: string }).id };
    },

    async saveGenerationResult(id: string, patch: { raw_response?: string; proposal?: unknown; status?: GenerationRecord["status"]; error?: string }) {
      if (!supabase) return;
      await supabase.from("plan_generations").update(patch).eq("id", id);
    },

    /** Ultima proposta non ancora applicata ne' scartata, per riprenderla dopo un ricaricamento. */
    async pendingGeneration(athleteId: string): Promise<GenerationRecord | null> {
      if (!supabase) return null;
      const { data } = await supabase.from("plan_generations").select("*").eq("athlete_id", athleteId)
        .eq("status", "proposed").not("proposal", "is", null).order("created_at", { ascending: false }).limit(1);
      return ((data ?? [])[0] as GenerationRecord) ?? null;
    },

    async applyGeneration(payload: ApplyPayload): Promise<Result<string>> {
      if (!supabase) return { ok: false, message: "Supabase non configurato." };
      const { data, error } = await supabase.rpc("apply_plan_generation", { p: payload });
      if (error) {
        const msg = error.message || "";
        await this.reload();
        if (msg.includes("stale_workouts") || msg.includes("unclassified_workouts")) {
          return { ok: false, message: "Nel frattempo le sedute sono cambiate: ho ricaricato i dati, ricalcola la proposta." };
        }
        if (msg.includes("generation_not_proposed")) return { ok: false, message: "Questa proposta è già stata applicata o scartata." };
        return { ok: false, message: "Non sono riuscito ad applicare la proposta: nessuna seduta è stata modificata." };
      }
      await this.reload();
      return { ok: true, value: data as string };
    },

    async discardGeneration(id: string) {
      await this.saveGenerationResult(id, { status: "discarded" });
    }
  }
});
