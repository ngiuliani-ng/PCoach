// Guida di ogni gruppo di dati (decisione del coach D-04, ADR 0035): come in Garmin Connect, le
// spiegazioni non stanno sotto i campi ma in un pannello aperto dall'icona Info della sezione. Ogni voce
// prende il testo da FIELD_HELP, l'unica fonte dei testi d'aiuto.
import type { FieldHelpKey } from "./fieldHelp";

export interface GuideEntry {
  /** Nome del campo o del gruppo di campi, come compare nella pagina. */
  label: string;
  help: FieldHelpKey;
}

export interface Guide {
  title: string;
  entries: GuideEntry[];
}

export const GUIDES = {
  "profilo-identita": { title: "Identità", entries: [
    { label: "Dati inviati a Claude", help: "identity" },
    { label: "Email", help: "identity.email" }
  ] },
  "profilo-intervals": { title: "Intervals.icu", entries: [
    { label: "Chiave API di Intervals.icu", help: "integrations.intervals_icu_api_key" }
  ] },
  "profilo-discipline": { title: "Discipline", entries: [
    { label: "Volume settimanale attuale", help: "disciplines[].current_weekly_volume" },
    { label: "Picco settimanale negli ultimi 12 mesi", help: "disciplines[].peak_weekly_volume_last_12_months" }
  ] },
  "profilo-soglie": { title: "Soglie e zone", entries: [
    { label: "Sistema di zone", help: "physiological_thresholds.running.zone_system" },
    { label: "Rilevazioni", help: "physiological_thresholds" }
  ] },
  "profilo-stato": { title: "Stato di allenamento", entries: [
    { label: "Calo degli allenamenti e fattori di vita", help: "training_status.lifestyle_factors" }
  ] },
  "profilo-obiettivi": { title: "Obiettivi", entries: [
    { label: "Periodizzazione", help: "goals.periodization_model" },
    { label: "Eventi target e tapering", help: "goals.target_events" }
  ] },
  "profilo-vincoli": { title: "Vincoli e disponibilità", entries: [
    { label: "Giorni, durata massima e attività abituale", help: "constraints.days_available" },
    { label: "Sessioni a settimana", help: "constraints.sessions_per_week_target" }
  ] },
  "profilo-metodologia": { title: "Metodologia", entries: [
    { label: "Distribuzione dell'intensità", help: "methodology_preferences.intensity_distribution_model" },
    { label: "Settimane di carico e di scarico", help: "methodology_preferences.load_deload_pattern" },
    { label: "Aumento e calo del carico", help: "methodology_preferences.load_increase_min_pct" }
  ] },
  "profilo-note": { title: "Note libere", entries: [
    { label: "Note libere", help: "notes_free_text" }
  ] },
  "panoramica-feedback": { title: "Feedback settimanale", entries: [
    { label: "Come funziona", help: "review.flow" }
  ] },
  "impostazioni-claude": { title: "Claude e generazione", entries: [
    { label: "Chiave e modello", help: "settings.claude_api_key" },
    { label: "Preferenze per generare il piano", help: "settings.plan_generation_prompt_template" }
  ] },
  "impostazioni-feedback": { title: "Feedback settimanale", entries: [
    { label: "Ora del lunedì e fuso orario", help: "settings.weekly_feedback_schedule" },
    { label: "Invio via email", help: "settings.weekly_feedback_email_enabled" },
    { label: "Tono del feedback", help: "settings.weekly_feedback_prompt_template" }
  ] },
  "impostazioni-classificazione": { title: "Classificazione delle sedute", entries: [
    { label: "Soglie del feedback", help: "settings.feedback_params" }
  ] },
  "impostazioni-intensita": { title: "Intensità per sistema di zone", entries: [
    { label: "Intensità bassa, media e alta", help: "settings.intensity_domains" }
  ] },
  "impostazioni-modelli": { title: "Modelli di zone", entries: [
    { label: "Limiti delle zone", help: "settings.zone_models" }
  ] }
} satisfies Record<string, Guide>;

export type GuideKey = keyof typeof GUIDES;

export const isGuideKey = (v: string | null): v is GuideKey => !!v && v in GUIDES;
