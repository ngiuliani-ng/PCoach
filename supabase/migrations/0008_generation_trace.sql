-- Generazione delle sedute tracciabile e regole separate dalle preferenze del coach (ADR 0020).
-- Da eseguire dopo 0001-0007, prima di pubblicare claude-proxy e l'app che scrivono le nuove colonne.
-- Solo aggiunte: le generazioni esistenti restano valide con le colonne nuove vuote.

-- ---------- Cosa ha ricevuto e restituito Claude ----------
alter table public.plan_generations
  add column if not exists prompt_version text,
  add column if not exists system_prompt text,
  add column if not exists user_prompt text,
  add column if not exists preferences_default boolean,
  add column if not exists max_tokens integer,
  add column if not exists response_model text,
  add column if not exists response_id text,
  add column if not exists stop_reason text,
  add column if not exists usage jsonb;

comment on column public.plan_generations.system_prompt is 'Istruzioni di sistema inviate a Claude: regole fisse, formato, preferenze del coach.';
comment on column public.plan_generations.user_prompt is 'Messaggio inviato a Claude: dati dell''atleta, calendario, sedute fisse, motivo.';
comment on column public.plan_generations.preferences_default is 'true se le preferenze del coach erano quelle predefinite.';

-- ---------- Applicazione: rifiuta una data di partenza passata ----------
create or replace function public.apply_plan_generation(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_gen public.plan_generations;
  v_athlete text := p->>'athlete_id';
  v_from date := (p->>'from_date')::date;
  v_classified jsonb := coalesce(p->'keep', '[]'::jsonb) || coalesce(p->'supersede', '[]'::jsonb);
  v_ids uuid[];
  v_matching integer;
  v_plan_id uuid;
  v_item jsonb;
  v_new_id uuid;
begin
  select * into v_gen from public.plan_generations where id = (p->>'generation_id')::uuid for update;
  if not found then
    raise exception 'generation_not_found';
  end if;
  if v_gen.status <> 'proposed' then
    raise exception 'generation_not_proposed';
  end if;
  if v_gen.athlete_id <> v_athlete then
    raise exception 'athlete_mismatch';
  end if;
  -- Una proposta non si applica da una data gia' passata (nel fuso del coach): sostituirebbe
  -- sedute dei giorni trascorsi senza attivita' registrata (audit E-05).
  if v_from < (now() at time zone coalesce(
       (select s.weekly_feedback_timezone from public.app_settings s where s.id = 1), 'Europe/Rome'))::date then
    raise exception 'from_date_past';
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_ids from jsonb_array_elements(v_classified) x;
  perform 1 from public.workouts where id = any (v_ids) for update;

  -- Le sedute devono essere ancora come il coach le ha viste nell'anteprima.
  select count(*) into v_matching
    from public.workouts w
    join jsonb_array_elements(v_classified) x on w.id = (x->>'id')::uuid
   where w.revision = (x->>'revision')::integer
     and w.status in ('draft', 'approved')
     and w.athlete_id = v_athlete;
  if v_matching <> jsonb_array_length(v_classified) then
    raise exception 'stale_workouts';
  end if;
  -- Nessuna seduta attiva dalla data di ripartenza puo' restare non classificata.
  if exists (
    select 1 from public.workouts w
     where w.athlete_id = v_athlete and w.planned_date >= v_from
       and w.status in ('draft', 'approved') and not (w.id = any (v_ids))
  ) then
    raise exception 'unclassified_workouts';
  end if;

  update public.training_plans
     set status = 'ended', end_date = greatest(start_date, v_from - 1), ended_at = now(),
         end_reason = nullif(v_gen.reason, '')
   where athlete_id = v_athlete and status = 'active';

  insert into public.training_plans (athlete_id, name, status, start_date, end_date, weeks_meta, generation_id)
  values (
    v_athlete, coalesce(p->'plan'->>'name', ''), 'active',
    (p->'plan'->>'start_date')::date, (p->'plan'->>'end_date')::date,
    coalesce(p->'plan'->'weeks_meta', '[]'::jsonb), v_gen.id
  )
  returning id into v_plan_id;

  -- Prima si liberano gli slot delle sostituite, poi si inseriscono le nuove.
  update public.workouts
     set status = 'superseded',
         change_note = 'Sostituita dalla rigenerazione' || coalesce(': ' || nullif(v_gen.reason, ''), '')
   where id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(p->'supersede', '[]'::jsonb)) x);

  update public.workouts
     set plan_id = v_plan_id, change_note = 'Mantenuta nella rigenerazione'
   where id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(p->'keep', '[]'::jsonb)) x);

  for v_item in select * from jsonb_array_elements(coalesce(p->'insert', '[]'::jsonb)) loop
    insert into public.workouts (
      athlete_id, plan_id, generation_id, planned_date, slot, discipline, title, objective,
      notes_for_athlete, duration_min, structure, primary_target, status, needs_review, change_note
    ) values (
      v_athlete, v_plan_id, v_gen.id, (v_item->>'planned_date')::date,
      coalesce((v_item->>'slot')::smallint, 0), v_item->>'discipline',
      coalesce(v_item->>'title', ''), coalesce(v_item->>'objective', ''),
      coalesce(v_item->>'notes_for_athlete', ''), (v_item->>'duration_min')::numeric,
      nullif(v_item->'structure', 'null'::jsonb), coalesce(v_item->>'primary_target', 'none'),
      'draft', v_item->>'needs_review',
      coalesce(v_item->>'change_note', 'Creata dalla generazione')
    )
    returning id into v_new_id;
    if v_item->>'replaces' is not null then
      update public.workouts set superseded_by = v_new_id where id = (v_item->>'replaces')::uuid;
    end if;
  end loop;

  update public.plan_generations set status = 'applied', applied_at = now() where id = v_gen.id;
  return v_plan_id;
end;
$$;

-- ---------- Chiave di Claude: si sa se c'e', senza leggerla ----------
create or replace function public.claude_key_configured()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select s.claude_api_key is not null and s.claude_api_key <> '' from public.app_settings s where s.id = 1), false);
$$;
revoke execute on function public.claude_key_configured() from public, anon;
grant execute on function public.claude_key_configured() to authenticated;

-- Rollback (prima di avere dati da conservare nelle nuove colonne):
-- alter table public.plan_generations drop column prompt_version, drop column system_prompt, drop column user_prompt,
--   drop column preferences_default, drop column max_tokens, drop column response_model, drop column response_id,
--   drop column stop_reason, drop column usage;
-- drop function public.claude_key_configured(); poi rieseguire apply_plan_generation da 0004.
