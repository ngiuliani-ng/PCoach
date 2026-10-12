// Salvataggio della scheda con un cambio del sistema di zone (ADR 0029): con sedute da svolgere
// nella disciplina chiede conferma, e dopo il salvataggio le segna «Da verificare». Ogni
// salvataggio della scheda dall'interfaccia passa da qui (Profilo, uscita, generazione, avviso zone).
import { useAthletesStore } from "../stores/athletes";
import { useWorkoutsStore } from "../stores/workouts";
import { todayISO } from "@shared/workouts/calendar.ts";
import { confirmDialog } from "./useConfirmDialog";
import { zoneChangeReason, zoneChanges, zoneChangeWarning, type ZoneChange } from "../domain/zoneChange";

export type SaveOutcome = { ok: boolean; message: string; cancelled?: boolean };

export function useZoneChange() {
  const athletes = useAthletesStore();
  const workouts = useWorkoutsStore();

  /** Avviso per i cambi indicati: quante sedute da oggi in poi tornano da verificare (vuoto se nessuna). */
  function warningFor(changes: ZoneChange[]): string {
    const today = todayISO();
    return zoneChangeWarning(changes.map((change) => ({ change, count: workouts.upcoming(change.discipline, today).length })));
  }

  /** Segna da verificare le sedute da svolgere delle discipline cambiate. */
  async function markForReview(changes: ZoneChange[]): Promise<SaveOutcome | null> {
    const id = athletes.currentId;
    if (!id || !changes.length) return null;
    const today = todayISO();
    let marked = 0;
    for (const c of changes) {
      const res = await workouts.markForReview(id, c.discipline, today, zoneChangeReason(c, today));
      if (!res.ok) return { ok: false, message: `Scheda salvata, ma ${res.message.charAt(0).toLowerCase()}${res.message.slice(1)}` };
      marked += res.value;
    }
    if (!marked) return null;
    return { ok: true, message: `Scheda salvata. ${marked === 1 ? "Una seduta è" : `${marked} sedute sono`} da verificare: adatta le zone al nuovo sistema.` };
  }

  /**
   * Salva la scheda corrente. Se cambia il sistema di zone con sedute da svolgere, prima chiede
   * conferma (salvo `confirmed`, quando il chiamante l'ha gia' chiesta con lo stesso avviso).
   */
  async function saveProfile(confirmed = false): Promise<SaveOutcome> {
    const id = athletes.currentId;
    const changes = id ? zoneChanges(athletes.athletes[id], athletes.currentProfile) : [];
    const warning = warningFor(changes);
    if (warning && !confirmed) {
      const ok = await confirmDialog(`Stai cambiando il sistema di zone. ${warning}`, { confirmLabel: "Salva e segna le sedute", cancelLabel: "Non salvare", tone: "primary" });
      if (!ok) return { ok: false, message: "", cancelled: true };
    }
    const result = await athletes.saveCurrent();
    if (!result.ok) return result;
    return (await markForReview(changes)) ?? result;
  }

  return { warningFor, saveProfile };
}
