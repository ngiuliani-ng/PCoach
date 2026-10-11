import { describe, expect, it } from "vitest";
import { loadProgressionOf } from "@shared/feedback/params.ts";
import { addDaysISO } from "@shared/workouts/calendar.ts";
import { parseLoadPattern, planWeeks } from "./planWeeks";
import { weeklyIssues } from "./planChecks";
import { parseProposal } from "./regeneration";

const run = (date: string, minutes: number) => ({
  planned_date: date, discipline: "running" as const, duration_min: null,
  structure: { version: 2 as const, steps: [{ kind: "step" as const, role: "steady" as const, duration: { type: "time" as const, seconds: minutes * 60 }, target: { zone: 2 } }] }
});
const week = (monday: string, n: number, minutes: number) => Array.from({ length: n }, (_, i) => run(addDaysISO(monday, i), minutes));

describe("controlli sulle settimane della proposta (D-02)", () => {
  const weeks = planWeeks("2026-10-12", 4, parseLoadPattern("3:1"));
  const progression = loadProgressionOf(null);

  it("nessun avviso per sedute e volumi coerenti con la fase", () => {
    const ws = [...week("2026-10-12", 4, 60), ...week("2026-10-19", 4, 64), ...week("2026-10-26", 4, 70), ...week("2026-11-02", 4, 47)];
    expect(weeklyIssues(weeks, ws, 4, progression)).toEqual([]);
  });

  it("segnala sedute diverse dal previsto e variazioni di volume fuori dalla fase", () => {
    const ws = [...week("2026-10-12", 4, 60), ...week("2026-10-19", 4, 64), ...week("2026-10-26", 4, 90), ...week("2026-11-02", 3, 40)];
    expect(weeklyIssues(weeks, ws, 4, progression)).toEqual([
      "Settimana del 2/11: 3 sedute, l'atleta ne prevede 4.",
      "Settimana del 26/10 (carico 3 di 3): volume +41% rispetto alla precedente, atteso +5-10%.",
      "Settimana del 2/11 (scarico): volume -67% rispetto alla precedente, atteso -33%."
    ]);
  });

  it("una seduta con struttura incompleta arriva da verificare", () => {
    const p = parseProposal({ workouts: [{ date: "2026-10-12", day: "lunedi", discipline: "running", title: "Senza step", steps: [] }] }, { fromDate: "2026-10-12", weeks: 1, hasFtp: false });
    if ("error" in p) throw new Error(p.error);
    expect(p.workouts[0].needs_review).toBe("Struttura da completare: Aggiungi almeno uno step.");
    expect(p.warnings).toContain("Una seduta ha una struttura da completare: è segnata da verificare.");
  });
});
