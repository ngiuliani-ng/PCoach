// Client della Edge Function "weekly-feedback" per le azioni del coach (ADR 0019): crea la
// valutazione di una settimana, la rigenera, la riprova dopo un errore, la approva. Stesso
// schema di autenticazione di intervalsSync.ts (token di sessione).
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

type Response<T> = { ok: true; data: T } | { ok: false; error: string };
type Outcome = { id: string; status: string; delivery_status?: string };

async function call(body: Record<string, unknown>): Promise<Response<Outcome>> {
  const sessionToken = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!sessionToken) return { ok: false, error: "Sessione non valida: effettua di nuovo l'accesso." };
  try {
    const res = await fetch(supabaseUrl.replace(/\/$/, "") + "/functions/v1/weekly-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionToken, apikey: supabaseAnonKey },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) return { ok: false, error: (data && data.error) || `Errore del feedback (${res.status}).` };
    return { ok: true, data: data as Outcome };
  } catch {
    return { ok: false, error: "Impossibile contattare il servizio del feedback." };
  }
}

export const createReview = (athleteId: string, weekStart: string) => call({ action: "create", athlete_id: athleteId, week_start: weekStart });
export const regenerateReview = (reviewId: string) => call({ action: "regenerate", review_id: reviewId });
export const retryReview = (reviewId: string) => call({ action: "retry", review_id: reviewId });
export const approveReview = (reviewId: string, text: string, send = true) => call({ action: "approve", review_id: reviewId, text, send });
