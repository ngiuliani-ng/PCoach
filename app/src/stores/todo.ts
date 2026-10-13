// Dati della pagina «Da fare» per tutti gli atleti (D-01): sedute attive non svolte, invii non
// riusciti e feedback delle ultime settimane. Si rilegge a ogni cambio di pagina, cosi' quello che il
// coach sistema in una scheda sparisce dalla home e dal contatore nella barra laterale.
import { defineStore } from "pinia";
import { supabase } from "../services/supabase";
import { addDaysISO, weekStartISO } from "@shared/workouts/calendar.ts";
import { todayISO, fullName } from "../constants";
import { buildTodo, TODO_FEEDBACK_WEEKS, type AthleteTodo, type TodoReview, type TodoWorkout } from "../domain/todo";
import { useAthletesStore } from "./athletes";
import { useSettingsStore } from "./settings";

export const useTodoStore = defineStore("todo", {
  state: () => ({
    workouts: [] as TodoWorkout[],
    syncErrors: new Set<string>(),
    reviews: [] as TodoReview[],
    loaded: false,
    error: ""
  }),
  getters: {
    list(state): AthleteTodo[] {
      const athletes = useAthletesStore();
      const settings = useSettingsStore();
      return buildTodo({
        athletes: athletes.sortedList.map((a) => ({ id: a.id, name: fullName(athletes.athletes[a.id]?.identity) || a.name, profile: athletes.athletes[a.id] as never })),
        workouts: state.workouts,
        syncErrors: state.syncErrors,
        reviews: state.reviews,
        emailEnabled: settings.savedEmailEnabled,
        today: todayISO()
      });
    },
  },
  actions: {
    async refresh() {
      if (!supabase) return;
      const since = addDaysISO(weekStartISO(todayISO()), -7 * (TODO_FEEDBACK_WEEKS + 1));
      const [w, s, r] = await Promise.all([
        supabase.from("workouts").select("id, athlete_id, planned_date, title, status, needs_review").in("status", ["draft", "approved"]).is("completed_at", null),
        supabase.from("workout_sync").select("workout_id").eq("state", "error"),
        supabase.from("weekly_reviews").select("id, athlete_id, period_start, revision, status, delivery_status, error, delivery_error").gte("period_start", since)
      ]);
      if (w.error || s.error || r.error) {
        this.error = "Non riesco a leggere cosa c'è da fare: controlla la connessione e riprova.";
        return;
      }
      this.error = "";
      this.workouts = (w.data ?? []) as TodoWorkout[];
      this.syncErrors = new Set((s.data ?? []).map((x) => (x as { workout_id: string }).workout_id));
      this.reviews = (r.data ?? []) as TodoReview[];
      this.loaded = true;
    }
  }
});
