# Integrazioni

**Quando leggerlo**: prima di toccare la sincronizzazione Intervals.icu, i prompt/chiamate a Claude, o l'invio email via Resend.

## Intervals.icu

Ogni atleta può avere una `integrations.intervals_icu_api_key` personale (vedi [modello-dati.md](modello-dati.md)), salvata in chiaro (vedi [sicurezza.md](sicurezza.md)). Autenticazione verso l'API con **Basic auth**, username letterale `API_KEY` e password la chiave dell'atleta.

Due endpoint usati, entrambi su `https://intervals.icu/api/v1/athlete/0/...`:
- `wellness?oldest=&newest=`: restituisce CTL/ATL giornalieri (`id` = data).
- `activities?oldest=&newest=`: restituisce le attività svolte, usate per contare gli allenamenti al giorno (`workouts_count`).

**Logica di merge** (`refreshFromIntervalsIcu` in `services/intervals.ts`, duplicata in `weekly-feedback` — vedi [backend.md](backend.md)): per ogni voce wellness con `ctl`/`atl` validi, se esiste già una voce nel log per quella data con `source: "manual"` viene **lasciata intatta** (non sovrascritta); altrimenti viene scritta/aggiornata con `source: "intervals_icu_sync"`, `tsb` ricalcolato (`round((ctl − atl) × 10) / 10`) e `workouts_count` dal conteggio attività dello stesso giorno.

**Finestra di sincronizzazione**: da un giorno dopo l'ultima voce nel log (o 30 giorni fa se il log è vuoto) fino ad oggi. Se la finestra risulta vuota (`oldest > newest`, già sincronizzato oggi), la funzione restituisce `upToDate: true` **senza effettuare alcuna chiamata di rete** verso Intervals.icu.

**Quattro trigger di sincronizzazione**:
1. Apertura scheda atleta: `watch` in `AthleteEditor.vue` (non lo store) — vedi [architettura.md](architettura.md).
2. Pulsante esplicito "Sincronizza" nella scheda.
3. Dopo il salvataggio della scheda, se è stata modificata la chiave Intervals.icu.
4. Lato server, dentro la Edge Function `weekly-feedback`, prima di generare il confronto piano/reale — vedi [backend.md](backend.md).

Errori gestiti esplicitamente: chiave non valida (401 → messaggio dedicato), altri errori HTTP, errori di rete/CORS. In caso di errore, un toast generico informa il coach senza bloccare il resto della UI.

**Limite noto**: nessun retry/backoff sui rate limit di Intervals.icu — vedi [limiti-roadmap.md](limiti-roadmap.md).

## Claude (generazione piano)

Flusso: `planPrompt.ts` costruisce il prompt → `services/claude.ts` (`callClaudeProxy`) → Edge Function `claude-proxy` (vedi [backend.md](backend.md)) → `api.anthropic.com`.

**Contesto atleta inviato a Claude** (`buildAthleteContextForPrompt`): identità, discipline, ultima soglia nota per sport (running/cycling/swimming), stato di allenamento — incluso `detraining_period`, `lifestyle_factors`/`lifestyle_factors_note` e il log CTL/ATL/TSB degli ultimi 30 giorni —, obiettivi, vincoli, preferenze metodologiche, note libere.

**Placeholder del template prompt** (sostituiti da `buildPlanPrompt`): `{{settimane}}`, `{{nome_atleta}}`, `{{contesto_atleta_json}}`, `{{formato_training_plan_json}}`.

**`max_tokens`**: calcolato lato client come `min(64000, settimane × 1800 + 2000)` (`AthleteEditor.vue`), per scalare lo spazio di risposta in proporzione alla lunghezza del piano richiesto invece di un valore fisso — vedi [decisioni/0004-fase-1-2-decisioni-minori.md](decisioni/0004-fase-1-2-decisioni-minori.md) per il contesto storico e il CHANGELOG per il fix che ha introdotto la formula.

**`stop_reason`**: propagato da `claude-proxy` fino al client (`callClaudeProxy` imposta `truncated: true` quando `stop_reason === "max_tokens"`), per distinguere un piano troncato per limite di token da un JSON malformato restituito da Claude — mostrato al coach con un toast persistente invece di un errore generico silenzioso.

**Fallback senza chiave configurata**: se `app_settings.claude_api_key` non è impostata, il prompt viene copiato negli appunti invece di essere inviato.

## Claude (feedback settimanale)

Stesso pattern di chiamata (stesso endpoint Anthropic, stessa forma di richiesta/risposta), ma invocato interamente lato server dentro `weekly-feedback` con `max_tokens` **fisso a 1024** — vedi [backend.md](backend.md). Placeholder del template: `{{nome_atleta}}`, `{{settimana_pianificata_json}}`, `{{settimana_reale_json}}`.

## Resend (email)

Invio tramite l'interfaccia astratta `EmailSender` (`supabase/functions/_shared/emailSender.ts`), con unica implementazione `ResendEmailSender`. Attivo solo se `app_settings.weekly_feedback_email_enabled` è vero **e** sono presenti sia `RESEND_API_KEY` sia `RESEND_FROM_ADDRESS` nelle env della Edge Function — altrimenti l'invio viene saltato (non è un errore bloccante per il feedback). Motivazione della scelta di un'interfaccia astratta in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
