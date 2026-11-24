// Aderenza della settimana in percentuale (ADR 0045): un solo calcolo per la sintesi del coach
// (FeedbackWeek.vue) e per la riga che Claude copia nei numeri del messaggio all'atleta (output.ts).
// Modulo puro condiviso con l'app.
import type { FeedbackInput } from "./contract.ts";

type Metrics = Pick<FeedbackInput["metrics"], "sessions" | "completion_rate">;

export interface Adherence {
  /** Percentuale intera, null se non calcolabile. */
  pct: number | null;
  /** Perche' non e' calcolabile: nessuna seduta passata, o troppe sedute non valutabili. */
  reason: "no_past" | "too_unknown" | null;
}

export function adherenceOf(m: Metrics): Adherence {
  const r = m.completion_rate;
  if (r.reportable && r.value !== null) return { pct: Math.round(r.value * 100), reason: null };
  return { pct: null, reason: m.sessions.past === 0 || r.value === null ? "no_past" : "too_unknown" };
}

/** Riga per il coach: «Aderenza 71%» o «Aderenza non calcolabile (…)». */
export function coachAdherence(a: Adherence): string {
  if (a.pct !== null) return `Aderenza ${a.pct}%`;
  return `Aderenza non calcolabile (${a.reason === "no_past" ? "nessuna seduta passata" : "troppe sedute non valutabili"})`;
}

/** Riga che Claude copia tale e quale fra i numeri della settimana per l'atleta. */
export function athleteAdherenceLine(a: Adherence): string {
  if (a.pct !== null) return `- Aderenza: ${a.pct}%`;
  return `- Aderenza: non calcolabile, ${a.reason === "no_past" ? "nessuna seduta passata da valutare" : "troppi dati mancanti"}`;
}
