# 0042 — Messaggio all'atleta: struttura fissa e nessuna domanda

**Quando leggerlo**: prima di cambiare la forma del messaggio del feedback settimanale (saluto, parti, firma, domande) o le regole fisse che la descrivono (`FEEDBACK_RULES`).

**Stato**: attiva. Completa [0019](0019-feedback-analisi-deterministica-approvazione.md) e [0041](0041-migrazione-a-claude-sonnet-5-5.md).

## Contesto

Con il passaggio a Claude Sonnet 5.5 ([0041](0041-migrazione-a-claude-sonnet-5-5.md)) il primo feedback rigenerato (Elia, settimana 16-22 novembre 2026) è uscito molto diverso da quelli di Sonnet 4.5. Sonnet 4.5 scriveva una lettera con saluto, paragrafi discorsivi e una chiusura. Sonnet 5.5 ha scritto un resoconto a sezioni, senza saluto né chiusura, e ha preso alla lettera le regole interne, scrivendo all'atleta «(è un'ipotesi del software)» e «Aderenza sul registrato». Il tono del coach era quello predefinito, quindi la differenza veniva dalle regole fisse.

Entrambi i modelli facevano circa tre domande all'atleta ogni settimana, perché lo schema aveva una lista `questions_for_athlete` e la regola sulle sedute non registrate diceva «al massimo chiedi». Quella lista non era mostrata da nessuna parte: l'atleta leggeva le domande dentro il messaggio.

## Decisione

1. **Struttura fissa del messaggio**, nelle regole fisse (il coach non la cambia dal tono):
   - `Ciao <nome>,`;
   - uno o due paragrafi a parole semplici su cosa è andato bene, cosa non risulta e su cosa concentrarsi;
   - «I numeri della settimana:» con l'elenco dei dati per chi è più tecnico;
   - la firma «Coach» sull'ultima riga.

   Al massimo 250 parole (prima 200), per far posto ai numeri.
2. **Nessuna domanda all'atleta.** `questions_for_athlete` esce dallo schema. Le sedute non registrate si raccontano come dato mancante («per lunedì non vedo un'attività registrata»), una seduta spostata come probabile («sembra che…»).
3. **Nessun termine interno nel messaggio**: niente software, contratto, nomi dei campi o codici degli esiti.
4. **Controllo lato server** (`athleteMessageProblems`): saluto con il primo nome dell'atleta, firma, niente punti interrogativi, niente termini interni. Un messaggio non conforme passa per il secondo tentativo con l'elenco degli errori, come gli altri errori di validazione; se fallisce anche quello, la valutazione va in `generation_failed`.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- Le valutazioni già salvate conservano `questions_for_athlete`, ora facoltativo nel tipo `FeedbackOutput`.
- Il coach può ancora scrivere domande correggendo il testo prima di approvarlo: la validazione riguarda solo il testo di Claude.
- Un nome di attività con il trattino basso citato nel messaggio fa scattare il controllo sui termini interni: la regola sul testo non attendibile già chiede di citarlo al massimo.
