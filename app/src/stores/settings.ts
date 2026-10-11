// Store Pinia per le impostazioni app-wide, persistite nella riga unica app_settings (id=1).
// La chiave di Claude non si rilegge mai nel browser (ADR 0020): si sa solo se e' configurata
// (rpc claude_key_configured) e la si scrive solo quando il coach ne inserisce una nuova.
// Preferenze del piano e tono del feedback uguali al predefinito si salvano vuote, cosi' un
// miglioramento del predefinito nel codice arriva anche a chi non li ha personalizzati.
import { defineStore } from "pinia";
import { supabase, configured } from "../services/supabase";
import { DEFAULT_PLAN_PREFERENCES, DEFAULT_FEEDBACK_PROMPT, isLegacyPlanTemplate, type DayKey } from "../constants";
import { DEFAULT_FEEDBACK_PARAMS, resolveFeedbackParams, validateFeedbackParams, type FeedbackParams } from "@shared/feedback/params.ts";
import { resolveModel } from "@shared/claude/models.ts";

export interface AppSettings {
  /** Nuova chiave inserita dal coach in questa sessione; vuota = invariata. */
  claude_api_key: string;
  claude_model: string;
  /** Preferenze metodologiche del coach per la generazione (non il prompt intero). */
  plan_generation_prompt_template: string;
  weekly_feedback_prompt_template: string;
  weekly_feedback_day: DayKey;
  weekly_feedback_time: string;
  weekly_feedback_timezone: string;
  weekly_feedback_email_enabled: boolean;
  /** Soglie dell'analisi del feedback (ADR 0019). */
  feedback_params: FeedbackParams;
}

const COLUMNS = "claude_model, plan_generation_prompt_template, weekly_feedback_prompt_template, weekly_feedback_day, weekly_feedback_time, weekly_feedback_timezone, weekly_feedback_email_enabled, feedback_params";

function defaults(): AppSettings {
  return {
    claude_api_key: "",
    claude_model: resolveModel(),
    plan_generation_prompt_template: DEFAULT_PLAN_PREFERENCES,
    weekly_feedback_prompt_template: DEFAULT_FEEDBACK_PROMPT,
    weekly_feedback_day: "lunedi",
    weekly_feedback_time: "08:00",
    weekly_feedback_timezone: "Europe/Rome",
    weekly_feedback_email_enabled: false,
    feedback_params: { ...DEFAULT_FEEDBACK_PARAMS }
  };
}

/** Testo da salvare: vuoto (null) se coincide con il predefinito. */
function unlessDefault(text: string, fallback: string): string | null {
  return text.trim() === fallback.trim() ? null : text;
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    settings: defaults(),
    /** La chiave di Claude e' salvata nel database. */
    hasClaudeKey: false,
    /** Impostazioni lette dal database: senza, il salvataggio sovrascriverebbe i valori reali con i predefiniti. */
    loaded: false,
    /** Ultima versione letta o salvata, per riconoscere le modifiche non salvate. */
    baseline: JSON.stringify(defaults())
  }),
  getters: {
    isDirty: (s) => JSON.stringify(s.settings) !== s.baseline
  },
  actions: {
    /** Scarta le modifiche non salvate: tornano i valori letti o salvati per ultimi. */
    discardChanges() {
      this.settings = JSON.parse(this.baseline);
    },
    async load() {
      if (!configured || !supabase) return;
      const [{ data, error }, key] = await Promise.all([
        supabase.from("app_settings").select(COLUMNS).eq("id", 1).maybeSingle(),
        supabase.rpc("claude_key_configured")
      ]);
      if (error) return;
      const fallback = defaults();
      const row = (data ?? {}) as Record<string, unknown> & Partial<AppSettings>;
      const planPrefs = row.plan_generation_prompt_template;
      this.settings = {
        claude_api_key: "",
        claude_model: resolveModel(row.claude_model),
        plan_generation_prompt_template: planPrefs && !isLegacyPlanTemplate(planPrefs) ? planPrefs : DEFAULT_PLAN_PREFERENCES,
        weekly_feedback_prompt_template: row.weekly_feedback_prompt_template ?? DEFAULT_FEEDBACK_PROMPT,
        weekly_feedback_day: row.weekly_feedback_day ?? fallback.weekly_feedback_day,
        // Conta solo l'ora: i minuti non sono mai stati usati dall'esecuzione oraria.
        weekly_feedback_time: `${(row.weekly_feedback_time ?? fallback.weekly_feedback_time).slice(0, 2)}:00`,
        weekly_feedback_timezone: row.weekly_feedback_timezone ?? fallback.weekly_feedback_timezone,
        weekly_feedback_email_enabled: row.weekly_feedback_email_enabled ?? fallback.weekly_feedback_email_enabled,
        feedback_params: resolveFeedbackParams(row.feedback_params)
      };
      this.hasClaudeKey = key.data === true;
      this.baseline = JSON.stringify(this.settings);
      this.loaded = true;
    },
    async save(): Promise<{ ok: boolean; message: string }> {
      if (!configured || !supabase) {
        return { ok: false, message: "Impossibile salvare: Supabase non configurato." };
      }
      if (!this.loaded) {
        return { ok: false, message: "Impostazioni non ancora caricate: ricarica la pagina e riprova." };
      }
      if (Object.keys(validateFeedbackParams(this.settings.feedback_params)).length) {
        return { ok: false, message: "Correggi le soglie del feedback prima di salvare." };
      }
      const { claude_api_key, ...rest } = this.settings;
      const newKey = claude_api_key.trim();
      const row: Record<string, unknown> = {
        id: 1,
        ...rest,
        // Il giorno non si sceglie piu' (decisione D-11): resta il lunedi' anche nel database.
        weekly_feedback_day: "lunedi",
        plan_generation_prompt_template: unlessDefault(rest.plan_generation_prompt_template, DEFAULT_PLAN_PREFERENCES),
        weekly_feedback_prompt_template: unlessDefault(rest.weekly_feedback_prompt_template, DEFAULT_FEEDBACK_PROMPT)
      };
      if (newKey) row.claude_api_key = newKey;
      const { error } = await supabase.from("app_settings").upsert(row);
      if (error) return { ok: false, message: "Salvataggio impostazioni fallito." };
      if (newKey) {
        this.hasClaudeKey = true;
        this.settings.claude_api_key = "";
      }
      this.baseline = JSON.stringify(this.settings);
      return { ok: true, message: "Impostazioni salvate." };
    }
  }
});
