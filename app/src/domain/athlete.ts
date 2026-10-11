// Dati dell'atleta che servono alla pianificazione delle sedute.
import type { AthleteTrainingProfile } from "../schema/types.generated";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import { flattenSteps, peakZone } from "@shared/workouts/structure.ts";

/** true se l'ultima soglia di bici registrata ha un FTP: la bici si pianifica in potenza,
 * altrimenti in frequenza cardiaca (decisione del coach, ADR 0017). */
export function hasFtp(profile: AthleteTrainingProfile | null | undefined): boolean {
  const log = profile?.physiological_thresholds?.cycling?.thresholds_log ?? [];
  const latest = [...log].sort((a, b) => (a.date || "").localeCompare(b.date || "")).at(-1) as { ftp_watts?: number | null } | undefined;
  return typeof latest?.ftp_watts === "number" && latest.ftp_watts > 0;
}

/** Discipline con zone d'intensita'; la palestra non ne ha. */
export type ZoneDiscipline = "running" | "cycling" | "swimming";

/**
 * Zone del sistema impostato per l'atleta (decisione del coach D-UX-3): corsa e bici dal loro
 * `zone_system` (3, 5 o 7 zone), il nuoto senza un sistema proprio usa 7 zone. Le sedute devono
 * restare entro queste zone, le stesse impostate sull'account Intervals.icu dell'atleta.
 */
export function zoneLimits(profile: AthleteTrainingProfile | null | undefined): Record<ZoneDiscipline, number> {
  const count = (system: string | undefined) => {
    const n = Number(/^(\d)-zone$/.exec(system ?? "")?.[1]);
    return n === 3 || n === 5 || n === 7 ? n : 7;
  };
  const t = profile?.physiological_thresholds;
  return { running: count(t?.running?.zone_system), cycling: count(t?.cycling?.zone_system), swimming: 7 };
}

const DISCIPLINE_PHRASE: Record<ZoneDiscipline, string> = { running: "la corsa", cycling: "la bici", swimming: "il nuoto" };

/** Motivo per cui una seduta usa zone oltre il sistema dell'atleta, oppure null. */
export function zoneIssue(w: Pick<WorkoutContent, "discipline" | "structure">, limits: Record<ZoneDiscipline, number>): string | null {
  const max = limits[w.discipline as ZoneDiscipline];
  if (!max) return null;
  const peaks = flattenSteps(w.structure).map((s) => peakZone(s.target) ?? 0);
  const highest = Math.max(0, ...peaks);
  return highest > max ? `Usa la zona Z${highest}, oltre le ${max} zone impostate per ${DISCIPLINE_PHRASE[w.discipline as ZoneDiscipline]}.` : null;
}
