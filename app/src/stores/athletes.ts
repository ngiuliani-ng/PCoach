// Store Pinia per la gestione degli atleti: elenco, CRUD, stato "modifiche non salvate".
// Fase 1: mantiene il polling a 15s come nel legacy (bug noto, corretto in Fase 3).
import { defineStore } from "pinia";
import { supabase, configured } from "../services/supabase";
import { blankProfile, todayISO } from "../constants";
import type { AthleteTrainingProfile } from "../schema/types.generated";

function generateAthleteId(existingIds: string[]): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id: string;
  do {
    id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existingIds.includes(id));
  return id;
}

function snapshotForCompare(profile: AthleteTrainingProfile): string {
  const clone = JSON.parse(JSON.stringify(profile));
  delete clone.meta.updated_at;
  delete clone.meta.created_at;
  delete clone.meta.athlete_id;
  return JSON.stringify(clone);
}

export const useAthletesStore = defineStore("athletes", {
  state: () => ({
    athletes: {} as Record<string, AthleteTrainingProfile>,
    currentId: null as string | null,
    currentProfile: null as AthleteTrainingProfile | null,
    baselineSnapshot: null as string | null,
    dbAvailable: false,
    pollHandle: null as ReturnType<typeof setInterval> | null
  }),
  getters: {
    sortedList(state): { id: string; name: string }[] {
      return Object.entries(state.athletes)
        .map(([id, p]) => ({ id, name: p.identity?.name || "(senza nome)" }))
        .sort((a, b) => a.name.localeCompare(b.name, "it"));
    },
    isDirty(state): boolean {
      if (!state.currentProfile || state.baselineSnapshot === null) return false;
      return snapshotForCompare(state.currentProfile) !== state.baselineSnapshot;
    }
  },
  actions: {
    async loadAthletesFromSupabase() {
      if (!supabase) return;
      const { data, error } = await supabase.from("athletes").select("id, data");
      if (error) return;
      const map: Record<string, AthleteTrainingProfile> = {};
      (data || []).forEach((row: { id: string; data: AthleteTrainingProfile }) => {
        map[row.id] = row.data;
      });
      this.athletes = map;
      if (this.currentId && !map[this.currentId]) {
        this.currentId = null;
        this.currentProfile = null;
        this.baselineSnapshot = null;
      }
    },
    startPolling() {
      if (this.pollHandle) return;
      this.pollHandle = setInterval(() => {
        this.loadAthletesFromSupabase().catch(() => {});
      }, 15000);
    },
    async init() {
      this.dbAvailable = false;
      if (!configured || !supabase) return;
      try {
        await this.loadAthletesFromSupabase();
        this.dbAvailable = true;
        this.startPolling();
      } catch {
        this.dbAvailable = false;
      }
    },
    openAthlete(id: string) {
      const profile = this.athletes[id];
      if (!profile) return;
      this.currentId = id;
      this.currentProfile = JSON.parse(JSON.stringify(profile));
      this.baselineSnapshot = snapshotForCompare(this.currentProfile!);
    },
    newAthlete() {
      this.currentId = null;
      this.currentProfile = blankProfile();
      this.baselineSnapshot = snapshotForCompare(this.currentProfile);
    },
    closeEditor() {
      this.currentId = null;
      this.currentProfile = null;
      this.baselineSnapshot = null;
    },
    refreshBaseline() {
      if (this.currentProfile) this.baselineSnapshot = snapshotForCompare(this.currentProfile);
    },
    async saveCurrent(): Promise<{ ok: boolean; message: string }> {
      const profile = this.currentProfile;
      if (!profile) return { ok: false, message: "Nessuna scheda aperta." };
      if (!profile.identity?.name?.trim()) {
        return { ok: false, message: "Il nome dell'atleta è obbligatorio." };
      }
      const isNew = !this.currentId;
      if (isNew) {
        profile.meta.athlete_id = generateAthleteId(Object.keys(this.athletes));
        profile.meta.created_at = todayISO();
      }
      profile.meta.updated_at = todayISO();
      const id = profile.meta.athlete_id;

      this.athletes[id] = profile;
      this.currentId = id;

      if (this.dbAvailable && supabase) {
        const { error } = await supabase.from("athletes").upsert({ id, data: profile, updated_at: new Date().toISOString() });
        if (error) {
          this.refreshBaseline();
          return { ok: false, message: "Salvato in locale, ma la sincronizzazione con Supabase è fallita." };
        }
        this.refreshBaseline();
        return { ok: true, message: "Scheda salvata." };
      }
      this.refreshBaseline();
      return { ok: true, message: "Scheda salvata (solo in memoria: Supabase non configurato)." };
    },
    async deleteAthlete(id: string): Promise<{ ok: boolean; message: string }> {
      delete this.athletes[id];
      if (this.currentId === id) this.closeEditor();
      if (this.dbAvailable && supabase) {
        const { error } = await supabase.from("athletes").delete().eq("id", id);
        if (error) return { ok: false, message: "Rimosso in locale, ma la rimozione da Supabase è fallita." };
        return { ok: true, message: "Scheda eliminata." };
      }
      return { ok: true, message: "Scheda eliminata (solo in memoria)." };
    },
    exportCurrent() {
      const profile = this.currentProfile;
      if (!profile) return;
      const filename = (profile.meta.athlete_id || "nuovo-atleta") + ".json";
      const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
});
