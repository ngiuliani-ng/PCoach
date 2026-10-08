# Backend

**Quando leggerlo**: prima di modificare le tabelle Postgres, le policy RLS, o le due Edge Function (`claude-proxy`, `weekly-feedback`).

## Tabelle Postgres

Le tabelle `athletes` e `app_settings` sono create direttamente nel progetto Supabase (dashboard/SQL editor); non esiste una migrazione `create table` versionata nel repository — solo l'abilitazione di RLS, le policy e la funzione `is_coach()` sono tracciate in `supabase/migrations/` (`0001_enable_rls.sql`, `0002_move_is_coach_private.sql`).

- **`athletes`**: `id` (uuid, chiave primaria), `data` (jsonb, l'intero `AthleteTrainingProfile` — vedi [modello-dati.md](modello-dati.md)), `updated_at` (timestamptz, usato per il controllo di concorrenza ottimistico).
- **`app_settings`**: riga singola (`id = 1`), contiene configurazione globale del coach: `claude_api_key`, `claude_model`, `weekly_feedback_*` (timezone, giorno, ora, template prompt, `email_enabled`).

## Autenticazione e RLS

Supabase Auth a singolo utente coach (vedi [sicurezza.md](sicurezza.md) per setup). `supabase/migrations/0001_enable_rls.sql` e `supabase/migrations/0002_move_is_coach_private.sql` (da eseguire in quest'ordine) definiscono:

- `private.is_coach()`: funzione SQL `security definer` con `search_path` vuoto, che confronta `auth.uid()` con l'UUID letterale dell'utente coach (incollato in `0001` al posto del placeholder `INCOLLA-QUI-UUID-UTENTE-COACH`). Vive nello schema `private`, che non è esposto da PostgREST: non esiste un endpoint `/rest/v1/rpc/is_coach` e nessun client può chiamarla direttamente. `EXECUTE` è revocato a `public` e `anon` e concesso solo ad `authenticated` (con `USAGE` sullo schema `private`), perché le policy RLS sono valutate con i privilegi del chiamante. Motivazione in [decisioni/0012-is-coach-schema-privato.md](decisioni/0012-is-coach-schema-privato.md).
- RLS abilitata su `athletes` e `app_settings`, con 4 policy ciascuna (select/insert/update/delete, tutte `to authenticated using/with check (private.is_coach())`). Nessuna policy per il ruolo `anon`: con RLS abilitata, Postgres nega di default ogni richiesta priva di policy applicabile.
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

## `weekly-feedback` (Edge Function schedulata)

Pensata per essere invocata **ogni ora** da `pg_cron` (non a un orario esatto): internamente verifica se il giorno corrente corrisponde a `weekly_feedback_day` e se l'ora corrente ha **raggiunto o superato** `weekly_feedback_time` ("finestra resto della giornata"), così un'invocazione oraria mancata non blocca l'esecuzione fino alla settimana successiva, e le impostazioni modificabili da UI restano effettive senza dover toccare la configurazione del cron.

- **Autenticazione del chiamante**: accetta solo richieste il cui bearer è **esattamente** la service-role key (confronto diretto, non a tempo costante — nota informativa, non uno scenario di attacco pratico dato che la key non è mai esposta al client). Il gateway JWT di Supabase da solo accetterebbe anche la anon key pubblica, che qui non deve poter invocare la function.
- Per ogni atleta con una `intervals_icu_api_key` configurata:
  1. Sincronizza CTL/ATL da Intervals.icu (stessa logica di merge di `services/intervals.ts`: mai sovrascrive voci `source: "manual"`), scrivendo con lo stesso pattern PATCH-condizionato-su-`updated_at` di `syncLoadMetrics`. Un fallimento qui non blocca la generazione del feedback.
  2. Se non c'è un `training_plan` assegnato, o se esiste già una voce in `weekly_feedback_log` per la data odierna (idempotenza: un solo feedback a settimana per atleta), salta l'atleta.
  3. Recupera le attività Intervals.icu degli ultimi 7 giorni, confronta con le sessioni pianificate nello stesso intervallo, costruisce il prompt dal template in `app_settings` e chiama Claude con **`max_tokens` fisso a 1024** (non scalato, a differenza della generazione piano).
  4. Salva l'esito in `weekly_feedback_log` (`generated_by: "claude"`) con lo stesso PATCH condizionato.
  5. Se `weekly_feedback_email_enabled` e sono presenti sia `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` (env) sia un'email dell'atleta, invia l'email via Resend. **Un fallimento dell'invio email non porta lo status dell'atleta a `error`**: l'esito per l'atleta resta `"ok"` con il dettaglio dell'errore email riportato a parte (`email: error: ...`); solo errori di sincronizzazione/Claude/salvataggio producono status `"error"`.
- **Risposta**: `{ ranAt, newest, results: [{ athleteId, status, detail? }] }`, oppure `{ skipped: true, reason, ... }` se fuori dalla finestra schedulata, oppure `{ error }` per problemi di configurazione/autenticazione.

Configurazione di `pg_cron`/Vault e motivazioni della schedulazione oraria in [decisioni/0008-feedback-automatico-schedulato.md](decisioni/0008-feedback-automatico-schedulato.md); dettagli Intervals.icu/Claude/Resend in [integrazioni.md](integrazioni.md).

## `EmailSender`

Interfaccia astratta in `supabase/functions/_shared/emailSender.ts`, con un'unica implementazione `ResendEmailSender`. Il secret `RESEND_API_KEY` vive solo nelle env della Edge Function, mai in `app_settings`. Motivazione in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
