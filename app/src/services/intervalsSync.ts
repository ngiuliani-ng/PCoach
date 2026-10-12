// Client della Edge Function "intervals-sync" (ADR 0017): anteprima della settimana e una
// operazione per seduta. Stesso schema di autenticazione di claude.ts (token di sessione).
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";
import type { RemoteSnapshot } from "@shared/workouts/sync.ts";
import type { IcuSportSettings, ZoneModelKey } from "@shared/workouts/zoneModels.ts";
import type { ZoneCount, ZoneDiscipline } from "@shared/workouts/zones.ts";

export type ApplyOp = "create" | "update" | "overwrite" | "recreate" | "delete";

type Response<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function call<T>(body: Record<string, unknown>): Promise<Response<T>> {
  const sessionToken = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!sessionToken) return { ok: false, error: "Sessione non valida: effettua di nuovo l'accesso." };
  try {
    const res = await fetch(supabaseUrl.replace(/\/$/, "") + "/functions/v1/intervals-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionToken, apikey: supabaseAnonKey },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      return { ok: false, error: (data && data.error) || `Errore della sincronizzazione (${res.status}).`, code: data?.code };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Impossibile contattare il servizio di sincronizzazione." };
  }
}

export function previewWeek(athleteId: string, weekStart: string) {
  return call<{ remote: RemoteSnapshot; completed: number; blocked?: string | null }>({ action: "preview", athlete_id: athleteId, week_start: weekStart });
}

export function applyOperation(athleteId: string, workoutId: string, op: ApplyOp, expectedRevision: number) {
  return call<{ ok: boolean; outcome?: string; warning?: string | null; error?: string }>({
    action: "apply", athlete_id: athleteId, workout_id: workoutId, op, expected_revision: expectedRevision
  });
}

/** Zone dell'atleta su Intervals.icu (sola lettura, ADR 0029). */
export function readZones(athleteId: string) {
  return call<{ settings: IcuSportSettings[] }>({ action: "zones_read", athlete_id: athleteId });
}

/** Porta la soglia di uno sport su Intervals.icu al valore della scheda (ADR 0030). */
export function applyThreshold(athleteId: string, discipline: ZoneDiscipline) {
  return call<{ ok: boolean; error?: string; settings?: IcuSportSettings }>({ action: "threshold_apply", athlete_id: athleteId, discipline });
}

/** Porta le zone di uno sport su Intervals.icu al modello di Impostazioni. */
export function applyZones(athleteId: string, discipline: ZoneDiscipline, key: ZoneModelKey, zones: ZoneCount) {
  return call<{ ok: boolean; error?: string; settings?: IcuSportSettings }>({ action: "zones_apply", athlete_id: athleteId, discipline, key, zones });
}
