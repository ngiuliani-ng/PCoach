import { describe, expect, it } from "vitest";
import { buildTodo, type TodoInput } from "./todo";

const base = (over: Partial<TodoInput> = {}): TodoInput => ({
  athletes: [
    { id: "A", name: "Giulia Ferri", profile: { identity: { email: "" }, disciplines: [{ sport: "running" }], physiological_thresholds: { running: { thresholds_log: [{ date: "2026-09-01", threshold_pace_per_km: "4:46" }] } } } as never },
    { id: "B", name: "Marco Bianchi", profile: { identity: { email: "m@example.test" }, disciplines: [] } as never }
  ],
  workouts: [],
  syncErrors: new Set(),
  reviews: [],
  emailEnabled: false,
  today: "2026-10-10",
  ...over
});

describe("pagina «Da fare» (D-01)", () => {
  it("un atleta senza nulla da fare non compare", () => {
    expect(buildTodo(base())).toEqual([]);
  });

  it("feedback da approvare, errori prima, sedute da verificare contate una per una", () => {
    const todo = buildTodo(base({
      reviews: [
        { id: "r1", athlete_id: "A", period_start: "2026-10-05", revision: 1, status: "superseded", delivery_status: "not_requested", error: null, delivery_error: null },
        { id: "r2", athlete_id: "A", period_start: "2026-10-05", revision: 2, status: "draft", delivery_status: "not_requested", error: null, delivery_error: null },
        { id: "r0", athlete_id: "A", period_start: "2026-09-28", revision: 1, status: "approved", delivery_status: "failed", error: null, delivery_error: "Errore SMTP" }
      ],
      workouts: [
        { id: "w1", athlete_id: "A", planned_date: "2026-10-12", title: "Lungo", status: "approved", needs_review: "Troppo lunga" },
        { id: "w2", athlete_id: "A", planned_date: "2026-10-13", title: "Tempo", status: "approved", needs_review: "Zone cambiate" },
        { id: "w3", athlete_id: "A", planned_date: "2026-10-14", title: "Bozza", status: "draft", needs_review: null },
        { id: "w4", athlete_id: "A", planned_date: "2026-11-30", title: "Lontana", status: "draft", needs_review: null }
      ]
    }));
    expect(todo).toHaveLength(1);
    const a = todo[0];
    expect(a.items.map((i) => i.key)).toEqual(["delivery-r0", "needs-review", "review-r2", "drafts"]);
    expect(a.items.find((i) => i.key === "drafts")!.title).toBe("Una seduta in bozza da approvare");
    expect(a.count).toBe(5);
    expect(a.items.find((i) => i.key === "review-r2")!.links[0].to).toEqual({ name: "athlete", params: { id: "A", tab: "panoramica" }, query: { feedback: "r2" } });
  });

  it("email mancante solo con l'invio attivo; soglia mancante per uno sport praticato (D-05)", () => {
    expect(buildTodo(base({ emailEnabled: true })).map((a) => [a.id, a.items.map((i) => i.key)])).toEqual([["A", ["email"]]]);
    const noPace = base();
    (noPace.athletes[0].profile as { physiological_thresholds: unknown }).physiological_thresholds = {};
    expect(buildTodo(noPace)[0].items[0].title).toBe("Manca il passo di soglia della corsa");
  });
});
