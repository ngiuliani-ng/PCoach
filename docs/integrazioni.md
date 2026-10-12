# Integrazioni

**Quando leggerlo**: prima di toccare la sincronizzazione Intervals.icu, i prompt/chiamate a Claude, o l'invio email via Resend.

## Intervals.icu

Ogni atleta può avere una `integrations.intervals_icu_api_key` personale (vedi [modello-dati.md](modello-dati.md)), salvata in chiaro (vedi [sicurezza.md](sicurezza.md)). Autenticazione verso l'API con **Basic auth**, username letterale `API_KEY` e password la chiave dell'atleta.

Due endpoint usati, entrambi su `https://intervals.icu/api/v1/athlete/0/...`:
- `wellness?oldest=&newest=`: restituisce i dati giornalieri (`id` = data). Il carico usa CTL e ATL; il feedback anche HRV, frequenza a riposo e sonno.
- `activities?oldest=&newest=`: restituisce le attività svolte. Il carico le usa per contare gli allenamenti al giorno (`workouts_count`), il feedback per l'abbinamento con le sedute.

**Logica di merge** (`refreshFromIntervalsIcu` in `services/intervals.ts`): per ogni voce wellness con `ctl`/`atl` validi, se esiste già una voce nel log per quella data con `source: "manual"` viene **lasciata intatta** (non sovrascritta); altrimenti viene scritta/aggiornata con `source: "intervals_icu_sync"`, `tsb` ricalcolato (`round((ctl − atl) × 10) / 10`) e `workouts_count` dal conteggio attività dello stesso giorno.

**Finestra di sincronizzazione**: gli ultimi 14 giorni fino a oggi (`RESYNC_DAYS`), oppure dal giorno dopo l'ultima voce se il log è più vecchio, oppure 30 giorni se è vuoto (`syncWindowStart`). Gli ultimi giorni si rileggono sempre perché un'attività caricata in ritardo cambia il carico dei giorni già salvati. Se nessuna voce cambia, la funzione restituisce `upToDate: true` e la scheda non viene riscritta.

**Tre trigger di sincronizzazione del carico** (coordinati da `composables/useIntervalsSync.ts`: niente chiamate concorrenti sullo stesso atleta):
1. Apertura della scheda atleta: `watch` in `AthleteEditor.vue` (non lo store) — vedi [architettura.md](architettura.md).
2. Inserimento o modifica della chiave Intervals.icu nel Profilo, dopo 1,5 s dall'ultima digitazione.
3. Avvio di una generazione o rigenerazione delle sedute (`RegenerateDialog.vue`), così Claude riceve il carico aggiornato.

Il feedback settimanale non usa il log della scheda: legge carico e benessere direttamente da Intervals.icu al momento della valutazione.

**Sedute svolte all'apertura della scheda**: dopo il caricamento delle sedute, l'app legge le attività degli ultimi 14 giorni (`fetchActivities`) e segna come svolte le sedute approvate abbinate con certezza: evento abbinato su Intervals.icu (`paired_event_id`), oppure stesso giorno e stessa disciplina con una sola coppia possibile (`recentCompletions` in `_shared/feedback/completion.ts`, la stessa regola dell'analisi del feedback). Con la seduta si salvano l'esito rispetto al prescritto (sotto `completed_min_pct` è «Svolta in parte») e i dati dell'attività: minuti, metri, carico e RPE. Per le sedute già svolte nella stessa finestra i dati dell'attività vengono riletti, così un RPE inserito più tardi dall'atleta arriva comunque in PCoach. Gli abbinamenti incerti (più sedute nello stesso giorno, spostamenti, sostituzioni) restano «Non registrata». Su Intervals.icu è solo una lettura: su Intervals.icu non si scrive nulla, e un errore lascia le sedute come sono.

Errori gestiti esplicitamente: chiave non valida (401), altri errori HTTP, errori di rete/CORS. L'esito compare come stato accanto al campo della chiave nel Profilo («Chiave valida.», «Chiave non valida…», «Non verificabile ora…»), senza bloccare il resto dell'interfaccia.

**Limite noto**: nessun retry/backoff sui rate limit di Intervals.icu nelle letture del carico — vedi [limiti-roadmap.md](limiti-roadmap.md). La scrittura delle sedute invece li ha (sezione seguente).

## Intervals.icu: zone dell'atleta

All'apertura della scheda `useAthleteAnomalies.ts` legge le zone dell'atleta su Intervals.icu (`intervals-sync`, azione `zones_read`, contratto in [backend.md](backend.md#intervals-sync-edge-function)) e le confronta con il profilo salvato (`zoneChecks` in `_shared/workouts/zoneModels.ts`). Decisioni in [decisioni/0029](decisioni/0029-zone-allineate-con-intervals.md).

- **Cosa si confronta**: per ogni disciplina praticata, il numero di zone della misura con cui PCoach prescrive le sedute (bici: potenza con l'FTP, altrimenti FC; corsa e nuoto: passo) e il sistema di zone della scheda (il nuoto ne ha sempre 7).
- **Anomalia**: se una disciplina non coincide, la tab «Anomalie» della scheda ([design-ui.md](design-ui.md#tab-anomalie)) mostra «Zone della corsa diverse da Intervals.icu» (o della bici, del nuoto) con due azioni, ciascuna dopo una conferma:
  - «Usa N zone in PCoach» cambia il sistema di zone della scheda e la salva. È possibile solo con 3, 5 o 7 zone su Intervals.icu, non per il nuoto, e non con modifiche della scheda non salvate;
  - «Porta Intervals.icu a N zone» scrive su Intervals.icu i limiti del modello scelto in Impostazioni («Zone su Intervals.icu»), mostrati nella conferma (azione `zones_apply`). La FC si calcola in bpm dalla FC di soglia e dalla FC massima registrate su Intervals.icu.
- **Errori**: se la lettura non riesce, zone e soglie non compaiono tra le anomalie (una chiave non valida ha la sua); se la scrittura non riesce, l'anomalia resta e compare il messaggio di Intervals.icu.
- **Feedback settimanale**: parte solo con zone e soglie allineate e con le soglie della scheda presenti; altrimenti la valutazione si ferma con il dettaglio delle discipline e riparte con «Riprova» ([backend.md](backend.md#weekly-feedback-edge-function)).
- **Soglie** ([decisioni/0030](decisioni/0030-soglie-allineate-e-stima-della-durata.md)): con le zone, la scheda confronta l'ultima rilevazione della scheda con la soglia su Intervals.icu (`thresholdChecks` in `_shared/workouts/thresholds.ts`). Corsa: passo di soglia; nuoto: CSS; bici: FTP, se la scheda lo ha. Tolleranza: 1 s/km, 1 s/100 m, 1 W. Se non coincidono l'anomalia «Soglia della corsa diversa da Intervals.icu» (o della bici, del nuoto) ha «Aggiorna Intervals.icu», che dopo una conferma scrive il valore della scheda (azione `threshold_apply`). Se per uno sport praticato la scheda non ha il passo di soglia o la CSS, l'anomalia «Manca …» porta alle soglie nel Profilo, anche senza chiave Intervals.icu.
- **Cambio del sistema di zone in PCoach** (dal Profilo o con «Usa N zone in PCoach»): se ci sono sedute da svolgere della disciplina da oggi compreso, una conferma dice quante sono. Se il coach procede, tornano «Da verificare» con il motivo, e le loro zone vanno adattate a mano (`useZoneChange.ts`, `domain/zoneChange.ts`).

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

Flusso: `RegenerateDialog.vue` → `planPrompt.ts` costruisce il prompt → `services/claude.ts` (`callClaudeProxy`) → Edge Function `claude-proxy` (vedi [backend.md](backend.md)) → `api.anthropic.com`. Dalla risposta `extractJsonBlock` estrae il JSON (blocco ```` ```json ````, testo intero, oppure dalla prima `{` all'ultima `}` se c'è testo intorno). La risposta viene salvata in `plan_generations` e letta da `parseProposal` (`domain/regeneration.ts`):
- se `day` e `date` non coincidono, porta la data al giorno indicato (entro tre giorni) e lo segnala tra gli avvisi;
- scarta le sedute fuori dal periodo richiesto;
- assegna la metrica dei target per disciplina;
- con `availabilityIssues` (`domain/availability.ts`) segna «da verificare» (`needs_review`) le sedute in un giorno non disponibile, o che fanno superare la durata massima del giorno contando anche le sedute mantenute. Il motivo compare sotto la seduta nell'anteprima, e la seduta non si approva finché il coach non la rivede;
- segna «da verificare» le sedute con zone oltre il sistema dell'atleta («Usa la zona Z5, oltre le 3 zone impostate per la bici»);
- segna «da verificare» anche le sedute con la struttura incompleta (step senza durata o zona, seduta senza step), invece di lasciarle passare;
- con `weeklyIssues` (`domain/planChecks.ts`, decisione in [decisioni/0022](decisioni/0022-gare-tapering-controlli-proposta.md)) aggiunge agli avvisi le settimane complete con un numero di sedute diverso da `sessions_per_week_target` e quelle con una variazione di volume rispetto alla precedente fuori da quella attesa per la fase (percentuali dell'atleta, tolleranza di 5 punti). Sono solo avvisi: tapering, gara e raccordo non si controllano.

Nel pannello della seduta, salvare una modifica ricontrolla disponibilità, durata massima del giorno e zone; approvare una seduta che non li rispetta chiede conferma. L'editor della struttura propone solo le zone del sistema dell'atleta per quella disciplina.

Il coach la vede come anteprima delle differenze prima di applicarla (vedi [architettura.md](architettura.md#flussi-principali)). Riaprendo il dialogo si riprende l'ultima proposta non applicata, salvo che parta da una data già passata: in quel caso viene scartata, perché applicarla sostituirebbe sedute dei giorni trascorsi. Una richiesta rimasta senza risposta da oltre 30 minuti viene chiusa come fallita alla generazione successiva.

**Calendario esplicito**: Claude sbaglia a ricavare il giorno della settimana da una data. Verificato il 2026-10-10: piani interi sfalsati di un giorno, anche verso giorni non disponibili. Per questo il prompt non chiede mai a Claude di fare questo calcolo. `planningCalendar` gli passa ogni data del periodo con il giorno, la disponibilità, la durata massima e l'attività abituale; Claude copia `date` e `day` dal calendario, e il controllo sopra rimedia agli errori residui.

**Contesto atleta inviato a Claude** (`buildAthleteContextForPrompt`):
- identità ridotta (decisione in [decisioni/0025](decisioni/0025-sistema-di-zone-e-dati-personali-a-claude.md)): solo il nome di battesimo, l'età calcolata dall'anno di nascita, sesso, altezza e peso; né cognome, né anno di nascita, né email. Anche nel messaggio e in `{{nome_atleta}}` l'atleta è chiamato per nome;
- discipline;
- `zone_per_disciplina`: il numero di zone del sistema dell'atleta (corsa e bici dal loro `zone_system`, nuoto 7); una regola fissa chiede di usare solo le zone da Z1 a quel numero;
- ultima soglia nota per sport (running/cycling/swimming);
- stato di allenamento, incluso `detraining_period`, `lifestyle_factors`/`lifestyle_factors_note` e il log CTL/ATL/TSB degli ultimi 30 giorni;
- obiettivi, vincoli, preferenze metodologiche, note libere;
- le sedute approvate delle due settimane precedenti la data d'inizio, con l'esito (svolta, svolta in parte, nessuna attività registrata, in programma) e, se riconosciute da Intervals.icu, minuti svolti e RPE;
- le ultime due analisi settimanali concluse prima della data d'inizio, anche non approvate (`recent_reviews`, `reviewSummaryForPrompt`): conteggi delle sedute, tasso di completamento se comunicabile, volume per disciplina con lo scostamento, variazione di volume se confrontabile, RPE medio e copertura, limitazioni. Solo dati calcolati, mai il testo del feedback; un contratto incompleto viene tralasciato.

**Istruzioni e messaggio** (`buildPlanPrompt`, decisione in [decisioni/0020](decisioni/0020-generazione-istruzioni-separate-tracciabilita.md)):
- **istruzioni di sistema**: regole fisse nel codice (`PLAN_RULES`: giorni disponibili, durata massima del giorno, attività abituale come preferenza, sedute a settimana, distribuzione dell'intensità, zone del sistema dell'atleta, fase e variazione di carico, sedute fisse) e formato della risposta, seguite dalle **preferenze metodologiche del coach** (Impostazioni, colonna `plan_generation_prompt_template`; predefinite in `DEFAULT_PLAN_PREFERENCES`), presentate come non in grado di cambiare regole e formato. Le preferenze possono citare `{{nome_atleta}}`;
- **messaggio**: periodo, contesto dell'atleta, motivo indicato dal coach, calendario e sedute fisse, sempre presenti qualunque siano le preferenze. I dati dell'atleta non sono interpretati come segnaposto.

Le preferenze uguali al predefinito si salvano vuote, così un miglioramento del predefinito arriva anche a chi non le ha cambiate. Un template del vecchio formato (prompt intero con `{{contesto_atleta_json}}`) viene ignorato e sostituito dal predefinito.

**Tracciabilità**: ogni generazione salva in `plan_generations` le istruzioni e il messaggio inviati (`system_prompt`, `user_prompt`), la versione (`prompt_version`, `PLAN_PROMPT_VERSION`), se le preferenze erano quelle predefinite, `max_tokens` e, dalla risposta, modello effettivo, id, `stop_reason` e consumo di token (`usage`).

**Formato richiesto** (`TRAINING_PLAN_JSON_SHAPE`): `plan_name`, `weeks[]` (`week_start`, `label`, `is_deload`) e `workouts[]`. Ogni seduta ha `date` e `day` (copiati dal calendario), `discipline`, `title`, `objective`, `notes`, `duration_min` (solo palestra) e `steps[]` (step con `duration_sec` o `distance_m` e `zone`/`zone_to` da Z1 alla zona massima della disciplina; ripetute con `count` e `steps`). Claude indica solo zone: la metrica la sceglie PCoach. Il JSON va scritto compatto, una seduta per riga, senza i campi null o vuoti, per contenere la lunghezza della risposta.

**Settimane e ciclo di carico** (`domain/planWeeks.ts`, decisione in [decisioni/0018](decisioni/0018-generazione-a-finestre-ciclo-ancorato.md)): le settimane del piano sono settimane di calendario, da lunedì. Se il periodo inizia da lunedì a giovedì, quella settimana è la 1; se inizia da venerdì a domenica, quei giorni sono un raccordo (settimana 0) e la 1 parte dal lunedì successivo. PCoach calcola la fase di ogni settimana dallo schema di carico e scarico dell'atleta (`methodology_preferences.load_deload_pattern`: ad esempio `3:1` dà «carico 1 di 3», «carico 2 di 3», «carico 3 di 3», «scarico») e la passa a Claude nel calendario. Il ciclo prosegue dall'ultima settimana del piano attivo con `cycle_week` noto, fino a quella della data di partenza (`cycleAnchor`); senza piano attivo parte dalla settimana 1 e il raccordo resta fuori dal ciclo. Se lo schema salvato non è nella forma `N:M` la fase resta vuota e la sceglie Claude: il Profilo e il dialogo di generazione lo segnalano. Le regole su come trattare le fasi (carico crescente, scarico di circa un terzo, ripartenza del ciclo successivo) sono nel template predefinito, modificabile in Impostazioni. Nella proposta, scarico e settimana del ciclo di ogni settimana vengono da PCoach (`withPhases`) e l'etichetta da Claude; sono salvati in `weeks_meta` e fanno da ancora per la generazione successiva. **Gare** (decisione in [decisioni/0022](decisioni/0022-gare-tapering-controlli-proposta.md)): la settimana che contiene una gara degli eventi target ha fase «gara» e le `taper_weeks` precedenti (predefinite per priorità: A 2, B 1, C 0) fase «tapering», con la riduzione `taper_volume_decrease_pct` se indicata. In queste settimane il ciclo è sospeso; dopo una gara A riparte da «carico 1», anche se la gara cade fra l'ancora e l'inizio del periodo. Il giorno della gara ha nel calendario il campo `gara` (nome e priorità). Tapering e gara sono salvati come settimane di scarico (`is_deload`), senza `cycle_week`.

**Durata massima**: una generazione copre al massimo 4 settimane (`MAX_PLAN_WEEKS`), in una sola chiamata. Una chiamata a `claude-proxy` non può durare più di 150 secondi (limite delle Edge Function; oltre, Supabase interrompe la funzione e risponde 546, mostrato al coach come superamento del tempo massimo), e Claude impiega circa 25-30 secondi per settimana di sedute per un atleta con circa 8 sedute a settimana. Le settimane successive si aggiungono con «Prosegui il piano»: parte dal giorno dopo la fine del piano attivo o dell'ultima seduta attiva, ma mai prima di domani (`continueFromDate`), non sostituisce nulla e il ciclo prosegue dall'ancora del piano. «Ripianifica da…» resta per sostituire le sedute da una data quando qualcosa cambia.

**`max_tokens`**: `min(64000, settimane × 4000 + 2000)` (`planMaxTokens`), quindi al massimo 18 000 con 4 settimane; `claude-proxy` applica comunque un tetto di 20 000.

**Modello**: solo quelli dell'elenco chiuso `SUPPORTED_MODELS` (`_shared/claude/models.ts`), scelto in Impostazioni; un valore non ammesso torna al predefinito, sia in `claude-proxy` sia in `weekly-feedback`.

**`stop_reason`**: propagato da `claude-proxy` fino al client (`callClaudeProxy` imposta `truncated: true` quando `stop_reason === "max_tokens"`), per distinguere un piano troncato per limite di token da un JSON malformato restituito da Claude — mostrato al coach con un toast persistente invece di un errore generico silenzioso.

**Fallback senza chiave configurata**: se la chiave di Claude non è salvata (`claude_key_configured`), istruzioni e messaggio vengono copiati negli appunti come testo unico (`promptAsText`) invece di essere inviati. Il dialogo mostra il prompt e un campo in cui incollare la risposta di Claude, che segue poi lo stesso percorso (salvataggio della proposta, anteprima, applicazione).

## Claude (feedback settimanale)

Chiamata lato server dentro `weekly-feedback` (contratto in [backend.md](backend.md#weekly-feedback-edge-function)), con le regole in [decisioni/0019](decisioni/0019-feedback-analisi-deterministica-approvazione.md). Moduli in `supabase/functions/_shared/feedback/`.

**Cosa calcola PCoach prima di chiamare Claude** (contratto `feedback_input`, salvato in `weekly_reviews.input`):
- **Periodo**: la settimana di calendario, da lunedì a domenica, con i giorni della settimana già calcolati.
- **Sedute assegnate**: solo quelle approvate, con revisione. Le bozze sono solo contate.
- **Attività normalizzate** (`normalize.ts`):
  - il tipo di Intervals.icu diventa una disciplina;
  - le attività senza dati via API (ad esempio importate da Strava) sono «non disponibili»;
  - due attività della stessa disciplina iniziate entro 5 minuti e con durate entro il 10% sono un doppione: resta quella con più sensori.
- **Abbinamento** (`match.ts`), in ordine di priorità:
  - **R1** evento abbinato su Intervals.icu (`paired_event_id` = `workout_sync.remote_event_id`), confidenza `confirmed`;
  - **R2** stesso giorno e stessa disciplina, coppia unica, `high`;
  - **R3** più sedute e attività nello stesso giorno, abbinate per ordine se le durate sono compatibili, `medium`, altrimenti «ambiguo»;
  - **R4** seduta frazionata in più attività, `medium`;
  - **R5** spostamento entro 2 giorni nella stessa settimana, `low`;
  - **R6** sostituzione con un'altra disciplina nello stesso giorno, che non conta come svolta;
  - **R7** senza attività: «in programma», «dato non disponibile» o «non registrata», mai «non svolta».
- **Esito per seduta**: dal rapporto fra svolto e prescritto, con le soglie di `feedback_params`.
- **Metriche**:
  - conteggi e tasso di completamento con numeratore, denominatore e flag di comunicabilità;
  - volume e carico per disciplina;
  - distribuzione dell'intensità in 3 domini (bassa, media, alta), con la stessa metrica della prescrizione; i domini dipendono dal sistema di zone dell'atleta per quella disciplina, con le soglie per sistema di `feedback_params` ([decisioni/0028](decisioni/0028-domini-d-intensita-per-sistema-di-zone.md));
  - lavoro oltre l'intensità bassa per le sedute di qualità, con le stesse soglie;
  - confronto con la settimana precedente, confrontabile solo se entrambe le settimane sono concluse e dentro un piano, con la variazione attesa ricavata dalle percentuali dell'atleta;
  - CTL e ATL;
  - RPE, HRV, frequenza a riposo e sonno con la loro copertura.
- **Qualità**: anomalie, limitazioni, argomenti consentiti, affermazioni vietate.
- **Testo non attendibile**: i nomi delle attività vanno in un blocco separato, presentato a Claude come testo da non eseguire.

**Chiamata**:
- prompt di sistema con le regole fisse (`FEEDBACK_RULES`) più il tono scelto dal coach (`weekly_feedback_prompt_template`, segnaposto `{{nome_atleta}}`; se la colonna è vuota vale `DEFAULT_FEEDBACK_STYLE`);
- messaggio con il contratto;
- strumento obbligatorio `submit_weekly_feedback`;
- `max_tokens` 3000.

**Validazione** (`validateFeedbackOutput`):
- schema dello strumento rispettato e `stop_reason` uguale a `tool_use`;
- ogni affermazione con riferimenti esistenti nel contratto;
- argomenti di interpretazioni e raccomandazioni dentro quelli consentiti;
- nessuna espressione vietata (sovrallenamento, rischio di infortunio, «hai saltato», giudizi su fatica o recupero);
- giorni della settimana corretti accanto alle date;
- limitazioni presenti quando i dati sono incompleti;
- nessuna percentuale di aderenza quando non è comunicabile.

## Resend (email)

Invio tramite l'interfaccia astratta `EmailSender` (`supabase/functions/_shared/emailSender.ts`), con unica implementazione `ResendEmailSender`. Parte solo quando il coach approva un feedback, e solo se `app_settings.weekly_feedback_email_enabled` è vero e nelle env della Edge Function ci sono sia `RESEND_API_KEY` sia `RESEND_FROM_ADDRESS`. Senza provider o senza l'indirizzo dell'atleta la consegna risulta «saltata» sulla valutazione; un errore di invio resta registrato e viene ritentato. Motivazione della scelta di un'interfaccia astratta in [decisioni/0002-email-feedback-via-resend.md](decisioni/0002-email-feedback-via-resend.md).
