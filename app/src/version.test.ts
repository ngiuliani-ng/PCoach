// Coerenza della versione (ADR 0036): package.json, funzioni del server e CHANGELOG dicono la stessa cosa.
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import changelog from "../../CHANGELOG.md?raw";
import { PCOACH_VERSION } from "@shared/version.ts";
import { APP_VERSION, reportLine } from "./version";

/** Voci della sezione `## [version]` del CHANGELOG, escluse quelle di «Interno». */
function coachEntries(version: string, text: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start < 0) return [];
  const entries: string[] = [];
  let internal = false;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (line.startsWith("### ")) internal = line.slice(4).trim() === "Interno";
    else if (!internal && line.startsWith("- ")) entries.push(line);
  }
  return entries;
}

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
    expect(coachEntries(pkg.version, changelog).length).toBeGreaterThan(0);
  });

  it("la riga per una segnalazione non contiene dati sensibili, solo versione, build e browser", () => {
    const line = reportLine("Mozilla/5.0 Test", "1.0.0");
    expect(line).toMatch(/^PCoach \d+\.\d+\.\d+ \(build [^ ]+ del \d{2}\/\d{2}\/\d{4}, server 1\.0\.0\), Mozilla\/5\.0 Test$/);
  });
});
