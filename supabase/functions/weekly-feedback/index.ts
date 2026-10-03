// Edge Function schedulata per il feedback settimanale (Fase 7): per ogni atleta con piano
// e chiave Intervals.icu, confronta la settimana pianificata con quella reale, genera un
// feedback con Claude, lo salva in weekly_feedback_log e invia un'email opzionale.
// Pensata per essere invocata frequentemente (es. ogni ora) da pg_cron: internamente verifica
// se il momento attuale corrisponde a giorno/ora configurati in app_settings e non fa nulla
// altrimenti, cosi' le impostazioni modificabili dall'UI (§9.1) sono effettive senza dover
// toccare la configurazione del cron (vedi docs/DOCUMENTAZIONE.md §6/§10).
// Duplicazione deliberata della logica di app/src/services/intervals.ts e planPrompt.ts:
// le Edge Function Deno non possono importare moduli TypeScript da app/src (runtime/bundling
// separati).
import { ResendEmailSender } from "../_shared/resendEmailSender.ts";
import type { EmailSender } from "../_shared/emailSender.ts";

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

function todayISO(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ENGLISH_TO_DAY_KEY: Record<string, string> = {
  Sunday: "domenica", Monday: "lunedi", Tuesday: "martedi", Wednesday: "mercoledi",
  Thursday: "giovedi", Friday: "venerdi", Saturday: "sabato"
};

function currentDayAndHour(timeZone: string): { day: string; hour: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  let hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  if (hour === "24") hour = "00";
  return { day: ENGLISH_TO_DAY_KEY[weekday] ?? "", hour: hour.padStart(2, "0") };
}

function fullName(identity: { nome?: string; cognome?: string } | undefined): string {
  return [identity?.nome, identity?.cognome].filter((p) => p && p.trim()).join(" ");
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value), template);
}

function buildFeedbackPrompt(
  identity: { nome?: string; cognome?: string } | undefined,
  plannedWeek: unknown[],
  realWeek: unknown[],
  template: string
): string {
  return interpolate(template, {
    nome_atleta: fullName(identity),
    settimana_pianificata_json: JSON.stringify(plannedWeek, null, 2),
    settimana_reale_json: JSON.stringify(realWeek, null, 2)
  });
}

type FetchActivitiesResult = { ok: true; activities: unknown[] } | { ok: false; error: string };

async function fetchLastWeekActivities(apiKey: string, oldest: string, newest: string): Promise<FetchActivitiesResult> {
  try {
    const auth = "Basic " + btoa("API_KEY:" + apiKey);
    const res = await fetch(`https://intervals.icu/api/v1/athlete/0/activities?oldest=${oldest}&newest=${newest}`, { headers: { Authorization: auth } });
    if (res.status === 401) return { ok: false, error: "API key di Intervals.icu non valida." };
    if (!res.ok) return { ok: false, error: `Errore Intervals.icu (${res.status}).` };
    const activities = await res.json();
    return { ok: true, activities };
  } catch {
    return { ok: false, error: "Impossibile contattare Intervals.icu (rete o CORS)." };
  }
}

// deno-lint-ignore no-explicit-any
function plannedWeekFromPlan(trainingPlan: any, oldest: string, newest: string): unknown[] {
  if (!trainingPlan?.weeks) return [];
  const sessions: unknown[] = [];
  // deno-lint-ignore no-explicit-any
  trainingPlan.weeks.forEach((week: any) => {
    // deno-lint-ignore no-explicit-any
    (week.sessions || []).forEach((s: any) => {
      if (s?.date && s.date >= oldest && s.date <= newest) sessions.push(s);
    });
  });
  return sessions;
}

type ClaudeResult = { ok: true; text: string } | { ok: false; error: string };

async function callClaude(prompt: string, maxTokens: number, model: string, apiKey: string): Promise<ClaudeResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message || "Errore dall'API Claude." };
    const text = (data.content || []).map((b: { type: string; text?: string }) => b.text || "").join("\n");
    return { ok: true, text };
  } catch {
    return { ok: false, error: "Impossibile contattare l'API Claude." };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configurazione Supabase mancante nella Edge Function." }, 500);
  }
  const restHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };

  // deno-lint-ignore no-explicit-any
  let settings: any;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=*`, { headers: restHeaders });
    const rows = await res.json();
    settings = rows?.[0];
  } catch {
    return jsonResponse({ error: "Impossibile leggere app_settings da Supabase." }, 500);
  }
  if (!settings) return jsonResponse({ error: "app_settings non configurata." }, 500);

  const timezone: string = settings.weekly_feedback_timezone || "Europe/Rome";
  const configuredDay: string = settings.weekly_feedback_day || "domenica";
  const configuredTime: string = settings.weekly_feedback_time || "08:00";
  const configuredHour = configuredTime.slice(0, 2).padStart(2, "0");

  const { day: currentDay, hour: currentHour } = currentDayAndHour(timezone);
  if (currentDay !== configuredDay || currentHour !== configuredHour) {
    return jsonResponse({ skipped: true, reason: "Fuori dalla finestra schedulata.", currentDay, currentHour, configuredDay, configuredHour });
  }

  if (!settings.claude_api_key) {
    return jsonResponse({ error: "Claude API key non configurata in Impostazioni." }, 400);
  }

  const newest = todayISO(timezone);
  const oldest = addDaysISO(newest, -7);

  let emailSender: EmailSender | null = null;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_ADDRESS");
  if (settings.weekly_feedback_email_enabled && resendApiKey && resendFrom) {
    emailSender = new ResendEmailSender(resendApiKey, resendFrom);
  }

  // deno-lint-ignore no-explicit-any
  let athletes: Array<{ id: string; data: any; updated_at: string }> = [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/athletes?select=id,data,updated_at`, { headers: restHeaders });
    athletes = await res.json();
  } catch {
    return jsonResponse({ error: "Impossibile leggere athletes da Supabase." }, 500);
  }

  const results: Array<{ athleteId: string; status: string; detail?: string }> = [];

  for (const row of athletes) {
    const athleteId = row.id;
    try {
      const profile = row.data;
      const apiKey = profile?.integrations?.intervals_icu_api_key;
      if (!apiKey) {
        results.push({ athleteId, status: "skipped", detail: "Nessuna API key Intervals.icu." });
        continue;
      }
      if (!profile?.training_plan) {
        results.push({ athleteId, status: "skipped", detail: "Nessun piano assegnato." });
        continue;
      }
      const existingLog: Array<{ date: string }> = profile.weekly_feedback_log || [];
      if (existingLog.some((e) => e.date === newest)) {
        results.push({ athleteId, status: "skipped", detail: "Feedback già generato per questa settimana." });
        continue;
      }

      const actRes = await fetchLastWeekActivities(apiKey, oldest, newest);
      if (!actRes.ok) {
        results.push({ athleteId, status: "error", detail: actRes.error });
        continue;
      }
      const plannedWeek = plannedWeekFromPlan(profile.training_plan, oldest, newest);
      const prompt = buildFeedbackPrompt(profile.identity, plannedWeek, actRes.activities, settings.weekly_feedback_prompt_template);
      const claudeRes = await callClaude(prompt, 1024, settings.claude_model || "claude-sonnet-4-5", settings.claude_api_key);
      if (!claudeRes.ok) {
        results.push({ athleteId, status: "error", detail: claudeRes.error });
        continue;
      }

      const newLog = [...existingLog, { date: newest, note: claudeRes.text, generated_by: "claude" }];
      const mergedData = { ...profile, weekly_feedback_log: newLog };
      const nowIso = new Date().toISOString();
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/athletes?id=eq.${encodeURIComponent(athleteId)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
        {
          method: "PATCH",
          headers: { ...restHeaders, Prefer: "return=representation" },
          body: JSON.stringify({ data: mergedData, updated_at: nowIso }),
        }
      );
      const updatedRows = await updateRes.json();
      if (!updateRes.ok || !Array.isArray(updatedRows) || updatedRows.length === 0) {
        results.push({ athleteId, status: "error", detail: "Conflitto di concorrenza: scheda modificata nel frattempo, feedback non salvato." });
        continue;
      }

      let emailStatus = "disabled";
      const email = profile?.identity?.email;
      if (settings.weekly_feedback_email_enabled) {
        if (!emailSender) {
          emailStatus = "skipped: provider email non configurato";
        } else if (!email) {
          emailStatus = "skipped: nessuna email per l'atleta";
        } else {
          const sendRes = await emailSender.send({
            to: email,
            subject: "Il tuo feedback settimanale",
            text: claudeRes.text,
          });
          emailStatus = sendRes.ok ? "sent" : `error: ${sendRes.error}`;
        }
      }

      results.push({ athleteId, status: "ok", detail: `email: ${emailStatus}` });
    } catch (err) {
      results.push({ athleteId, status: "error", detail: err instanceof Error ? err.message : "Errore sconosciuto." });
    }
  }

  return jsonResponse({ ranAt: new Date().toISOString(), newest, results });
});
