-- Testo della bozza corretto dal coach (ADR 0038): l'app lo salva in automatico mentre il coach scrive,
-- cosi' una correzione non si perde uscendo dalla scheda o rigenerando per errore. Il testo di Claude
-- resta in output_text; all'approvazione il testo inviato diventa output_text come prima.
-- L'app scrive solo su una bozza (status = 'draft'), con la RLS del coach gia' in vigore (0007).
alter table public.weekly_reviews add column if not exists coach_text text;
alter table public.weekly_reviews add column if not exists coach_text_at timestamptz;

-- Rollback:
--   alter table public.weekly_reviews drop column coach_text_at;
--   alter table public.weekly_reviews drop column coach_text;
