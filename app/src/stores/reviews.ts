// Store delle valutazioni settimanali dell'atleta aperto (ADR 0019). Le righe si leggono da
// weekly_reviews (RLS del coach); le azioni passano dalla Edge Function weekly-feedback, che
// esegue analisi, testo e consegna. Nessuna email parte senza «Approva».
import { defineStore } from "pinia";
import { supabase } from "../services/supabase";
import * as api from "../services/feedback";
import { showToast } from "../composables/useToast";
import type { FeedbackInput } from "@shared/feedback/contract.ts";
import type { FeedbackOutput } from "@shared/feedback/output.ts";
import type { DeliveryStatus, ReviewStatus } from "@shared/feedback/pipeline.ts";

export interface ReviewRecord {
  id: string;
  athlete_id: string;
  period_start: string;
  period_end: string;
  revision: number;
  status: ReviewStatus;
  skip_reason: string | null;
  input: FeedbackInput | null;
  output: FeedbackOutput | null;
  output_text: string | null;
  /** Testo della bozza corretto dal coach, salvato in automatico (ADR 0038). */
  coach_text: string | null;
  coach_text_at: string | null;
  model: string | null;
  error: string | null;
  attempts: number;
  delivery_status: DeliveryStatus;
  delivery_error: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  generated_at: string | null;
  created_at: string;
}

const COLUMNS =
  "id, athlete_id, period_start, period_end, revision, status, skip_reason, input, output, output_text, coach_text, coach_text_at, model, error, attempts, delivery_status, delivery_error, delivered_at, approved_at, generated_at, created_at";

export type ActionResult = { ok: boolean; message: string };

/** Stato del testo di una bozza non ancora salvato: in attesa del salvataggio automatico, in corso, fallito. */
export type TextState = "pending" | "saving" | "failed";
/** Attesa dopo l'ultima battuta prima di salvare il testo (ADR 0038). */
export const TEXT_SAVE_DELAY_MS = 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Bozze per cui l'errore di salvataggio e' gia' stato mostrato: non si ripete a ogni nuovo tentativo. */
const notified = new Set<string>();

export const useReviewsStore = defineStore("reviews", {
  state: () => ({
    athleteId: null as string | null,
    reviews: [] as ReviewRecord[],
    loading: false,
    /** Id della valutazione su cui e' in corso un'azione (o "new" per la creazione). */
    busy: null as string | null,
    /** Testo mostrato nel campo di ogni bozza: quello del coach se l'ha corretto, altrimenti quello di Claude. */
    texts: {} as Record<string, string>,
    /** Bozze con il testo non ancora salvato (ADR 0038): la nuvola diventa rossa e l'uscita chiede conferma. */
    unsavedText: {} as Record<string, TextState>
  }),
  getters: {
    /** Valutazioni correnti (non sostituite), dalla settimana piu' recente. */
    current: (s) => s.reviews.filter((r) => r.status !== "superseded"),
    toReview: (s) => s.reviews.filter((r) => r.status === "draft").length,
    hasUnsavedText: (s) => Object.keys(s.unsavedText).length > 0
  },
  actions: {
    async load(athleteId: string | null) {
      this.athleteId = athleteId;
      this.reviews = [];
      if (!athleteId || !supabase) return;
      this.loading = true;
      const { data } = await supabase.from("weekly_reviews").select(COLUMNS).eq("athlete_id", athleteId)
        .order("period_start", { ascending: false }).order("revision", { ascending: false }).limit(60);
      if (this.athleteId === athleteId) this.setRows((data ?? []) as ReviewRecord[]);
      this.loading = false;
    },
    /** Rilegge le valutazioni senza svuotare l'elenco (aggiornamento in background). */
    /** Righe lette dal database; il testo di una bozza non ancora salvato resta quello del campo. */
    setRows(rows: ReviewRecord[]) {
      this.reviews = rows;
      for (const r of rows) {
        if (r.status === "draft" && !this.unsavedText[r.id]) this.texts[r.id] = r.coach_text ?? r.output_text ?? "";
      }
    },
    /** Il coach scrive nel campo: si salva un secondo dopo l'ultima battuta. */
    editText(id: string, text: string) {
      this.texts[id] = text;
      if (this.unsavedText[id] !== "saving") this.unsavedText[id] = "pending";
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => void this.saveText(id), TEXT_SAVE_DELAY_MS));
    },
    /** Salva subito (uscita dal campo, uscita dalla scheda). true se il testo e' salvato. */
    async flushText(id: string, quiet = false): Promise<boolean> {
      clearTimeout(timers.get(id));
      timers.delete(id);
      if (!this.unsavedText[id]) return true;
      return this.saveText(id, quiet);
    },
    /** Uscita dalla scheda: senza messaggio d'errore, perche' lo dice la domanda che segue. */
    async flushAllTexts(): Promise<boolean> {
      const results = await Promise.all(Object.keys(this.unsavedText).map((id) => this.flushText(id, true)));
      return results.every(Boolean);
    },
    /**
     * Scrive il testo del coach sulla bozza (RLS del coach, solo se ancora in bozza). Uguale a quello
     * di Claude: coach_text torna null, cioe' «non corretto». Una bozza nel frattempo approvata o
     * rigenerata non e' un errore: il testo non serve piu'.
     */
    async saveText(id: string, quiet = false): Promise<boolean> {
      clearTimeout(timers.get(id));
      timers.delete(id);
      const row = this.reviews.find((r) => r.id === id);
      if (!supabase || !row) { delete this.unsavedText[id]; return true; }
      const text = this.texts[id] ?? "";
      this.unsavedText[id] = "saving";
      const coachText = text === (row.output_text ?? "") ? null : text;
      const { data, error } = await supabase.from("weekly_reviews")
        .update({ coach_text: coachText, coach_text_at: coachText === null ? null : new Date().toISOString() })
        .eq("id", id).eq("status", "draft").select("id, coach_text, coach_text_at");
      if (error) {
        this.unsavedText[id] = "failed";
        // Il dettaglio tecnico va in console, non nel messaggio (audit A-19).
        console.warn("Salvataggio del testo del feedback non riuscito:", error.message);
        if (!quiet && !notified.has(id)) showToast("Testo del feedback non salvato: riprovo alla prossima modifica. Se il problema resta, controlla la connessione.", "error");
        notified.add(id);
        return false;
      }
      const saved = (data ?? [])[0] as Pick<ReviewRecord, "coach_text" | "coach_text_at"> | undefined;
      if (saved) Object.assign(row, saved);
      // Nuove battute durante il salvataggio: si risalva.
      if ((this.texts[id] ?? "") !== text) {
        this.unsavedText[id] = "pending";
        return this.saveText(id, quiet);
      }
      delete this.unsavedText[id];
      notified.delete(id);
      return true;
    },
    /** Uscita senza salvare: si torna al testo salvato sul server. */
    discardTexts() {
      for (const id of Object.keys(this.unsavedText)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
        const row = this.reviews.find((r) => r.id === id);
        if (row) this.texts[id] = row.coach_text ?? row.output_text ?? "";
      }
      this.unsavedText = {};
      notified.clear();
    },
    /** Il testo della bozza e' diverso da quello di Claude (correzioni del coach). */
    isEdited(id: string): boolean {
      const row = this.reviews.find((r) => r.id === id);
      return !!row && (this.texts[id] ?? "") !== (row.output_text ?? "");
    },
    forgetText(id: string) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      notified.delete(id);
      delete this.unsavedText[id];
      delete this.texts[id];
    },
    async refresh() {
      if (!this.athleteId || !supabase) return;
      const id = this.athleteId;
      const { data, error } = await supabase.from("weekly_reviews").select(COLUMNS).eq("athlete_id", id)
        .order("period_start", { ascending: false }).order("revision", { ascending: false }).limit(60);
      if (!error && this.athleteId === id) this.setRows((data ?? []) as ReviewRecord[]);
    },
    async run(key: string, action: () => ReturnType<typeof api.createReview>, success: (status: string, delivery?: string) => string): Promise<ActionResult> {
      this.busy = key;
      try {
        const res = await action();
        await this.load(this.athleteId);
        return res.ok ? { ok: true, message: success(res.data.status, res.data.delivery_status) } : { ok: false, message: res.error };
      } finally {
        this.busy = null;
      }
    },
    /**
     * Ultime analisi settimanali concluse prima di una data, anche non approvate: i dati sono calcolati
     * da PCoach e servono alla generazione successiva (decisione D-09). Solo il contratto, non il testo.
     */
    async analysesBefore(athleteId: string, date: string, limit = 2): Promise<{ period_start: string; period_end: string; input: FeedbackInput }[]> {
      if (!supabase) return [];
      const { data } = await supabase.from("weekly_reviews").select("period_start, period_end, input")
        .eq("athlete_id", athleteId).neq("status", "superseded").not("input", "is", null).lt("period_end", date)
        .order("period_start", { ascending: false }).limit(limit);
      return (data ?? []) as { period_start: string; period_end: string; input: FeedbackInput }[];
    },
    create(weekStart: string) {
      const id = this.athleteId!;
      return this.run("new", () => api.createReview(id, weekStart), statusMessage);
    },
    /** Il testo corretto dal coach si scarta solo se la rigenerazione riesce (audit FB-01). */
    async regenerate(reviewId: string) {
      clearTimeout(timers.get(reviewId));
      const res = await this.run(reviewId, () => api.regenerateReview(reviewId), statusMessage);
      if (res.ok) this.forgetText(reviewId);
      else if (this.unsavedText[reviewId] === "pending") void this.saveText(reviewId);
      return res;
    },
    retry(reviewId: string) {
      return this.run(reviewId, () => api.retryReview(reviewId), statusMessage);
    },
    async approve(reviewId: string, text: string, send = true) {
      clearTimeout(timers.get(reviewId));
      const res = await this.run(reviewId, () => api.approveReview(reviewId, text, send), (_s, delivery) =>
        delivery === "sent" ? "Feedback approvato e inviato all'atleta." :
        delivery === "not_requested" ? (send ? "Feedback approvato. L'invio via email è disattivato in Impostazioni." : "Feedback approvato, senza un nuovo invio all'atleta.") :
        delivery === "failed" ? "Feedback approvato, ma l'email non è partita: verrà ritentata." :
        "Feedback approvato.");
      if (res.ok) this.forgetText(reviewId);
      return res;
    }
  }
});

function statusMessage(status: string): string {
  if (status === "draft") return "Feedback pronto da approvare.";
  if (status === "approved") return "Questa settimana ha già un feedback approvato: per rifarlo usa «Rigenera».";
  if (status === "skipped") return "Nessuna seduta approvata in quella settimana: niente da valutare.";
  if (status === "analysis_failed" || status === "generation_failed") return "Valutazione non riuscita: vedi il dettaglio.";
  return "Feedback in preparazione: compare qui appena è pronto.";
}
