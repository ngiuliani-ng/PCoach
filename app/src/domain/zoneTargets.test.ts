// Test della traduzione delle zone in watt e passo (ADR 0047).
import { describe, expect, it } from "vitest";
import { defaultZoneModels } from "@shared/workouts/zoneModels.ts";
import { missingScaleNote, targetRange, thresholdLabel, zoneScalesOf } from "./zoneTargets";

const thresholds = (opts: { run?: string; runSystem?: string; ftp?: number; css?: string }) => ({
  running: { zone_system: opts.runSystem ?? "7-zone", thresholds_log: opts.run ? [{ date: "2026-01-01", threshold_pace_per_km: "9:00" }, { date: "2026-09-30", threshold_pace_per_km: opts.run }] : [] },
  cycling: { zone_system: "7-zone", thresholds_log: opts.ftp ? [{ date: "2026-09-01", ftp_watts: opts.ftp }] : [] },
  swimming: { thresholds_log: opts.css ? [{ date: "2026-10-04", css_pace_per_100m: opts.css }] : [] }
});
const models = defaultZoneModels();

describe("zone in watt (bici, Coggan 7, FTP 250)", () => {
  const scales = zoneScalesOf(thresholds({ ftp: 250 }), models);

  it("zone intermedie fra i loro limiti; Z1 da zero, l'ultima aperta", () => {
    expect(targetRange({ zone: 2 }, "cycling", "power", scales)).toBe("138–188 W");
    expect(targetRange({ zone: 4 }, "cycling", "power", scales)).toBe("225–263 W");
    expect(targetRange({ zone: 1 }, "cycling", "power", scales)).toBe("fino a 138 W");
    expect(targetRange({ zone: 7 }, "cycling", "power", scales)).toBe("oltre 375 W");
  });

  it("un intervallo va dal limite inferiore della prima zona al superiore dell'ultima", () => {
    expect(targetRange({ zone: 2, zone_to: 3 }, "cycling", "power", scales)).toBe("138–225 W");
  });

  it("la soglia di riferimento", () => {
    expect(thresholdLabel("cycling", "power", scales)).toBe("FTP 250 W");
  });
});

describe("zone in passo", () => {
  it("corsa, Friel 5, soglia 4:00/km: dal più lento al più veloce", () => {
    const scales = zoneScalesOf(thresholds({ run: "4:00", runSystem: "5-zone" }), models);
    expect(targetRange({ zone: 2 }, "running", "pace", scales)).toBe("5:10–4:34 /km");
    expect(targetRange({ zone: 4 }, "running", "pace", scales)).toBe("4:15–4:00 /km");
    expect(targetRange({ zone: 1 }, "running", "pace", scales)).toBe("più lento di 5:10 /km");
    expect(targetRange({ zone: 5 }, "running", "pace", scales)).toBe("più veloce di 4:00 /km");
    expect(thresholdLabel("running", "pace", scales)).toBe("Soglia 4:00 /km");
  });

  it("nuoto, CSS 2:00/100 m", () => {
    const scales = zoneScalesOf(thresholds({ css: "2:00" }), models);
    expect(targetRange({ zone: 4 }, "swimming", "pace", scales)).toBe("2:07–2:00 /100 m");
    expect(thresholdLabel("swimming", "pace", scales)).toBe("CSS 2:00 /100 m");
  });
});

describe("storico delle soglie: vale la rilevazione del giorno della seduta", () => {
  const t = {
    cycling: { zone_system: "7-zone", thresholds_log: [
      { date: "2026-09-01", ftp_watts: 230 },
      { date: "2026-11-15", ftp_watts: 250 },
      { date: "2026-06-01", ftp_watts: 210 }
    ] },
    running: { zone_system: "7-zone", thresholds_log: [{ date: "2026-09-01", threshold_pace_per_km: "4:46" }] }
  };
  const ftpAt = (day?: string | null) => zoneScalesOf(t, models, day).cycling?.threshold;

  it("l'ultima rilevazione con data uguale o precedente, in qualunque ordine sia lo storico", () => {
    expect(ftpAt("2026-10-13")).toBe(230);
    expect(ftpAt("2026-11-15")).toBe(250);
    expect(ftpAt("2026-11-14")).toBe(230);
    expect(ftpAt("2026-07-10")).toBe(210);
    expect(zoneScalesOf(t, models, "2026-10-13").cycling?.since).toBe("2026-09-01");
  });

  it("dopo l'ultima rilevazione o senza giorno vale la soglia corrente; prima della prima, la prima", () => {
    expect(ftpAt("2027-01-01")).toBe(250);
    expect(ftpAt(null)).toBe(250);
    expect(ftpAt("2026-01-01")).toBe(210);
  });

  it("i watt di una seduta passata non cambiano con una soglia nuova", () => {
    const old = zoneScalesOf(t, models, "2026-10-13");
    const next = zoneScalesOf(t, models, "2026-11-20");
    expect(targetRange({ zone: 4 }, "cycling", "power", old)).toBe("207–242 W");
    expect(targetRange({ zone: 4 }, "cycling", "power", next)).toBe("225–263 W");
  });
});

describe("senza traduzione", () => {
  it("FC, palestra, nessun target o soglia mancante: null", () => {
    const scales = zoneScalesOf(thresholds({ ftp: 250, run: "4:00" }), models);
    expect(targetRange({ zone: 2 }, "cycling", "hr", scales)).toBeNull();
    expect(targetRange({ zone: 2 }, "strength", "none", scales)).toBeNull();
    expect(targetRange(null, "running", "pace", scales)).toBeNull();
    expect(targetRange({ zone: 2 }, "swimming", "pace", scales)).toBeNull();
    expect(thresholdLabel("cycling", "hr", scales)).toBeNull();
  });

  it("la nota compare solo quando manca la soglia di una metrica traducibile", () => {
    const scales = zoneScalesOf(thresholds({}), models);
    expect(missingScaleNote("cycling", "power", scales)).toBe("Senza FTP nella scheda: solo zone.");
    expect(missingScaleNote("running", "pace", scales)).toBe("Senza passo di soglia nella scheda: solo zone.");
    expect(missingScaleNote("cycling", "hr", scales)).toBeNull();
    expect(missingScaleNote("cycling", "power", zoneScalesOf(thresholds({ ftp: 250 }), models))).toBeNull();
  });
});
