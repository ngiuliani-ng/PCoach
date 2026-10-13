// Testi della card del feedback settimanale (audit FB-08): i conteggi delle sedute in una frase.
import type { FeedbackInput } from "@shared/feedback/contract.ts";

type Metrics = NonNullable<FeedbackInput["metrics"]>;

/**
 * «4 sedute assegnate: 3 svolte, 1 senza attività registrata; 1 attività extra; completamento 75%».
 * Le parti a zero non compaiono; senza sedute assegnate la frase lo dice una volta sola.
 */
export function countsSentence(m: Metrics | null | undefined): string {
  if (!m) return "";
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
    : `${s.assigned} ${s.assigned === 1 ? "seduta assegnata" : "sedute assegnate"}${detail.length ? `: ${detail.join(", ")}` : ""}`;
  const tail: string[] = [];
  if (s.extra) tail.push(`${s.extra} ${s.extra === 1 ? "attività extra" : "attività extra"}`);
  if (m.completion_rate.reportable && m.completion_rate.value !== null) tail.push(`completamento ${Math.round(m.completion_rate.value * 100)}%`);
  return [head, ...tail].join("; ");
}
