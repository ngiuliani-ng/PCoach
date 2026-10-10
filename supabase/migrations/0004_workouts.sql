-- Sedute come entita' proprie (ADR 0017): piani, generazioni, sedute, stato di
-- sincronizzazione con Intervals.icu e cronologia. Il profilo atleta resta in athletes.data.
-- Da eseguire dopo 0001-0003. Prima dell'esecuzione in produzione: backup di athletes e
-- app_settings nello schema private, non esposto da PostgREST
-- (create table private.athletes_backup_AAAAMMGG as table public.athletes).
-- Le tabelle di backup contengono le chiavi API: mai nello schema public.

-- ---------- Piani ----------
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes(id) on delete cascade,
  name text not null default '',
  status text not null default 'active' check (status in ('active', 'ended', 'archived')),
  start_date date not null,
  end_date date,
  ended_at timestamptz,
  end_reason text,
  weeks_meta jsonb not null default '[]'::jsonb,
  generation_id uuid,
  created_at timestamptz not null default now()
);
-- Un solo piano attivo per atleta.
create unique index if not exists training_plans_one_active on public.training_plans (athlete_id) where status = 'active';

-- ---------- Generazioni (proposte di Claude e import) ----------
create table if not exists public.plan_generations (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes(id) on delete cascade,
  kind text not null check (kind in ('initial', 'regenerate', 'legacy_import')),
  from_date date not null,
  weeks integer not null check (weeks between 1 and 52),
  reason text not null default '',
  kept_workout_ids uuid[] not null default '{}',
  model text,
  raw_response text,
  proposal jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'discarded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
-- Un solo import del piano legacy per atleta: rende l'import idempotente.
create unique index if not exists plan_generations_one_legacy on public.plan_generations (athlete_id) where kind = 'legacy_import';
create index if not exists plan_generations_athlete on public.plan_generations (athlete_id, created_at desc);

-- ---------- Sedute ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes(id) on delete cascade,
  plan_id uuid references public.training_plans(id) on delete set null,
  generation_id uuid references public.plan_generations(id) on delete set null,
  planned_date date not null,
  slot smallint not null default 0 check (slot >= 0),
  discipline text not null check (discipline in ('running', 'cycling', 'swimming', 'strength')),
  title text not null default '',
  objective text not null default '',
  notes_for_athlete text not null default '',
  duration_min numeric check (duration_min is null or duration_min > 0),
  structure jsonb check (structure is null or jsonb_typeof(structure) = 'object'),
  primary_target text not null default 'none' check (primary_target in ('power', 'hr', 'pace', 'none')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'cancelled', 'superseded')),
  superseded_by uuid references public.workouts(id) on delete set null,
  locked boolean not null default false,
  needs_review text,
  legacy jsonb,
  completed_at timestamptz,
  completed_activity_id text,
  completion_source text check (completion_source in ('intervals', 'manual')),
  revision integer not null default 1,
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workouts_athlete_date on public.workouts (athlete_id, planned_date);
create index if not exists workouts_plan on public.workouts (plan_id);
-- Nessun doppione: un solo allenamento attivo per atleta, giorno e posizione nel giorno.
-- Annullate e sostituite restano nello storico senza occupare il giorno.
create unique index if not exists workouts_active_slot on public.workouts (athlete_id, planned_date, slot)
  where status in ('draft', 'approved');

-- ---------- Sincronizzazione con i provider esterni ----------
create table if not exists public.workout_sync (
  workout_id uuid not null references public.workouts(id) on delete cascade,
  provider text not null default 'intervals_icu' check (provider in ('intervals_icu')),
  remote_event_id bigint,
  external_id text not null,
  synced_revision integer not null default 0,
  synced_date date,
  remote_updated text,
  state text not null check (state in ('synced', 'error', 'removed', 'unlinked')),
  pending_delete boolean not null default false,
  create_uncertain boolean not null default false,
  last_error text,
  last_warning text,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  primary key (workout_id, provider)
);

-- ---------- Cronologia (audit e versioni) ----------
create table if not exists public.workout_events (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  athlete_id text not null references public.athletes(id) on delete cascade,
  at timestamptz not null default now(),
  type text not null,
  revision integer not null,
  before jsonb,
  after jsonb,
  note text
);
create index if not exists workout_events_workout on public.workout_events (workout_id, at);

-- ---------- Revisione e cronologia automatiche ----------
-- Il contenuto e' cio' che, se cambia, rende obsoleta la copia su Intervals.icu.
create or replace function private.workout_content(w public.workouts)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'planned_date', w.planned_date, 'discipline', w.discipline, 'title', w.title,
    'objective', w.objective, 'notes_for_athlete', w.notes_for_athlete,
    'duration_min', w.duration_min, 'structure', w.structure, 'primary_target', w.primary_target
  );
$$;

-- La revisione la gestisce solo il database: +1 a ogni cambio di contenuto, mai dal client.
create or replace function private.workouts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.workout_content(new) is distinct from private.workout_content(old) then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  -- La nota descrive una sola modifica: se il client non ne manda una nuova, non si ripete.
  if new.change_note is not distinct from old.change_note then
    new.change_note := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.workouts_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := 1;
  return new;
end;
$$;

create or replace function private.workouts_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_after jsonb := private.workout_content(new);
  v_before jsonb;
  v_status_event text;
begin
  if tg_op = 'INSERT' then
    insert into public.workout_events (workout_id, athlete_id, type, revision, after, note)
    values (new.id, new.athlete_id, 'created', new.revision, v_after, new.change_note);
    return null;
  end if;

  v_before := private.workout_content(old);
  if v_after is distinct from v_before then
    insert into public.workout_events (workout_id, athlete_id, type, revision, before, after, note)
    values (
      new.id, new.athlete_id,
      case when (v_after - 'planned_date') = (v_before - 'planned_date') then 'moved' else 'edited' end,
      new.revision, v_before, v_after, new.change_note
    );
  end if;

  if new.status is distinct from old.status then
    v_status_event := case new.status
      when 'approved' then 'approved'
      when 'cancelled' then 'cancelled'
      when 'superseded' then 'superseded'
      else 'restored'
    end;
    insert into public.workout_events (workout_id, athlete_id, type, revision, note)
    values (new.id, new.athlete_id, v_status_event, new.revision, new.change_note);
  end if;

  if new.plan_id is distinct from old.plan_id and old.plan_id is not null then
    insert into public.workout_events (workout_id, athlete_id, type, revision, note)
    values (new.id, new.athlete_id, 'plan_changed', new.revision, new.change_note);
  end if;
  if new.locked is distinct from old.locked then
    insert into public.workout_events (workout_id, athlete_id, type, revision)
    values (new.id, new.athlete_id, case when new.locked then 'locked' else 'unlocked' end, new.revision);
  end if;
  if new.completed_at is distinct from old.completed_at then
    insert into public.workout_events (workout_id, athlete_id, type, revision, note)
    values (new.id, new.athlete_id, case when new.completed_at is null then 'uncompleted' else 'completed' end, new.revision, new.completion_source);
  end if;

  -- Annullare o sostituire una seduta gia' su Intervals.icu non la rimuove: la segna da
  -- rimuovere, e la rimozione avviene solo quando il coach conferma "Sincronizza settimana".
  -- Una seduta svolta non si rimuove mai (l'evento e' abbinato all'attivita').
  if new.status in ('cancelled', 'superseded') and old.status in ('draft', 'approved') then
    update public.workout_sync
       set pending_delete = (remote_event_id is not null and new.completed_at is null)
     where workout_id = new.id and state in ('synced', 'error');
  elsif new.status in ('draft', 'approved') and old.status in ('cancelled', 'superseded') then
    update public.workout_sync set pending_delete = false where workout_id = new.id;
  end if;
  return null;
end;
$$;

grant execute on function private.workout_content(public.workouts) to authenticated;

drop trigger if exists workouts_before_update on public.workouts;
create trigger workouts_before_update before update on public.workouts
  for each row execute function private.workouts_before_update();
drop trigger if exists workouts_before_insert on public.workouts;
create trigger workouts_before_insert before insert on public.workouts
  for each row execute function private.workouts_before_insert();
drop trigger if exists workouts_audit on public.workouts;
create trigger workouts_audit after insert or update on public.workouts
  for each row execute function private.workouts_audit();

-- ---------- RLS: solo il coach ----------
alter table public.training_plans enable row level security;
alter table public.plan_generations enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sync enable row level security;
alter table public.workout_events enable row level security;

drop policy if exists "training_plans_coach" on public.training_plans;
create policy "training_plans_coach" on public.training_plans for all to authenticated
  using (private.is_coach()) with check (private.is_coach());
drop policy if exists "plan_generations_coach" on public.plan_generations;
create policy "plan_generations_coach" on public.plan_generations for all to authenticated
  using (private.is_coach()) with check (private.is_coach());
drop policy if exists "workouts_coach" on public.workouts;
create policy "workouts_coach" on public.workouts for all to authenticated
  using (private.is_coach()) with check (private.is_coach());
drop policy if exists "workout_sync_coach" on public.workout_sync;
create policy "workout_sync_coach" on public.workout_sync for all to authenticated
  using (private.is_coach()) with check (private.is_coach());
-- La cronologia si legge e si aggiunge, non si modifica.
drop policy if exists "workout_events_select_coach" on public.workout_events;
create policy "workout_events_select_coach" on public.workout_events for select to authenticated
  using (private.is_coach());
drop policy if exists "workout_events_insert_coach" on public.workout_events;
create policy "workout_events_insert_coach" on public.workout_events for insert to authenticated
  with check (private.is_coach());

-- ---------- Applicazione di una generazione: tutto o niente ----------
-- p = { generation_id, athlete_id, from_date,
--       plan: { name, start_date, end_date, weeks_meta },
--       keep: [{ id, revision }], supersede: [{ id, revision }],
--       insert: [{ planned_date, slot, discipline, title, objective, notes_for_athlete,
--                  duration_min, structure, primary_target, needs_review, change_note, replaces }] }
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

-- ---------- Import del piano salvato nella scheda (schema 1.4.0) ----------
-- p = { athlete_id, legacy_plan, plan: { name, start_date, end_date, weeks_meta },
--       workouts: [{ planned_date, slot, discipline, title, objective, notes_for_athlete,
--                    duration_min, structure, primary_target, needs_review, legacy, change_note }] }
-- Idempotente: restituisce null se il piano dell'atleta e' gia' stato importato.
create or replace function public.import_legacy_plan(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_athlete text := p->>'athlete_id';
  v_start date := (p->'plan'->>'start_date')::date;
  v_end date := (p->'plan'->>'end_date')::date;
  v_gen uuid;
  v_plan uuid;
  v_item jsonb;
begin
  insert into public.plan_generations (athlete_id, kind, from_date, weeks, reason, proposal, status, applied_at)
  values (
    v_athlete, 'legacy_import', v_start,
    least(52, greatest(1, ceil((v_end - v_start + 1) / 7.0)::integer)),
    'Import del piano salvato nella scheda', p->'legacy_plan', 'applied', now()
  )
  on conflict (athlete_id) where kind = 'legacy_import' do nothing
  returning id into v_gen;
  if v_gen is null then
    return null;
  end if;

  insert into public.training_plans (athlete_id, name, status, start_date, end_date, weeks_meta, generation_id)
  values (
    v_athlete, coalesce(p->'plan'->>'name', ''),
    case when exists (select 1 from public.training_plans where athlete_id = v_athlete and status = 'active')
         then 'archived' else 'active' end,
    v_start, v_end, coalesce(p->'plan'->'weeks_meta', '[]'::jsonb), v_gen
  )
  returning id into v_plan;

  for v_item in select * from jsonb_array_elements(coalesce(p->'workouts', '[]'::jsonb)) loop
    insert into public.workouts (
      athlete_id, plan_id, generation_id, planned_date, slot, discipline, title, objective,
      notes_for_athlete, duration_min, structure, primary_target, status, needs_review, legacy, change_note
    ) values (
      v_athlete, v_plan, v_gen, (v_item->>'planned_date')::date,
      coalesce((v_item->>'slot')::smallint, 0), v_item->>'discipline',
      coalesce(v_item->>'title', ''), coalesce(v_item->>'objective', ''),
      coalesce(v_item->>'notes_for_athlete', ''), (v_item->>'duration_min')::numeric,
      nullif(v_item->'structure', 'null'::jsonb), coalesce(v_item->>'primary_target', 'none'),
      'approved', v_item->>'needs_review', v_item->'legacy',
      'Importata dal piano salvato nella scheda' || coalesce('. ' || (v_item->>'change_note'), '')
    );
  end loop;
  return v_plan;
end;
$$;

revoke execute on function public.apply_plan_generation(jsonb) from public, anon;
grant execute on function public.apply_plan_generation(jsonb) to authenticated;
revoke execute on function public.import_legacy_plan(jsonb) from public, anon;
grant execute on function public.import_legacy_plan(jsonb) to authenticated;

-- Rollback (se necessario, prima di avere dati nuovi da conservare):
-- drop table public.workout_events, public.workout_sync, public.workouts, public.plan_generations, public.training_plans cascade;
-- drop function private.workouts_audit(), private.workouts_before_update(), private.workouts_before_insert(), private.workout_content(public.workouts);
-- drop function public.apply_plan_generation(jsonb), public.import_legacy_plan(jsonb);
