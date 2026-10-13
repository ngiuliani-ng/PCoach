// Riepiloghi delle sezioni chiuse del Profilo (D-02): una riga che dice cosa c'e' dentro, cosi' una
// sezione chiusa non nasconde il suo contenuto. Funzioni pure, testate in profileSummaries.test.ts.
import type { AthleteTrainingProfile } from "../schema/types.generated";
import {
  DAY_LABELS, INTENSITY_OPTIONS, LEVEL_OPTIONS, LIFESTYLE_FACTOR_OPTIONS, OBJECTIVE_OPTIONS,
  disciplineLabel, formatDate, fullName, todayISO
} from "../constants";
import { parseLoadPattern } from "./planWeeks";

const labelOf = (options: [string, string][], value: string | undefined | null) => options.find(([v]) => v === value)?.[1] ?? "";
const zones = (system: string | undefined) => `${(system ?? "7-zone").split("-")[0]} zone`;

type Log = Record<string, unknown> & { date?: string };
function latest(log: Log[] | undefined): Log | null {
  return [...(log ?? [])].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).at(-1) ?? null;
}

export function identitySummary(p: AthleteTrainingProfile, thisYear = Number(todayISO().slice(0, 4))): string {
  const parts = [fullName(p.identity) || "Senza nome"];
  if (p.identity.birth_year) parts.push(`${thisYear - p.identity.birth_year} anni`);
  parts.push(p.identity.email?.trim() || "senza email");
  return parts.join(", ");
}

export function disciplinesSummary(p: AthleteTrainingProfile): string {
  if (!p.disciplines.length) return "Nessuna disciplina";
  return p.disciplines.map((d) => `${disciplineLabel(d.sport)} (${labelOf(LEVEL_OPTIONS, d.level).toLowerCase() || "livello non indicato"})`).join(", ");
}

export function thresholdsSummary(p: AthleteTrainingProfile): string {
  const t = p.physiological_thresholds ?? {};
  const parts: string[] = [];
  const run = latest(t.running?.thresholds_log as Log[] | undefined);
  if (run?.threshold_pace_per_km || run?.lthr_bpm) {
    parts.push(`Corsa ${run.threshold_pace_per_km ? `${run.threshold_pace_per_km}/km` : `${run.lthr_bpm} bpm`}, ${zones(t.running?.zone_system)}`);
  }
  const bike = latest(t.cycling?.thresholds_log as Log[] | undefined);
  if (bike?.ftp_watts || bike?.lthr_bpm) {
    parts.push(`Bici ${bike.ftp_watts ? `${bike.ftp_watts} W` : `${bike.lthr_bpm} bpm`}, ${zones(t.cycling?.zone_system)}`);
  }
  const swim = latest(t.swimming?.thresholds_log as Log[] | undefined);
  if (swim?.css_pace_per_100m) parts.push(`Nuoto ${swim.css_pace_per_100m}/100 m`);
  return parts.length ? parts.join("; ") : "Nessuna rilevazione";
}

export function statusSummary(p: AthleteTrainingProfile): string {
  const s = p.training_status;
  const parts: string[] = [];
  if (s?.detraining_period?.active) parts.push(`Calo degli allenamenti${s.detraining_period.duration_weeks ? ` da ${s.detraining_period.duration_weeks} settimane` : ""}`);
  const factors = (s?.lifestyle_factors ?? []).map((f) => labelOf(LIFESTYLE_FACTOR_OPTIONS, f)).filter(Boolean);
  if (factors.length) parts.push(factors.join(", ").toLowerCase());
  return parts.length ? parts.join("; ").replace(/^./, (c) => c.toUpperCase()) : "Nessun calo né fattore di vita";
}

export function goalsSummary(p: AthleteTrainingProfile, today = todayISO()): string {
  const parts = [labelOf(OBJECTIVE_OPTIONS, p.goals.primary_objective) || "Obiettivo non indicato"];
  const next = (p.goals.target_events ?? []).filter((e) => e.date && e.date >= today).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0];
  if (p.goals.primary_objective === "preparazione_gara") {
    parts.push(next ? `prossimo evento ${next.name || "senza nome"}, ${formatDate(next.date)}` : "nessun evento in programma");
  }
  return parts.join("; ");
}

export function constraintsSummary(p: AthleteTrainingProfile): string {
  const days = p.constraints.days_available.filter((d) => d.active);
  const max = Math.max(0, ...days.map((d) => d.max_duration_minutes ?? 0));
  const parts = [days.length === 7 ? "Tutti i giorni" : days.length ? days.map((d) => DAY_LABELS.find(([k]) => k === d.day)?.[1].slice(0, 3).toLowerCase()).join(", ") : "Nessun giorno disponibile"];
  if (max) parts.push(`al massimo ${max} min`);
  if (p.constraints.sessions_per_week_target) parts.push(`${p.constraints.sessions_per_week_target} sedute a settimana`);
  return parts.join("; ");
}

export function methodologySummary(p: AthleteTrainingProfile): string {
  const m = p.methodology_preferences;
  const pattern = parseLoadPattern(m.load_deload_pattern);
  return [
    labelOf(INTENSITY_OPTIONS, m.intensity_distribution_model) || "Distribuzione non indicata",
    pattern ? `${pattern.load} di carico e ${pattern.deload} di scarico` : "schema di carico da scegliere"
  ].join("; ");
}

export function notesSummary(p: AthleteTrainingProfile): string {
  const text = (p.notes_free_text ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "Nessuna nota";
  return text.length > 70 ? `${text.slice(0, 69)}…` : text;
}
