// Controllo periodico su Intervals.icu (ADR 0037): risultato salvato e unione del carico, condivisi
// fra la Edge Function athlete-checks, intervals-sync e l'app.
import { describe, expect, it } from "vitest";
import { athleteCheck, pickZones } from "@shared/workouts/athleteChecks.ts";
import { mergeLoadMetrics, syncWindowStart } from "@shared/workouts/loadMetrics.ts";

const now = new Date("2026-10-10T08:20:00Z");
const profile = {
  disciplines: [{ sport: "running" }],
  physiological_thresholds: { running: { zone_system: "5-zone", thresholds_log: [{ date: "2026-09-01", threshold_pace_per_km: "4:46" }] } }
};
const run = { id: 12, types: ["Run"], ftp: null, lthr: 170, max_hr: 190, threshold_pace: 3.5, power_zones: null, hr_zones: null, pace_zones: [77.5, 87.7, 94.3, 100, 103.4, 111.5, 999], extra: "x" };

describe("controllo di un atleta su Intervals.icu", () => {
  it("chiave assente, non valida o Intervals.icu non raggiungibile", () => {
    expect(athleteCheck("A", profile as never, false, null, null, now).key_status).toBe("none");
    expect(athleteCheck("A", profile as never, true, null, 401, now).key_status).toBe("invalid");
    expect(athleteCheck("A", profile as never, true, null, 0, now)).toEqual({
      athlete_id: "A", checked_at: "2026-10-10T08:20:00.000Z", key_status: "unreachable", zone_problems: [], threshold_problems: []
    });
  });

  it("zone diverse dalla scheda, soglie allineate", () => {
    const sports = pickZones([run]);
    expect(Object.keys(sports[0])).not.toContain("extra");
    const check = athleteCheck("A", profile as never, true, sports, null, now);
    expect(check.key_status).toBe("valid");
    expect(check.zone_problems).toHaveLength(1);
    expect(check.zone_problems[0]).toContain("5 zone in PCoach, 7 su Intervals.icu");
    expect(check.threshold_problems).toEqual([]);
  });
});

describe("unione del carico", () => {
  it("aggiorna i giorni cambiati, non tocca quelli manuali, conta le attività", () => {
    const log = [
      { date: "2026-10-08", source: "intervals_icu_sync", ctl: 40, atl: 45, tsb: -5, workouts_count: 1 },
      { date: "2026-10-09", source: "manual", ctl: 1, atl: 1, tsb: 0 }
    ];
    const merged = mergeLoadMetrics(log, [
      { id: "2026-10-08", ctl: 40, atl: 45 },
      { id: "2026-10-09", ctl: 41, atl: 50 },
      { id: "2026-10-10", ctl: 42, atl: 47.5 }
    ], [{ start_date_local: "2026-10-08T07:00:00" }, { start_date_local: "2026-10-10T07:00:00" }, { start_date_local: "2026-10-10T18:00:00" }]);
    expect(merged.updatedCount).toBe(1);
    expect(merged.log.map((e) => e.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(merged.log[1].source).toBe("manual");
    expect(merged.log[2]).toMatchObject({ ctl: 42, atl: 47.5, tsb: -5.5, workouts_count: 2 });
    expect(syncWindowStart(merged.log, "2026-10-10")).toBe("2026-09-27");
  });
});
