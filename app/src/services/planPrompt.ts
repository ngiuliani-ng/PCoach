// Costruzione pura (testabile) dei prompt per Claude: contesto atleta compatto
// e sostituzione dei placeholder nei template. Porting di buildAthleteContextForPrompt
// e della logica di interpolazione dal legacy index.html.
import { addDaysISO, fullName, todayISO } from "../constants";
import type { AthleteTrainingProfile } from "../schema/types.generated";

export function buildAthleteContextForPrompt(profile: AthleteTrainingProfile) {
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
    notes_free_text: profile.notes_free_text
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function buildPlanPrompt(
  profile: AthleteTrainingProfile,
  weeks: number,
  planJsonShape: string,
  template: string
): string {
  return interpolate(template, {
    settimane: String(weeks),
    nome_atleta: fullName(profile.identity),
    contesto_atleta_json: JSON.stringify(buildAthleteContextForPrompt(profile), null, 2),
    formato_training_plan_json: planJsonShape
  });
}
