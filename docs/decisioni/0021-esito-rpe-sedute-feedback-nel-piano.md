# 0021 — Esito e RPE salvati sulle sedute svolte, analisi settimanali passate alla generazione

**Quando leggerlo**: per capire perché una seduta svolta ha un esito («Svolta» o «Svolta in parte») e i dati dell'attività, da dove arriva l'RPE e quali dati del feedback riceve Claude quando genera le settimane successive.

**Stato**: attiva.

## Contesto

L'[audit della generazione e del feedback](../audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md) ha verificato che:
- una seduta abbinata con certezza risultava «Svolta» anche se l'atleta aveva fatto un quinto del previsto;
- il feedback non alimentava la generazione: Claude riceveva solo «svolta» o «nessuna attività registrata» per le sedute delle due settimane precedenti, comprese bozze mai viste dall'atleta;
- l'RPE si leggeva solo durante l'analisi settimanale e non restava sulla seduta.

## Decisione

Decisioni del coach D-09 e D-10:
1. **Esito sulla seduta**: quando una seduta viene riconosciuta come svolta (apertura della scheda, anteprima di «Sincronizza settimana», analisi del feedback: un'unica regola in `_shared/feedback/completion.ts`) si salvano l'esito rispetto al prescritto, il rapporto svolto/prescritto e i dati dell'attività: minuti, metri, carico e RPE (migrazione `0009`). Sotto la soglia di seduta completata (`completed_min_pct`) la seduta è «Svolta in parte», visibile nel piano e filtrabile nello storico.
2. **RPE aggiornato**: all'apertura della scheda i dati dell'attività delle sedute già svolte negli ultimi 14 giorni vengono riletti, così un RPE inserito più tardi dall'atleta arriva in PCoach.
3. **Feedback nella generazione**: Claude riceve, per le sedute approvate delle due settimane precedenti, esito, minuti svolti e RPE, e un riepilogo delle ultime due analisi settimanali concluse, **anche non approvate**: i dati sono calcolati da PCoach e non dipendono dal testo. Solo dati calcolati, mai il testo del feedback. Le bozze non approvate non entrano più fra le sedute recenti.
4. Una regola fissa del prompt (`PLAN_RULES`, versione 2.1.0) spiega a Claude che questi dati servono a calibrare il carico e che «nessuna attività registrata» non vuol dire allenamento non fatto.

## Motivo

- Pianificare a finestre di 4 settimane ha senso solo se ogni finestra parte da come sono andate le precedenti (ADR 0018).
- L'esito e l'RPE sono già calcolati o letti da PCoach: salvarli sulla seduta li rende visibili al coach e riutilizzabili senza ricalcoli.
- Il testo del feedback è scritto per l'atleta e può essere corretto dal coach: i dati calcolati sono la base più stabile e verificabile.

## Alternative scartate

- **Usare solo le valutazioni approvate**: una settimana non rivista non conterebbe; il coach ha scelto di usare l'ultima analisi.
- **Passare il testo del feedback**: mescola fatti e stile e non è verificabile.
- **Leggere l'RPE da Intervals.icu al momento della generazione**: una chiamata in più nel momento più lento del flusso, e il dato non resterebbe visibile nel piano.
