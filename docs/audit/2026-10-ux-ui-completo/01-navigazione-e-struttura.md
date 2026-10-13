# 01 — Navigazione e struttura della scheda

**Quando leggerlo**: per i problemi della barra laterale, dell'intestazione e delle tab della scheda atleta, della tab Anomalie e della mancanza di una vista d'insieme fra atleti. Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

## Cosa funziona

- La rotta contiene atleta, tab, seduta e dialogo: un ricaricamento torna alla stessa vista e «indietro» chiude pannelli e dialoghi (ADR 0023). Verificato dagli e2e esistenti.
- Le guardie sulle modifiche non salvate coprono cambio di atleta, Impostazioni, nuovo atleta, «Esci» e chiusura della pagina.
- Ordine di tabulazione naturale. Focus visibile (contorno o alone) su tutti i 25 elementi attraversati nella Panoramica a 1440 px (E, `misure.jsonl`, `focus-order-panoramica`).
- Nessun controllo senza nome accessibile, in nessuna pagina e a nessuna larghezza (E).

## Problemi

<a id="ux-01"></a>
### UX-01 — Nessuna vista di ciò che richiede attenzione fra tutti gli atleti · P1

- **Area**: sidebar, home `/`, tab Anomalie, Panoramica.
- **Osservabile**: la sidebar mostra per ogni atleta discipline e ultimo TSB. Feedback da approvare, anomalie, bozze da approvare e sedute da verificare si vedono solo aprendo l'atleta, e ognuno in una tab diversa: il feedback in Panoramica, in fondo; le anomalie nella quarta tab; le bozze nel Piano, settimana per settimana. La home dice «Scegli un atleta» e non mostra altro.
- **Evidenza**: `AthleteSidebar.vue` (`items`: solo discipline e TSB); `EmptyState.vue`; `useAthleteAnomalies.ts`, che calcola tutto sull'atleta aperto (`athletes.currentId`) e legge zone e soglie da Intervals.icu solo all'apertura (`watch([currentId, apiKey], load)`); `WeeklyReviews.vue` per atleta. Screenshot `runtime/1440-panoramica.png`, `runtime/1440-anomalie.png`.
- **Verifica**: C, E.
- **Causa radice**: RC-3, l'attenzione è calcolata solo per l'atleta aperto.
- **Impatto**: ogni lunedì, con 4 atleti, servono almeno 4 aperture e 8 cambi di tab per sapere dove agire. Un'anomalia che ferma il feedback o l'invio di un atleta non aperto resta invisibile. Il rischio cresce con il numero di atleti.
- **Dipendenze**: UX-10, UX-14; decisione D-01.
- **Soluzione raccomandata**: home «Da fare» con un blocco per atleta: feedback da approvare, bozze da approvare nelle prossime 2 settimane, sedute da verificare, invii non riusciti, feedback fermi. Ogni voce è un link che apre il punto esatto (`?seduta=`, `#sec-feedback`). In sidebar un indicatore numerico per atleta, calcolato su dati già nel database.
  - Zone e soglie diverse da Intervals.icu richiedono una chiamata a Intervals.icu per atleta: o si calcolano all'apertura della home (4 chiamate, ma lente e con la stessa chiave), o restano nella scheda, o si spostano in un controllo lato server pianificato. È la parte da decidere.
- **Alternative considerate**: solo indicatori in sidebar (meno spazio, nessun dettaglio); un riepilogo settimanale via email al coach (fuori dall'app).
- **Criteri di accettazione**:
  - dalla home ogni feedback da approvare e ogni seduta da verificare è a un clic;
  - un atleta senza nulla da fare non occupa spazio;
  - con zero voci la home lo dice («Niente da fare»);
  - l'indicatore della sidebar ha un nome accessibile («2 da fare»).
- **Test**: e2e con due atleti, uno con un feedback in bozza e una seduta da verificare, l'altro senza nulla; unità sulla funzione che compone l'elenco.

<a id="ux-03"></a>
### UX-03 — A 320 px la barra delle tab trabocca · P2

- **Osservabile**: con 4 tab e il numero delle anomalie, la tab «Anomalie» esce di 3 px dal bordo; il numero è tagliato e la pagina scorre in orizzontale. Accade in tutte le viste della scheda.
- **Evidenza**: `runtime/320-anomalie.png`; sonda: `button.tab right=323`, `span.tab-count right=323`; `hOverflow: true` per le pagine atleta a 320 in `misure.jsonl`.
- **Verifica**: E.
- **Causa**: `.tabs` non va a capo né scorre, e la quarta tab è arrivata dopo le verifiche a 320 px dell'audit precedente.
- **Soluzione**: `.tabs` scorrevole in orizzontale senza barra visibile, con la tab attiva portata in vista, oppure un gap ridotto sotto i 360 px.
- **Criteri**: nessuno scorrimento orizzontale a 320 px con 4 tab e un numero a due cifre.
- **Test**: misura automatica nello script di cattura; e2e mobile con `scrollWidth <= clientWidth`.

<a id="ux-04"></a>
### UX-04 — Eliminazione dell'atleta dalla barra di navigazione · P2

- **Osservabile**: ogni voce della sidebar ha una «X» che elimina la scheda, sempre visibile sui dispositivi touch. La stessa azione è in Profilo › Gestione scheda con l'icona del cestino. Altrove la «X» significa «chiudi» (pannello, dialoghi, toast).
- **Evidenza**: `AthleteSidebar.vue` (`del-btn` con `X`); `AthleteEditor.vue` (`Elimina scheda` con `Trash2`); [design-ui.md § Layout](../../design-ui.md#layout).
- **Verifica**: C, E (sidebar a 390 px).
- **Impatto**: un'azione irreversibile si trova accanto alla navigazione più usata, con un'icona che altrove vuol dire altro. La conferma c'è e mitiga il rischio, ma resta rumore visivo in ogni riga.
- **Soluzione**: togliere la «X» dalla sidebar (decisione D-06).
- **Alternativa**: cambiare l'icona in `Trash2` e mostrarla solo sulla voce aperta.
- **Criteri**: un solo punto di eliminazione; nessuna icona d'azione nelle voci della sidebar.

<a id="ux-05"></a>
### UX-05 — Riga di riepilogo sotto il titolo · P3

- **Osservabile**: «Corsa, Bici», «Prossimo evento: …», «Aggiornata il 1 set 2026». Su mobile occupa 3 righe sopra le tab, ripetute in ogni vista. «Aggiornata il» si riferisce al salvataggio della scheda, ma si legge come aggiornamento dei dati di carico.
- **Evidenza**: `runtime/390-piano-storico.png`, `AthleteEditor.vue:293-298`.
- **Verifica**: E.
- **Soluzione**: su mobile solo il prossimo evento. «Aggiornata il» diventa «Scheda salvata il» e si sposta nel Profilo, accanto a «Salva».
- **Criteri**: a 390 px le tab iniziano entro 200 px dall'alto.

<a id="ux-06"></a>
### UX-06 — Struttura dei titoli · P3

- **Osservabile**: l'unico `h1` è «PCoach» nella sidebar. Su mobile la sidebar è chiusa, quindi la pagina non ha un `h1` visibile; il titolo della pagina è un `h2`.
- **Evidenza**: `AthleteSidebar.vue:72`, `AthleteEditor.vue:282`, `SettingsPanel.vue:71`.
- **Verifica**: C.
- **Soluzione**: titolo della pagina in `h1`; marchio della sidebar come testo o `p`.
- **Criteri**: un solo `h1` per vista, uguale al titolo della pagina.

## Tab Anomalie

La tab fa ciò che l'ADR 0031 descrive e lo fa bene: gruppi per ciò che si ferma, conseguenza sotto il titolo, azione per ogni voce (`runtime/1440-anomalie.png`). Due limiti:

<a id="ux-14"></a>
### UX-14 — «Apri il feedback» porta alla sezione, non alla settimana · P3

- **Osservabile**: l'azione cambia tab e scorre fino a «Feedback settimanale». Se la settimana in errore non è fra le 4 mostrate, o se ce ne sono più di una, il coach la deve cercare.
- **Evidenza**: `AthleteEditor.vue:267-271` (`openFeedback` senza id).
- **Verifica**: C.
- **Soluzione**: ancora per feedback (`#feedback-<id>`), con «Mostra tutti» aperto se serve.
- **Criteri**: l'azione porta la settimana indicata in cima alla vista.

Che il conteggio sia l'unico richiamo fuori dalla tab è una scelta del coach (ADR 0033) e non viene messo in discussione qui. Il problema di fondo, cioè vedere le anomalie senza aprire l'atleta, è UX-01.
