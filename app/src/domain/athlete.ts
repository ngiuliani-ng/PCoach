// Dati dell'atleta che servono alla pianificazione delle sedute.
import type { AthleteTrainingProfile } from "../schema/types.generated";

/** true se l'ultima soglia di bici registrata ha un FTP: la bici si pianifica in potenza,
 * altrimenti in frequenza cardiaca (decisione del coach, ADR 0017). */
export function hasFtp(profile: AthleteTrainingProfile | null | undefined): boolean {
  const log = profile?.physiological_thresholds?.cycling?.thresholds_log ?? [];
  const latest = [...log].sort((a, b) => (a.date || "").localeCompare(b.date || "")).at(-1) as { ftp_watts?: number | null } | undefined;
  return typeof latest?.ftp_watts === "number" && latest.ftp_watts > 0;
}
