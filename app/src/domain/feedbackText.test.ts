// Dati fissi della sintesi per il coach (ADR 0045) e riga dell'aderenza per l'atleta.
import { describe, expect, it } from "vitest";
import { coachFacts } from "./feedbackText";
import { adherenceOf, athleteAdherenceLine } from "@shared/feedback/adherence.ts";

const sessions = (over: Record<string, number>) => ({
  assigned: 0, past: 0, pending: 0, completed: 0, partial: 0, moved: 0, substituted: 0, not_recorded: 0,
  data_unavailable: 0, ambiguous: 0, unknown: 0, extra: 0, ...over
});
const rate = (value: number | null, reportable = true) => ({ numerator: 0, denominator: 0, value, reportable, definition: "" });

describe("coachFacts", () => {
  it("aderenza in percentuale, poi sedute, esiti ed extra", () => {
    const m = { sessions: sessions({ assigned: 7, past: 7, completed: 5, not_recorded: 2, extra: 1 }), completion_rate: rate(5 / 7) };
    expect(coachFacts(m as never)).toEqual({ adherence: "Aderenza 71%", counts: "7 sedute: 5 svolte, 2 senza attività registrata · 1 attività extra" });
  });

  it("singolare; le spostate delle valutazioni vecchie contano come svolte", () => {
    const m = { sessions: sessions({ assigned: 1, past: 1, moved: 1 }), completion_rate: rate(1) };
    expect(coachFacts(m as never)).toEqual({ adherence: "Aderenza 100%", counts: "1 seduta: 1 svolta" });
  });

  it("aderenza sempre presente: non calcolabile con il motivo", () => {
    const none = { sessions: sessions({ assigned: 3, pending: 3 }), completion_rate: rate(null, false) };
    expect(coachFacts(none as never)?.adherence).toBe("Aderenza non calcolabile (nessuna seduta passata)");
    const unknown = { sessions: sessions({ assigned: 4, past: 4, completed: 1, unknown: 3 }), completion_rate: rate(1, false) };
    expect(coachFacts(unknown as never)?.adherence).toBe("Aderenza non calcolabile (troppe sedute non valutabili)");
  });

  it("nessuna seduta: lo dice una volta sola; senza metriche niente dati", () => {
    expect(coachFacts({ sessions: sessions({}), completion_rate: rate(null, false) } as never)?.counts).toBe("Nessuna seduta assegnata");
    expect(coachFacts(null)).toBeNull();
  });
});

describe("riga dell'aderenza per l'atleta", () => {
  it("percentuale, oppure non calcolabile con il motivo in parole semplici", () => {
    expect(athleteAdherenceLine(adherenceOf({ sessions: sessions({ past: 5 }), completion_rate: rate(0) } as never))).toBe("- Aderenza: 0%");
    expect(athleteAdherenceLine(adherenceOf({ sessions: sessions({}), completion_rate: rate(null, false) } as never))).toBe("- Aderenza: non calcolabile, nessuna seduta passata da valutare");
    expect(athleteAdherenceLine(adherenceOf({ sessions: sessions({ past: 4, unknown: 3 }), completion_rate: rate(1, false) } as never))).toBe("- Aderenza: non calcolabile, troppi dati mancanti");
  });
});
