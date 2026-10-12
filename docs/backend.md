# Backend

**Quando leggerlo**: prima di modificare le tabelle Postgres, le policy RLS, le funzioni SQL delle sedute o le Edge Function (`claude-proxy`, `intervals-sync`, `weekly-feedback`).

## Tabelle Postgres

Lo schema è versionato in `supabase/migrations/`, da eseguire in ordine numerico:
- `0001`/`0002`: RLS e `is_coach()`;
- `0003`: definizione di `athletes` e `app_settings`, create in origine dalla dashboard;
- `0004`: tabelle delle sedute, trigger e funzioni SQL;
- `0005`: rimozione dell'import una tantum dei piani salvati nella scheda, concluso;
- `0006`: tipo di generazione `continue` in `plan_generations.kind`;
- `0007`: tabella `weekly_reviews`, funzione `regenerate_weekly_review`, colonna `app_settings.feedback_params`;
- `0008`: colonne di tracciabilità di `plan_generations`, rifiuto delle proposte con data di partenza passata, funzione `claude_key_configured`;
- `0009`: esito e dati dell'attività sulle sedute svolte (`workouts.completion_outcome`, `completion_ratio`, `activity_*`);
- `0010`: job orario del feedback, con attesa della risposta fino a 150 s;
- `0011`: colonna `app_settings.zone_models`.

- **`athletes`**: `id` (text, chiave primaria: l'identificativo di 8 caratteri generato dall'app), `data` (jsonb, l'intero `AthleteTrainingProfile` — vedi [modello-dati.md](modello-dati.md)), `updated_at` (timestamptz, usato per il controllo di concorrenza ottimistico).
- **`app_settings`**: riga singola (`id = 1`), contiene configurazione globale del coach: `claude_api_key` (scritta dall'app solo quando il coach ne inserisce una nuova, mai riletta: l'app sa solo se c'è, con `claude_key_configured()`), `claude_model` (uno dei modelli ammessi), preferenze del piano e tono del feedback (vuoti = predefiniti nel codice), `weekly_feedback_*` (timezone, giorno, ora, `email_enabled`), `feedback_params` (soglie dell'analisi del feedback, jsonb, con una coppia di soglie d'intensità per sistema di zone; i valori assenti prendono i predefiniti di `_shared/feedback/params.ts`, e le vecchie chiavi `low_zone_max`/`moderate_zone_max` valgono come quelle a 7 zone), `zone_models` (modelli di zone per allineare Intervals.icu a PCoach, jsonb; i valori assenti o non validi prendono i predefiniti di `_shared/workouts/zoneModels.ts`).
- **`training_plans`, `plan_generations`, `workouts`, `workout_sync`, `workout_events`**: le sedute e ciò che le riguarda. Colonne, vincoli e stati in [modello-dati.md § Sedute e piani](modello-dati.md#sedute-e-piani).
- **`weekly_reviews`**: le valutazioni settimanali. Colonne e stati in [modello-dati.md § Valutazioni settimanali](modello-dati.md#valutazioni-settimanali).

## Funzioni SQL del feedback

- `regenerate_weekly_review(p_id)`: nella stessa transazione rende `superseded` la valutazione e ne crea una `pending` con `revision + 1`. Rifiuta (`review_busy`) se la riga è bloccata da un'elaborazione in corso. `security invoker`, eseguibile da `authenticated` e `service_role`.

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

`security invoker` (vale la RLS del chiamante), `search_path` vuoto, `EXECUTE` solo ad `authenticated`.

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

  Rifiuta anche una data di partenza già passata nel fuso del coach (`from_date_past`).

  Ripeterla è innocuo.
- **`claude_key_configured()`**: `true` se la chiave di Claude è salvata, senza restituirla.

## Autenticazione e RLS

Supabase Auth a singolo utente coach (vedi [sicurezza.md](sicurezza.md) per setup). `supabase/migrations/0001_enable_rls.sql` e `supabase/migrations/0002_move_is_coach_private.sql` (da eseguire in quest'ordine) definiscono:

- `private.is_coach()`: funzione SQL `security definer` con `search_path` vuoto, che confronta `auth.uid()` con l'UUID letterale dell'utente coach (incollato in `0001` al posto del placeholder `INCOLLA-QUI-UUID-UTENTE-COACH`). Vive nello schema `private`, che non è esposto da PostgREST: non esiste un endpoint `/rest/v1/rpc/is_coach` e nessun client può chiamarla direttamente. `EXECUTE` è revocato a `public` e `anon` e concesso solo ad `authenticated` (con `USAGE` sullo schema `private`), perché le policy RLS sono valutate con i privilegi del chiamante. Motivazione in [decisioni/0012-is-coach-schema-privato.md](decisioni/0012-is-coach-schema-privato.md).
- RLS abilitata su `athletes` e `app_settings`, con 4 policy ciascuna (select/insert/update/delete, tutte `to authenticated using/with check (private.is_coach())`).
- RLS abilitata anche sulle tabelle delle sedute e su `weekly_reviews`. `training_plans`, `plan_generations`, `workouts`, `workout_sync` e `weekly_reviews` hanno una policy `for all` con `private.is_coach()`. `workout_events` ha solo select e insert: la cronologia non si modifica né si cancella, se non a cascata con la seduta. Nessuna policy per il ruolo `anon`: con RLS abilitata, Postgres nega di default ogni richiesta priva di policy applicabile.
- Il JWT del coach autenticato è allegato automaticamente dal client `supabase-js`: nessuna modifica è stata necessaria alle query esistenti per abilitare RLS (vedi [decisioni/0010-autenticazione-coach-rls-reale.md](decisioni/0010-autenticazione-coach-rls-reale.md)).

## Concorrenza ottimistica: `syncLoadMetrics`

Scrittura mirata usata per aggiornare `training_status.load_metrics_log` senza richiedere un salvataggio esplicito della scheda (es. dopo una sincronizzazione Intervals.icu in background):

1. Legge la riga corrente (`data`, `updated_at`) da `athletes`.
2. Fonde i nuovi dati nel log esistente, senza mai sovrascrivere una voce con `source: "manual"` per la stessa data.
3. Scrive con `PATCH .../athletes?id=eq.<id>&updated_at=eq.<updated_at noto>`: se nel frattempo la riga è stata modificata altrove, la condizione sull'`updated_at` noto non trova righe da aggiornare e la risposta è vuota (nessuna sovrascrittura silenziosa).
4. Se la risposta contiene la riga aggiornata, aggiorna `updated_at` locale.
5. Aggiorna anche la mappa in memoria `athletes[id]` nello store Pinia, cosi la UI riflette subito il nuovo log senza un refetch.

## `claude-proxy` (Edge Function)

Proxy verso `api.anthropic.com` per la generazione delle sedute, necessario perché Anthropic rifiuta le chiamate dirette dal browser (CORS) e perché la Claude API key non deve mai raggiungere il client.

- **Autenticazione del chiamante**: JWT di sessione valido, verificato con `auth.getUser()`, e lettura di `app_settings` con quel JWT: solo il coach ottiene la riga (RLS), altrimenti 403. La sola anon key non basta.
- **Richiesta**: `POST { prompt, system?, max_tokens?, model? }`: `prompt` è il messaggio, `system` le istruzioni.
- **Risposta**: `{ text, stop_reason, model, usage, id }` in caso di successo; `{ error }` (stringa) con status 4xx/5xx in ogni caso di fallimento (JSON non valido, prompt mancante, non autenticato o non coach, chiave Claude non configurata, errore Anthropic, rete).
- `max_tokens`: quello del client (generazione: vedi [integrazioni.md](integrazioni.md#claude-generazione-delle-sedute)), 4096 se assente, mai oltre 20 000.
- `model`: il primo modello ammesso (`_shared/claude/models.ts`) fra quello della richiesta e quello di `app_settings`, altrimenti il predefinito.

## `intervals-sync` (Edge Function)

Scrive le sedute sul calendario Intervals.icu dell'atleta, e ne legge e allinea le zone. Regole di sincronizzazione e formato in [integrazioni.md](integrazioni.md#intervalsicu-sincronizzazione-delle-sedute), zone in [integrazioni.md](integrazioni.md#intervalsicu-zone-dellatleta).

- **Autenticazione del chiamante**: JWT di sessione del coach, verificato con `auth.getUser()`; la sola anon key non basta. Il database è letto e scritto con lo stesso JWT (la chiave pubblica inviata dal client nell'header `apikey`, perché la anon key legacy del progetto è disattivata, più il JWT del coach), quindi vale la RLS.
- **Richiesta `{ action: "preview", athlete_id, week_start }`**:
  - legge gli eventi `WORKOUT` della settimana e, uno per uno, quelli memorizzati che non compaiono (404 = spariti);
  - registra come svolte, con esito e dati dell'attività, le sedute approvate abbinate con certezza a un'attività (regola unica `completionsIn` in `_shared/feedback/completion.ts`: evento abbinato, oppure stesso giorno e disciplina con una sola coppia).

  Risponde `{ remote: { events: [{id, updated}], missingIds }, completed }`. Non scrive nulla su Intervals.icu.
- **Richiesta `{ action: "apply", athlete_id, workout_id, op, expected_revision }`**, con `op` tra `create`, `update`, `overwrite`, `recreate` e `delete`. Esegue una sola operazione:
  - rifiuta con 409 (`code: "stale"`) se la revisione è cambiata dall'anteprima;
  - invia solo sedute approvate e valide; rimuove solo sedute annullate o sostituite con `pending_delete`, mai se svolte;
  - salva subito l'esito in `workout_sync` e in `workout_events`.

  Risponde `{ ok, outcome, warning }` oppure `{ ok: false, error }`.
- **Richiesta `{ action: "zones_read", athlete_id }`**: legge `GET /sport-settings` e risponde `{ settings }` con, per ogni sport, solo `id`, `types`, `ftp`, `lthr`, `max_hr`, `threshold_pace`, `power_zones`, `hr_zones` e `pace_zones`. Non scrive nulla.
- **Richiesta `{ action: "zones_apply", athlete_id, discipline, key, zones }`**, con `key` della stessa disciplina (`cycling_power`, `cycling_hr`, `running_pace`, `swimming_pace`) e `zones` pari a 3, 5 o 7. Legge i modelli salvati in `app_settings.zone_models`, calcola le zone (`icuZonesUpdate` in `_shared/workouts/zoneModels.ts`), le scrive con `PUT /sport-settings/{id}?recalcHrZones=false` e controlla il numero di zone salvato. Risponde `{ ok: true, settings }` oppure `{ ok: false, error }`.
- **Trasporto**: timeout di 10 s e fino a 2 nuovi tentativi su 429, 5xx ed errori di rete (attesa di 1 s, poi 3 s, oppure `Retry-After`, al massimo 10 s). I messaggi d'errore sono riformulati senza header né chiavi.

## `weekly-feedback` (Edge Function)

Adattatore della pipeline in `supabase/functions/_shared/feedback/pipeline.ts`, che contiene tutta la logica (stati, nuovi tentativi, abbinamento, metriche, validazione) ed è testata con Vitest. La funzione fornisce solo il database (supabase-js), Intervals.icu, Claude e Resend. Motivazioni in [decisioni/0019](decisioni/0019-feedback-analisi-deterministica-approvazione.md).

**Due chiamanti**:
- **`pg_cron`, ogni ora**, con un bearer che deve essere **esattamente** la service-role key (letta da Vault). Il gateway JWT da solo accetterebbe anche la chiave pubblica.
  1. Il lunedì, dall'ora di `weekly_feedback_time` (contano solo le ore) fino a fine giornata, nel fuso `weekly_feedback_timezone` (se non è un fuso valido vale `Europe/Rome`, `safeTimeZone` in `_shared/feedback/period.ts`), crea una valutazione `pending` per la settimana appena conclusa, per ogni atleta con chiave Intervals.icu e almeno una seduta approvata in quella settimana. La creazione è un `upsert … ignoreDuplicates` sull'indice unico della revisione: due esecuzioni non creano due righe. Se esiste già una valutazione creata durante la settimana e non ancora approvata, viene sostituita da una nuova revisione (`regenerate_weekly_review`); una valutazione approvata resta. `weekly_feedback_day` non è più usato: vale sempre `lunedi`.
  2. Elabora la coda (al massimo 20 righe, entro 100 s): righe `pending` o `analyzed` con meno di 3 tentativi, e righe `approved` con consegna `pending` o `failed` e meno di 3 tentativi. Ogni riga viene prima bloccata per 180 s (`locked_until`).
- **Il coach**, con il JWT di sessione: il database è letto e scritto con RLS. Dopo l'autenticazione la funzione verifica che il chiamante possa leggere `app_settings`, cioè che sia il coach. Azioni `POST { action, … }`:
  - `create` (`athlete_id`, `week_start`: un lunedì non futuro): crea o riprende la valutazione corrente della settimana e la elabora subito;
  - `regenerate` (`review_id`): `regenerate_weekly_review`, poi elaborazione;
  - `retry` (`review_id`): riparte da `analysis_failed`, `generation_failed` o da una consegna fallita o saltata;
  - `approve` (`review_id`, `text`, `send?`): da `draft` ad `approved` con il testo del coach; se l'email è attiva e `send` non è `false`, consegna subito. L'app manda `send: false` quando la settimana è già stata inviata con una revisione precedente e il coach non sceglie di inviare anche questa.

  Risposta `{ id, status, delivery_status? }` oppure `{ error }`.

**Passi di una valutazione**:
1. **Analisi** (`pending` → `analyzed`):
   - legge le sedute approvate della settimana con il legame all'evento Intervals.icu, il numero di bozze, le modifiche del coach (`workout_events`) e i piani;
   - legge le attività dal lunedì precedente alla domenica e il benessere dei 35 giorni precedenti;
   - costruisce il contratto `feedback_input` ([integrazioni.md § Claude (feedback settimanale)](integrazioni.md#claude-feedback-settimanale));
   - segna come svolte le sedute abbinate con confidenza `confirmed` o `high`;
   - senza sedute approvate la valutazione diventa `skipped`;
   - un errore di Intervals.icu lascia la riga `pending` con il tentativo contato, e dopo 3 tentativi la porta in `analysis_failed`.
2. **Testo** (`analyzed` → `draft`):
   - chiamata a Claude con lo strumento `submit_weekly_feedback` e `max_tokens` 3000;
   - un output non valido viene ritentato una volta con l'elenco degli errori, poi diventa `generation_failed`;
   - un errore transitorio (rete, 429, 5xx, nessuna risposta in 100 s) lascia la riga `analyzed` per il giro successivo.
3. **Consegna** (solo da `approved`): email all'indirizzo della scheda. Il fallimento è salvato in `delivery_status = failed` con l'errore e ritentato fino a 3 volte; la valutazione resta valida. Senza provider o senza indirizzo, `delivery_status = skipped`.

**Trasporto**:
- letture di Intervals.icu con timeout di 15 s e fino a 2 nuovi tentativi su 429, 5xx ed errori di rete;
- Claude con timeout di 100 s.

**Risposta all'invocazione schedulata**: `{ ranAt, planned, processed: [{ id, status }] }`.

Configurazione di `pg_cron` e Vault in [decisioni/0008](decisioni/0008-feedback-automatico-schedulato.md). Il job `weekly-feedback-hourly` (`5 * * * *`) è definito in `migrations/0010_weekly_feedback_cron_timeout.sql`. `net.http_post` aspetta la risposta fino a 150 s (`timeout_milliseconds`), il limite di una Edge Function, così `net._http_response` registra l'esito reale anche il lunedì, quando la funzione lavora più a lungo. Le risposte restano in quella tabella per 6 ore (`pg_net.ttl`).

## `EmailSender`

Interfaccia astratta in `supabase/functions/_shared/emailSender.ts`, con un'unica implementazione `ResendEmailSender`. Il secret `RESEND_API_KEY` vive solo nelle env della Edge Function, mai in `app_settings`. Motivazione in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
