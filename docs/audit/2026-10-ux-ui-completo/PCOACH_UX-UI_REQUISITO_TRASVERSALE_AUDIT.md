## Requisito trasversale — Versionamento applicazione e CHANGELOG

Durante l'audit completo di PCoach, analizza anche come rendere identificabile la versione dell'applicazione nell'interfaccia e come garantire la coerenza del versionamento con la documentazione del progetto.

### A. Analisi dello stato attuale

Prima di proporre modifiche, verifica:

- Come viene attualmente definita la versione dell'applicazione.
- Se esiste un campo `version` in `package.json`, in altri manifest o nei metadati di build.
- Se esistono tag Git, convenzioni di release, pipeline CI/CD o processi di distribuzione che determinano la versione.
- Se la versione viene già mostrata nell'interfaccia.
- Se esiste un `CHANGELOG.md` e quale formato e convenzione utilizza.
- Se esistono script o procedure per aggiornare versione, changelog e artefatti di build.
- Se frontend e backend vengono distribuiti insieme oppure possono avere versioni differenti.

Non assumere che il numero presente in un singolo file rappresenti necessariamente la versione effettivamente distribuita.

### B. Identificazione della versione nella UI

Progetta una soluzione coerente con il design system e con l'obiettivo generale di ridurre il rumore visivo.

Valuta:
- Una dicitura discreta nella parte inferiore della sidebar.
- La visualizzazione della versione completa in una sezione Informazioni dell'applicazione.
- L'eventuale collegamento alle note di rilascio.
- La resa su desktop, tablet e smartphone, compresi i layout con sidebar collassata o navigazione alternativa.

Non aggiungere elementi visivi prominenti o nuove sezioni se non producono un beneficio concreto.

La versione deve essere leggibile, accessibile e sufficientemente facile da trovare per consentire all'utente di comunicarla durante una segnalazione di bug.

Se utile, distingui:
- Versione applicativa, ad esempio `1.4.0`.
- Identificativo della build o del commit, se disponibile.
- Ambiente, soltanto se necessario per distinguere installazioni differenti.

Non mostrare chiavi, segreti, variabili sensibili o dettagli interni non destinati all'utente.

### C. Fonte attendibile della versione

Individua e raccomanda una fonte attendibile per la versione applicativa.

Evita versioni duplicate, stringhe hardcoded in più componenti e aggiornamenti manuali non coordinati.

La soluzione deve essere compatibile con lo stack e il processo di rilascio effettivi di PCoach.

Verifica in particolare il rischio che:
- La UI mostri una versione diversa da quella distribuita.
- Una build di produzione mostri un valore predefinito o obsoleto.
- Il frontend e il backend riportino versioni incompatibili.
- Il numero di versione venga confuso con un numero di build o con un commit.

Se la versione è iniettata durante la build, valuta anche come gestire sviluppo locale, build CI e distribuzione.

### D. CHANGELOG e disciplina di rilascio

Analizza il `CHANGELOG.md` esistente e la convenzione di versionamento adottata.

Se non esistono convenzioni consolidate, proponi una soluzione semplice e sostenibile, valutando Semantic Versioning quando appropriato.

Definisci regole chiare per:
- Quando aggiornare il changelog.
- Come raggruppare le modifiche, ad esempio Added, Changed, Fixed, Removed e Security.
- Come distinguere le modifiche tecniche interne da quelle rilevanti per gli utenti.
- Come collegare le voci del changelog alle versioni rilasciate.
- Come evitare incongruenze tra manifest, versione mostrata in UI, tag Git e release pubblicate.

Non inventare versioni già rilasciate e non attribuire a una release modifiche che non sono effettivamente incluse.

Se esistono modifiche non ancora rilasciate, valuta una sezione `Unreleased`, coerentemente con il formato esistente.

### E. Regola per le modifiche future

Proponi un processo nel quale ogni modifica significativa venga accompagnata dall'aggiornamento della documentazione pertinente.

Non incrementare automaticamente la versione per ogni commit senza aver definito una convenzione esplicita.

Distingui:
- Modifica in corso di sviluppo.
- Aggiornamento delle note `Unreleased`.
- Preparazione di una release.
- Incremento della versione.
- Pubblicazione della release.

Valuta quali controlli automatici possano impedire che una release venga pubblicata con documentazione incoerente o mancante.

L'eventuale automazione deve essere proporzionata al processo di sviluppo effettivo del progetto.

### F. Decisioni e deliverable

Durante la fase di audit non modificare il codice applicativo e non incrementare la versione.

Produci:
1. Analisi del sistema di versionamento attuale.
2. Raccomandazione sulla posizione e sul comportamento della versione nella UI.
3. Fonte attendibile del dato e modalità di esposizione al frontend.
4. Convenzione proposta per il CHANGELOG.
5. Processo di aggiornamento per modifiche e release.
6. Test e controlli automatici raccomandati.
7. Eventuali decisioni da sottopormi prima dell'implementazione.

Integra questo requisito nell'audit generale, verificando le dipendenze con l'architettura esistente. Non trattarlo come un intervento isolato.