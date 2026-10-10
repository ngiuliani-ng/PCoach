// Costruzione pura (testabile) dei prompt per Claude: contesto atleta compatto
// e sostituzione dei placeholder nei template.
import { addDaysISO, fullName, todayISO } from "../constants";
import type { AthleteTrainingProfile } from "../schema/types.generated";
import { workoutTotals, zoneLabel, flattenSteps } from "@shared/workouts/structure.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import { dayName, planningCalendar } from "../domain/availability";

/** Seduta esistente come la vede Claude: sintetica, senza identificativi interni. */
export interface PromptWorkout extends WorkoutContent {
  status: string;
  completed_at: string | null;
}

function summarize(w: PromptWorkout) {
  const totals = workoutTotals(w);
  const zones = [...new Set(flattenSteps(w.structure).map((s) => zoneLabel(s.target)).filter(Boolean))];
  return {
    date: w.planned_date,
    day: dayName(w.planned_date),
    discipline: w.discipline,
    title: w.title,
    minutes: Math.round(totals.seconds / 60),
    zones,
    esito: w.completed_at ? "svolta" : w.planned_date < todayISO() ? "non svolta" : "in programma"
  };
}

export function buildAthleteContextForPrompt(profile: AthleteTrainingProfile, recent: PromptWorkout[] = []) {
  const cutoff = addDaysISO(todayISO(), -30);
  const latestThreshold = <T extends { date: string }>(log: T[] | undefined): T | undefined =>
    log && log.length ? [...log].sort((a, b) => a.date.localeCompare(b.date)).at(-1) : undefined;

  return {
    identity: profile.identity,
    disciplines: profile.disciplines,
    latest_thresholds: {
      running: latestThreshold(profile.physiological_thresholds?.running?.thresholds_log),
      cycling: latestThreshold(profile.physiological_thresholds?.cycling?.thresholds_log),
      swimming: latestThreshold(profile.physiological_thresholds?.swimming?.thresholds_log)
    },
    training_status: {
      detraining_period: profile.training_status?.detraining_period,
      lifestyle_factors: profile.training_status?.lifestyle_factors,
      lifestyle_factors_note: profile.training_status?.lifestyle_factors_note,
      load_metrics_last_30_days: (profile.training_status?.load_metrics_log || []).filter((e) => e.date >= cutoff)
    },
    goals: profile.goals,
    constraints: profile.constraints,
    methodology_preferences: profile.methodology_preferences,
    notes_free_text: profile.notes_free_text,
    recent_workouts: recent.map(summarize)
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

export interface PlanPromptInput {
  weeks: number;
  fromDate: string;
  reason: string;
  /** Sedute che restano nel periodo (svolte o mantenute dal coach). */
  fixed: PromptWorkout[];
  /** Sedute delle ultime due settimane prima della data di inizio. */
  recent: PromptWorkout[];
  /** Generazione a blocchi: posizione di questo blocco nel piano complessivo. */
  block?: { index: number; count: number; firstWeek: number; totalWeeks: number; planFrom: string };
}

// Segnaposto senza i quali Claude non conoscerebbe periodo e vincoli: se un template
// personalizzato non li contiene, il blocco viene aggiunto in fondo.
const REQUIRED = ["data_inizio", "data_fine", "calendario_json", "sedute_fisse_json", "formato_training_plan_json"];

export function buildPlanPrompt(profile: AthleteTrainingProfile, input: PlanPromptInput, planJsonShape: string, template: string): string {
  const toDate = addDaysISO(input.fromDate, input.weeks * 7 - 1);
  const values: Record<string, string> = {
    settimane: String(input.weeks),
    nome_atleta: fullName(profile.identity),
    contesto_atleta_json: JSON.stringify(buildAthleteContextForPrompt(profile, input.recent), null, 2),
    formato_training_plan_json: planJsonShape,
    data_inizio: input.fromDate,
    data_fine: toDate,
    // Il giorno della settimana di ogni data e' calcolato qui: Claude lo sbaglia.
    calendario_json: JSON.stringify(planningCalendar(profile.constraints, input.fromDate, input.weeks)),
    sedute_fisse_json: JSON.stringify(input.fixed.map(summarize), null, 2),
    motivo: input.reason.trim() || "Nessun motivo indicato."
  };
  let text = template;
  if (REQUIRED.some((key) => !template.includes(`{{${key}}}`))) {
    text += `\n\nPeriodo: dal {{data_inizio}} al {{data_fine}} compresi. Motivo: {{motivo}}\nCalendario (usa solo le date disponibili, entro la durata massima del giorno):\n{{calendario_json}}\nSedute già fissate da non ripetere:\n{{sedute_fisse_json}}\nFormato della risposta:\n{{formato_training_plan_json}}`;
  }
  const b = input.block;
  if (b && b.count > 1) {
    const lastWeek = b.firstWeek + input.weeks - 1;
    const planTo = addDaysISO(b.planFrom, b.totalWeeks * 7 - 1);
    text += `\n\nQuesta richiesta è la parte ${b.index + 1} di ${b.count} di un piano di ${b.totalWeeks} settimane, dal ${b.planFrom} al ${planTo}. Genera solo le settimane dalla ${b.firstWeek} alla ${lastWeek} del piano (dal {{data_inizio}} al {{data_fine}}), con la progressione e lo schema di carico e scarico adatti alla loro posizione nel piano complessivo.`
      + (b.index > 0 ? " Le sedute delle parti precedenti sono tra le sedute recenti dei dati dell'atleta: proseguile in modo coerente, senza ripeterle." : "");
  }
  return interpolate(text, values);
}
