import { describe, expect, it } from "vitest";
import { buildPlanViewModel, defaultOpenWeekIndex, zoneColorVar } from "./planViewModel";

const TODAY = "2026-10-03";

describe("buildPlanViewModel", () => {
  it("restituisce null se training_plan e' null o manca weeks[]", () => {
    expect(buildPlanViewModel(null, TODAY)).toBeNull();
    expect(buildPlanViewModel(undefined, TODAY)).toBeNull();
    expect(buildPlanViewModel({ plan_name: "Piano" }, TODAY)).toBeNull();
    expect(buildPlanViewModel("non un oggetto", TODAY)).toBeNull();
  });

  it("gestisce settimane vuote senza lanciare eccezioni", () => {
    const vm = buildPlanViewModel({ plan_name: "Piano vuoto", weeks: [] }, TODAY);
    expect(vm).not.toBeNull();
    expect(vm?.weeks).toEqual([]);
  });

  it("gestisce una settimana senza sessioni", () => {
    const vm = buildPlanViewModel({ weeks: [{ week_number: 1, week_label: "Sett. 1", sessions: [] }] }, TODAY);
    const week = vm?.weeks[0];
    expect(week?.startDate).toBeNull();
    expect(week?.endDate).toBeNull();
    expect(week?.isCurrent).toBe(false);
    expect(week?.summary.sessionCount).toBe(0);
  });

  it("gestisce step mancanti in una sessione strutturata", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          {
            week_number: 1,
            sessions: [{ date: "2026-10-05", discipline: "running", is_structured: true }],
          },
        ],
      },
      TODAY,
    );
    const session = vm?.weeks[0].sessions[0];
    expect(session?.segments).toEqual([]);
    expect(session?.stepsText).toEqual([]);
    expect(session?.totalDurationSec).toBeNull();
  });

  it("gestisce durate null assegnando un peso minimo senza NaN", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          {
            week_number: 1,
            sessions: [
              {
                date: "2026-10-05",
                is_structured: true,
                steps: [
                  { kind: "warmup", duration_sec: null, distance_m: null, zone: "Z1" },
                  { kind: "block", duration_sec: 600, zone: "Z3" },
                ],
              },
            ],
          },
        ],
      },
      TODAY,
    );
    const segments = vm?.weeks[0].sessions[0].segments ?? [];
    expect(segments).toHaveLength(2);
    expect(segments.every((s) => Number.isFinite(s.widthPercent))).toBe(true);
    expect(segments[0].durationSec).toBeNull();
    // peso minimo (1) per lo step senza durata/distanza, su un totale di 601 → piccola ma non nulla
    expect(segments[0].widthPercent).toBeGreaterThan(0);
    expect(segments[1].widthPercent).toBeGreaterThan(segments[0].widthPercent);
  });

  it("espande i blocchi repeat in segmenti alternati e testo leggibile", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          {
            week_number: 1,
            sessions: [
              {
                date: "2026-10-05",
                is_structured: true,
                steps: [
                  {
                    kind: "repeat",
                    repetitions: 6,
                    work: { duration_sec: 180, zone: "Z4" },
                    recovery: { duration_sec: 120, zone: "Z1" },
                  },
                ],
              },
            ],
          },
        ],
      },
      TODAY,
    );
    const session = vm?.weeks[0].sessions[0];
    expect(session?.segments).toHaveLength(12);
    expect(session?.segments[0].kind).toBe("work");
    expect(session?.segments[1].kind).toBe("recovery");
    expect(session?.stepsText).toEqual(["6 × (3' Z4 / 2' Z1)"]);
  });

  it("ignora date non valide o mancanti senza crashare, escludendole dal range settimanale", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          {
            week_number: 1,
            sessions: [
              { date: "non-una-data", discipline: "running" },
              { date: undefined, discipline: "cycling" },
              { date: "2026-10-06", discipline: "running" },
            ],
          },
        ],
      },
      TODAY,
    );
    const week = vm?.weeks[0];
    expect(week?.startDate).toBe("2026-10-06");
    expect(week?.endDate).toBe("2026-10-06");
    expect(week?.sessions[0].date).toBeNull();
    expect(week?.sessions[1].date).toBeNull();
  });

  it("marca isCurrent solo quando todayISO cade nel range della settimana", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          { week_number: 1, sessions: [{ date: "2026-09-20" }, { date: "2026-09-26" }] },
          { week_number: 2, sessions: [{ date: "2026-09-29" }, { date: "2026-10-05" }] },
        ],
      },
      TODAY,
    );
    expect(vm?.weeks[0].isCurrent).toBe(false);
    expect(vm?.weeks[1].isCurrent).toBe(true);
  });
});

describe("defaultOpenWeekIndex", () => {
  it("sceglie la settimana corrente se presente", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          { week_number: 1, sessions: [{ date: "2026-09-20" }, { date: "2026-09-26" }] },
          { week_number: 2, sessions: [{ date: "2026-09-29" }, { date: "2026-10-05" }] },
        ],
      },
      TODAY,
    )!;
    expect(defaultOpenWeekIndex(vm, TODAY)).toBe(1);
  });

  it("sceglie la settimana futura piu' vicina se nessuna e' corrente", () => {
    const vm = buildPlanViewModel(
      {
        weeks: [
          { week_number: 1, sessions: [{ date: "2026-09-01" }, { date: "2026-09-07" }] },
          { week_number: 2, sessions: [{ date: "2026-11-01" }, { date: "2026-11-07" }] },
        ],
      },
      TODAY,
    )!;
    expect(defaultOpenWeekIndex(vm, TODAY)).toBe(1);
  });

  it("restituisce null se non ci sono settimane con date valide", () => {
    const vm = buildPlanViewModel({ weeks: [{ week_number: 1, sessions: [] }] }, TODAY)!;
    expect(defaultOpenWeekIndex(vm, TODAY)).toBeNull();
  });
});

describe("zoneColorVar", () => {
  it("mappa una zona numerica sulla variabile CSS corrispondente", () => {
    expect(zoneColorVar("Z4")).toBe("var(--zone-4)");
    expect(zoneColorVar("zona 2")).toBe("var(--zone-2)");
  });

  it("limita l'intervallo a 1-7 e usa il fallback per stringhe non interpretabili", () => {
    expect(zoneColorVar("Z9")).toBe("var(--zone-7)");
    expect(zoneColorVar("recupero")).toBe("var(--zone-unknown)");
    expect(zoneColorVar(null)).toBe("var(--zone-unknown)");
    expect(zoneColorVar(undefined)).toBe("var(--zone-unknown)");
  });
});
