// Cosa richiede un'azione del coach, per tutti gli atleti (decisione del coach D-01): la pagina iniziale
// «Da fare» e il numero accanto a ogni atleta nella barra laterale. Usa solo dati gia' nel database:
// zone e soglie diverse da Intervals.icu si controllano all'apertura della scheda (tab Anomalie), perche'
// richiedono una lettura da Intervals.icu per atleta. Funzione pura, testata in todo.test.ts.
import type { RouteLocationRaw } from "vue-router";
import { addDaysISO } from "@shared/workouts/calendar.ts";
import { missingThresholds } from "@shared/workouts/thresholds.ts";
import { formatDate } from "../constants";

export interface TodoWorkout {
  id: string;
  athlete_id: string;
  planned_date: string;
  title: string;
  status: string;
  needs_review: string | null;
}

export interface TodoReview {
  id: string;
  athlete_id: string;
  period_start: string;
  revision: number;
  status: string;
  delivery_status: string;
  error: string | null;
  delivery_error: string | null;
}

export interface TodoLink {
  text: string;
  to: RouteLocationRaw;
}

export interface TodoItem {
  key: string;
  /** "err": qualcosa e' fallito; "warn": va sistemato; "info": aspetta solo un'approvazione. */
  tone: "err" | "warn" | "info";
  title: string;
  detail?: string;
  links: TodoLink[];
}

export interface AthleteTodo {
  id: string;
  name: string;
  items: TodoItem[];
  /** Le sedute raggruppate contano una per una, come nella tab Anomalie. */
  count: number;
}

export interface TodoInput {
  athletes: { id: string; name: string; profile: Parameters<typeof missingThresholds>[0] & { identity?: { email?: string } } }[];
  workouts: TodoWorkout[];
  /** Id delle sedute con l'ultimo invio a Intervals.icu non riuscito. */
  syncErrors: Set<string>;
  reviews: TodoReview[];
  emailEnabled: boolean;
  today: string;
}

/** Settimane di feedback considerate: le stesse della tab Anomalie. */
export const TODO_FEEDBACK_WEEKS = 4;
/** Le bozze da approvare contano se cadono entro questi giorni. */
export const TODO_DRAFT_DAYS = 14;

const athleteRoute = (id: string, tab: string, query?: Record<string, string>): RouteLocationRaw => ({ name: "athlete", params: { id, tab }, query });
const workoutText = (w: TodoWorkout) => `${formatDate(w.planned_date, false)}, ${w.title || "Seduta senza nome"}`;
const ORDER = { err: 0, warn: 1, info: 2 } as const;

export function buildTodo(input: TodoInput): AthleteTodo[] {
  const { today } = input;
  const out: AthleteTodo[] = [];
  for (const a of input.athletes) {
    const items: TodoItem[] = [];

    // Feedback: l'ultima revisione di ogni settimana recente.
    const latest = new Map<string, TodoReview>();
    for (const r of input.reviews.filter((x) => x.athlete_id === a.id && x.status !== "superseded")) {
      const prev = latest.get(r.period_start);
      if (!prev || r.revision > prev.revision) latest.set(r.period_start, r);
    }
    const weeks = [...latest.keys()].sort().reverse().slice(0, TODO_FEEDBACK_WEEKS);
    for (const week of weeks) {
      const r = latest.get(week)!;
      const label = `settimana del ${formatDate(week, false)}`;
      const to = athleteRoute(a.id, "panoramica", { feedback: r.id });
      if (r.status === "draft") items.push({ key: `review-${r.id}`, tone: "info", title: `Feedback della ${label} da approvare`, links: [{ text: "Apri il feedback", to }] });
      else if (r.status === "analysis_failed" || r.status === "generation_failed") {
        items.push({ key: `review-${r.id}`, tone: "err", title: `Feedback della ${label} non preparato`, detail: r.error ?? undefined, links: [{ text: "Apri il feedback", to }] });
      } else if (r.status === "approved" && (r.delivery_status === "failed" || r.delivery_status === "skipped")) {
        items.push({ key: `delivery-${r.id}`, tone: "err", title: `Feedback della ${label} approvato ma non inviato`, detail: r.delivery_error ?? undefined, links: [{ text: "Apri il feedback", to }] });
      }
    }

    // Scheda: email con l'invio attivo (D-05) e soglie mancanti.
    if (input.emailEnabled && !a.profile?.identity?.email?.trim()) {
      items.push({ key: "email", tone: "warn", title: "Manca l'email dell'atleta", links: [{ text: "Aggiungila nel Profilo", to: athleteRoute(a.id, "profilo", { sezione: "sec-identita" }) }] });
    }
    for (const m of missingThresholds(a.profile)) {
      items.push({ key: `missing-${m}`, tone: "warn", title: `Manca ${m}`, links: [{ text: "Aggiungila nel Profilo", to: athleteRoute(a.id, "profilo", { sezione: "sec-soglie" }) }] });
    }

    // Sedute.
    const mine = input.workouts.filter((w) => w.athlete_id === a.id);
    const failed = mine.filter((w) => input.syncErrors.has(w.id));
    if (failed.length) {
      items.push({
        key: "sync-error", tone: "err",
        title: failed.length === 1 ? "Un invio a Intervals.icu non riuscito" : `${failed.length} invii a Intervals.icu non riusciti`,
        links: failed.map((w) => ({ text: workoutText(w), to: athleteRoute(a.id, "piano", { seduta: w.id }) }))
      });
    }
    const toVerify = mine.filter((w) => w.needs_review);
    if (toVerify.length) {
      items.push({
        key: "needs-review", tone: "warn",
        title: toVerify.length === 1 ? "Una seduta da verificare" : `${toVerify.length} sedute da verificare`,
        links: toVerify.map((w) => ({ text: workoutText(w), to: athleteRoute(a.id, "piano", { seduta: w.id }) }))
      });
    }
    const drafts = mine.filter((w) => w.status === "draft" && !w.needs_review && w.planned_date <= addDaysISO(today, TODO_DRAFT_DAYS)).sort((x, y) => x.planned_date.localeCompare(y.planned_date));
    if (drafts.length) {
      items.push({
        key: "drafts", tone: "info",
        title: drafts.length === 1 ? "Una seduta in bozza da approvare" : `${drafts.length} sedute in bozza da approvare`,
        detail: `Dal ${formatDate(drafts[0].planned_date, false)}: finché non ${drafts.length === 1 ? "la approvi non va" : "le approvi non vanno"} su Intervals.icu.`,
        links: [{ text: "Apri il piano", to: athleteRoute(a.id, "piano", { settimana: drafts[0].planned_date }) }]
      });
    }

    if (!items.length) continue;
    items.sort((x, y) => ORDER[x.tone] - ORDER[y.tone]);
    const count = items.reduce((n, i) => n + (i.key === "sync-error" || i.key === "needs-review" ? i.links.length : 1), 0);
    out.push({ id: a.id, name: a.name, items, count });
  }
  return out;
}
