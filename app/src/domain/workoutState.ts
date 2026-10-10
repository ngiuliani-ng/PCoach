// Stati derivati di una seduta. I tre assi restano separati (ADR 0017):
// approvazione (salvata), esecuzione (derivata), sincronizzazione (workout_sync).
import { isActiveStatus } from "./regeneration";

export type ExecState = "done" | "missed" | "today" | "planned";

export function execState(w: { status: string; planned_date: string; completed_at: string | null }, today: string): ExecState | null {
  if (!isActiveStatus(w.status)) return null;
  if (w.completed_at) return "done";
  if (w.planned_date < today) return "missed";
  if (w.planned_date === today) return "today";
  return "planned";
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Da revisionare",
  approved: "Approvata",
  cancelled: "Annullata",
  superseded: "Sostituita"
};

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
