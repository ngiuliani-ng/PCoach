# 07 — Sintesi per il proprietario del prodotto

**Quando leggerlo**: per primo, per sapere in 5 minuti cosa non va nel feedback settimanale, cosa decidere e in che ordine intervenire. I dettagli sono negli altri sei documenti di questa cartella.

**Stato**: audit concluso il 2026-10-10. Nessuna modifica al codice o ai dati.

## In una frase

Il feedback di oggi mette insieme le sedute pianificate e le attività grezze di Intervals.icu e lascia a Claude il compito di abbinarle, contarle e giudicarle. Poi invia il risultato all'atleta senza che il coach lo veda. I conteggi non sono verificabili, un dato mancante può diventare «non ti sei allenato» e non si può ricostruire perché un feedback abbia detto qualcosa.

## Prima di domenica 11 ottobre, ore 20:05

L'email all'atleta è **attiva** in produzione. Stasera il feedback partirà per Elia Muratori, l'unico atleta con una seduta in settimana. Il confronto sarà fra 1 seduta (il lungo di domenica) e **tutte** le sue attività dal 4 all'11 ottobre, cioè 8 giorni, compresi quelli precedenti all'inizio del piano. Nessuno lo rivedrà prima dell'invio.

**Decisione da prendere ora**:
- **(a)** disattivare l'email in Impostazioni finché non è pronta almeno la fase 0;
- **(b)** lasciarla attiva sapendo cosa riceverà l'atleta.

Raccomando (a). Non ho modificato nulla.

## Problemi principali

1. **L'abbinamento lo fa il modello** (P-03). Quale attività corrisponde a quale seduta, quante sedute sono state svolte e di quanto ci si è scostati: tutto è dedotto da Claude in modo non ripetibile e non salvato.
2. **Un dato assente è trattato come un allenamento non fatto** (P-04, P-17). Le attività importate da Strava arrivano vuote via API, e le sedute svolte risultano «non svolte» finché il coach non apre «Sincronizza settimana».
3. **La settimana sbagliata e le sedute sbagliate** (P-01, P-02, P-14). Il periodo è di 8 giorni, quindi la domenica viene contata due volte. Entrano le bozze mai inviate all'atleta e i giorni precedenti all'inizio del piano.
4. **Nessun controllo prima dell'atleta** (P-05, P-07). Il testo, anche troncato o vuoto, va via email subito.
5. **Niente memoria** (P-08, P-11). Del feedback si salva solo il testo. Input, versione del piano, modello ed esito dell'email non restano da nessuna parte.
6. **Il recupero non si può valutare** (P-12). PCoach non raccoglie RPE né benessere, scarta quelli che Intervals.icu fornisce e salva CTL/ATL incompleti. Qualunque frase sul recupero oggi è un'invenzione.

## Impatto sugli atleti

- Rischio di rimproveri ingiustificati: «hai saltato…» per dati mancanti o per bozze mai ricevute.
- Rischio di elogi ingiustificati: volumi raddoppiati per doppioni o per la domenica contata due volte.
- Rischio di affermazioni fisiologiche non sostenute, con l'autorità del coach.
- Nessuno di questi errori produce un errore tecnico, quindi oggi nessuno se ne accorge.

## Decisioni per il proprietario del prodotto

1. **Email**: dopo la fase 3, il feedback va all'atleta solo dopo l'approvazione del coach, oppure in automatico quando i dati sono completi? (Raccomandato: approvazione, con quella automatica facoltativa.)
2. **Settimana**: il feedback valuta sempre l'ultima settimana conclusa, da lunedì a domenica. È d'accordo spostare l'esecuzione a lunedì mattina, così le attività di domenica sera sono già arrivate? (Raccomandato.)
3. **Soglie operative**: 80-120% della durata = «completata», 50-80% = «parziale», volume ±20% = «scostamento rilevante». Sono euristiche: vanno confermate o corrette dal coach.
4. **Dati soggettivi**: chiedere agli atleti di inserire RPE e sensazioni su Intervals.icu? Senza questi dati il feedback non può parlare di recupero.
5. **Architettura**: approvare l'alternativa C di [06](06-target-architecture-and-roadmap.md): modulo di analisi deterministico, tabella `weekly_reviews`, stati e consegna con nuovi tentativi.

## Interventi prioritari

| Ordine | Intervento | Effort indicativo |
|---|---|---|
| 0 | Messa in sicurezza: email off o solo al coach, settimana lun-dom, solo sedute approvate, controllo dell'output troncato o vuoto, timeout | ore |
| 1 | Tabella `weekly_reviews` con istantanea, modello e versione | 1 giorno |
| 2 | Analisi deterministica (abbinamento, metriche, qualità dei dati) e contratto per Claude, con due settimane in parallelo | 2-4 giorni |
| 3 | Stati, output strutturato e validato, approvazione in UI, email con nuovi tentativi | 2-3 giorni |
| 4-6 | Correzioni del coach sugli abbinamenti, dati soggettivi, analisi delle ripetute | in seguito |

## Risposte alle domande di verifica

1. **Quali dati reali usa il feedback e da dove provengono?**
   - Sedute `draft` e `approved` della tabella `workouts`, negli 8 giorni fino a oggi, nella versione corrente.
   - JSON grezzo di `/activities` di Intervals.icu per lo stesso periodo.
   - Nome dell'atleta e template di `app_settings`.
   - CTL/ATL vengono sincronizzati ma non usati (P-12).
2. **Quale piano e quale versione fanno da riferimento?** Nessuna versione esplicita: le sedute attive come sono al momento dell'esecuzione, bozze comprese, senza `plan_id` né `revision` (P-02, P-13). La proposta è usare il piano assegnato (solo `approved`) con le revisioni, più le modifiche del coach ricostruite da `workout_events`.
3. **Quali attività sono associate a ciascuna seduta e perché?** Oggi lo decide Claude, senza regole né tracce (P-03). Con la proposta: regole R0-R7 con priorità, confidenza e metodo salvati ([04](04-matching-and-metrics.md)).
4. **Come vengono calcolati i risultati quantitativi?** Oggi non sono calcolati: li stima il modello. Con la proposta: formule con numeratori e denominatori espliciti, calcolate dal backend ([02](02-endurance-feedback-domain.md), [04](04-matching-and-metrics.md)).
5. **Quali conclusioni sono supportate e quali no?** Tabella «Conclusioni consentite e vietate» di [02](02-endurance-feedback-domain.md#conclusioni-consentite-e-vietate). Con i dati di oggi: aderenza, volume e intensità descrittivi sì; recupero, forma, sovrallenamento e rischio di infortunio no.
6. **Quali errori di dati generano un feedback sbagliato senza errore tecnico?**
   - Domenica contata due volte, bozze incluse, attività Strava vuote, doppioni (P-01, P-02, P-04).
   - Giorni precedenti al piano, piano cambiato in settimana (P-13, P-14).
   - Output troncato (P-07), CTL/ATL non aggiornati (P-12).
7. **Come si riproduce una valutazione passata?** Oggi non si può (P-08). Con la proposta: `weekly_reviews.input` (istantanea normalizzata), `analysis_version`, `model` e `prompt_template_hash`.
8. **Come si evitano duplicazioni e risultati incoerenti?**
   - Vincolo unico di database su atleta, periodo e tipo, con reclamo prima di chiamare Claude.
   - Doppioni delle attività tolti in modo deterministico.
   - Un'attività abbinata al massimo a una seduta.
   - Una sostituzione contata una volta sola.
9. **Come si distingue un dato assente da una prestazione negativa?**
   - Esiti separati: `not_recorded` (copertura completa, nessuna attività), `data_unavailable` (copertura incompleta), `ambiguous`.
   - Il livello `data_quality` decide cosa il testo può dire.
   - «Non eseguita» non è mai un fatto del sistema.
10. **Qual è la modifica minima che aumenta in modo sostanziale la correttezza?** La fase 0 più la parte di abbinamento della fase 2:
    - periodo lun-dom;
    - solo sedute approvate;
    - abbinamento deterministico tramite `paired_event_id` ↔ `remote_event_id` (dato già disponibile in PCoach e Intervals.icu), più stesso giorno e stessa disciplina;
    - esiti con «dato non disponibile».

    Il modello riceve conteggi già calcolati invece del JSON grezzo, e il feedback passa dal coach prima dell'atleta.
