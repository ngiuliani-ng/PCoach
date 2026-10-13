# Sviluppo e deploy

**Quando leggerlo**: per configurare l'ambiente locale, eseguire test/build, o capire come viene pubblicata l'app.

## Setup locale

```
cd app
npm install
cp .env.example .env   # se presente; altrimenti creare .env con le due variabili sotto
npm run dev
```

**Variabili d'ambiente** (`app/.env`, non tracciato in git):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Senza queste due variabili l'app parte comunque (`configured` risulta `false` nei services), ma login e ogni funzionalità che tocca Supabase restano disabilitati.

## Rigenerare i tipi dallo schema

```
npm run gen:types
```

Rigenera `app/src/schema/types.generated.ts` da `app/src/schema/athlete_profile.schema.json` (`json-schema-to-typescript`). Il file generato non va mai modificato a mano (lo dichiara anche il banner comment generato automaticamente). Vedi [modello-dati.md](modello-dati.md) e [architettura.md](architettura.md#come-aggiungere-un-campo-al-modello-dati).

## Test

```
npm run test
```

Esegue Vitest (`vitest run`) sui file `src/**/*.test.ts`: 222 test in 26 file al 13 ottobre 2026. Il dettaglio per file lo dà `npx vitest run --reporter=verbose`. Coprono:
- domini puri delle sedute e del feedback, compresi i moduli condivisi con le Edge Function: calendario, struttura, conversione per Intervals.icu, zone e soglie, pipeline del feedback;
- prompt della generazione e testi d'aiuto: cosa va a Claude, voci della guida ed etichette citate;
- glossario degli stati, conteggi del feedback in una frase, riepiloghi delle sezioni del Profilo, pagina «Da fare», controllo periodico su Intervals.icu e unione del carico;
- durata, pausa e persistenza dei toast (`useToast.test.ts`);
- contrasti dei token di colore nei due temi;
- coerenza della versione fra `package.json`, `_shared/version.ts` e `CHANGELOG.md` (`version.test.ts`).

Il conteggio descrive solo lo stato corrente; l'evoluzione nel tempo è nel [CHANGELOG.md](../CHANGELOG.md).

### Test end-to-end

```
npx playwright install chromium   # una volta sola
npm run test:e2e
```

Playwright (`playwright.config.ts`, cartella `app/e2e/`) avvia Vite sulla porta 5181 con un URL Supabase fittizio. `e2e/mockBackend.ts` intercetta tutte le richieste:
- una PostgREST minima in memoria;
- la funzione SQL `apply_plan_generation`;
- le Edge Function `claude-proxy`, `intervals-sync` e `weekly-feedback` (approvazione);
- le letture dirette di Intervals.icu.

Nessuna chiamata raggiunge Supabase, Claude o Intervals.icu. La data è fissata al 10 ottobre 2026 con `page.clock`.

Settantadue flussi, ognuno su un progetto desktop e uno mobile (144 test al 13 ottobre 2026), in sette file:
- `plan.spec.ts`: modifica e approvazione di una seduta, rigenerazione con anteprima delle differenze, dialoghi di generazione riaperti da un ricaricamento o da un link (sedute in caricamento, lette, non lette, proposta in sospeso), conferma prima di scartare una proposta o una risposta incollata, settimane fuori dai limiti, «Sincronizza settimana» con un errore parziale e il nuovo tentativo;
- `feedback.spec.ts`: revisione e approvazione di un feedback settimanale;
- `navigation.spec.ts`: bozza di un nuovo atleta con «Resta», «indietro», uscita confermata o salvata, nome mancante in una scheda nuova, messaggi e focus del login, modifiche non salvate al cambio di atleta e all'uscita dalle Impostazioni, salvataggi falliti, vista e seduta nell'URL, errore di rete al salvataggio di una seduta;
- `coherence.spec.ts`: doppio clic su «Genera la proposta», schema di carico non riconosciuto, generazione con modifiche non salvate, email mancante con l'invio attivo, fuso non valido, valutazione in preparazione, sistema di zone nell'editor;
- `zones.spec.ts`: zone e soglie diverse da Intervals.icu, modelli di zone in Impostazioni, sedute da verificare dalla tab Anomalie, modello di zone non valido al salvataggio, azione bloccata dalle modifiche non salvate come errore che resta;
- `feedback-ui.spec.ts`: verifica UI/UX del feedback, cioè testo salvato in automatico e dopo un ricaricamento, salvataggio non riuscito e uscita dalla scheda, «Rigenera» con le correzioni, campo che cresce, casella del reinvio, settimane chiuse, «Prepara il feedback», nota «senza email» prima di «Approva» con il link al Profilo;
- `ux.spec.ts`: audit UI/UX completo, cioè tab a 320 px, seduta aperta dalla Panoramica, stati delle righe e selettore dello storico, sezioni e guida, ripristini, pagina «Da fare» e contatore, controllo su Intervals.icu nella home, versione in Informazioni, toast informativo fermo con puntatore o focus e chiudibile da tastiera.

`e2e/helpers.ts` ha `openSection`, che apre una sezione comprimibile se è chiusa.

Gli esiti finiscono in `test-results/`, non tracciata.

## Edge Function

Le funzioni in `supabase/functions/` si pubblicano sul progetto Supabase con il CLI, senza installarlo nel repository:

```
npx supabase login        # una volta, da un terminale normale: apre il browser
npx supabase functions deploy <funzione> [<funzione> ...] --project-ref lykalqkkxckzsphlnhij --use-api
```

`--use-api` impacchetta la funzione sul server, senza Docker, caricando dal disco tutti i moduli importati. Il login va fatto fuori da Claude Code: il comando `!` non ha un terminale interattivo, e un token passato con `--token` resterebbe scritto nella conversazione. Lo strumento di deploy del MCP Supabase richiede invece il contenuto di ogni file nella richiesta: va bene solo per funzioni piccole. `intervals-sync` importa i moduli di `functions/_shared/workouts/` (zone comprese) e di `functions/_shared/feedback/` (abbinamento delle sedute svolte); `weekly-feedback` quelli di `functions/_shared/feedback/` e `functions/_shared/workouts/` (calendario e struttura) e il mittente email. Vanno pubblicati insieme alla funzione, con nomi relativi (`../_shared/...`). Il CLI Deno non è installato: i tipi delle funzioni si controllano con `tsc` usando un'interfaccia minima per `Deno`, e la logica vive nei moduli condivisi, testati con Vitest.

L'ordine conta: prima le migrazioni (`supabase/migrations/`, in ordine numerico), poi le funzioni che leggono le nuove tabelle o colonne, infine l'app. `claude-proxy` e `weekly-feedback` importano anche `functions/_shared/claude/models.ts`. `athlete-checks` importa `functions/_shared/workouts/` (calendario, soglie, zone, `athleteChecks.ts`, `loadMetrics.ts`). Tutte e quattro importano `functions/_shared/version.ts` e restituiscono la versione nell'intestazione `x-pcoach-version` (vedi [§ Rilascio](#rilascio-di-una-versione)).

## Build

```
npm run build
```

Esegue `vue-tsc -b` (type-check, build incrementale) seguito da `vite build`. Un errore di tipo blocca la build.

## Pubblicazione su GitHub Pages

Workflow `.github/workflows/deploy.yml` ([decisioni/0036](decisioni/0036-versione-dell-app-e-rilasci.md)):
- un push su `main` esegue test e build, **senza pubblicare**;
- un tag `vX.Y.Z` pubblica quella versione; si può anche avviare a mano (`workflow_dispatch`) su un tag.

Actions usate: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` (tutte su runtime Node.js 24).

1. Checkout, setup Node 22, `npm ci` (dentro `app/`, con cache su `package-lock.json`).
2. `npm run test`: un test fallito blocca la pubblicazione, compresa la coerenza della versione.
3. Solo sui tag: il tag deve essere `v` + la versione di `app/package.json`.
4. `npm run build`, con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` presi dai **repository secrets** GitHub (non dal file `.env` locale).
5. Solo sui tag: upload di `app/dist` come artifact Pages, deploy e controllo che `version.json` in linea sia la versione del tag.

L'ambiente `github-pages` deve ammettere il deploy dai tag `v*` (Settings › Environments › github-pages › Deployment branches and tags).

## Versione

Una sola fonte: `app/package.json` › `version`. `vite.config.ts` la passa all'app (`__APP_VERSION__`) con:
- il commit della build (`__APP_COMMIT__`: `GITHUB_SHA` in CI, `git rev-parse --short HEAD` in locale, con `-modificato` se ci sono modifiche non committate, `locale` senza git);
- la data di build.

`src/version.ts` le espone all'interfaccia (Impostazioni › Informazioni). La build scrive `dist/version.json` (`{ version, commit, builtAt }`). `supabase/functions/_shared/version.ts` ripete la versione per le Edge Function, e un test verifica che coincida.

## Rilascio di una versione

| Momento | Cosa si fa | Versione |
|---|---|---|
| Sviluppo | Ogni commit con codice e documenti di stato; la voce va in `## [Unreleased]` del CHANGELOG, nella categoria giusta | invariata |
| Preparazione (dopo la conferma del coach) | `Unreleased` diventa `## [X.Y.Z] — AAAA-MM-GG`; la versione si aggiorna in `app/package.json`, `package-lock.json` e `supabase/functions/_shared/version.ts`; si lascia `## [Unreleased]` vuoto in cima | incrementata, con SemVer come in [CHANGELOG.md](../CHANGELOG.md) |
| Pubblicazione | Nell'ordine: migrazioni, Edge Function (con `_shared/version.ts`), merge su `main`, tag `vX.Y.Z` e push del tag | — |
| Verifica | Il workflow controlla `version.json`; in Impostazioni › Informazioni la versione del server coincide con quella dell'app | — |

La versione non si incrementa a ogni commit: solo alla preparazione di un rilascio.

`vite.config.ts` imposta `base: '/PCoach/'`, necessario perché l'app è servita da un sotto-percorso (`https://<utente>.github.io/PCoach/`) e non dalla radice del dominio.

## PWA (Progressive Web App)

L'app è installabile su dispositivi mobili e desktop tramite un Web App Manifest generato da `vite-plugin-pwa`. Non è attivo alcun Service Worker (configurazione `selfDestroying: true`): l'app **non funziona offline**, ma può essere aggiunta alla schermata home e si apre senza barra del browser (`display: standalone`). L'orientamento non è bloccato: su telefono e tablet l'app ruota ([decisioni/0026](decisioni/0026-touch-e-orientamento-pwa.md)). Su desktop Chromium (Edge/Chrome) il manifest dichiara anche `display_override: ['window-controls-overlay']`: la barra del titolo di sistema non mostra nome e icona e la fascia superiore è disegnata dall'app (vedi [design-ui.md § Barra di trascinamento](design-ui.md#barra-di-trascinamento-pwa-desktop)); negli altri browser vale `standalone`. Motivazione della scelta in [decisioni/0013](decisioni/0013-pwa-manifest-only.md), [decisioni/0014](decisioni/0014-colore-finestra-pwa-continuita-sidebar.md) e [decisioni/0015](decisioni/0015-barra-titolo-window-controls-overlay.md).

Una PWA già installata può non aggiornarsi subito dopo una modifica al manifest: se la barra del titolo non cambia, va disinstallata e reinstallata. Per provare il manifest senza deploy: `npm run build && npm run preview` (dentro `app/`) e installare la PWA da `http://localhost:4173/PCoach/`.

**Componenti della PWA:**
- `vite.config.ts`: configurazione `VitePWA()` — manifest, icone, `display_override`, `start_url: /PCoach/`, `scope: /PCoach/`.
- `app/public/favicon.png`: icona circolare 32×32 px usata come favicon nel browser (`<link rel="icon">` in `index.html`).
- `app/public/icons/icon-192.png` e `icon-512.png`: icone PNG circolari 192×192 e 512×512 px (con angoli trasparenti), necessarie per manifest e `apple-touch-icon`.
- `index.html`: meta tag `theme-color` (due tag con `prefers-color-scheme: dark/light`, valori `#1C2025`/`#FFFFFF`), `apple-mobile-web-app-capable`, `apple-touch-icon`.

**Per aggiungere offline support in futuro:** rimuovere `selfDestroying: true` da `vite.config.ts` e configurare una strategia Workbox (es. `NetworkFirst` per le API Supabase, `CacheFirst` per gli asset statici).
