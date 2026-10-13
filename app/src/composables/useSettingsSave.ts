// Salvataggio delle Impostazioni con l'avviso sui modelli di zone (audit UX-41): cambiarli cambia la
// durata stimata delle sedute a distanza di tutti gli atleti e i limiti che PCoach scrive su
// Intervals.icu, quindi si chiede prima. Usato dal pulsante «Salva impostazioni» e dall'uscita dalla pagina.
import { useSettingsStore } from "../stores/settings";
import { confirmDialog } from "./useConfirmDialog";

export async function saveSettings(): Promise<{ ok: boolean; message: string; cancelled?: boolean }> {
  const settings = useSettingsStore();
  // Prima la validazione: non si chiede di confermare un salvataggio che verrebbe rifiutato (audit A-14).
  if (settings.validationError) return { ok: false, message: settings.validationError };
  if (JSON.stringify(settings.settings.zone_models) !== JSON.stringify(settings.savedZoneModels)) {
    const ok = await confirmDialog(
      "Hai cambiato i modelli di zone. Valgono per tutti gli atleti: cambiano la durata stimata degli step a distanza (totali, durata massima del giorno, feedback) e i limiti che PCoach scrive su Intervals.icu. Salvare?",
      { confirmLabel: "Salva i modelli", cancelLabel: "Non salvare", tone: "primary" }
    );
    if (!ok) return { ok: false, message: "", cancelled: true };
  }
  return settings.save();
}
