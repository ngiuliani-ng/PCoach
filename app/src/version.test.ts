// Coerenza della versione (ADR 0036): package.json, funzioni del server e CHANGELOG dicono la stessa cosa.
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import changelog from "../../CHANGELOG.md?raw";
import { PCOACH_VERSION } from "@shared/version.ts";
import { APP_VERSION, releaseNotes, reportLine } from "./version";

describe("versione dell'app", () => {
  it("una versione SemVer, la stessa nell'app e nelle funzioni del server", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).not.toBe("0.0.0");
    expect(PCOACH_VERSION).toBe(pkg.version);
  });

  it("il CHANGELOG ha «Unreleased» in cima e una sezione datata per la versione corrente con almeno una voce per il coach", () => {
    const versions = [...changelog.matchAll(/^## \[([^\]]+)\](.*)$/gm)].map((m) => [m[1], m[2].trim()]);
    expect(versions[0][0]).toBe("Unreleased");
    const current = versions.find(([v]) => v === pkg.version);
    expect(current, `sezione ## [${pkg.version}] nel CHANGELOG`).toBeDefined();
    expect(current![1]).toMatch(/^— \d{4}-\d{2}-\d{2}$/);
    expect(releaseNotes(pkg.version, changelog).flatMap((n) => n.items).length).toBeGreaterThan(0);
    // La build porta nell'app proprio quella sezione.
    expect(releaseNotes(pkg.version)).toEqual(releaseNotes(pkg.version, changelog));
  });

  it("note di rilascio senza «Interno» e senza markdown", () => {
    const text = "## [Unreleased]\n\n## [2.0.0] — 2026-11-01\n\n### Aggiunto\n- **Pagina** `Da fare`, vedi [ADR](x.md)\n\n### Interno\n- Test\n\n## [1.0.0] — 2026-10-13\n- vecchia";
    expect(releaseNotes("2.0.0", text)).toEqual([{ heading: "Aggiunto", items: ["Pagina Da fare, vedi ADR"] }]);
    expect(releaseNotes("3.0.0", text)).toEqual([]);
  });

  it("la riga per una segnalazione non contiene dati sensibili, solo versione, build e browser", () => {
    const line = reportLine("Mozilla/5.0 Test", "1.0.0");
    expect(line).toMatch(/^PCoach \d+\.\d+\.\d+ \(build [^ ]+ del \d{2}\/\d{2}\/\d{4}, server 1\.0\.0\), Mozilla\/5\.0 Test$/);
  });
});
