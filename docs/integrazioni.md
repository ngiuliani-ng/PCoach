# Integrazioni

**Quando leggerlo**: prima di toccare la sincronizzazione Intervals.icu, i prompt/chiamate a Claude, o l'invio email via Resend.

## Intervals.icu

Ogni atleta può avere una `integrations.intervals_icu_api_key` personale (vedi [modello-dati.md](modello-dati.md)), salvata in chiaro (vedi [sicurezza.md](sicurezza.md)). Autenticazione verso l'API con **Basic auth**, username letterale `API_KEY` e password la chiave dell'atleta.

Due endpoint usati, entrambi su `https://intervals.icu/api/v1/athlete/0/...`:
- `wellness?oldest=&newest=`: restituisce CTL/ATL giornalieri (`id` = data).
- `activities?oldest=&newest=`: restituisce le attività svolte, usate per contare gli allenamenti al giorno (`workouts_count`).

**Logica di merge** (`refreshFromIntervalsIcu` in `services/intervals.ts`, duplicata in `weekly-feedback` — vedi [backend.md](backend.md)): per ogni voce wellness con `ctl`/`atl` validi, se esiste già una voce nel log per quella data con `source: "manual"` viene **lasciata intatta** (non sovrascritta); altrimenti viene scritta/aggiornata con `source: "intervals_icu_sync"`, `tsb` ricalcolato (`round((ctl − atl) × 10) / 10`) e `workouts_count` dal conteggio attività dello stesso giorno.

**Finestra di sincronizzazione**: da un giorno dopo l'ultima voce nel log (o 30 giorni fa se il log è vuoto) fino ad oggi. Se la finestra risulta vuota (`oldest > newest`, già sincronizzato oggi), la funzione restituisce `upToDate: true` **senza effettuare alcuna chiamata di rete** verso Intervals.icu.

**Quattro trigger di sincronizzazione del carico** (coordinati da `composables/useIntervalsSync.ts`: niente chiamate concorrenti sullo stesso atleta):
1. Apertura della scheda atleta: `watch` in `AthleteEditor.vue` (non lo store) — vedi [architettura.md](architettura.md).
2. Inserimento o modifica della chiave Intervals.icu nel Profilo, dopo 1,5 s dall'ultima digitazione.
3. Avvio di una generazione o rigenerazione delle sedute (`RegenerateDialog.vue`), così Claude riceve il carico aggiornato.
4. Lato server, dentro la Edge Function `weekly-feedback`, prima di generare il confronto piano/reale — vedi [backend.md](backend.md).

Errori gestiti esplicitamente: chiave non valida (401), altri errori HTTP, errori di rete/CORS. L'esito compare come stato accanto al campo della chiave nel Profilo («Chiave valida.», «Chiave non valida…», «Non verificabile ora…»), senza bloccare il resto dell'interfaccia.

**Limite noto**: nessun retry/backoff sui rate limit di Intervals.icu nelle letture del carico — vedi [limiti-roadmap.md](limiti-roadmap.md). La scrittura delle sedute invece li ha (sezione seguente).

## Intervals.icu: sincronizzazione delle sedute

Il pulsante «Sincronizza settimana» della tab Piano invia le sedute approvate al calendario Intervals.icu dell'atleta, attraverso la Edge Function `intervals-sync` (contratto in [backend.md](backend.md#intervals-sync-edge-function)).

**API usate** (verificate nella specifica OpenAPI ufficiale, `https://intervals.icu/api/v1/docs`, il 2026-10-10), tutte su `/api/v1/athlete/0/...`:
- `GET events?oldest&newest&category=WORKOUT`: eventi della settimana, con `id`, `external_id` e `updated`;
- `GET events/{id}`: evento memorizzato fuori dalla settimana (404 = sparito);
- `POST events`: creazione;
- `PUT events/{id}`: aggiornamento, anche della data;
- `DELETE events/{id}`: rimozione;
- `GET activities`: il campo `paired_event_id` indica l'evento svolto.

**Limite delle chiavi API personali**: `POST events/bulk?upsert=true` e `PUT events/bulk-delete` agiscono per `external_id` solo sugli eventi «created by the same OAuth application». PCoach usa la chiave API di ogni atleta, non un'applicazione OAuth, quindi memorizza `remote_event_id` e opera per id. `external_id` (`pcoach:<id seduta>`) resta valorizzato e serve alla riconciliazione.

**Conversione** (`_shared/workouts/intervals.ts`, la stessa usata per l'anteprima nel pannello della seduta):

| PCoach | Evento Intervals.icu |
|---|---|
| `discipline` | `type`: `Run`, `Ride`, `Swim`, `WeightTraining` |
| `planned_date` | `start_date_local` = data + `T00:00:00` |
| `title` | `name` |
| note e struttura | `description`: note, riga vuota, testo del workout |
| durata e distanza | `moving_time` solo se tutti gli step sono a tempo; `distance` solo se tutti sono a distanza; altrimenti le calcola Intervals.icu |
| `primary_target` | `target`: `POWER`, `HR`, `PACE` |

Sintassi del testo, dal workout builder documentato sul forum di Intervals.icu:
- uno step per riga, come `- Riscaldamento 15m Z1-Z2`; l'indicazione precede la durata;
- `m` significa minuti; le distanze si scrivono `2km` o `400mtr`;
- le zone sono di potenza senza suffisso, altrimenti `Z2 HR` o `Z2 Pace`;
- una ripetuta ha un'intestazione `Serie principale 4x`, con una riga vuota prima e una dopo.

Le zone si riferiscono a quelle impostate sull'account Intervals.icu dell'atleta (FTP, LTHR, passo soglia, CSS). Dopo ogni invio la funzione confronta il numero di step letti da Intervals.icu (`workout_doc.steps`) con quelli attesi. Se differiscono, salva un avviso (`last_warning`) che compare nel pannello della seduta.

**Regole della settimana** (classificazione in `_shared/workouts/sync.ts`):
- **Bozza**: non si invia ed è elencata come esclusa.
- **Bloccata**: struttura non valida o da verificare; si indica il motivo.
- **Approvata mai inviata**: si crea. Prima si cercano tra gli eventi del giorno l'`external_id` e, se un tentativo precedente non ha avuto risposta (`create_uncertain`), nome e tipo, per non duplicare.
- **Modificata o spostata dopo l'invio**, oppure **invio precedente fallito**: si aggiorna per id.
- **Modificata su Intervals.icu** (`updated` diverso dall'ultimo noto): conflitto. Il coach sceglie se sovrascrivere o lasciarla com'è; non c'è mai sovrascrittura silenziosa.
- **Sparita da Intervals.icu**: il coach sceglie se ricrearla.
- **Annullata o sostituita, ancora su Intervals.icu**: la rimozione è preselezionata, elencata a parte e contata nel pulsante di conferma.
- **Svolta**: non si modifica né si rimuove.
- **Invariata**: nessuna operazione.

Eliminare o annullare una seduta in PCoach non rimuove mai da solo l'evento remoto.

**Esecuzione**: un'operazione per seduta, in sequenza, con timeout e nuovi tentativi (vedi [backend.md](backend.md#intervals-sync-edge-function)). L'esito è mostrato riga per riga, con «Riprova» solo sulle non riuscite.

## Claude (generazione delle sedute)

Flusso: `RegenerateDialog.vue` → `planPrompt.ts` costruisce il prompt → `services/claude.ts` (`callClaudeProxy`) → Edge Function `claude-proxy` (vedi [backend.md](backend.md)) → `api.anthropic.com`. La risposta viene salvata in `plan_generations` e letta da `parseProposal` (`domain/regeneration.ts`):
- se `day` e `date` non coincidono, porta la data al giorno indicato (entro tre giorni) e lo segnala tra gli avvisi;
- scarta le sedute fuori dal periodo richiesto;
- assegna la metrica dei target per disciplina;
- con `availabilityIssues` (`domain/availability.ts`) segna «da verificare» (`needs_review`) le sedute in un giorno non disponibile, o che fanno superare la durata massima del giorno contando anche le sedute mantenute. Il motivo compare sotto la seduta nell'anteprima, e la seduta non si approva finché il coach non la rivede.

Il coach la vede come anteprima delle differenze prima di applicarla (vedi [architettura.md](architettura.md#flussi-principali)).

**Calendario esplicito**: Claude sbaglia a ricavare il giorno della settimana da una data. Verificato il 2026-10-10: piani interi sfalsati di un giorno, anche verso giorni non disponibili. Per questo il prompt non chiede mai a Claude di fare questo calcolo. `planningCalendar` gli passa ogni data del periodo con il giorno, la disponibilità, la durata massima e l'attività abituale; Claude copia `date` e `day` dal calendario, e il controllo sopra rimedia agli errori residui.

**Contesto atleta inviato a Claude** (`buildAthleteContextForPrompt`):
- identità e discipline;
- ultima soglia nota per sport (running/cycling/swimming);
- stato di allenamento, incluso `detraining_period`, `lifestyle_factors`/`lifestyle_factors_note` e il log CTL/ATL/TSB degli ultimi 30 giorni;
- obiettivi, vincoli, preferenze metodologiche, note libere;
- le sedute delle due settimane precedenti la data d'inizio, con l'esito (svolta, non svolta).

**Placeholder del template prompt** (sostituiti da `buildPlanPrompt`): `{{settimane}}`, `{{nome_atleta}}`, `{{contesto_atleta_json}}`, `{{formato_training_plan_json}}`, `{{data_inizio}}`, `{{data_fine}}`, `{{calendario_json}}` (ogni data del periodo con `giorno`, `disponibile`, `durata_massima_min`, `attivita_abituale`), `{{sedute_fisse_json}}` (sedute mantenute o svolte nel periodo, da non ripetere, con il giorno della settimana), `{{motivo}}`. Se un template personalizzato non contiene periodo, calendario, sedute fisse e formato, questi vengono aggiunti in fondo.

**Formato richiesto** (`TRAINING_PLAN_JSON_SHAPE`): `plan_name`, `weeks[]` (`week_start`, `label`, `is_deload`) e `workouts[]`. Ogni seduta ha `date` e `day` (copiati dal calendario), `discipline`, `title`, `objective`, `notes`, `duration_min` (solo palestra) e `steps[]` (step con `duration_sec` o `distance_m` e `zone`/`zone_to` da Z1 a Z7; ripetute con `count` e `steps`). Claude indica solo zone: la metrica la sceglie PCoach.

**Generazione a blocchi**: una chiamata a `claude-proxy` non può durare più di 150 secondi (limite delle Edge Function; oltre, Supabase interrompe la funzione e risponde 546), e Claude impiega circa 25 secondi per settimana di sedute. Il dialogo divide quindi il periodo in blocchi consecutivi di al massimo 3 settimane, di lunghezza il più possibile uguale (`domain/planBlocks.ts`; 10 settimane diventano 3 + 3 + 2 + 2), e li chiede in sequenza mostrando la parte in corso. Ogni prompt indica la posizione del blocco nel piano complessivo e riceve tra le sedute recenti quelle proposte dai blocchi precedenti; le sedute mantenute passano al blocco in cui cadono. Le risposte vengono riunite in un'unica proposta (`mergeBlockResponses`), salvata e mostrata come una sola. Se un blocco fallisce, la generazione è segnata «fallita» con il numero della parte. Il prompt copiato negli appunti, senza chiave configurata, resta unico.

**`max_tokens`**: calcolato lato client per ogni blocco come `min(64000, settimane del blocco × 1800 + 2000)` (`RegenerateDialog.vue`), per scalare lo spazio di risposta in proporzione alla lunghezza del piano richiesto invece di un valore fisso — vedi [decisioni/0004-fase-1-2-decisioni-minori.md](decisioni/0004-fase-1-2-decisioni-minori.md) per il contesto storico e il CHANGELOG per il fix che ha introdotto la formula.

**`stop_reason`**: propagato da `claude-proxy` fino al client (`callClaudeProxy` imposta `truncated: true` quando `stop_reason === "max_tokens"`), per distinguere un piano troncato per limite di token da un JSON malformato restituito da Claude — mostrato al coach con un toast persistente invece di un errore generico silenzioso.

**Fallback senza chiave configurata**: se `app_settings.claude_api_key` non è impostata, il prompt viene copiato negli appunti invece di essere inviato. Il dialogo mostra il prompt e un campo in cui incollare la risposta di Claude, che segue poi lo stesso percorso (salvataggio della proposta, anteprima, applicazione).

## Claude (feedback settimanale)

Stesso pattern di chiamata (stesso endpoint Anthropic, stessa forma di richiesta/risposta), ma invocato interamente lato server dentro `weekly-feedback` con `max_tokens` **fisso a 1024** — vedi [backend.md](backend.md). Placeholder del template: `{{nome_atleta}}`, `{{settimana_pianificata_json}}`, `{{settimana_reale_json}}`.

## Resend (email)

Invio tramite l'interfaccia astratta `EmailSender` (`supabase/functions/_shared/emailSender.ts`), con unica implementazione `ResendEmailSender`. Attivo solo se `app_settings.weekly_feedback_email_enabled` è vero **e** sono presenti sia `RESEND_API_KEY` sia `RESEND_FROM_ADDRESS` nelle env della Edge Function — altrimenti l'invio viene saltato (non è un errore bloccante per il feedback). Motivazione della scelta di un'interfaccia astratta in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
