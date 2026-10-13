// Risultato del controllo di un atleta su Intervals.icu (ADR 0037), salvato in athlete_checks: chiave,
// zone e soglie rispetto alla scheda. Lo scrivono il controllo periodico (athlete-checks, ogni 30 minuti)
// e la lettura delle zone all'apertura della scheda (intervals-sync, zones_read); lo leggono la pagina
// «Da fare» e il contatore della barra laterale. Funzioni pure.
import { alignmentProblems, type ProfileLike } from "./thresholds.ts";
import type { IcuSportSettings } from "./zoneModels.ts";

export type KeyStatus = "valid" | "invalid" | "none" | "unreachable";

export interface AthleteCheck {
  athlete_id: string;
  checked_at: string;
  key_status: KeyStatus;
  /** Zone diverse, es. "Corsa (passo): 5 zone in PCoach, 7 su Intervals.icu". */
  zone_problems: string[];
  /** Soglie diverse, es. "Corsa, passo di soglia: 4:00/km in PCoach, 4:10/km su Intervals.icu". */
  threshold_problems: string[];
}

const ZONE_FIELDS = ["id", "types", "ftp", "lthr", "max_hr", "threshold_pace", "power_zones", "hr_zones", "pace_zones"] as const;

/** Impostazioni degli sport lette da Intervals.icu, ridotte ai campi di zone e soglie. */
export function pickZones(raw: unknown): IcuSportSettings[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Object.fromEntries(ZONE_FIELDS.map((k) => [k, (x as Record<string, unknown>)?.[k] ?? null])) as unknown as IcuSportSettings);
}

/**
 * Risultato da salvare. `sports` null vuol dire lettura non riuscita: chiave non valida (`status` 401 o
 * 403) oppure Intervals.icu non raggiungibile, che non aggiunge anomalie.
 */
export function athleteCheck(
  athleteId: string,
  profile: ProfileLike | null | undefined,
  hasKey: boolean,
  sports: IcuSportSettings[] | null,
  status: number | null,
  now: Date
): AthleteCheck {
  const base = { athlete_id: athleteId, checked_at: now.toISOString(), zone_problems: [] as string[], threshold_problems: [] as string[] };
  if (!hasKey) return { ...base, key_status: "none" };
  if (!sports) return { ...base, key_status: status === 401 || status === 403 ? "invalid" : "unreachable" };
  const p = alignmentProblems(profile, sports);
  return { ...base, key_status: "valid", zone_problems: p.zones, threshold_problems: p.thresholds };
}
