// Test delle soglie della scheda (ADR 0030): stima della durata degli step a distanza dal passo
// della zona, confronto con Intervals.icu e soglie mancanti.
import { describe, expect, it } from "vitest";
import {
  currentThresholds, distanceSeconds, missingThresholds, paceContextOf, parsePace, thresholdChecks, zoneSpeedPct
} from "@shared/workouts/thresholds.ts";
import { defaultZoneModels, type IcuSportSettings } from "@shared/workouts/zoneModels.ts";
import { workoutTotals, type WorkoutContent } from "@shared/workouts/structure.ts";

const FRIEL7 = [77.5, 87.7, 94.3, 100, 103.4, 111.5];
const RUN: IcuSportSettings = { id: 2, types: ["Run"], threshold_pace: 1000 / 240 };
const RIDE: IcuSportSettings = { id: 1, types: ["Ride"], ftp: 250 };
const SWIM: IcuSportSettings = { id: 3, types: ["Swim"], threshold_pace: 100 / 120 };

const thresholds = (run?: string, css?: string, ftp?: number) => ({
  running: { zone_system: "7-zone", thresholds_log: run ? [{ date: "2026-01-01", threshold_pace_per_km: "9:00" }, { date: "2026-09-30", threshold_pace_per_km: run }] : [] },
  cycling: { zone_system: "7-zone", thresholds_log: ftp ? [{ date: "2026-09-01", ftp_watts: ftp }] : [] },
  swimming: { thresholds_log: css ? [{ date: "2026-10-04", css_pace_per_100m: css }] : [] }
});
const profile = (sports: string[], t = thresholds("4:00", "2:00", 250)) => ({ disciplines: sports.map((sport) => ({ sport })), physiological_thresholds: t });

describe("soglie della scheda", () => {
  it("il valore corrente è l'ultima rilevazione per data", () => {
    expect(currentThresholds(thresholds("4:00", "1:45", 260))).toEqual({ runningPace: 240, swimmingCss: 105, cyclingFtp: 260 });
    expect(parsePace("4:5")).toBeNull();
    expect(parsePace("")).toBeNull();
  });
});

describe("stima della durata degli step a distanza", () => {
  it("zone intermedie al centro; Z1 (da 0) e l'ultima (tutto sopra) al loro unico limite", () => {
    expect(zoneSpeedPct(FRIEL7, 4)).toBeCloseTo((94.3 + 100) / 2);
    expect(zoneSpeedPct(FRIEL7, 1)).toBe(77.5);
    expect(zoneSpeedPct(FRIEL7, 7)).toBe(111.5);
    expect(zoneSpeedPct([87.7, 100], 3)).toBe(100);
  });

  it("un intervallo di zone vale la media fra la zona più bassa e la più alta", () => {
    expect(zoneSpeedPct(FRIEL7, 3, 4)).toBeCloseTo(((87.7 + 94.3) / 2 + (94.3 + 100) / 2) / 2);
    expect(zoneSpeedPct(FRIEL7, 1, 2)).toBeCloseTo((77.5 + (77.5 + 87.7) / 2) / 2);
  });

  it("800 m in Z6 con soglia 4:00/km: circa 3', come le ripetute di Tullio", () => {
    const scale = paceContextOf(thresholds("4:00"), defaultZoneModels()).running!;
    const sec = distanceSeconds(800, { zone: 6 }, scale)!;
    expect(sec).toBeGreaterThan(165);
    expect(sec).toBeLessThan(180);
  });

  it("con la soglia la seduta 8x800 sta nei 60', senza resta la stima fissa a 5:30/km", () => {
    const w: Pick<WorkoutContent, "discipline" | "duration_min" | "structure"> = {
      discipline: "running", duration_min: null,
      structure: { version: 2, steps: [
        { kind: "step", role: "warmup", duration: { type: "time", seconds: 600 }, target: { zone: 1 } },
        { kind: "repeat", count: 8, steps: [
          { kind: "step", role: "work", duration: { type: "distance", meters: 800 }, target: { zone: 6 } },
          { kind: "step", role: "recovery", duration: { type: "time", seconds: 90 }, target: { zone: 1 } }
        ] },
        { kind: "step", role: "cooldown", duration: { type: "time", seconds: 600 }, target: { zone: 1 } }
      ] }
    };
    const pace = paceContextOf(thresholds("4:00"), defaultZoneModels());
    expect(Math.round(workoutTotals(w, pace).seconds / 60)).toBe(56);
    expect(Math.round(workoutTotals(w).seconds / 60)).toBe(67);
  });

  it("il nuoto usa la CSS sui 100 m; senza soglia la disciplina resta fuori", () => {
    const pace = paceContextOf(thresholds(undefined, "2:00"), defaultZoneModels());
    expect(pace.running).toBeUndefined();
    expect(distanceSeconds(100, { zone: 4 }, pace.swimming)).toBeCloseTo(12000 / ((94.3 + 100) / 2));
    expect(distanceSeconds(100, { zone: 1 }, pace.swimming)).toBeCloseTo(12000 / 77.5);
  });
});

describe("confronto con Intervals.icu", () => {
  it("passo e CSS in m/s su Intervals.icu, FTP in watt: allineati entro 1 s o 1 W", () => {
    const checks = thresholdChecks(profile(["running", "cycling", "swimming"]), [RUN, RIDE, SWIM]);
    expect(checks.map((c) => [c.discipline, c.aligned])).toEqual([["cycling", true], ["running", true], ["swimming", true]]);
    const off = thresholdChecks(profile(["running"]), [{ ...RUN, threshold_pace: 1000 / 242 }])[0];
    expect(off.aligned).toBe(false);
    expect(off.format(off.intervals!)).toBe("4:02/km");
    expect(off.body).toEqual({ threshold_pace: 4.1667 });
    expect(thresholdChecks(profile(["running"]), [{ ...RUN, threshold_pace: 1000 / 240.6 }])[0].aligned).toBe(true);
  });

  it("una soglia assente su Intervals.icu va aggiornata; una assente in PCoach non si confronta", () => {
    expect(thresholdChecks(profile(["cycling"]), [{ ...RIDE, ftp: null }])[0]).toMatchObject({ aligned: false, intervals: null, body: { ftp: 250 } });
    expect(thresholdChecks(profile(["running"], thresholds()), [RUN])[0]).toMatchObject({ aligned: true, pcoach: null });
    // Bici senza FTP: si prescrive in FC, nessuna soglia della scheda da confrontare.
    expect(thresholdChecks(profile(["cycling"], thresholds("4:00")), [RIDE])).toEqual([]);
  });

  it("solo gli sport praticati con impostazioni su Intervals.icu", () => {
    expect(thresholdChecks(profile(["running"]), [RIDE])).toEqual([]);
    expect(thresholdChecks(profile(["cycling"]), [RUN, RIDE]).map((c) => c.discipline)).toEqual(["cycling"]);
  });
});

describe("soglie mancanti", () => {
  it("solo per corsa e nuoto praticati; la bici senza FTP va in FC", () => {
    expect(missingThresholds(profile(["running", "cycling", "swimming"], thresholds()))).toEqual(["il passo di soglia della corsa", "la CSS del nuoto"]);
    expect(missingThresholds(profile(["cycling"], thresholds()))).toEqual([]);
    expect(missingThresholds(profile(["running"]))).toEqual([]);
  });
});
