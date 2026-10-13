# PCoach — Full Application UI/UX Audit

Agisci come un team multidisciplinare composto da:

- Staff/Senior Frontend Engineer.
- Senior UI/UX Designer.
- Product Designer esperto di information architecture e interaction design.
- Accessibility Specialist.
- Product Manager.
- QA Engineer specializzato in test end-to-end e responsive design.

Repository: quello corrente di PCoach.

## 1. Obiettivo

Voglio eseguire un audit completo della UI e della UX di tutta l'applicazione.

L'obiettivo è rendere PCoach semplice da comprendere e utilizzare, riducendo il rumore visivo e la quantità di informazioni che l'utente deve elaborare contemporaneamente, senza perdere funzionalità, informazioni importanti o possibilità di approfondimento.

Il principio guida è:

**Mostrare immediatamente ciò che serve per agire, rendere facilmente accessibile ciò che serve per capire e non sovraccaricare l'interfaccia con informazioni secondarie.**

Gli screenshot della pagina Impostazioni forniti nel contesto costituiscono un primo esempio di un problema più ampio: la progressiva accumulazione di informazioni nell'interfaccia.

Non limitare l'analisi a questa pagina, ai problemi segnalati o agli screenshot forniti.

Devi scoprire autonomamente i problemi presenti nel resto dell'applicazione.

## 2. Prima di iniziare: skill e documentazione

1. Esamina le istruzioni iniziali del repository, inclusi README, CLAUDE.md e la documentazione pertinente.
2. Individua tutte le skill effettivamente disponibili nell'ambiente.
3. Identifica e leggi la skill frontend più pertinente, rispettandone le istruzioni.
4. Individua eventuali skill per browser automation, accessibility, testing e design review, se disponibili.
5. Verifica stack, architettura frontend, routing, componenti condivisi, design system e strumenti di test.
6. Individua i comandi documentati per installare, avviare, testare e compilare l'applicazione.
7. Verifica la presenza di test esistenti e dei meccanismi disponibili per eseguire l'applicazione e interagirvi.

Non inventare skill, strumenti, test eseguiti o funzionalità dell'ambiente. Se qualcosa non è disponibile, dichiaralo e indica quali verifiche possono comunque essere eseguite.

Non modificare il codice durante la fase di audit.

## 3. Inventario completo dell'applicazione

Prima di formulare raccomandazioni, ricostruisci l'intera superficie del prodotto.

Analizza:

- Tutte le route e le pagine raggiungibili.
- Le schermate principali e secondarie.
- I componenti condivisi e i layout.
- Menu, sidebar, navigazione e breadcrumb, dove presenti.
- Form, editor, tabelle, elenchi, card e pannelli.
- Modali, tooltip, popover, accordion, menu contestuali e altri elementi interattivi.
- Stati iniziali, caricamento, errore, successo, vuoto e disabilitato.
- Flussi di creazione, modifica, eliminazione, configurazione e salvataggio.
- Differenze tra utenti, atleti, ruoli o permessi, se previste dal prodotto.
- Pagine o funzionalità che dipendono da dati, configurazioni o servizi esterni.
- Comportamento della navigazione e gestione degli stati applicativi.

Ricostruisci i flussi attraverso il codice e verifica quelli effettivamente accessibili durante l'esecuzione.

Non confondere l'assenza di una route evidente con l'assenza di una funzionalità.

Se il progetto è troppo esteso per essere verificato in una sola passata, procedi per aree funzionali, mantenendo un inventario centrale e registrando esplicitamente le aree non ancora esaminate.

## 4. Analisi sistematica di ogni area

Valuta ogni pagina, flusso e componente significativo rispetto ai seguenti criteri.

### A. Gerarchia delle informazioni

- È immediatamente chiaro dove si trova l'utente?
- È chiaro quale sia l'azione principale?
- Le informazioni principali sono distinguibili da quelle secondarie?
- I titoli e le etichette sono comprensibili?
- Ci sono elementi che competono inutilmente per l'attenzione?
- Esistono ripetizioni, testi ridondanti o spiegazioni collocate male?
- Le informazioni sono organizzate secondo le esigenze dell'utente?

### B. Semplicità e densità informativa

- Quante informazioni vengono mostrate contemporaneamente?
- Quali sono indispensabili per completare il compito corrente?
- Quali sono utili soltanto in determinate circostanze?
- Quali informazioni possono essere sintetizzate senza perdere significato?
- Ci sono pagine eccessivamente lunghe o difficili da scansionare?
- L'utente deve leggere troppo prima di poter agire?
- Le funzionalità avanzate sono distinguibili da quelle ordinarie?

Non utilizzare il numero di elementi presenti come unico indicatore di complessità. Valuta il compito, il contesto e il carico cognitivo effettivo.

### C. Progressive disclosure e approfondimenti

Valuta criticamente quando utilizzare:

- Descrizioni brevi direttamente visibili.
- Controlli Info contestuali.
- Tooltip per informazioni molto brevi.
- Popover o pannelli per spiegazioni più articolate.
- Accordion o card espandibili per gruppi di impostazioni.
- Sezioni avanzate.
- Dialog, pannelli laterali o documentazione dedicata.

Non applicare automaticamente lo stesso pattern a tutte le pagine.

Per ogni proposta considera discoverability, numero di interazioni necessarie, accessibilità, uso su touch, conservazione dello stato e conseguenze sulla velocità d'uso.

Le informazioni essenziali per evitare errori non devono essere nascoste dietro controlli Info.

### D. Coerenza del prodotto

Confronta tutte le aree per identificare:

- Componenti simili con comportamenti diversi.
- Pattern di navigazione incoerenti.
- Differenze ingiustificate nelle etichette.
- Gerarchie visive non uniformi.
- Comportamenti di salvataggio differenti.
- Stati di caricamento, errore e conferma incoerenti.
- Controlli simili con semantiche diverse.
- Componenti duplicati che dovrebbero condividere un'implementazione.

Distingui le incoerenze reali dalle differenze giustificate dal contesto.

### E. Usabilità dei flussi

Per ogni flusso significativo verifica:

- Punto di ingresso e obiettivo.
- Passaggi richiesti.
- Chiarezza delle azioni.
- Feedback dopo ogni operazione.
- Gestione degli errori.
- Possibilità di annullare o recuperare un'operazione, dove pertinente.
- Prevenzione di errori evitabili.
- Coerenza tra risultato atteso e risultato ottenuto.
- Presenza di passaggi ridondanti o interruzioni non necessarie.

Individua anche i problemi che emergono dalla combinazione di più pagine, non soltanto quelli visibili all'interno di una singola schermata.

### F. Responsive design

Verifica l'esperienza su:

- Desktop.
- Tablet.
- Smartphone.

Controlla layout, navigazione, overflow, tabelle, form, modali, controlli touch, gerarchia visiva e leggibilità.

Non limitarti a verificare che gli elementi rientrino nello schermo: valuta se il flusso sia realmente utilizzabile sul dispositivo.

Utilizza viewport rappresentativi e documenta le dimensioni verificate.

### G. Accessibilità

Verifica, dove applicabile:

- Semantica HTML e struttura dei titoli.
- Etichette e nomi accessibili.
- Navigazione da tastiera.
- Focus visibile e ordine del focus.
- Contrasto e leggibilità.
- Stati e messaggi comunicati alle tecnologie assistive.
- Dialog e disclosure accessibili.
- Target touch.
- Zoom e ridimensionamento del testo.
- Conformità ai criteri WCAG pertinenti.

Non dichiarare conformità completa basandoti esclusivamente su controlli automatici o ispezioni visive.

### H. Qualità implementativa frontend

Analizza se i problemi di UX derivano anche da:

- Stato applicativo gestito in modo incoerente.
- Logica duplicata.
- Componenti troppo complessi.
- Assenza di primitive condivise.
- CSS fragile o sovrascritture accumulate.
- Gestione incompleta degli stati asincroni.
- Problemi di rendering o prestazioni che influenzano l'esperienza.
- Vincoli architetturali che ostacolano la coerenza dell'interfaccia.

Non proporre refactoring indiscriminati. Collega gli interventi tecnici a problemi verificati o a rischi concreti.

## 5. Valuta il prodotto anche senza una segnalazione esplicita

Non limitarti a verificare se le mie impressioni siano corrette.

Cerca attivamente:

- Problemi che l'utente potrebbe non essere in grado di descrivere.
- Informazioni difficili da trovare.
- Funzioni che sembrano disponibili ma non sono comprensibili.
- Flussi che richiedono conoscenze tecniche non necessarie.
- Comportamenti che producono incertezza.
- Incoerenze tra ciò che l'interfaccia promette e ciò che accade.
- Problemi di usabilità che emergono solo in combinazioni specifiche di dati o stati.

Se una soluzione da me ipotizzata è sbagliata, dichiaralo e proponi un'alternativa motivata.

Non inventare problemi per rendere l'audit più ricco.

## 6. Verifica visiva e runtime

Quando gli strumenti sono disponibili:

1. Avvia l'applicazione secondo le istruzioni del repository.
2. Naviga attraverso le pagine e i flussi reali.
3. Interagisci con i controlli significativi.
4. Verifica gli stati dopo le azioni.
5. Esegui test responsive.
6. Utilizza screenshot, browser automation e test automatici, se disponibili.
7. Confronta l'interfaccia osservata con il codice e con i requisiti.

Distingui esplicitamente:
- Verificato tramite esecuzione.
- Verificato tramite codice.
- Verificato soltanto tramite screenshot.
- Ipotesi non ancora confermata.
- Non verificabile con gli strumenti disponibili.

Non dedurre il comportamento runtime dal solo codice quando è possibile eseguirlo; non dichiarare verifiche runtime se l'esecuzione non è avvenuta.

## 7. Protezione della logica di prodotto

PCoach gestisce dati, configurazioni e flussi che possono influenzare la generazione dei piani e il feedback.

Prima di raccomandare modifiche, verifica le dipendenze funzionali.

Non compromettere:
- Persistenza e caricamento delle configurazioni.
- Gestione delle chiavi e dei dati sensibili.
- Compatibilità con i dati esistenti.
- Logica di generazione e feedback.
- Validazioni e vincoli.
- API e integrazioni.
- Permessi e sicurezza.
- Flussi già utilizzati dagli utenti.

Non modificare la semantica delle impostazioni per ottenere una semplificazione puramente visiva.

Quando una modifica UX richiede una scelta di prodotto o un cambiamento funzionale, esplicita la decisione e attendi la mia approvazione.

## 8. Priorità e causa radice

Per ogni problema rilevante registra:

- ID univoco.
- Area e route.
- Descrizione osservabile.
- Evidenza.
- Stato della verifica.
- Causa radice, se accertata.
- Impatto sull'utente.
- Gravità e priorità.
- Eventuali dipendenze da altri problemi.
- Soluzione raccomandata.
- Alternative considerate.
- Criteri di accettazione.
- Test necessari.

Usa queste priorità:

- P0: blocco critico o rischio grave.
- P1: problema importante in un flusso essenziale.
- P2: attrito significativo o incoerenza.
- P3: miglioramento secondario.

Separa la gravità del problema dalla facilità di risoluzione.

Raggruppa le segnalazioni che derivano dalla stessa causa radice e identifica i miglioramenti sistemici che possono risolvere più problemi contemporaneamente.

## 9. Decisioni da condividere

Non prendere autonomamente decisioni significative quando mancano requisiti o quando le alternative comportano compromessi di prodotto.

Per ogni decisione aperta:
- Spiega il problema.
- Presenta le alternative rilevanti.
- Illustra i compromessi.
- Indica la tua raccomandazione.
- Formula una domanda precisa.

Raggruppa le domande correlate in un unico momento decisionale.

Non interrompere il lavoro per dettagli implementativi ordinari, reversibili e coerenti con le convenzioni del progetto.

## 10. Deliverable e organizzazione dei report

Prima di creare nuovi file, controlla la struttura documentale esistente e riutilizza le convenzioni del repository.

Predisponi un audit navigabile, con un indice centrale e report per area funzionale, evitando sia un unico documento ingestibile sia una proliferazione di file troppo piccoli.

Il report centrale deve contenere:

1. Sintesi esecutiva.
2. Inventario delle pagine e dei flussi.
3. Copertura dell'audit.
4. Problemi più rilevanti.
5. Incoerenze e cause radice trasversali.
6. Raccomandazioni sul design system e sui pattern condivisi.
7. Decisioni richieste.
8. Roadmap di intervento.
9. Limiti delle verifiche effettuate.

I report per area devono documentare problemi, evidenze, impatto, raccomandazioni e criteri di accettazione.

Registra esplicitamente le aree non esaminate e le verifiche non completate. Non presentare l'audit come esaustivo se esistono parti non verificate.

Se generi screenshot di audit, collegali agli ID dei problemi e indica viewport e stato dell'interfaccia.

## 11. Vincoli operativi

Questa è una fase di sola analisi.

- Non modificare codice applicativo.
- Non modificare database, migrazioni, API o configurazioni runtime.
- Non effettuare operazioni distruttive.
- Non installare dipendenze senza autorizzazione.
- Non sovrascrivere documentazione esistente.
- Non risolvere direttamente i problemi durante l'audit.

Puoi creare i report dell'audit e i relativi indici, rispettando le convenzioni del progetto.

## 12. Criterio finale di successo

L'audit deve produrre una visione complessiva della qualità UI/UX di PCoach, non una semplice raccolta di osservazioni estetiche.

Voglio sapere:
- Dove si trovano i problemi.
- Quali sono realmente verificati.
- Perché si verificano.
- Quali sono sistemici.
- Quali interventi producono il maggiore beneficio per gli utenti.
- Quali decisioni devo prendere.
- Come verificare oggettivamente i miglioramenti.

Inizia dall'inventario e dall'analisi dell'intera applicazione. Non fermarti alla pagina Impostazioni e non passare all'implementazione.