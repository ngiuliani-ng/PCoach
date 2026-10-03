// Client per la Edge Function "claude-proxy": porting diretto della funzione
// originale in index.html, che bypassa i limiti CORS chiamando Claude lato server.
import { supabaseUrl, supabaseAnonKey } from "./supabase";

export type ClaudeProxyResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function callClaudeProxy(
  promptText: string,
  maxTokens: number,
  model: string
): Promise<ClaudeProxyResult> {
  const url = supabaseUrl.replace(/\/$/, "") + "/functions/v1/claude-proxy";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + supabaseAnonKey,
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
