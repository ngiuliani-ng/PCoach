// Sincronizzazione delle sedute con il calendario Intervals.icu (ADR 0017).
// Due azioni, entrambe autenticate con il JWT di sessione del coach (come claude-proxy):
// - preview: legge lo stato remoto della settimana (eventi, eventi spariti) e registra come
//   svolte le sedute abbinate a un'attivita' (paired_event_id). Non scrive nulla su Intervals.icu.
// - apply: esegue UNA operazione su UNA seduta (create, update, overwrite, recreate, delete).
//   Il client invoca apply una seduta alla volta: l'avanzamento e' visibile riga per riga e una
//   pagina chiusa a meta' lascia uno stato coerente.
// Il database e' letto e scritto con il JWT del coach (RLS attiva). La chiave Intervals.icu e'
// letta dalla scheda dell'atleta e non compare mai nei log ne' nelle risposte.
//
// Limite verificato nella specifica OpenAPI: upsert e cancellazione per external_id valgono solo
// per eventi creati dalla stessa applicazione OAuth; con le chiavi API personali PCoach memorizza
// l'id dell'evento e opera per id. external_id resta valorizzato per la riconciliazione.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { addDaysISO, isISODate, todayISO } from "../_shared/workouts/calendar.ts";
import { buildIntervalsEvent, expectedTopLevelSteps, externalIdFor, INTERVALS_TYPES } from "../_shared/workouts/intervals.ts";
import type { WorkoutContent } from "../_shared/workouts/structure.ts";
import { validateWorkout } from "../_shared/workouts/structure.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const API = "https://intervals.icu/api/v1/athlete/0";
const TIMEOUT_MS = 10_000;
const RETRIES = 2;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// ---------- Trasporto verso Intervals.icu: timeout, nuovi tentativi, messaggi leggibili ----------
type IcuResult = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string; uncertain: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function icu(apiKey: string, method: string, path: string, body?: unknown): Promise<IcuResult> {
  const auth = "Basic " + btoa("API_KEY:" + apiKey);
  let last: IcuResult = { ok: false, status: 0, error: "Nessun tentativo eseguito.", uncertain: false };
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + path, {
        method,
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (res.ok) return { ok: true, status: res.status, data };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, error: "Chiave Intervals.icu non valida o senza permesso di scrittura sul calendario.", uncertain: false };
      }
      if (res.status === 404) return { ok: false, status: 404, error: "Evento non trovato su Intervals.icu.", uncertain: false };
      if (res.status === 429 || res.status >= 500) {
        last = { ok: false, status: res.status, error: res.status === 429 ? "Intervals.icu ha risposto 429 (troppe richieste)." : `Intervals.icu ha risposto ${res.status}.`, uncertain: false };
        const retryAfter = Number(res.headers.get("Retry-After"));
        if (attempt < RETRIES) await sleep(Math.min(10, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : attempt ? 3 : 1) * 1000);
        continue;
      }
      const detail = typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : "";
      return { ok: false, status: res.status, error: `Intervals.icu ha rifiutato la richiesta (${res.status})${detail ? ": " + detail.slice(0, 200) : ""}.`, uncertain: false };
    } catch (err) {
      clearTimeout(timer);
      const timeout = err instanceof DOMException && err.name === "AbortError";
      // Dopo un timeout o un errore di rete non sappiamo se la scrittura e' avvenuta.
      last = {
        ok: false, status: 0, uncertain: method !== "GET",
        error: timeout ? `Intervals.icu non ha risposto entro ${TIMEOUT_MS / 1000} secondi.` : "Impossibile contattare Intervals.icu.",
      };
      if (attempt < RETRIES) await sleep((attempt ? 3 : 1) * 1000);
    }
  }
  return last;
}

// ---------- Tipi delle righe lette dal database ----------
interface WorkoutRow extends WorkoutContent {
  id: string;
  athlete_id: string;
  status: string;
  revision: number;
  needs_review: string | null;
  completed_at: string | null;
}
interface SyncRowDb {
  workout_id: string;
  remote_event_id: number | null;
  synced_revision: number;
  synced_date: string | null;
  remote_updated: string | null;
  state: string;
  pending_delete: boolean;
  create_uncertain: boolean;
}
interface IcuEvent {
  id: number;
  updated?: string | null;
  external_id?: string | null;
  start_date_local?: string;
  name?: string;
  type?: string;
  workout_doc?: { steps?: unknown[] } | null;
}

const WORKOUT_COLUMNS = "id, athlete_id, status, revision, needs_review, completed_at, planned_date, discipline, title, objective, notes_for_athlete, duration_min, structure, primary_target";

async function athleteKey(db: SupabaseClient, athleteId: string): Promise<string | null> {
  const { data } = await db.from("athletes").select("data").eq("id", athleteId).maybeSingle();
  const key = (data as { data?: { integrations?: { intervals_icu_api_key?: string } } } | null)?.data?.integrations?.intervals_icu_api_key;
  return key && key.trim() ? key.trim() : null;
}

async function logEvent(db: SupabaseClient, w: WorkoutRow, type: string, note: string) {
  await db.from("workout_events").insert({ workout_id: w.id, athlete_id: w.athlete_id, type, revision: w.revision, note });
}

// ---------- preview ----------
async function preview(db: SupabaseClient, athleteId: string, weekStart: string, timezone: string) {
  const apiKey = await athleteKey(db, athleteId);
  if (!apiKey) return jsonResponse({ error: "Questo atleta non ha una chiave Intervals.icu: aggiungila nel Profilo." }, 400);
  const weekEnd = addDaysISO(weekStart, 6);

  const { data: inWeek, error: e1 } = await db.from("workouts").select("id").eq("athlete_id", athleteId).gte("planned_date", weekStart).lte("planned_date", weekEnd);
  if (e1) return jsonResponse({ error: "Lettura delle sedute non riuscita." }, 500);
  const ids = (inWeek ?? []).map((w: { id: string }) => w.id);
  // Anche le sedute spostate fuori dalla settimana il cui evento e' ancora qui.
  const { data: movedRows } = await db.from("workout_sync").select("workout_id").gte("synced_date", weekStart).lte("synced_date", weekEnd);
  const { data: movedOwned } = await db.from("workouts").select("id").eq("athlete_id", athleteId).in("id", (movedRows ?? []).map((r: { workout_id: string }) => r.workout_id));
  (movedOwned ?? []).forEach((w: { id: string }) => { if (!ids.includes(w.id)) ids.push(w.id); });

  const { data: syncRows } = ids.length
    ? await db.from("workout_sync").select("workout_id, remote_event_id, synced_date").in("workout_id", ids)
    : { data: [] as SyncRowDb[] };
  const remoteIds = new Set((syncRows ?? []).map((r: { remote_event_id: number | null }) => r.remote_event_id).filter((x): x is number => x != null));

  const list = await icu(apiKey, "GET", `/events?oldest=${weekStart}&newest=${weekEnd}&category=WORKOUT`);
  if (!list.ok) return jsonResponse({ error: list.error }, 502);
  const events = (Array.isArray(list.data) ? list.data : []) as IcuEvent[];
  const known = new Map<number, IcuEvent>(events.map((e) => [e.id, e]));
  const missingIds: number[] = [];
  for (const id of remoteIds) {
    if (known.has(id)) continue;
    const one = await icu(apiKey, "GET", `/events/${id}`);
    if (one.ok) known.set(id, one.data as IcuEvent);
    else if (one.status === 404) missingIds.push(id);
  }

  // Esecuzione: un'attivita' abbinata all'evento rende la seduta svolta.
  let completed = 0;
  const today = todayISO(timezone);
  if (remoteIds.size && weekStart <= today) {
    const acts = await icu(apiKey, "GET", `/activities?oldest=${weekStart}&newest=${weekEnd < today ? weekEnd : today}`);
    if (acts.ok && Array.isArray(acts.data)) {
      const byEvent = new Map<number, { id: string; start: string | null }>();
      for (const a of acts.data as Array<{ id?: string | number; paired_event_id?: number | null; start_date_local?: string }>) {
        if (a.paired_event_id != null && remoteIds.has(a.paired_event_id)) byEvent.set(a.paired_event_id, { id: String(a.id ?? ""), start: a.start_date_local ?? null });
      }
      for (const r of syncRows ?? []) {
        const hit = r.remote_event_id != null ? byEvent.get(r.remote_event_id) : undefined;
        if (!hit) continue;
        const { data: upd } = await db.from("workouts")
          .update({ completed_at: hit.start ? new Date(hit.start).toISOString() : new Date().toISOString(), completed_activity_id: hit.id, completion_source: "intervals" })
          .eq("id", r.workout_id).is("completed_at", null).select("id");
        completed += upd?.length ?? 0;
      }
    }
  }

  return jsonResponse({
    remote: { events: [...known.values()].map((e) => ({ id: e.id, updated: e.updated ?? null })), missingIds },
    completed,
  });
}

// ---------- apply ----------
type ApplyOp = "create" | "update" | "overwrite" | "recreate" | "delete";

async function apply(db: SupabaseClient, athleteId: string, workoutId: string, op: ApplyOp, expectedRevision: number) {
  const { data: w } = await db.from("workouts").select(WORKOUT_COLUMNS).eq("id", workoutId).eq("athlete_id", athleteId).maybeSingle();
  if (!w) return jsonResponse({ error: "Seduta non trovata." }, 404);
  const workout = w as WorkoutRow;
  if (workout.revision !== expectedRevision) {
    return jsonResponse({ error: "Modificata durante la sincronizzazione: riapri l'anteprima.", code: "stale" }, 409);
  }
  const apiKey = await athleteKey(db, athleteId);
  if (!apiKey) return jsonResponse({ error: "Questo atleta non ha una chiave Intervals.icu." }, 400);
  const { data: rowData } = await db.from("workout_sync").select("*").eq("workout_id", workoutId).eq("provider", "intervals_icu").maybeSingle();
  const row = rowData as SyncRowDb | null;
  const now = new Date().toISOString();

  const saveRow = async (patch: Partial<SyncRowDb> & Record<string, unknown>) => {
    await db.from("workout_sync").upsert({
      workout_id: workoutId, provider: "intervals_icu", external_id: externalIdFor(workoutId),
      remote_event_id: row?.remote_event_id ?? null, synced_revision: row?.synced_revision ?? 0,
      synced_date: row?.synced_date ?? null, remote_updated: row?.remote_updated ?? null,
      state: row?.state ?? "error", pending_delete: row?.pending_delete ?? false,
      create_uncertain: row?.create_uncertain ?? false, last_attempt_at: now, ...patch,
    });
  };

  if (op === "delete") {
    if (!(workout.status === "cancelled" || workout.status === "superseded") || !row?.pending_delete || row.remote_event_id == null) {
      return jsonResponse({ error: "Questa seduta non è da rimuovere da Intervals.icu." }, 400);
    }
    if (workout.completed_at) return jsonResponse({ error: "Una seduta svolta non si rimuove da Intervals.icu." }, 400);
    const res = await icu(apiKey, "DELETE", `/events/${row.remote_event_id}`);
    if (!res.ok && res.status !== 404) {
      await saveRow({ last_error: res.error });
      await logEvent(db, workout, "sync_failed", `Rimozione da Intervals.icu non riuscita: ${res.error}`);
      return jsonResponse({ ok: false, error: res.error });
    }
    await saveRow({ state: "removed", pending_delete: false, remote_event_id: null, last_error: null });
    await logEvent(db, workout, "remote_deleted", "Rimossa da Intervals.icu");
    return jsonResponse({ ok: true, outcome: "deleted" });
  }

  if (workout.status !== "approved") return jsonResponse({ error: "Solo le sedute approvate si inviano a Intervals.icu." }, 400);
  if (workout.needs_review) return jsonResponse({ error: workout.needs_review }, 400);
  const errors = validateWorkout(workout);
  if (Object.keys(errors).length) return jsonResponse({ error: Object.values(errors)[0] }, 400);
  const payload = buildIntervalsEvent(workoutId, workout);

  let targetId: number | null = op === "recreate" ? null : row?.remote_event_id ?? null;
  // Riconciliazione prima di creare: se un tentativo precedente e' andato a buon fine ma la
  // risposta e' andata persa, l'evento esiste gia' e non va duplicato.
  if (targetId == null) {
    const day = workout.planned_date;
    const found = await icu(apiKey, "GET", `/events?oldest=${day}&newest=${day}&category=WORKOUT`);
    if (found.ok && Array.isArray(found.data)) {
      const events = found.data as IcuEvent[];
      const byExternal = events.find((e) => e.external_id === payload.external_id);
      const byFingerprint = row?.create_uncertain
        ? events.find((e) => e.name === payload.name && e.type === INTERVALS_TYPES[workout.discipline])
        : undefined;
      targetId = (byExternal ?? byFingerprint)?.id ?? null;
    }
  }

  let res: IcuResult;
  if (targetId == null) {
    await saveRow({ create_uncertain: true });
    res = await icu(apiKey, "POST", "/events", payload);
  } else {
    res = await icu(apiKey, "PUT", `/events/${targetId}`, payload);
  }

  if (!res.ok) {
    const missing = res.status === 404;
    await saveRow({
      state: "error",
      last_error: missing ? "L'evento non esiste più su Intervals.icu." : res.error,
      create_uncertain: targetId == null && res.uncertain,
      ...(missing ? { remote_event_id: null } : {}),
    });
    await logEvent(db, workout, "sync_failed", `Invio a Intervals.icu non riuscito: ${missing ? "evento non trovato" : res.error}`);
    return jsonResponse({ ok: false, error: missing ? "L'evento non esiste più su Intervals.icu: riapri l'anteprima per ricrearlo." : res.error });
  }

  const ev = res.data as IcuEvent;
  // Verifica: Intervals.icu restituisce la struttura che ha letto dal testo.
  const expected = expectedTopLevelSteps(workout);
  const got = Array.isArray(ev?.workout_doc?.steps) ? ev.workout_doc!.steps!.length : null;
  const warning = expected && got !== null && got !== expected
    ? `Intervals.icu ha letto ${got} step invece di ${expected}: controlla la seduta sul suo calendario.`
    : null;
  await saveRow({
    remote_event_id: ev?.id ?? targetId, synced_revision: workout.revision, synced_date: workout.planned_date,
    remote_updated: ev?.updated ?? null, state: "synced", pending_delete: false, create_uncertain: false,
    last_error: null, last_warning: warning, synced_at: now,
  });
  const verb = targetId == null ? "Inviata a Intervals.icu" : op === "overwrite" ? "Versione di Intervals.icu sovrascritta" : "Aggiornata su Intervals.icu";
  await logEvent(db, workout, "synced", `${verb} (revisione ${workout.revision})${warning ? ". " + warning : ""}`);
  return jsonResponse({ ok: true, outcome: targetId == null ? "created" : "updated", warning });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo non supportato." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  // La sola anon key non basta: serve la sessione del coach.
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  if (userError || !userData.user) return jsonResponse({ error: "Non autenticato." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo della richiesta non è JSON valido." }, 400);
  }
  const athleteId = typeof body.athlete_id === "string" ? body.athlete_id : "";
  if (!athleteId) return jsonResponse({ error: "Atleta mancante." }, 400);

  try {
    if (body.action === "preview") {
      if (!isISODate(body.week_start)) return jsonResponse({ error: "Settimana non valida." }, 400);
      const { data: settings } = await db.from("app_settings").select("weekly_feedback_timezone").eq("id", 1).maybeSingle();
      return await preview(db, athleteId, body.week_start, (settings as { weekly_feedback_timezone?: string } | null)?.weekly_feedback_timezone || "Europe/Rome");
    }
    if (body.action === "apply") {
      const op = body.op as ApplyOp;
      if (!["create", "update", "overwrite", "recreate", "delete"].includes(op)) return jsonResponse({ error: "Operazione non valida." }, 400);
      if (typeof body.workout_id !== "string" || typeof body.expected_revision !== "number") return jsonResponse({ error: "Seduta mancante." }, 400);
      return await apply(db, athleteId, body.workout_id, op, body.expected_revision);
    }
    return jsonResponse({ error: "Azione non valida." }, 400);
  } catch (err) {
    console.error("intervals-sync", err instanceof Error ? err.message : "errore");
    return jsonResponse({ error: "Errore inatteso durante la sincronizzazione." }, 500);
  }
});
