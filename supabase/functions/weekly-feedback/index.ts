// Feedback settimanale (ADR 0019). Adattatore della pipeline in _shared/feedback/pipeline.ts:
// qui ci sono solo il database (supabase-js), Intervals.icu, Claude e Resend.
// Due chiamanti:
// - pg_cron, ogni ora, con la service-role key come bearer: nella finestra configurata crea le
//   valutazioni della settimana appena conclusa, poi elabora la coda (analisi, testo, consegna);
// - il coach, con il JWT di sessione (RLS attiva): crea la valutazione di una settimana,
//   la rigenera, la riprova dopo un errore o la approva (solo allora parte l'email).
// Nessun feedback raggiunge l'atleta senza l'approvazione del coach.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ResendEmailSender } from "../_shared/resendEmailSender.ts";
import {
  approveReview, type Deps, type FeedbackSettings, type FeedbackStore, type LlmPort, MAX_ATTEMPTS, type IntervalsPort,
  processReview, type Profile, type Result, type ReviewRow, type ReviewStatus, runScheduled
} from "../_shared/feedback/pipeline.ts";
import { periodOf } from "../_shared/feedback/period.ts";
import type { CoachChange, Period, PlannedWorkout, PlanWindow, RawActivity, RawWellness } from "../_shared/feedback/types.ts";
import { addDaysISO, isISODate, todayISO, weekStartISO } from "../_shared/workouts/calendar.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const REVIEW_COLUMNS = "id, athlete_id, period_start, period_end, revision, status, skip_reason, attempts, error, input, output, output_text, delivery_status, delivery_attempts, locked_until, created_at";
const WORKOUT_COLUMNS = "id, revision, planned_date, slot, discipline, title, objective, duration_min, structure, primary_target, completed_at, workout_sync(provider, remote_event_id)";

// ---------- Database ----------
class SupabaseStore implements FeedbackStore {
  constructor(private db: SupabaseClient) {}

  async settings(): Promise<FeedbackSettings | null> {
    const { data } = await this.db.from("app_settings")
      .select("claude_api_key, claude_model, weekly_feedback_prompt_template, weekly_feedback_timezone, weekly_feedback_day, weekly_feedback_time, weekly_feedback_email_enabled, feedback_params")
      .eq("id", 1).maybeSingle();
    return (data as FeedbackSettings | null) ?? null;
  }

  async athletesToReview(period: Period): Promise<string[]> {
    const { data: ws } = await this.db.from("workouts").select("athlete_id").eq("status", "approved").gte("planned_date", period.start).lte("planned_date", period.end);
    const ids = [...new Set((ws ?? []).map((w: { athlete_id: string }) => w.athlete_id))];
    if (!ids.length) return [];
    const { data: rows } = await this.db.from("athletes").select("id, data").in("id", ids);
    return (rows ?? [])
      .filter((r: { data: Profile }) => String(r.data?.integrations?.intervals_icu_api_key ?? "").trim())
      .map((r: { id: string }) => r.id);
  }

  async claim(athleteId: string, period: Period): Promise<ReviewRow | null> {
    const { data } = await this.db.from("weekly_reviews")
      .upsert({ athlete_id: athleteId, period_start: period.start, period_end: period.end, kind: "weekly", revision: 1, status: "pending" }, { onConflict: "athlete_id,period_start,kind,revision", ignoreDuplicates: true })
      .select(REVIEW_COLUMNS);
    return ((data ?? [])[0] as ReviewRow | undefined) ?? null;
  }

  async regenerate(id: string): Promise<string | null> {
    const { data, error } = await this.db.rpc("regenerate_weekly_review", { p_id: id });
    return error ? null : (data as string);
  }

  async current(athleteId: string, periodStart: string): Promise<ReviewRow | null> {
    const { data } = await this.db.from("weekly_reviews").select(REVIEW_COLUMNS).eq("athlete_id", athleteId).eq("period_start", periodStart).neq("status", "superseded").maybeSingle();
    return (data as ReviewRow | null) ?? null;
  }

  async get(id: string): Promise<ReviewRow | null> {
    const { data } = await this.db.from("weekly_reviews").select(REVIEW_COLUMNS).eq("id", id).maybeSingle();
    return (data as ReviewRow | null) ?? null;
  }

  async lease(id: string, seconds: number): Promise<ReviewRow | null> {
    const now = new Date();
    const { data } = await this.db.from("weekly_reviews")
      .update({ locked_until: new Date(now.getTime() + seconds * 1000).toISOString() })
      .eq("id", id).or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
      .select(REVIEW_COLUMNS);
    return ((data ?? [])[0] as ReviewRow | undefined) ?? null;
  }

  async update(id: string, expected: ReviewStatus, patch: Record<string, unknown>): Promise<boolean> {
    const { data } = await this.db.from("weekly_reviews").update({ ...patch, locked_until: null }).eq("id", id).eq("status", expected).select("id");
    return (data ?? []).length > 0;
  }

  async release(id: string): Promise<void> {
    await this.db.from("weekly_reviews").update({ locked_until: null }).eq("id", id);
  }

  async workQueue(limit: number): Promise<ReviewRow[]> {
    const { data } = await this.db.from("weekly_reviews").select(REVIEW_COLUMNS)
      .or(`and(status.in.(pending,analyzed),attempts.lt.${MAX_ATTEMPTS}),and(status.eq.approved,delivery_status.in.(pending,failed),delivery_attempts.lt.${MAX_ATTEMPTS})`)
      .order("created_at").limit(limit * 2);
    const now = Date.now();
    return ((data ?? []) as (ReviewRow & { locked_until: string | null })[])
      .filter((r) => !r.locked_until || Date.parse(r.locked_until) < now)
      .slice(0, limit);
  }

  async athleteProfile(id: string): Promise<Profile | null> {
    const { data } = await this.db.from("athletes").select("data").eq("id", id).maybeSingle();
    return (data as { data: Profile } | null)?.data ?? null;
  }

  async approvedWorkouts(athleteId: string, period: Period): Promise<PlannedWorkout[]> {
    const { data, error } = await this.db.from("workouts").select(WORKOUT_COLUMNS)
      .eq("athlete_id", athleteId).eq("status", "approved").gte("planned_date", period.start).lte("planned_date", period.end)
      .order("planned_date").order("slot");
    if (error) throw new Error("Lettura delle sedute non riuscita.");
    type Row = Omit<PlannedWorkout, "remote_event_id"> & { workout_sync?: { provider: string; remote_event_id: number | null }[] };
    return ((data ?? []) as Row[]).map((w) => {
      const { workout_sync, ...rest } = w;
      return { ...rest, remote_event_id: workout_sync?.find((s) => s.provider === "intervals_icu")?.remote_event_id ?? null };
    });
  }

  async draftCount(athleteId: string, period: Period): Promise<number> {
    const { count } = await this.db.from("workouts").select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId).eq("status", "draft").gte("planned_date", period.start).lte("planned_date", period.end);
    return count ?? 0;
  }

  async coachChanges(athleteId: string, period: Period): Promise<CoachChange[]> {
    const { data } = await this.db.from("workout_events").select("workout_id, type, at, note, before, after")
      .eq("athlete_id", athleteId).in("type", ["edited", "moved", "cancelled", "superseded", "restored"])
      .gte("at", `${period.start}T00:00:00Z`).lt("at", `${addDaysISO(period.end, 1)}T00:00:00Z`).order("at");
    const events = (data ?? []) as (CoachChange & { before: { planned_date?: string } | null; after: { planned_date?: string } | null })[];
    if (!events.length) return [];
    const { data: ws } = await this.db.from("workouts").select("id, planned_date").in("id", [...new Set(events.map((e) => e.workout_id))]);
    const dateOf = new Map((ws ?? []).map((w: { id: string; planned_date: string }) => [w.id, w.planned_date]));
    const inPeriod = (d?: string) => !!d && d >= period.start && d <= period.end;
    return events
      .filter((e) => inPeriod(e.before?.planned_date) || inPeriod(e.after?.planned_date) || inPeriod(dateOf.get(e.workout_id)))
      .map((e) => ({ workout_id: e.workout_id, type: e.type, at: e.at, note: e.note }));
  }

  async plans(athleteId: string, from: string, to: string): Promise<PlanWindow[]> {
    const { data } = await this.db.from("training_plans").select("id, start_date, end_date, status, weeks_meta")
      .eq("athlete_id", athleteId).neq("status", "archived").lte("start_date", to).or(`end_date.is.null,end_date.gte.${from}`)
      .order("start_date");
    return (data ?? []) as PlanWindow[];
  }

  async markCompleted(workoutId: string, activityId: string, completedAt: string): Promise<void> {
    await this.db.from("workouts")
      .update({ completed_at: completedAt, completed_activity_id: activityId, completion_source: "intervals" })
      .eq("id", workoutId).is("completed_at", null);
  }
}

// ---------- Intervals.icu (sola lettura) ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function icuGet<T>(apiKey: string, path: string): Promise<Result<T>> {
  const auth = "Basic " + btoa("API_KEY:" + apiKey);
  let lastError = "nessun tentativo";
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`https://intervals.icu/api/v1/athlete/0${path}`, { headers: { Authorization: auth }, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return { ok: true, data: await res.json() as T };
      if (res.status === 401 || res.status === 403) return { ok: false, error: "chiave non valida" };
      lastError = `risposta ${res.status}`;
      if (res.status !== 429 && res.status < 500) return { ok: false, error: lastError };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof DOMException && err.name === "AbortError" ? "nessuna risposta entro 15 s" : "rete non raggiungibile";
    }
    if (attempt < 2) await sleep(attempt ? 3000 : 1000);
  }
  return { ok: false, error: lastError };
}

const intervals: IntervalsPort = {
  activities: (apiKey, oldest, newest) => icuGet<RawActivity[]>(apiKey, `/activities?oldest=${oldest}&newest=${newest}`),
  wellness: (apiKey, oldest, newest) => icuGet<RawWellness[]>(apiKey, `/wellness?oldest=${oldest}&newest=${newest}`),
};

// ---------- Claude ----------
const llm: LlmPort = {
  async generate({ apiKey, model, system, user, tool, maxTokens }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model, max_tokens: maxTokens, system,
          messages: [{ role: "user", content: user }],
          tools: [tool], tool_choice: { type: "tool", name: tool.name },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, error: data?.error?.message || `risposta ${res.status}`, transient: res.status === 429 || res.status >= 500 };
      }
      const block = (data?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
      return { ok: true, toolInput: block?.input ?? null, stopReason: data?.stop_reason ?? "", model: data?.model ?? model };
    } catch (err) {
      clearTimeout(timer);
      const timeout = err instanceof DOMException && err.name === "AbortError";
      return { ok: false, error: timeout ? "nessuna risposta entro 100 s" : "API non raggiungibile", transient: true };
    }
  },
};

function makeDeps(db: SupabaseClient): Deps {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_ADDRESS");
  return {
    store: new SupabaseStore(db),
    intervals,
    llm,
    mail: resendKey && resendFrom ? new ResendEmailSender(resendKey, resendFrom) : null,
    now: () => new Date(),
  };
}

// ---------- Azioni del coach ----------
async function coachAction(db: SupabaseClient, body: Record<string, unknown>) {
  const deps = makeDeps(db);
  const store = deps.store;
  const reviewId = typeof body.review_id === "string" ? body.review_id : "";

  if (body.action === "create") {
    const athleteId = typeof body.athlete_id === "string" ? body.athlete_id : "";
    const weekStart = body.week_start;
    const settings = await store.settings();
    const today = todayISO(settings?.weekly_feedback_timezone || "Europe/Rome");
    if (!athleteId || !isISODate(weekStart) || weekStartISO(weekStart) !== weekStart || weekStart > weekStartISO(today)) {
      return jsonResponse({ error: "Settimana non valida: scegli un lunedì non futuro." }, 400);
    }
    const period = periodOf(weekStart);
    const row = (await store.claim(athleteId, period)) ?? (await store.current(athleteId, period.start));
    if (!row) return jsonResponse({ error: "Creazione della valutazione non riuscita." }, 500);
    const after = await processReview(deps, row.id);
    return jsonResponse({ id: row.id, status: after?.status ?? row.status });
  }

  if (!reviewId) return jsonResponse({ error: "Valutazione mancante." }, 400);
  const row = await store.get(reviewId);
  if (!row) return jsonResponse({ error: "Valutazione non trovata." }, 404);

  if (body.action === "regenerate") {
    const { data, error } = await db.rpc("regenerate_weekly_review", { p_id: reviewId });
    if (error) {
      const busy = error.message.includes("review_busy");
      return jsonResponse({ error: busy ? "La valutazione è in elaborazione: riprova tra poco." : "Rigenerazione non riuscita." }, busy ? 409 : 500);
    }
    const after = await processReview(deps, data as string);
    return jsonResponse({ id: data, status: after?.status ?? "pending" });
  }

  if (body.action === "retry") {
    if (row.status === "analysis_failed") await store.update(row.id, "analysis_failed", { status: "pending", attempts: 0, error: null });
    else if (row.status === "generation_failed") await store.update(row.id, "generation_failed", { status: row.input ? "analyzed" : "pending", attempts: 0, error: null });
    else if (row.status === "approved" && (row.delivery_status === "failed" || row.delivery_status === "skipped")) {
      await store.update(row.id, "approved", { delivery_status: "pending", delivery_attempts: 0, delivery_error: null });
    } else if (row.status === "pending" || row.status === "analyzed") {
      await store.update(row.id, row.status, { attempts: 0 });
    } else return jsonResponse({ error: "Niente da riprovare per questa valutazione." }, 400);
    const after = await processReview(deps, row.id);
    return jsonResponse({ id: row.id, status: after?.status ?? row.status });
  }

  if (body.action === "approve") {
    const res = await approveReview(deps, row.id, typeof body.text === "string" ? body.text : "", body.send !== false);
    if (!res.ok) return jsonResponse({ error: res.error }, 409);
    return jsonResponse({ id: row.id, status: res.row?.status ?? "approved", delivery_status: res.row?.delivery_status });
  }

  return jsonResponse({ error: "Azione non valida." }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo non supportato." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

  try {
    // Invocazione schedulata: solo pg_cron conosce la service-role key (letta da Vault).
    if (bearer === serviceRoleKey) {
      const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
      const result = await runScheduled(makeDeps(db));
      return jsonResponse({ ranAt: new Date().toISOString(), ...result });
    }

    // Azione del coach: JWT di sessione, RLS attiva.
    const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
    const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await db.auth.getUser(bearer);
    if (userError || !userData.user) return jsonResponse({ error: "Non autenticato." }, 401);
    // Solo il coach legge app_settings (RLS): un utente diverso non ottiene la riga.
    const { data: own } = await db.from("app_settings").select("id").eq("id", 1).maybeSingle();
    if (!own) return jsonResponse({ error: "Non autorizzato." }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo della richiesta non è JSON valido." }, 400);
    }
    return await coachAction(db, body);
  } catch (err) {
    console.error("weekly-feedback", err instanceof Error ? err.message : "errore");
    return jsonResponse({ error: "Errore inatteso nel feedback settimanale." }, 500);
  }
});
