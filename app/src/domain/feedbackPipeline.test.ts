// Test della pipeline del feedback (stati, nuovi tentativi, idempotenza, consegna) con porte
// finte in memoria: nessuna rete. Casi 16-20 di docs/audit/2026-10-feedback/05-test-strategy.md.
import { describe, expect, it } from "vitest";
import {
  approveReview, type Deps, type FeedbackSettings, type FeedbackStore, type LlmResult, MAX_ATTEMPTS, processReview,
  type Profile, type ReviewRow, type ReviewStatus, runScheduled
} from "@shared/feedback/pipeline.ts";
import type { Period, PlannedWorkout, RawActivity } from "@shared/feedback/types.ts";

const PERIOD: Period = { start: "2026-10-12", end: "2026-10-18" };
const MONDAY_0805 = new Date("2026-10-19T06:05:00Z");

function workout(): PlannedWorkout {
  return {
    id: "w1", revision: 1, planned_date: "2026-10-14", slot: 0, discipline: "running", title: "Corsa", objective: "",
    duration_min: null, structure: { version: 2, steps: [{ kind: "step", role: "steady", duration: { type: "time", seconds: 2700 }, target: { zone: 2 } }] },
    primary_target: "pace", completed_at: null, remote_event_id: 501
  };
}
const ACTIVITY: RawActivity = { id: "i1", start_date_local: "2026-10-14T18:00:00", start_date: "2026-10-14T16:00:00Z", type: "Run", moving_time: 2700, paired_event_id: 501, has_heartrate: true };

class MemoryStore implements FeedbackStore {
  rows: (ReviewRow & Record<string, unknown>)[] = [];
  locks = new Map<string, number>();
  completed: string[] = [];
  workouts = [workout()];
  cfg: Partial<FeedbackSettings>;
  profile: Profile = { identity: { nome: "Elia", email: "elia@example.com" }, integrations: { intervals_icu_api_key: "k" }, methodology_preferences: {} };
  constructor(cfg: Partial<FeedbackSettings> = {}) {
    this.cfg = cfg;
  }
  async settings(): Promise<FeedbackSettings> {
    return { claude_api_key: "c", claude_model: "m", weekly_feedback_prompt_template: "", weekly_feedback_timezone: "Europe/Rome", weekly_feedback_day: "lunedi", weekly_feedback_time: "08:00", weekly_feedback_email_enabled: true, feedback_params: {}, ...this.cfg };
  }
  async athletesToReview() { return ["A1"]; }
  /** Istante di creazione delle nuove righe (di default: lunedi' 08:05). */
  createdAt = MONDAY_0805.toISOString();
  private newRow(athleteId: string, period: Period, revision: number) {
    const row = { id: `r${this.rows.length + 1}`, athlete_id: athleteId, period_start: period.start, period_end: period.end, revision, status: "pending" as ReviewStatus, skip_reason: null, attempts: 0, error: null, input: null, output: null, output_text: null, delivery_status: "not_requested" as const, delivery_attempts: 0, created_at: this.createdAt };
    this.rows.push(row);
    return row;
  }
  async claim(athleteId: string, period: Period) {
    if (this.rows.some((r) => r.athlete_id === athleteId && r.period_start === period.start && r.status !== "superseded")) return null;
    return { ...this.newRow(athleteId, period, 1) };
  }
  async regenerate(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.status === "superseded" || this.locks.has(id)) return null;
    r.status = "superseded";
    return this.newRow(r.athlete_id, { start: r.period_start, end: r.period_end }, r.revision + 1).id;
  }
  async current(athleteId: string, start: string) { return this.rows.find((r) => r.athlete_id === athleteId && r.period_start === start && r.status !== "superseded") ?? null; }
  async get(id: string) { const r = this.rows.find((x) => x.id === id); return r ? { ...r } : null; }
  async lease(id: string) { if (this.locks.has(id)) return null; this.locks.set(id, 1); return this.get(id); }
  async update(id: string, expected: ReviewStatus, patch: Record<string, unknown>) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.status !== expected) return false;
    Object.assign(r, patch);
    this.locks.delete(id);
    return true;
  }
  async release(id: string) { this.locks.delete(id); }
  async workQueue() {
    return this.rows.filter((r) => !this.locks.has(r.id) && (((r.status === "pending" || r.status === "analyzed") && r.attempts < MAX_ATTEMPTS) || (r.status === "approved" && (r.delivery_status === "pending" || r.delivery_status === "failed") && r.delivery_attempts < MAX_ATTEMPTS)));
  }
  async athleteProfile() { return this.profile; }
  async approvedWorkouts() { return this.workouts; }
  async draftCount() { return 0; }
  async coachChanges() { return []; }
  async plans() { return [{ id: "p1", start_date: "2026-10-01", end_date: null, status: "active", weeks_meta: [] }]; }
  async markCompleted(id: string) { this.completed.push(id); }
}

const VALID = {
  summary: "Seduta svolta.", observations: [{ text: "Corsa svolta.", refs: ["session:w1"] }], deviations: [], interpretations: [],
  limitations: ["Mancano dati su RPE e benessere."], recommendations: [], questions_for_athlete: [], athlete_message: "Ciao Elia, corsa svolta come previsto."
};

function deps(store: MemoryStore, opts: { intervalsFails?: boolean; llm?: LlmResult[]; mailOk?: boolean; mail?: boolean } = {}) {
  const sent: string[] = [];
  const llmQueue = [...(opts.llm ?? [])];
  const d: Deps = {
    store,
    intervals: {
      activities: async () => (opts.intervalsFails ? { ok: false, error: "503" } : { ok: true, data: [ACTIVITY] }),
      wellness: async () => (opts.intervalsFails ? { ok: false, error: "503" } : { ok: true, data: [] })
    },
    llm: { generate: async () => llmQueue.shift() ?? { ok: true, toolInput: VALID, stopReason: "tool_use", model: "m" } },
    mail: opts.mail === false ? null : { send: async (m) => { sent.push(m.to); return opts.mailOk === false ? { ok: false, error: "500" } : { ok: true }; } },
    now: () => MONDAY_0805
  };
  return { d, sent };
}

describe("pipeline del feedback", () => {
  it("lunedi' alle 08:05: crea la valutazione e la porta in bozza, senza email", async () => {
    const store = new MemoryStore();
    const { d, sent } = deps(store);
    const res = await runScheduled(d);
    expect(res.planned).toBe(1);
    const row = store.rows[0];
    expect(row).toMatchObject({ status: "draft", period_start: PERIOD.start, output_text: VALID.athlete_message, delivery_status: "not_requested" });
    expect(row.input?.sessions[0]).toMatchObject({ outcome: "completed", confidence: "confirmed" });
    expect(row.prompt_template_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.completed).toEqual(["w1"]);
    expect(sent).toEqual([]);
  });

  it("18. due esecuzioni: una sola valutazione per atleta e settimana", async () => {
    const store = new MemoryStore();
    const { d } = deps(store);
    await Promise.all([runScheduled(d), runScheduled(d)]);
    await runScheduled(d);
    expect(store.rows).toHaveLength(1);
  });

  it("fuori dalla finestra non crea nulla; il giorno e' sempre il lunedi' (D-11)", async () => {
    expect((await runScheduled(deps(new MemoryStore({ weekly_feedback_time: "09:00" })).d)).planned).toBe(0);
    // Un giorno diverso salvato in passato non conta piu'.
    expect((await runScheduled(deps(new MemoryStore({ weekly_feedback_day: "domenica" })).d)).planned).toBe(1);
  });

  it("D-08: la valutazione preparata a settimana in corso e non approvata viene sostituita il lunedi'", async () => {
    const store = new MemoryStore();
    store.createdAt = "2026-10-16T10:00:00Z"; // venerdi': settimana in corso
    await store.claim("A1", PERIOD);
    store.createdAt = MONDAY_0805.toISOString();
    const { d } = deps(store);
    expect((await runScheduled(d)).planned).toBe(1);
    expect(store.rows.map((r) => [r.revision, r.status])).toEqual([[1, "superseded"], [2, "draft"]]);
    // All'esecuzione successiva la valutazione del lunedi' resta.
    await runScheduled(d);
    expect(store.rows).toHaveLength(2);
  });

  it("D-08: una valutazione anticipata gia' approvata resta", async () => {
    const store = new MemoryStore();
    store.createdAt = "2026-10-16T10:00:00Z";
    await store.claim("A1", PERIOD);
    store.rows[0].status = "approved";
    const { d } = deps(store);
    expect((await runScheduled(d)).planned).toBe(0);
    expect(store.rows).toHaveLength(1);
  });

  it("16. Intervals.icu non risponde: nuovi tentativi, poi analysis_failed", async () => {
    const store = new MemoryStore();
    const { d } = deps(store, { intervalsFails: true });
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ status: "pending", attempts: 1 });
    await runScheduled(d);
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ status: "analysis_failed", attempts: 3 });
    await runScheduled(d);
    expect(store.rows[0].attempts).toBe(3);
  });

  it("17a. errore transitorio di Claude: l'analisi resta salvata e si riprova", async () => {
    const store = new MemoryStore();
    const { d } = deps(store, { llm: [{ ok: false, error: "timeout", transient: true }] });
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ status: "analyzed", attempts: 1 });
    expect(store.rows[0].input).not.toBeNull();
    await runScheduled(d);
    expect(store.rows[0].status).toBe("draft");
  });

  it("17b. risposta troncata due volte: generation_failed, nessun testo", async () => {
    const store = new MemoryStore();
    const truncated: LlmResult = { ok: true, toolInput: {}, stopReason: "max_tokens", model: "m" };
    const { d } = deps(store, { llm: [truncated, truncated] });
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ status: "generation_failed", output_text: null });
    expect(String(store.rows[0].error)).toContain("max_tokens");
  });

  it("17c. output non valido corretto al secondo tentativo", async () => {
    const store = new MemoryStore();
    const bad: LlmResult = { ok: true, toolInput: { ...VALID, observations: [{ text: "x", refs: ["session:zzz"] }] }, stopReason: "tool_use", model: "m" };
    const { d } = deps(store, { llm: [bad] });
    await runScheduled(d);
    expect(store.rows[0].status).toBe("draft");
  });

  it("nessuna seduta approvata: skipped, senza chiamare Claude", async () => {
    const store = new MemoryStore();
    store.workouts = [];
    const { d } = deps(store, { llm: [{ ok: false, error: "non doveva essere chiamato", transient: false }] });
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ status: "skipped", skip_reason: "no_assigned_workouts" });
  });

  it("approvazione del coach: invia il testo approvato", async () => {
    const store = new MemoryStore();
    const { d, sent } = deps(store);
    await runScheduled(d);
    const res = await approveReview(d, "r1", "Testo rivisto dal coach.");
    expect(res.ok).toBe(true);
    expect(store.rows[0]).toMatchObject({ status: "approved", output_text: "Testo rivisto dal coach.", delivery_status: "sent", delivery_attempts: 1 });
    expect(sent).toEqual(["elia@example.com"]);
    expect((await approveReview(d, "r1", "di nuovo")).ok).toBe(false);
  });

  it("D-07: il coach puo' approvare senza inviare (revisione di una settimana gia' inviata)", async () => {
    const store = new MemoryStore();
    const { d, sent } = deps(store);
    await runScheduled(d);
    await approveReview(d, "r1", "Ok.", false);
    expect(store.rows[0]).toMatchObject({ status: "approved", delivery_status: "not_requested" });
    expect(sent).toEqual([]);
  });

  it("email disattivata: approvata senza invio", async () => {
    const store = new MemoryStore({ weekly_feedback_email_enabled: false });
    const { d, sent } = deps(store);
    await runScheduled(d);
    await approveReview(d, "r1", "Ok.");
    expect(store.rows[0].delivery_status).toBe("not_requested");
    expect(sent).toEqual([]);
  });

  it("20. email fallita: la valutazione resta approvata e l'invio si riprova", async () => {
    const store = new MemoryStore();
    const { d } = deps(store, { mailOk: false });
    await runScheduled(d);
    await approveReview(d, "r1", "Ok.");
    expect(store.rows[0]).toMatchObject({ status: "approved", delivery_status: "failed", delivery_attempts: 1 });
    await runScheduled(d);
    await runScheduled(d);
    expect(store.rows[0]).toMatchObject({ delivery_status: "failed", delivery_attempts: 3 });
    await runScheduled(d);
    expect(store.rows[0].delivery_attempts).toBe(3);
  });

  it("provider email non configurato: consegna saltata, non un errore", async () => {
    const store = new MemoryStore();
    const { d } = deps(store, { mail: false });
    await runScheduled(d);
    await approveReview(d, "r1", "Ok.");
    expect(store.rows[0]).toMatchObject({ status: "approved", delivery_status: "skipped" });
  });

  it("una riga bloccata da un'altra esecuzione non viene elaborata due volte", async () => {
    const store = new MemoryStore();
    const { d } = deps(store);
    await store.claim("A1", PERIOD);
    store.locks.set("r1", 1);
    expect((await processReview(d, "r1"))?.status).toBe("pending");
  });
});
