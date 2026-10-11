-- Valutazioni settimanali (ADR 0019): il feedback esce dalla scheda atleta e diventa una riga
-- con stati espliciti, l'istantanea dei dati usati e lo stato della consegna. Sostituisce
-- athletes.data.weekly_feedback_log, vuoto per tutti gli atleti al 2026-10-11.

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  kind text not null default 'weekly' check (kind in ('weekly')),
  revision integer not null default 1 check (revision >= 1),
  status text not null default 'pending' check (status in (
    'pending', 'analyzed', 'draft', 'approved', 'skipped', 'analysis_failed', 'generation_failed', 'superseded'
  )),
  skip_reason text,
  plan_id uuid references public.training_plans(id) on delete set null,
  analysis_version text,
  input jsonb,
  metrics jsonb,
  model text,
  prompt_template_hash text,
  output jsonb,
  output_text text,
  error text,
  attempts integer not null default 0,
  locked_until timestamptz,
  delivery_status text not null default 'not_requested'
    check (delivery_status in ('not_requested', 'pending', 'sent', 'failed', 'skipped')),
  delivery_attempts integer not null default 0,
  delivery_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz,
  generated_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  check (period_end = period_start + 6),
  check (extract(isodow from period_start) = 1)
);

-- Idempotenza: una revisione per numero, e una sola valutazione corrente per atleta e settimana.
create unique index if not exists weekly_reviews_revision on public.weekly_reviews (athlete_id, period_start, kind, revision);
create unique index if not exists weekly_reviews_one_current on public.weekly_reviews (athlete_id, period_start, kind) where status <> 'superseded';
create index if not exists weekly_reviews_athlete on public.weekly_reviews (athlete_id, period_start desc);
-- Coda di lavoro della funzione schedulata.
create index if not exists weekly_reviews_work on public.weekly_reviews (status, delivery_status) where status in ('pending', 'analyzed', 'approved');

create or replace function private.weekly_reviews_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists weekly_reviews_touch on public.weekly_reviews;
create trigger weekly_reviews_touch before update on public.weekly_reviews
  for each row execute function private.weekly_reviews_touch();

alter table public.weekly_reviews enable row level security;
drop policy if exists "weekly_reviews_coach" on public.weekly_reviews;
create policy "weekly_reviews_coach" on public.weekly_reviews for all to authenticated
  using (private.is_coach()) with check (private.is_coach());

-- Nuova revisione di una valutazione: la corrente diventa "superseded" e ne nasce una "pending",
-- nella stessa transazione. Rifiutata se la valutazione e' in elaborazione.
create or replace function public.regenerate_weekly_review(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.weekly_reviews;
  v_new uuid;
begin
  select * into v from public.weekly_reviews where id = p_id for update;
  if not found then
    raise exception 'review_not_found';
  end if;
  if v.status = 'superseded' then
    raise exception 'review_superseded';
  end if;
  if v.locked_until is not null and v.locked_until > now() then
    raise exception 'review_busy';
  end if;
  update public.weekly_reviews set status = 'superseded', locked_until = null where id = p_id;
  insert into public.weekly_reviews (athlete_id, period_start, period_end, kind, revision, status)
  values (v.athlete_id, v.period_start, v.period_end, v.kind, v.revision + 1, 'pending')
  returning id into v_new;
  return v_new;
end;
$$;
revoke execute on function public.regenerate_weekly_review(uuid) from public, anon;
grant execute on function public.regenerate_weekly_review(uuid) to authenticated, service_role;

-- Parametri dell'analisi modificabili da Impostazioni (valori assenti = predefiniti nel codice).
alter table public.app_settings add column if not exists feedback_params jsonb not null default '{}'::jsonb;

-- Lo storico nella scheda non serve piu': si rimuove solo se vuoto (schema 1.6.0).
update public.athletes
   set data = jsonb_set(data - 'weekly_feedback_log', '{schema_version}', '"1.6.0"')
 where coalesce(jsonb_array_length(data->'weekly_feedback_log'), 0) = 0;

-- Rollback (prima di avere valutazioni da conservare):
-- drop function public.regenerate_weekly_review(uuid); drop table public.weekly_reviews;
-- drop function private.weekly_reviews_touch(); alter table public.app_settings drop column feedback_params;
