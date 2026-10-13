// Gli aiuti contestuali restano allineati a schema e prompt: un aiuto che dice «va a Claude» deve
// corrispondere a un dato presente nel contesto, uno che dice «non va a Claude» a un dato assente.
import { describe, expect, it } from "vitest";
import schema from "../schema/athlete_profile.schema.json";
import { FIELD_HELP, type FieldHelp } from "./fieldHelp";
import { blankProfile, todayISO } from "../constants";
import { buildAthleteContextForPrompt } from "../services/planPrompt";
import { GUIDES } from "./guide";

type SchemaNode = { properties?: Record<string, SchemaNode>; items?: SchemaNode };

function schemaHas(path: string): boolean {
  let node: SchemaNode | undefined = schema as SchemaNode;
  for (const part of path.split(".")) {
    const isList = part.endsWith("[]");
    node = node?.properties?.[isList ? part.slice(0, -2) : part];
    if (isList) node = node?.items;
  }
  return !!node;
}

function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

const entries = Object.entries(FIELD_HELP) as [string, FieldHelp][];

describe("aiuti contestuali", () => {
  it("ogni chiave della scheda esiste nello schema", () => {
    const missing = entries.map(([k]) => k).filter((k) => !k.startsWith("settings.") && !k.startsWith("workout.") && !schemaHas(k));
    expect(missing).toEqual([]);
  });

  it("cio' che l'aiuto dice sull'invio a Claude corrisponde al contesto del prompt", () => {
    const profile = blankProfile();
    profile.identity = { ...profile.identity, nome: "Giulia", cognome: "Ferri", email: "giulia@example.test", birth_year: 1990 };
    profile.integrations = { intervals_icu_api_key: "CHIAVE-SEGRETA" };
    profile.notes_free_text = "Nota del coach";
    profile.constraints.sessions_per_week_target = 5;
    profile.training_status.lifestyle_factors = ["viaggia_spesso"];
    profile.goals.target_events = [{ name: "Gara", date: todayISO(), discipline: "running", priority: "A" }];
    profile.physiological_thresholds!.running!.thresholds_log = [{ date: todayISO(), source: "manual", lthr_bpm: 170 }];
    profile.disciplines = [{ sport: "running", level: "intermedio" }];
    const ctx = buildAthleteContextForPrompt(profile);
    const text = JSON.stringify(ctx);

    for (const [key, help] of entries) {
      if (typeof help.claude === "string") expect(at(ctx, help.claude), key).not.toBeUndefined();
    }
    // Campi dichiarati come mai inviati.
    expect(text).not.toContain("giulia@example.test");
    expect(text).not.toContain("CHIAVE-SEGRETA");
    expect(text).not.toContain("Ferri");
    expect(entries.filter(([, h]) => h.claude === false).map(([k]) => k)).toEqual(["identity.email", "integrations.intervals_icu_api_key"]);
  });
});

// Sorgenti dell'interfaccia, per controllare che le etichette citate esistano (audit UX-51).
const SOURCES = Object.values(
  import.meta.glob(["../components/**/*.vue", "../composables/*.ts", "../domain/*.ts", "../stores/*.ts", "../constants.ts"], { query: "?raw", import: "default", eager: true })
) as string[];
// Citazioni che sono esempi o valori calcolati, non etichette dell'interfaccia.
const EXAMPLES = new Set(["uscita in bici col gruppo", "carico 1", "carico 1 di 3", "scarico"]);

describe("guida dei gruppi di dati (D-04)", () => {
  it("ogni voce della guida ha un testo, e ogni testo e' in una guida o nel pannello della seduta", () => {
    const used = new Set<string>(Object.values(GUIDES).flatMap((g) => g.entries.map((e) => e.help)));
    used.add("workout.primary_target");
    expect(entries.map(([k]) => k).filter((k) => !used.has(k))).toEqual([]);
  });

  it("le etichette citate fra «» esistono nell'interfaccia", () => {
    const quoted = entries.flatMap(([, h]) => [...`${h.text} ${h.more ?? ""}`.matchAll(/«([^»]+)»/g)].map((m) => m[1]));
    const missing = quoted.filter((q) => {
      if (EXAMPLES.has(q)) return false;
      // «Porta Intervals.icu a N zone»: N sta per un numero calcolato nel codice.
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped.replace(/\bN\b/g, "(\\$\\{[^}]+\\}|\\d+)"));
      return !SOURCES.some((src) => src.split(`«${q}»`).join("").match(pattern));
    });
    expect(missing).toEqual([]);
  });
});
