// Soglie di riferimento della scheda (ADR 0030): stima della durata degli step a distanza dal passo
// della zona, confronto con le soglie su Intervals.icu e soglie mancanti. Modulo puro condiviso tra
// app (totali, avvisi nella scheda) ed Edge Function (feedback, completamenti, scrittura della soglia).
//
// Formato su Intervals.icu (sport-settings): threshold_pace in metri al secondo, ftp in watt; le
// pace_zones sono percentuali della velocita' di soglia (vedi zoneModels.ts).
import { zoneCountOf, type ZoneDiscipline } from "./zones.ts";
import { sportSettingsFor, type IcuSportSettings, type ZoneModels } from "./zoneModels.ts";

/** "4:05" → 245 secondi; null se il testo non e' un passo valido. */
export function parsePace(text: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(text ?? "");
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s > 0 ? s : null;
}

/** 245 → "4:05". */
export function formatPace(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface LogEntry { date?: string | null; [k: string]: unknown }
interface ThresholdsLike {
  running?: { zone_system?: string | null; thresholds_log?: LogEntry[] | null } | null;
  cycling?: { zone_system?: string | null; thresholds_log?: LogEntry[] | null } | null;
  swimming?: { thresholds_log?: LogEntry[] | null } | null;
}
interface ProfileLike {
  disciplines?: { sport?: string }[] | null;
  physiological_thresholds?: ThresholdsLike | null;
}

/** Ultima voce per data di uno storico: e' il valore corrente (vedi lo schema della scheda). */
function latest(log: LogEntry[] | null | undefined): LogEntry | undefined {
  return [...(log ?? [])].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? ""))).at(-1);
}

export interface CurrentThresholds {
  /** Passo di soglia della corsa, secondi al km. */
  runningPace: number | null;
  /** CSS del nuoto, secondi ai 100 m. */
  swimmingCss: number | null;
  /** FTP della bici, watt. */
  cyclingFtp: number | null;
}

/** Soglie correnti: l'ultima rilevazione di ogni storico. */
export function currentThresholds(t: ThresholdsLike | null | undefined): CurrentThresholds {
  const ftp = Number(latest(t?.cycling?.thresholds_log)?.ftp_watts);
  return {
    runningPace: parsePace(latest(t?.running?.thresholds_log)?.threshold_pace_per_km as string | undefined),
    swimmingCss: parsePace(latest(t?.swimming?.thresholds_log)?.css_pace_per_100m as string | undefined),
    cyclingFtp: ftp > 0 ? ftp : null
  };
}

// ---------- Stima della durata degli step a distanza ----------

/** Dati per stimare il passo di una zona: secondi al metro alla soglia e limiti delle zone (in %
 * della velocita' di soglia, dal modello di Impostazioni per il sistema di zone dell'atleta). */
export interface PaceScale {
  secondsPerMeter: number;
  bounds: number[];
}
export type PaceContext = Partial<Record<"running" | "swimming", PaceScale>>;

/** Scale di passo dell'atleta; una disciplina senza soglia resta fuori (stima fissa). */
export function paceContextOf(t: ThresholdsLike | null | undefined, models: ZoneModels): PaceContext {
  const now = currentThresholds(t);
  const out: PaceContext = {};
  const run = models.running_pace[zoneCountOf(t?.running?.zone_system)];
  if (now.runningPace && run) out.running = { secondsPerMeter: now.runningPace / 1000, bounds: run.bounds };
  const swim = models.swimming_pace[7];
  if (now.swimmingCss && swim) out.swimming = { secondsPerMeter: now.swimmingCss / 100, bounds: swim.bounds };
  return out;
}

/**
 * Velocita' di una zona in % della soglia, per stimare la durata (decisione del coach, ADR 0030):
 * le zone intermedie al centro fra i loro limiti; Z1, che va da 0 al primo limite, e l'ultima zona,
 * che comprende tutto cio' che sta sopra il suo limite, al loro unico limite noto. Un intervallo di
 * zone (zone..zone_to) vale la media fra la zona piu' bassa e la piu' alta.
 */
export function zoneSpeedPct(bounds: number[], zone: number, zoneTo?: number | null): number {
  const n = bounds.length + 1;
  const one = (z: number) => (z <= 1 ? bounds[0] : z >= n ? bounds[n - 2] : (bounds[z - 2] + bounds[z - 1]) / 2);
  const lo = Math.min(Math.max(1, zone), n);
  const hi = Math.min(Math.max(lo, zoneTo ?? lo), n);
  return (one(lo) + one(hi)) / 2;
}

/** Secondi per coprire una distanza nella zona indicata, oppure null senza una scala. */
export function distanceSeconds(meters: number, zone: { zone: number; zone_to?: number | null } | null, scale: PaceScale | undefined): number | null {
  if (!scale || !zone) return null;
  const pct = zoneSpeedPct(scale.bounds, zone.zone, zone.zone_to);
  return pct > 0 ? (meters * scale.secondsPerMeter * 100) / pct : null;
}

// ---------- Confronto con Intervals.icu ----------

/** Tolleranze decise dal coach: 1 s/km, 1 s/100 m, 1 W. */
const TOLERANCE = { running: 1, swimming: 1, cycling: 1 } as const;

export interface ThresholdCheck {
  discipline: ZoneDiscipline;
  /** "Corsa, passo di soglia" ecc. */
  label: string;
  /** Valore della scheda (s/km, s/100 m o W), null se manca. */
  pcoach: number | null;
  /** Valore su Intervals.icu nella stessa unita', null se manca. */
  intervals: number | null;
  /** true se coincidono entro la tolleranza; una soglia mancante in PCoach non si confronta. */
  aligned: boolean;
  /** Valore per l'utente, es. "4:00/km" o "250 W". */
  format: (v: number) => string;
  /** Campi da scrivere su Intervals.icu per portarlo al valore della scheda. */
  body: Record<string, number> | null;
}

const DISCIPLINE_NAME: Record<ZoneDiscipline, string> = { running: "Corsa", cycling: "Bici", swimming: "Nuoto" };

/** Secondi per unita' (1000 m o 100 m) ↔ metri al secondo. */
const toSpeed = (seconds: number, unit: number) => unit / seconds;
const fromSpeed = (mps: number | null | undefined, unit: number) => (mps && mps > 0 ? unit / mps : null);

/**
 * Soglie da confrontare: quelle della misura con cui PCoach prescrive (ADR 0029). Corsa: passo di
 * soglia; nuoto: CSS; bici: FTP solo se la scheda lo ha (senza FTP la bici e' in FC e la scheda non
 * ha una FC di soglia della bici da confrontare). Solo discipline praticate con impostazioni su
 * Intervals.icu.
 */
export function thresholdChecks(profile: ProfileLike | null | undefined, list: IcuSportSettings[]): ThresholdCheck[] {
  const sports = new Set((profile?.disciplines ?? []).map((d) => d?.sport));
  const now = currentThresholds(profile?.physiological_thresholds);
  const out: ThresholdCheck[] = [];
  for (const discipline of ["cycling", "running", "swimming"] as ZoneDiscipline[]) {
    if (!sports.has(discipline)) continue;
    const s = sportSettingsFor(list, discipline);
    if (!s) continue;
    let pcoach: number | null;
    let intervals: number | null;
    let format: (v: number) => string;
    let body: Record<string, number> | null;
    if (discipline === "cycling") {
      if (!now.cyclingFtp) continue;
      pcoach = now.cyclingFtp;
      intervals = s.ftp && s.ftp > 0 ? s.ftp : null;
      format = (v) => `${Math.round(v)} W`;
      body = { ftp: Math.round(pcoach) };
    } else {
      const unit = discipline === "running" ? 1000 : 100;
      pcoach = discipline === "running" ? now.runningPace : now.swimmingCss;
      intervals = fromSpeed(s.threshold_pace, unit);
      format = (v) => `${formatPace(v)}/${discipline === "running" ? "km" : "100 m"}`;
      body = pcoach ? { threshold_pace: Math.round(toSpeed(pcoach, unit) * 10000) / 10000 } : null;
    }
    const aligned = pcoach === null || (intervals !== null && Math.abs(pcoach - intervals) <= TOLERANCE[discipline]);
    const label = `${DISCIPLINE_NAME[discipline]}, ${discipline === "cycling" ? "FTP" : discipline === "running" ? "passo di soglia" : "CSS"}`;
    out.push({ discipline, label, pcoach, intervals, aligned, format, body });
  }
  return out;
}

/**
 * Soglie mancanti nella scheda per le discipline praticate, indipendenti da Intervals.icu: passo di
 * soglia della corsa e CSS del nuoto, che servono a stimare la durata degli step a distanza. La bici
 * senza FTP si prescrive in FC (ADR 0017) e non e' una soglia mancante.
 */
export function missingThresholds(profile: ProfileLike | null | undefined): string[] {
  const sports = new Set((profile?.disciplines ?? []).map((d) => d?.sport));
  const now = currentThresholds(profile?.physiological_thresholds);
  const out: string[] = [];
  if (sports.has("running") && !now.runningPace) out.push("il passo di soglia della corsa");
  if (sports.has("swimming") && !now.swimmingCss) out.push("la CSS del nuoto");
  return out;
}
