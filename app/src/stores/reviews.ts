// Store delle valutazioni settimanali dell'atleta aperto (ADR 0019). Le righe si leggono da
// weekly_reviews (RLS del coach); le azioni passano dalla Edge Function weekly-feedback, che
// esegue analisi, testo e consegna. Nessuna email parte senza «Approva».
import { defineStore } from "pinia";
import { supabase } from "../services/supabase";
import * as api from "../services/feedback";
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
  "id, athlete_id, period_start, period_end, revision, status, skip_reason, input, output, output_text, model, error, attempts, delivery_status, delivery_error, delivered_at, approved_at, generated_at, created_at";

export type ActionResult = { ok: boolean; message: string };

export const useReviewsStore = defineStore("reviews", {
  state: () => ({
    athleteId: null as string | null,
    reviews: [] as ReviewRecord[],
    loading: false,
    /** Id della valutazione su cui e' in corso un'azione (o "new" per la creazione). */
    busy: null as string | null
  }),
  getters: {
    /** Valutazioni correnti (non sostituite), dalla settimana piu' recente. */
    current: (s) => s.reviews.filter((r) => r.status !== "superseded"),
    toReview: (s) => s.reviews.filter((r) => r.status === "draft").length
  },
  actions: {
    async load(athleteId: string | null) {
      this.athleteId = athleteId;
      this.reviews = [];
      if (!athleteId || !supabase) return;
      this.loading = true;
      const { data } = await supabase.from("weekly_reviews").select(COLUMNS).eq("athlete_id", athleteId)
        .order("period_start", { ascending: false }).order("revision", { ascending: false }).limit(60);
      if (this.athleteId === athleteId) this.reviews = (data ?? []) as ReviewRecord[];
      this.loading = false;
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
    create(weekStart: string) {
      const id = this.athleteId!;
      return this.run("new", () => api.createReview(id, weekStart), statusMessage);
    },
    regenerate(reviewId: string) {
      return this.run(reviewId, () => api.regenerateReview(reviewId), statusMessage);
    },
    retry(reviewId: string) {
      return this.run(reviewId, () => api.retryReview(reviewId), statusMessage);
    },
    approve(reviewId: string, text: string, send = true) {
      return this.run(reviewId, () => api.approveReview(reviewId, text, send), (_s, delivery) =>
        delivery === "sent" ? "Feedback approvato e inviato all'atleta." :
        delivery === "not_requested" ? (send ? "Feedback approvato. L'invio via email è disattivato in Impostazioni." : "Feedback approvato, senza un nuovo invio all'atleta.") :
        delivery === "failed" ? "Feedback approvato, ma l'email non è partita: verrà ritentata." :
        "Feedback approvato.");
    }
  }
});

function statusMessage(status: string): string {
  if (status === "draft") return "Feedback pronto da rivedere.";
  if (status === "skipped") return "Nessuna seduta approvata in quella settimana: niente da valutare.";
  if (status === "analysis_failed" || status === "generation_failed") return "Valutazione non riuscita: vedi il dettaglio.";
  return "Valutazione in corso: riprova tra poco per vedere il risultato.";
}
