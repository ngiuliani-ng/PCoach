// Test del confronto delle zone con Intervals.icu e dei modelli per allinearle (ADR 0029).
import { describe, expect, it } from "vitest";
import {
  boundsError, defaultZoneModels, icuZonesUpdate, resolveZoneModels, zoneChecks, zoneModelsErrors, type IcuSportSettings
} from "@shared/workouts/zoneModels.ts";

// Zone predefinite di Intervals.icu, come lette da un account reale il 2026-10-12.
const RIDE: IcuSportSettings = { id: 1, types: ["Ride", "VirtualRide"], ftp: 273, lthr: 177, max_hr: 195, power_zones: [55, 75, 90, 105, 120, 150, 999], hr_zones: [142, 157, 164, 176, 181, 186, 195], pace_zones: null };
const RUN: IcuSportSettings = { id: 2, types: ["Run", "TrailRun"], lthr: 177, max_hr: 195, threshold_pace: 3.56, power_zones: null, hr_zones: [149, 157, 166, 176, 181, 186, 195], pace_zones: [77.5, 87.7, 94.3, 100, 103.4, 111.5, 999] };
const SWIM: IcuSportSettings = { id: 3, types: ["Swim"], pace_zones: [77.5, 87.7, 94.3, 100, 103.4, 111.5, 999] };

const profile = (run = "7-zone", bike = "7-zone", sports = ["running", "cycling"]) => ({
  disciplines: sports.map((sport) => ({ sport })),
  physiological_thresholds: { running: { zone_system: run }, cycling: { zone_system: bike } }
});

describe("modelli di zone", () => {
  it("i predefiniti sono i modelli più usati: Coggan per la potenza, Friel per FC e passo", () => {
    const m = defaultZoneModels();
    expect(m.cycling_power[7]).toEqual({ preset: "coggan7", bounds: [55, 75, 90, 105, 120, 150] });
    expect(m.cycling_power[3]).toEqual({ preset: "seiler3", bounds: [75, 100] });
    expect(m.cycling_hr[5]).toEqual({ preset: "friel5", bounds: [81, 89, 93, 99] });
    expect(m.running_pace[7]?.bounds).toEqual([77.5, 87.7, 94.3, 100, 103.4, 111.5]);
    expect(Object.keys(m.swimming_pace)).toEqual(["7"]);
    expect(zoneModelsErrors(m)).toEqual({});
  });

  it("i limiti sono n-1 valori crescenti nell'intervallo della misura", () => {
    expect(boundsError("cycling_power", 3, [75, 100])).toBeNull();
    expect(boundsError("cycling_power", 3, [75])).toMatch(/Servono 2 valori/);
    expect(boundsError("cycling_power", 3, [100, 75])).toMatch(/crescere/);
    expect(boundsError("cycling_hr", 3, [20, 99])).toMatch(/da 40 a 130/);
  });

  it("un modello salvato non valido torna al predefinito, uno valido resta", () => {
    const m = resolveZoneModels({ cycling_power: { 3: { preset: "custom", bounds: [70, 98] }, 5: { preset: "x", bounds: [1] } } });
    expect(m.cycling_power[3]).toEqual({ preset: "custom", bounds: [70, 98] });
    expect(m.cycling_power[5]?.preset).toBe("coggan5");
  });
});

describe("confronto con Intervals.icu", () => {
  it("zone uguali: nessuna differenza", () => {
    expect(zoneChecks(profile(), true, [RIDE, RUN]).every((c) => c.aligned)).toBe(true);
  });

  it("corsa a 5 zone in PCoach e 7 su Intervals.icu: si può allineare in entrambi i sensi", () => {
    const run = zoneChecks(profile("5-zone"), true, [RIDE, RUN]).find((c) => c.discipline === "running")!;
    expect(run).toMatchObject({ key: "running_pace", pcoach: 5, intervals: 7, aligned: false, canUseIntervals: true, intervalsBlocked: null });
  });

  it("la bici senza FTP si confronta sulle zone di FC", () => {
    const bike = zoneChecks(profile(), false, [{ ...RIDE, hr_zones: [140, 155, 170, 195] }, RUN]).find((c) => c.discipline === "cycling")!;
    expect(bike).toMatchObject({ key: "cycling_hr", intervals: 4, aligned: false, canUseIntervals: false });
  });

  it("il nuoto resta a 7 zone in PCoach: si può solo allineare Intervals.icu", () => {
    const swim = zoneChecks(profile("7-zone", "7-zone", ["swimming"]), true, [{ ...SWIM, pace_zones: [80, 100, 999] }])[0];
    expect(swim).toMatchObject({ pcoach: 7, intervals: 3, canUseIntervals: false, intervalsBlocked: null });
  });

  it("uno sport senza impostazioni su Intervals.icu non si può allineare da PCoach", () => {
    const swim = zoneChecks(profile("7-zone", "7-zone", ["swimming"]), true, [RIDE])[0];
    expect(swim.intervals).toBeNull();
    expect(swim.intervalsBlocked).toMatch(/non ci sono impostazioni per nuoto/);
  });

  it("si confrontano solo le discipline praticate dall'atleta", () => {
    expect(zoneChecks(profile("7-zone", "7-zone", ["running"]), true, [RIDE, RUN]).map((c) => c.discipline)).toEqual(["running"]);
  });
});

describe("scrittura su Intervals.icu", () => {
  const models = defaultZoneModels();

  it("potenza e passo in percentuale, con l'ultima zona aperta (999)", () => {
    const power = icuZonesUpdate("cycling_power", 3, models, RIDE);
    expect(power).toMatchObject({ ok: true, body: { power_zones: [75, 100, 999], power_zone_names: ["Sotto LT1", "Fra LT1 e LT2", "Sopra LT2"] } });
    const pace = icuZonesUpdate("running_pace", 5, models, RUN);
    expect(pace).toMatchObject({ ok: true, body: { pace_zones: [77.5, 87.7, 94.3, 100, 999] } });
  });

  it("la FC in bpm dalla soglia di Intervals.icu, con l'ultima zona fino alla FC massima", () => {
    const hr = icuZonesUpdate("cycling_hr", 5, models, RIDE);
    expect(hr).toMatchObject({ ok: true, body: { hr_zones: [143, 158, 165, 175, 195], lthr: 177, max_hr: 195 } });
  });

  it("senza FC di soglia o massima la FC non si scrive", () => {
    expect(icuZonesUpdate("cycling_hr", 5, models, { ...RIDE, lthr: null })).toMatchObject({ ok: false });
  });

  it("un modello personalizzato usa nomi generici", () => {
    const custom = { ...models, cycling_power: { ...models.cycling_power, 3: { preset: "custom", bounds: [70, 95] } } };
    expect(icuZonesUpdate("cycling_power", 3, custom, RIDE)).toMatchObject({ ok: true, body: { power_zone_names: ["Zona 1", "Zona 2", "Zona 3"] } });
  });
});
