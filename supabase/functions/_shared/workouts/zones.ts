// Sistema di zone dell'atleta per disciplina (ADR 0025, 0028). Modulo puro condiviso tra app
// (pianificazione, controlli, Impostazioni) ed Edge Function (analisi del feedback).

/** Sistemi di zone ammessi: gli stessi di Intervals.icu e della scheda (`zone_system`). */
export const ZONE_COUNTS = [3, 5, 7] as const;
export type ZoneCount = (typeof ZONE_COUNTS)[number];

/** Discipline con zone d'intensita'; la palestra non ne ha. */
export type ZoneDiscipline = "running" | "cycling" | "swimming";

/** Il nuoto non ha un sistema proprio nella scheda: usa sempre 7 zone. */
export const SWIM_ZONE_COUNT: ZoneCount = 7;

/** "3-zone" | "5-zone" | "7-zone" → numero di zone; un valore assente o sconosciuto vale 7. */
export function zoneCountOf(system: string | null | undefined): ZoneCount {
  const n = Number(/^(\d)-zone$/.exec(system ?? "")?.[1]);
  return n === 3 || n === 5 ? n : 7;
}

interface ThresholdsLike {
  running?: { zone_system?: string | null } | null;
  cycling?: { zone_system?: string | null } | null;
}

/** Zone per disciplina dalla sezione `physiological_thresholds` della scheda. */
export function zoneCountsOf(thresholds: ThresholdsLike | null | undefined): Record<ZoneDiscipline, ZoneCount> {
  return {
    running: zoneCountOf(thresholds?.running?.zone_system),
    cycling: zoneCountOf(thresholds?.cycling?.zone_system),
    swimming: SWIM_ZONE_COUNT
  };
}
