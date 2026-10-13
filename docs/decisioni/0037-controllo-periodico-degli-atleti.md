# 0037 — Controllo periodico degli atleti su Intervals.icu

**Quando leggerlo**: prima di cambiare il controllo di chiave, zone e soglie, l'aggiornamento automatico del carico, la tabella `athlete_checks` o il job `athlete-checks-30min`.

**Stato**: attiva. Completa [0035](0035-pagina-da-fare-sezioni-e-guida.md): la pagina «Da fare» mostra anche le anomalie che richiedono Intervals.icu. Le regole di [0029](0029-zone-allineate-con-intervals.md), [0030](0030-soglie-allineate-e-stima-della-durata.md) e [0033](0033-zone-e-soglie-bloccano-l-invio.md) non cambiano.

## Contesto

Dopo la pagina «Da fare» restavano fuori tre anomalie, perché richiedono una lettura da Intervals.icu per atleta: zone diverse, soglie diverse, chiave non valida. Si vedevano solo aprendo la scheda. Anche il carico (CTL, ATL, TSB) si aggiornava solo all'apertura della scheda. Il coach ha chiesto un compito periodico che faccia entrambe le cose, ogni 30 minuti, con la «strada A» per il carico.

## Decisione

1. **Edge Function `athlete-checks`**, chiamata da `pg_cron` ai minuti 20 e 50 di ogni ora (job `athlete-checks-30min`, `supabase/migrations/0013_athlete_checks.sql`). Accetta solo la service-role key, letta da Vault come per il feedback. Per ogni atleta, uno alla volta:
   - legge le impostazioni degli sport su Intervals.icu e salva in `athlete_checks` l'esito:
     - stato della chiave: valida, non valida, assente, Intervals.icu non raggiungibile;
     - zone diverse e soglie diverse, con lo stesso testo di [`alignmentProblems`](../../supabase/functions/_shared/workouts/thresholds.ts);
   - con una chiave valida legge wellness e attività e aggiorna il log del carico con la stessa finestra e la stessa unione dell'app (`_shared/workouts/loadMetrics.ts`).
2. **Carico, strada A**: la scheda si aggiorna **senza cambiare `updated_at`**, così chi la sta modificando non vede «Questa scheda è stata modificata altrove».
   - La scrittura vale solo se `updated_at` è ancora quello letto: se il coach ha salvato nel frattempo, si salta e il giro successivo riprova.
   - Se il coach salva una scheda aperta da prima del giro, il carico torna a quello di poco prima; il giro successivo lo riallinea. È una copia di Intervals.icu: non si perde nulla.
3. **Aggiornamento all'apertura della scheda**: `intervals-sync` (`zones_read`) salva lo stesso esito quando la tab Anomalie controlla zone e soglie. Dopo una correzione, la pagina «Da fare» si aggiorna senza aspettare il giro successivo.
4. **Pagina «Da fare» e contatore**:
   - chiave non valida (errore), zone diverse e soglie diverse (da sistemare), con il link alla scheda;
   - Intervals.icu non raggiungibile non aggiunge anomalie;
   - nessuna riga sull'ora dell'ultimo controllo: la pagina mostra solo cosa c'è da fare (decisione del coach del 13 ottobre 2026, dopo la 1.0.0, che la mostrava).

Confermate dal coach il 13 ottobre 2026:
- minuti 20 e 50, per stare lontano dal job del feedback al minuto 5;
- riuso della chiave di Vault `weekly_feedback_service_role_key`, invece di crearne una nuova con lo stesso valore;
- «Sistemale nelle Anomalie» come link per zone e soglie;
- un atleta alla volta, con un tempo massimo di 15 s per richiesta a Intervals.icu.

## Conseguenze

- Nuova tabella `athlete_checks` (RLS del coach; il server scrive con la service-role key) e un job `pg_cron` in più.
- Il giro fa al massimo tre letture per atleta da Intervals.icu ogni 30 minuti.
- La logica del carico vive in `_shared/workouts/loadMetrics.ts`, usata dall'app e dal server; quella del controllo in `_shared/workouts/athleteChecks.ts`. Entrambe sono testate in `domain/athleteChecks.test.ts`.
- Ordine di pubblicazione: migrazione `0013` dopo la pubblicazione di `athlete-checks`, così il primo giro trova la funzione.
