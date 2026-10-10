# 0006 — Split identità e sincronizzazione automatica

**Quando leggerlo**: per capire perché `identity` ha `nome`/`cognome` separati invece di un campo unico, e perché la sincronizzazione Intervals.icu è pilotata da stato di modulo invece che da un parametro esplicito.

**Stato**: attiva. La migrazione euristica `identitySplit.ts` è stata rimossa il 2026-10-10, dopo aver verificato che tutte le schede avevano già `nome` e `cognome` separati.

## Contesto

Fase 5 (2026-10-03): lo schema iniziale aveva un singolo campo nome completo; è stato diviso in `nome`/`cognome` (schema_version portata a 1.4.0), richiedendo una migrazione per le schede già esistenti.

## Decisione

- `identity.nome`/`identity.cognome` sostituiscono il precedente campo unico, con una migrazione euristica (`schema/migrations/identitySplit.ts`) che prova a separare il nome completo esistente in nome/cognome.
- La chiave Intervals.icu inserita dal coach viene validata con un controllo leggero (non vuota / formato plausibile), non con una chiamata di verifica all'API al momento dell'inserimento.
- I tre trigger di sincronizzazione lato client (apertura scheda, pulsante esplicito, dopo salvataggio con chiave modificata) sono coordinati da uno stato tenuto a livello di modulo in `services/intervals.ts`, non da un parametro passato esplicitamente ad ogni chiamata.

## Motivo

Separare nome/cognome rende possibile ordinare/cercare gli atleti per cognome e personalizzare meglio i prompt inviati a Claude. La migrazione euristica evita di richiedere una correzione manuale per ogni scheda esistente. Validare la chiave Intervals.icu solo localmente evita una chiamata di rete bloccante nel form prima ancora di sapere se il coach vuole salvare.

## Alternativa scartata

Richiedere al coach di re-inserire manualmente nome/cognome per ogni atleta esistente dopo l'aggiornamento dello schema: scartata come inutilmente fastidiosa quando una migrazione euristica copre la maggioranza dei casi ragionevolmente bene.
