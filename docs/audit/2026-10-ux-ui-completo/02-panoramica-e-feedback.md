# 02 — Panoramica e feedback settimanale

**Quando leggerlo**: per i problemi della tab Panoramica (carico e forma, settimana in corso) e del flusso del feedback settimanale, dall'interfaccia al server. Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

## Cosa funziona

- Ogni stato del feedback ha icona e testo, mai solo colore. «In preparazione» si aggiorna da solo.
- Il pulsante dice «Approva e invia» oppure «Approva» in base all'email: la regola è giusta, il problema è il seguito (UX-11).
- Lo stato vuoto del grafico spiega da dove arrivano i dati e porta alla chiave.

## Problemi

<a id="ux-10"></a>
### UX-10 — Il feedback da approvare è l'ultimo contenuto della Panoramica · P2

- **Osservabile**: ordine attuale:
  1. grafico;
  2. «Questa settimana»;
  3. titolo e testo esplicativo del feedback;
  4. selettore della settimana e «Prepara il feedback», un'azione rara;
  5. elenco delle settimane, dove la bozza da approvare è la prima.
  
  A 1440 px la bozza inizia a circa 850 px dall'alto; a 390 px dopo più di uno schermo e mezzo. L'azione frequente del lunedì è quindi sotto quella rara.
- **Evidenza**: `runtime/1440-panoramica.png`; `WeeklyReviews.vue` (`review-create` prima di `feedback-list`).
- **Verifica**: E.
- **Causa radice**: RC-3 e la gerarchia per frequenza d'uso.
- **Soluzione**: se c'è un feedback in bozza, compare in cima alla Panoramica come prima sezione («Feedback da approvare: settimana 5-11 ott»). «Prepara il feedback» scende in fondo alla sezione, come azione secondaria («Prepara il feedback di un'altra settimana»). Il testo esplicativo va nel `<details>` (D-04).
- **Alternative**: lasciare l'ordine e aggiungere un link «Vai al feedback» in alto (meno chiaro).
- **Criteri**: con un feedback in bozza, il campo del testo è visibile senza scorrere a 1440×900; a 390 px è il primo contenuto sotto le tab.
- **Test**: e2e che verifica la posizione (`boundingBox().y < viewport.height`).

<a id="ux-11"></a>
### UX-11 — Atleta senza email con l'invio attivo: l'interfaccia promette una cosa e ne segnala un'altra · P2 (latente)

- **Osservabile**:
  - con l'email attiva in Impostazioni e un atleta senza indirizzo, la bozza mostra «Approva» e la nota «L'atleta non ha un indirizzo email: approvando, il feedback resta solo qui»;
  - dopo l'approvazione, il server chiede comunque l'invio (`delivery_status: "pending"`) e lo chiude come `skipped` («L'atleta non ha un indirizzo email.»);
  - l'interfaccia mostra allora il badge rosso «Approvato, email non inviata» e la tab Anomalie aggiunge «Feedback … approvato ma non inviato» come errore che «ferma il feedback settimanale».
- **Evidenza**:
  - `WeeklyReviews.vue` (nota con `!hasEmail`; `wantsSend` non considera l'indirizzo);
  - `pipeline.ts:360-367` (`approveReview` chiede l'invio se l'email è attiva) e `pipeline.ts:265-271` (`deliver`, `skipped`);
  - `useAthleteAnomalies.ts` (anomalia per `failed` o `skipped`);
  - schermate con lo stato iniettato: `runtime/1440-panoramica.png` (secondo feedback) e `runtime/1440-anomalie.png`.
- **Verifica**: C per il percorso completo; E per la resa, con uno stato iniettato nel backend finto. Il backend finto risponde sempre `not_requested`, quindi gli e2e esistenti non coprono il caso.
- **Produzione**: latente. Lettura del 13 ottobre: invio email disattivato e nessun feedback `skipped`.
- **Impatto**: appena il coach attiva l'email, ogni atleta senza indirizzo genera un errore e un'anomalia per un comportamento che l'interfaccia aveva annunciato come normale. Il segnale d'errore perde valore.
- **Soluzione**: senza indirizzo l'app approva con `send = false`, come per una revisione già inviata, quindi `not_requested`; la nota resta. Lato server, un `skipped` per indirizzo mancante non è un'anomalia. Decisione D-05.
- **Alternativa**: lasciare il comportamento e cambiare la nota («verrà segnalato come non inviato»). È più onesta ma rumorosa.
- **Criteri**: con email attiva e atleta senza indirizzo, dopo «Approva» il badge è «Approvato» (neutro) e nessuna anomalia.
- **Test**: e2e nuovo con il backend finto che segue `approveReview` reale; unità sulla pipeline.

<a id="ux-12"></a>
### UX-12 — «Questa settimana»: la riga dice «Apri …» ma non apre la seduta · P3

- **Osservabile**: le righe in sola lettura hanno il nome accessibile «Apri <seduta>, <giorno>». Il clic porta alla tab Piano sulla settimana corrente, senza aprire il pannello.
- **Evidenza**: `AthleteEditor.vue:340` (`@open="tab = 'piano'"`), `WorkoutRow.vue` (`aria-label`).
- **Verifica**: C.
- **Soluzione**: aprire il pannello (`router.push` con `tab: 'piano'`, `query: { seduta }`), come fanno già le anomalie.
- **Criteri**: un clic su una riga della Panoramica apre quella seduta; «indietro» torna alla Panoramica.

<a id="ux-13"></a>
### UX-13 — Testi del grafico sotto i 12 px · P3

- **Osservabile**: 7 testi del grafico (etichette degli assi e date) hanno un corpo inferiore a 12 px, sotto il minimo `--fs-xs` delle regole grafiche.
- **Evidenza**: `misure.jsonl` (`smallText: 7` solo nelle Panoramiche), `LoadMetricsChart.vue`.
- **Verifica**: E (misura), non verificata la leggibilità su dispositivo.
- **Soluzione**: etichette SVG a 12 px, oppure fuori dall'SVG come la legenda.
- **Criteri**: `smallText = 0` nello script di cattura.

## Osservazioni senza intervento

- La densità di ogni voce di feedback (conteggi, sedute, limitazioni, «Per te», testo) è alta ma motivata: è il materiale per decidere se approvare. Con UX-10 e D-04 il carico si riduce senza togliere informazioni.
- «Mostra tutti» dopo 4 settimane va bene.
