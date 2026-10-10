// Costanti condivise: opzioni dei menu a tendina, prompt di default per Claude
// e il profilo "vuoto" di un nuovo atleta. Porting a parità funzionale da index.html.
import type { Component } from "vue";
import { Activity, Bike, Dumbbell, Footprints, Waves } from "lucide-vue-next";
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

// Icona Lucide per disciplina nella vista grafica del piano (§8); fallback Activity per
// discipline non riconosciute (dato libero nel JSON generato da Claude).
export const DISCIPLINE_ICONS: Record<string, Component> = {
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  strength: Dumbbell,
};
export function disciplineIcon(discipline: string | null | undefined): Component {
  return (discipline && DISCIPLINE_ICONS[discipline]) || Activity;
}
// Etichetta leggibile della disciplina; le chiavi non riconosciute restano come sono.
export function disciplineLabel(discipline: string | null | undefined): string {
  if (!discipline) return "";
  const match = [...TRAINING_SPORT_OPTIONS, ...EVENT_DISCIPLINE_OPTIONS].find(([v]) => v === discipline);
  return match ? match[1] : discipline;
}

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
};

export const RUN_THRESHOLD_FIELDS: MetricFieldDef[] = [
  { key: "threshold_pace_per_km", label: "Passo soglia (min/km)", type: "text" },
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
  { key: "css_pace_per_100m", label: "CSS (min/100m)", type: "text" }
];

// Formato della risposta richiesto a Claude per generare le sedute (ADR 0017). PCoach ricava
// da solo giorno della settimana e metrica dei target: Claude indica solo date e zone.
export const TRAINING_PLAN_JSON_SHAPE = `{
  "plan_name": "string",
  "weeks": [
    { "week_start": "YYYY-MM-DD (lunedì)", "label": "string", "is_deload": false }
  ],
  "workouts": [
    {
      "date": "YYYY-MM-DD (copiata dal calendario)",
      "day": "lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica (il giorno di quella data nel calendario)",
      "discipline": "running|cycling|swimming|strength",
      "title": "nome tecnico breve della seduta",
      "objective": "obiettivo della seduta in una frase",
      "notes": "istruzioni per l'atleta",
      "duration_min": null,
      "steps": [
        { "kind": "step", "role": "warmup|work|recovery|steady|cooldown", "duration_sec": 600, "distance_m": null, "zone": "Z2", "zone_to": null, "cue": "" },
        { "kind": "repeat", "count": 4, "label": "Serie principale", "steps": [
          { "kind": "step", "role": "work", "duration_sec": 240, "distance_m": null, "zone": "Z5", "zone_to": null, "cue": "" },
          { "kind": "step", "role": "recovery", "duration_sec": 180, "distance_m": null, "zone": "Z1", "zone_to": null, "cue": "" }
        ] }
      ]
    }
  ]
}
Regole del formato:
- Scrivi il JSON compatto, senza indentazione, una seduta per riga, e ometti i campi null o vuoti (distance_m, zone_to, cue, duration_min): la risposta ha un limite di lunghezza.
- date e day vengono dal calendario fornito: non calcolare tu il giorno della settimana di una data.
- Ogni step ha duration_sec (secondi) oppure distance_m (metri), mai entrambi.
- zone e zone_to sono zone da Z1 a Z7 (zone_to solo per un intervallo, ad esempio Z2-Z3). Niente percentuali, watt o passi assoluti: la metrica la sceglie PCoach (bici in potenza o frequenza cardiaca, corsa e nuoto in zone di passo).
- weeks: una voce per ogni settimana del calendario (campo "settimana"), con week_start il lunedì di quella settimana e is_deload true se la fase è "scarico".
- Una ripetuta (kind "repeat") contiene solo step, mai altre ripetute.
- Anche le sedute a ritmo costante hanno steps (un solo step "steady").
- Palestra (strength): steps vuoto, duration_min valorizzato, esercizi e serie in notes.`;

export const DEFAULT_PLAN_PROMPT = `Sei un coach esperto di allenamento endurance (corsa, bici, nuoto, palestra). Prepara le sedute di {{settimane}} settimane per l'atleta {{nome_atleta}}, dal {{data_inizio}} al {{data_fine}} compresi.

Dati dell'atleta (profilo, soglie, carico recente, sedute delle ultime due settimane con l'esito):
{{contesto_atleta_json}}

Motivo della pianificazione indicato dal coach:
{{motivo}}

Calendario del periodo, già calcolato: per ogni data il giorno della settimana, se l'atleta è disponibile, la durata massima in minuti di quel giorno, l'attività che fa di solito e, se noti, il numero della settimana e la sua fase nel ciclo di carico e scarico:
{{calendario_json}}

Sedute già fissate nel periodo, da NON ripetere né spostare (pianifica intorno a queste, tenendone conto nel carico):
{{sedute_fisse_json}}

Restituisci SOLO un oggetto JSON valido (puoi racchiuderlo in un blocco di codice \`\`\`json, oppure scriverlo senza altro testo prima o dopo), con questa struttura esatta:
{{formato_training_plan_json}}

Regole:
- Usa solo date del calendario con "disponibile": true. Non pianificare nulla nelle altre.
- La somma delle durate delle sedute di un giorno non deve superare "durata_massima_min" di quel giorno.
- L'attività abituale indica cosa l'atleta fa di solito quel giorno: rispettala come disciplina e tipo di seduta, salvo motivo diverso indicato dal coach.
- Rispetta il numero di sedute a settimana dell'atleta.
- Rispetta la distribuzione dell'intensità indicata.
- Rispetta la fase di ogni settimana indicata nel calendario. Nelle settimane di carico di un ciclo il carico cresce di settimana in settimana (circa +5-10% di volume o di lavoro in Z3 e oltre), in ogni disciplina.
- Nella settimana di scarico il volume cala di circa un terzo rispetto all'ultima di carico, con pochissimo lavoro intenso.
- Un nuovo ciclo riparte da un carico simile alla seconda settimana di carico del ciclo precedente: guarda le sedute recenti.
- La settimana di raccordo (fase "raccordo"), se presente, è leggera.
- Tieni conto del carico recente (CTL, ATL, TSB) e delle sedute non svolte.`;

export const DEFAULT_FEEDBACK_PROMPT = `Sei un coach esperto. Confronta la settimana pianificata con quella effettivamente svolta dall'atleta {{nome_atleta}} e scrivi un feedback breve (massimo 200 parole) in italiano: aderenza al piano, scostamenti di carico, suggerimenti per la settimana successiva.

Piano pianificato per questa settimana:
{{settimana_pianificata_json}}

Allenamenti realmente svolti questa settimana:
{{settimana_reale_json}}`;

// Date come "YYYY-MM-DD" nel calendario locale: implementazione nel modulo condiviso con le
// Edge Function (aritmetica a mezzogiorno UTC, immune ai fusi orari).
import { addDaysISO, todayISO } from "@shared/workouts/calendar.ts";
export { addDaysISO, todayISO };

export function numOrNull(v: unknown): number | null {
  return v === "" || v === null || v === undefined ? null : Number(v as string);
}

// Data leggibile in italiano ("10 ott 2026", o "10 ott" con withYear=false). Una data
// "YYYY-MM-DD" e' interpretata come giorno locale, non come mezzanotte UTC; un valore
// non interpretabile viene restituito cosi' com'e'.
export function formatDate(value: string | null | undefined, withYear = true): string {
  if (!value) return "";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", withYear
    ? { day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", month: "short" }
  ).format(d);
}

// Numero con segno esplicito e vero segno meno ("+4", "−12", "0"), per valori come il TSB
// dove il segno e' l'informazione principale.
export function formatSigned(n: number): string {
  const rounded = Math.round(n);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `−${Math.abs(rounded)}`;
  return "0";
}

export const PERIODIZATION_LABELS: Record<string, string> = {
  continuous_improvement: "Miglioramento continuo",
  race_peak_taper: "Picco e scarico verso la gara",
};

export function fullName(identity: { nome?: string; cognome?: string } | undefined): string {
  return [identity?.nome, identity?.cognome].filter((part) => part && part.trim()).join(" ");
}

export function blankProfile(): AthleteTrainingProfile {
  return {
    schema_version: "1.5.0",
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
    weekly_feedback_log: []
  };
}
