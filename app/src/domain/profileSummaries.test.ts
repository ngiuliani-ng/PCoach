import { describe, expect, it } from "vitest";
import { blankProfile } from "../constants";
import {
  constraintsSummary, disciplinesSummary, goalsSummary, identitySummary, methodologySummary, notesSummary, statusSummary, thresholdsSummary
} from "./profileSummaries";

function profile() {
  const p = blankProfile();
  p.identity = { ...p.identity, nome: "Giulia", cognome: "Ferri", birth_year: 1990, email: "" };
  p.disciplines = [{ sport: "running", level: "intermedio" }, { sport: "cycling", level: "avanzato" }];
  p.physiological_thresholds!.running = { zone_system: "5-zone", thresholds_log: [{ date: "2026-01-01", source: "manual", threshold_pace_per_km: "5:00" }, { date: "2026-09-01", source: "manual", threshold_pace_per_km: "4:46" }] };
  p.physiological_thresholds!.cycling = { zone_system: "7-zone", thresholds_log: [{ date: "2026-09-01", source: "manual", ftp_watts: 230 }] };
  return p;
}

describe("riepiloghi delle sezioni del Profilo (D-02)", () => {
  it("identità, discipline e soglie", () => {
    const p = profile();
    expect(identitySummary(p, 2026)).toBe("Giulia Ferri, 36 anni, senza email");
    expect(disciplinesSummary(p)).toBe("Corsa (intermedio), Bici (avanzato)");
    expect(thresholdsSummary(p)).toBe("Corsa 4:46/km, 5 zone; Bici 230 W, 7 zone");
    expect(thresholdsSummary(blankProfile())).toBe("Nessuna rilevazione");
  });

  it("obiettivi, vincoli, metodologia, stato e note", () => {
    const p = profile();
    p.goals.primary_objective = "preparazione_gara";
    p.goals.target_events = [{ name: "Mezza", date: "2026-11-15", discipline: "running", priority: "A" }];
    expect(goalsSummary(p, "2026-10-10")).toBe("Preparazione gara; prossimo evento Mezza, 15 nov 2026");
    p.constraints.days_available = p.constraints.days_available.map((d, i) => ({ ...d, active: i < 2, max_duration_minutes: i === 1 ? 90 : 60 }));
    p.constraints.sessions_per_week_target = 4;
    expect(constraintsSummary(p)).toBe("lun, mar; al massimo 90 min; 4 sedute a settimana");
    p.methodology_preferences = { ...p.methodology_preferences, intensity_distribution_model: "piramidale", load_deload_pattern: "3:1" };
    expect(methodologySummary(p)).toBe("Piramidale; 3 di carico e 1 di scarico");
    expect(statusSummary(p)).toBe("Nessun calo né fattore di vita");
    p.notes_free_text = "  Allenamenti\nnel pomeriggio  ";
    expect(notesSummary(p)).toBe("Allenamenti nel pomeriggio");
  });
});
