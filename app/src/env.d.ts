// Costanti iniettate dalla build (vite.config.ts, ADR 0036): si leggono solo da src/version.ts.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;
/** Sezione del CHANGELOG della versione corrente. */
declare const __APP_RELEASE_SECTION__: string;
