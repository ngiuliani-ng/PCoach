// Proxy verso l'API Claude per la generazione delle sedute: Anthropic rifiuta le chiamate dirette dal
// browser (CORS) e la chiave di Claude, in app_settings, non deve raggiungere il client.
// - Chiamante: il token di sessione del coach, non la sola anon key pubblica; l'utente deve poter
//   leggere app_settings con la propria RLS, cioe' essere il coach (stesso controllo di weekly-feedback).
// - Modello: solo quelli ammessi (_shared/claude/models.ts, ADR 0020 e 0041); max_tokens con un tetto;
//   parametri comuni con weekly-feedback in _shared/claude/request.ts.
// - Risposta: solo i blocchi di testo, stop_reason (anche "refusal"), modello effettivo, consumo di token e id, salvati dal client
//   con la generazione per poterla ricostruire.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveModel } from "../_shared/claude/models.ts";
import { ANTHROPIC_MESSAGES_URL, anthropicHeaders, COMMON_BODY, EFFORT, responseText } from "../_shared/claude/request.ts";
import { PCOACH_VERSION } from "../_shared/version.ts";

/** Tetto ai token di risposta: la generazione ne chiede al massimo 23 400 (4 settimane, planMaxTokens). */
const MAX_TOKENS_CAP = 26_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-pcoach-version",
  "x-pcoach-version": PCOACH_VERSION,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non supportato." }, 405);
  }

  let prompt: string | undefined;
  let system: string | undefined;
  let maxTokens: number | undefined;
  let model: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    system = typeof body.system === "string" && body.system.trim() ? body.system : undefined;
    maxTokens = typeof body.max_tokens === "number" ? body.max_tokens : undefined;
    model = body.model;
  } catch {
    return jsonResponse({ error: "Corpo della richiesta non è JSON valido." }, 400);
  }

  if (!prompt || typeof prompt !== "string") {
    return jsonResponse({ error: "Campo 'prompt' mancante o non valido." }, 400);
  }

  // SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono iniettate automaticamente da Supabase
  // in ogni Edge Function del progetto: nessun secret da impostare a mano per queste due.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) {
    return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(bearerToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Non autenticato." }, 401);
  }
  // Solo il coach legge app_settings (RLS): un altro utente autenticato non ottiene la riga.
  const { data: own } = await userClient.from("app_settings").select("id").eq("id", 1).maybeSingle();
  if (!own) {
    return jsonResponse({ error: "Non autorizzato." }, 403);
  }

  let claudeApiKey: string | undefined;
  let configuredModel: string | undefined;
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: row, error } = await admin.from("app_settings").select("claude_api_key, claude_model").eq("id", 1).maybeSingle();
    if (error) throw error;
    claudeApiKey = row?.claude_api_key ?? undefined;
    configuredModel = row?.claude_model ?? undefined;
  } catch {
    return jsonResponse({ error: "Impossibile leggere app_settings da Supabase." }, 500);
  }

  if (!claudeApiKey) {
    return jsonResponse({ error: "Claude API key non configurata in Impostazioni." }, 400);
  }

  try {
    const anthropicRes = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: anthropicHeaders(claudeApiKey),
      body: JSON.stringify({
        model: resolveModel(model, configuredModel),
        max_tokens: Math.min(MAX_TOKENS_CAP, maxTokens && maxTokens > 0 ? maxTokens : 4096),
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
        ...COMMON_BODY,
        output_config: { effort: EFFORT },
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return jsonResponse({ error: data?.error?.message || "Errore dall'API Claude." }, anthropicRes.status);
    }

    const text = responseText(data.content);
    return jsonResponse({ text, stop_reason: data.stop_reason, model: data.model ?? null, usage: data.usage ?? null, id: data.id ?? null });
  } catch {
    return jsonResponse({ error: "Impossibile contattare l'API Claude." }, 502);
  }
});
