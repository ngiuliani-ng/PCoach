// Parametri dell'analisi del feedback (ADR 0019). Sono euristiche operative scelte dal coach,
// non soglie fisiologiche: vivono in app_settings.feedback_params (globali) e, per la
// progressione del carico, nella scheda di ogni atleta (methodology_preferences).
// Modulo puro condiviso tra app (Impostazioni, scheda, prompt del piano) ed Edge Function.

export interface FeedbackParams {
  /** Rapporto svolto/prescritto (in %) entro cui una seduta e' "completata". */
  completed_min_pct: number;
  completed_max_pct: number;
  /** Sotto completed_min_pct e da qui in su: "parziale"; sotto: "molto ridotta". */
  partial_min_pct: number;
  /** Scostamento del volume settimanale di una disciplina: lieve e rilevante (in %). */
  deviation_minor_pct: number;
  deviation_notable_pct: number;
  /** Quota massima di sedute indeterminate oltre la quale il tasso di completamento non si comunica. */
  unknown_max_share_pct: number;
  /** Copertura minima dei dati sulla risposta dell'atleta per poterne parlare. */
  min_rpe_coverage_pct: number;
  min_wellness_days: number;
  /** Minuti minimi su cui la distribuzione dell'intensita' e' comunicabile. */
  min_distribution_minutes: number;
  /** Zone fino a cui l'intensita' e' bassa e fino a cui e' media (oltre: alta). */
  low_zone_max: number;
  moderate_zone_max: number;
}

export const DEFAULT_FEEDBACK_PARAMS: FeedbackParams = {
  completed_min_pct: 80,
  completed_max_pct: 120,
  partial_min_pct: 50,
  deviation_minor_pct: 10,
  deviation_notable_pct: 20,
  unknown_max_share_pct: 25,
  min_rpe_coverage_pct: 50,
  min_wellness_days: 4,
  min_distribution_minutes: 120,
  low_zone_max: 2,
  moderate_zone_max: 4
};

type Range = [number, number];
const RANGES: Record<keyof FeedbackParams, Range> = {
  completed_min_pct: [1, 100],
  completed_max_pct: [100, 300],
  partial_min_pct: [1, 99],
  deviation_minor_pct: [1, 100],
  deviation_notable_pct: [1, 200],
  unknown_max_share_pct: [0, 100],
  min_rpe_coverage_pct: [0, 100],
  min_wellness_days: [0, 7],
  min_distribution_minutes: [0, 1200],
  low_zone_max: [1, 6],
  moderate_zone_max: [2, 7]
};

export const PARAM_KEYS = Object.keys(DEFAULT_FEEDBACK_PARAMS) as (keyof FeedbackParams)[];

/** Errori per parametro (vuoto se validi): intervalli ammessi e coerenza fra parametri. */
export function validateFeedbackParams(p: FeedbackParams): Partial<Record<keyof FeedbackParams, string>> {
  const errors: Partial<Record<keyof FeedbackParams, string>> = {};
  for (const key of PARAM_KEYS) {
    const [min, max] = RANGES[key];
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) errors[key] = `Valore tra ${min} e ${max}.`;
  }
  if (!errors.partial_min_pct && !errors.completed_min_pct && p.partial_min_pct >= p.completed_min_pct) {
    errors.partial_min_pct = "Deve essere inferiore alla soglia di seduta completata.";
  }
  if (!errors.deviation_minor_pct && !errors.deviation_notable_pct && p.deviation_minor_pct >= p.deviation_notable_pct) {
    errors.deviation_minor_pct = "Deve essere inferiore allo scostamento rilevante.";
  }
  if (!errors.low_zone_max && !errors.moderate_zone_max && p.low_zone_max >= p.moderate_zone_max) {
    errors.low_zone_max = "Deve essere inferiore alla zona massima dell'intensità media.";
  }
  return errors;
}

/** Parametri effettivi: valori salvati validi, altrimenti quelli predefiniti. */
export function resolveFeedbackParams(raw: unknown): FeedbackParams {
  const merged = { ...DEFAULT_FEEDBACK_PARAMS };
  if (raw && typeof raw === "object") {
    for (const key of PARAM_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) merged[key] = v;
    }
  }
  return Object.keys(validateFeedbackParams(merged)).length ? { ...DEFAULT_FEEDBACK_PARAMS } : merged;
}

// ---------- Progressione del carico, per atleta ----------

export interface LoadProgression {
  /** Aumento del carico fra due settimane di carico consecutive (in %). */
  increase_min_pct: number;
  increase_max_pct: number;
  /** Calo del volume nella settimana di scarico rispetto all'ultima di carico (in %). */
  deload_decrease_pct: number;
}

export const DEFAULT_LOAD_PROGRESSION: LoadProgression = { increase_min_pct: 5, increase_max_pct: 10, deload_decrease_pct: 33 };

/** Progressione dalla metodologia dell'atleta; i valori assenti o incoerenti prendono il predefinito. */
export function loadProgressionOf(methodology: {
  load_increase_min_pct?: number;
  load_increase_max_pct?: number;
  deload_decrease_pct?: number;
} | null | undefined): LoadProgression {
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  const lo = num(methodology?.load_increase_min_pct, 0, 50, DEFAULT_LOAD_PROGRESSION.increase_min_pct);
  const hi = num(methodology?.load_increase_max_pct, 0, 50, DEFAULT_LOAD_PROGRESSION.increase_max_pct);
  return {
    increase_min_pct: Math.min(lo, hi),
    increase_max_pct: Math.max(lo, hi),
    deload_decrease_pct: num(methodology?.deload_decrease_pct, 5, 80, DEFAULT_LOAD_PROGRESSION.deload_decrease_pct)
  };
}
