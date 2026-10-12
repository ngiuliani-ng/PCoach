import { describe, expect, it } from "vitest";
import { zoneChangeReason, zoneChanges, zoneChangeWarning } from "./zoneChange";

const p = (run: string, bike: string) => ({ physiological_thresholds: { running: { zone_system: run }, cycling: { zone_system: bike } } });

describe("cambio del sistema di zone", () => {
  it("riconosce le discipline cambiate; un valore assente vale 7 zone", () => {
    expect(zoneChanges(p("7-zone", "7-zone"), p("5-zone", "7-zone"))).toEqual([{ discipline: "running", from: 7, to: 5 }]);
    expect(zoneChanges({}, p("7-zone", "3-zone"))).toEqual([{ discipline: "cycling", from: 7, to: 3 }]);
    expect(zoneChanges(p("5-zone", "5-zone"), p("5-zone", "5-zone"))).toEqual([]);
  });

  it("l'avviso conta le sedute da ricontrollare; nessuna seduta, nessun avviso", () => {
    const run = { discipline: "running" as const, from: 7 as const, to: 5 as const };
    const bike = { discipline: "cycling" as const, from: 5 as const, to: 3 as const };
    expect(zoneChangeWarning([{ change: run, count: 0 }])).toBe("");
    expect(zoneChangeWarning([{ change: run, count: 1 }])).toBe("Se procedi, la seduta di corsa (da 7 a 5 zone) da oggi in poi torna «Da verificare»: dovrai cambiarne a mano le zone per il nuovo sistema.");
    expect(zoneChangeWarning([{ change: run, count: 3 }, { change: bike, count: 2 }])).toContain("le 3 sedute di corsa (da 7 a 5 zone) e le 2 sedute di bici (da 5 a 3 zone) da oggi in poi tornano");
  });

  it("il motivo sulla seduta dice cosa è cambiato e quando", () => {
    expect(zoneChangeReason({ discipline: "cycling", from: 7, to: 3 }, "2026-10-12")).toBe("Il sistema di zone della bici è passato da 7 a 3 zone il 12/10/2026: adatta le zone della seduta.");
  });
});
