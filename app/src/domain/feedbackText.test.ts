// Conteggi del feedback in una frase (audit FB-08).
import { describe, expect, it } from "vitest";
import { countsSentence } from "./feedbackText";

const sessions = (over: Record<string, number>) => ({
  assigned: 0, past: 0, pending: 0, completed: 0, partial: 0, moved: 0, substituted: 0, not_recorded: 0,
  data_unavailable: 0, ambiguous: 0, unknown: 0, extra: 0, ...over
});
const rate = (value: number | null, reportable = true) => ({ numerator: 0, denominator: 0, value, reportable });

describe("countsSentence", () => {
  it("una frase: assegnate, poi gli esiti, poi extra e completamento", () => {
    const m = { sessions: sessions({ assigned: 4, completed: 3, not_recorded: 1, extra: 1 }), completion_rate: rate(0.75) };
    expect(countsSentence(m as never)).toBe("4 sedute assegnate: 3 svolte, 1 senza attività registrata; 1 attività extra; completamento 75%");
  });

  it("singolare e spostate contate come svolte", () => {
    const m = { sessions: sessions({ assigned: 1, moved: 1 }), completion_rate: rate(1) };
    expect(countsSentence(m as never)).toBe("1 seduta assegnata: 1 svolta; completamento 100%");
  });

  it("niente completamento se non si puo' comunicare; niente esiti a zero", () => {
    const m = { sessions: sessions({ assigned: 3, pending: 3 }), completion_rate: rate(null, false) };
    expect(countsSentence(m as never)).toBe("3 sedute assegnate: 3 in programma");
  });

  it("nessuna seduta: lo dice una volta sola (audit FB-09)", () => {
    expect(countsSentence({ sessions: sessions({}), completion_rate: rate(null, false) } as never)).toBe("Nessuna seduta assegnata");
    expect(countsSentence(null)).toBe("");
  });
});
