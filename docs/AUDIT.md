# AUDIT — docs/DOCUMENTAZIONE.md vs. codice reale

Verifica di ogni affermazione controllabile di `docs/DOCUMENTAZIONE.md` contro il codice in `app/src`, `supabase/`, `.github/workflows/`, `package.json` e lo schema JSON. Nessuna modifica è stata applicata al codice o alla documentazione: questo file elenca soltanto le discrepanze trovate.

Vincolo di sicurezza rispettato: non è stato letto né citato il contenuto di `PW.md`, `.env` o altri file con credenziali. Dove un controllo li avrebbe richiesti, è segnalato come **Non verificabile**.

Legenda gravità (solo per "Obsoleto o errato"): **alta** = porterebbe a un errore di sviluppo o di sicurezza, **media** = impreciso ma non fuorviante, **bassa** = refuso/nome/numero.

---

## 1. Panoramica

**Confermato**
- Formula TSB "`round((CTL − ATL) × 10) / 10`" (doc riga 40) — corrisponde esattamente a `app/src/services/intervals.ts:67` e `supabase/functions/weekly-feedback/index.ts:132` (`Math.round((w.ctl - w.atl) * 10) / 10`).
- "Scheda" = riga della tabella `athletes`, colonna `data`, JSON validato da `athlete_profile.schema.json` (doc riga 35) — struttura coerente con quanto verificato in §5/§6.
- App mono-coach, autenticazione a singolo utente senza separazione permessi (doc riga 29) — coerente con `app/src/stores/auth.ts` (store singolo, nessuna gestione ruoli/permessi).

**Non verificabile**
- "Perimetro: ... con un link non condiviso pubblicamente" (doc riga 26) — pratica d'uso, non verificabile da codice.
- Che piano/feedback generati da Claude siano effettivamente trattati come bozze da rivedere dal coach (doc riga 31) — comportamento d'uso, non verificabile da codice.

N.Giuliani: Il feedback non è verificabile oggi.

**Mancante / Obsoleto o errato**
- Nessuno specifico per questa sezione oltre a quanto già coperto da §2/§3 (vedi sotto).

---

## 2. Architettura

**Confermato**
- Stack (Vue 3 Composition API + `<script setup>`, Vite, Pinia, TypeScript), generazione tipi da schema via `json-schema-to-typescript`/`npm run gen:types`, backend Supabase + Edge Functions Deno, hosting GitHub Pages via Actions (doc righe 48-52).
- Struttura cartelle `app/src/{components,composables,constants.ts,stores,services,schema,styles}` e `supabase/functions/claude-proxy` (doc righe 56-70) — confermata, salvo l'omissione sotto.
- Invariante "nessuna chiamata di rete diretta nei file `.vue`" — confermato.
- Flusso di salvataggio e flusso di generazione piano (incluso fallback clipboard), albero sotto-componenti Plan*/MetricLogList/LoadMetricsChart/PasswordField, montaggio ToastHost+ConfirmDialog — tutti confermati.

**Obsoleto o errato**
- **Gravità media** — Il diagramma dei componenti (doc riga ~91) mostra `AthleteSidebar` con un semplice "bottone 'Esci'"; nel codice è ora un componente `IconButton` (`app/src/components/domain/AthleteSidebar.vue:109`), e il diagramma omette del tutto il pulsante gemello "Impostazioni" (`AthleteSidebar.vue:103`).
- **Gravità bassa/media** — §4 "Regole mobile" (doc riga 240) attribuisce la logica del drawer mobile ad `App.vue`; in realtà è stata estratta nel composable `app/src/composables/useMobileSidebar.ts` (`App.vue` si limita a richiamarlo).
- **Gravità media** — Il diagramma "Apertura scheda + sincronizzazione" (doc righe 107-113) lascia intendere che `athletes.openAthlete(id)` carichi dati da Supabase e inneschi la sincronizzazione Intervals.icu come un unico flusso lineare nello store. In realtà `openAthlete` (`app/src/stores/athletes.ts:89-100`) è sincrono e non fa alcuna chiamata di rete (legge da una mappa già in memoria); la sincronizzazione Intervals.icu all'apertura è innescata da un `watch` separato dentro `AthleteEditor.vue:96-100`, non dallo store.

**Mancante**
- **Gravità alta** — `app/src/components/ui/IconButton.vue` e `app/src/composables/useMobileSidebar.ts` non sono mai citati in nessun punto del documento (introdotti dal commit `b318e30`, vedi anche §10/§12).
- L'albero cartelle di §2 (doc riga 64) elenca solo `athletes.ts` e `settings.ts` sotto `stores/`, omettendo `auth.ts` (vedi dettaglio in §3).

**Non verificabile**
- Nessuna voce oltre a quanto coperto da §9 (deploy GitHub Actions, già confermato).

---

## 3. Convenzioni tecniche

**Confermato**
- Naming: identificatori in inglese, testo utente/commenti in italiano (doc riga 152) — verificato a campione su `stores/auth.ts`, `services/planViewModel.ts`, `constants.ts`.
- `docs/athlete_profile.schema.json` come sorgente di verità e `app/src/schema/athlete_profile.schema.json` come copia identica (doc riga 153) — hash SHA-256 identico tra i due file, nessuna divergenza.

N.Giuliani: `athlete_profile.schema.json` non è meglio tenerlo solo in `app/src/schema/athlete_profile.schema.json` e nella documentazione che creerai riferisciti a questo.

**Obsoleto o errato**
- **Gravità media** — Doc riga 148 ("un solo store per area di responsabilità (athletes, settings)") e l'elenco di §2 (riga 64) non menzionano `app/src/stores/auth.ts:8` (`useAuthStore`), un terzo store Pinia reale introdotto in Fase 9. La regola generale resta rispettata (`auth` è comunque a singola responsabilità), ma l'omissione è fattuale e presente in due punti del documento.

**Mancante**
- Nessuna voce ulteriore.

**Non verificabile**
- Nessuna voce.

---

## 4. Linee guida grafiche

**Confermato**
- Tutti i token colore della tabella (doc righe 185-193) corrispondono esattamente a `app/src/styles/tokens.css` (light, `@media prefers-color-scheme: dark` e `[data-theme="dark"]`).
- Font stack UI/mono (doc riga 199) — corrispondenza esatta con `tokens.css:28-29`.
- Entrambi i meccanismi dark mode (`@media prefers-color-scheme` + `[data-theme="dark"]`) presenti e confermati.
- Breakpoint 720px/480px (doc riga 238) — confermati come gli unici due breakpoint di layout nel codice (verificato con grep su tutto `app/src`).
- Chart: viewBox `0 0 600 180`, `aspect-ratio: 600/180`, nessun `preserveAspectRatio` (doc riga 243) — confermato in `LoadMetricsChart.vue`.
- `touch-action: pan-y` sul grafico — confermato.
- Reduced motion coperto nei due casi citati dalla doc, incluse verifiche su `IconButton.vue` e `useMobileSidebar.ts` (nessuna nuova animazione introdotta da questi file, "senza eccezioni" ancora valido).
- Touch target 44×44px (sidebar toggle, athlete-item) — confermato.
- `zoneColorVar` (clamp 1-7, fallback `--zone-unknown`) e `DISCIPLINE_ICONS`/`disciplineIcon` (fallback `"•"`) — nomi e comportamento confermati esattamente (doc righe 247-248).
- Barra segmentata: `widthPercent` proporzionale, `flex-grow` per segmento, `min-width: 6px` (doc riga 249) — confermato, con nota di fraseggio ambiguo (vedi sotto).

**Obsoleto o errato**
- **Gravità bassa** — Doc riga 199 descrive i titoli di sezione come "maiuscolo-soft" (soft-uppercase); nel codice `section.block h3 { text-transform: none; }` (`app/src/styles/base.css:264`) disabilita esplicitamente il maiuscolo. Contraddizione letterale, probabile residuo di una versione precedente del CSS.

**Mancante**
- Token `--chart-bar` (`tokens.css:17`) non elencato nella tabella colori di §4.
- Il blocco `@media (prefers-color-scheme: dark)` è in realtà condizionato da `:root:not([data-theme="light"])` (`tokens.css:32`), sfumatura non documentata.
- Non è un errore ma una nota di fraseggio: "flex-grow: widthPercent sul contenitore flex" (doc riga 249) potrebbe far pensare che `flex-grow` sia impostato sul contenitore stesso; in realtà è uno stile inline su ciascun segmento figlio (`PlanSessionCard.vue:53`).

**Non verificabile**
- Nessuna voce.

---

## 5. Modello dati

**Confermato**
- Intera sezione accurata: nessuna discrepanza trovata. Le 13 sezioni/array "required" di primo livello dello schema corrispondono esattamente tra doc e `athlete_profile.schema.json` (copie identiche, vedi anche §3).

---

## 6. Database e backend

**Obsoleto o errato**
- **Gravità alta** — Doc righe ~310-313 (e passaggio analogo per `app_settings`, righe 333-358) affermano che `drop policy if exists "..."` rende il blocco "ri-eseguibile senza errori su un database già migrato". Il file reale `supabase/migrations/0001_enable_rls.sql:17-21` (e 23-27 per `app_settings`) **non contiene alcuna istruzione `drop policy if exists`**: le policy sono create direttamente con `create policy`. Ri-eseguire questa migrazione su un database già migrato fallirebbe con errore `policy "..." already exists`, contraddicendo esplicitamente l'affermazione di idempotenza della doc.
- **Gravità media** — Il code-fence SQL di §6 presenta `create table if not exists athletes (...)` (e lo stesso per `app_settings`) insieme al blocco RLS/policy come se fosse un unico blocco eseguibile dalla migrazione. In realtà `0001_enable_rls.sql` **non contiene alcuna istruzione `create table`**: le tabelle preesistono (coerente con quanto la doc stessa dichiara altrove, riga ~400, sul fatto che lo schema "viveva solo come commento DDL"), ma la presentazione visiva può indurre un lettore a pensare che la migrazione crei le tabelle.
- **Gravità media** — Le quattro colonne `weekly_feedback_day/time/timezone/email_enabled` di `app_settings` (doc righe 333-358, aggiunte in Fase 7) sono assenti dalla migrazione `0001_enable_rls.sql` — coerente col fatto che precedono la migrazione stessa, ma il code-fence le presenta come co-locate con il contenuto della migrazione.
- **Gravità media** — Il passo 8 del flusso `weekly-feedback` (invio email) non menziona che `emailSender` viene costruito **solo se** sono presenti anche i secret `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` (`supabase/functions/weekly-feedback/index.ts:228-233`): con il toggle attivo ed email atleta presente ma secret mancanti, l'invio viene silenziosamente saltato (`"skipped: provider email non configurato"`, riga 338).

**Mancante**
- Il passo 5 di `syncLoadMetrics` (doc) non menziona che viene aggiornata anche la mappa in-memory `athletes[id]` (`app/src/stores/athletes.ts:220`), oltre a `rowVersions`/`currentBaseVersion`.
- Il confronto di autenticazione in `weekly-feedback` (`bearer !== serviceRoleKey`, righe 192-196) è una comparazione di stringhe semplice, non a tempo costante — la doc non fa affermazioni in merito, ma non lo segnala nemmeno come nota informativa.
- `max_tokens` in `weekly-feedback/index.ts:311` è fisso a `1024` (non configurabile come nel flusso `claude-proxy` lato client) — non menzionato.
- Un fallimento di invio email non porta lo `status` complessivo dell'atleta a `"error"` (resta `"ok"` con dettaglio `"email: error: ..."`, riga 351) — non specificato dalla doc.
- Le risposte `{ error: string }` di primo livello per errori di configurazione/fetch (righe 186, 195, 207/209, 222, 241) non sono menzionate nella sezione "Output" di §6.
- Il placeholder UUID in `public.is_coach()` nel file reale è `'INCOLLA-QUI-UUID-UTENTE-COACH'` (`0001_enable_rls.sql:14`), testualmente diverso dal generico `<uuid-utente-coach>` mostrato in doc — nessun problema di sicurezza, solo cosmetico.

**Non verificabile**
- Esistenza/configurazione reale del job `pg_cron` e se il secret Vault `weekly_feedback_service_role_key` è effettivamente popolato (setup §6, passi 4-5) — solo dashboard/DB.

N.Giuliani: esiste.

- Se l'utente coach sia stato effettivamente creato con "Auto Confirm User" e se altri provider di auth siano stati disattivati (si sovrappone a §8) — solo dashboard.

N.Giuliani: reato con "Auto Confirm User" e gli altri provider di auth sono stati disattivati.

- Se i secret `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` siano effettivamente impostati nell'ambiente di produzione via `supabase secrets set`.

N.Giuliani: sono stati impostati.

- Se il placeholder UUID in `is_coach()` sia stato sostituito con un UUID reale nel progetto Supabase effettivamente in uso (la copia in questo repo ha ancora il placeholder letterale).

N.Giuliani: il placeholder UUID in `is_coach()` è stato modificato con un UUID reale nel progetto Supabase.

---

## 7. Integrazioni

**Confermato**
- I due endpoint Intervals.icu, parametri `oldest`/`newest`, auth Basic `"API_KEY:" + apiKey` — confermato esattamente (`app/src/services/intervals.ts:32-35`).
- Chiamata diretta dal browser senza proxy (nessun wrapper Edge Function) — confermato.
- Logica di merge: entry `source === "manual"` mai sovrascritte, altrimenti `source: "intervals_icu_sync"`, formula TSB, `workouts_count` — confermato esattamente.
- `useIntervalsSync`: stato a livello di modulo (non per componente), debounce 1.5s, dedup `inFlightIds`, stato `valid/invalid/offline` — confermato.
- Esattamente 3 trigger lato client (inserimento/modifica chiave con debounce, apertura scheda atleta, avvio "Genera piano"), tutti in `AthleteEditor.vue`; 4° trigger esiste solo lato server (`weekly-feedback`, logica Deno duplicata) — confermato.
- Placeholder del prompt di generazione piano (`{{settimane}}`, `{{nome_atleta}}`, `{{contesto_atleta_json}}`, `{{formato_training_plan_json}}`) — confermato in `planPrompt.ts:46-51`.
- `buildAthleteContextForPrompt`: solo ultima soglia per sport, `training_status` filtrato a 30 giorni — confermato.
- Formula `max_tokens = Math.min(64000, settimane*1800+2000)` — confermato esattamente, costanti identiche (`AthleteEditor.vue:141`).
- Propagazione `stop_reason` per distinguere troncamento da JSON malformato — confermato (`claude.ts:35`, `AthleteEditor.vue:148-156`).
- Toast d'errore a 6s invece dei 2.2s di default — confermato.
- Fallback clipboard se manca la chiave Claude — confermato.
- Resend: interfaccia `EmailSender`, unica implementazione `ResendEmailSender`, endpoint `POST https://api.resend.com/emails`, secret solo come variabili d'ambiente Edge Function (mai in `app_settings`/client), corpo solo testo — tutto confermato.

**Obsoleto o errato**
- **Gravità media** — Doc riga ~496 afferma che il template `weekly_feedback_prompt_template` è interpolato "sia dal flusso manuale lato client sia dalla Edge Function schedulata". Il flusso manuale lato client **non esiste più**: è stato rimosso in Fase 7 (coerente col commento in `app/src/services/intervals.ts:3-4` e con la stessa doc in §10, riga 658: "rimossi dall'editor atleta il pulsante 'Confronta settimana con il piano'... lo storico diventa di sola lettura"). Nessun codice client costruisce/interpola questo template oggi — solo `supabase/functions/weekly-feedback/index.ts:67-78`. Vedi anche "Contraddizioni tra sezioni".

N.Giuliani: tutto vero.

**Mancante**
- `buildAthleteContextForPrompt` invia anche `detraining_period`, `lifestyle_factors`, `lifestyle_factors_note` non filtrati, oltre al log a 30 giorni (`planPrompt.ts:21-24`) — non esplicitamente enumerato dalla doc.
- Esiste un terzo toast d'errore a 6000ms per fallimenti generici del proxy/rete (`AthleteEditor.vue:144-147`, es. sessione scaduta o errori Claude non legati al parsing JSON), oltre ai "due esiti d'errore" descritti.
- Il controllo "upToDate" in `intervals.ts:24-29` evita del tutto la chiamata di rete (non solo la scrittura) quando non c'è nulla di nuovo — più forte di quanto suggerisca il fraseggio "evita scritture inutili" della doc (non un errore, solo una sfumatura).
- Il fraseggio "(vedi sopra)" dopo la discussione di `planPrompt.ts` (doc riga 488) potrebbe far pensare che anche il template di feedback settimanale sia costruito in quel file; in realtà è costruito solo lato Edge Function (Deno), come la doc stessa chiarisce correttamente altrove (§10, Fase 7).

**Non verificabile**
- Nessuna voce oltre a quanto già coperto da §6.

---

## 8. Sicurezza

**Confermato**
- Gestione delle variabili d'ambiente, gate di autenticazione, messaggio di errore generico al login, `claude.ts` usa il bearer della sessione utente (non la anon key), assenza di MFA/reset password — tutto confermato.

**Obsoleto o errato**
- **Gravità media** — La doc nomina ripetutamente il file delle credenziali "`DB_PW.md`" (righe 531, 533, 609), ma il file reale nella root del repo si chiama "`PW.md`". Solo "`PW.md`" compare in `.gitignore` (riga 13) ed è effettivamente ignorato/non tracciato. Nessuna esposizione di sicurezza attuale (il file reale è correttamente ignorato), ma il nome citato in doc è semplicemente sbagliato.

N.Giuliani: è un file mio personale che non dovrà mai essere letto.

**Non verificabile**
- Contenuto di `PW.md`/`.env` — non letto né citato, per vincolo esplicito del task.

---

## 9. Sviluppo e deploy

**Confermato**
- Sezione nel complesso accurata; nessuna discrepanza sostanziale trovata rispetto a `package.json`, script di build/test e workflow GitHub Actions.

**Obsoleto o errato**
- **Gravità bassa** — Il conteggio "33 test" nella voce "Fix post-Fase 8" di §12 è superato: il totale attuale è 38 blocchi di test su 5 file (`useConnectionStatus.test.ts`=4, `useDirtyState.test.ts`=9, `identitySplit.test.ts`=7, `planViewModel.test.ts`=13, `auth.test.ts`=5). Nota: la cifra "13 test Vitest" riferita specificamente a `planViewModel.test.ts` nella voce "Fase 6" di §12 è invece ancora esattamente corretta.

N.Giuliani: ok, è solo da migliorare.

---

## 10. Decisioni prese

**Confermato**
- Lo scheletro Fase 1→9 nel changelog corrisponde a `git log` (commit `adf0862`…`106ea0b`), incluse le sotto-fasi 9.1/9.2/9.3 correttamente accorpate in un'unica voce "Fase 9".
- La narrativa di migrazione di `docs/specifica-tecnica.md` e `docs/impostazioni-claude.md` (migrati e poi eliminati in Fase 8, doc riga 739) corrisponde esattamente a `git log --follow` su entrambi i file (ultimo tocco nel commit `6264f5c`, poi spariti).

**Obsoleto o errato**
- **Gravità media** — La decisione di Fase 7 (doc riga 658: rimozione del pulsante "Confronta settimana con il piano", storico di sola lettura) è corretta e confermata dal codice, ma **contraddice §7** che ancora menziona un "flusso manuale lato client" per lo stesso template di feedback (vedi "Contraddizioni tra sezioni").

N.Giuliani: hai ragione, è da sistemare.

**Mancante**
- **Gravità alta** — Il commit `b318e30` ("Rifinitura sidebar": nuovi file `IconButton.vue` e `useMobileSidebar.ts`, modifiche a `App.vue`, `AthleteSidebar.vue`, `styles/base.css`) non ha **nessuna voce di decisione** in §10 né di changelog in §12, e non tocca affatto `docs/DOCUMENTAZIONE.md` (verificato con `git show b318e30 -- docs/DOCUMENTAZIONE.md`, output vuoto). È un intero blocco di lavoro UI già mergiato e completamente privo di copertura documentale.

N.Giuliani: è necessario documentato.

**Non verificabile**
- La cifra storica "6 chiamate in `athletes.ts`, 2 in `settings.ts`, 1 in `useConnectionStatus.ts`" nella decisione di Fase 9 descrive uno stato passato dei file, non riproducibile con certezza oggi (i conteggi attuali — 7/2/1 — sono dello stesso ordine di grandezza ma non confermano il valore storico esatto).

N.Giuliani: è uno sviluppo che è stato scartato, quindi, possiamo non documentarlo.

---

## 11. Limiti noti e roadmap

**Confermato**
- Autenticazione a singolo utente, assenza di MFA/recupero password — confermato (`stores/auth.ts`, nessun codice MFA).
- Sessioni "a piramide" non supportate come tipo di sessione dedicato — confermato: `athlete_profile.schema.json` definisce `"kind": {"enum":["warmup","cooldown","block","repeat"]}`, nessun valore `pyramid`/`piramide` (l'unico hit per "piramidale" è un campo distinto, lo stile di distribuzione del carico, non il tipo di sessione).
- Il paragrafo su `net::ERR_ABORTED` (riga 694) corrisponde parola per parola al testo aggiunto dal commit `e1e7d3a`.

**Non verificabile**
- Assenza di cifratura applicativa per le chiavi API di terze parti salvate in chiaro — non ri-verificato in modo indipendente in questo audit (si sovrappone a §8), nessuna evidenza contraria trovata.

N.Giuliani: è vero, non viene cifrata.

- Limiti di rate di Intervals.icu (5000/giorno, 2500/15min) — affermazione di natura contrattuale/esterna, non derivabile dal codice.
- Rischio di concorrenza ottimistica sull'intero blob JSONB — affermazione di design/rischio, non ri-derivata direttamente dal codice in questo passaggio.

---

## 12. Changelog per fase

**Confermato**
- La voce "Fix post-Fase 9 — generazione piano silenziosa senza esito a schermo" corrisponde esattamente al diff del commit `e1e7d3a` (stesso elenco di file toccati, stessa formula `max_tokens`, stessa logica `stop_reason`, stesso durata toast 6s).

**Mancante**
- **Gravità alta** — Nessuna voce di changelog per il commit `b318e30` (vedi dettaglio in §10 "Mancante").

N.Giuliani: è da documentare.

**Obsoleto o errato**
- **Gravità bassa** — Stesso conteggio test obsoleto segnalato in §9 ("33 test" vs 38 attuali).

N.Giuliani: è vero, è da sistemare.

---

## Contraddizioni tra sezioni

1. **§7 vs §10** — §7 (doc riga ~496) afferma che il template `weekly_feedback_prompt_template` è ancora interpolato "sia dal flusso manuale lato client sia dalla Edge Function schedulata"; §10 (Fase 7, riga 658) afferma invece che il pulsante del flusso manuale client è stato rimosso e lo storico è di sola lettura. Il codice conferma che §10 è corretta e §7 è residuo non aggiornato.
2. **§2/§3 vs §8/§12** — §2 (albero cartelle, riga 64) e §3 (riga 148) elencano solo gli store `athletes.ts`/`settings.ts`, ma la narrativa di §8/§12 sulla Fase 9 presuppone l'esistenza di un sistema di autenticazione basato su un vero store Pinia (`stores/auth.ts`) mai aggiunto a quegli elenchi.
3. **§4 (riga 193)** — Il rimando "(vedi §2)" per il comportamento dark-mode dei colori zona punta a una sezione (Architettura) che non tratta affatto l'argomento; il contenuto pertinente è in realtà in §4 stessa/§10. Probabile puntatore interno errato.
4. **§6, code-fence SQL** — Il blocco SQL di §6 presenta `create table`/`drop policy if exists` come se facessero parte della stessa migrazione idempotente descritta nel prosa; il file reale non contiene né le `create table` né i `drop policy if exists`, il che rende l'affermazione di idempotenza della prosa (stessa sezione) in contraddizione con il contenuto effettivo del code-fence e del file.
5. **§2/§10/§12 (globale)** — Il commit `b318e30` introduce componenti (`IconButton.vue`, `useMobileSidebar.ts`) che nessuna sezione del documento cita: non il diagramma componenti di §2, non le decisioni di §10, non il changelog di §12. Non è una contraddizione diretta fra due frasi, ma un disallineamento sistemico fra più sezioni che dovrebbero essere coerenti fra loro.

---

## Decisioni per me

1. Il bug di idempotenza reale in `supabase/migrations/0001_enable_rls.sql` (nessun `drop policy if exists`, §6, gravità alta) va corretto subito nel codice, oppure resta solo annotato qui per una fase di fix separata dalla riorganizzazione della doc?

N.Giuliani: va corretto nel codice, inoltre io devo fare qualche verifica?

2. Il file delle credenziali si chiama `PW.md` ma la doc lo chiama ripetutamente `DB_PW.md` (§8): si rinomina il file per allinearlo alla doc, o si corregge la doc per riflettere il nome reale?

N.Giuliani: correggi la doc.

3. Confermi che il flusso manuale lato client per il feedback settimanale è stato rimosso in Fase 7 (come dice §10) e che quindi va tolto ogni riferimento residuo in §7, oppure esiste un motivo per cui la doc lo menziona ancora?

N.Giuliani: onfermo che il flusso manuale lato client per il feedback settimanale è stato rimosso.

4. Vuoi che venga aggiunta una voce di changelog/decisione retroattiva per il commit `b318e30` (sidebar, `IconButton`, `useMobileSidebar`), e che il diagramma componenti di §2 includa questi due file?

N.Giuliani: 

5. Il conteggio "33 test" in §12 (oggi 38) va aggiornato al valore corrente, o lasciato come "fotografia storica" di quella fase specifica del changelog?

N.Giuliani: si.

6. Per tutti i punti "Non verificabile" elencati sopra (stato reale del job `pg_cron`, secret Vault popolato, configurazione Auth su dashboard Supabase, secret Resend impostati in produzione, UUID reale in `is_coach()` sul progetto effettivo) — puoi confermarmeli uno per uno?

N.Giuliani: ho scritto punto per punto sopra, vai a controllare il commento "N.Giuliani:".

7. Vuoi che la futura riorganizzazione separi più nettamente "cosa fa il codice oggi" (sezioni 1-9) da "storico delle decisioni/changelog" (sezioni 10-12), per evitare che valori come conteggi test o elenchi di file si disallineino di nuovo ogni volta che il codice cambia?

N.Giuliani: si esattamente, voglio questa divisione.