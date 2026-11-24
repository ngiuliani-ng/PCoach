# 0045 — Sintesi e messaggio separati, aderenza sempre in percentuale

**Quando leggerlo**: prima di cambiare la scheda di una settimana del feedback (sintesi per il coach, messaggio per l'atleta, limiti dei dati) o il modo in cui l'aderenza compare al coach e all'atleta.

**Stato**: attiva. Completa [0042](0042-messaggio-all-atleta-struttura-e-nessuna-domanda.md) e [0044](0044-messaggio-informativo-senza-recuperi.md).

## Contesto

Nella scheda di una settimana del feedback:
- in alto c'era una frase con i conteggi («7 sedute assegnate: 5 svolte, 2 senza attività registrata; completamento 71%»), separata dalla sintesi per il coach;
- «Limiti dei dati» era sempre aperto, mentre «Sedute della settimana» si apriva a richiesta;
- la sintesi per il coach e il messaggio per l'atleta avevano lo stesso aspetto, uno sotto l'altro;
- l'aderenza compariva solo se comunicabile e, per l'atleta, solo se Claude decideva di citarla, in forme diverse («Aderenza: 20%», «0 sedute su 5»).

## Decisione

1. **Niente frase dei conteggi in alto.** Aderenza e conteggi diventano una riga di dati in cima alla sintesi per il coach, calcolata da PCoach (`domain/feedbackText.ts`) e non dal testo di Claude.
2. **Due oggetti grafici distinti.** «Sintesi per te» è una card su fondo grigio, una nota interna. «Messaggio per l'atleta» è una card su fondo bianco con bordo e barra d'accento, come un foglio da inviare.
3. **«Limiti dei dati» richiudibile**, come «Sedute della settimana».
4. **Aderenza sempre presente**, in percentuale, sia nella sintesi per il coach sia fra i numeri per l'atleta. Un solo calcolo (`_shared/feedback/adherence.ts`) usato dalla scheda e dal server. Quando non si può calcolare compare comunque, con il motivo:
   - per il coach: «Aderenza non calcolabile (nessuna seduta passata)» o «(troppe sedute non valutabili)»;
   - per l'atleta: «- Aderenza: non calcolabile, nessuna seduta passata da valutare» o «…, troppi dati mancanti».
5. **Per l'atleta, una riga fissa.** Il server passa a Claude la riga da copiare tale e quale fra i numeri della settimana, e la validazione rifiuta un messaggio che non la contiene identica: un messaggio senza la riga passa per il secondo tentativo, come gli altri errori.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- Nessun numero di aderenza poco affidabile arriva all'atleta: quando non è comunicabile resta valido il divieto di citarne una percentuale.
- Le valutazioni già salvate mostrano la riga di dati nella sintesi (calcolata dal loro contratto). Il loro messaggio resta com'era, anche senza la riga dell'aderenza.
