// Generazione e rigenerazione controllata di un piano (funzioni pure).
// 1. parseProposal: legge la risposta di Claude, scarta cio' che e' fuori dall'intervallo
//    richiesto e ricava giorno e metrica in modo deterministico.
// 2. regenerationDiff: confronta le sedute esistenti dalla data di ripartenza con la proposta
//    (mantenute, sostituite, aggiunte, tolte), cioe' cio' che il coach vede prima di applicare.
// 3. buildApplyPayload: l'input della funzione SQL apply_plan_generation, che applica tutto
//    in un'unica transazione.
import { addDaysISO, isISODate, weekStartISO } from "@shared/workouts/calendar.ts";
import type { Discipline } from "@shared/workouts/structure.ts";
import { defaultTargetMetric, isDiscipline } from "@shared/workouts/structure.ts";
import type { WeekMeta } from "./legacyImport";
import type { NewWorkout } from "./workoutDraft";
import { disciplineFallbackTitle, readStructure } from "./workoutDraft";

export interface ExistingForRegen {
  id: string;
  planned_date: string;
  slot: number;
  status: "draft" | "approved" | "cancelled" | "superseded";
  revision: number;
  discipline: Discipline;
  title: string;
  locked: boolean;
  completed_at: string | null;
}

export interface Proposal {
  planName: string;
  weeksMeta: WeekMeta[];
  workouts: NewWorkout[];
  warnings: string[];
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseProposal(
  raw: unknown,
  opts: { fromDate: string; weeks: number; hasFtp: boolean }
): Proposal | { error: string } {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Raw).workouts)) {
    return { error: "La risposta di Claude non contiene l'elenco «workouts»." };
  }
  const r = raw as Raw;
  const toDate = addDaysISO(opts.fromDate, opts.weeks * 7 - 1);
  const warnings: string[] = [];
  const workouts: NewWorkout[] = [];
  let outOfRange = 0;
  let invalid = 0;
  for (const item of r.workouts as Raw[]) {
    if (!item || typeof item !== "object") { invalid++; continue; }
    const date = item.date;
    const discipline = item.discipline;
    if (!isISODate(date) || !isDiscipline(discipline)) { invalid++; continue; }
    if (date < opts.fromDate || date > toDate) { outOfRange++; continue; }
    const strength = discipline === "strength";
    workouts.push({
      planned_date: date,
      discipline,
      title: str(item.title).trim() || disciplineFallbackTitle(discipline),
      objective: str(item.objective).trim(),
      notes_for_athlete: str(item.notes).trim(),
      duration_min: strength && typeof item.duration_min === "number" && item.duration_min > 0 ? Math.round(item.duration_min) : null,
      structure: strength ? null : readStructure(item.steps, null),
      primary_target: defaultTargetMetric(discipline, opts.hasFtp),
      slot: 0,
      status: "draft",
      needs_review: null,
      legacy: null,
      change_note: null
    });
  }
  if (outOfRange) warnings.push(`${outOfRange} sedute fuori dal periodo richiesto sono state scartate.`);
  if (invalid) warnings.push(`${invalid} sedute senza data o disciplina valide sono state scartate.`);
  workouts.sort((a, b) => a.planned_date.localeCompare(b.planned_date));

  const weeksMeta: WeekMeta[] = Array.isArray(r.weeks)
    ? (r.weeks as Raw[])
        .filter((w) => w && isISODate(w.week_start))
        .map((w) => ({ week_start: weekStartISO(w.week_start as string), label: str(w.label).trim(), is_deload: !!w.is_deload }))
    : [];
  return { planName: str(r.plan_name).trim() || "Nuovo piano", weeksMeta, workouts, warnings };
}

export function isActiveStatus(status: string): boolean {
  return status === "draft" || status === "approved";
}

/** Sedute coinvolte da una rigenerazione: attive, dalla data di ripartenza in poi. */
export function regenerationCandidates<T extends ExistingForRegen>(all: T[], fromDate: string): T[] {
  return all
    .filter((w) => isActiveStatus(w.status) && w.planned_date >= fromDate)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.slot - b.slot);
}

/** Una seduta svolta resta sempre; una bloccata dal coach resta salvo scelta diversa. */
export function isForcedKeep(w: ExistingForRegen): boolean {
  return !!w.completed_at;
}
export function defaultKeep(w: ExistingForRegen): boolean {
  return !!w.completed_at || w.locked;
}

export type DiffItem =
  | { kind: "keep"; old: ExistingForRegen }
  | { kind: "replace"; old: ExistingForRegen; neu: NewWorkout }
  | { kind: "add"; neu: NewWorkout }
  | { kind: "remove"; old: ExistingForRegen };

export interface DiffDay {
  date: string;
  items: DiffItem[];
}

export function regenerationDiff(candidates: ExistingForRegen[], keepIds: Set<string>, proposal: NewWorkout[]): DiffDay[] {
  const byDate = new Map<string, DiffItem[]>();
  const push = (date: string, item: DiffItem) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(item);
  };
  const kept = (w: ExistingForRegen) => keepIds.has(w.id) || isForcedKeep(w);
  candidates.filter(kept).forEach((w) => push(w.planned_date, { kind: "keep", old: w }));

  const replaceable = candidates.filter((w) => !kept(w));
  const paired = new Set<string>();
  for (const neu of proposal) {
    const sameDay = replaceable.filter((w) => w.planned_date === neu.planned_date && !paired.has(w.id));
    const old = sameDay.find((w) => w.discipline === neu.discipline) ?? sameDay[0];
    if (old) {
      paired.add(old.id);
      push(neu.planned_date, { kind: "replace", old, neu });
    } else {
      push(neu.planned_date, { kind: "add", neu });
    }
  }
  replaceable.filter((w) => !paired.has(w.id)).forEach((w) => push(w.planned_date, { kind: "remove", old: w }));
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, items }));
}

export function diffCounts(days: DiffDay[]): Record<DiffItem["kind"], number> {
  const counts = { keep: 0, replace: 0, add: 0, remove: 0 };
  days.forEach((d) => d.items.forEach((i) => counts[i.kind]++));
  return counts;
}

export interface ApplyPayload {
  generation_id: string;
  athlete_id: string;
  from_date: string;
  plan: { name: string; start_date: string; end_date: string; weeks_meta: WeekMeta[] };
  keep: { id: string; revision: number }[];
  supersede: { id: string; revision: number }[];
  insert: (Omit<NewWorkout, "legacy" | "status"> & { replaces: string | null })[];
}

export function buildApplyPayload(args: {
  generationId: string;
  athleteId: string;
  fromDate: string;
  weeks: number;
  proposal: Proposal;
  diff: DiffDay[];
}): ApplyPayload {
  const keep: ApplyPayload["keep"] = [];
  const supersede: ApplyPayload["supersede"] = [];
  const insert: ApplyPayload["insert"] = [];
  const usedSlots = new Map<string, Set<number>>();
  const used = (date: string) => {
    if (!usedSlots.has(date)) usedSlots.set(date, new Set());
    return usedSlots.get(date)!;
  };
  // Prima le mantenute, che conservano il loro slot; poi le nuove occupano il primo libero.
  for (const day of args.diff) {
    for (const item of day.items) {
      if (item.kind === "keep") {
        keep.push({ id: item.old.id, revision: item.old.revision });
        used(day.date).add(item.old.slot);
      } else if (item.kind === "replace" || item.kind === "remove") {
        supersede.push({ id: item.old.id, revision: item.old.revision });
      }
    }
  }
  for (const day of args.diff) {
    for (const item of day.items) {
      if (item.kind !== "replace" && item.kind !== "add") continue;
      const slots = used(day.date);
      let slot = 0;
      while (slots.has(slot)) slot++;
      slots.add(slot);
      const { legacy: _legacy, status: _status, ...rest } = item.neu;
      insert.push({ ...rest, slot, replaces: item.kind === "replace" ? item.old.id : null });
    }
  }
  const endDate = addDaysISO(args.fromDate, args.weeks * 7 - 1);
  return {
    generation_id: args.generationId,
    athlete_id: args.athleteId,
    from_date: args.fromDate,
    plan: { name: args.proposal.planName, start_date: args.fromDate, end_date: endDate, weeks_meta: args.proposal.weeksMeta },
    keep,
    supersede,
    insert
  };
}
