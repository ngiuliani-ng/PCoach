import { describe, expect, it } from "vitest";
import { mergeBlockResponses, planBlocks } from "./planBlocks";

describe("generazione a blocchi", () => {
  it("un piano breve resta una sola richiesta", () => {
    expect(planBlocks("2026-10-12", 3)).toEqual([{ index: 0, count: 1, fromDate: "2026-10-12", weeks: 3, firstWeek: 1 }]);
  });

  it("divide un piano lungo in blocchi consecutivi e bilanciati", () => {
    const blocks = planBlocks("2026-10-12", 10);
    expect(blocks.map((b) => b.weeks)).toEqual([3, 3, 2, 2]);
    expect(blocks.map((b) => b.fromDate)).toEqual(["2026-10-12", "2026-11-02", "2026-11-23", "2026-12-07"]);
    expect(blocks.map((b) => b.firstWeek)).toEqual([1, 4, 7, 9]);
  });

  it("riunisce le risposte in un'unica proposta", () => {
    const merged = mergeBlockResponses([
      { plan_name: "Base", weeks: [{ week_start: "2026-10-12" }], workouts: [{ date: "2026-10-12" }] },
      { plan_name: "Altro", weeks: [{ week_start: "2026-10-19" }], workouts: [{ date: "2026-10-20" }] }
    ]);
    expect(merged).toEqual({
      plan_name: "Base",
      weeks: [{ week_start: "2026-10-12" }, { week_start: "2026-10-19" }],
      workouts: [{ date: "2026-10-12" }, { date: "2026-10-20" }]
    });
  });
});
