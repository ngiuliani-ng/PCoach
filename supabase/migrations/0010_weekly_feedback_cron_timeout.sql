-- Job orario del feedback settimanale (ADR 0008, 0019), ora versionato nel repository.
-- pg_cron chiama la Edge Function weekly-feedback con la service-role key letta da Vault.
-- pg_net aspetta la risposta 5 secondi per impostazione predefinita: il lunedi' la funzione lavora
-- piu' a lungo (analisi e testo di Claude, circa 35 s per atleta il 2026-10-12) e la risposta
-- risultava "timed out" anche a lavoro riuscito. L'attesa sale a 150 s, il limite di una Edge
-- Function, cosi' net._http_response registra l'esito reale.
-- cron.schedule con lo stesso nome aggiorna il job esistente.
select cron.schedule(
  'weekly-feedback-hourly',
  '5 * * * *',
  $job$
  select net.http_post(
    url := 'https://lykalqkkxckzsphlnhij.supabase.co/functions/v1/weekly-feedback',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_feedback_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $job$
);
