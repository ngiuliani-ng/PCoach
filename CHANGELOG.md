# Changelog

**Quando leggerlo**: per sapere quando e perché è cambiato qualcosa, o per collegare un comportamento attuale alla fase/commit che lo ha introdotto.

Ordine: più recente in cima. Formato per voce: **data — cambiamento — motivazione — docs aggiornati**.

---

**2026-10-10 — Sedute come entità proprie: tab Piano, rigenerazione controllata, «Sincronizza settimana» con Intervals.icu**
Le sedute escono dalla scheda e passano in tabelle proprie (`0004_workouts.sql`: `training_plans`, `plan_generations`, `workouts`, `workout_sync`, `workout_events`). Ogni seduta ha identità stabile, revisione gestita da trigger, cronologia e tre stati separati: approvazione, esecuzione, sincronizzazione.
- **Tab Piano** con vista per settimana e storico filtrabile, pannello della seduta con editor della struttura (step e ripetute) e anteprima del testo per Intervals.icu, approvazione singola o della settimana, annullamento e ripristino.
- **«Genera il piano» / «Ripianifica da…»**: data di ripartenza, sedute da mantenere, motivo; proposta di Claude salvata, anteprima delle differenze, applicazione in un'unica transazione (`apply_plan_generation`).
- **Nuovo formato di risposta di Claude** (solo zone, struttura v2) e nuovi segnaposto del prompt. Il template salvato è stato sostituito dal nuovo predefinito, con backup di quello precedente.
- **«Sincronizza settimana»** con la nuova Edge Function `intervals-sync`: anteprima delle operazioni, conflitti, rimozioni preselezionate ma da confermare, esito per riga, nuovi tentativi, riconciliazione contro i doppioni.
- **Metrica dei target**: bici in potenza con FTP, altrimenti FC; corsa e nuoto in zone di passo.
- **Import** una tantum e idempotente dei piani salvati nella scheda, con sedute approvate e `needs_review` sui target non riconoscibili. `weekly-feedback` legge le tabelle.
- **Correzioni e codice condiviso**: corretto `addDaysISO`, che in UTC+2 restituiva il giorno sbagliato. Codice condiviso tra app ed Edge Function in `supabase/functions/_shared/workouts/` (alias `@shared`). Migrazione baseline versionata di `athletes` e `app_settings`.
- **Rimossi** `PlanView`, `PlanWeekBlock`, `PlanSessionCard`, `planViewModel` e `usePlanWeeksUi`.
- **Test**: 69 test unitari in 8 file e Playwright con 3 flussi end-to-end su desktop e mobile.

*Motivazione*: una nuova generazione sostituiva il piano senza storico; non si poteva ripianificare da una data mantenendo parte del lavoro; non esisteva sincronizzazione verso Intervals.icu e il formato delle sedute non era convertibile.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [modello-dati.md](docs/modello-dati.md), [backend.md](docs/backend.md) (anche: `athletes.id` è text, non uuid), [integrazioni.md](docs/integrazioni.md) (anche: trigger di sincronizzazione del carico corretti sul codice), [design-ui.md](docs/design-ui.md), [sicurezza.md](docs/sicurezza.md), [limiti-roadmap.md](docs/limiti-roadmap.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0017](docs/decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md), [decisioni/0007](docs/decisioni/0007-plan-view-model-puro.md) (superata).

**2026-10-10 — Revisione della UI: dati al centro, scheda in Panoramica e Profilo, conformità alle regole di design**
Scheda atleta divisa in due viste (Panoramica: carico e forma, piano, feedback; Profilo: dati dell'atleta, esporta/elimina) con header sticky e "Salva" sempre raggiungibile; soglie unificate con selettore di disciplina. Sezioni piatte e un solo livello di card; sessioni del piano come righe dentro la settimana. Nuovi token per scala tipografica, spaziature e raggi; Z3 e Z7 ricolorate, badge "Scarico" neutro, grafico del carico ridisegnato (CTL in inchiostro, ATL sottile, TSB come banda attorno allo zero, allenamenti in una striscia separata, asse y e valori attuali in legenda). Sidebar con nome per intero (va a capo invece di essere troncato) e, sotto, discipline e ultimo TSB al posto dell'ID; righe come `<button>`. Stato vuoto senza pulsanti che ripetono i comandi della sidebar o dell'hamburger mobile. Toast di errore persistenti con chiusura e regioni live (`showToast(msg, "error")`, `showResultToast`); `ConfirmDialog` modale con focus trap, Esc ed etichetta di conferma obbligatoria. Icone Lucide per le discipline, etichette associate ai campi, date in italiano (`formatDate`), periodizzazione e discipline come testo leggibile, testi di stati vuoti ed errori riscritti. Corretti l'header sticky (non funzionava per l'`overflow` di `.main`) e la sovrapposizione dell'hamburger su mobile.
*Motivazione*: la scheda seguiva l'ordine dei dati invece del lavoro del coach; diverse regole di `design-ui.md` (tastiera, toast, dialog, icone) non erano rispettate dal codice; il linguaggio visivo era generico e i colori avevano più significati.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0016](docs/decisioni/0016-direzione-visiva-dati-al-centro.md).

**2026-10-10 — Cleanup README e formattazione markdown in sicurezza.md**
Eliminato `app/README.md` in quanto ridondante rispetto a `docs/sviluppo-deploy.md` e `CLAUDE.md`; rimossa la riga "Quando leggerlo" da `README.md` per mantenere la descrizione del progetto pulita e diretta. Aggiunta riga vuota prima dell'elenco puntato nella sezione chiamanti Edge Function in `docs/sicurezza.md`.
*Motivazione*: rimozione di ridondanze nel rispetto della regola 2 di CLAUDE.md ("una sola casa per ogni informazione") e corretto parsing della sintassi Markdown.
*Docs aggiornati*: [README.md](README.md), [sicurezza.md](docs/sicurezza.md), rimosso `app/README.md`.

**2026-10-10 — Allineamento dei docs al codice e alle regole di CLAUDE.md**
`design-ui.md`: tabella dei token riallineata a `tokens.css` (rimossi `--bg-elevated`, `--success`, `--chart-tsb`, `--radius`, `--shadow`, `--font-size-*`, `--space-*`, che non esistono; aggiunti `--surface`, `--surface-2`, `--accent-contrast`, `--focus`, `--danger-bg`, `--warning-bg`, `--zone-*`, `--font-ui`, `--font-mono`); tipografia e spaziatura descritte come valori in px diretti; rimosso il componente "Card", che non esiste (il pannello è la classe `section.block`); corretti il layout della sidebar e l'intervallo delle zone (Z1-Z7). `sicurezza.md`: eliminato il riferimento allo stato precedente. ADR 0009: corretto il link al changelog. Rimossa `docs/athlete_profile.schema.json`, copia identica e non referenziata di `app/src/schema/athlete_profile.schema.json`, che resta l'unica fonte di verità. `README.md` e `app/README.md`: aggiunta la riga "Quando leggerlo"; il secondo non contiene più il testo del template Vite ma rimanda ai docs.
*Motivazione*: regole 1, 2, 5 e 7 di CLAUDE.md (solo stato attuale nei file di stato, una sola casa per ogni informazione, riga "Quando leggerlo", correzione sul posto dei docs disallineati dal codice).
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sicurezza.md](docs/sicurezza.md), [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md), [README.md](README.md), [app/README.md](app/README.md).

**2026-10-10 — Barra del titolo PWA desktop senza nome, con linea di separazione (Window Controls Overlay)**
Aggiunto `display_override: ['window-controls-overlay']` al manifest (`vite.config.ts`). Nuovo token `--titlebar-h` (`tokens.css`) e fascia di trascinamento `body::before` con sfondo `--surface` e linea inferiore di 1px in `--border` (`base.css`), attiva solo in quella modalità. Altezze `100vh`, sidebar sticky, drawer/toggle/backdrop mobile e schermate di caricamento/login (`App.vue`, `LoginView.vue`) adeguate a `--titlebar-h`.
*Motivazione*: togliere il nome dell'app dalla barra di trascinamento di Windows e distinguere la barra dal resto dell'interfaccia con una linea dello stesso colore dei bordi della sidebar.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0015](docs/decisioni/0015-barra-titolo-window-controls-overlay.md).

**2026-10-09 — Icona app e favicon ritagliate in formato circolare**
Rigenerate `app/public/favicon.png` (32×32 px), `app/public/icons/icon-192.png` (192×192 px) e `app/public/icons/icon-512.png` (512×512 px) con maschera circolare e trasparenza negli angoli (anti-aliasing tramite supersampling).
*Motivazione*: richiesta del coach di visualizzare l'immagine dell'app e la favicon in forma circolare.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Nuova icona app (favicon + icone PWA)**
Icona dell'app sostituita con un'immagine gradiente multicolore personalizzata. Generati `app/public/favicon.png` (32×32 px, usato come favicon del browser), `app/public/icons/icon-192.png` e `app/public/icons/icon-512.png` (icone PWA per manifest e `apple-touch-icon`). `index.html` aggiornato: `<link rel="icon">` punta ora a `favicon.png` (PNG) invece di `favicon.svg`.
*Motivazione*: allineare l'identità visiva dell'app all'immagine scelta dal coach.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Bump GitHub Actions a runtime Node.js 24**
`actions/checkout` v4→v7, `actions/setup-node` v4→v7, `actions/upload-pages-artifact` v3→v5, `actions/deploy-pages` v4→v5 in `.github/workflows/deploy.yml`.
*Motivazione*: GitHub ha deprecato il runtime Node.js 20 su tutte le runner; le action precedenti venivano forzate su Node.js 24 generando warning nei log di CI/CD.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Allineamento colore barra PWA allo sfondo sidebar**
`theme-color` in `index.html` impostato tramite due meta tag con `prefers-color-scheme: dark/light` (`#1C2025` / `#FFFFFF`), corrispondenti al token `--surface` (sfondo della sidebar) per garantire continuità visiva verticale. `theme_color` e `background_color` nel manifest (`vite.config.ts`) impostati su `#1C2025`.
*Motivazione*: creare continuità cromatica diretta tra la barra del titolo della finestra PWA e la testata della sidebar sia in modalità scura che in modalità chiara.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0013](docs/decisioni/0013-pwa-manifest-only.md), [decisioni/0014](docs/decisioni/0014-colore-finestra-pwa-continuita-sidebar.md).

**2026-10-09 — Iconografia unificata (lucide-vue-next) e rimozione tooltip nativi**
Introdotta la libreria `lucide-vue-next` come dipendenza in `app/package.json` per uniformare l'iconografia dell'interfaccia ed eliminare glifi Unicode, emoji e SVG inline: icone `Settings` e `LogOut` nella sidebar (`AthleteSidebar.vue`), `X` per l'eliminazione atleta e `UserPlus` per la card nuovo atleta, `Menu` per il toggle mobile (`App.vue`), `User` per il placeholder, `Eye`/`EyeOff` per il toggle password (`PasswordField.vue`) e `ChevronDown`/`ChevronRight` per le sezioni comprimibili del piano (`PlanWeekBlock.vue`). Contestualmente rimossi gli attributi `title`/`:title` a favore di `aria-label` su tutti i controlli a icona e sull'icona disciplina in `PlanSessionCard.vue` per evitare la comparsa di tooltip nativi del browser al passaggio del puntatore preservando la piena accessibilità; armonizzata la label del bottone impostazioni in `AthleteSidebar.vue` e corretto un riferimento documentale obsoleto in `SettingsPanel.vue`.
*Motivazione*: garantire coerenza stilistica e dimensionale nell'iconografia UI, prevenire tooltip nativi ridondanti sui comandi visuali e mantenere piena accessibilità assistiva.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md).

**2026-10-09 — PWA installabile (manifest + icone)**
Aggiunta configurazione `vite-plugin-pwa` in `vite.config.ts` con manifest Web App (nome, colori brand, `start_url`/`scope` relativi alla base `/PCoach/`, icone 192×512 px). Nessun Service Worker attivo (`selfDestroying: true`): l'app è installabile dalla schermata home ma non funziona offline. Aggiunti meta tag PWA in `index.html` (`theme-color`, `apple-mobile-web-app-*`, `apple-touch-icon`). Icone PNG generate in `app/public/icons/`.
*Motivazione*: rendere l'app aggiungibile alla schermata home su mobile/desktop senza barra del browser, con il minimo di complessità (nessuna strategia offline da gestire).
*Docs aggiornati*: [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0013](docs/decisioni/0013-pwa-manifest-only.md).

**2026-10-08 — Hardening: `is_coach()` in schema `private`**
`public.is_coach()` spostata in `private.is_coach()` (migrazione `0002_move_is_coach_private.sql`) con `search_path` vuoto e `EXECUTE` revocato a `public`/`anon` e concesso solo ad `authenticated`; le policy RLS la referenziano per OID e non sono state riscritte. Nessuna modifica al codice dell'app. Verificato: `GET /rest/v1/rpc/is_coach` risponde `404` (`PGRST202`). Documentato come passo di setup opzionale l'attivazione di *Prevent use of leaked passwords*.
*Motivazione*: il Security Advisor di Supabase segnalava la funzione `SECURITY DEFINER` come eseguibile da `anon` e `authenticated` tramite `/rest/v1/rpc/is_coach`.
*Docs aggiornati*: [backend.md](docs/backend.md), [sicurezza.md](docs/sicurezza.md), [architettura.md](docs/architettura.md), [decisioni/0012](docs/decisioni/0012-is-coach-schema-privato.md).

**2026-10-04 — Fix generazione piano senza esito a schermo**
`max_tokens` calcolato in proporzione al numero di settimane richieste (invece di un valore fisso), propagazione di `stop_reason` da `claude-proxy` fino al client per distinguere un piano troncato per limite di token da un JSON malformato, toast di errore reso persistente invece di sparire prima che il coach potesse leggerlo. Verificato end-to-end sul backend reale. Indagato e documentato `ERR_ABORTED` su richieste HEAD come artefatto innocuo di Chromium.
*Motivazione*: piani lunghi (molte settimane) venivano troncati silenziosamente dal limite di token fisso, risultando in un JSON incompleto senza un messaggio d'errore comprensibile per il coach.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [limiti-roadmap.md](docs/limiti-roadmap.md).

**2026-10-04 — Rifinitura sidebar: IconButton e drawer mobile via composable**
Footer della sidebar compattato con due `IconButton` al posto dei bottoni testuali "Impostazioni"/"Esci"; logica del drawer mobile (backdrop cliccabile, transizioni, Esc, scroll-lock, gestione del focus) estratta nel composable `useMobileSidebar.ts`; bottone hamburger nascosto mentre il drawer è aperto.
*Motivazione*: liberare spazio verticale nel footer della sidebar e separare la responsabilità del comportamento del drawer da `App.vue`.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md), [decisioni/0011](docs/decisioni/0011-rifinitura-sidebar-iconbutton.md) (voce aggiunta retroattivamente).

**2026-10-04 — Fase 9 (hardening): weekly-feedback**
`weekly-feedback` verifica ora il chiamante (richiede la service-role key come bearer), legge la service-role key da Supabase Vault, sincronizza CTL/ATL prima del confronto piano/reale, usa una finestra di attivazione resiliente (resto della giornata, non match esatto sull'ora).
*Motivazione*: senza verifica del chiamante, il gateway JWT di Supabase avrebbe accettato anche la anon key pubblica per invocare la function; un match esatto sull'ora avrebbe fatto slittare il feedback di una settimana intera in caso di invocazione cron mancata.
*Docs aggiornati*: [backend.md](docs/backend.md), [sicurezza.md](docs/sicurezza.md), [decisioni/0008](docs/decisioni/0008-feedback-automatico-schedulato.md).

**2026-10-04 — Fase 9: autenticazione coach e RLS**
Supabase Auth a singolo utente coach (store/UI di login), poi RLS su `athletes`/`app_settings` con `public.is_coach()` + hardening di `claude-proxy` (richiede JWT di sessione, non la sola anon key), poi aggiornamento della documentazione.
*Motivazione*: l'app era raggiungibile tramite link senza alcuna autenticazione né restrizione a livello database.
*Docs aggiornati*: [sicurezza.md](docs/sicurezza.md), [backend.md](docs/backend.md), [decisioni/0010](docs/decisioni/0010-autenticazione-coach-rls-reale.md) (supera [0001](docs/decisioni/0001-niente-auth-rls-iniziale.md)).

**2026-10-04 — Fix: `training_status` obbligatorio nello schema**
`training_status` reso `required` in `athlete_profile.schema.json`, risolvendo un fallimento della build CI. Stato dei test in quel momento: 33 test.
*Motivazione*: una scheda senza stato di allenamento non ha senso ai fini della generazione del piano; il campo opzionale permetteva stati incompleti non gestiti a valle.
*Docs aggiornati*: [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md).

**2026-10-04 — Fase 8: rifinitura mobile**
Sidebar atleti come drawer sotto i 720px, grafico del carico con interazione touch/mouse unificata e `aspect-ratio` fisso, cleanup e aggiornamento documentazione.
*Motivazione*: il layout desktop semplicemente ristretto non era utilizzabile comodamente su schermi piccoli.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md).

**2026-10-04 — Fase 7: feedback settimanale automatico**
Introdotta la Edge Function schedulata `weekly-feedback` (confronto piano/reale via Claude, invio email opzionale via Resend) e il relativo pannello impostazioni, sostituendo il precedente flusso manuale lato client.
*Motivazione*: il coach doveva ricordarsi di generare manualmente il confronto ogni settimana; automatizzarlo rimuove questo carico.
*Docs aggiornati*: [backend.md](docs/backend.md), [integrazioni.md](docs/integrazioni.md), [decisioni/0008](docs/decisioni/0008-feedback-automatico-schedulato.md), [decisioni/0002](docs/decisioni/0002-email-feedback-via-resend.md).

**2026-10-04 — Fase 6: vista grafica del piano di allenamento**
`PlanView.vue`/`PlanWeekBlock.vue`/`PlanSessionCard.vue` per visualizzare il piano generato, con `planViewModel` come funzione pura testabile per la trasformazione dei dati.
*Motivazione*: il piano generato da Claude (JSON) necessitava di una vista leggibile invece di essere mostrato come testo grezzo.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [decisioni/0007](docs/decisioni/0007-plan-view-model-puro.md).

**2026-10-03 — Fase 5: modello dati e form**
Split identità (`nome`/`cognome`, schema_version 1.4.0) con migrazione euristica, sezione integrazioni (chiave Intervals.icu per-atleta), discipline multiple, grafico carico (CTL/ATL/TSB).
*Motivazione*: il modello dati iniziale non distingueva nome/cognome né supportava più discipline per atleta in modo strutturato.
*Docs aggiornati*: [modello-dati.md](docs/modello-dati.md), [decisioni/0006](docs/decisioni/0006-modello-dati-identita-e-sync-automatica.md).

**2026-10-03 — Fase 3: sincronizzazione sicura e concorrenza ottimistica**
Update ad `athletes` condizionato a `updated_at` noto; `syncLoadMetrics` come scrittura mirata esclusa dal tracciamento delle modifiche non salvate del form.
*Motivazione*: un salvataggio concorrente (due schermi, o sync in background) rischiava di sovrascrivere silenziosamente dati validi.
*Docs aggiornati*: [backend.md](docs/backend.md), [decisioni/0005](docs/decisioni/0005-concorrenza-ottimistica-sync-mirata.md).

**2026-10-03 — Fase 2: sidebar definitiva e stato di connessione**
Sidebar atleti nella forma attuale (lista + card "Nuovo atleta"), indicatore di stato connessione Supabase.
*Motivazione*: dare un riscontro visivo immediato sulla disponibilità del backend.
*Docs aggiornati*: [architettura.md](docs/architettura.md).

**2026-10-03 — Fase 1: migrazione a Vue 3 + Vite + Pinia**
Riscrittura dell'app (precedentemente un singolo `index.html`) in componenti Vue 3 con Composition API, build Vite, stato in Pinia — a parità funzionale con la versione precedente.
*Motivazione*: il file unico `index.html` non era più gestibile man mano che le funzionalità crescevano.
*Docs aggiornati*: [architettura.md](docs/architettura.md).
