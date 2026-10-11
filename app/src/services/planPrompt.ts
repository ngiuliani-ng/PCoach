// Costruzione pura (testabile) del prompt della generazione (ADR 0020): regole fisse e formato nel
// codice, preferenze metodologiche del coach, dati dell'atleta e calendario calcolati da PCoach.
import { addDaysISO, todayISO, TRAINING_PLAN_JSON_SHAPE } from "../constants";
import { zoneLimits } from "../domain/athlete";
import type { AthleteTrainingProfile } from "../schema/types.generated";
import { workoutTotals, zoneLabel, flattenSteps } from "@shared/workouts/structure.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import { dayName, planningCalendar } from "../domain/availability";
import type { PlanWeek } from "../domain/planWeeks";
import { loadProgressionOf } from "@shared/feedback/params.ts";
import type { FeedbackInput } from "@shared/feedback/contract.ts";

/** Seduta esistente come la vede Claude: sintetica, senza identificativi interni. */
export interface PromptWorkout extends WorkoutContent {
  status: string;
  completed_at: string | null;
  /** Esito e dati dell'attivita' abbinata, se riconosciuta da Intervals.icu (ADR 0021). */
  completion_outcome?: string | null;
  activity_minutes?: number | null;
  activity_rpe?: number | null;
}

function esito(w: PromptWorkout): string {
  if (w.completed_at) return w.completion_outcome === "partial" || w.completion_outcome === "short" ? "svolta in parte" : "svolta";
  return w.planned_date < todayISO() ? "nessuna attività registrata" : "in programma";
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
    esito: esito(w),
    ...(w.activity_minutes != null ? { minuti_svolti: Math.round(w.activity_minutes) } : {}),
    ...(w.activity_rpe != null ? { rpe: w.activity_rpe } : {})
  };
}

/** Analisi settimanale calcolata da PCoach (feedback_input), anche non ancora approvata (decisione D-09). */
export interface RecentReview {
  period_start: string;
  period_end: string;
  input: FeedbackInput;
}

type DisciplineVolume = { planned_min: number; matched_min: number; volume_ratio: number | null; deviation: { direction: string; level: string } | null };

/**
 * Riepilogo dei soli dati calcolati di una valutazione: mai il testo scritto da Claude o dal coach.
 * Tollerante: un contratto incompleto o di una versione precedente da' null e viene tralasciato.
 */
export function reviewSummaryForPrompt(r: RecentReview) {
  const m = r.input?.metrics;
  const s = m?.sessions;
  if (!m || !s) return null;
  const volumes = (m.by_discipline ?? {}) as Record<string, DisciplineVolume>;
  const level = (v: DisciplineVolume["deviation"]) =>
    !v ? null : v.level === "in_line" ? "in linea" : `${v.level === "minor" ? "lieve" : "rilevante"}, ${v.direction === "above" ? "sopra" : "sotto"}`;
  return {
    settimana: `${r.period_start}/${r.period_end}`,
    completa: r.input.period?.complete ?? null,
    sedute: {
      assegnate: s.assigned, svolte: s.completed, svolte_in_parte: s.partial, spostate: s.moved,
      nessuna_attivita_registrata: s.not_recorded, non_valutabili: s.unknown, extra: s.extra
    },
    tasso_completamento: m.completion_rate?.reportable ? m.completion_rate.value : null,
    volume_per_disciplina: Object.fromEntries(Object.entries(volumes).map(([d, v]) => [d, {
      previsti_min: v.planned_min, svolti_min: v.matched_min, rapporto: v.volume_ratio, scostamento: level(v.deviation)
    }])),
    variazione_volume: m.trend?.comparable ? { percentuale: m.trend.endurance_minutes?.change_pct ?? null, rispetto_attesa: m.trend.within_expected ?? null } : null,
    rpe_medio: r.input.response?.rpe?.mean ?? null,
    copertura_rpe: r.input.response?.rpe?.coverage ?? null,
    limitazioni: r.input.limitations ?? []
  };
}

/** Nome con cui Claude chiama l'atleta: solo il nome di battesimo (decisione del coach D-UX-7). */
export function promptName(profile: AthleteTrainingProfile): string {
  return profile.identity?.nome?.trim() || "l'atleta";
}

/**
 * Identita' inviata a Claude (D-UX-7): nome di battesimo ed eta' invece di cognome e anno di nascita.
 * L'email serve solo alla consegna del feedback e non va a Claude.
 */
function promptIdentity(profile: AthleteTrainingProfile) {
  const { nome, birth_year, biological_sex, height_cm, weight_kg } = profile.identity ?? {};
  const year = Number(todayISO().slice(0, 4));
  return {
    nome: nome?.trim() || null,
    eta: typeof birth_year === "number" && birth_year > 1900 ? year - birth_year : null,
    biological_sex: biological_sex ?? null,
    height_cm: height_cm ?? null,
    weight_kg: weight_kg ?? null
  };
}

export function buildAthleteContextForPrompt(profile: AthleteTrainingProfile, recent: PromptWorkout[] = [], reviews: RecentReview[] = []) {
  const cutoff = addDaysISO(todayISO(), -30);
  const latestThreshold = <T extends { date: string }>(log: T[] | undefined): T | undefined =>
    log && log.length ? [...log].sort((a, b) => a.date.localeCompare(b.date)).at(-1) : undefined;

  return {
    identity: promptIdentity(profile),
    disciplines: profile.disciplines,
    // Sistema di zone dell'atleta (D-UX-3): le sedute restano entro queste zone.
    zone_per_disciplina: zoneLimits(profile),
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
    recent_workouts: recent.map(summarize),
    recent_reviews: reviews.map(reviewSummaryForPrompt).filter((x) => x !== null)
  };
}

export interface PlanPromptInput {
  weeks: number;
  fromDate: string;
  /** Settimane del piano con la fase del ciclo, riportate nel calendario. */
  planWeeks?: PlanWeek[];
  reason: string;
  /** Sedute che restano nel periodo (svolte o mantenute dal coach). */
  fixed: PromptWorkout[];
  /** Sedute delle ultime due settimane prima della data di inizio. */
  recent: PromptWorkout[];
  /** Ultime analisi settimanali prima della data di inizio. */
  reviews?: RecentReview[];
}

/** Versione delle istruzioni fisse e della forma del messaggio: salvata con ogni generazione. */
export const PLAN_PROMPT_VERSION = "2.3.0";

// Regole e formato fissi nel codice (ADR 0020, decisione del coach D-01): il coach modifica solo le
// preferenze metodologiche, che non possono togliere a Claude i dati dell'atleta, i vincoli o il formato.
export const PLAN_RULES = `Sei un coach esperto di allenamento endurance (corsa, bici, nuoto, palestra). Ricevi i dati di un atleta e un calendario già calcolati da PCoach e prepari le sedute del periodo indicato.

Regole:
- Usa solo le date del calendario con "disponibile": true. Non pianificare nulla nelle altre.
- La somma delle durate delle sedute di un giorno non deve superare "durata_massima_min" di quel giorno.
- "attivita_abituale" è ciò che l'atleta fa di solito quel giorno: usala come preferenza per disciplina e tipo di seduta, salvo indicazioni diverse del coach.
- Rispetta il numero di sedute a settimana dell'atleta (constraints.sessions_per_week_target), se indicato.
- Rispetta la distribuzione dell'intensità scelta per l'atleta (methodology_preferences.intensity_distribution_model).
- Usa in ogni disciplina solo le zone da Z1 al numero indicato in "zone_per_disciplina": è il sistema di zone impostato per l'atleta, lo stesso del suo account Intervals.icu.
- Rispetta la fase di ogni settimana e la variazione di carico indicate nel calendario ("fase", "variazione_carico"), in ogni disciplina: le percentuali sono quelle scelte dal coach per questo atleta.
- Le settimane con fase "tapering" o "gara" preparano la gara indicata nel calendario (campo "gara" nel giorno della gara): rispetta la variazione di carico indicata e non pianificare altre sedute nel giorno della gara.
- Le sedute già fissate nel periodo non vanno ripetute né spostate: pianifica intorno a queste, tenendone conto nel carico.
- "recent_workouts" e "recent_reviews" descrivono com'è andato il periodo precedente, con dati calcolati da PCoach (esiti, minuti svolti, RPE, scostamenti di volume): usali per calibrare il carico, senza ricalcolarli. "nessuna attività registrata" non significa che l'atleta non si sia allenato.

Restituisci SOLO un oggetto JSON valido (puoi racchiuderlo in un blocco di codice \`\`\`json, oppure scriverlo senza altro testo prima o dopo), con questa struttura esatta:
${TRAINING_PLAN_JSON_SHAPE}`;

export interface PlanPrompt {
  system: string;
  user: string;
  version: string;
}

/**
 * Prompt della generazione: istruzioni di sistema (regole fisse, formato, preferenze del coach) e
 * messaggio con i dati calcolati. Le preferenze possono citare {{nome_atleta}}; i dati dell'atleta
 * non vengono interpretati come segnaposto.
 */
export function buildPlanPrompt(profile: AthleteTrainingProfile, input: PlanPromptInput, preferences: string): PlanPrompt {
  const toDate = addDaysISO(input.fromDate, input.weeks * 7 - 1);
  const name = promptName(profile);
  const prefs = preferences.replaceAll("{{nome_atleta}}", name).trim();
  const system = prefs
    ? `${PLAN_RULES}

Preferenze metodologiche del coach (non possono cambiare le regole e il formato sopra):
${prefs}`
    : PLAN_RULES;
  // Il giorno della settimana di ogni data e' calcolato qui: Claude lo sbaglia.
  const calendar = planningCalendar(profile.constraints, input.fromDate, toDate, input.planWeeks, loadProgressionOf(profile.methodology_preferences));
  const user = `Prepara le sedute di ${input.weeks} ${input.weeks === 1 ? "settimana" : "settimane"} per ${name}, dal ${input.fromDate} al ${toDate} compresi.

Dati dell'atleta (profilo, soglie, carico recente, sedute approvate delle ultime due settimane con l'esito, ultime valutazioni settimanali):
${JSON.stringify(buildAthleteContextForPrompt(profile, input.recent, input.reviews ?? []), null, 2)}

Motivo della pianificazione indicato dal coach:
${input.reason.trim() || "Nessun motivo indicato."}

Calendario del periodo, già calcolato: per ogni data il giorno della settimana, se l'atleta è disponibile, la durata massima in minuti di quel giorno, l'attività che fa di solito e, se noti, il numero della settimana, la sua fase nel ciclo di carico e scarico e la variazione di carico attesa:
${JSON.stringify(calendar)}

Sedute già fissate nel periodo, da NON ripetere né spostare:
${JSON.stringify(input.fixed.map(summarize), null, 2)}`;
  return { system, user, version: PLAN_PROMPT_VERSION };
}

/** Testo unico da incollare a mano in Claude quando la chiave non e' configurata. */
export function promptAsText(p: PlanPrompt): string {
  return `${p.system}

---

${p.user}`;
}
