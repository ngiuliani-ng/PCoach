-- Controllo periodico degli atleti su Intervals.icu (ADR 0037): una riga per atleta con l'esito
-- dell'ultimo controllo di chiave, zone e soglie. La scrivono la Edge Function athlete-checks (ogni 30
-- minuti, con la service-role key) e intervals-sync quando il coach apre la scheda (zones_read, RLS del
-- coach); la leggono la pagina «Da fare» e il contatore della barra laterale.
create table if not exists public.athlete_checks (
  athlete_id text primary key references public.athletes(id) on delete cascade,
  checked_at timestamptz not null default now(),
  -- valid, invalid (401/403), none (nessuna chiave), unreachable (Intervals.icu non risponde)
  key_status text not null check (key_status in ('valid', 'invalid', 'none', 'unreachable')),
  zone_problems jsonb not null default '[]'::jsonb,
  threshold_problems jsonb not null default '[]'::jsonb
);

alter table public.athlete_checks enable row level security;
drop policy if exists "athlete_checks_coach" on public.athlete_checks;
create policy "athlete_checks_coach" on public.athlete_checks for all to authenticated
  using (private.is_coach()) with check (private.is_coach());

-- Ogni 30 minuti (al minuto 20 e 50, lontano dal job del feedback al minuto 5). Stessa service-role key
-- del feedback, letta da Vault. L'attesa sale a 150 s, il limite di una Edge Function.
select cron.schedule(
  'athlete-checks-30min',
  '20,50 * * * *',
  $job$
  select net.http_post(
    url := 'https://lykalqkkxckzsphlnhij.supabase.co/functions/v1/athlete-checks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_feedback_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $job$
);

-- Rollback:
--   select cron.unschedule('athlete-checks-30min');
--   drop table public.athlete_checks;
