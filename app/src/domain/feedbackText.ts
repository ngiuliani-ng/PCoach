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

/** Stato di una settimana come lo legge il coach: badge della scheda e tooltip dell'andamento. */
export function reviewStatusLabel(r: { status: string; delivery_status: string }): string {
  if (r.status === "draft") return "Da approvare";
  if (r.status === "approved") {
    if (r.delivery_status === "sent") return "Inviato all'atleta";
    if (r.delivery_status === "failed" || r.delivery_status === "skipped") return "Approvato, email non inviata";
    return "Approvato";
  }
  if (r.status === "pending" || r.status === "analyzed") return "In preparazione";
  if (r.status === "skipped") return "Nessuna seduta da valutare";
  return "Non riuscito";
}

// ---------- Widget e riepiloghi della settimana (ADR 0046) ----------

export interface Kpi { label: string; value: string; detail: string }
type Input = Pick<FeedbackInput, "metrics" | "response" | "limitations"> & { sessions?: FeedbackInput["sessions"] };
interface Volume { planned_min: number; matched_min: number; volume_ratio: number | null }

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const it = (n: number, digits = 0) => n.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Tre numeri sempre visibili nella sintesi per il coach: aderenza, sedute svolte, volume sulla settimana prima. */
export function coachKpis(input: Input | null | undefined): Kpi[] {
  const m = input?.metrics;
  if (!m) return [];
  const a = adherenceOf(m);
  const s = m.sessions;
  const done = s.completed + s.moved;
  const missing = [s.not_recorded && `${s.not_recorded} senza attività`, s.partial && `${s.partial} in parte`, s.unknown && `${s.unknown} non valutabili`, s.pending && `${s.pending} in programma`].filter(Boolean);
  const kpis: Kpi[] = [
    { label: "Aderenza", value: a.pct !== null ? `${a.pct}%` : "n.c.", detail: a.pct !== null ? "sulle sedute valutabili" : a.reason === "no_past" ? "nessuna seduta passata" : "troppe sedute non valutabili" },
    { label: "Sedute svolte", value: `${done} su ${s.assigned}`, detail: [...missing, s.extra ? `${s.extra} extra` : ""].filter(Boolean).join(" · ") || "tutte svolte" }
  ];
  const t = m.trend;
  if (t?.endurance_minutes) {
    const e = t.endurance_minutes;
    kpis.push(t.comparable && e.change_pct !== null
      ? { label: "Volume", value: `${signed(e.change_pct)}%`, detail: `sulla settimana prima (${it(e.current)} / ${it(e.previous)} min)` }
      : { label: "Volume", value: "—", detail: "non confrontabile con la settimana prima" });
  }
  return kpis;
}

/** Riepilogo di «Volume e intensità» da chiuso: «Corsa 104% · Bici 44%». */
export function volumeSummary(input: Input | null | undefined, label: (d: string) => string): string {
  const rows = Object.entries((input?.metrics?.by_discipline ?? {}) as Record<string, Volume>).filter(([, v]) => v.planned_min > 0);
  return rows.map(([d, v]) => `${label(d)} ${v.volume_ratio === null ? "—" : `${Math.round(v.volume_ratio * 100)}%`}`).join(" · ");
}

/** Riepilogo di «Benessere e carico» da chiuso: le variazioni sulla media di 28 giorni e il CTL. */
export function wellnessSummary(input: Input | null | undefined): string {
  const w = input?.response?.wellness;
  const parts: string[] = [];
  const add = (name: string, c: { change_pct: number | null } | null | undefined) => { if (c?.change_pct != null) parts.push(`${name} ${signed(c.change_pct)}%`); };
  add("HRV", w?.hrv as { change_pct: number | null } | null);
  add("riposo", w?.resting_hr as { change_pct: number | null } | null);
  add("sonno", w?.sleep_hours as { change_pct: number | null } | null);
  const ctl = input?.metrics?.load_status?.ctl_end;
  if (ctl != null) parts.push(`CTL ${it(ctl, 1)}`);
  return parts.join(" · ");
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
