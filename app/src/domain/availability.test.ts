import { describe, expect, it } from "vitest";
import { alignToDay, availabilityIssues, planningCalendar } from "./availability";
import { parseProposal } from "./regeneration";
import type { AthleteTrainingProfile } from "../schema/types.generated";

// Disponibilita' reale di un atleta: domenica non disponibile, attivita' abituali per giorno.
const constraints = {
  days_available: [
    { day: "lunedi", active: true, max_duration_minutes: 70, fixed_activity: "Corsa Qualità" },
    { day: "martedi", active: true, max_duration_minutes: 70, fixed_activity: "Corsa Easy + Palestra" },
    { day: "mercoledi", active: true, max_duration_minutes: 60, fixed_activity: "Corsa Easy (Running Club)" },
    { day: "giovedi", active: true, max_duration_minutes: 40, fixed_activity: "Ginnastica Posturale" },
    { day: "venerdi", active: true, max_duration_minutes: 60, fixed_activity: "Palestra" },
    { day: "sabato", active: true, max_duration_minutes: 90, fixed_activity: "Corsa Lunga" },
    { day: "domenica", active: false, fixed_activity: "" }
  ],
  sessions_per_week_target: 6
} as AthleteTrainingProfile["constraints"];

const run = (date: string, minutes: number, day?: string) => ({
  date, day, discipline: "running", title: `Corsa ${date}`, steps: [{ kind: "step", role: "steady", duration_sec: minutes * 60, zone: "Z2" }]
});

describe("calendario del periodo", () => {
  it("risolve giorno, disponibilita', durata massima e attivita' abituale di ogni data", () => {
    const cal = planningCalendar(constraints, "2026-10-11", "2026-10-17");
    expect(cal).toHaveLength(7);
    expect(cal[0]).toEqual({ data: "2026-10-11", giorno: "domenica", disponibile: false, durata_massima_min: null, attivita_abituale: "" });
    expect(cal[1]).toMatchObject({ data: "2026-10-12", giorno: "lunedì", disponibile: true, durata_massima_min: 70, attivita_abituale: "Corsa Qualità" });
  });

  it("senza vincoli ogni giorno e' disponibile", () => {
    expect(planningCalendar(null, "2026-10-12", "2026-10-18").every((d) => d.disponibile)).toBe(true);
  });

  it("riallinea una data al giorno indicato, entro tre giorni", () => {
    expect(alignToDay("2026-10-13", "lunedi")).toBe("2026-10-12");
    expect(alignToDay("2026-10-12", "domenica")).toBe("2026-10-11");
    expect(alignToDay("2026-10-12", "giovedi")).toBe("2026-10-15");
  });
});

describe("controllo della disponibilita'", () => {
  it("segnala giorni non disponibili e durate oltre il massimo del giorno, sommando le sedute", () => {
    const content = (date: string, min: number) => ({
      planned_date: date, discipline: "running" as const, duration_min: null,
      structure: { version: 2 as const, steps: [{ kind: "step" as const, role: "steady" as const, duration: { type: "time" as const, seconds: min * 60 }, target: { zone: 2 } }] }
    });
    const issues = availabilityIssues([content("2026-10-18", 60), content("2026-10-15", 30), content("2026-10-15", 30), content("2026-10-17", 90)], constraints);
    expect(issues.get(0)).toMatch(/domenica non è un giorno disponibile/);
    expect(issues.get(1)).toMatch(/al massimo 40 minuti: le sedute del giorno ne fanno 60/);
    expect(issues.get(2)).toBeDefined();
    expect(issues.has(3)).toBe(false);
  });
});

describe("proposta di Claude contro i vincoli", () => {
  it("caso reale: date sfalsate di +1 con il giorno giusto, tutto riportato al giorno indicato", () => {
    const raw = { workouts: [run("2026-10-13", 60, "lunedi"), run("2026-10-18", 90, "sabato")] };
    const p = parseProposal(raw, { fromDate: "2026-10-11", weeks: 1, hasFtp: true, constraints });
    if ("error" in p) throw new Error(p.error);
    expect(p.workouts.map((w) => w.planned_date)).toEqual(["2026-10-12", "2026-10-17"]);
    expect(p.workouts.every((w) => w.needs_review === null)).toBe(true);
    expect(p.warnings[0]).toMatch(/2 sedute avevano giorno e data incoerenti/);
  });

  it("segna da verificare le sedute in giorni non disponibili o troppo lunghe, contando quelle mantenute", () => {
    const raw = { workouts: [run("2026-10-18", 60, "domenica"), run("2026-10-15", 30, "giovedi")] };
    const fixed = [{ planned_date: "2026-10-15", discipline: "strength" as const, duration_min: 40, structure: null }];
    const p = parseProposal(raw, { fromDate: "2026-10-12", weeks: 1, hasFtp: true, constraints, fixed });
    if ("error" in p) throw new Error(p.error);
    expect(p.workouts[0].needs_review).toMatch(/ne fanno 70/);
    expect(p.workouts[1].needs_review).toMatch(/domenica non è un giorno disponibile/);
    expect(p.warnings.at(-1)).toMatch(/2 sedute non rispettano la disponibilità/);
  });
});
