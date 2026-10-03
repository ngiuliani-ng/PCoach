// Store Pinia per le impostazioni app-wide (chiave/modello Claude, prompt di default),
// persistite nella riga unica app_settings (id=1).
import { defineStore } from "pinia";
import { supabase, configured } from "../services/supabase";
import { DEFAULT_PLAN_PROMPT, DEFAULT_FEEDBACK_PROMPT } from "../constants";

export interface AppSettings {
  claude_api_key: string;
  claude_model: string;
  plan_generation_prompt_template: string;
  weekly_feedback_prompt_template: string;
}

function defaults(): AppSettings {
  return {
    claude_api_key: "",
    claude_model: "claude-sonnet-4-5",
    plan_generation_prompt_template: DEFAULT_PLAN_PROMPT,
    weekly_feedback_prompt_template: DEFAULT_FEEDBACK_PROMPT
  };
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    settings: defaults()
  }),
  actions: {
    async load() {
      if (!configured || !supabase) return;
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (error || !data) return;
      this.settings = {
        claude_api_key: data.claude_api_key ?? "",
        claude_model: data.claude_model ?? defaults().claude_model,
        plan_generation_prompt_template: data.plan_generation_prompt_template ?? DEFAULT_PLAN_PROMPT,
        weekly_feedback_prompt_template: data.weekly_feedback_prompt_template ?? DEFAULT_FEEDBACK_PROMPT
      };
    },
    async save(): Promise<{ ok: boolean; message: string }> {
      if (!configured || !supabase) {
        return { ok: false, message: "Impossibile salvare: Supabase non configurato." };
      }
      const { error } = await supabase.from("app_settings").upsert({ id: 1, ...this.settings });
      if (error) return { ok: false, message: "Salvataggio impostazioni fallito." };
      return { ok: true, message: "Impostazioni salvate." };
    }
  }
});
