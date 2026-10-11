-- Esito e dati dell'attivita' sulle sedute svolte (ADR 0021, decisioni del coach D-09 e D-10).
-- Da eseguire dopo 0008, prima di pubblicare weekly-feedback, intervals-sync e l'app che le scrivono.
-- Solo aggiunte. Le colonne non fanno parte del contenuto della seduta: non cambiano la revisione
-- e non rendono «da aggiornare» la copia su Intervals.icu.

alter table public.workouts
  add column if not exists completion_outcome text
    check (completion_outcome is null or completion_outcome in ('completed', 'over', 'partial', 'short')),
  add column if not exists completion_ratio numeric,
  add column if not exists activity_minutes numeric,
  add column if not exists activity_meters numeric,
  add column if not exists activity_load numeric,
  add column if not exists activity_rpe numeric;

comment on column public.workouts.completion_outcome is 'Esito rispetto al prescritto quando la seduta e'' riconosciuta da Intervals.icu: partial e short = svolta in parte.';
comment on column public.workouts.activity_rpe is 'RPE (1-10) inserito dall''atleta su Intervals.icu per l''attivita'' abbinata.';

-- Rollback (prima di avere dati da conservare):
-- alter table public.workouts drop column completion_outcome, drop column completion_ratio, drop column activity_minutes,
--   drop column activity_meters, drop column activity_load, drop column activity_rpe;
