# 0010 — Autenticazione coach reale e RLS

**Quando leggerlo**: per capire perché e come è stata introdotta l'autenticazione reale, cosa cambia rispetto a [0001](0001-niente-auth-rls-iniziale.md), e perché `claude-proxy`/`weekly-feedback` sono stati irrobustiti nello stesso lavoro.

**Stato**: attiva. Supera [0001](0001-niente-auth-rls-iniziale.md).

## Contesto

Fase 9 (2026-10-04): con l'app ormai usata su un link raggiungibile, l'assenza di autenticazione/RLS ([0001](0001-niente-auth-rls-iniziale.md)) è stata giudicata non più accettabile.

## Decisione

- Supabase Auth a singolo utente coach (creato manualmente da dashboard, nessun provider pubblico) — setup completo in [sicurezza.md](../sicurezza.md).
- `public.is_coach()` + RLS su `athletes`/`app_settings` (`supabase/migrations/0001_enable_rls.sql`) — dettagli in [backend.md](../backend.md).
- Il JWT del coach autenticato è allegato **automaticamente** dal client `supabase-js` ad ogni richiesta: non è stata necessaria alcuna modifica alle query REST esistenti per renderle compatibili con RLS.
- Nello stesso lavoro, `claude-proxy` è stato irrobustito per richiedere un JWT di sessione valido del coach (non la sola anon key) prima di consumare quota Claude.
- Per coerenza, anche `weekly-feedback` è stata irrobustita a verificare il chiamante (bearer deve essere esattamente la service-role key), anche se il suo unico chiamante previsto è `pg_cron`.

## Motivo

Un link raggiungibile senza autenticazione avrebbe esposto dati reali di atleti (e la possibilità di consumare quota Claude a carico del coach) a chiunque lo trovasse. Allegare il JWT automaticamente tramite `supabase-js` ha reso il cambiamento a costo quasi zero per il codice client esistente. Irrobustire entrambe le Edge Function nello stesso commit ha evitato di lasciare un gateway "debole" accanto a uno appena rinforzato.

## Alternativa scartata

Limitare la protezione alla sola RLS su `athletes`/`app_settings`, lasciando `claude-proxy` protetta solo dalla anon key: scartata perché la anon key è per definizione pubblica (finisce nel bundle client), quindi non sarebbe stata una protezione reale contro un uso non autorizzato della quota Claude.
