// Dati fissi della sintesi per il coach nel feedback settimanale (ADR 0045): aderenza in percentuale
// e conteggi delle sedute, calcolati da PCoach e non dal testo di Claude.
import type { FeedbackInput } from "@shared/feedback/contract.ts";
import { adherenceOf, coachAdherence } from "@shared/feedback/adherence.ts";

type Metrics = NonNullable<FeedbackInput["metrics"]>;

export interface CoachFacts {
  /** «Aderenza 71%» o «Aderenza non calcolabile (…)»: c'e' sempre. */
  adherence: string;
  /** «7 sedute: 5 svolte, 2 senza attività registrata · 1 attività extra». Le parti a zero non compaiono. */
  counts: string;
}

export function coachFacts(m: Metrics | null | undefined): CoachFacts | null {
  if (!m) return null;
  const s = m.sessions;
  const outcomes = [
    [s.completed + s.moved, "svolte", "svolta"],
    [s.partial, "in parte", "in parte"],
    [s.not_recorded, "senza attività registrata", "senza attività registrata"],
    [s.unknown, "non valutabili", "non valutabile"],
    [s.pending, "in programma", "in programma"]
  ] as const;
  const detail = outcomes.filter(([n]) => n > 0).map(([n, many, one]) => `${n} ${n === 1 ? one : many}`);
  const head = s.assigned === 0 ? "Nessuna seduta assegnata"
    : `${s.assigned} ${s.assigned === 1 ? "seduta" : "sedute"}${detail.length ? `: ${detail.join(", ")}` : ""}`;
  const parts = [head];
  if (s.extra) parts.push(`${s.extra} attività extra`);
  return { adherence: coachAdherence(adherenceOf(m)), counts: parts.join(" · ") };
}
