// Cambio del sistema di zone con un piano in corso (decisione del coach, ADR 0029): le sedute da
// svolgere della disciplina, da oggi compreso, tornano «Da verificare», perche' le loro zone vanno
// adattate a mano al nuovo sistema (la Z3 di 3 zone non e' la Z3 di 7).
import { zoneCountOf, type ZoneCount } from "@shared/workouts/zones.ts";

export type ZoneChangeDiscipline = "running" | "cycling";

export interface ZoneChange {
  discipline: ZoneChangeDiscipline;
  from: ZoneCount;
  to: ZoneCount;
}

interface ThresholdsLike {
  physiological_thresholds?: { running?: { zone_system?: string | null } | null; cycling?: { zone_system?: string | null } | null } | null;
}

const NAME: Record<ZoneChangeDiscipline, string> = { running: "corsa", cycling: "bici" };

/** Discipline il cui sistema di zone cambia fra il profilo salvato e quello da salvare. */
export function zoneChanges(saved: ThresholdsLike | null | undefined, next: ThresholdsLike | null | undefined): ZoneChange[] {
  const out: ZoneChange[] = [];
  for (const discipline of ["running", "cycling"] as ZoneChangeDiscipline[]) {
    const from = zoneCountOf(saved?.physiological_thresholds?.[discipline]?.zone_system);
    const to = zoneCountOf(next?.physiological_thresholds?.[discipline]?.zone_system);
    if (from !== to) out.push({ discipline, from, to });
  }
  return out;
}

/** Motivo salvato sulle sedute da ricontrollare. */
export function zoneChangeReason(c: ZoneChange, date: string): string {
  const [y, m, d] = date.split("-");
  return `Il sistema di zone della ${NAME[c.discipline]} è passato da ${c.from} a ${c.to} zone il ${d}/${m}/${y}: adatta le zone della seduta.`;
}

/** Avviso per la conferma: quante sedute tornano da verificare, per disciplina. Vuoto se nessuna. */
export function zoneChangeWarning(affected: { change: ZoneChange; count: number }[]): string {
  const parts = affected.filter((a) => a.count > 0).map((a) =>
    `${a.count === 1 ? "la seduta" : `le ${a.count} sedute`} di ${NAME[a.change.discipline]} (da ${a.change.from} a ${a.change.to} zone)`
  );
  if (!parts.length) return "";
  const total = affected.reduce((s, a) => s + a.count, 0);
  return `Se procedi, ${parts.join(" e ")} da oggi in poi ${total === 1 ? "torna" : "tornano"} «Da verificare»: dovrai cambiarne a mano le zone per il nuovo sistema.`;
}
