import { describe, expect, it } from "vitest";
import { continueFromDate, cycleAnchor, parseLoadPattern, planWeeks, withPhases } from "./planWeeks";

const pattern = parseLoadPattern("3:1");

describe("settimane del piano", () => {
  it("interpreta lo schema di carico e scarico scritto dal coach", () => {
    expect(pattern).toEqual({ load: 3, deload: 1 });
    expect(parseLoadPattern("2/1")).toEqual({ load: 2, deload: 1 });
    expect(parseLoadPattern("a sensazione")).toBeNull();
  });

  it("da lunedi', senza piano precedente: il ciclo 3:1 parte dalla settimana 1", () => {
    const weeks = planWeeks("2026-10-12", 4, pattern);
    expect(weeks.map((w) => w.phase)).toEqual(["carico 1 di 3", "carico 2 di 3", "carico 3 di 3", "scarico"]);
    expect(weeks[3]).toMatchObject({ number: 4, weekStart: "2026-11-02", from: "2026-11-02", to: "2026-11-08", isDeload: true, cycleWeek: 4 });
  });

  it("da domenica: il primo giorno e' un raccordo fuori dal ciclo", () => {
    const weeks = planWeeks("2026-10-11", 4, pattern);
    expect(weeks.map((w) => [w.number, w.phase, w.cycleWeek])).toEqual([
      [0, "raccordo", null], [1, "carico 1 di 3", 1], [2, "carico 2 di 3", 2], [3, "carico 3 di 3", 3], [4, "scarico", 4]
    ]);
    expect(weeks.at(-1)).toMatchObject({ from: "2026-11-02", to: "2026-11-07" });
  });

  it("da mercoledi': la settimana in corso e' la 1", () => {
    const weeks = planWeeks("2026-10-14", 2, null);
    expect(weeks.map((w) => [w.number, w.from, w.to, w.phase])).toEqual([
      [1, "2026-10-14", "2026-10-18", ""],
      [2, "2026-10-19", "2026-10-25", ""],
      [3, "2026-10-26", "2026-10-27", ""]
    ]);
  });
});

describe("ciclo ancorato al piano attivo", () => {
  const stored = withPhases([{ week_start: "2026-10-12", label: "Base", is_deload: false }], planWeeks("2026-10-12", 4, pattern));

  it("salva scarico e settimana del ciclo calcolati da PCoach", () => {
    expect(stored.map((m) => [m.week_start, m.label, m.is_deload, m.cycle_week])).toEqual([
      ["2026-10-12", "Base", false, 1], ["2026-10-19", "Carico 2 di 3", false, 2], ["2026-10-26", "Carico 3 di 3", false, 3], ["2026-11-02", "Scarico", true, 4]
    ]);
  });

  it("la finestra successiva prosegue il ciclo", () => {
    const next = planWeeks("2026-11-09", 4, pattern, cycleAnchor(stored, "2026-11-09"));
    expect(next.map((w) => w.phase)).toEqual(["carico 1 di 3", "carico 2 di 3", "carico 3 di 3", "scarico"]);
  });

  it("una ripianificazione a meta' ciclo riparte dalla settimana in corso, non da carico 1", () => {
    const anchor = cycleAnchor(stored, "2026-10-28");
    expect(anchor).toEqual({ weekStart: "2026-10-26", cycleWeek: 3 });
    expect(planWeeks("2026-10-28", 2, pattern, anchor).map((w) => w.phase)).toEqual(["carico 3 di 3", "scarico", "carico 1 di 3"]);
  });

  it("con un ancora il raccordo di fine settimana segue la fase di quella settimana", () => {
    const weeks = planWeeks("2026-11-08", 1, pattern, cycleAnchor(stored, "2026-11-08"));
    expect(weeks.map((w) => [w.number, w.phase])).toEqual([[0, "scarico"], [1, "carico 1 di 3"]]);
  });
});

describe("prosecuzione del piano", () => {
  it("parte dal giorno dopo la fine del piano o dell'ultima seduta, mai prima di domani", () => {
    expect(continueFromDate("2026-11-08", ["2026-11-07"], "2026-10-11")).toBe("2026-11-09");
    expect(continueFromDate("2026-11-08", ["2026-11-12"], "2026-10-11")).toBe("2026-11-13");
    expect(continueFromDate("2026-10-04", [], "2026-10-11")).toBe("2026-10-12");
    expect(continueFromDate(null, [], "2026-10-11")).toBe("2026-10-12");
  });
});
