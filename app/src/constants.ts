// Costanti condivise: opzioni dei menu a tendina, prompt di default per Claude
// e il profilo "vuoto" di un nuovo atleta. Porting a parità funzionale da index.html.
import type { AthleteTrainingProfile } from "./schema/types.generated";

export type DayKey = AthleteTrainingProfile["constraints"]["days_available"][number]["day"];

export const DAY_LABELS: [DayKey, string][] = [
  ["lunedi", "Lunedì"], ["martedi", "Martedì"], ["mercoledi", "Mercoledì"],
  ["giovedi", "Giovedì"], ["venerdi", "Venerdì"], ["sabato", "Sabato"], ["domenica", "Domenica"]
];

// Discipline di ALLENAMENTO: righe con un proprio volume settimanale misurabile.
// "Triathlon" non ci sta perché non ha un volume proprio: è nuoto+bici+corsa,
// già rappresentabili come tre righe separate.
export const TRAINING_SPORT_OPTIONS: [string, string][] = [
  ["running", "Corsa"], ["cycling", "Bici"], ["swimming", "Nuoto"],
  ["strength", "Palestra"]
];

// Discipline di GARA/RISULTATO: qui "Triathlon" è corretto, è una categoria di evento
// (con la sua distanza/durata indicata a parte), non un bucket di volume.
export const EVENT_DISCIPLINE_OPTIONS: [string, string][] = [
  ["running", "Corsa"], ["cycling", "Bici"], ["swimming", "Nuoto"],
  ["triathlon", "Triathlon"], ["other", "Altro"]
];

export const LEVEL_OPTIONS: [string, string][] = [
  ["principiante", "Principiante"], ["intermedio", "Intermedio"],
  ["avanzato", "Avanzato"], ["esperto_agonista", "Esperto/agonista"]
];

export const VOLUME_UNITS = ["km", "ore", "sessioni"];

export const OBJECTIVE_OPTIONS: [string, string][] = [
  ["forma_fisica_generale", "Forma fisica generale"],
  ["miglioramento_ftp", "Miglioramento FTP"],
  ["miglioramento_vo2max", "Miglioramento VO2max"],
  ["miglioramento_soglia", "Miglioramento soglia"],
  ["preparazione_gara", "Preparazione gara"],
  ["ripartenza_post_stop", "Ripartenza post-stop"],
  ["altro", "Altro"]
];

// Obiettivi "di sviluppo": possono comparire come principale o secondario.
// "Preparazione gara" e "Ripartenza post-stop" non sono obiettivi fisiologici ma
// modalità che definiscono l'impianto dell'intero piano: solo come principale.
export const SHARED_OBJECTIVE_OPTIONS = OBJECTIVE_OPTIONS.filter(
  ([v]) => v !== "preparazione_gara" && v !== "ripartenza_post_stop"
);

export const EVENT_PRIORITIES = ["A", "B", "C"];

export const LIFESTYLE_FACTOR_OPTIONS: [string, string][] = [
  ["turni_lavoro_variabili", "Turni di lavoro variabili"],
  ["viaggia_spesso", "Viaggia spesso"],
  ["sonno_spesso_disturbato", "Sonno spesso disturbato"],
  ["stress_lavorativo_elevato", "Stress lavorativo elevato"],
  ["carichi_familiari_elevati", "Carichi familiari elevati"]
];

// Fonte di ogni rilevazione: manuale o sincronizzata da Intervals.icu.
// Pronta ad accogliere in futuro altre fonti sincronizzate (es. Garmin)
// aggiungendo voci qui, senza altre modifiche.
export const SOURCE_OPTIONS: [string, string][] = [
  ["manual", "Manuale"],
  ["intervals_icu_sync", "Intervals.icu (sync)"]
];

export type MetricFieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: [string, string][];
  mono?: boolean;
};

export const RUN_THRESHOLD_FIELDS: MetricFieldDef[] = [
  { key: "threshold_pace_per_km", label: "Passo soglia (min/km)", type: "text", mono: true },
  { key: "lthr_bpm", label: "LTHR (bpm)", type: "number" },
  { key: "vo2max_estimated", label: "VO2max stimato", type: "number" },
  {
    key: "test_type", label: "Tipo test", type: "select", options: [
      ["campo_time_trial", "Time trial in campo"], ["laboratorio", "Laboratorio"],
      ["stima_gara", "Stima da gara"], ["nessun_test", "Nessun test (stima)"]
    ]
  }
];

export const BIKE_THRESHOLD_FIELDS: MetricFieldDef[] = [
  { key: "ftp_watts", label: "FTP (watt)", type: "number" }
];

export const SWIM_THRESHOLD_FIELDS: MetricFieldDef[] = [
  { key: "css_pace_per_100m", label: "CSS (min/100m)", type: "text", mono: true }
];

// Struttura JSON iniettata nel prompt di generazione, così Claude sa esattamente cosa restituire
// (specifica-tecnica.md §5.3).
export const TRAINING_PLAN_JSON_SHAPE = `{
  "plan_name": "string",
  "start_date": "YYYY-MM-DD",
  "weeks": [
    {
      "week_number": 1,
      "week_label": "string",
      "is_deload": false,
      "sessions": [
        {
          "date": "YYYY-MM-DD",
          "day": "lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica",
          "session_type": "string",
          "discipline": "running|cycling|swimming|strength",
          "is_structured": false,
          "target_zone": "string",
          "target_duration_min": null,
          "target_distance_km": null,
          "notes": "string",
          "steps": []
        }
      ]
    }
  ]
}
Se is_structured e' true, usa steps[] invece dei campi target_*. Ogni step: { "kind": "warmup|cooldown|block", "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" } oppure, per le ripetute uniformi: { "kind": "repeat", "repetitions": 1, "work": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" }, "recovery": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" } }.`;

export const DEFAULT_PLAN_PROMPT = `Sei un coach esperto di allenamento endurance (corsa, bici, nuoto, palestra). Genera un piano di allenamento di {{settimane}} settimane per l'atleta {{nome_atleta}}, seguendo esattamente il formato JSON indicato sotto.

Dati atleta:
{{contesto_atleta_json}}

Restituisci SOLO un oggetto JSON valido (puoi racchiuderlo in un blocco di codice \`\`\`json, oppure scriverlo senza altro testo prima o dopo), con questa struttura esatta:
{{formato_training_plan_json}}

Regole:
- Le date delle sessioni devono essere reali (YYYY-MM-DD), a partire dalla data di oggi.
- Rispetta i vincoli di disponibilità settimanale e lo schema di carico/scarico dell'atleta.
- Usa is_structured: true e steps[] solo per le sessioni con intervalli; per le sessioni a blocco unico (easy, lunga, palestra generica) usa is_structured: false con i campi target_*.`;

export const DEFAULT_FEEDBACK_PROMPT = `Sei un coach esperto. Confronta la settimana pianificata con quella effettivamente svolta dall'atleta {{nome_atleta}} e scrivi un feedback breve (massimo 200 parole) in italiano: aderenza al piano, scostamenti di carico, suggerimenti per la settimana successiva.

Piano pianificato per questa settimana:
{{settimana_pianificata_json}}

Allenamenti realmente svolti questa settimana:
{{settimana_reale_json}}`;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function numOrNull(v: unknown): number | null {
  return v === "" || v === null || v === undefined ? null : Number(v as string);
}

export function fullName(identity: { nome?: string; cognome?: string } | undefined): string {
  return [identity?.nome, identity?.cognome].filter((part) => part && part.trim()).join(" ");
}

export function blankProfile(): AthleteTrainingProfile {
  return {
    schema_version: "1.4.0",
    meta: { athlete_id: "", coach_id: "", created_at: todayISO(), updated_at: todayISO(), data_source: "manual" },
    identity: { nome: "", cognome: "", email: "", birth_year: undefined, biological_sex: "unspecified", height_cm: undefined, weight_kg: undefined },
    disciplines: [],
    physiological_thresholds: {
      running: { zone_system: "7-zone", thresholds_log: [] },
      cycling: { zone_system: "7-zone", thresholds_log: [] },
      swimming: { thresholds_log: [] }
    },
    training_status: {
      detraining_period: { active: false, duration_weeks: undefined, cause: "lavoro", severity: "lieve_riduzione" },
      load_metrics_log: [],
      lifestyle_factors: [],
      lifestyle_factors_note: ""
    },
    goals: {
      primary_objective: "forma_fisica_generale", primary_objective_detail: "",
      secondary_objective: "", secondary_objective_detail: "",
      periodization_model: "continuous_improvement", target_events: []
    },
    constraints: {
      days_available: DAY_LABELS.map(([day]) => ({ day, active: true, fixed_activity: "", max_duration_minutes: undefined })),
      sessions_per_week_target: undefined
    },
    methodology_preferences: { intensity_distribution_model: "polarizzato_80_20", load_deload_pattern: "3:1" },
    notes_free_text: "",
    integrations: { intervals_icu_api_key: "" },
    training_plan: null,
    weekly_feedback_log: []
  };
}
