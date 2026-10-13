# 0036 — Versione dell'app e rilasci dai tag

**Quando leggerlo**: prima di preparare un rilascio, di cambiare la versione, il CHANGELOG o il workflow di pubblicazione, o di mostrare la versione nell'interfaccia.

**Stato**: attiva.

## Contesto

Fino al 13 ottobre 2026 la versione non si poteva identificare:
- `app/package.json` diceva `0.0.0` e non c'erano tag;
- ogni push su `main` andava in produzione;
- le Edge Function, pubblicate a mano, avevano solo il contatore di Supabase;
- il CHANGELOG era per date.

Analisi nel [report 07 dell'audit](../audit/2026-10-ux-ui-completo/07-versionamento-e-changelog.md). Decisione del coach (D-08): partire da 1.0.0 e pubblicare solo quando si crea un tag di versione; la versione in fondo alla barra laterale e in una sezione Informazioni.

## Decisione

1. **Fonte unica**: `app/package.json` › `version`. `vite.config.ts` la legge e passa all'app `__APP_VERSION__`, il commit (`__APP_COMMIT__`: `GITHUB_SHA` in CI, `git rev-parse` in locale, «-modificato» con modifiche non committate) e la data di build. `src/version.ts` le espone; nessun componente scrive la versione a mano. La build pubblica `version.json`.
2. **Server**: `supabase/functions/_shared/version.ts` ha la stessa versione (un test di Vitest lo verifica). Le Edge Function la restituiscono nell'intestazione `x-pcoach-version`, esposta via CORS. L'app la legge con una richiesta `OPTIONS`, senza dati né chiavi.
3. **Interfaccia**:
   - «Versione X.Y.Z» in piccolo in fondo alla barra laterale, link a Impostazioni › Informazioni;
   - in Informazioni: versione, build e data, versione del server (con «diversa dall'app» se non coincide), «Copia per una segnalazione». Le novità della versione non compaiono nell'app: il coach non vuole che l'utente le legga (decisione del 13 ottobre 2026, dopo la 1.0.0, che le mostrava); il CHANGELOG resta la loro unica casa;
   - l'ambiente compare solo fuori dalla produzione.
4. **SemVer adattato**:
   - MAJOR se serve un'azione o si rompe la compatibilità di dati o flussi;
   - MINOR per una funzione nuova o cambiata che il coach vede;
   - PATCH per correzioni e testi.
   
   `PLAN_PROMPT_VERSION`, `ANALYSIS_VERSION` e `schema_version` restano versioni di contratti, indipendenti.
5. **CHANGELOG**:
   - `## [Unreleased]` in cima, poi `## [X.Y.Z] — AAAA-MM-GG`;
   - categorie Aggiunto, Modificato, Corretto, Rimosso, Sicurezza, Interno;
   - le voci precedenti restano sotto «Prima del versionamento»;
   - un test verifica che esistano `Unreleased` e la sezione datata della versione corrente.
6. **Rilascio**: il workflow esegue i test a ogni push su `main` e pubblica solo dai tag `v*`. Prima controlla che il tag corrisponda a `package.json`; dopo il deploy verifica che `version.json` in linea sia la versione del tag. Procedura in [sviluppo-deploy.md § Rilascio](../sviluppo-deploy.md#rilascio-di-una-versione).

Confermate dal coach: data della 1.0.0 al 13 ottobre 2026, versione del server letta da `weekly-feedback`. Scelta dell'assistente, da confermare: `-modificato` come suffisso.

## Conseguenze

- L'ambiente `github-pages` di GitHub deve permettere il deploy dai tag `v*`. Se ammette solo `main`, va aggiunta la regola in Settings › Environments: non verificabile da qui.
- Le Edge Function vanno ripubblicate per avere l'intestazione; finché non lo sono, Informazioni mostra «non disponibile».
