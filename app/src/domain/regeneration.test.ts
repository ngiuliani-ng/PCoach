import { describe, expect, it } from "vitest";
import { legacyPlanToImport } from "./legacyImport";
import type { ExistingForRegen } from "./regeneration";
import { buildApplyPayload, diffCounts, parseProposal, regenerationCandidates, regenerationDiff } from "./regeneration";

// Sedute nella forma reale dei piani salvati (schema 1.4.0), con i casi che il database
// contiene davvero: zone in testo libero, giorno incoerente con la data, palestra.
const legacyPlan = {
  plan_name: "Preparazione mezza maratona",
  start_date: "2026-10-05",
  weeks: [
    {
      week_number: 1, week_label: "Base", is_deload: false,
      sessions: [
        { date: "2026-10-05", day: "lunedi", session_type: "Corsa facile", discipline: "running", is_structured: false, target_zone: "Z2 (5:30-6:00/km)", target_duration_min: 45, target_distance_km: null, notes: "Sciolto", steps: [] },
        { date: "2026-10-06", day: "mercoledi", session_type: "Soglia", discipline: "cycling", is_structured: true, target_zone: "", steps: [
          { kind: "warmup", duration_sec: 900, zone: "Z1-Z2 (< 70% FTP)", description: "" },
          { kind: "repeat", repetitions: 3, work: { duration_sec: 600, zone: "Z4", description: "" }, recovery: { duration_sec: 300, zone: "Z1", description: "" } },
          { kind: "cooldown", duration_sec: 600, zone: "Recovery", description: "" }
        ] },
        { date: "2026-10-07", day: "mercoledi", session_type: "Fartlek", discipline: "running", is_structured: false, target_zone: "Alta", target_duration_min: 40 },
        { date: "2026-10-09", day: "venerdi", session_type: "Forza", discipline: "strength", is_structured: false, target_zone: "Forza massima", target_duration_min: 45, notes: "Squat 5x5" },
        { date: "2026-10-09", day: "venerdi", session_type: "Nuoto", discipline: "swimming", is_structured: false, target_zone: "Z2", target_distance_km: 2 },
        { date: "", discipline: "running" }
      ]
    },
    { week_number: 2, is_deload: true, sessions: [
      { date: "2026-10-12", day: "lunedi", session_type: "", discipline: "running", is_structured: false, target_zone: "Z1", target_duration_min: null, target_distance_km: null }
    ] }
  ]
};

describe("import dei piani esistenti", () => {
  const result = legacyPlanToImport(legacyPlan, true)!;

  it("importa le sedute con data e disciplina valide, approvate", () => {
    expect(result.workouts).toHaveLength(6);
    expect(result.skipped).toBe(1);
    expect(result.workouts.every((w) => w.status === "approved")).toBe(true);
    expect(result.planName).toBe("Preparazione mezza maratona");
    expect(result.startDate).toBe("2026-10-05");
    expect(result.endDate).toBe("2026-10-18");
    expect(result.weeksMeta).toEqual([
      { week_start: "2026-10-05", label: "Base", is_deload: false },
      { week_start: "2026-10-12", label: "Settimana 2", is_deload: true }
    ]);
  });

  it("converte le sedute a blocco unico e quelle strutturate", () => {
    const [run, bike] = result.workouts;
    expect(run.structure?.steps).toEqual([{ kind: "step", role: "steady", duration: { type: "time", seconds: 2700 }, target: { zone: 2 } }]);
    expect(run.primary_target).toBe("pace");
    expect(run.needs_review).toBeNull();
    expect(bike.structure?.steps[1]).toMatchObject({ kind: "repeat", count: 3, steps: [{ role: "work", target: { zone: 4 } }, { role: "recovery", target: { zone: 1 } }] });
    expect(bike.structure?.steps[2]).toMatchObject({ role: "cooldown", target: { zone: 1 } });
    expect(bike.primary_target).toBe("power");
  });

  it("giorno incoerente con la data: vale il giorno, con una nota (caso reale: date di Claude sfalsate di +1)", () => {
    // 2026-10-06 e' un martedi', il piano diceva mercoledi.
    expect(result.workouts[1].planned_date).toBe("2026-10-07");
    expect(result.workouts[1].change_note).toMatch(/indicava mercoledì ma la data era del martedì/);
    expect(result.workouts[0].change_note).toBeNull();
    // Il fartlek dello stesso giorno diventa la seconda seduta.
    expect(result.workouts[2]).toMatchObject({ planned_date: "2026-10-07", slot: 1 });
  });

  it("marca da verificare i target non riconoscibili e le durate mancanti", () => {
    expect(result.workouts[2].needs_review).toMatch(/«Alta» non riconosciuto/);
    expect(result.workouts[5].needs_review).toMatch(/step/);
  });

  it("palestra: obiettivo dal testo della zona, nessuna struttura; due sedute nello stesso giorno in slot diversi", () => {
    const [strength, swim] = [result.workouts[3], result.workouts[4]];
    expect(strength).toMatchObject({ structure: null, duration_min: 45, objective: "Forza massima", primary_target: "none", slot: 0 });
    expect(swim).toMatchObject({ slot: 1 });
    expect(swim.structure?.steps[0]).toMatchObject({ duration: { type: "distance", meters: 2000 } });
  });

  it("bici senza FTP in frequenza cardiaca", () => {
    expect(legacyPlanToImport(legacyPlan, false)!.workouts[1].primary_target).toBe("hr");
  });
});

describe("proposta di Claude", () => {
  const raw = {
    plan_name: "Ripresa",
    weeks: [{ week_start: "2026-10-14", label: "Ripresa", is_deload: false }],
    workouts: [
      { date: "2026-10-13", discipline: "running", title: "Prima della data", steps: [] },
      { date: "2026-10-14", discipline: "running", title: "Corsa facile", objective: "Riattivare", steps: [{ kind: "step", role: "steady", duration_sec: 2100, zone: "Z2" }] },
      { date: "2026-10-15", discipline: "cycling", title: "Ripetute", steps: [
        { kind: "repeat", count: 4, label: "Serie", steps: [{ kind: "step", role: "work", duration_sec: 240, zone: "Z5" }, { kind: "step", role: "recovery", duration_sec: 240, zone: "Z1" }] }
      ] },
      { date: "2026-10-16", discipline: "strength", title: "Stabilità", duration_min: 40 },
      { date: "2026-10-30", discipline: "running", title: "Oltre la fine" },
      { date: "2026-10-17", discipline: "yoga", title: "Disciplina non gestita" }
    ]
  };

  it("tiene solo il periodo richiesto, in bozza, con la metrica per disciplina", () => {
    const p = parseProposal(raw, { fromDate: "2026-10-14", weeks: 2, hasFtp: false });
    if ("error" in p) throw new Error(p.error);
    expect(p.workouts.map((w) => w.title)).toEqual(["Corsa facile", "Ripetute", "Stabilità"]);
    expect(p.workouts.every((w) => w.status === "draft")).toBe(true);
    expect(p.workouts[1].primary_target).toBe("hr");
    expect(p.workouts[1].structure?.steps[0]).toMatchObject({ kind: "repeat", count: 4 });
    expect(p.workouts[2]).toMatchObject({ structure: null, duration_min: 40 });
    expect(p.weeksMeta[0].week_start).toBe("2026-10-12");
    expect(p.warnings).toHaveLength(2);
  });

  it("rifiuta una risposta senza elenco di sedute", () => {
    expect(parseProposal({ weeks: [] }, { fromDate: "2026-10-14", weeks: 1, hasFtp: true })).toHaveProperty("error");
  });
});

describe("rigenerazione da una data", () => {
  const ex = (id: string, date: string, over: Partial<ExistingForRegen> = {}): ExistingForRegen => ({
    id, planned_date: date, slot: 0, status: "approved", revision: 1, discipline: "running", title: id, locked: false, completed_at: null, ...over
  });
  const existing = [
    ex("passata", "2026-10-10"),
    ex("svolta", "2026-10-12", { completed_at: "2026-10-12T07:00:00Z" }),
    ex("bloccata", "2026-10-13", { locked: true }),
    ex("da-sostituire", "2026-10-14", { discipline: "cycling" }),
    ex("da-togliere", "2026-10-16"),
    ex("annullata", "2026-10-15", { status: "cancelled" })
  ];
  const proposal = parseProposal({
    workouts: [
      { date: "2026-10-12", discipline: "cycling", title: "Nuova del 12", steps: [{ kind: "step", duration_sec: 1800, zone: "Z2" }] },
      { date: "2026-10-14", discipline: "cycling", title: "Nuova del 14", steps: [{ kind: "step", duration_sec: 1800, zone: "Z2" }] },
      { date: "2026-10-15", discipline: "running", title: "Nuova del 15", steps: [{ kind: "step", duration_sec: 1800, zone: "Z2" }] }
    ]
  }, { fromDate: "2026-10-12", weeks: 1, hasFtp: true });
  if ("error" in proposal) throw new Error(proposal.error);

  it("non tocca nulla prima della data e ignora le sedute non attive", () => {
    expect(regenerationCandidates(existing, "2026-10-12").map((w) => w.id)).toEqual(["svolta", "bloccata", "da-sostituire", "da-togliere"]);
  });

  it("mantiene svolte e scelte del coach, sostituisce, aggiunge e toglie il resto", () => {
    const cands = regenerationCandidates(existing, "2026-10-12");
    const diff = regenerationDiff(cands, new Set(["bloccata"]), proposal.workouts);
    expect(diffCounts(diff)).toEqual({ keep: 2, replace: 1, add: 2, remove: 1 });
    const day14 = diff.find((d) => d.date === "2026-10-14")!;
    expect(day14.items[0]).toMatchObject({ kind: "replace", old: { id: "da-sostituire" } });
  });

  it("la svolta resta anche se il coach non la seleziona", () => {
    const cands = regenerationCandidates(existing, "2026-10-12");
    const diff = regenerationDiff(cands, new Set(), proposal.workouts);
    expect(diff.flatMap((d) => d.items).filter((i) => i.kind === "keep").map((i) => (i as { old: { id: string } }).old.id)).toEqual(["svolta"]);
  });

  it("costruisce il payload transazionale senza slot duplicati", () => {
    const cands = regenerationCandidates(existing, "2026-10-12");
    const diff = regenerationDiff(cands, new Set(["bloccata"]), proposal.workouts);
    const payload = buildApplyPayload({ generationId: "g1", athleteId: "A1", fromDate: "2026-10-12", weeks: 1, proposal, diff });
    expect(payload.keep.map((k) => k.id).sort()).toEqual(["bloccata", "svolta"]);
    expect(payload.supersede.map((k) => k.id).sort()).toEqual(["da-sostituire", "da-togliere"]);
    const day12 = payload.insert.find((i) => i.planned_date === "2026-10-12")!;
    expect(day12.slot).toBe(1); // lo slot 0 e' della seduta svolta mantenuta
    expect(payload.insert.find((i) => i.planned_date === "2026-10-14")).toMatchObject({ slot: 0, replaces: "da-sostituire" });
    expect(payload.plan).toMatchObject({ start_date: "2026-10-12", end_date: "2026-10-18" });
    expect(payload.insert[0]).not.toHaveProperty("legacy");
  });
});
