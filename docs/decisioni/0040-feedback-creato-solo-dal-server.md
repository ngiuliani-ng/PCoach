# 0040 — Feedback settimanale creato solo dal server

**Quando leggerlo**: prima di aggiungere un modo per preparare a mano il feedback di una settimana, o di cambiare le azioni del coach della Edge Function `weekly-feedback`.

**Stato**: attiva. Completa [0019](0019-feedback-analisi-deterministica-approvazione.md).

## Contesto

La Panoramica aveva in fondo alla sezione del feedback «Prepara il feedback di un'altra settimana»: un selettore con le ultime sei settimane senza feedback e un pulsante che chiamava l'azione `create` di `weekly-feedback`. Il coach vuole che il feedback sia solo automatico: lo prepara il server ogni lunedì, e il coach lo corregge, rigenera e approva.

## Decisione

1. **Nessun comando per creare un feedback dall'app**: tolta la sezione da `WeeklyReviews.vue`, con l'azione `create` dello store (`stores/reviews.ts`) e `createReview` in `services/feedback.ts`.
2. **Nessuna azione `create` nella Edge Function**: le valutazioni le crea solo l'invocazione schedulata (`pg_cron`). Il coach agisce solo su valutazioni esistenti (`regenerate`, `retry`, `approve`); un'azione sconosciuta risponde «Azione non valida.». Tenere l'azione sul server senza un chiamante lascerebbe una superficie non usata e non testata.
3. Senza feedback la sezione dice quando arriva il primo: «PCoach lo prepara ogni lunedì per la settimana appena conclusa.»

Decisione del coach dell'8 novembre 2026.

## Conseguenze

- Una settimana che il lunedì il server non valuta resta senza feedback: per esempio senza sedute approvate, senza chiave Intervals.icu o fuori dalla finestra oraria del lunedì ([limiti-roadmap.md](../limiti-roadmap.md#feedback-settimanale)). «Rigenera» e «Riprova» restano per le settimane che una valutazione ce l'hanno.
- Ordine di pubblicazione: indifferente. L'app nuova non chiama più `create`, e una `weekly-feedback` nuova con l'app vecchia rifiuta solo quel pulsante.
