import { describe, expect, it } from "vitest";
import { STATE_LABELS, versionLabel } from "./workoutState";

describe("glossario degli stati (D-03)", () => {
  it("un nome per concetto, senza parole con la stessa radice su assi diversi", () => {
    const labels = [...Object.values(STATE_LABELS), versionLabel(1)];
    expect(new Set(labels).size).toBe(labels.length);
    for (const stem of ["revision", "rived"]) expect(labels.filter((l) => l.toLowerCase().includes(stem))).toEqual([]);
    expect(labels.filter((l) => l.toLowerCase().includes("verific"))).toHaveLength(1);
  });
});
