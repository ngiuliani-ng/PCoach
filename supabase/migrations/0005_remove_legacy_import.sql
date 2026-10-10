-- Rimozione dell'import dei piani salvati nella scheda (schema 1.4.0), concluso e non piu'
-- necessario: le schede non contengono piu' training_plan (schema 1.5.0).
-- Da eseguire dopo 0004, quando non esistono generazioni di tipo 'legacy_import'.

drop function if exists public.import_legacy_plan(jsonb);

drop index if exists public.plan_generations_one_legacy;
alter table public.plan_generations drop constraint if exists plan_generations_kind_check;
alter table public.plan_generations add constraint plan_generations_kind_check check (kind in ('initial', 'regenerate'));

alter table public.workouts drop column if exists legacy;
