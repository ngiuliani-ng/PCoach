// Test dei moduli puri condivisi con le Edge Function (supabase/functions/_shared/workouts).
import { describe, expect, it } from "vitest";
import { addDaysISO, dayKey, isISODate, todayISO, weekStartISO } from "@shared/workouts/calendar.ts";
import type { WorkoutContent } from "@shared/workouts/structure.ts";
import { defaultTargetMetric, flattenSteps, parseZones, validateWorkout, workoutTotals } from "@shared/workouts/structure.ts";
import { buildIntervalsEvent, intervalsWorkoutText } from "@shared/workouts/intervals.ts";
import type { SyncRow, SyncableWorkout } from "@shared/workouts/sync.ts";
import { classifySyncOp, isRunnable, localSyncState } from "@shared/workouts/sync.ts";

describe("calendario", () => {
  it("somma i giorni senza spostamenti di fuso (bug di addDaysISO in UTC+2)", () => {
    expect(addDaysISO("2026-10-10", 1)).toBe("2026-10-11");
    expect(addDaysISO("2026-10-10", -30)).toBe("2026-09-10");
    expect(addDaysISO("2026-10-24", 2)).toBe("2026-10-26"); // cambio dell'ora
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("calcola il lunedi' della settimana e il giorno", () => {
    expect(weekStartISO("2026-10-10")).toBe("2026-10-05");
    expect(weekStartISO("2026-10-12")).toBe("2026-10-12");
    expect(weekStartISO("2026-10-18")).toBe("2026-10-12");
    expect(dayKey("2026-10-10")).toBe("sabato");
  });

  it("restituisce la data di oggi nel fuso indicato", () => {
    const now = new Date("2026-10-09T22:30:00Z"); // 00:30 del 10 ottobre a Roma
    expect(todayISO("Europe/Rome", now)).toBe("2026-10-10");
    expect(todayISO("UTC", now)).toBe("2026-10-09");
  });

  it("riconosce solo date reali", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2026-10-10")).toBe(true);
    expect(isISODate("10/10/2026")).toBe(false);
  });
});

describe("zone e struttura", () => {
  it("legge le zone dai testi dei piani esistenti", () => {
    expect(parseZones("Z2")).toEqual({ zone: 2 });
    expect(parseZones("Z2-Z3 (56-85% FTP)")).toEqual({ zone: 2, zone_to: 3 });
    expect(parseZones("Z1-Z2 (< 70% FTP)")).toEqual({ zone: 1, zone_to: 2 });
    expect(parseZones("Z2-Z3-Z4")).toEqual({ zone: 2, zone_to: 4 });
    expect(parseZones("Z2 (5:30-6:00/km)")).toEqual({ zone: 2 });
    expect(parseZones("Alta")).toBeNull();
    expect(parseZones("Forza massima")).toBeNull();
  });

  it("sceglie la metrica dei target per disciplina", () => {
    expect(defaultTargetMetric("cycling", true)).toBe("power");
    expect(defaultTargetMetric("cycling", false)).toBe("hr");
    expect(defaultTargetMetric("running", true)).toBe("pace");
    expect(defaultTargetMetric("swimming", false)).toBe("pace");
    expect(defaultTargetMetric("strength", true)).toBe("none");
  });

  it("calcola i totali ed espande le ripetute", () => {
    const w = bike();
    expect(flattenSteps(w.structure)).toHaveLength(1 + 4 * 2 + 1);
    const t = workoutTotals(w);
    expect(t.seconds).toBe(15 * 60 + 4 * (8 + 3) * 60 + 10 * 60);
    expect(t.allTime).toBe(true);
    expect(t.estimated).toBe(false);
  });

  it("segnala step senza durata o zona e ripetute vuote", () => {
    const w = bike();
    w.structure!.steps[0] = { kind: "step", role: "warmup", duration: { type: "time", seconds: 0 }, target: { zone: 1 } };
    w.structure!.steps.push({ kind: "repeat", count: 2, steps: [] });
    w.title = " ";
    const errors = validateWorkout(w);
    expect(errors.title).toBeDefined();
    expect(errors["step:0"]).toMatch(/durata/);
    expect(errors["step:3"]).toMatch(/non contiene step/);
  });

  it("richiede la durata per la palestra, non la struttura", () => {
    expect(validateWorkout(strength(45))).toEqual({});
    expect(validateWorkout(strength(null)).duration_min).toBeDefined();
  });
});

describe("conversione per Intervals.icu", () => {
  it("bici in potenza: zone senza suffisso, ripetuta con intestazione e righe vuote", () => {
    expect(intervalsWorkoutText(bike())).toBe(
      ["- Riscaldamento 15m Z1-Z2", "", "Serie principale 4x", "- 8m Z4", "- 3m Z1", "", "- Defaticamento 10m Z1"].join("\n")
    );
  });

  it("corsa a zone di passo con distanze", () => {
    const run: WorkoutContent = {
      ...bike(),
      discipline: "running",
      primary_target: "pace",
      structure: {
        version: 2,
        steps: [
          { kind: "step", role: "warmup", duration: { type: "time", seconds: 600 }, target: { zone: 2 } },
          { kind: "repeat", count: 3, steps: [
            { kind: "step", role: "work", duration: { type: "distance", meters: 2000 }, target: { zone: 3 }, cue: "Ritmo gara" },
            { kind: "step", role: "recovery", duration: { type: "time", seconds: 90 }, target: { zone: 1 } }
          ] },
          { kind: "step", role: "cooldown", duration: { type: "distance", meters: 400 }, target: { zone: 1 } }
        ]
      }
    };
    expect(intervalsWorkoutText(run)).toBe(
      ["- Riscaldamento 10m Z2 Pace", "", "Serie 3x", "- Ritmo gara 2km Z3 Pace", "- 1m30s Z1 Pace", "", "- Defaticamento 400mtr Z1 Pace"].join("\n")
    );
    const event = buildIntervalsEvent("abc", run);
    expect(event.type).toBe("Run");
    expect(event.target).toBe("PACE");
    expect(event.moving_time).toBeUndefined(); // step misti: la durata la calcola Intervals.icu
    expect(event.distance).toBeUndefined();
  });

  it("bici in FC usa il suffisso HR", () => {
    expect(intervalsWorkoutText({ ...bike(), primary_target: "hr" })).toContain("- 8m Z4 HR");
  });

  it("costruisce l'evento con data locale, nome, note e identificativo esterno", () => {
    const w = { ...bike(), notes_for_athlete: "Cadenza alta nelle ripetute." };
    const event = buildIntervalsEvent("8f1c", w);
    expect(event).toMatchObject({
      category: "WORKOUT",
      start_date_local: "2026-10-13T00:00:00",
      type: "Ride",
      name: "Soglia 4 × 8'",
      external_id: "pcoach:8f1c",
      moving_time: 69 * 60,
      target: "POWER"
    });
    expect(event.description.startsWith("Cadenza alta nelle ripetute.\n\n- Riscaldamento")).toBe(true);
  });

  it("palestra: solo note e durata, nessun target", () => {
    const event = buildIntervalsEvent("x", { ...strength(40), notes_for_athlete: "3 giri: squat 12." });
    expect(event).toMatchObject({ type: "WeightTraining", description: "3 giri: squat 12.", moving_time: 2400 });
    expect(event.target).toBeUndefined();
  });

  it("toglie a capo e trattini dalle indicazioni", () => {
    const w = bike();
    (w.structure!.steps[0] as { cue?: string }).cue = "- Sciolto\ne tranquillo";
    expect(intervalsWorkoutText(w).split("\n")[0]).toBe("- Sciolto e tranquillo 15m Z1-Z2");
  });
});

describe("classificazione della sincronizzazione", () => {
  const base = (over: Partial<SyncableWorkout> = {}): SyncableWorkout => ({
    ...bike(), id: "w1", status: "approved", revision: 1, completed_at: null, needs_review: null, ...over
  });
  const row = (over: Partial<SyncRow> = {}): SyncRow => ({
    workout_id: "w1", remote_event_id: 100, synced_revision: 1, synced_date: "2026-10-13", remote_updated: "t1",
    state: "synced", pending_delete: false, create_uncertain: false, last_error: null, last_warning: null, ...over
  });
  const remote = { events: [{ id: 100, updated: "t1" }], missingIds: [] };

  it("bozza: non si invia", () => {
    expect(classifySyncOp(base({ status: "draft" }), null, remote)?.kind).toBe("skip_draft");
  });
  it("approvata mai inviata: creazione", () => {
    expect(classifySyncOp(base(), null, remote)?.kind).toBe("create");
  });
  it("creazione con esito incerto dopo un timeout: segnalata per la riconciliazione", () => {
    expect(classifySyncOp(base(), row({ remote_event_id: null, state: "error", create_uncertain: true }), remote)).toMatchObject({ kind: "create", detail: "uncertain" });
  });
  it("invariata: nulla da fare", () => {
    expect(classifySyncOp(base(), row(), remote)?.kind).toBe("same");
  });
  it("modificata dopo l'invio o spostata: aggiornamento", () => {
    expect(classifySyncOp(base({ revision: 2 }), row(), remote)?.kind).toBe("update");
    expect(classifySyncOp(base({ planned_date: "2026-10-14" }), row(), remote)).toMatchObject({ kind: "update", detail: "moved" });
  });
  it("modificata su Intervals.icu: conflitto, mai sovrascritta senza scelta", () => {
    const op = classifySyncOp(base({ revision: 2 }), row(), { events: [{ id: 100, updated: "t2" }], missingIds: [] });
    expect(op?.kind).toBe("conflict");
  });
  it("evento sparito da Intervals.icu", () => {
    expect(classifySyncOp(base(), row(), { events: [], missingIds: [100] })?.kind).toBe("remote_missing");
  });
  it("annullata e ancora su Intervals.icu: rimozione preselezionata ma eseguibile solo se selezionata", () => {
    const op = classifySyncOp(base({ status: "cancelled" }), row({ pending_delete: true }), remote)!;
    expect(op.kind).toBe("delete");
    expect(isRunnable(op)).toBe(true);
    expect(isRunnable({ ...op, selected: false })).toBe(false);
  });
  it("svolta: non si tocca", () => {
    expect(classifySyncOp(base({ revision: 3, completed_at: "2026-10-13T08:00:00Z" }), row(), remote)?.kind).toBe("same");
  });
  it("struttura da verificare: bloccata", () => {
    expect(classifySyncOp(base({ needs_review: "Target non riconosciuto" }), null, remote)?.kind).toBe("blocked");
  });
  it("stato locale per i badge", () => {
    expect(localSyncState(base(), null)).toBe("none");
    expect(localSyncState(base(), row())).toBe("synced");
    expect(localSyncState(base({ revision: 2 }), row())).toBe("outdated");
    expect(localSyncState(base({ status: "cancelled" }), row({ pending_delete: true }))).toBe("pending_delete");
    expect(localSyncState(base({ status: "draft" }), null)).toBe("none");
  });
});

function bike(): WorkoutContent {
  return {
    planned_date: "2026-10-13",
    discipline: "cycling",
    title: "Soglia 4 × 8'",
    objective: "",
    notes_for_athlete: "",
    duration_min: null,
    primary_target: "power",
    structure: {
      version: 2,
      steps: [
        { kind: "step", role: "warmup", duration: { type: "time", seconds: 900 }, target: { zone: 1, zone_to: 2 } },
        { kind: "repeat", count: 4, label: "Serie principale", steps: [
          { kind: "step", role: "work", duration: { type: "time", seconds: 480 }, target: { zone: 4 } },
          { kind: "step", role: "recovery", duration: { type: "time", seconds: 180 }, target: { zone: 1 } }
        ] },
        { kind: "step", role: "cooldown", duration: { type: "time", seconds: 600 }, target: { zone: 1 } }
      ]
    }
  };
}

function strength(min: number | null): WorkoutContent {
  return { planned_date: "2026-10-16", discipline: "strength", title: "Forza", objective: "", notes_for_athlete: "", duration_min: min, primary_target: "none", structure: null };
}
