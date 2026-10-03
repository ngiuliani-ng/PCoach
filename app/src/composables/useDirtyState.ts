// Confronto "modifiche non salvate" (Fase 3, §6): funzione pura, testabile separatamente
// dallo store. I dati Intervals.icu sincronizzati non contano come modifica: possono
// cambiare in qualsiasi momento per effetto della sincronizzazione automatica, e l'utente
// non li ha scritti lui — non devono quindi far comparire il chip "Modifiche non salvate"
// ne' bloccare il rilevamento di "dati aggiornati disponibili".
import type { AthleteTrainingProfile } from "../schema/types.generated";

export function snapshotForCompare(profile: AthleteTrainingProfile): string {
  const clone = JSON.parse(JSON.stringify(profile));
  delete clone.meta.updated_at;
  delete clone.meta.created_at;
  delete clone.meta.athlete_id;
  if (clone.training_status?.load_metrics_log) {
    clone.training_status.load_metrics_log = clone.training_status.load_metrics_log.filter(
      (entry: { source?: string }) => entry.source !== "intervals_icu_sync"
    );
  }
  return JSON.stringify(clone);
}

// Rileva se il server ha una versione della scheda aperta più recente di quella caricata
// in editor (§6): confronta la versione nota al momento dell'apertura/ultimo salvataggio
// con quella rilevata dal polling della lista. currentBaseVersion null significa "nessuna
// versione nota" (es. scheda nuova, mai salvata): in quel caso non c'è nulla da confrontare.
export function hasNewerRemoteVersion(
  currentId: string | null,
  rowVersions: Record<string, string>,
  currentBaseVersion: string | null
): boolean {
  if (!currentId || currentBaseVersion === null) return false;
  const remoteVersion = rowVersions[currentId];
  if (!remoteVersion) return false;
  return remoteVersion !== currentBaseVersion;
}
