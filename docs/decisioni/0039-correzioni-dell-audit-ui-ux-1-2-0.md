# 0039 — Correzioni dell'audit UI/UX della 1.2.0

**Quando leggerlo**: prima di cambiare i dialoghi di generazione, le conferme che proteggono lavoro non salvato, i toast, la barra laterale su telefono, il titolo della pagina o i controlli automatici di accessibilità.

**Stato**: attiva.

## Contesto

L'[audit UI/UX della 1.2.0](../audit/2026-10-ux-ui-1-2-0/README.md) ha trovato 27 problemi (A-01…A-27) più uno emerso durante le correzioni (A-28). Quasi nessuno era di layout: riguardavano stati non ancora caricati, tastiera e lettori di schermo, e casi d'errore che i flussi felici non toccano. Il coach ha deciso quattro punti (D-01…D-04) e ha approvato le correzioni a incrementi, ognuno con un test che riproduce il difetto.

## Decisione

1. **Valori iniziali solo da dati caricati** (A-01): un componente che si apre dall'URL calcola i valori iniziali da sedute e piani solo quando sono letti senza errori (`workouts.isLoadedFor`). Prima mostra un caricamento; con una lettura non riuscita mostra l'errore e «Riprova», e non prepara né applica una proposta.
2. **Il lavoro che costa si scarta solo con una conferma** (D-01, A-07): tornare ai parametri da una proposta di Claude o da una risposta incollata chiede «Scarta … e modifica i parametri» o «Tieni …». Senza nulla da perdere non chiede.
3. **Una navigazione annullata non cambia nulla** (A-28): la bozza di un nuovo atleta si chiude solo in `afterEach` di una navigazione completata. vue-router chiama `afterEach` anche per le navigazioni annullate dalla guardia, superate o duplicate, con il terzo argomento `failure`.
4. **Gli errori portano al punto da correggere** (A-06, A-14, A-15): una validazione rifiutata apre la sezione, segna il campo (`aria-invalid`, `aria-describedby`) e ci porta il focus; il toast si aggiunge, non sostituisce. La validazione precede ogni conferma.
5. **Toast** (D-02, A-08, A-19):
   - i messaggi informativi restano in base alla lunghezza (4 s più 60 ms per carattere, al massimo 10 s), si fermano con il puntatore o il focus e hanno il pulsante di chiusura;
   - sono errori, che restano, i fallimenti e i messaggi che spiegano perché un'azione non è partita;
   - nessun dettaglio tecnico del server nel testo.
6. **Barra laterale su telefono** (A-02, A-12, A-13): chiusa è `inert`; aperta, è `inert` il contenuto, così il focus resta nel drawer. Chi deve portare il coach a un campo con il drawer aperto lo chiude prima (`closeMobileSidebarFor`).
7. **Pagine navigabili** (A-03, A-10, A-11):
   - `scroll-padding-top` sotto l'intestazione sticky;
   - titoli senza salti di livello, con lo stile sulle classi e non sul tag;
   - titolo del documento «Pagina – Atleta – PCoach».
8. **Tema scuro dei controlli** (A-05): ogni blocco del tema dichiara `color-scheme`; il segnaposto usa `--text-muted`.
9. **Controllo automatico di accessibilità** (D-03): axe-core negli e2e, regole WCAG A e AA, 14 schermate nei due temi, con un test di sensibilità. Blocca la suite, ma non è una prova di conformità: tastiera, focus, lettori di schermo e comprensibilità restano verifiche manuali o test dedicati.
10. **Grafico del carico** (D-04, A-20): i valori giorno per giorno sono anche in una tabella espandibile sotto il grafico.

Scelte dell'assistente, da confermare:
- l'esempio di titolo del documento «Piano – Giulia Ferri – PCoach»;
- 2 secondi minimi alla ripresa di un toast messo in pausa;
- il drawer, aperto all'uscita, resta aperto dopo «Resta», con il focus sul pulsante che l'aveva chiesta.

## Conseguenze

- Ogni correzione ha un e2e o un unitario che fallisce sul codice precedente; gli e2e si eseguono con un solo worker.
- `@axe-core/playwright` è una dipendenza di sviluppo: un aggiornamento di axe può segnalare nuove violazioni senza che il codice cambi.
- Restano aperti, perché non inclusi negli incrementi approvati: A-04 (stati nel nome della riga), A-09 (nomi dei dialoghi e `aside` con `role="dialog"`), A-16, A-17, A-21, A-25. A-23 e A-24 sono valutazioni evolutive (stato nel report).
