import { describe, expect, it } from "vitest";
import { RESYNC_DAYS, syncWindowStart } from "./intervals";

describe("finestra di sincronizzazione del carico", () => {
  it("rilegge sempre gli ultimi giorni, anche se gia' nel log (attivita' caricate in ritardo)", () => {
    const log = [{ date: "2026-10-10", source: "intervals_icu_sync" as const, ctl: 50, atl: 60 }];
    expect(syncWindowStart(log, "2026-10-11")).toBe("2026-09-28");
    expect(RESYNC_DAYS).toBe(14);
  });

  it("riparte dal giorno dopo l'ultima voce se il log e' piu' vecchio", () => {
    expect(syncWindowStart([{ date: "2026-09-01", source: "manual" as const }], "2026-10-11")).toBe("2026-09-02");
  });

  it("senza log legge gli ultimi 30 giorni", () => {
    expect(syncWindowStart([], "2026-10-11")).toBe("2026-09-11");
  });
});
