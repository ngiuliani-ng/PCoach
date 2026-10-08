# 0012 — `is_coach()` in uno schema non esposto

**Quando leggerlo**: per capire perché `is_coach()` vive nello schema `private` e non in `public`, e cosa non va rotto se si tocca la funzione o le policy RLS che la usano.

**Stato**: attiva.

## Contesto

Il Security Advisor di Supabase segnalava `public.is_coach()` (`SECURITY DEFINER`, introdotta da [0010](0010-autenticazione-coach-rls-reale.md)) come eseguibile dai ruoli `anon` e `authenticated` tramite l'endpoint `/rest/v1/rpc/is_coach`. La funzione è usata solo dalle policy RLS di `athletes` e `app_settings`; nessun codice dell'app la chiama via `rpc()`.

## Decisione

- La funzione è spostata nello schema `private` (`supabase/migrations/0002_move_is_coach_private.sql`), che non è tra gli schemi esposti da PostgREST.
- `search_path` della funzione impostato a vuoto; il corpo usa solo nomi qualificati (`auth.uid()`).
- `EXECUTE` revocato a `public` e `anon`, concesso ad `authenticated`; `USAGE` sullo schema `private` concesso ad `authenticated`.
- Le policy RLS non sono riscritte: referenziano la funzione per OID e continuano a funzionare dopo lo spostamento (`pg_policies` mostra `private.is_coach()`).

## Motivo

Le policy RLS sono valutate con i privilegi del ruolo chiamante, quindi `authenticated` deve poter eseguire la funzione e vedere lo schema che la contiene. Spostarla in uno schema non esposto elimina l'endpoint RPC pubblico senza compromettere la RLS, e chiude entrambi i warning del linter (`anon_security_definer_function_executable`, `authenticated_security_definer_function_executable`).

## Alternativa scartata

Solo `REVOKE EXECUTE` da `anon` lasciando la funzione in `public`: l'endpoint resterebbe raggiungibile da qualunque utente autenticato e il warning per `authenticated` resterebbe aperto.
