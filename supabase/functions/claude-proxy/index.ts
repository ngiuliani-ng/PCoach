// Proxy verso l'API Claude: bypassa il blocco CORS sulle chiamate dirette da browser
// (verificato: api.anthropic.com rifiuta le richieste cross-origin salvo l'header
// "dangerous" sconsigliato da Anthropic stessa — vedi docs/specifica-tecnica.md §5.5).
// La Claude API key vive in Supabase (tabella app_settings) e non lascia mai questa funzione.
// Fase 9: il bearer deve essere il token di sessione del coach, non la sola anon key
// pubblica — altrimenti chiunque conoscesse la anon key potrebbe consumare quota Claude
// a carico del coach. Verificato via auth.getUser() con la service-role key.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  let maxTokens: number | undefined;
  let model: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    maxTokens = body.max_tokens;
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
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(bearerToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Non autenticato." }, 401);
  }

  let claudeApiKey: string | undefined;
  let claudeModel = model;
  try {
    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=claude_api_key,claude_model`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const rows = await settingsRes.json();
    claudeApiKey = rows?.[0]?.claude_api_key;
    claudeModel = claudeModel || rows?.[0]?.claude_model;
  } catch {
    return jsonResponse({ error: "Impossibile leggere app_settings da Supabase." }, 500);
  }

  if (!claudeApiKey) {
    return jsonResponse({ error: "Claude API key non configurata in Impostazioni." }, 400);
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: claudeModel || "claude-sonnet-4-5",
        max_tokens: maxTokens || 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return jsonResponse({ error: data?.error?.message || "Errore dall'API Claude." }, anthropicRes.status);
    }

    const text = (data.content || [])
      .map((block: { type: string; text?: string }) => block.text || "")
      .join("\n");
    return jsonResponse({ text, stop_reason: data.stop_reason });
  } catch {
    return jsonResponse({ error: "Impossibile contattare l'API Claude." }, 502);
  }
});
