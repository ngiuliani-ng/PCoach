import { describe, expect, it } from "vitest";
import { hasNewerRemoteVersion, snapshotForCompare } from "./useDirtyState";
import { blankProfile } from "../constants";

describe("snapshotForCompare", () => {
  it("ignora le differenze nei soli campi meta (athlete_id/created_at/updated_at)", () => {
    const a = blankProfile();
    const b = JSON.parse(JSON.stringify(a));
    b.meta.athlete_id = "XXXXXXXX";
    b.meta.created_at = "2020-01-01";
    b.meta.updated_at = "2020-01-02";
    expect(snapshotForCompare(a)).toBe(snapshotForCompare(b));
  });

  it("rileva una modifica reale ai dati dell'atleta", () => {
    const a = blankProfile();
    const b = JSON.parse(JSON.stringify(a));
    b.identity.name = "Mario Rossi";
    expect(snapshotForCompare(a)).not.toBe(snapshotForCompare(b));
  });

  it("ignora le voci di load_metrics_log sincronizzate da Intervals.icu", () => {
    const a = blankProfile();
    a.training_status.load_metrics_log = [{ date: "2026-01-01", source: "manual" }];
    const b = JSON.parse(JSON.stringify(a));
    b.training_status.load_metrics_log.push({
      date: "2026-01-02",
      source: "intervals_icu_sync",
      ctl: 42
    });
    expect(snapshotForCompare(a)).toBe(snapshotForCompare(b));
  });

  it("non ignora le voci di load_metrics_log inserite manualmente", () => {
    const a = blankProfile();
    a.training_status.load_metrics_log = [{ date: "2026-01-01", source: "manual" }];
    const b = JSON.parse(JSON.stringify(a));
    b.training_status.load_metrics_log.push({ date: "2026-01-02", source: "manual" });
    expect(snapshotForCompare(a)).not.toBe(snapshotForCompare(b));
  });
});

describe("hasNewerRemoteVersion", () => {
  it("e' false se non c'e' una scheda aperta", () => {
    expect(hasNewerRemoteVersion(null, { A: "v2" }, "v1")).toBe(false);
  });

  it("e' false se la scheda aperta non ha ancora una versione nota (es. bozza nuova)", () => {
    expect(hasNewerRemoteVersion("A", { A: "v2" }, null)).toBe(false);
  });

  it("e' false se non si conosce ancora alcuna versione remota per la scheda", () => {
    expect(hasNewerRemoteVersion("A", {}, "v1")).toBe(false);
  });

  it("e' false se la versione remota coincide con quella caricata", () => {
    expect(hasNewerRemoteVersion("A", { A: "v1" }, "v1")).toBe(false);
  });

  it("e' true se la versione remota e' diversa da quella caricata", () => {
    expect(hasNewerRemoteVersion("A", { A: "v2" }, "v1")).toBe(true);
  });
});
