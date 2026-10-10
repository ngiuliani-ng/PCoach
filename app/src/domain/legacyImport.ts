// Import dei piani salvati nel profilo (training_plan, schema 1.4.0) nelle tabelle delle
// sedute. Funzione pura: nessun accesso al database, testata sui casi reali dei piani esistenti.
// Le sedute importate sono "approvate" (il coach le aveva gia' confermate); quelle con
// struttura non riconoscibile ricevono needs_review, che ne blocca l'invio a Intervals.icu
// finche' il coach non le sistema. Se giorno e data non coincidono vale il giorno indicato.
import { addDaysISO, dayKey, isISODate, weekStartISO } from "@shared/workouts/calendar.ts";
import type { WorkoutStructure } from "@shared/workouts/structure.ts";
import { defaultTargetMetric, isDiscipline, validateWorkout } from "@shared/workouts/structure.ts";
import { alignToDay, dayName, isDayKey } from "./availability";
import type { NewWorkout } from "./workoutDraft";
import { disciplineFallbackTitle, readStructure, readZone, singleBlockStructure } from "./workoutDraft";

export interface WeekMeta {
  week_start: string;
  label: string;
  is_deload: boolean;
}

export interface LegacyImport {
  planName: string;
  startDate: string;
  endDate: string;
  weeksMeta: WeekMeta[];
  workouts: NewWorkout[];
  /** Sedute scartate perche' prive di data o disciplina valide. */
  skipped: number;
}

type Raw = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function legacyPlanToImport(plan: unknown, hasFtp: boolean): LegacyImport | null {
  if (!plan || typeof plan !== "object") return null;
  const p = plan as Raw;
  const weeks = Array.isArray(p.weeks) ? (p.weeks as Raw[]) : [];
  const workouts: NewWorkout[] = [];
  const weeksMeta: WeekMeta[] = [];
  const slotsByDate: Record<string, number> = {};
  let skipped = 0;

  weeks.forEach((week, wi) => {
    const sessions = Array.isArray(week?.sessions) ? (week.sessions as Raw[]) : [];
    const dates: string[] = [];
    for (const s of sessions) {
      const rawDate = s?.date;
      const discipline = s?.discipline;
      if (!isISODate(rawDate) || !isDiscipline(discipline)) {
        skipped++;
        continue;
      }
      let date: string = rawDate;
      const notes: string[] = [];
      // Se giorno e data non coincidono vale il giorno: era cio' che il coach vedeva e approvava,
      // ed e' coerente con la disponibilita' dell'atleta; la data la calcolava Claude, sbagliando.
      const day = s.day;
      if (isDayKey(day) && day !== dayKey(date)) {
        const aligned = alignToDay(date, day);
        notes.push(`Il piano indicava ${dayName(aligned)} ma la data era del ${dayName(date)}: spostata al ${dayName(aligned)} ${aligned}.`);
        date = aligned;
      }
      dates.push(date);

      let structure: WorkoutStructure | null = null;
      let durationMin: number | null = null;
      let objective = "";
      const zoneText = str(s.target_zone);
      if (discipline === "strength") {
        durationMin = typeof s.target_duration_min === "number" && s.target_duration_min > 0 ? s.target_duration_min : null;
        // In palestra la "zona" del piano era un obiettivo ("Forza massima", "Ipertrofia").
        objective = zoneText && !readZone(zoneText) ? zoneText : "";
      } else if (s.is_structured && Array.isArray(s.steps) && s.steps.length) {
        structure = readStructure(s.steps, zoneText);
      } else {
        structure = singleBlockStructure(s.target_duration_min, s.target_distance_km, zoneText);
      }

      const w: NewWorkout = {
        planned_date: date,
        discipline,
        title: str(s.session_type).trim() || disciplineFallbackTitle(discipline),
        objective,
        notes_for_athlete: str(s.notes),
        duration_min: durationMin,
        structure,
        primary_target: defaultTargetMetric(discipline, hasFtp),
        slot: slotsByDate[date] ?? 0,
        status: "approved",
        needs_review: null,
        legacy: s,
        change_note: notes.length ? notes.join(" ") : null
      };
      slotsByDate[date] = w.slot + 1;

      const errors = validateWorkout(w);
      if (Object.keys(errors).length) {
        const missingZone = Object.values(errors).some((e) => e === "Scegli una zona.");
        w.needs_review = missingZone && zoneText
          ? `Target «${zoneText}» non riconosciuto: scegli una zona per ogni step.`
          : Object.values(errors)[0];
      }
      workouts.push(w);
    }
    const sorted = [...dates].sort();
    const weekStart = sorted.length ? weekStartISO(sorted[0]) : null;
    if (weekStart) {
      weeksMeta.push({
        week_start: weekStart,
        label: str(week.week_label).trim() || `Settimana ${typeof week.week_number === "number" ? week.week_number : wi + 1}`,
        is_deload: !!week.is_deload
      });
    }
  });

  if (!workouts.length) return null;
  const allDates = workouts.map((w) => w.planned_date).sort();
  const startDate = isISODate(p.start_date) && p.start_date <= allDates[0] ? p.start_date : allDates[0];
  return {
    planName: str(p.plan_name).trim() || "Piano importato",
    startDate,
    endDate: addDaysISO(weekStartISO(allDates[allDates.length - 1]), 6),
    weeksMeta,
    workouts,
    skipped
  };
}
