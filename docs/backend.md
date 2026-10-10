# Backend

**Quando leggerlo**: prima di modificare le tabelle Postgres, le policy RLS, le funzioni SQL delle sedute o le Edge Function (`claude-proxy`, `intervals-sync`, `weekly-feedback`).

## Tabelle Postgres

Lo schema è versionato in `supabase/migrations/`, da eseguire in ordine numerico:
- `0001`/`0002`: RLS e `is_coach()`;
- `0003`: definizione di `athletes` e `app_settings`, create in origine dalla dashboard;
- `0004`: tabelle delle sedute, trigger e funzioni SQL.

- **`athletes`**: `id` (text, chiave primaria: l'identificativo di 8 caratteri generato dall'app), `data` (jsonb, l'intero `AthleteTrainingProfile` — vedi [modello-dati.md](modello-dati.md)), `updated_at` (timestamptz, usato per il controllo di concorrenza ottimistico).
- **`app_settings`**: riga singola (`id = 1`), contiene configurazione globale del coach: `claude_api_key`, `claude_model`, template dei prompt, `weekly_feedback_*` (timezone, giorno, ora, `email_enabled`).
- **`training_plans`, `plan_generations`, `workouts`, `workout_sync`, `workout_events`**: le sedute e ciò che le riguarda. Colonne, vincoli e stati in [modello-dati.md § Sedute e piani](modello-dati.md#sedute-e-piani).

## Trigger delle sedute

- `workouts_before_update`: incrementa `revision` quando cambia il contenuto della seduta (`private.workout_content`). Il client non può impostarla. Azzera `change_note` se non ne arriva una nuova, così una nota descrive una sola modifica.
- `workouts_before_insert`: ogni seduta nasce con `revision = 1`.
- `workouts_audit`: dopo ogni insert o update scrive gli eventi in `workout_events`:
  - creata, modificata o spostata, con le istantanee prima e dopo;
  - approvata, annullata, sostituita o ripristinata;
  - passata a un altro piano;
  - bloccata o sbloccata;
  - svolta o non svolta.

  Quando una seduta già inviata (e non svolta) viene annullata o sostituita, imposta `workout_sync.pending_delete`. Se la seduta torna attiva, lo azzera.

## Funzioni SQL delle sedute

Entrambe `security invoker` (vale la RLS del chiamante), `search_path` vuoto, `EXECUTE` solo ad `authenticated`.

- **`apply_plan_generation(p jsonb)`**: applica una proposta in un'unica transazione. Contenuto di `p`:
  - `generation_id`, `athlete_id`, `from_date`;
  - `plan` (`name`, `start_date`, `end_date`, `weeks_meta`);
  - `keep` e `supersede`, ciascuno come elenco di `{id, revision}`;
  - `insert` (sedute nuove, con `replaces`).

  Rifiuta con un'eccezione, e quindi non applica nulla, se:
  - la generazione non è `proposed` (`generation_not_proposed`);
  - una seduta classificata non è più alla revisione vista nell'anteprima (`stale_workouts`);
  - resta una seduta attiva dalla data di ripartenza non classificata (`unclassified_workouts`).

  Altrimenti:
  1. chiude il piano attivo al giorno prima della ripartenza e crea il nuovo;
  2. segna le sedute da sostituire (prima, per liberare gli slot);
  3. sposta le mantenute nel nuovo piano;
  4. inserisce le nuove come bozze, collegando `superseded_by`;
  5. segna la generazione `applied`.

  Ripeterla è innocuo.
- **`import_legacy_plan(p jsonb)`**: importa il `training_plan` di una scheda (sedute già convertite dall'app con `legacyPlanToImport`) come piano e sedute approvate, conservando l'originale in `workouts.legacy`. È idempotente grazie all'indice unico su `plan_generations` (`kind = 'legacy_import'`): restituisce `null` se l'atleta è già stato importato. L'app la invoca all'avvio per ogni atleta con un piano nella scheda.

## Autenticazione e RLS

Supabase Auth a singolo utente coach (vedi [sicurezza.md](sicurezza.md) per setup). `supabase/migrations/0001_enable_rls.sql` e `supabase/migrations/0002_move_is_coach_private.sql` (da eseguire in quest'ordine) definiscono:

- `private.is_coach()`: funzione SQL `security definer` con `search_path` vuoto, che confronta `auth.uid()` con l'UUID letterale dell'utente coach (incollato in `0001` al posto del placeholder `INCOLLA-QUI-UUID-UTENTE-COACH`). Vive nello schema `private`, che non è esposto da PostgREST: non esiste un endpoint `/rest/v1/rpc/is_coach` e nessun client può chiamarla direttamente. `EXECUTE` è revocato a `public` e `anon` e concesso solo ad `authenticated` (con `USAGE` sullo schema `private`), perché le policy RLS sono valutate con i privilegi del chiamante. Motivazione in [decisioni/0012-is-coach-schema-privato.md](decisioni/0012-is-coach-schema-privato.md).
- RLS abilitata su `athletes` e `app_settings`, con 4 policy ciascuna (select/insert/update/delete, tutte `to authenticated using/with check (private.is_coach())`).
- RLS abilitata anche sulle tabelle delle sedute. `training_plans`, `plan_generations`, `workouts` e `workout_sync` hanno una policy `for all` con `private.is_coach()`. `workout_events` ha solo select e insert: la cronologia non si modifica né si cancella, se non a cascata con la seduta. Nessuna policy per il ruolo `anon`: con RLS abilitata, Postgres nega di default ogni richiesta priva di policy applicabile.
- Il JWT del coach autenticato è allegato automaticamente dal client `supabase-js`: nessuna modifica è stata necessaria alle query esistenti per abilitare RLS (vedi [decisioni/0010-autenticazione-coach-rls-reale.md](decisioni/0010-autenticazione-coach-rls-reale.md)).

## Concorrenza ottimistica: `syncLoadMetrics`

Scrittura mirata usata per aggiornare `training_status.load_metrics_log` senza richiedere un salvataggio esplicito della scheda (es. dopo una sincronizzazione Intervals.icu in background):

1. Legge la riga corrente (`data`, `updated_at`) da `athletes`.
2. Fonde i nuovi dati nel log esistente, senza mai sovrascrivere una voce con `source: "manual"` per la stessa data.
3. Scrive con `PATCH .../athletes?id=eq.<id>&updated_at=eq.<updated_at noto>`: se nel frattempo la riga è stata modificata altrove, la condizione sull'`updated_at` noto non trova righe da aggiornare e la risposta è vuota (nessuna sovrascrittura silenziosa).
4. Se la risposta contiene la riga aggiornata, aggiorna `updated_at` locale.
5. Aggiorna anche la mappa in memoria `athletes[id]` nello store Pinia, cosi la UI riflette subito il nuovo log senza un refetch.

Questo stesso pattern (lettura → merge → PATCH condizionato su `updated_at`) è duplicato nella Edge Function `weekly-feedback` (vedi sotto), perché le Edge Function Deno non possono importare moduli TypeScript da `app/src`.

## `claude-proxy` (Edge Function)

Proxy verso `api.anthropic.com`, necessario perché Anthropic rifiuta le chiamate dirette dal browser (CORS) e perché la Claude API key non deve mai raggiungere il client.

- **Autenticazione del chiamante**: richiede un bearer che sia un JWT di sessione valido del coach (verificato con `auth.getUser()` usando la service-role key); la sola anon key pubblica non basta. Altrimenti chiunque conoscesse la anon key potrebbe consumare quota Claude a carico del coach.
- **Richiesta**: `POST { prompt, max_tokens?, model? }`.
- **Risposta**: `{ text, stop_reason }` in caso di successo; `{ error }` (stringa) con status 4xx/5xx in ogni caso di fallimento (JSON non valido, prompt mancante, non autenticato, chiave Claude non configurata, errore Anthropic, rete).
- `max_tokens` di default 4096 se non passato dal client; il client (generazione piano) lo scala in proporzione al numero di settimane richieste — vedi [integrazioni.md](integrazioni.md).
- `model` di default `claude-sonnet-4-5` se non configurato in `app_settings` né passato nella richiesta.

## `intervals-sync` (Edge Function)

Scrive le sedute sul calendario Intervals.icu dell'atleta. Regole di sincronizzazione e formato in [integrazioni.md](integrazioni.md#intervalsicu-sincronizzazione-delle-sedute).

- **Autenticazione del chiamante**: JWT di sessione del coach, verificato con `auth.getUser()`; la sola anon key non basta. Il database è letto e scritto con lo stesso JWT (la chiave pubblica inviata dal client nell'header `apikey`, perché la anon key legacy del progetto è disattivata, più il JWT del coach), quindi vale la RLS.
- **Richiesta `{ action: "preview", athlete_id, week_start }`**:
  - legge gli eventi `WORKOUT` della settimana e, uno per uno, quelli memorizzati che non compaiono (404 = spariti);
  - registra come svolte le sedute abbinate a un'attività (`paired_event_id`).

  Risponde `{ remote: { events: [{id, updated}], missingIds }, completed }`. Non scrive nulla su Intervals.icu.
- **Richiesta `{ action: "apply", athlete_id, workout_id, op, expected_revision }`**, con `op` tra `create`, `update`, `overwrite`, `recreate` e `delete`. Esegue una sola operazione:
  - rifiuta con 409 (`code: "stale"`) se la revisione è cambiata dall'anteprima;
  - invia solo sedute approvate e valide; rimuove solo sedute annullate o sostituite con `pending_delete`, mai se svolte;
  - salva subito l'esito in `workout_sync` e in `workout_events`.

  Risponde `{ ok, outcome, warning }` oppure `{ ok: false, error }`.
- **Trasporto**: timeout di 10 s e fino a 2 nuovi tentativi su 429, 5xx ed errori di rete (attesa di 1 s, poi 3 s, oppure `Retry-After`, al massimo 10 s). I messaggi d'errore sono riformulati senza header né chiavi.

## `weekly-feedback` (Edge Function schedulata)

Pensata per essere invocata **ogni ora** da `pg_cron` (non a un orario esatto): internamente verifica se il giorno corrente corrisponde a `weekly_feedback_day` e se l'ora corrente ha **raggiunto o superato** `weekly_feedback_time` ("finestra resto della giornata"), così un'invocazione oraria mancata non blocca l'esecuzione fino alla settimana successiva, e le impostazioni modificabili da UI restano effettive senza dover toccare la configurazione del cron.

- **Autenticazione del chiamante**: accetta solo richieste il cui bearer è **esattamente** la service-role key (confronto diretto, non a tempo costante — nota informativa, non uno scenario di attacco pratico dato che la key non è mai esposta al client). Il gateway JWT di Supabase da solo accetterebbe anche la anon key pubblica, che qui non deve poter invocare la function.
- Per ogni atleta con una `intervals_icu_api_key` configurata:
  1. Sincronizza CTL/ATL da Intervals.icu (stessa logica di merge di `services/intervals.ts`: mai sovrascrive voci `source: "manual"`), scrivendo con lo stesso pattern PATCH-condizionato-su-`updated_at` di `syncLoadMetrics`. Un fallimento qui non blocca la generazione del feedback.
  2. Legge le sedute attive degli ultimi 7 giorni dalla tabella `workouts`. Se il piano salvato nella scheda di quell'atleta non è ancora stato importato (nessuna generazione `legacy_import`), legge invece le sessioni di `training_plan`. Salta l'atleta se la settimana non ha sedute, o se esiste già una voce in `weekly_feedback_log` per la data odierna (idempotenza: un solo feedback a settimana per atleta).
  3. Recupera le attività Intervals.icu degli ultimi 7 giorni, confronta con le sessioni pianificate nello stesso intervallo, costruisce il prompt dal template in `app_settings` e chiama Claude con **`max_tokens` fisso a 1024** (non scalato, a differenza della generazione piano).
  4. Salva l'esito in `weekly_feedback_log` (`generated_by: "claude"`) con lo stesso PATCH condizionato.
  5. Se `weekly_feedback_email_enabled` e sono presenti sia `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` (env) sia un'email dell'atleta, invia l'email via Resend. **Un fallimento dell'invio email non porta lo status dell'atleta a `error`**: l'esito per l'atleta resta `"ok"` con il dettaglio dell'errore email riportato a parte (`email: error: ...`); solo errori di sincronizzazione/Claude/salvataggio producono status `"error"`.
- **Risposta**: `{ ranAt, newest, results: [{ athleteId, status, detail? }] }`, oppure `{ skipped: true, reason, ... }` se fuori dalla finestra schedulata, oppure `{ error }` per problemi di configurazione/autenticazione.

Configurazione di `pg_cron`/Vault e motivazioni della schedulazione oraria in [decisioni/0008-feedback-automatico-schedulato.md](decisioni/0008-feedback-automatico-schedulato.md); dettagli Intervals.icu/Claude/Resend in [integrazioni.md](integrazioni.md).

## `EmailSender`

Interfaccia astratta in `supabase/functions/_shared/emailSender.ts`, con un'unica implementazione `ResendEmailSender`. Il secret `RESEND_API_KEY` vive solo nelle env della Edge Function, mai in `app_settings`. Motivazione in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
