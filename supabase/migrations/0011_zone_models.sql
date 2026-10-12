-- Modelli di zone per allineare Intervals.icu a PCoach (ADR 0029): per ogni misura (potenza e FC
-- della bici, passo di corsa e nuoto) e per ogni sistema di zone, il modello scelto e i limiti in %.
-- Valori assenti o non validi = modelli predefiniti nel codice (_shared/workouts/zoneModels.ts).
alter table public.app_settings add column if not exists zone_models jsonb not null default '{}'::jsonb;

-- Rollback: alter table public.app_settings drop column zone_models;
