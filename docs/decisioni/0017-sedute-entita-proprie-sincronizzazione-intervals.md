# 0017 — Sedute come entità proprie, rigenerazione controllata e sincronizzazione con Intervals.icu

**Quando leggerlo**: per capire perché le sedute non stanno più nella scheda atleta, come funzionano approvazione, rigenerazione da una data e «Sincronizza settimana», e perché la sincronizzazione lavora per id invece che per `external_id`.

**Stato**: attiva. Supera [0007](0007-plan-view-model-puro.md) (la vista del piano basata su `training_plan` non esiste più).

## Contesto

Un audit del 2026-10-10 ha verificato nel codice e nei dati tre problemi.

1. **Storico.** Il piano era un unico oggetto `training_plan` nella scheda. «Conferma piano» seguito da «Salva» lo sostituiva per intero, senza storico. Le sessioni non avevano identità (solo la posizione nell'array) e condividevano con il profilo lo stesso `updated_at`. Dopo una sostituzione, `weekly-feedback` non trovava più le sedute dei giorni passati della settimana.
2. **Rigenerazione.** Non esisteva una data di partenza (le date le sceglieva Claude), non c'erano stati delle sedute e l'unica operazione possibile era sostituire tutto. L'unico strumento di modifica era il JSON grezzo dell'anteprima.
3. **Intervals.icu.** Nessuna scrittura verso Intervals.icu. I dati salvati mostravano un formato non convertibile: 37 valori distinti di `target_zone` in testo libero (ad esempio «Alta», «Z2 (5:30-6:00/km)»), nessuna metrica dei target, e 29 sedute su 237 con il giorno incoerente con la data.

C'era anche un bug di date: `addDaysISO` serializzava la mezzanotte locale in UTC, quindi in Italia `addDaysISO("2026-10-10", 1)` restituiva `"2026-10-10"`.

## Decisione

1. **Tabelle proprie** per piani, generazioni, sedute, stato di sincronizzazione e cronologia (`0004_workouts.sql`); la scheda resta un blob. In JSONB restano solo la struttura del workout (un albero modificato sempre per intero), la proposta di Claude e le istantanee della cronologia.
2. **Identità e concorrenza per seduta**: uuid stabile; `revision` incrementata da un trigger a ogni cambio di contenuto; ogni modifica condizionata alla revisione nota. Un indice unico parziale su giorno e posizione impedisce i doppioni tra le sedute attive.
3. **Tre stati separati**: approvazione (salvata: bozza, approvata, annullata, sostituita), esecuzione (derivata da un'attività abbinata o segnata a mano), sincronizzazione (`workout_sync`). Scelte del coach:
   - una seduta approvata e poi modificata resta approvata e, se già inviata, diventa «Da aggiornare»;
   - le sedute importate dai piani esistenti sono approvate.
4. **Niente cancellazioni silenziose**: dall'interfaccia si elimina solo una bozza mai approvata né inviata; il resto si annulla e resta nello storico. Una rigenerazione segna le sedute «sostituite» e chiude il piano attivo invece di cancellarli. La cronologia (`workout_events`) è scritta da trigger e non si modifica.
5. **Rigenerazione controllata**:
   - il coach sceglie la data di ripartenza, le settimane, il motivo e le sedute da mantenere; le svolte restano sempre;
   - la proposta di Claude viene salvata (`plan_generations`) e mostrata come differenze per giorno (mantenute, sostituite, aggiunte, tolte);
   - `apply_plan_generation` la applica in un'unica transazione, rifiutandola se nel frattempo qualcosa è cambiato.

   Il motore resta Claude con il template configurabile. Cambiano l'input (data di partenza, sedute fisse, sedute recenti con esito, motivo) e il formato di output (solo zone, struttura v2). Su richiesta del coach, il template salvato è stato sostituito dal nuovo predefinito.
6. **Modello interno indipendente dal provider**: la struttura v2 (step e ripetute, durate a tempo o distanza, zone 1-7) con una metrica per seduta. Decisione del coach: bici in potenza se c'è l'FTP, altrimenti in FC; corsa e nuoto in zone di passo. Il testo per Intervals.icu è solo un formato di esportazione, generato da un modulo puro condiviso tra app (anteprima) ed Edge Function (invio).
7. **Sincronizzazione esplicita e verificabile**:
   - si sincronizza per settimana, con l'anteprima delle operazioni e la Edge Function `intervals-sync`;
   - un'operazione per seduta, con timeout, nuovi tentativi ed esito per riga;
   - le bozze non si inviano;
   - i conflitti con modifiche fatte su Intervals.icu richiedono una scelta;
   - la rimozione delle sedute annullate è preselezionata (scelta del coach) ma va confermata e non tocca mai sedute svolte;
   - dopo ogni invio il numero di step letti da Intervals.icu viene confrontato con quello atteso.
8. **Operazioni per id**: la specifica ufficiale limita upsert e cancellazione per `external_id` agli eventi creati dalla stessa applicazione OAuth, mentre PCoach usa chiavi API personali. Si memorizza quindi `remote_event_id`. Prima di creare si cerca l'evento per `external_id` (e, dopo un tentativo senza risposta, per nome e tipo), così un timeout non produce doppioni.
9. **Migrazione in tre tempi**:
   - prima tabelle nuove e backup;
   - poi l'import idempotente dei piani salvati, eseguito dall'app all'avvio (`legacyPlanToImport` + `import_legacy_plan`), con l'originale in `workouts.legacy` e `needs_review` sui target non riconoscibili;
   - infine la rimozione di `training_plan` dalla scheda, in un passo successivo.

   `weekly-feedback` legge le tabelle, e il vecchio piano solo per gli atleti non ancora importati.
10. **Date** come stringhe `YYYY-MM-DD` con aritmetica a mezzogiorno UTC (`_shared/workouts/calendar.ts`); settimana da lunedì a domenica.

## Correzione del 2026-10-10: il giorno della settimana vale più della data

Dopo il rilascio, il coach ha notato sedute spostate di un giorno in avanti, e una rigenerazione che non rispettava i giorni disponibili.

**Causa.** Claude sbaglia a ricavare il giorno della settimana da una data.
- In 29 sedute di 2 atleti il giorno indicato era corretto (coerente con disponibilità e attività abituali) e la data era quella del giorno dopo. La vecchia vista mostrava il giorno, l'import aveva dato ragione alla data.
- La prima rigenerazione era sfalsata di +1 su tutta la settimana: Claude aveva preso l'11 ottobre, una domenica, per un lunedì.

**Decisione.**
- Nell'import e nella lettura della proposta, se giorno e data non coincidono vale il giorno: la data viene portata al giorno indicato, entro tre giorni.
- Il prompt riceve un calendario già calcolato (data, giorno, disponibilità, durata massima, attività abituale) e Claude restituisce sia la data sia il giorno.
- Un controllo deterministico segna «da verificare» le sedute proposte in giorni non disponibili o oltre la durata massima del giorno.
- Le 29 sedute importate sono state riportate al giorno indicato, con una nota nella cronologia.

Il punto 9 della decisione va letto di conseguenza.

## Motivo

Le tabelle dedicate danno identità, vincoli e concorrenza per seduta. Senza di esse, approvare, sincronizzare e rigenerare una parte del programma senza toccare il resto non è possibile in modo affidabile. Restano poche (cinque) perché revisioni e audit condividono la stessa cronologia invece di avere due tabelle.

Separare i tre stati evita che «approvata» venga letto come «inviata» o «svolta». L'anteprima salvata e la transazione unica rendono la rigenerazione prevedibile: ciò che il coach vede è ciò che succede, oppure non succede nulla. Lavorare per id con riconciliazione è l'unica strada idempotente disponibile con le chiavi API personali.

## Alternative scartate

- **Lasciare tutto nel blob, aggiungendo id e uno storico dei piani**: risolve lo storico ma non la concorrenza (ogni esito di sincronizzazione entrerebbe in conflitto con la modifica del profilo) né i vincoli sui doppioni, e rende costose le interrogazioni per settimana e per stato.
- **Una tabella di versioni separata dall'audit**: duplica le istantanee già presenti negli eventi di modifica.
- **Scrivere su Intervals.icu dal browser**, come per le letture: più semplice, ma la chiave verrebbe usata per scrivere dal client e una pagina chiusa a metà lascerebbe esiti non registrati.
- **`events/bulk?upsert=true` per `external_id`**: non funziona con chiavi API personali; servirebbe registrare PCoach come applicazione OAuth presso Intervals.icu.
- **Editor testuale con la sintassi di Intervals.icu come input principale**: costringe il coach a imparare una sintassi e non è validabile campo per campo. Il testo resta visibile come anteprima.
- **Calendario a sette colonne**: illeggibile su mobile e stretto per tre stati per seduta. Al suo posto, una riga per giorno.
