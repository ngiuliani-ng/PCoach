// Traduzione di una zona in valori assoluti, solo da mostrare (ADR 0047): watt per la bici (dall'FTP),
// passo per la corsa (dal passo di soglia, min/km) e per il nuoto (dalla CSS, min/100 m), con la soglia
// valida nel giorno della seduta e i limiti del modello di zone di Impostazioni per il sistema
// dell'atleta. Le sedute restano in zone: questi
// valori non si salvano e non vanno a Claude né a Intervals.icu. La FC resta in zone (la scheda non ha
// una FC di soglia della bici).
import type { Discipline, TargetMetric, ZoneTarget } from "@shared/workouts/structure.ts";
import { currentThresholds, formatPace } from "@shared/workouts/thresholds.ts";
import type { ZoneModels } from "@shared/workouts/zoneModels.ts";
import { zoneCountOf } from "@shared/workouts/zones.ts";

/** Soglia di riferimento e limiti delle zone (in % della soglia; per il passo, della velocità). */
export interface ZoneScale {
  /** Watt (bici) o secondi per unità di distanza alla soglia (corsa: 1 km, nuoto: 100 m). */
  threshold: number;
  bounds: number[];
  /** Data della rilevazione da cui viene la soglia (AAAA-MM-GG), se indicata. */
  since: string | null;
}
export type ZoneScales = Partial<Record<"cycling" | "running" | "swimming", ZoneScale>>;

interface LogEntry { date?: string | null; [k: string]: unknown }
interface ThresholdsLike {
  running?: { zone_system?: string | null; thresholds_log?: LogEntry[] | null } | null;
  cycling?: { zone_system?: string | null; thresholds_log?: LogEntry[] | null } | null;
  swimming?: { thresholds_log?: LogEntry[] | null } | null;
}

/**
 * Rilevazione valida in un giorno: l'ultima con data uguale o precedente. Un giorno precedente alla
 * prima rilevazione usa la prima, l'unica nota; senza giorno vale l'ultima, come currentThresholds.
 */
export function entryAt(log: LogEntry[] | null | undefined, day?: string | null): LogEntry | undefined {
  const sorted = [...(log ?? [])].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  if (!day) return sorted.at(-1);
  return sorted.filter((e) => String(e.date ?? "") <= day).at(-1) ?? sorted[0];
}

/**
 * Scale dell'atleta nel giorno indicato (ADR 0047): per ogni disciplina la soglia della rilevazione
 * valida quel giorno, con i limiti delle zone del sistema attuale dell'atleta e dei modelli attuali di
 * Impostazioni (di quelli non c'è uno storico). Senza giorno, le soglie correnti. Una disciplina senza
 * soglia resta fuori (si vedono solo le zone).
 */
export function zoneScalesOf(t: ThresholdsLike | null | undefined, models: ZoneModels, day?: string | null): ZoneScales {
  const out: ZoneScales = {};
  const bike = entryAt(t?.cycling?.thresholds_log, day);
  const run = entryAt(t?.running?.thresholds_log, day);
  const swim = entryAt(t?.swimming?.thresholds_log, day);
  // Lettura dei valori come currentThresholds, sulla rilevazione scelta.
  const now = currentThresholds({
    cycling: { thresholds_log: bike ? [bike] : [] },
    running: { thresholds_log: run ? [run] : [] },
    swimming: { thresholds_log: swim ? [swim] : [] }
  });
  const power = models.cycling_power[zoneCountOf(t?.cycling?.zone_system)];
  if (now.cyclingFtp && power) out.cycling = { threshold: now.cyclingFtp, bounds: power.bounds, since: bike?.date ?? null };
  const runModel = models.running_pace[zoneCountOf(t?.running?.zone_system)];
  if (now.runningPace && runModel) out.running = { threshold: now.runningPace, bounds: runModel.bounds, since: run?.date ?? null };
  const swimModel = models.swimming_pace[7];
  if (now.swimmingCss && swimModel) out.swimming = { threshold: now.swimmingCss, bounds: swimModel.bounds, since: swim?.date ?? null };
  return out;
}

/** Scala da usare per disciplina e metrica: potenza per la bici, passo per corsa e nuoto. */
export function scaleFor(discipline: Discipline, metric: TargetMetric, scales: ZoneScales | null | undefined): ZoneScale | null {
  if (discipline === "cycling" && metric === "power") return scales?.cycling ?? null;
  if ((discipline === "running" || discipline === "swimming") && metric === "pace") return scales?.[discipline] ?? null;
  return null;
}

const UNIT: Record<"running" | "swimming", string> = { running: "/km", swimming: "/100 m" };

/**
 * Valori assoluti di un target: «151–206 W», «4:21–4:05 /km» (dal più lento al più veloce). Z1 parte da
 * zero e l'ultima zona è aperta: «fino a 151 W», «oltre 412 W», «più lento di 5:16 /km», «più veloce di
 * 3:40 /km». Un intervallo Zx–Zy va dal limite inferiore di Zx al superiore di Zy. null se la metrica
 * non si traduce (FC, palestra) o manca la soglia.
 */
export function targetRange(target: ZoneTarget | null | undefined, discipline: Discipline, metric: TargetMetric, scales: ZoneScales | null | undefined): string | null {
  const scale = scaleFor(discipline, metric, scales);
  if (!scale || !target) return null;
  const n = scale.bounds.length + 1;
  const from = Math.min(Math.max(1, target.zone), n);
  const to = Math.min(Math.max(from, target.zone_to ?? from), n);
  const low = from > 1 ? scale.bounds[from - 2] : null;
  const high = to < n ? scale.bounds[to - 1] : null;
  if (low === null && high === null) return null;

  if (discipline === "cycling") {
    const w = (pct: number) => Math.round((scale.threshold * pct) / 100);
    if (low === null) return `fino a ${w(high!)} W`;
    if (high === null) return `oltre ${w(low)} W`;
    return `${w(low)}–${w(high)} W`;
  }
  // Passo: le percentuali sono della velocità, quindi il passo è la soglia divisa per la percentuale.
  const unit = UNIT[discipline as "running" | "swimming"];
  const p = (pct: number) => formatPace((scale.threshold * 100) / pct);
  if (low === null) return `più lento di ${p(high!)} ${unit}`;
  if (high === null) return `più veloce di ${p(low)} ${unit}`;
  return `${p(low)}–${p(high)} ${unit}`;
}

/** Soglia da cui vengono i valori: «FTP 275 W», «Soglia 4:05 /km», «CSS 1:32 /100 m»; null se non si traduce. */
export function thresholdLabel(discipline: Discipline, metric: TargetMetric, scales: ZoneScales | null | undefined): string | null {
  const scale = scaleFor(discipline, metric, scales);
  if (!scale) return null;
  if (discipline === "cycling") return `FTP ${Math.round(scale.threshold)} W`;
  return `${discipline === "running" ? "Soglia" : "CSS"} ${formatPace(scale.threshold)} ${UNIT[discipline as "running" | "swimming"]}`;
}

/** Perché non ci sono valori assoluti per una metrica che li avrebbe: la soglia manca nella scheda. */
export function missingScaleNote(discipline: Discipline, metric: TargetMetric, scales: ZoneScales | null | undefined): string | null {
  if (scaleFor(discipline, metric, scales)) return null;
  if (discipline === "cycling" && metric === "power") return "Senza FTP nella scheda: solo zone.";
  if (discipline === "running" && metric === "pace") return "Senza passo di soglia nella scheda: solo zone.";
  if (discipline === "swimming" && metric === "pace") return "Senza CSS nella scheda: solo zone.";
  return null;
}
