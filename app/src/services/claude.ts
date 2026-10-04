// Client per la Edge Function "claude-proxy": porting diretto della funzione
// originale in index.html, che bypassa i limiti CORS chiamando Claude lato server.
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export type ClaudeProxyResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function callClaudeProxy(
  promptText: string,
  maxTokens: number,
  model: string
): Promise<ClaudeProxyResult> {
  const url = supabaseUrl.replace(/\/$/, "") + "/functions/v1/claude-proxy";
  // Il bearer è il token della sessione del coach (non la anon key pubblica): la funzione
  // verifica l'identità del chiamante prima di consumare quota Claude (vedi Fase 9).
  const sessionToken = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!sessionToken) {
    return { ok: false, error: "Sessione non valida: effettua di nuovo l'accesso." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionToken,
        apikey: supabaseAnonKey
      },
      body: JSON.stringify({ prompt: promptText, max_tokens: maxTokens || 4096, model })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      return { ok: false, error: (data && data.error) || `Errore proxy (${res.status})` };
    }
    return { ok: true, text: data.text || "" };
  } catch {
    return { ok: false, error: "Impossibile contattare la Edge Function claude-proxy." };
  }
}

export function extractJsonBlock(text: string): unknown | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

export async function copyToClipboardFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
