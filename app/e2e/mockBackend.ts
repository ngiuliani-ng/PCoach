// Backend finto per i test end-to-end: una PostgREST minima in memoria (filtri eq, in, gte,
// lte, is; insert, upsert, update, delete; .single()), le due funzioni SQL e le Edge Function
// claude-proxy e intervals-sync. Emula anche il trigger che incrementa la revisione.
import type { Page, Route } from "@playwright/test";

export const SUPABASE_URL = "http://e2e.supabase.test";
export const ATHLETE_ID = "ATL00001";
export const TODAY = "2026-10-10"; // sabato

type Row = Record<string, unknown>;

export interface MockState {
  tables: Record<string, Row[]>;
  claudeResponse: unknown;
  /** Id delle sedute la cui prima apply di sincronizzazione fallisce. */
  failOnceIds: Set<string>;
  applyCalls: { workout_id: string; op: string }[];
  rpcCalls: { name: string; body: unknown }[];
}

let seq = 1;
const uuid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;

function step(seconds: number, zone: number, role = "steady") {
  return { kind: "step", role, duration: { type: "time", seconds }, target: { zone } };
}

function workout(over: Row): Row {
  return {
    id: uuid(), athlete_id: ATHLETE_ID, plan_id: "plan-1", generation_id: null, slot: 0,
    discipline: "running", title: "Corsa", objective: "", notes_for_athlete: "", duration_min: null,
    structure: { version: 2, steps: [step(2700, 2)] }, primary_target: "pace", status: "approved",
    superseded_by: null, locked: false, needs_review: null, completed_at: null, completed_activity_id: null,
    completion_source: null, revision: 1, created_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-27T10:00:00Z",
    ...over
  };
}

export function createState(): MockState {
  const profile = {
    schema_version: "1.4.0",
    meta: { athlete_id: ATHLETE_ID, coach_id: "", created_at: "2026-09-01", updated_at: "2026-09-01", data_source: "manual" },
    identity: { nome: "Giulia", cognome: "Ferri", email: "", birth_year: 1990, biological_sex: "unspecified", height_cm: 168, weight_kg: 58 },
    disciplines: ["running", "cycling"].map((sport) => ({
      sport, level: "intermedio", years_practice: 5,
      current_weekly_volume: { value: 30, unit: "km" }, peak_weekly_volume_last_12_months: { value: 50, unit: "km" }
    })),
    physiological_thresholds: {
      running: { zone_system: "7-zone", thresholds_log: [] },
      cycling: { zone_system: "7-zone", thresholds_log: [{ date: "2026-09-01", source: "manual", ftp_watts: 230 }] },
      swimming: { thresholds_log: [] }
    },
    training_status: { detraining_period: { active: false, cause: "lavoro", severity: "lieve_riduzione" }, load_metrics_log: [], lifestyle_factors: [], lifestyle_factors_note: "" },
    goals: { primary_objective: "forma_fisica_generale", primary_objective_detail: "", secondary_objective: "", secondary_objective_detail: "", periodization_model: "continuous_improvement", target_events: [] },
    constraints: { days_available: ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"].map((day) => ({ day, active: true, fixed_activity: "" })), sessions_per_week_target: 5 },
    methodology_preferences: { intensity_distribution_model: "polarizzato_80_20", load_deload_pattern: "3:1" },
    notes_free_text: "",
    integrations: { intervals_icu_api_key: "chiave-di-prova" },
    training_plan: null,
    weekly_feedback_log: []
  };
  const bikeDraft = workout({
    planned_date: "2026-10-13", discipline: "cycling", title: "VO2max 5 × 4'", status: "draft", primary_target: "power",
    structure: { version: 2, steps: [step(900, 2, "warmup"), { kind: "repeat", count: 5, label: "Serie principale", steps: [step(240, 5, "work"), step(240, 1, "recovery")] }, step(600, 1, "cooldown")] }
  });
  const runApproved = workout({ planned_date: "2026-10-12", title: "Corsa rigenerativa" });
  const runSynced = workout({ planned_date: "2026-10-15", title: "Tempo", revision: 2 });
  const strengthCancelled = workout({ planned_date: "2026-10-16", discipline: "strength", title: "Forza massima", status: "cancelled", structure: null, duration_min: 45, primary_target: "none" });
  const longRun = workout({ planned_date: "2026-10-18", title: "Lungo" });
  return {
    tables: {
      athletes: [{ id: ATHLETE_ID, data: profile, updated_at: "2026-10-01T10:00:00Z" }],
      app_settings: [{ id: 1, claude_api_key: "e2e", claude_model: "claude-sonnet-4-5", plan_generation_prompt_template: null, weekly_feedback_prompt_template: null, weekly_feedback_day: "domenica", weekly_feedback_time: "08:00", weekly_feedback_timezone: "Europe/Rome", weekly_feedback_email_enabled: false }],
      training_plans: [{ id: "plan-1", athlete_id: ATHLETE_ID, name: "Base autunnale", status: "active", start_date: "2026-09-28", end_date: "2026-11-08", ended_at: null, end_reason: null, weeks_meta: [{ week_start: "2026-10-12", label: "Carico", is_deload: false }], created_at: "2026-09-27T10:00:00Z" }],
      plan_generations: [],
      workouts: [runApproved, bikeDraft, runSynced, strengthCancelled, longRun],
      workout_sync: [
        { workout_id: runSynced.id, provider: "intervals_icu", remote_event_id: 501, external_id: `pcoach:${runSynced.id}`, synced_revision: 1, synced_date: "2026-10-15", remote_updated: "t1", state: "synced", pending_delete: false, create_uncertain: false, last_error: null, last_warning: null },
        { workout_id: strengthCancelled.id, provider: "intervals_icu", remote_event_id: 502, external_id: `pcoach:${strengthCancelled.id}`, synced_revision: 1, synced_date: "2026-10-16", remote_updated: "t1", state: "synced", pending_delete: true, create_uncertain: false, last_error: null, last_warning: null },
        { workout_id: longRun.id, provider: "intervals_icu", remote_event_id: 503, external_id: `pcoach:${longRun.id}`, synced_revision: 1, synced_date: "2026-10-18", remote_updated: "t1", state: "synced", pending_delete: false, create_uncertain: false, last_error: null, last_warning: null }
      ],
      workout_events: []
    },
    claudeResponse: null,
    failOnceIds: new Set(),
    applyCalls: [],
    rpcCalls: []
  };
}

const CONTENT = ["planned_date", "discipline", "title", "objective", "notes_for_athlete", "duration_min", "structure", "primary_target"];

function matches(row: Row, key: string, raw: string): boolean {
  const neg = raw.startsWith("not.");
  const expr = neg ? raw.slice(4) : raw;
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const val = decodeURIComponent(expr.slice(dot + 1));
  const v = row[key];
  let ok: boolean;
  switch (op) {
    case "eq": ok = String(v) === val; break;
    case "gte": ok = String(v) >= val; break;
    case "lte": ok = String(v) <= val; break;
    case "is": ok = val === "null" ? v === null || v === undefined : String(v) === val; break;
    case "in": ok = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v)); break;
    default: ok = true;
  }
  return neg ? !ok : ok;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function filterRows(state: MockState, table: string, params: URLSearchParams): Row[] {
  let rows = state.tables[table] ?? [];
  const embedWorkouts = (params.get("select") ?? "").includes("workouts!inner");
  if (embedWorkouts) {
    rows = rows.map((r) => ({ ...r, workouts: { athlete_id: state.tables.workouts.find((w) => w.id === r.workout_id)?.athlete_id } }));
  }
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key.includes(".")) {
      const [rel, col] = key.split(".");
      rows = rows.filter((r) => matches((r[rel] ?? {}) as Row, col, value));
    } else {
      rows = rows.filter((r) => matches(r, key, value));
    }
  }
  const limit = params.get("limit");
  return limit ? rows.slice(0, Number(limit)) : rows;
}

async function fulfillJson(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...headers }, body: JSON.stringify(body) });
}

async function handleRest(state: MockState, route: Route, table: string, params: URLSearchParams) {
  const req = route.request();
  const method = req.method();
  const accept = req.headers()["accept"] ?? "";
  const prefer = req.headers()["prefer"] ?? "";
  const single = accept.includes("vnd.pgrst.object");
  const respond = (rows: Row[]) => {
    if (single) return rows.length ? fulfillJson(route, rows[0]) : fulfillJson(route, { message: "0 rows", code: "PGRST116" }, 406);
    return fulfillJson(route, rows, 200, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  };
  state.tables[table] ??= [];
  if (method === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": `0-0/${state.tables[table].length}`, "access-control-allow-origin": "*" } });
  if (method === "GET") return respond(filterRows(state, table, params));
  if (method === "POST") {
    const body = req.postDataJSON();
    const items: Row[] = Array.isArray(body) ? body : [body];
    const out: Row[] = [];
    for (const item of items) {
      if (prefer.includes("merge-duplicates")) {
        const key = table === "workout_sync" ? "workout_id" : "id";
        const existing = state.tables[table].find((r) => r[key] === item[key]);
        if (existing) { Object.assign(existing, item); out.push(existing); continue; }
      }
      const row: Row = { id: item.id ?? uuid(), created_at: new Date().toISOString(), ...item };
      if (table === "workouts") row.revision = 1;
      state.tables[table].push(row);
      out.push(row);
    }
    return respond(out);
  }
  if (method === "PATCH") {
    const patch = req.postDataJSON() as Row;
    const rows = filterRows(state, table, params);
    for (const r of rows) {
      const contentChanged = table === "workouts" && CONTENT.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(r[k]));
      Object.assign(r, patch);
      if (contentChanged) r.revision = Number(r.revision) + 1;
      if (table === "workouts" && (patch.status === "cancelled" || patch.status === "superseded")) {
        const s = state.tables.workout_sync.find((x) => x.workout_id === r.id);
        if (s && s.remote_event_id != null) s.pending_delete = true;
      }
    }
    return respond(rows);
  }
  if (method === "DELETE") {
    const rows = filterRows(state, table, params);
    state.tables[table] = state.tables[table].filter((r) => !rows.includes(r));
    return respond(rows);
  }
  return fulfillJson(route, { message: "metodo non gestito" }, 405);
}

function applyGeneration(state: MockState, p: Row): string {
  const planId = uuid();
  state.tables.training_plans.forEach((pl) => { if (pl.status === "active") pl.status = "ended"; });
  const plan = p.plan as Row;
  state.tables.training_plans.push({ id: planId, athlete_id: p.athlete_id, name: plan.name, status: "active", start_date: plan.start_date, end_date: plan.end_date, weeks_meta: plan.weeks_meta, created_at: new Date().toISOString() });
  for (const s of p.supersede as Row[]) {
    const w = state.tables.workouts.find((x) => x.id === s.id)!;
    w.status = "superseded";
    const sync = state.tables.workout_sync.find((x) => x.workout_id === w.id);
    if (sync && sync.remote_event_id != null) sync.pending_delete = true;
  }
  for (const k of p.keep as Row[]) state.tables.workouts.find((x) => x.id === k.id)!.plan_id = planId;
  for (const i of p.insert as Row[]) {
    const { replaces, ...rest } = i;
    const row = workout({ ...rest, plan_id: planId, status: "draft" });
    state.tables.workouts.push(row);
    if (replaces) state.tables.workouts.find((x) => x.id === replaces)!.superseded_by = row.id;
  }
  const gen = state.tables.plan_generations.find((g) => g.id === p.generation_id);
  if (gen) gen.status = "applied";
  return planId;
}

export async function installMockBackend(page: Page, state: MockState) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
  await page.addInitScript(([key]) => {
    const session = {
      access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 3600,
      expires_at: 1924992000, user: { id: "coach-e2e", aud: "authenticated", role: "authenticated", email: "coach@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" }
    };
    window.localStorage.setItem(key, JSON.stringify(session));
  }, ["sb-e2e-auth-token"]);

  // La sincronizzazione del carico parte dal browser: nessuna richiesta reale a Intervals.icu.
  await page.route("https://intervals.icu/**", (route) => fulfillJson(route, []));

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    }
    const url = new URL(req.url());
    const path = url.pathname;
    if (path.startsWith("/auth/v1/")) return fulfillJson(route, { id: "coach-e2e", aud: "authenticated", role: "authenticated", email: "coach@example.com" });
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop()!;
      const body = req.postDataJSON() as { p: Row };
      state.rpcCalls.push({ name, body });
      if (name === "apply_plan_generation") return fulfillJson(route, applyGeneration(state, body.p));
      return fulfillJson(route, null);
    }
    if (path.startsWith("/rest/v1/")) return handleRest(state, route, path.split("/").pop()!, url.searchParams);
    if (path === "/functions/v1/claude-proxy") {
      return fulfillJson(route, { text: "```json\n" + JSON.stringify(state.claudeResponse) + "\n```", stop_reason: "end_turn" });
    }
    if (path === "/functions/v1/intervals-sync") {
      const body = req.postDataJSON() as Row;
      if (body.action === "preview") {
        return fulfillJson(route, { remote: { events: [{ id: 501, updated: "t1" }, { id: 502, updated: "t1" }, { id: 503, updated: "t1" }], missingIds: [] }, completed: 0 });
      }
      const id = String(body.workout_id);
      state.applyCalls.push({ workout_id: id, op: String(body.op) });
      if (state.failOnceIds.has(id)) {
        state.failOnceIds.delete(id);
        return fulfillJson(route, { ok: false, error: "Intervals.icu ha risposto 429 (troppe richieste)." });
      }
      const w = state.tables.workouts.find((x) => x.id === id)!;
      const existing = state.tables.workout_sync.find((x) => x.workout_id === id);
      if (body.op === "delete") {
        Object.assign(existing!, { state: "removed", pending_delete: false, remote_event_id: null });
      } else {
        const row = { workout_id: id, provider: "intervals_icu", remote_event_id: existing?.remote_event_id ?? 600 + seq++, external_id: `pcoach:${id}`, synced_revision: w.revision, synced_date: w.planned_date, remote_updated: "t2", state: "synced", pending_delete: false, create_uncertain: false, last_error: null, last_warning: null };
        if (existing) Object.assign(existing, row);
        else state.tables.workout_sync.push(row);
      }
      return fulfillJson(route, { ok: true, outcome: body.op === "delete" ? "deleted" : existing ? "updated" : "created", warning: null });
    }
    return fulfillJson(route, { error: "non gestito" }, 404);
  });
}
