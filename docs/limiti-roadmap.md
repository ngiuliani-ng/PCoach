# Limiti noti e roadmap

**Quando leggerlo**: prima di proporre una modifica che tocchi autenticazione, sicurezza delle chiavi, modello dati, o per capire se un comportamento "strano" osservato è un limite già noto.

## Autenticazione mono-utente

Un solo utente coach, creato manualmente da dashboard Supabase — vedi [sicurezza.md](sicurezza.md). Nessuna gestione di più coach, ruoli, o permessi differenziati: `is_coach()` è un confronto diretto con un unico UUID letterale. Estendere a più coach richiederebbe ripensare RLS da "singolo UUID" a "tabella di utenti autorizzati".

## Nessuna cifratura applicativa delle chiavi API

`intervals_icu_api_key` e `claude_api_key` sono in chiaro nel database (cifrate solo a livello di infrastruttura Supabase). Compromesso accettato per un'app mono-utente — dettagli e motivazione in [sicurezza.md](sicurezza.md).

## `ERR_ABORTED` su richieste HEAD (Chromium)

Durante lo sviluppo si osservano in console errori `net::ERR_ABORTED` su richieste HEAD verso Supabase. Verificato trattarsi di un artefatto innocuo di Chromium (il browser annulla proattivamente richieste HEAD di probing che poi non servono), non un problema applicativo: le richieste GET/POST effettive completano correttamente e i dati arrivano. Nessuna azione necessaria; confermato end-to-end sul backend reale (vedi [CHANGELOG.md](../CHANGELOG.md), voce del fix sulla generazione piano).

## Sezioni di dati volutamente assenti

Il modello dati ([modello-dati.md](modello-dati.md)) non include deliberatamente: dati sanitari sensibili, storico infortuni dettagliato, dati biometrici continui (es. HRV giornaliero). Scelta di perimetro per un'app di programmazione dell'allenamento, non una lacuna da colmare.

## Sessioni a piramide (`steps`)

Lo schema di `trainingStep` (vedi [modello-dati.md](modello-dati.md)) supporta `warmup`/`cooldown`/`block`/`repeat`, ma non una struttura nativa per sessioni "a piramide" (es. 1-2-3-2-1 minuti): vanno modellate come una sequenza di `block` espliciti, oppure descritte in testo libero (`notes`/`description`), non con un `kind` dedicato.

## Rate limit Intervals.icu

Nessun retry/backoff automatico se Intervals.icu risponde con un rate limit: l'errore viene mostrato al coach, che può ritentare manualmente (pulsante "Sincronizza" o riapertura scheda). Vedi [integrazioni.md](integrazioni.md) per i trigger di sincronizzazione.

## Rischio di sovrascrittura su blob `jsonb`

Ogni scheda atleta è un unico blob `jsonb` (`athletes.data`). Il salvataggio scrive l'intero blob, non singoli campi. **Mitigazione**: controllo di concorrenza ottimistico su `updated_at` (vedi [backend.md](backend.md) e [decisioni/0005-concorrenza-ottimistica-sync-mirata.md](decisioni/0005-concorrenza-ottimistica-sync-mirata.md)) — un salvataggio concorrente che trova `updated_at` cambiato viene rifiutato con avviso, invece di sovrascrivere silenziosamente. Resta un rischio se due modifiche avvengono a schermi diversi senza ricaricare: l'ultima a salvare "vince" solo se nessun'altra scrittura è intervenuta nel frattempo.
