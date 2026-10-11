// Normalizzazione delle attivita' di Intervals.icu: disciplina, disponibilita' dei dati,
// doppioni. Le attivita' importate da Strava arrivano via API senza dati (limite imposto da
// Strava): sono "non disponibili", non assenti.
import type { ActivityDiscipline, NormalizedActivity, RawActivity, ZoneSeconds } from "./types.ts";

/** Tipo di attivita' di Intervals.icu → disciplina. I tipi non elencati sono "other". */
export const ACTIVITY_TYPES: Record<string, ActivityDiscipline> = {
  Run: "running",
  TrailRun: "running",
  VirtualRun: "running",
  Ride: "cycling",
  VirtualRide: "cycling",
  GravelRide: "cycling",
  MountainBikeRide: "cycling",
  EBikeRide: "cycling",
  EMountainBikeRide: "cycling",
  TrackRide: "cycling",
  Swim: "swimming",
  OpenWaterSwim: "swimming",
  WeightTraining: "strength",
  Workout: "strength",
  Crossfit: "strength"
};

/** Tipi noti che non sono allenamenti delle discipline pianificabili (nessuna anomalia). */
const KNOWN_OTHER = new Set(["Walk", "Hike", "Yoga", "Pilates", "Elliptical", "StairStepper", "Rowing", "VirtualRow", "Golf", "Tennis", "Soccer", "Ski", "NordicSki", "AlpineSki", "BackcountrySki", "Snowshoe", "Kayaking", "Canoeing", "StandUpPaddling", "Surfing", "Kitesurf", "Windsurf", "RockClimbing", "IceSkate", "InlineSkate", "Skateboard", "Wheelchair", "Handcycle", "Other"]);

export function disciplineOfType(type: string | undefined): ActivityDiscipline {
  return (type && ACTIVITY_TYPES[type]) || "other";
}

export function isUnmappedType(type: string | undefined): boolean {
  return !!type && !(type in ACTIVITY_TYPES) && !KNOWN_OTHER.has(type);
}

function arr(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "number") && v.length ? (v as number[]) : null;
}

function zoneSeconds(a: RawActivity): ZoneSeconds {
  const power = Array.isArray(a.icu_zone_times)
    ? a.icu_zone_times.filter((z) => /^Z\d$/.test(z.id)).sort((x, y) => x.id.localeCompare(y.id)).map((z) => z.secs)
    : null;
  return {
    power: power && power.length ? power : null,
    hr: arr(a.icu_hr_zone_times),
    pace: a.use_gap_zone_times && arr(a.gap_zone_times) ? arr(a.gap_zone_times) : arr(a.pace_zone_times)
  };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const SENSOR_RANK = (a: NormalizedActivity) => (a.sensors.power ? 4 : 0) + (a.sensors.pace ? 2 : 0) + (a.sensors.hr ? 1 : 0);

function startMs(a: NormalizedActivity): number {
  return Date.parse(a.start_utc ?? a.start_local + "Z");
}

export function normalizeActivity(a: RawActivity): NormalizedActivity {
  const startLocal = a.start_date_local ?? "";
  const minutes = num(a.moving_time) ? (a.moving_time as number) / 60 : 0;
  const unavailable = !!a._note || (a.source === "STRAVA" && !minutes) || !minutes;
  const zones = zoneSeconds(a);
  return {
    id: String(a.id ?? ""),
    date: startLocal.slice(0, 10),
    start_local: startLocal,
    start_utc: a.start_date ?? null,
    source: a.source ?? "",
    provider_type: a.type ?? "",
    discipline: disciplineOfType(a.type),
    minutes: Math.round(minutes * 10) / 10,
    meters: num(a.distance),
    elevation_m: num(a.total_elevation_gain),
    zone_seconds: zones,
    load: num(a.icu_training_load),
    rpe: num(a.icu_rpe),
    feel: num(a.feel),
    session_rpe: num(a.session_rpe),
    sensors: { hr: !!a.has_heartrate || !!zones.hr, power: a.device_watts === true, pace: !!zones.pace },
    paired_event_id: num(a.paired_event_id),
    ftp: num(a.icu_ftp),
    lthr: num(a.lthr),
    name: (a.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    status: unavailable ? "unavailable" : "ok"
  };
}

/**
 * Attivita' del periodo normalizzate e ordinate per inizio. Due attivita' della stessa disciplina
 * iniziate a meno di 5 minuti di distanza e con durate entro il 10% sono un doppione (orologio e
 * app che caricano la stessa uscita): resta quella con piu' sensori, a parita' quella con id minore.
 */
export function normalizeActivities(raw: RawActivity[], period: { start: string; end: string }): NormalizedActivity[] {
  const list = raw
    .map(normalizeActivity)
    .filter((a) => a.id && a.date >= period.start && a.date <= period.end)
    .sort((x, y) => x.start_local.localeCompare(y.start_local) || x.id.localeCompare(y.id));
  const ok = list.filter((a) => a.status === "ok");
  for (let i = 0; i < ok.length; i++) {
    const a = ok[i];
    if (a.status !== "ok") continue;
    for (let j = i + 1; j < ok.length; j++) {
      const b = ok[j];
      if (b.status !== "ok" || b.discipline !== a.discipline) continue;
      const startGap = Math.abs(startMs(a) - startMs(b)) / 60000;
      if (!(startGap <= 5)) continue;
      const longer = Math.max(a.minutes, b.minutes);
      if (longer <= 0 || Math.abs(a.minutes - b.minutes) / longer > 0.1) continue;
      const keepA = SENSOR_RANK(a) > SENSOR_RANK(b) || (SENSOR_RANK(a) === SENSOR_RANK(b) && a.id.localeCompare(b.id) <= 0);
      const [keep, drop] = keepA ? [a, b] : [b, a];
      drop.status = "duplicate";
      drop.duplicate_of = keep.id;
      if (!keepA) break;
    }
  }
  return list;
}
