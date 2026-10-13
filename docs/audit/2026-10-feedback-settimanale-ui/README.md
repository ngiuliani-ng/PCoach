# Feedback settimanale: verifica UI/UX

**Quando leggerlo**: prima di cambiare l'interfaccia del feedback settimanale (Panoramica, «Da fare», Impostazioni › Feedback settimanale). Contiene i problemi verificati il 13 ottobre 2026 e le soluzioni proposte.

**Stato**: verifica conclusa il 13 ottobre 2026 sul commit `bffb69a` (ramo `feedback-e-sidebar`, dopo la 1.1.0). Durante la verifica nessuna modifica al codice o ai dati. È una fotografia: lo stato corrente resta nei file di stato in `docs/`.

## Perché

L'[audit UI/UX completo](../2026-10-ux-ui-completo/02-panoramica-e-feedback.md) aveva guardato il feedback solo per la posizione nella Panoramica (UX-10) e per il caso dell'atleta senza email (UX-11). Su richiesta del coach, questa verifica copre la card del feedback in tutti i suoi stati, le azioni, il testo da approvare, lo storico e la preparazione di un'altra settimana.

## Metodo

- **Codice**: `WeeklyReviews.vue`, `stores/reviews.ts`, `help/fieldHelp.ts` (`review.flow`), `domain/todo.ts`, `useAthleteAnomalies.ts`, `weekly-feedback/index.ts` (azioni `create`, `regenerate`, `retry`, `approve`).
- **Esecuzione**: Playwright con il backend finto degli e2e, a 1440×900 e 390×844, con sette settimane in stati diversi:
  - in preparazione;
  - da approvare, versione 2, con la versione 1 già inviata;
  - approvato, con email non partita;
  - inviato;
  - nessuna seduta;
  - non riuscito.

  Testo del feedback realistico (circa 700 caratteri, cinque paragrafi). Per `regenerate` e `create` le risposte riproducono quelle del server reale. Lo script è in [`evidence/cattura.spec.ts.txt`](evidence/cattura.spec.ts.txt).
- **Non verificato**: lettore di schermo, dispositivo reale, email ricevuta dall'atleta.

Stato della verifica: **E** esecuzione, **C** codice.

## Cosa funziona

- Ogni stato ha icona e testo, mai solo colore; «In preparazione» si aggiorna da solo.
- Con un feedback da approvare, il testo è visibile senza scorrere: a 1440 px inizia a 515 px dall'alto, a 390 px a 522 px (criterio di UX-10 rispettato).
- «Da fare» elenca bozze, invii non riusciti e feedback non riusciti delle ultime quattro settimane, con il link alla settimana (`da-fare-1440.png`).
- Il pulsante dice «Approva e invia» solo quando l'email partirà davvero; la nota sotto spiega i casi senza invio.
- La sezione nelle Impostazioni è compatta e ha la sua guida (`impostazioni-feedback-1440.png`).

## Problemi

<a id="fb-01"></a>
### FB-01 — «Rigenera» butta il testo modificato, anche quando la rigenerazione non riesce · P1

- **Osservabile**: il coach corregge il testo della bozza e preme «Rigenera». Il testo torna quello di Claude senza conferma. Succede anche se il server risponde con un errore («La valutazione è in elaborazione: riprova tra poco»): l'errore compare, la correzione è persa.
- **Evidenza**: `WeeklyReviews.vue`, `onRegenerate` (`delete drafts[r.id]` prima della chiamata); esecuzione: dopo un «Rigenera» non riuscito il campo contiene di nuovo «Ciao Giulia, settimana solida…».
- **Verifica**: E.
- **Soluzione**:
  - se il testo è stato modificato, «Rigenera» chiede conferma («Rigenerando perdi le tue modifiche al testo»);
  - la bozza locale si cancella solo dopo una rigenerazione riuscita.
- **Criteri**: e2e: con il testo modificato, «Rigenera» chiede conferma; con «Annulla» o con un errore del server il testo resta quello del coach.

<a id="fb-02"></a>
### FB-02 — Il testo modificato si perde uscendo dalla scheda, senza avviso · P1

- **Osservabile**: il coach modifica il testo, va in Impostazioni o su un altro atleta. Nessuna domanda: tornando, il testo è quello originale. Intanto la nuvola dell'intestazione resta verde («Scheda salvata»), perché segue solo il Profilo.
- **Evidenza**: `WeeklyReviews.vue` (`drafts` locale al componente); esecuzione: uscita verso Impostazioni senza dialogo, al ritorno il testo è quello di Claude.
- **Verifica**: E.
- **Soluzione**: il testo modificato e non approvato conta come modifica non salvata. L'uscita dalla scheda chiede conferma come per il Profilo («Esci senza salvare» / «Resta»), e la nuvola diventa rossa.
- **Alternativa**: salvare la bozza del testo sul server a ogni modifica (serve una colonna o un'azione nuova in `weekly-feedback`: più robusto, anche fra dispositivi, ma tocca il server).
- **Criteri**: e2e: testo modificato → nuvola rossa; uscita verso Impostazioni → dialogo; «Resta» mantiene il testo.

<a id="fb-03"></a>
### FB-03 — «Prepara il feedback» su una settimana che ha già un feedback · P2

- **Osservabile**:
  - il selettore parte dalla settimana scorsa, che di solito ha già il feedback del lunedì, e non indica quali settimane ce l'hanno già;
  - su una settimana già approvata, il server restituisce il feedback esistente senza rifarlo. L'app mostra «Valutazione in corso: riprova tra poco per vedere il risultato», che è falso;
  - la guida dice «per rivalutarla, usa Prepara il feedback»: non succede, serve «Rigenera».
- **Evidenza**: `weekly-feedback/index.ts` (`create`: `claim` con `ignoreDuplicates`, poi `current`); `stores/reviews.ts` (`statusMessage`: ogni stato non previsto diventa «in corso»); `fieldHelp.ts` (`review.flow`); esecuzione.
- **Verifica**: E, C.
- **Soluzione**:
  - nel selettore solo le settimane senza feedback (o con «già preparato» accanto, disattivate);
  - con tutte le settimane già preparate, al posto del selettore una riga: «Tutte le ultime sei settimane hanno un feedback»;
  - messaggio corretto se il feedback esiste già: «Questa settimana ha già un feedback: usa Rigenera»;
  - guida corretta.
- **Criteri**: il selettore non propone settimane già preparate; nessun messaggio «in corso» per un feedback approvato.

<a id="fb-04"></a>
### FB-04 — Lo storico mostra per intero ogni feedback già approvato · P2

- **Osservabile**: ogni settimana approvata mostra conteggi, limitazioni, «Per te» e tutto il testo inviato, più «Rigenera». Con quattro settimane la sezione è lunga 2,2 schermi a 1440 px e 2,8 a 390 px; con «Mostra tutti» 2,7 e 3,4. L'informazione utile per la settimana passata è quasi sempre solo «inviato il …» o «email non partita».
- **Evidenza**: `feedback-1440.png`, `feedback-390.png`, `feedback-tutti-1440.png`.
- **Verifica**: E.
- **Soluzione**: le settimane approvate, saltate e non riuscite diventano una riga chiusa (settimana, stato, data d'invio) che si apre con un clic, come le sezioni del Profilo. La bozza da approvare resta aperta.
- **Criteri**: con una bozza e tre settimane approvate, la sezione sta in 1,2 schermi a 1440 px.

<a id="fb-05"></a>
### FB-05 — Il testo da approvare si legge dentro un riquadro da 8 righe · P2

- **Osservabile**: un feedback reale (cinque paragrafi) supera le 8 righe del campo: per leggerlo tutto prima di approvarlo bisogna scorrere dentro il riquadro, e su telefono scorrere la pagina e il riquadro.
- **Evidenza**: `bozza-sedute-1440.png`; `WeeklyReviews.vue` (`rows="8"`).
- **Verifica**: E.
- **Soluzione**: il campo cresce con il testo (altezza automatica, senza scorrimento interno).
- **Criteri**: con il testo di prova, nessuno scorrimento dentro il campo a 1440 e 390 px.

<a id="fb-06"></a>
### FB-06 — «Invia anche questa versione» sta sotto i pulsanti che cambia · P2

- **Osservabile**: la casella decide se il pulsante dice «Approva» o «Approva e invia», ma sta sotto i pulsanti. Si legge dopo aver deciso.
- **Evidenza**: `bozza-sedute-1440.png`.
- **Verifica**: E.
- **Soluzione**: la casella sopra i pulsanti, subito sotto il testo.
- **Criteri**: nell'ordine di lettura la casella viene prima di «Approva».

<a id="fb-07"></a>
### FB-07 — «Email non inviata» compare in fondo, dopo tutto il testo · P2

- **Osservabile**: per un feedback approvato ma non partito, il motivo e «Riprova l'invio» stanno dopo il testo intero (circa 500 px sotto il badge, a 1440 px). Il messaggio del provider è mostrato così com'è («Il provider ha rifiutato l'indirizzo (422)»), dopo «Email non inviata:» con la maiuscola.
- **Evidenza**: `feedback-1440.png` (28 set – 4 ott).
- **Verifica**: E.
- **Soluzione**: motivo e «Riprova l'invio» subito sotto l'intestazione della settimana; con FB-04 il testo inviato resta chiuso.
- **Criteri**: «Riprova l'invio» visibile senza aprire il testo.

<a id="fb-08"></a>
### FB-08 — Etichette poco chiare: «Per te», limitazioni, conteggi · P3

- **Osservabile**:
  - «Per te:» è la sintesi per il coach, ma non si capisce per chi;
  - le limitazioni dei dati sono un elenco grigio senza titolo;
  - i conteggi sono parole separate solo da spazi («4 sedute assegnate 3 svolte 1 senza attività registrata …»).
- **Verifica**: E.
- **Soluzione**: «Sintesi per te» (o «Per il coach»); «Limiti dei dati:» davanti all'elenco; conteggi separati da virgole in una frase («4 sedute assegnate: 3 svolte, 1 senza attività registrata; completamento 75%»).

<a id="fb-09"></a>
### FB-09 — Ridondanze negli stati senza testo · P3

- **Osservabile**: una settimana senza sedute dice tre volte la stessa cosa: badge «Nessuna seduta da valutare», «0 sedute assegnate», «In quella settimana non c'erano sedute approvate».
- **Verifica**: E.
- **Soluzione**: solo il badge e la frase; niente conteggi a zero.

## Osservazioni senza intervento

- «Approva e invia» non chiede conferma: il nome del pulsante dice cosa succede ed è l'azione principale del lunedì. Una conferma in più rallenterebbe il gesto più frequente.
- «Tono del feedback» nelle Impostazioni contiene `{{nome_atleta}}`: la guida lo spiega («diventa il nome»).
- I feedback non riusciti più vecchi di quattro settimane non compaiono in «Da fare»: è la stessa finestra della tab Anomalie, scelta voluta.

## Priorità proposta

| Ordine | Punti | Perché |
|---|---|---|
| 1 | FB-01, FB-02 | si perde lavoro del coach senza avviso |
| 2 | FB-03, FB-05, FB-06, FB-07 | messaggi sbagliati e ordine di lettura nell'azione del lunedì |
| 3 | FB-04 | lunghezza della Panoramica |
| 4 | FB-08, FB-09 | testi |

Nessun punto richiede modifiche al server, salvo l'alternativa di FB-02.

## Esito

Il 13 ottobre 2026 il coach ha approvato tutte le soluzioni, compreso il salvataggio sul server del testo corretto (alternativa di FB-02), con due cambi: nessuna scritta di stato sotto il campo, perché basta la nuvola, e nessun «Ripristina il testo di Claude». Decisione in [decisioni/0038](../../decisioni/0038-bozza-del-feedback-salvata-e-storico-compatto.md), test in `app/e2e/feedback-ui.spec.ts`.

Misure con lo stesso script e gli stessi dati (catture in [`evidence/dopo/`](evidence/dopo/)):

| Misura | Prima | Dopo |
|---|---|---|
| Sezione, 4 settimane, 1440 px | 2,2 schermi | 1,3 |
| Sezione, 4 settimane, 390 px | 2,8 schermi | 1,6 |
| Sezione, tutte le settimane, 1440 px | 2,7 schermi | 1,6 |
| Sezione, tutte le settimane, 390 px | 3,4 schermi | 2,1 |
| Scorrimento dentro il campo del testo | sì | no |

Il criterio di FB-04 (1,2 schermi a 1440 px) non è raggiunto del tutto: la bozza aperta, con il testo intero ora che il campo cresce (FB-05), occupa da sola quasi uno schermo.
