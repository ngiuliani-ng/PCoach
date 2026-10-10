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

## Struttura delle sedute

La struttura v2 (vedi [modello-dati.md](modello-dati.md#sedute-e-piani)) ha queste limitazioni:
- **Ripetute annidate**: non sono ammesse (come su Intervals.icu). Una piramide, ad esempio 1-2-3-2-1 minuti, si scrive come sequenza di step.
- **Target**: solo zone 1-7, con una metrica per seduta. Niente watt, passi assoluti o percentuali, e niente step con metriche diverse nella stessa seduta.
- **Rampe e cadenza**: non sono modellate.
- **Palestra**: è testo libero più una durata.

Le zone sono quelle impostate sull'account Intervals.icu dell'atleta, che PCoach non legge né confronta con le soglie della scheda.

## Sincronizzazione delle sedute con Intervals.icu

- **Identità remota per id**: con le chiavi API personali le operazioni per `external_id` non sono disponibili (vedi [integrazioni.md](integrazioni.md#intervalsicu-sincronizzazione-delle-sedute)). Se un evento viene cancellato su Intervals.icu e ricreato a mano, PCoach lo vede come sparito e propone di ricrearlo.
- **Da verificare con un account di prova**:
  - se `external_id` viene conservato per gli eventi creati con chiave API (la riconciliazione dopo un timeout lo usa per primo e, in mancanza, ripiega su nome e tipo nel giorno);
  - come Intervals.icu interpreta il testo per nuoto e palestra.

  L'avviso sul numero di step letti segnala i casi anomali.
- **Una settimana alla volta**: niente sincronizzazione automatica né di più settimane insieme, per scelta: ogni scrittura sul calendario dell'atleta passa da un'anteprima confermata.

## Rate limit Intervals.icu

La lettura del carico (wellness e attività) non ha retry/backoff: l'errore compare come stato accanto alla chiave nel Profilo e la sincronizzazione si ripete alla prossima apertura della scheda. La scrittura delle sedute invece riprova da sola su 429 e 5xx (vedi [backend.md](backend.md#intervals-sync-edge-function)). Vedi [integrazioni.md](integrazioni.md) per i trigger di sincronizzazione.

## Piano salvato nella scheda (`training_plan`)

Dopo l'import nelle tabelle delle sedute, `training_plan` resta nella scheda come copia d'origine e non viene più scritto né mostrato. Va rimosso dallo schema (con una migrazione del profilo) quando l'import di tutti gli atleti è verificato. Fino ad allora `weekly-feedback` lo legge solo per gli atleti non ancora importati.

## Rischio di sovrascrittura su blob `jsonb`

Ogni scheda atleta è un unico blob `jsonb` (`athletes.data`). Il salvataggio scrive l'intero blob, non singoli campi. **Mitigazione**: controllo di concorrenza ottimistico su `updated_at` (vedi [backend.md](backend.md) e [decisioni/0005-concorrenza-ottimistica-sync-mirata.md](decisioni/0005-concorrenza-ottimistica-sync-mirata.md)) — un salvataggio concorrente che trova `updated_at` cambiato viene rifiutato con avviso, invece di sovrascrivere silenziosamente. Resta un rischio se due modifiche avvengono a schermi diversi senza ricaricare: l'ultima a salvare "vince" solo se nessun'altra scrittura è intervenuta nel frattempo. Le sedute non sono in questo blob: hanno tabelle e revisioni proprie (vedi [modello-dati.md](modello-dati.md#sedute-e-piani)).
