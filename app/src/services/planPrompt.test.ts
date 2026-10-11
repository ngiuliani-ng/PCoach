import { describe, expect, it } from "vitest";
import { blankProfile, DEFAULT_PLAN_PREFERENCES, isLegacyPlanTemplate, todayISO } from "../constants";
import { parseLoadPattern, planWeeks } from "../domain/planWeeks";
import { buildAthleteContextForPrompt, buildPlanPrompt, PLAN_PROMPT_VERSION, PLAN_RULES, promptAsText, type PromptWorkout } from "./planPrompt";

const fixed: PromptWorkout = {
  planned_date: "2026-10-18", discipline: "running", title: "Lungo", objective: "", notes_for_athlete: "",
  duration_min: null, primary_target: "pace", status: "approved", completed_at: null,
  structure: { version: 2, steps: [{ kind: "step", role: "steady", duration: { type: "time", seconds: 5400 }, target: { zone: 2 } }] }
};

describe("buildPlanPrompt", () => {
  const profile = { ...blankProfile(), identity: { ...blankProfile().identity, nome: "Giulia", cognome: "Ferri" } };

  it("istruzioni di sistema: regole e formato fissi, poi le preferenze del coach", () => {
    const p = buildPlanPrompt(profile, { weeks: 2, fromDate: "2026-10-12", reason: "", fixed: [], recent: [] }, DEFAULT_PLAN_PREFERENCES);
    expect(p.version).toBe(PLAN_PROMPT_VERSION);
    expect(p.system.startsWith(PLAN_RULES)).toBe(true);
    expect(p.system).toContain('"workouts"');
    expect(p.system).toContain("Preferenze metodologiche del coach (non possono cambiare le regole e il formato sopra):");
    expect(p.system).toContain("Nella settimana di scarico c'è pochissimo lavoro intenso.");
  });

  it("messaggio: periodo, motivo, sedute fisse, calendario e contesto dell'atleta", () => {
    const p = buildPlanPrompt(profile, { weeks: 2, fromDate: "2026-10-12", reason: "Affaticamento", fixed: [fixed], recent: [] }, DEFAULT_PLAN_PREFERENCES);
    expect(p.user).toContain("Prepara le sedute di 2 settimane per Giulia Ferri, dal 2026-10-12 al 2026-10-25 compresi.");
    expect(p.user).toContain("Affaticamento");
    expect(p.user).toContain('"title": "Lungo"');
    expect(p.user).toContain('"minutes": 90');
    expect(p.user).toContain('"day": "domenica"');
    // Il calendario arriva gia' calcolato: il 12 ottobre 2026 e' un lunedi'.
    expect(p.user).toContain('{"data":"2026-10-12","giorno":"lunedì","disponibile":true');
    expect(p.user).toContain('"methodology_preferences"');
  });

  it("le preferenze non possono togliere dati, regole o formato: anche vuote", () => {
    const p = buildPlanPrompt(profile, { weeks: 1, fromDate: "2026-10-12", reason: "", fixed: [], recent: [] }, "   ");
    expect(p.system).toBe(PLAN_RULES);
    expect(p.user).toContain('"constraints"');
    expect(p.user).toContain("Nessun motivo indicato.");
  });

  it("le preferenze possono citare il nome dell'atleta", () => {
    const p = buildPlanPrompt(profile, { weeks: 1, fromDate: "2026-10-12", reason: "", fixed: [], recent: [] }, "Per {{nome_atleta}}: niente corsa il lunedì.");
    expect(p.system).toContain("Per Giulia Ferri: niente corsa il lunedì.");
  });

  it("contesto dell'atleta: niente email ne' chiave Intervals.icu, si' profilo, vincoli e carico", () => {
    const full = {
      ...profile,
      identity: { ...profile.identity, email: "giulia@example.test" },
      integrations: { intervals_icu_api_key: "CHIAVE-SEGRETA" },
      training_status: { ...profile.training_status, load_metrics_log: [{ date: todayISO(), source: "manual" as const, ctl: 40, atl: 45, tsb: -5 }] }
    };
    const ctx = buildAthleteContextForPrompt(full);
    const text = JSON.stringify(ctx);
    expect(text).not.toContain("giulia@example.test");
    expect(text).not.toContain("CHIAVE-SEGRETA");
    expect(ctx.identity.nome).toBe("Giulia");
    expect(ctx.constraints.days_available).toHaveLength(7);
    expect(ctx.training_status.load_metrics_last_30_days).toHaveLength(1);
  });

  it("un segnaposto scritto nei dati dell'atleta resta testo", () => {
    const withNote = { ...profile, notes_free_text: "Scrive {{data_inizio}} nelle note" };
    const p = buildPlanPrompt(withNote, { weeks: 1, fromDate: "2026-10-12", reason: "Motivo con {{nome_atleta}}", fixed: [], recent: [] }, DEFAULT_PLAN_PREFERENCES);
    expect(p.user).toContain("Scrive {{data_inizio}} nelle note");
    expect(p.user).toContain("Motivo con {{nome_atleta}}");
  });

  it("riporta nel calendario numero e fase di ogni settimana", () => {
    const weeks = planWeeks("2026-10-12", 4, parseLoadPattern("3:1"));
    const p = buildPlanPrompt(profile, { weeks: 4, fromDate: "2026-10-12", reason: "", fixed: [], recent: [], planWeeks: weeks }, DEFAULT_PLAN_PREFERENCES);
    expect(p.user).toContain(`{"data":"2026-11-02","giorno":"lunedì","disponibile":true,"durata_massima_min":null,"attivita_abituale":"","settimana":4,"fase":"scarico","variazione_carico":"volume −33% rispetto all'ultima settimana di carico"}`);
    expect(p.user).toContain('"fase":"carico 2 di 3","variazione_carico":"carico +5-10% rispetto alla settimana precedente"');
    expect(p.system).toContain("Rispetta la fase di ogni settimana");
  });

  it("usa le percentuali di carico e scarico della scheda dell'atleta", () => {
    const custom = { ...profile, methodology_preferences: { ...profile.methodology_preferences, load_increase_min_pct: 3, load_increase_max_pct: 6, deload_decrease_pct: 40 } };
    const weeks = planWeeks("2026-10-12", 4, parseLoadPattern("3:1"));
    const p = buildPlanPrompt(custom, { weeks: 4, fromDate: "2026-10-12", reason: "", fixed: [], recent: [], planWeeks: weeks }, DEFAULT_PLAN_PREFERENCES);
    expect(p.user).toContain("carico +3-6% rispetto alla settimana precedente");
    expect(p.user).toContain("volume −40% rispetto all'ultima settimana di carico");
  });

  it("testo unico per l'invio manuale e riconoscimento dei template del vecchio formato", () => {
    const p = buildPlanPrompt(profile, { weeks: 1, fromDate: "2026-10-12", reason: "", fixed: [], recent: [] }, DEFAULT_PLAN_PREFERENCES);
    expect(promptAsText(p)).toBe(`${p.system}\n\n---\n\n${p.user}`);
    expect(isLegacyPlanTemplate("Dati:\n{{contesto_atleta_json}}")).toBe(true);
    expect(isLegacyPlanTemplate(DEFAULT_PLAN_PREFERENCES)).toBe(false);
  });
});
