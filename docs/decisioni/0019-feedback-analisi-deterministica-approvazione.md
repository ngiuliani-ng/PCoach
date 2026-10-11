# 0019 — Feedback settimanale: analisi deterministica, valutazioni con stati e approvazione del coach

**Quando leggerlo**: per capire perché il feedback lo calcola PCoach e Claude lo scrive soltanto, perché vive nella tabella `weekly_reviews` con stati espliciti, perché parte di lunedì e perché nessuna email arriva all'atleta senza l'approvazione del coach.

**Stato**: attiva. Sostituisce [0008](0008-feedback-automatico-schedulato.md), di cui conserva la finestra di esecuzione tollerante.

## Contesto

L'audit di ottobre 2026 ([docs/audit/2026-10-feedback/](../audit/2026-10-feedback/07-executive-summary.md)) ha verificato che il feedback:
- confrontava 8 giorni invece della settimana del piano e includeva le bozze;
- lasciava a Claude abbinare sedute e attività e calcolare gli scostamenti, senza regole ripetibili;
- trattava un dato mancante, ad esempio un'attività importata da Strava e non leggibile via API, come un allenamento non fatto;
- inviava il testo all'atleta senza revisione, anche se troncato o vuoto;
- non conservava né i dati usati né la versione del piano;
- non usava RPE, benessere e CTL/ATL, pur leggendoli.

## Decisione

1. **L'analisi la fa PCoach** (`supabase/functions/_shared/feedback/`, moduli puri condivisi con l'app e testati con Vitest):
   - normalizzazione delle attività: disciplina, dati non disponibili, doppioni;
   - abbinamento sedute-attività con regole a priorità e confidenza (regole R1-R7 in [04](../audit/2026-10-feedback/04-matching-and-metrics.md));
   - metriche con numeratori e denominatori espliciti;
   - qualità dei dati, anomalie e limitazioni.

   Il risultato è il contratto `feedback_input`, salvato con la valutazione.
2. **Claude scrive soltanto**:
   - riceve il contratto, regole fisse nel codice e il tono scelto dal coach in Impostazioni;
   - risponde con uno strumento a schema fisso (`submit_weekly_feedback`);
   - il server valida i riferimenti ai dati, gli argomenti consentiti, le affermazioni vietate (recupero, sovrallenamento, infortunio, «hai saltato»), i giorni della settimana e la presenza delle limitazioni;
   - un output non valido non diventa mai un feedback: c'è un solo nuovo tentativo con l'errore, poi lo stato `generation_failed`.
3. **Tabella `weekly_reviews`** (migrazione `0007`):
   - una riga per atleta, settimana e revisione;
   - stati `pending` → `analyzed` → `draft` → `approved`, più `skipped`, `analysis_failed`, `generation_failed` e `superseded`;
   - consegna dell'email sulla stessa riga, con nuovi tentativi;
   - due indici unici, sulla revisione e sulla valutazione corrente, garantiscono l'idempotenza;
   - un blocco a tempo (`locked_until`) impedisce che due esecuzioni elaborino la stessa riga.
4. **Approvazione del coach**: l'email parte solo da una valutazione approvata, con il testo eventualmente corretto dal coach.
5. **Periodo e orario**: si valuta la settimana di calendario che contiene il giorno prima. Il lunedì alle 08:00, quindi, la settimana appena conclusa.
6. **Soglie modificabili**:
   - le soglie che classificano sedute e scostamenti sono parametri globali in Impostazioni (`app_settings.feedback_params`);
   - le percentuali di carico e scarico sono per atleta (`methodology_preferences`) e servono sia al prompt del piano sia al confronto fra settimane.
7. **Esecuzione registrata**: le sedute abbinate con certezza (evento abbinato su Intervals.icu, oppure stesso giorno e stessa disciplina) risultano svolte anche nel piano. Succede all'analisi del feedback e all'apertura della scheda dell'atleta (ultimi 14 giorni), con un'unica regola (`completion.ts`), senza dover aprire «Sincronizza settimana». Il piano mostra «Non registrata» invece di «Non svolta».

## Correzione del 2026-10-11: sempre il lunedì, valutazione anticipata sostituita, reinvio a scelta

Decisioni del coach dopo l'[audit della generazione e del feedback](../audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md) (D-07, D-08, D-11):
- **Sempre il lunedì**: si valuta sempre l'ultima settimana conclusa; in Impostazioni si sceglie solo l'ora. Un giorno diverso valutava la settimana in corso.
- **Valutazione anticipata sostituita**: una valutazione preparata dal coach durante la settimana, e non ancora approvata, lascia il posto a quella del lunedì con una nuova revisione. Prima restava la versione parziale.
- **Rigenerare dopo l'invio**: è consentito con un avviso; all'approvazione della nuova revisione il coach sceglie se inviarla. Prima partiva una seconda email senza chiederlo.

## Motivo

- I conteggi e gli abbinamenti devono essere ripetibili e verificabili, e un modello linguistico non lo è.
- Separare i fatti calcolati dal testo permette di vietare per costruzione le conclusioni che i dati non sostengono.
- Salvare i dati di ingresso, la versione dell'analisi, il modello e l'hash del template rende riproducibile ogni valutazione.
- L'approvazione del coach riporta il feedback a ciò che PCoach dichiara di essere: una bozza da rivedere.

## Alternative scartate

- **Correzioni mirate alla funzione esistente**: avrebbero lasciato al modello abbinamento e conteggi.
- **Servizio di analisi separato fuori da Supabase**: complessità e costi non giustificati dal volume, perché la piattaforma esistente basta.
- **Invio automatico quando i dati sono completi**: scelta del coach, che approva ogni feedback.
- **Tabella delle attività importate e degli abbinamenti**: per ora basta l'istantanea nel contratto. Servirà quando il coach potrà correggere a mano un abbinamento (fase 4 della roadmap in [06](../audit/2026-10-feedback/06-target-architecture-and-roadmap.md)).
