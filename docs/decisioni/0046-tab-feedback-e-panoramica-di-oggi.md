# 0046 — Tab «Feedback» e Panoramica con le sole sedute di oggi

**Quando leggerlo**: prima di cambiare le tab della scheda di un atleta, il contenuto della Panoramica o la disposizione della pagina del feedback (ordine, widget, dettagli richiudibili, grafici).

**Stato**: attiva. Completa [0045](0045-sintesi-e-messaggio-separati-aderenza-sempre.md); sostituisce la collocazione del feedback nella Panoramica decisa con l'audit UX-10.

## Contesto

La Panoramica conteneva tre cose: il grafico del carico, le sedute dell'intera settimana in corso e il feedback settimanale. Il feedback stava in fondo, oppure in cima se c'era una bozza da approvare. Ogni settimana del feedback mostrava solo elenco delle sedute, limiti, sintesi e messaggio, anche se il contratto calcolato dal server ha molti più dati: volume per disciplina rispetto al piano, intensità prevista e svolta, benessere e RPE rispetto alla media di 28 giorni, carico CTL/ATL, confronto con la settimana precedente.

Dopo una prima versione con tutti i dati in vista, il coach ha chiesto una pagina ordinata, che non sembri un agglomerato di dati e testo.

## Decisione

1. **Tab nell'ordine Panoramica, Piano, Feedback, Profilo, Anomalie.** Il feedback ha una tab propria (`#/atleta/:id/feedback`). Un link salvato prima (`…/panoramica?feedback=ID`) apre la tab Feedback. Sulla tab c'è un numero, come per le anomalie: i feedback da approvare, non riusciti o approvati ma non inviati. «Da fare» e anomalie portano alla tab Feedback.
2. **Panoramica: grafico del carico e sedute di oggi.** La settimana intera è nel Piano.
3. **Pagina Feedback, dall'alto:**
   - **andamento dell'aderenza** delle ultime 8 settimane, in una card compatta: una barra per settimana, il valore scritto sull'ultima e nel tooltip; ogni barra è un pulsante che apre quella settimana;
   - **per ogni settimana, sempre visibili**:
     - la sintesi per il coach, con tre widget numerici calcolati da PCoach (aderenza, sedute svolte, volume rispetto alla settimana prima) e il testo di Claude;
     - il messaggio per l'atleta con «Approva» e «Rigenera»;
   - **«Dettagli»**, voci richiudibili chiuse all'arrivo, ognuna con un riepilogo di una riga da chiusa: «Volume e intensità», «Benessere e carico», «Sedute della settimana» (in tabella), «Limiti dei dati».
4. **Due colonne quando c'è spazio.** Sintesi e dettagli a sinistra, messaggio a destra, sempre visibile. Su telefono si va in colonna: sintesi, messaggio, dettagli. Le colonne seguono la larghezza reale della settimana (container query), non quella della finestra. Nella sola tab Feedback la colonna della scheda è più larga.
5. **Grafici descrittivi**, come il contratto: nessun colore di giudizio, numeri sempre scritti accanto alle barre. L'intensità usa una sola tinta dal chiaro allo scuro (bassa, media, alta), validata per i daltonici e definita per tema chiaro e scuro.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- I feedback si leggono con la scheda, non con la tab: servono al numero sulla tab e alle anomalie anche quando la tab non è aperta.
- Su uno schermo di 320px le cinque tab non stanno in una riga: la barra scorre in orizzontale al suo interno, e la tab attiva si porta in vista.
- I contratti salvati in passato possono non avere tutte le metriche: ogni voce dei dettagli compare solo se il dato c'è.
