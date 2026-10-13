// Stati derivati di una seduta. I tre assi restano separati (ADR 0017):
// approvazione (salvata), esecuzione (derivata), sincronizzazione (workout_sync).
import { isActiveStatus } from "./regeneration";

/** "unrecorded": data passata e nessuna attivita' registrata. Non vuol dire "non svolta": il
 * sistema sa solo che non c'e' un'attivita' abbinata (dato mancante, non prestazione negativa). */
export type ExecState = "done" | "unrecorded" | "today" | "planned";

export function execState(w: { status: string; planned_date: string; completed_at: string | null }, today: string): ExecState | null {
  if (!isActiveStatus(w.status)) return null;
  if (w.completed_at) return "done";
  if (w.planned_date < today) return "unrecorded";
  if (w.planned_date === today) return "today";
  return "planned";
}

/** Svolta, ma molto meno del prescritto (esiti "partial" e "short" dell'abbinamento): decisione D-10. */
export function isPartlyDone(w: { completed_at: string | null; completion_outcome?: string | null }): boolean {
  return !!w.completed_at && (w.completion_outcome === "partial" || w.completion_outcome === "short");
}

/** Riepilogo dell'attivita' abbinata: "42 min su 60 previsti, RPE 7". */
export function activitySummary(
  w: { activity_minutes?: number | null; activity_rpe?: number | null; completion_ratio?: number | null },
  plannedSeconds: number
): string {
  const parts: string[] = [];
  if (w.activity_minutes != null) parts.push(plannedSeconds > 0 ? `${formatMinutes(w.activity_minutes * 60)} su ${formatMinutes(plannedSeconds)} previsti` : formatMinutes(w.activity_minutes * 60));
  if (w.completion_ratio != null) parts.push(`${Math.round(w.completion_ratio * 100)}% del prescritto`);
  if (w.activity_rpe != null) parts.push(`RPE ${w.activity_rpe}`);
  return parts.join(", ");
}

/**
 * Glossario degli stati (audit UI/UX di ottobre 2026, D-03): un nome per concetto, senza parole con la
 * stessa radice su assi diversi. Badge, filtri, anomalie e feedback usano queste etichette.
 */
export const STATE_LABELS = {
  /** Seduta proposta e non ancora approvata. */
  draft: "Bozza",
  approved: "Approvata",
  cancelled: "Annullata",
  superseded: "Sostituita",
  /** Seduta che viola un vincolo o va ricontrollata (needs_review): non si invia. */
  needsReview: "Da verificare",
  /** Feedback settimanale pronto, in attesa dell'approvazione del coach. */
  reviewDraft: "Da approvare"
} as const;

/** Numero progressivo delle modifiche di una seduta o di un feedback. */
export const versionLabel = (n: number) => `Versione ${n}`;

export const ROLE_LABELS: Record<string, string> = {
  warmup: "Riscaldamento",
  work: "Lavoro",
  recovery: "Recupero",
  steady: "Continuo",
  cooldown: "Defaticamento"
};

export const TARGET_LABELS: Record<string, string> = {
  power: "Potenza",
  hr: "Frequenza cardiaca",
  pace: "Passo"
};

/** "1 h 05 min" / "45 min". */
export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}

export function formatMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;
}
