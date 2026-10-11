import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null, supabaseUrl: "", supabaseAnonKey: "" }));
const { extractJsonBlock } = await import("./claude");

describe("lettura del JSON nella risposta di Claude", () => {
  const plan = { workouts: [{ date: "2026-10-12" }] };

  it("JSON puro, in un blocco ```json o in un blocco senza linguaggio", () => {
    expect(extractJsonBlock(JSON.stringify(plan))).toEqual(plan);
    expect(extractJsonBlock("Ecco:\n```json\n" + JSON.stringify(plan) + "\n```")).toEqual(plan);
    expect(extractJsonBlock("```\n" + JSON.stringify(plan) + "\n```")).toEqual(plan);
  });

  it("testo prima e dopo il JSON senza blocco di codice", () => {
    expect(extractJsonBlock("Ecco il piano:\n" + JSON.stringify(plan) + "\nBuon allenamento!")).toEqual(plan);
  });

  it("JSON troncato o assente: null", () => {
    expect(extractJsonBlock('{"workouts":[{"date":"2026-10-12"')).toBeNull();
    expect(extractJsonBlock("Non posso generare il piano.")).toBeNull();
  });
});
