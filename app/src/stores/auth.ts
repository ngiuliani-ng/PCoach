// Store Pinia per l'autenticazione (Fase 9): un solo utente coach, creato manualmente da
// dashboard Supabase (nessuna sign-up pubblica). Il login e' il gate d'accesso reale
// all'app; le policy RLS lato DB si basano sulla stessa sessione (vedi
// supabase/migrations/0001_enable_rls.sql).
import { defineStore } from "pinia";
import type { Session } from "@supabase/supabase-js";
import { supabase, configured } from "../services/supabase";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: null as Session | null,
    loading: true,
    error: null as string | null
  }),
  getters: {
    isAuthenticated(state): boolean {
      return state.session !== null;
    }
  },
  actions: {
    async init() {
      if (!configured || !supabase) {
        this.loading = false;
        return;
      }
      const { data } = await supabase.auth.getSession();
      this.session = data.session;
      this.loading = false;
      supabase.auth.onAuthStateChange((_event, session) => {
        this.session = session;
      });
    },
    async signIn(email: string, password: string): Promise<{ ok: boolean; message: string }> {
      if (!configured || !supabase) {
        return { ok: false, message: "Impossibile accedere: Supabase non configurato." };
      }
      this.error = null;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        const message = "Credenziali non valide.";
        this.error = message;
        return { ok: false, message };
      }
      this.session = data.session;
      return { ok: true, message: "Accesso effettuato." };
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
      this.session = null;
    }
  }
});
