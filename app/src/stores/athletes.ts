// Store Pinia per la gestione degli atleti: elenco, CRUD, stato "modifiche non salvate".
// Fase 3: il polling aggiorna solo l'elenco, mai la scheda in editing (vedi openAthlete/
// loadAthletesFromSupabase); la versione di riga (updated_at, timestamptz) e' usata sia
// per rilevare dati più recenti sul server sia come controllo di concorrenza al salvataggio.
import { defineStore } from "pinia";
import { supabase, configured } from "../services/supabase";
import { blankProfile, fullName, todayISO } from "../constants";
import { hasNewerRemoteVersion, snapshotForCompare } from "../composables/useDirtyState";
import type { AthleteTrainingProfile } from "../schema/types.generated";

const NOT_SAVED = "Scheda non salvata: il server non ha risposto. Le modifiche restano qui: riprova a salvare.";

type LoadMetricsLog = AthleteTrainingProfile["training_status"]["load_metrics_log"];

function generateAthleteId(existingIds: string[]): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id: string;
  do {
    id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existingIds.includes(id));
  return id;
}

export const useAthletesStore = defineStore("athletes", {
  state: () => ({
    athletes: {} as Record<string, AthleteTrainingProfile>,
    rowVersions: {} as Record<string, string>,
    currentId: null as string | null,
    currentProfile: null as AthleteTrainingProfile | null,
    baselineSnapshot: null as string | null,
    currentBaseVersion: null as string | null,
    dbAvailable: false,
    /** Elenco letto almeno una volta (o Supabase non configurato): serve a distinguere "scheda inesistente" da "non ancora caricata". */
    loaded: false,
    pollHandle: null as ReturnType<typeof setInterval> | null
  }),
  getters: {
    sortedList(state): { id: string; name: string }[] {
      return Object.entries(state.athletes)
        .map(([id, p]) => ({ id, name: fullName(p.identity) || "(senza nome)" }))
        .sort((a, b) => a.name.localeCompare(b.name, "it"));
    },
    isDirty(state): boolean {
      if (!state.currentProfile || state.baselineSnapshot === null) return false;
      return snapshotForCompare(state.currentProfile) !== state.baselineSnapshot;
    },
    hasRemoteUpdate(state): boolean {
      return hasNewerRemoteVersion(state.currentId, state.rowVersions, state.currentBaseVersion);
    }
  },
  actions: {
    async loadAthletesFromSupabase() {
      if (!supabase) return;
      const { data, error } = await supabase.from("athletes").select("id, data, updated_at");
      if (error) return;
      const map: Record<string, AthleteTrainingProfile> = {};
      const versions: Record<string, string> = {};
      (data || []).forEach((row: { id: string; data: AthleteTrainingProfile; updated_at: string }) => {
        map[row.id] = row.data;
        versions[row.id] = row.updated_at;
      });
      this.athletes = map;
      this.rowVersions = versions;
      this.loaded = true;
      if (this.currentId && !map[this.currentId]) {
        this.currentId = null;
        this.currentProfile = null;
        this.baselineSnapshot = null;
        this.currentBaseVersion = null;
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
      if (!configured || !supabase) {
        this.loaded = true;
        return;
      }
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
      this.currentBaseVersion = this.rowVersions[id] ?? null;
    },
    // Ricarica la scheda aperta con i dati più recenti già noti al polling della lista
    // (nessuna richiesta aggiuntiva: this.athletes è già allineato al DB ad ogni poll).
    // Chiamata da "Ricarica i dati più recenti"; chi la invoca è responsabile di chiedere
    // conferma se ci sono modifiche locali non salvate.
    reloadCurrentFromRemote() {
      if (!this.currentId) return;
      const fresh = this.athletes[this.currentId];
      if (!fresh) return;
      this.currentProfile = JSON.parse(JSON.stringify(fresh));
      this.baselineSnapshot = snapshotForCompare(this.currentProfile!);
      this.currentBaseVersion = this.rowVersions[this.currentId] ?? null;
    },
    newAthlete() {
      this.currentId = null;
      this.currentProfile = blankProfile();
      this.baselineSnapshot = snapshotForCompare(this.currentProfile);
      this.currentBaseVersion = null;
    },
    closeEditor() {
      this.currentId = null;
      this.currentProfile = null;
      this.baselineSnapshot = null;
      this.currentBaseVersion = null;
    },
    refreshBaseline() {
      if (this.currentProfile) this.baselineSnapshot = snapshotForCompare(this.currentProfile);
    },
    /** Scarta le modifiche non salvate: la scheda torna all'ultima versione salvata, la bozza si chiude. */
    discardChanges() {
      if (this.currentId && this.athletes[this.currentId]) this.openAthlete(this.currentId);
      else this.closeEditor();
    },
    /** Esito positivo di un salvataggio: la copia nell'elenco e' indipendente da quella in modifica. */
    commitSaved(id: string, version: string) {
      this.athletes[id] = JSON.parse(JSON.stringify(this.currentProfile));
      this.rowVersions[id] = version;
      this.currentId = id;
      this.currentBaseVersion = version;
      this.refreshBaseline();
    },
    async saveCurrent(): Promise<{ ok: boolean; message: string }> {
      const profile = this.currentProfile;
      if (!profile) return { ok: false, message: "Nessuna scheda aperta." };
      if (!profile.identity?.nome?.trim()) {
        return { ok: false, message: "Il nome dell'atleta è obbligatorio." };
      }
      // I metadati non contano come modifica (useDirtyState): aggiornarli prima dell'esito non
      // cambia lo stato "Modifiche non salvate" se il salvataggio fallisce.
      const isNew = !this.currentId;
      if (isNew) {
        if (!profile.meta.athlete_id) profile.meta.athlete_id = generateAthleteId(Object.keys(this.athletes));
        profile.meta.created_at = todayISO();
      }
      profile.meta.updated_at = todayISO();
      const id = profile.meta.athlete_id;
      const nowIso = new Date().toISOString();

      if (!this.dbAvailable || !supabase) {
        this.commitSaved(id, nowIso);
        return { ok: true, message: "Scheda salvata (solo in memoria: Supabase non configurato)." };
      }

      // Un errore lascia la scheda come prima: modifiche non salvate, "Salva" attivo, nessuna
      // copia nell'elenco (non esiste un salvataggio locale).
      if (isNew) {
        const { error } = await supabase.from("athletes").insert({ id, data: profile, updated_at: nowIso });
        if (error) return { ok: false, message: NOT_SAVED };
        this.commitSaved(id, nowIso);
        return { ok: true, message: "Scheda salvata." };
      }

      // Concorrenza ottimistica: l'update e' condizionato alla versione di riga nota all'apertura o
      // all'ultimo salvataggio. Se un'altra sessione ha salvato nel frattempo non trova righe: il
      // coach viene avvisato invece di sovrascrivere (rischio del salvataggio dell'intero jsonb,
      // vedi limiti-roadmap.md).
      const baseVersion = this.currentBaseVersion;
      const update = supabase.from("athletes").update({ data: profile, updated_at: nowIso }).eq("id", id);
      const conditionedUpdate = baseVersion ? update.eq("updated_at", baseVersion) : update;
      const { data: updatedRows, error } = await conditionedUpdate.select("updated_at");
      if (error) return { ok: false, message: NOT_SAVED };
      if (!updatedRows || updatedRows.length === 0) {
        return {
          ok: false,
          message: baseVersion
            ? "Scheda non salvata: è stata modificata altrove dopo l'apertura. Usa «Ricarica i dati più recenti», poi riapplica le modifiche."
            : NOT_SAVED
        };
      }
      this.commitSaved(id, nowIso);
      return { ok: true, message: "Scheda salvata." };
    },
    // Persiste una sincronizzazione Intervals.icu senza passare dal salvataggio manuale
    // dell'intera scheda (§6): i dati sincronizzati non devono comparire come "modifiche
    // non salvate" (vedi useDirtyState) e non devono richiedere all'utente di cliccare
    // "Salva" per non perderli. Scrittura mirata: si fonde load_metrics_log sopra la copia
    // più recente presente su Supabase (non sopra currentProfile), cosi' da non persistere
    // per errore altre modifiche locali dell'utente ancora in corso e non confermate.
    async syncLoadMetrics(log: LoadMetricsLog) {
      if (!this.currentProfile) return;
      this.currentProfile.training_status.load_metrics_log = log;
      const id = this.currentId;
      if (!id || !this.dbAvailable || !supabase) return;

      const { data: fetched, error: fetchError } = await supabase
        .from("athletes")
        .select("data, updated_at")
        .eq("id", id)
        .single();
      if (fetchError || !fetched) return;
      const row = fetched as { data: AthleteTrainingProfile; updated_at: string };
      const merged: AthleteTrainingProfile = {
        ...row.data,
        training_status: { ...row.data.training_status, load_metrics_log: log }
      };
      const nowIso = new Date().toISOString();
      const { data: updatedRows, error } = await supabase
        .from("athletes")
        .update({ data: merged, updated_at: nowIso })
        .eq("id", id)
        .eq("updated_at", row.updated_at)
        .select("updated_at");
      if (error || !updatedRows || updatedRows.length === 0) return;

      this.athletes[id] = merged;
      this.rowVersions[id] = nowIso;
      if (this.currentId === id) this.currentBaseVersion = nowIso;
    },
    async deleteAthlete(id: string): Promise<{ ok: boolean; message: string }> {
      // Prima il database: rimuoverla solo in locale la farebbe ricomparire al polling successivo.
      if (this.dbAvailable && supabase) {
        const { error } = await supabase.from("athletes").delete().eq("id", id);
        if (error) return { ok: false, message: "Scheda non eliminata: il server non ha risposto. Riprova." };
      }
      delete this.athletes[id];
      delete this.rowVersions[id];
      if (this.currentId === id) this.closeEditor();
      return { ok: true, message: this.dbAvailable ? "Scheda eliminata." : "Scheda eliminata (solo in memoria)." };
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
