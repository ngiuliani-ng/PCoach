// Pipeline del feedback settimanale (ADR 0019): una riga di weekly_reviews passa per stati
// espliciti. Il database, Intervals.icu, Claude e l'email sono porte iniettate, cosi' la
// logica si testa senza rete e la Edge Function e' solo un adattatore.
//
//   pending ──analisi──▶ analyzed ──testo──▶ draft ──coach──▶ approved ──email──▶ (consegna)
//      │                     │
//      ├─▶ skipped           └─▶ generation_failed
//      └─▶ analysis_failed
//
// Una nuova revisione (rigenerazione) rende "superseded" la precedente. Nessuna email parte
// da una riga che il coach non ha approvato.
import { addDaysISO } from "../workouts/calendar.ts";
import { resolveModel } from "../claude/models.ts";
import { type Completion, completionsFrom } from "./completion.ts";
import { buildFeedbackInput, type FeedbackInput } from "./contract.ts";
import { buildFeedbackPrompt, buildFeedbackTool, DEFAULT_FEEDBACK_STYLE, type FeedbackOutput, type FeedbackTool, validateFeedbackOutput } from "./output.ts";
import { loadProgressionOf, resolveFeedbackParams } from "./params.ts";
import { inScheduleWindow, localDayHour, reviewPeriod, safeTimeZone } from "./period.ts";
import type { CoachChange, Period, PlannedWorkout, PlanWindow, RawActivity, RawWellness } from "./types.ts";

export type ReviewStatus = "pending" | "analyzed" | "draft" | "approved" | "skipped" | "analysis_failed" | "generation_failed" | "superseded";
export type DeliveryStatus = "not_requested" | "pending" | "sent" | "failed" | "skipped";

/** Giorno dell'esecuzione automatica: si valuta sempre l'ultima settimana conclusa (decisione D-11). */
export const FEEDBACK_DAY = "lunedi";

/** Tentativi automatici per passo prima di fermarsi in uno stato di errore. */
export const MAX_ATTEMPTS = 3;
/** Durata del blocco di una riga mentre una invocazione la elabora. */
export const LEASE_SECONDS = 180;

export interface ReviewRow {
  id: string;
  athlete_id: string;
  period_start: string;
  period_end: string;
  revision: number;
  status: ReviewStatus;
  skip_reason: string | null;
  attempts: number;
  error: string | null;
  input: FeedbackInput | null;
  output: FeedbackOutput | null;
  output_text: string | null;
  delivery_status: DeliveryStatus;
  delivery_attempts: number;
  created_at: string;
}

export interface FeedbackSettings {
  claude_api_key: string | null;
  claude_model: string | null;
  weekly_feedback_prompt_template: string | null;
  weekly_feedback_timezone: string;
  weekly_feedback_day: string;
  weekly_feedback_time: string;
  weekly_feedback_email_enabled: boolean;
  feedback_params: unknown;
}

// La scheda atleta e' un jsonb libero: si leggono solo i campi usati, con controlli.
// deno-lint-ignore no-explicit-any
export type Profile = Record<string, any>;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface FeedbackStore {
  settings(): Promise<FeedbackSettings | null>;
  /** Atleti con chiave Intervals.icu e almeno una seduta approvata nel periodo. */
  athletesToReview(period: Period): Promise<string[]>;
  /** Crea la revisione 1 se non esiste una valutazione corrente; null se esiste gia'. */
  claim(athleteId: string, period: Period): Promise<ReviewRow | null>;
  /** Nuova revisione "pending" al posto della valutazione (regenerate_weekly_review); null se bloccata. */
  regenerate(id: string): Promise<string | null>;
  current(athleteId: string, periodStart: string): Promise<ReviewRow | null>;
  get(id: string): Promise<ReviewRow | null>;
  /** Blocca la riga se libera (o con blocco scaduto); null se la sta elaborando un altro. */
  lease(id: string, seconds: number): Promise<ReviewRow | null>;
  /** Aggiorna solo se lo stato e' ancora quello atteso; rilascia il blocco. */
  update(id: string, expected: ReviewStatus, patch: Record<string, unknown>): Promise<boolean>;
  release(id: string): Promise<void>;
  /** Righe con lavoro da fare (analisi, testo, consegna), non bloccate. */
  workQueue(limit: number): Promise<ReviewRow[]>;
  athleteProfile(id: string): Promise<Profile | null>;
  approvedWorkouts(athleteId: string, period: Period): Promise<PlannedWorkout[]>;
  draftCount(athleteId: string, period: Period): Promise<number>;
  coachChanges(athleteId: string, period: Period): Promise<CoachChange[]>;
  plans(athleteId: string, from: string, to: string): Promise<PlanWindow[]>;
  /** Registra la seduta come svolta, con esito e dati dell'attivita', se non lo e' gia'. */
  markCompleted(c: Completion): Promise<void>;
}

export interface IntervalsPort {
  activities(apiKey: string, oldest: string, newest: string): Promise<Result<RawActivity[]>>;
  wellness(apiKey: string, oldest: string, newest: string): Promise<Result<RawWellness[]>>;
}

export type LlmResult =
  | { ok: true; toolInput: unknown; stopReason: string; model: string }
  | { ok: false; error: string; transient: boolean };

export interface LlmPort {
  generate(req: { apiKey: string; model: string; system: string; user: string; tool: FeedbackTool; maxTokens: number }): Promise<LlmResult>;
}

export interface MailPort {
  send(msg: { to: string; subject: string; text: string }): Promise<{ ok: boolean; error?: string }>;
}

export interface Deps {
  store: FeedbackStore;
  intervals: IntervalsPort;
  llm: LlmPort;
  /** null se il provider email non e' configurato. */
  mail: MailPort | null;
  now: () => Date;
}

const MAX_TOKENS = 3000;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function latest(log: Profile[] | undefined): Profile | undefined {
  return log?.length ? [...log].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? ""))).at(-1) : undefined;
}

// ---------- Passi ----------

export async function analyze(deps: Deps, row: ReviewRow, settings: FeedbackSettings): Promise<ReviewStatus> {
  const { store } = deps;
  const period: Period = { start: row.period_start, end: row.period_end };
  const fail = async (error: string, permanent = false) => {
    const attempts = row.attempts + 1;
    const status: ReviewStatus = permanent || attempts >= MAX_ATTEMPTS ? "analysis_failed" : "pending";
    await store.update(row.id, "pending", { status, attempts, error });
    return status;
  };
  const profile = await store.athleteProfile(row.athlete_id);
  if (!profile) return fail("Atleta non trovato.", true);
  const apiKey: string = profile.integrations?.intervals_icu_api_key?.trim?.() ?? "";
  if (!apiKey) return fail("L'atleta non ha una chiave Intervals.icu.", true);

  const workouts = await store.approvedWorkouts(row.athlete_id, period);
  if (!workouts.length) {
    await store.update(row.id, "pending", { status: "skipped", skip_reason: "no_assigned_workouts", error: null });
    return "skipped";
  }
  const prevStart = addDaysISO(period.start, -7);
  const [acts, well] = await Promise.all([
    deps.intervals.activities(apiKey, prevStart, period.end),
    deps.intervals.wellness(apiKey, addDaysISO(period.start, -35), period.end)
  ]);
  if (!acts.ok) return fail(`Intervals.icu (attività): ${acts.error}`);
  if (!well.ok) return fail(`Intervals.icu (benessere): ${well.error}`);

  const [drafts, changes, plans] = await Promise.all([
    store.draftCount(row.athlete_id, period),
    store.coachChanges(row.athlete_id, period),
    store.plans(row.athlete_id, prevStart, period.end)
  ]);
  const now = deps.now();
  const tz = safeTimeZone(settings.weekly_feedback_timezone);
  const input = buildFeedbackInput({
    athlete: {
      id: row.athlete_id,
      display_name: (profile.identity?.nome ?? "").trim() || "atleta",
      intensity_model: profile.methodology_preferences?.intensity_distribution_model ?? "",
      load_pattern: profile.methodology_preferences?.load_deload_pattern ?? "",
      progression: loadProgressionOf(profile.methodology_preferences),
      ftp_watts: latest(profile.physiological_thresholds?.cycling?.thresholds_log)?.ftp_watts ?? null,
      lthr_bpm: latest(profile.physiological_thresholds?.running?.thresholds_log)?.lthr_bpm ?? null,
      event_dates: (profile.goals?.target_events ?? []).map((e: { date?: string }) => e.date).filter(Boolean)
    },
    period,
    today: localDayHour(now, tz).date,
    evaluated_at: now.toISOString(),
    timezone: tz,
    workouts,
    excluded_drafts: drafts,
    coach_changes: changes,
    plans,
    activities: acts.data,
    wellness: well.data,
    params: resolveFeedbackParams(settings.feedback_params)
  });

  // Le sedute abbinate con certezza risultano svolte anche nel piano.
  for (const c of completionsFrom(input.sessions, workouts, acts.data)) {
    await store.markCompleted(c);
  }

  await store.update(row.id, "pending", {
    status: "analyzed", input, metrics: input.metrics, analysis_version: input.analysis_version,
    plan_id: plans.find((p) => p.status === "active")?.id ?? plans.at(-1)?.id ?? null,
    analyzed_at: now.toISOString(), attempts: 0, error: null
  });
  return "analyzed";
}

export async function generate(deps: Deps, row: ReviewRow, settings: FeedbackSettings): Promise<ReviewStatus> {
  const { store } = deps;
  const input = row.input!;
  if (!settings.claude_api_key) {
    await store.update(row.id, "analyzed", { status: "generation_failed", error: "Chiave API di Claude non configurata in Impostazioni." });
    return "generation_failed";
  }
  const template = settings.weekly_feedback_prompt_template ?? DEFAULT_FEEDBACK_STYLE;
  // Solo modelli ammessi (D-06): un valore sconosciuto torna al predefinito invece di far fallire la chiamata.
  const model = resolveModel(settings.claude_model);
  const prompt = buildFeedbackPrompt(input, template);
  const tool = buildFeedbackTool(input.allowed_topics);
  let user = prompt.user;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await deps.llm.generate({ apiKey: settings.claude_api_key, model, system: prompt.system, user, tool, maxTokens: MAX_TOKENS });
    if (!res.ok) {
      const attempts = row.attempts + 1;
      const status: ReviewStatus = !res.transient || attempts >= MAX_ATTEMPTS ? "generation_failed" : "analyzed";
      await store.update(row.id, "analyzed", { status, attempts, error: `Claude: ${res.error}` });
      return status;
    }
    lastErrors = res.stopReason !== "tool_use" ? [`Risposta interrotta (${res.stopReason}).`] : validateFeedbackOutput(res.toolInput, input);
    if (!lastErrors.length) {
      const output = res.toolInput as FeedbackOutput;
      await store.update(row.id, "analyzed", {
        status: "draft", output, output_text: output.athlete_message.trim(), model: res.model,
        prompt_template_hash: await sha256(template), generated_at: deps.now().toISOString(), attempts: 0, error: null
      });
      return "draft";
    }
    user = `${prompt.user}\n\nL'output precedente non era valido: ${lastErrors.join(" ")} Correggi e usa di nuovo lo strumento.`;
  }
  await store.update(row.id, "analyzed", { status: "generation_failed", attempts: row.attempts + 1, error: `Output non valido: ${lastErrors.join(" ")}` });
  return "generation_failed";
}

export async function deliver(deps: Deps, row: ReviewRow): Promise<DeliveryStatus> {
  const { store } = deps;
  const profile = await store.athleteProfile(row.athlete_id);
  const to = profile?.identity?.email?.trim?.() ?? "";
  if (!deps.mail || !to) {
    await store.update(row.id, "approved", { delivery_status: "skipped", delivery_error: deps.mail ? "L'atleta non ha un indirizzo email." : "Provider email non configurato." });
    return "skipped";
  }
  const res = await deps.mail.send({ to, subject: `Il tuo feedback della settimana dal ${formatDay(row.period_start)}`, text: row.output_text ?? "" });
  const attempts = row.delivery_attempts + 1;
  await store.update(row.id, "approved", res.ok
    ? { delivery_status: "sent", delivery_attempts: attempts, delivery_error: null, delivered_at: deps.now().toISOString() }
    : { delivery_status: "failed", delivery_attempts: attempts, delivery_error: res.error ?? "Invio non riuscito." });
  return res.ok ? "sent" : "failed";
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function deliveryDue(row: ReviewRow): boolean {
  return (row.delivery_status === "pending" || row.delivery_status === "failed") && row.delivery_attempts < MAX_ATTEMPTS;
}

/** Porta una riga avanti finche' c'e' lavoro automatico da fare (analisi, testo, consegna). */
export async function processReview(deps: Deps, id: string): Promise<ReviewRow | null> {
  const settings = await deps.store.settings();
  if (!settings) return deps.store.get(id);
  const leased = await deps.store.lease(id, LEASE_SECONDS);
  if (!leased) return deps.store.get(id);
  let row: ReviewRow = leased;
  try {
    for (let step = 0; step < 4; step++) {
      const before = row.status;
      if (row.status === "pending") await analyze(deps, row, settings);
      else if (row.status === "analyzed") await generate(deps, row, settings);
      else if (row.status === "approved" && deliveryDue(row)) await deliver(deps, row);
      else break;
      const next = await deps.store.get(id);
      if (!next) break;
      // Stesso stato dopo un passo: errore transitorio o consegna fallita, si riprova al giro successivo.
      const progressed = next.status !== before;
      row = next;
      if (!progressed || !(await deps.store.lease(id, LEASE_SECONDS))) break;
    }
  } finally {
    await deps.store.release(id);
  }
  return deps.store.get(id);
}

/** Invocazione schedulata: nella finestra configurata crea le valutazioni della settimana, poi
 * elabora la coda entro il tempo disponibile. */
export async function runScheduled(deps: Deps, budgetMs = 100_000): Promise<{ planned: number; processed: { id: string; status: string }[] }> {
  const started = Date.now();
  const settings = await deps.store.settings();
  if (!settings) return { planned: 0, processed: [] };
  let planned = 0;
  const now = deps.now();
  const tz = safeTimeZone(settings.weekly_feedback_timezone);
  if (inScheduleWindow(now, tz, FEEDBACK_DAY, settings.weekly_feedback_time)) {
    const period = reviewPeriod(localDayHour(now, tz).date);
    for (const athleteId of await deps.store.athletesToReview(period)) {
      if (await deps.store.claim(athleteId, period)) {
        planned++;
        continue;
      }
      // Una valutazione preparata a settimana in corso, non ancora approvata, lascia il posto a
      // quella della settimana conclusa (decisione D-08). Quella del lunedi' nasce dopo la fine
      // del periodo, quindi non viene sostituita di nuovo alle esecuzioni successive.
      const current = await deps.store.current(athleteId, period.start);
      if (current && isEarly(current, period, tz) && (await deps.store.regenerate(current.id))) planned++;
    }
  }
  const processed: { id: string; status: string }[] = [];
  for (const row of await deps.store.workQueue(20)) {
    if (Date.now() - started > budgetMs) break;
    const after = await processReview(deps, row.id);
    processed.push({ id: row.id, status: after?.status ?? "unknown" });
  }
  return { planned, processed };
}

/** Valutazione creata prima della fine del periodo (nel fuso del coach) e non ancora approvata. */
export function isEarly(row: ReviewRow, period: Period, timeZone: string): boolean {
  if (row.status === "approved" || row.status === "superseded") return false;
  return localDayHour(new Date(row.created_at), timeZone).date <= period.end;
}

/**
 * Approvazione del coach: il testo approvato e' quello che riceve l'atleta, se l'email e' attiva e
 * il coach non ha scelto di non inviarlo (`send = false`, ad esempio per la revisione di una
 * settimana gia' inviata: decisione D-07).
 */
export async function approveReview(deps: Deps, id: string, text: string, send = true): Promise<{ ok: boolean; error?: string; row?: ReviewRow | null }> {
  const settings = await deps.store.settings();
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Il testo del feedback è vuoto." };
  const ok = await deps.store.update(id, "draft", {
    status: "approved", output_text: clean, approved_at: deps.now().toISOString(),
    delivery_status: settings?.weekly_feedback_email_enabled && send ? "pending" : "not_requested", delivery_attempts: 0, delivery_error: null
  });
  if (!ok) return { ok: false, error: "La valutazione non è più in bozza: ricarica." };
  return { ok: true, row: await processReview(deps, id) };
}
