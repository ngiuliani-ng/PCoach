// Versione dell'app (ADR 0036). Una sola fonte: package.json, letto da vite.config.ts; commit e data
// vengono dalla build. Nessun componente scrive la versione a mano: la leggono tutti da qui.
export const APP_VERSION = __APP_VERSION__;
/** Commit della build: 7 caratteri, «-modificato» se costruita con modifiche non committate, «locale» senza git. */
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;
/** Etichetta d'ambiente: solo fuori dalla produzione. */
export const APP_ENVIRONMENT = import.meta.env.DEV ? "Sviluppo locale" : APP_COMMIT.endsWith("-modificato") || APP_COMMIT === "locale" ? "Build locale" : null;

