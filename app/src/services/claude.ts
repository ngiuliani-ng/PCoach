// Client per la Edge Function "claude-proxy", che chiama Claude lato server (CORS, chiave mai nel
// browser). Restituisce anche modello, stop_reason e consumo di token, salvati con la generazione.
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
}

export type ClaudeProxyResult =
  | { ok: true; text: string; truncated: boolean; stopReason: string | null; model: string | null; usage: ClaudeUsage | null; id: string | null }
  | { ok: false; error: string };

export async function callClaudeProxy(
  prompt: { system: string; user: string },
  maxTokens: number,
  model: string
): Promise<ClaudeProxyResult> {
  const url = supabaseUrl.replace(/\/$/, "") + "/functions/v1/claude-proxy";
  // Il bearer è il token della sessione del coach (non la anon key pubblica): la funzione
  // verifica l'identità del chiamante prima di consumare quota Claude.
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
      body: JSON.stringify({ system: prompt.system, prompt: prompt.user, max_tokens: maxTokens || 4096, model })
    });
    const data = await res.json().catch(() => null);
    // 546: la Edge Function ha superato il limite di durata (150 s) prima della risposta di Claude.
    if (res.status === 546) {
      return { ok: false, error: "Claude ha impiegato più del tempo massimo consentito (150 s): riprova o riduci le settimane." };
    }
    if (!res.ok || !data || data.error) {
      return { ok: false, error: (data && data.error) || `Errore proxy (${res.status})` };
    }
    return {
      ok: true,
      text: data.text || "",
      truncated: data.stop_reason === "max_tokens",
      stopReason: data.stop_reason ?? null,
      model: data.model ?? null,
      usage: data.usage ?? null,
      id: data.id ?? null
    };
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
    // Testo prima o dopo il JSON senza blocco di codice: si prova dalla prima "{" all'ultima "}".
    const from = candidate.indexOf("{");
    const to = candidate.lastIndexOf("}");
    if (from < 0 || to <= from) return null;
    try {
      return JSON.parse(candidate.slice(from, to + 1));
    } catch {
      return null;
    }
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
