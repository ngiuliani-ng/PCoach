// Confronto fra il sistema di zone della scheda e le zone su Intervals.icu, e modelli di zone per
// allineare Intervals.icu a PCoach (ADR 0029). Modulo puro condiviso tra app (avviso nella scheda,
// Impostazioni) ed Edge Function intervals-sync (scrittura delle zone).
//
// Formato delle zone su Intervals.icu (sport-settings, verificato su un account reale il 2026-10-12):
// - power_zones: limite superiore di ogni zona in % dell'FTP, l'ultima vale 999 (aperta);
// - hr_zones: limite superiore di ogni zona in bpm, l'ultimo e' la FC massima;
// - pace_zones: limite superiore di ogni zona in % della velocita' di soglia, l'ultima vale 999.
// Il numero di zone e' la lunghezza della lista.
import { ZONE_COUNTS, zoneCountOf, type ZoneCount, type ZoneDiscipline } from "./zones.ts";

/** Zone confrontate per ogni disciplina: quelle con cui PCoach prescrive le sedute (ADR 0017). */
export type ZoneModelKey = "cycling_power" | "cycling_hr" | "running_pace" | "swimming_pace";
export type ZoneField = "power_zones" | "hr_zones" | "pace_zones";

export const ZONE_MODEL_KEYS: ZoneModelKey[] = ["cycling_power", "cycling_hr", "running_pace", "swimming_pace"];

export const ZONE_MODEL_INFO: Record<ZoneModelKey, { label: string; unit: string; field: ZoneField; counts: readonly ZoneCount[]; range: [number, number] }> = {
  cycling_power: { label: "Bici, potenza", unit: "% dell'FTP", field: "power_zones", counts: ZONE_COUNTS, range: [1, 400] },
  cycling_hr: { label: "Bici, frequenza cardiaca", unit: "% della FC di soglia", field: "hr_zones", counts: ZONE_COUNTS, range: [40, 130] },
  running_pace: { label: "Corsa, passo", unit: "% della velocità di soglia", field: "pace_zones", counts: ZONE_COUNTS, range: [30, 200] },
  swimming_pace: { label: "Nuoto, passo", unit: "% della velocità di soglia (CSS)", field: "pace_zones", counts: [7], range: [30, 200] }
};

export interface ZonePreset {
  id: string;
  label: string;
  /** Fonte, mostrata in Impostazioni. */
  source: string;
  zones: ZoneCount;
  /** Limite superiore delle zone da Z1 a Z(n-1), nell'unita' del modello; l'ultima zona e' aperta. */
  bounds: number[];
  names: string[];
}

const COGGAN = "Allen e Coggan, Training and Racing with a Power Meter";
const FRIEL = "Friel, The Cyclist's / Triathlete's Training Bible";
const SEILER = "Seiler e Kjerland 2006: zona 1 sotto LT1, zona 2 fra LT1 e LT2, zona 3 sopra LT2";
const SEILER_NAMES = ["Sotto LT1", "Fra LT1 e LT2", "Sopra LT2"];

/** Modelli noti per ogni chiave. Il primo per numero di zone e' il predefinito (il piu' usato). */
export const ZONE_PRESETS: Record<ZoneModelKey, ZonePreset[]> = {
  cycling_power: [
    { id: "coggan7", label: "Coggan, 7 livelli", source: `${COGGAN}. È il modello predefinito di Intervals.icu.`, zones: 7, bounds: [55, 75, 90, 105, 120, 150],
      names: ["Recupero attivo", "Resistenza", "Tempo", "Soglia", "VO2max", "Capacità anaerobica", "Neuromuscolare"] },
    { id: "coggan5", label: "Coggan, livelli 1-5", source: `${COGGAN}: i livelli 5, 6 e 7 diventano una zona.`, zones: 5, bounds: [55, 75, 90, 105],
      names: ["Recupero attivo", "Resistenza", "Tempo", "Soglia", "Sopra soglia"] },
    { id: "seiler3", label: "Seiler, 3 zone", source: `${SEILER}. LT1 stimata al 75% dell'FTP (fine della resistenza di Coggan), LT2 all'FTP.`, zones: 3, bounds: [75, 100],
      names: SEILER_NAMES }
  ],
  cycling_hr: [
    { id: "friel7", label: "Friel, 7 zone", source: `${FRIEL}, bici (zone 1-4, 5a, 5b, 5c). È il modello predefinito di Intervals.icu.`, zones: 7, bounds: [81, 89, 93, 99, 102, 106],
      names: ["Recupero", "Aerobica", "Tempo", "Sotto soglia", "Sopra soglia", "Capacità aerobica", "Anaerobica"] },
    { id: "friel5", label: "Friel, 5 zone", source: `${FRIEL}, bici: le zone 5a, 5b e 5c diventano una zona.`, zones: 5, bounds: [81, 89, 93, 99],
      names: ["Recupero", "Aerobica", "Tempo", "Sotto soglia", "Sopra soglia"] },
    { id: "coggan5hr", label: "Coggan, 5 zone di FC", source: `${COGGAN}, livelli di frequenza cardiaca.`, zones: 5, bounds: [68, 83, 94, 105],
      names: ["Recupero attivo", "Resistenza", "Tempo", "Soglia", "Sopra soglia"] },
    { id: "seiler3", label: "Seiler, 3 zone", source: `${SEILER}. LT1 alla fine della zona 2 di Friel (89%), LT2 alla FC di soglia.`, zones: 3, bounds: [89, 99],
      names: SEILER_NAMES }
  ],
  running_pace: [
    { id: "friel7", label: "Friel, 7 zone", source: `${FRIEL}, corsa (zone 1-4, 5a, 5b, 5c). È il modello predefinito di Intervals.icu.`, zones: 7, bounds: [77.5, 87.7, 94.3, 100, 103.4, 111.5],
      names: ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5a", "Zona 5b", "Zona 5c"] },
    { id: "friel5", label: "Friel, 5 zone", source: `${FRIEL}, corsa: le zone 5a, 5b e 5c diventano una zona.`, zones: 5, bounds: [77.5, 87.7, 94.3, 100],
      names: ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5"] },
    { id: "seiler3", label: "Seiler, 3 zone", source: `${SEILER}. LT1 alla fine della zona 2 di Friel (87,7%), LT2 alla velocità di soglia.`, zones: 3, bounds: [87.7, 100],
      names: SEILER_NAMES }
  ],
  swimming_pace: [
    { id: "icu7", label: "Intervals.icu, 7 zone", source: "Modello predefinito di Intervals.icu per il nuoto, sulla velocità di soglia (CSS).", zones: 7, bounds: [77.5, 87.7, 94.3, 100, 103.4, 111.5],
      names: ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5", "Zona 6", "Zona 7"] }
  ]
};

export interface ZoneModel {
  /** Modello di partenza, o "custom" se i limiti sono stati cambiati a mano. */
  preset: string;
  bounds: number[];
}
export type ZoneModels = Record<ZoneModelKey, Partial<Record<ZoneCount, ZoneModel>>>;

export function presetsFor(key: ZoneModelKey, zones: ZoneCount): ZonePreset[] {
  return ZONE_PRESETS[key].filter((p) => p.zones === zones);
}

export function defaultZoneModels(): ZoneModels {
  const out = {} as ZoneModels;
  for (const key of ZONE_MODEL_KEYS) {
    out[key] = {};
    for (const n of ZONE_MODEL_INFO[key].counts) {
      const p = presetsFor(key, n)[0];
      out[key][n] = { preset: p.id, bounds: [...p.bounds] };
    }
  }
  return out;
}

/** Errore dei limiti di un modello, oppure null: n-1 valori crescenti nell'intervallo ammesso. */
export function boundsError(key: ZoneModelKey, zones: ZoneCount, bounds: unknown): string | null {
  const [min, max] = ZONE_MODEL_INFO[key].range;
  if (!Array.isArray(bounds) || bounds.length !== zones - 1) return `Servono ${zones - 1} valori, uno per ogni zona tranne l'ultima.`;
  if (!bounds.every((v) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max)) return `Ogni valore va da ${min} a ${max}.`;
  if (bounds.some((v, i) => i > 0 && v <= bounds[i - 1])) return "I valori devono crescere da una zona alla successiva.";
  return null;
}

/** Errori dei modelli per "chiave.zone" (vuoto se validi). */
export function zoneModelsErrors(models: ZoneModels): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ZONE_MODEL_KEYS) {
    for (const n of ZONE_MODEL_INFO[key].counts) {
      const err = boundsError(key, n, models[key]?.[n]?.bounds);
      if (err) errors[`${key}.${n}`] = err;
    }
  }
  return errors;
}

/** Modelli effettivi: quelli salvati se validi, altrimenti il predefinito di ciascuno. */
export function resolveZoneModels(raw: unknown): ZoneModels {
  const out = defaultZoneModels();
  if (!raw || typeof raw !== "object") return out;
  for (const key of ZONE_MODEL_KEYS) {
    const byCount = (raw as Record<string, unknown>)[key];
    if (!byCount || typeof byCount !== "object") continue;
    for (const n of ZONE_MODEL_INFO[key].counts) {
      const m = (byCount as Record<string, unknown>)[String(n)] as Partial<ZoneModel> | undefined;
      if (m && !boundsError(key, n, m.bounds)) out[key][n] = { preset: typeof m.preset === "string" ? m.preset : "custom", bounds: [...m.bounds!] };
    }
  }
  return out;
}

// ---------- Confronto con Intervals.icu ----------

/** Impostazioni di uno sport su Intervals.icu (solo i campi usati). */
export interface IcuSportSettings {
  id: number;
  types: string[];
  ftp?: number | null;
  lthr?: number | null;
  max_hr?: number | null;
  threshold_pace?: number | null;
  power_zones?: number[] | null;
  hr_zones?: number[] | null;
  pace_zones?: number[] | null;
}

const ICU_TYPE: Record<ZoneDiscipline, string> = { running: "Run", cycling: "Ride", swimming: "Swim" };
const DISCIPLINE_NAME: Record<ZoneDiscipline, string> = { running: "Corsa", cycling: "Bici", swimming: "Nuoto" };

export function sportSettingsFor(list: IcuSportSettings[], discipline: ZoneDiscipline): IcuSportSettings | undefined {
  return list.find((s) => Array.isArray(s.types) && s.types.includes(ICU_TYPE[discipline]));
}

/** Zone con cui PCoach prescrive la disciplina: bici in potenza con l'FTP, altrimenti in FC; corsa e nuoto a passo. */
export function zoneModelKeyFor(discipline: ZoneDiscipline, hasFtp: boolean): ZoneModelKey {
  if (discipline === "cycling") return hasFtp ? "cycling_power" : "cycling_hr";
  return discipline === "running" ? "running_pace" : "swimming_pace";
}

export function icuZoneCount(s: IcuSportSettings, key: ZoneModelKey): number | null {
  const zones = s[ZONE_MODEL_INFO[key].field];
  return Array.isArray(zones) && zones.length ? zones.length : null;
}

export interface ZoneCheck {
  discipline: ZoneDiscipline;
  label: string;
  key: ZoneModelKey;
  /** Zone della scheda (il nuoto ne ha sempre 7). */
  pcoach: ZoneCount;
  /** Zone su Intervals.icu, null se lo sport o le zone di quella misura mancano. */
  intervals: number | null;
  aligned: boolean;
  /** PCoach puo' adottare il numero di Intervals.icu: solo 3, 5 o 7, e non per il nuoto. */
  canUseIntervals: boolean;
  /** Motivo per cui Intervals.icu non si puo' allineare a PCoach, oppure null. */
  intervalsBlocked: string | null;
}

interface ProfileLike {
  disciplines?: { sport?: string }[] | null;
  physiological_thresholds?: { running?: { zone_system?: string | null } | null; cycling?: { zone_system?: string | null } | null } | null;
}

/** Confronto per ogni disciplina con zone praticata dall'atleta. */
export function zoneChecks(profile: ProfileLike | null | undefined, hasFtp: boolean, list: IcuSportSettings[]): ZoneCheck[] {
  const sports = new Set((profile?.disciplines ?? []).map((d) => d?.sport));
  const out: ZoneCheck[] = [];
  for (const discipline of ["cycling", "running", "swimming"] as ZoneDiscipline[]) {
    if (!sports.has(discipline)) continue;
    const key = zoneModelKeyFor(discipline, hasFtp);
    const pcoach: ZoneCount = discipline === "swimming" ? 7 : zoneCountOf(profile?.physiological_thresholds?.[discipline]?.zone_system);
    const s = sportSettingsFor(list, discipline);
    const intervals = s ? icuZoneCount(s, key) : null;
    const metricLabel = key === "cycling_power" ? "potenza" : key === "cycling_hr" ? "frequenza cardiaca" : "passo";
    let intervalsBlocked: string | null = null;
    if (!s) intervalsBlocked = `Su Intervals.icu non ci sono impostazioni per ${DISCIPLINE_NAME[discipline].toLowerCase()}.`;
    else if (key === "cycling_hr" && !(s.lthr && s.max_hr)) intervalsBlocked = "Su Intervals.icu mancano la FC di soglia o la FC massima della bici.";
    out.push({
      discipline,
      label: `${DISCIPLINE_NAME[discipline]} (${metricLabel})`,
      key, pcoach, intervals,
      aligned: intervals === pcoach,
      canUseIntervals: discipline !== "swimming" && (intervals === 3 || intervals === 5 || intervals === 7),
      intervalsBlocked
    });
  }
  return out;
}

// ---------- Scrittura su Intervals.icu ----------

/** Campi da inviare a Intervals.icu per portare la misura al modello scelto, oppure l'errore. */
export function icuZonesUpdate(
  key: ZoneModelKey, zones: ZoneCount, models: ZoneModels, s: IcuSportSettings
): { ok: true; body: Record<string, unknown>; bounds: number[] } | { ok: false; error: string } {
  const model = models[key][zones];
  if (!model) return { ok: false, error: `Nessun modello a ${zones} zone per ${ZONE_MODEL_INFO[key].label.toLowerCase()}.` };
  const err = boundsError(key, zones, model.bounds);
  if (err) return { ok: false, error: `Modello in Impostazioni non valido: ${err}` };
  const preset = ZONE_PRESETS[key].find((p) => p.id === model.preset && p.zones === zones);
  const names = preset && model.preset !== "custom" ? preset.names : Array.from({ length: zones }, (_, i) => `Zona ${i + 1}`);
  const field = ZONE_MODEL_INFO[key].field;
  if (field !== "hr_zones") {
    const values = [...model.bounds, 999];
    return { ok: true, body: { [field]: values, [field.replace("_zones", "_zone_names")]: names }, bounds: values };
  }
  const lthr = s.lthr ?? 0;
  const maxHr = s.max_hr ?? 0;
  if (!(lthr > 0 && maxHr > 0)) return { ok: false, error: "Su Intervals.icu mancano la FC di soglia o la FC massima." };
  const bpm = [...model.bounds.map((p) => Math.round((lthr * p) / 100)), maxHr];
  if (bpm.some((v, i) => i > 0 && v <= bpm[i - 1])) {
    return { ok: false, error: `Con FC di soglia ${lthr} e FC massima ${maxHr} le zone non sono crescenti: controlla i valori su Intervals.icu.` };
  }
  return { ok: true, body: { hr_zones: bpm, hr_zone_names: names, lthr, max_hr: maxHr }, bounds: bpm };
}
