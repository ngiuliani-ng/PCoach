-- Impronta del contenuto inviato a Intervals.icu (ADR 0032): se la conversione di PCoach cambia, la
-- seduta torna «da aggiornare» anche senza una nuova revisione. Null per gli invii precedenti:
-- quelle sedute risultano da aggiornare una volta, e il nuovo invio salva l'impronta.
alter table public.workout_sync add column if not exists synced_hash text;

-- Rollback: alter table public.workout_sync drop column synced_hash;
