// Edge Function athlete-checks (ADR 0037): ogni 30 minuti pg_cron la chiama con la service-role key e,
// per ogni atleta con la chiave Intervals.icu:
// - controlla chiave, zone e soglie rispetto alla scheda e salva il risultato in athlete_checks, letto
//   dalla pagina «Da fare» e dal contatore della barra laterale;
// - aggiorna il carico (CTL, ATL, TSB) nella scheda senza cambiare updated_at, cosi' chi sta modificando
//   la scheda non vede «modificata altrove». La scrittura vale solo se nessuno ha salvato nel frattempo.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { addDaysISO, todayISO } from "../_shared/workouts/calendar.ts";
import { athleteCheck, pickZones } from "../_shared/workouts/athleteChecks.ts";
import { mergeLoadMetrics, syncWindowStart, type IcuWellness, type LoadMetricsEntry } from "../_shared/workouts/loadMetrics.ts";
import type { ProfileLike } from "../_shared/workouts/thresholds.ts";
import { PCOACH_VERSION } from "../_shared/version.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-pcoach-version",
  "x-pcoach-version": PCOACH_VERSION,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

type Profile = ProfileLike & {
  integrations?: { intervals_icu_api_key?: string };
  training_status?: { load_metrics_log?: LoadMetricsEntry[] } & Record<string, unknown>;
} & Record<string, unknown>;

async function icuGet(apiKey: string, path: string): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  try {
    const res = await fetch(`https://intervals.icu/api/v1/athlete/0${path}`, {
      headers: { Authorization: "Basic " + btoa("API_KEY:" + apiKey) },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, status: 0 };
  }
}

interface Summary {
  athletes: number;
  checked: number;
  invalidKeys: number;
  unreachable: number;
  loadUpdated: number;
  loadSkipped: number;
}

async function checkAthlete(db: SupabaseClient, row: { id: string; data: Profile; updated_at: string }, today: string, summary: Summary) {
  const profile = row.data;
  const apiKey = profile?.integrations?.intervals_icu_api_key?.trim();
  if (!apiKey) {
    await db.from("athlete_checks").upsert(athleteCheck(row.id, profile, false, null, null, new Date()));
    return;
  }
  const settings = await icuGet(apiKey, "/sport-settings");
  const check = athleteCheck(row.id, profile, true, settings.ok ? pickZones(settings.data) : null, settings.ok ? null : settings.status, new Date());
  await db.from("athlete_checks").upsert(check);
  summary.checked++;
  if (check.key_status === "invalid") {
    summary.invalidKeys++;
    return;
  }
  if (check.key_status === "unreachable") summary.unreachable++;

  // Carico: stessa finestra e stessa unione dell'app (_shared/workouts/loadMetrics.ts).
  const currentLog = profile.training_status?.load_metrics_log ?? [];
  const oldest = syncWindowStart(currentLog, today);
  const newest = addDaysISO(today, 1);
  const [wellness, activities] = await Promise.all([
    icuGet(apiKey, `/wellness?oldest=${oldest}&newest=${newest}`),
    icuGet(apiKey, `/activities?oldest=${oldest}&newest=${newest}`),
  ]);
  if (!wellness.ok || !activities.ok) return;
  const merged = mergeLoadMetrics(currentLog, wellness.data as IcuWellness[], activities.data as { start_date_local?: string }[]);
  if (!merged.updatedCount) return;
  const data = { ...profile, training_status: { ...(profile.training_status ?? {}), load_metrics_log: merged.log } };
  // updated_at non cambia (strada A, ADR 0037); se nel frattempo il coach ha salvato, si salta e il
  // giro successivo riprova sulla scheda nuova.
  const { data: written } = await db.from("athletes").update({ data }).eq("id", row.id).eq("updated_at", row.updated_at).select("id");
  if (written?.length) summary.loadUpdated++;
  else summary.loadSkipped++;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo non supportato." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
  // Solo pg_cron conosce la service-role key (letta da Vault): nessun altro avvia il giro.
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer !== serviceRoleKey) return jsonResponse({ error: "Non autorizzato." }, 401);

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  try {
    const { data: cfg } = await db.from("app_settings").select("weekly_feedback_timezone").eq("id", 1).maybeSingle();
    const tz = (cfg as { weekly_feedback_timezone?: string } | null)?.weekly_feedback_timezone || "Europe/Rome";
    let today: string;
    try {
      today = todayISO(tz);
    } catch {
      today = todayISO("Europe/Rome"); // fuso salvato non valido: come il feedback, si usa Europe/Rome
    }
    const { data: rows, error } = await db.from("athletes").select("id, data, updated_at");
    if (error) return jsonResponse({ error: "Lettura degli atleti non riuscita." }, 500);
    const summary: Summary = { athletes: rows?.length ?? 0, checked: 0, invalidKeys: 0, unreachable: 0, loadUpdated: 0, loadSkipped: 0 };
    // Un atleta alla volta: pochi atleti, e Intervals.icu non riceve raffiche dalla stessa origine.
    for (const row of (rows ?? []) as { id: string; data: Profile; updated_at: string }[]) {
      try {
        await checkAthlete(db, row, today, summary);
      } catch (err) {
        console.error("athlete-checks", row.id, err instanceof Error ? err.message : "errore");
      }
    }
    return jsonResponse({ ranAt: new Date().toISOString(), ...summary });
  } catch (err) {
    console.error("athlete-checks", err instanceof Error ? err.message : "errore");
    return jsonResponse({ error: "Errore inatteso durante il controllo." }, 500);
  }
});
