-- Modello di Claude (ADR 0041): Claude Sonnet 4.5 va in pensione il 30/11/2026 ed esce dall'elenco
-- dei modelli ammessi (_shared/claude/models.ts). Il valore salvato si allinea al nuovo predefinito;
-- un valore non ammesso tornerebbe comunque al predefinito, ma resterebbe visibile come vecchio.
update public.app_settings
set claude_model = 'claude-sonnet-5-5'
where claude_model is null or claude_model = 'claude-sonnet-4-5';

-- Rollback (solo prima del 30/11/2026, insieme al codice della versione precedente):
--   update public.app_settings set claude_model = 'claude-sonnet-4-5' where claude_model = 'claude-sonnet-5-5';
