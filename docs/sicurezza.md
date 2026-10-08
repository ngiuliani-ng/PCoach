# Sicurezza

**Quando leggerlo**: prima di toccare credenziali, autenticazione, RLS, o la gestione delle chiavi API esterne (Intervals.icu, Claude, Resend).

## Credenziali Supabase (frontend)

`app/.env` contiene `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (anon key pubblica, destinata a finire nel bundle client — non è un segreto da proteggere allo stesso livello di una service-role key, ma soggetta comunque a RLS). L'anon key è stata ruotata almeno una volta in passato (storico in [CHANGELOG.md](../CHANGELOG.md)); nessuna azione richiesta se non è stata compromessa.

Il file con le credenziali personali del coach si chiama **`PW.md`** (non tracciato in git). **Non va mai letto né citato da un assistente automatico**: se un controllo richiedesse di leggerlo, va segnalato come non eseguibile invece di aprirlo.

## Autenticazione (Supabase Auth, singolo utente coach)

Setup in dashboard Supabase, da eseguire una sola volta:

1. Creare l'utente coach da **Authentication → Users → Add user**, con "Auto Confirm User" spuntato (nessun flusso di conferma email necessario per un utente creato manualmente).
2. Disabilitare tutti gli altri provider di autenticazione (nessuna sign-up pubblica, nessun OAuth): l'app espone solo login email+password per l'unico utente coach.
3. Copiare l'UUID dell'utente creato e incollarlo al posto del placeholder in `supabase/migrations/0001_enable_rls.sql` (`is_coach()`), poi eseguire `0001_enable_rls.sql` e subito dopo `0002_move_is_coach_private.sql`.
4. Verificare che RLS sia attiva su `athletes`/`app_settings`, che le policy risultino presenti e che `is_coach()` sia solo in `private` (`anon` senza `EXECUTE`; `GET /rest/v1/rpc/is_coach` risponde `404`) — vedi [backend.md](backend.md). Il Security Advisor di Supabase non deve più segnalare funzioni `SECURITY DEFINER` eseguibili da `anon` o `authenticated`.
5. Il login (`stores/auth.ts`, `supabase.auth.signInWithPassword`) è l'unico gate d'accesso reale all'app: senza sessione valida, `App.vue` mostra solo `LoginView.vue`. Le policy RLS lato database si basano sulla stessa sessione, allegata automaticamente dal client `supabase-js`.
6. Se il piano Supabase lo consente (Pro), attivare **Prevent use of leaked passwords** in Authentication → Sign In / Providers → Email, che rifiuta password presenti in database di compromissioni note (HaveIBeenPwned). Altrimenti, usare per il coach una password lunga e unica.

## Chiavi API in chiaro (compromesso accettato)

- `intervals_icu_api_key` (per-atleta) e `claude_api_key` (globale, in `app_settings`) sono salvate **in chiaro** nel database, non cifrate a livello applicativo.
- **Motivo**: Postgres/Supabase cifra già a riposo a livello di infrastruttura; l'accesso a queste righe è comunque ristretto dalla RLS al solo utente coach autenticato. Aggiungere cifratura applicativa (con gestione di una chiave di cifratura separata) è stato giudicato un costo non giustificato per un'app mono-utente con un solo coach ad avervi accesso.
- **Rischio residuo**: chiunque ottenga accesso diretto al database (non tramite l'app) vede le chiavi in chiaro. Mitigazione: accesso al progetto Supabase limitato al solo coach; vedi [limiti-roadmap.md](limiti-roadmap.md) per l'elenco completo dei limiti noti.

## Segreti lato server

- `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL`: iniettate automaticamente da Supabase in ogni Edge Function del progetto, mai impostate a mano, mai esposte al client.
- `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`: env della sola Edge Function `weekly-feedback`, mai in `app_settings` — vedi [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
- La service-role key del progetto è inoltre salvata in **Supabase Vault** per essere letta da `pg_cron` al momento di invocare `weekly-feedback` — vedi [backend.md](backend.md).

## Verifica del chiamante nelle Edge Function

Sia `claude-proxy` che `weekly-feedback` verificano l'identità del chiamante prima di eseguire un'azione che costa (quota Claude) o che espone dati:
- `claude-proxy` richiede un JWT di sessione valido del coach (verificato con `auth.getUser()`), non la sola anon key pubblica.
- `weekly-feedback` richiede che il bearer sia **esattamente** la service-role key (così solo `pg_cron`, che la legge da Vault, può invocarla) — dettagli in [backend.md](backend.md).

Dettagli completi del perché RLS/autenticazione reale sono arrivate solo in Fase 9 (e cosa c'era prima) in [decisioni/0010-autenticazione-coach-rls-reale.md](decisioni/0010-autenticazione-coach-rls-reale.md) e [decisioni/0001-niente-auth-rls-iniziale.md](decisioni/0001-niente-auth-rls-iniziale.md) (superata da 0010).
