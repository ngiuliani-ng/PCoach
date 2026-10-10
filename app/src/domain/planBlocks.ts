// Generazione a blocchi (funzioni pure). Una chiamata a claude-proxy non puo' superare il limite
// di durata delle Edge Function (150 s), e Claude impiega circa 25 s per settimana di sedute:
// un piano lungo viene quindi chiesto in blocchi consecutivi di poche settimane, poi riunito
// in un'unica proposta, letta e mostrata come se fosse arrivata da una sola risposta.
import { addDaysISO } from "@shared/workouts/calendar.ts";

/** Settimane per chiamata: circa 75 s di generazione, con margine sul limite di 150 s. */
export const WEEKS_PER_BLOCK = 3;

export interface PlanBlock {
  index: number;
  count: number;
  fromDate: string;
  weeks: number;
  /** Prima settimana del blocco nel piano complessivo, da 1. */
  firstWeek: number;
}

/** Divide il periodo in blocchi consecutivi di lunghezza il piu' possibile uguale. */
export function planBlocks(fromDate: string, weeks: number, size = WEEKS_PER_BLOCK): PlanBlock[] {
  const count = Math.max(1, Math.ceil(weeks / size));
  const base = Math.floor(weeks / count);
  const extra = weeks % count;
  const blocks: PlanBlock[] = [];
  let offset = 0;
  for (let index = 0; index < count; index++) {
    const w = base + (index < extra ? 1 : 0);
    blocks.push({ index, count, fromDate: addDaysISO(fromDate, offset * 7), weeks: w, firstWeek: offset + 1 });
    offset += w;
  }
  return blocks;
}

type Raw = Record<string, unknown>;

/** Riunisce le risposte dei blocchi: nome del piano dal primo, settimane e sedute in sequenza. */
export function mergeBlockResponses(raws: unknown[]): Raw {
  const objects = raws.filter((r): r is Raw => !!r && typeof r === "object");
  const list = (key: string) => objects.flatMap((r) => (Array.isArray(r[key]) ? (r[key] as unknown[]) : []));
  return {
    plan_name: objects.map((r) => r.plan_name).find((n) => typeof n === "string" && n.trim()) ?? "",
    weeks: list("weeks"),
    workouts: list("workouts")
  };
}
