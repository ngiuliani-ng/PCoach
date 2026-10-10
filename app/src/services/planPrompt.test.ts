import { describe, expect, it } from "vitest";
import { blankProfile, DEFAULT_PLAN_PROMPT, TRAINING_PLAN_JSON_SHAPE } from "../constants";
import { buildPlanPrompt, type PromptWorkout } from "./planPrompt";

const fixed: PromptWorkout = {
  planned_date: "2026-10-18", discipline: "running", title: "Lungo", objective: "", notes_for_athlete: "",
  duration_min: null, primary_target: "pace", status: "approved", completed_at: null,
  structure: { version: 2, steps: [{ kind: "step", role: "steady", duration: { type: "time", seconds: 5400 }, target: { zone: 2 } }] }
};

describe("buildPlanPrompt", () => {
  const profile = { ...blankProfile(), identity: { ...blankProfile().identity, nome: "Giulia", cognome: "Ferri" } };

  it("compila periodo, motivo, sedute fisse e formato nel template predefinito", () => {
    const text = buildPlanPrompt(profile, { weeks: 2, fromDate: "2026-10-12", reason: "Affaticamento", fixed: [fixed], recent: [] }, TRAINING_PLAN_JSON_SHAPE, DEFAULT_PLAN_PROMPT);
    expect(text).toContain("dal 2026-10-12 al 2026-10-25 compresi");
    expect(text).toContain("Affaticamento");
    expect(text).toContain('"title": "Lungo"');
    expect(text).toContain('"minutes": 90');
    expect(text).toContain('"day": "domenica"');
    // Il calendario arriva gia' calcolato: il 12 ottobre 2026 e' un lunedi'.
    expect(text).toContain('{"data":"2026-10-12","giorno":"lunedì","disponibile":true');
    expect(text).toContain('"workouts"');
    expect(text).not.toMatch(/\{\{\w+\}\}/);
  });

  it("aggiunge periodo e vincoli a un template personalizzato che non li contiene", () => {
    const text = buildPlanPrompt(profile, { weeks: 1, fromDate: "2026-10-12", reason: "", fixed: [], recent: [] }, TRAINING_PLAN_JSON_SHAPE, "Piano per {{nome_atleta}}.");
    expect(text.startsWith("Piano per Giulia Ferri.")).toBe(true);
    expect(text).toContain("Periodo: dal 2026-10-12 al 2026-10-18 compresi. Motivo: Nessun motivo indicato.");
    expect(text).toContain('"workouts"');
  });

  it("colloca un blocco nel piano complessivo", () => {
    const text = buildPlanPrompt(profile, {
      weeks: 3, fromDate: "2026-11-02", reason: "", fixed: [], recent: [],
      block: { index: 1, count: 4, firstWeek: 4, totalWeeks: 10, planFrom: "2026-10-12" }
    }, TRAINING_PLAN_JSON_SHAPE, DEFAULT_PLAN_PROMPT);
    expect(text).toContain("parte 2 di 4 di un piano di 10 settimane, dal 2026-10-12 al 2026-12-20");
    expect(text).toContain("dalla 4 alla 6 del piano (dal 2026-11-02 al 2026-11-22)");
    expect(text).toContain("parti precedenti");
  });
});
