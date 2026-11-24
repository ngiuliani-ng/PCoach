# 0041 — Migrazione a Claude Sonnet 5.5

**Quando leggerlo**: prima di cambiare il modello di Claude, i parametri delle chiamate (`thinking`, `effort`, `max_tokens`, fallback) o il modo in cui il feedback settimanale riceve un output strutturato.

**Stato**: attiva. Completa [0020](0020-generazione-istruzioni-separate-tracciabilita.md) (elenco chiuso dei modelli) e [0019](0019-feedback-analisi-deterministica-approvazione.md) (output del feedback a schema fisso).

## Contesto

L'unico modello ammesso era Claude Sonnet 4.5 (`claude-sonnet-4-5`), che Anthropic ritira il 30 novembre 2026: da quella data la generazione delle sedute e il feedback settimanale avrebbero smesso di funzionare. Il successore nella stessa linea è Claude Sonnet 5.5 (`claude-sonnet-5-5`), con un prezzo per token più basso ($2/$10 per milione di token in ingresso/uscita, contro $3/$15). Rispetto a Sonnet 4.5 cambiano tre cose che toccano PCoach:
- il `tool_choice` forzato, con cui il feedback otteneva il JSON (`submit_weekly_feedback`), restituisce un errore 400;
- il ragionamento esteso è attivo per default, consuma `max_tokens` e allunga la risposta. Non si spegne con `{ type: "disabled" }` (anche questo restituisce 400) ma con `{ type: "between_tools" }`;
- il tokenizer conta circa il 30% di token in più per lo stesso testo.

Nel testo delle risposte possono inoltre arrivare blocchi diversi da `text`, e i filtri di sicurezza possono rifiutare una richiesta con `stop_reason: "refusal"`.

## Decisione

1. **Modello**: `SUPPORTED_MODELS` contiene solo `claude-sonnet-5-5`. La migrazione `0015` allinea `app_settings.claude_model`. Un valore non ammesso torna comunque al predefinito.
2. **Parametri comuni in un solo modulo** (`_shared/claude/request.ts`), usato da `claude-proxy` e `weekly-feedback`:
   - `thinking: { type: "between_tools" }`: niente ragionamento esteso, come con Sonnet 4.5. La generazione deve stare nei 150 s di una Edge Function e i `max_tokens` restano calcolabili sulla sola risposta;
   - `effort` `high` esplicito, il livello più alto che `between_tools` ammette e il default dell'API;
   - fallback lato server sui rifiuti (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): ripete su un altro modello i rifiuti che il server sa ripetere. Il modello effettivo resta tracciato da `response.model`;
   - della risposta si leggono solo i blocchi `text`.
3. **Feedback con output strutturato**: `output_config.format` con il JSON Schema che prima era lo schema dello strumento (`buildFeedbackSchema`, ancora con gli argomenti limitati a quelli della settimana). La risposta valida ha `stop_reason` `end_turn` e il JSON nel testo; la validazione lato server resta invariata. Un rifiuto porta subito a `generation_failed`, senza secondo tentativo.
4. **`max_tokens` per il nuovo tokenizer**:
   - generazione `settimane × 5200 + 2600` (al massimo 23 400 con 4 settimane), con un tetto di 26 000 in `claude-proxy`;
   - feedback 4000.
5. **Rifiuto nella generazione**: il client mostra «Claude ha rifiutato la richiesta» e salva la generazione come fallita.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- `between_tools` esiste solo su Claude Sonnet 5.5. Prima di aggiungere un altro modello all'elenco vanno adattati i parametri comuni.
- Le durate per settimana del piano ([integrazioni.md](../integrazioni.md#claude-generazione-delle-sedute)) e i nuovi `max_tokens` vanno riverificati sulle prime generazioni reali, guardando `usage.output_tokens` salvato in `plan_generations`.
- Ordine di pubblicazione: migrazione, poi `claude-proxy` e `weekly-feedback`, poi l'app (il nuovo `planMaxTokens` supera il vecchio tetto di 20 000). Tutto prima del 30 novembre 2026.
