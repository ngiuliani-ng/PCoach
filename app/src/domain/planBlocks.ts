// Generazione a blocchi (funzioni pure). Una chiamata a claude-proxy non puo' superare il limite
// di durata delle Edge Function (150 s), e Claude scrive circa 85 token al secondo, fino a
// circa 3000 token per settimana per un atleta con 5-6 sedute:
// un piano lungo viene quindi chiesto in blocchi consecutivi di poche settimane, poi riunito
// in un'unica proposta, letta e mostrata come se fosse arrivata da una sola risposta.
import { addDaysISO } from "@shared/workouts/calendar.ts";

/** Settimane per chiamata: con TOKENS_PER_WEEK restano margini sia di tempo sia di token. */
export const WEEKS_PER_BLOCK = 2;
/** Token di risposta concessi per settimana (piu' 2000 per apertura e chiusura del JSON). */
export const TOKENS_PER_WEEK = 4000;

export function blockMaxTokens(weeks: number): number {
  return Math.min(64000, weeks * TOKENS_PER_WEEK + 2000);
}

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
