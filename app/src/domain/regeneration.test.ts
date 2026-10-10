import { describe, expect, it } from "vitest";
import type { ExistingForRegen } from "./regeneration";
import { buildApplyPayload, diffCounts, parseProposal, regenerationCandidates, regenerationDiff } from "./regeneration";

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
  });
});
