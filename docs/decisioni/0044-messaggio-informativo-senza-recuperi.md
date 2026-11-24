# 0044 — Messaggio all'atleta solo informativo, senza recuperi di sedute

**Quando leggerlo**: prima di cambiare cosa il messaggio del feedback settimanale può chiedere all'atleta o suggerirgli per la settimana successiva.

**Stato**: attiva. Completa [0042](0042-messaggio-all-atleta-struttura-e-nessuna-domanda.md).

## Contesto

Dopo [0042](0042-messaggio-all-atleta-struttura-e-nessuna-domanda.md) il messaggio non faceva più domande. Il feedback di Elia della settimana 16-22 novembre 2026 (revisione 5) conteneva però due frasi che il coach non vuole:
- «Se hai fatto altro che non è arrivato nei dati, fammelo sapere con una nota»: non è una domanda, ma chiede comunque una risposta all'atleta;
- «l'obiettivo è […] rimettere in calendario le sedute chiave»: si può leggere come un invito a recuperare le sedute non svolte, mentre le decisioni sul piano spettano al coach.

## Decisione

1. **Il messaggio informa soltanto**: nessuna domanda e nessuna richiesta di risposta o di dati («fammi sapere», «scrivimi», «mandami una nota»).
2. **Le indicazioni per la prossima settimana seguono il piano così com'è**: nessun invito a recuperare, rimettere in calendario, spostare o aggiungere sedute non svolte.
3. **Controllo lato server** in `athleteMessageProblems`:
   - richieste all'atleta («fammi/fammelo sapere», «scrivimi», «mandami», «inviami», «rispondimi», «dimmi», «avvisami», «aggiornami»);
   - inviti a recuperare («rimettere in calendario», «recuperare la seduta / i minuti / l'allenamento»). «Senza recuperare» e «non recuperare» restano ammessi.

   Come per le altre regole del messaggio, un testo non conforme viene riscritto una volta.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- Il controllo cerca espressioni precise: una richiesta formulata in un altro modo («ti chiedo di caricare i dati») la ferma solo la regola nel prompt.
- Il coach può sempre aggiungere una richiesta correggendo il testo prima di approvarlo.
