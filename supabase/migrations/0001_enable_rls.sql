-- Fase 9: attiva RLS su athletes/app_settings, limitando l'accesso al solo utente coach.
-- Prima di eseguire: creare l'utente coach da dashboard (Authentication > Users > Add user,
-- "Auto Confirm User" spuntato) e incollarne l'UUID al posto del placeholder qui sotto.
-- Nessuna policy e' definita per il ruolo anon: con RLS abilitata, Postgres nega di default
-- ogni richiesta priva di policy applicabile.

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'INCOLLA-QUI-UUID-UTENTE-COACH'::uuid;
$$;

alter table athletes enable row level security;
drop policy if exists "athletes_select_coach" on athletes;
create policy "athletes_select_coach" on athletes for select to authenticated using (public.is_coach());
drop policy if exists "athletes_insert_coach" on athletes;
create policy "athletes_insert_coach" on athletes for insert to authenticated with check (public.is_coach());
drop policy if exists "athletes_update_coach" on athletes;
create policy "athletes_update_coach" on athletes for update to authenticated using (public.is_coach()) with check (public.is_coach());
drop policy if exists "athletes_delete_coach" on athletes;
create policy "athletes_delete_coach" on athletes for delete to authenticated using (public.is_coach());

alter table app_settings enable row level security;
drop policy if exists "app_settings_select_coach" on app_settings;
create policy "app_settings_select_coach" on app_settings for select to authenticated using (public.is_coach());
drop policy if exists "app_settings_insert_coach" on app_settings;
create policy "app_settings_insert_coach" on app_settings for insert to authenticated with check (public.is_coach());
drop policy if exists "app_settings_update_coach" on app_settings;
create policy "app_settings_update_coach" on app_settings for update to authenticated using (public.is_coach()) with check (public.is_coach());
drop policy if exists "app_settings_delete_coach" on app_settings;
create policy "app_settings_delete_coach" on app_settings for delete to authenticated using (public.is_coach());

-- Rollback (se necessario): alter table athletes/app_settings disable row level security;
-- Le policy restano definite ma inerti; nessuna perdita di dati.
