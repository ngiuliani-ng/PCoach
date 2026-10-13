// Versione dell'app (ADR 0036). Una sola fonte: package.json, letto da vite.config.ts; commit e data
// vengono dalla build. Nessun componente scrive la versione a mano: la leggono tutti da qui.
export const APP_VERSION = __APP_VERSION__;
/** Commit della build: 7 caratteri, «-modificato» se costruita con modifiche non committate, «locale» senza git. */
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;
/** Etichetta d'ambiente: solo fuori dalla produzione. */
export const APP_ENVIRONMENT = import.meta.env.DEV ? "Sviluppo locale" : APP_COMMIT.endsWith("-modificato") || APP_COMMIT === "locale" ? "Build locale" : null;

export interface ReleaseNote {
  heading: string;
  items: string[];
}

/**
 * Note di rilascio di una versione dal CHANGELOG: le voci della sezione `## [X.Y.Z]` raggruppate per
 * categoria, senza «Interno» (ADR 0036). Il markdown si riduce a testo: niente HTML da interpretare.
 */
export function releaseNotes(version: string, text = __APP_RELEASE_SECTION__): ReleaseNote[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start < 0) return [];
  const notes: ReleaseNote[] = [];
  let current: ReleaseNote | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (line.startsWith("### ")) {
      const heading = line.slice(4).trim();
      current = heading === "Interno" ? null : { heading, items: [] };
      if (current) notes.push(current);
    } else if (current && line.startsWith("- ")) {
      current.items.push(line.slice(2).replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim());
    }
  }
  return notes.filter((n) => n.items.length);
}

/** Riga da incollare in una segnalazione: versione, build, browser. */
export function reportLine(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent, serverVersion: string | null = null): string {
  const date = APP_BUILD_DATE.slice(0, 10).split("-").reverse().join("/");
  const server = serverVersion ? `, server ${serverVersion}` : "";
  return `PCoach ${APP_VERSION} (build ${APP_COMMIT} del ${date}${server}), ${userAgent}`;
}
