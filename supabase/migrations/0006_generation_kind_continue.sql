-- Tipo di generazione "continue": il piano prosegue dopo la fine di quello attivo, senza
-- sostituire nulla (ADR 0018). Si distingue da "regenerate", che sostituisce le sedute da una data.
alter table public.plan_generations drop constraint if exists plan_generations_kind_check;
alter table public.plan_generations add constraint plan_generations_kind_check check (kind in ('initial', 'continue', 'regenerate'));
