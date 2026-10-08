# Changelog

**Quando leggerlo**: per sapere quando e perché è cambiato qualcosa, o per collegare un comportamento attuale alla fase/commit che lo ha introdotto.

Ordine: più recente in cima. Formato per voce: **data — cambiamento — motivazione — docs aggiornati**.

---

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
