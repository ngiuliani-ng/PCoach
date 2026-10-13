# Audit UI/UX di PCoach 1.2.0 (13 ottobre 2026)

**Quando leggerlo**: prima di correggere l'interfaccia dopo la 1.2.0, per sapere quali problemi sono verificati, con quale evidenza e in che ordine affrontarli. È una fotografia del 13 ottobre 2026 (commit `d9c4996`, versione 1.2.0): non descrive lo stato corrente dopo eventuali correzioni.

Gli audit precedenti ([2026-10-ux-e-usabilita](../2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md), [2026-10-ux-ui-completo](../2026-10-ux-ui-completo/README.md), [2026-10-feedback-settimanale-ui](../2026-10-feedback-settimanale-ui/README.md)) sono chiusi e i loro problemi risolti non sono ripetuti qui. Questo audit riparte dall'interfaccia della 1.2.0 e si concentra su ciò che quegli audit non avevano provato: tastiera, lettori di schermo, ricaricamenti con un dialogo aperto, casi d'errore, tema scuro e zoom.

Stato della verifica: **E** esecuzione nel browser, **C** lettura del codice, **I** ipotesi non verificata.

## A. Sintesi

**Stato generale**: buono. L'app regge le larghezze da 320 px a 1440 px e lo zoom al 200% senza scorrimento orizzontale. I campi sono etichettati e i contrasti calcolati sono sufficienti nei due temi. Il backend finto ha mostrato zero errori in console. I 217 test unitari e i 106 end-to-end passano. I problemi trovati non sono di layout: riguardano **stato non ancora caricato**, **tastiera e lettori di schermo**, e **casi d'errore** che i flussi felici non toccano.

**Rischi principali**:

1. **A-01 (P1)**: riaprendo la pagina con «Prosegui il piano» o «Ripianifica» aperti (ricaricamento, PWA riaperta, link), il dialogo calcola data di partenza e sedute da mantenere prima che le sedute siano caricate. «Prosegui» parte da domani invece che dopo il piano: le 4 sedute dei prossimi giorni risultano da sostituire. In «Ripianifica» la seduta bloccata («Mantienila se ripianifico») non è più spuntata. L'anteprima mostra le sostituzioni prima di applicare, ma il valore proposto è sbagliato.
2. **Navigazione da tastiera sotto i 720 px** (A-02, A-12) e **focus coperto dall'intestazione sticky** (A-03): sotto i 720 px, e quindi anche con lo zoom al 200% su un portatile, il Tab passa per 7 controlli invisibili della sidebar chiusa. Andando indietro con Shift+Tab, campi e caselle finiscono sotto l'intestazione.
3. **Informazioni perse per chi usa un lettore di schermo** (A-04): il nome della riga di una seduta è solo «Apri …, data». Gli stati («Bozza», «Invio non riuscito», «Da verificare») e la durata non vengono letti.
4. **Errori che non portano al punto da correggere** (A-06, A-14): salvando un nuovo atleta senza nome compare solo un toast, e la sezione Identità resta chiusa. Con un modello di zone non valido l'app chiede «Salvare?» e solo dopo rifiuta.
5. **Lavoro di Claude scartato senza conferma** (A-07): «Modifica i parametri» butta la proposta appena generata, che costa fino a due minuti e token.

**Cosa funziona bene** (verificato):
- nessuno scorrimento orizzontale in 168 combinazioni (21 schermate × 6 larghezze × 2 temi dove previsto);
- nessun controllo senza nome, nessun testo sotto i 12 px, nessun contrasto del testo sotto 4,5:1 nei due temi (calcolo approssimato, §E);
- comandi da 44 px al tocco, focus visibile, dialoghi con focus intrappolato ed Esc;
- URL che conserva pannelli e dialoghi, «indietro» che li chiude;
- stati sempre con icona e testo;
- toast con regioni live;
- rotte sconosciute che riportano alla home senza errori.

**Aree con il maggiore impatto**: dialoghi di generazione (A-01, A-07), layout mobile e tastiera (A-02, A-03, A-12, A-13), accessibilità di righe e dialoghi (A-04, A-09), messaggi d'errore e toast (A-06, A-08, A-14, A-15).

## B. Inventario delle rotte

Router: `app/src/router.ts`, cronologia con hash, base `/PCoach/`. Un solo utente (il coach); l'atleta non usa l'app. Le rotte sono 4 più il fallback; pannelli, dialoghi e guida sono parametri di query (`useQueryLayer`), e altri parametri portano a un punto della pagina.

| Rotta | Funzione | Componenti | Accesso | Stati verificati | Ingressi e uscite | Copertura | Problemi |
|---|---|---|---|---|---|---|---|
| (nessuna sessione) | Accesso del coach | `LoginView` | senza sessione | vuoto, errore di rete, credenziali errate | → app | E (6 larghezze), F12 | A-15 |
| `#/` | «Da fare» per tutti gli atleti | `TodoPage` | sidebar «Da fare», marchio | con voci, vuota, nessun atleta; errore (C) | link a feedback, piano, anomalie, sezioni | E | A-16 |
| `#/impostazioni` | Impostazioni globali | `SettingsPanel`, `ZoneModelsEditor`, `PageSection`, `SectionNav`, `GuidePanel` | ingranaggio in sidebar | chiusa, tutto aperto, modello non valido, guida | `?sezione=`, `?guida=` | E, F10 | A-10, A-14 |
| `#/atleta/nuovo` | Bozza di un nuovo atleta | `AthleteEditor` (Profilo) | «Nuovo atleta» | bozza vuota, salvataggio senza nome | → `#/atleta/:id/profilo` al primo salvataggio | E, F07 | A-06, A-24 |
| `#/atleta/:id/panoramica` | Feedback, carico, settimana in corso | `WeeklyReviews`, `FeedbackWeek`, `LoadMetricsChart`, `WorkoutRow` | sidebar, «Da fare» | con bozza del feedback in cima, senza bozza, email fallita | `?feedback=`; riga seduta → Piano `?seduta=` | E | A-18, A-20 |
| `#/atleta/:id/piano` | Settimana o storico delle sedute | `PlanTab`, `WorkoutRow`, `WorkoutBadges`, `StructureBar` | tab | settimana vuota, con sedute (5 stati), storico | `?settimana=`, `?seduta=`, `?dialogo=` | E, F21 | A-04, A-24 |
| `#/atleta/:id/profilo` | Scheda dell'atleta | `AthleteEditor`, `Profile*.vue`, `MetricLogList` | tab, link d'anomalia | chiuso, tutto aperto, guida, conferma eliminazione | `?sezione=`, `?guida=` | E, F19 | A-03, A-09 |
| `#/atleta/:id/anomalie` | Anomalie dell'atleta | `AnomaliesTab`, `useAthleteAnomalies` | tab con numero | con anomalie; «in controllo» (C) | link a Profilo, feedback, sedute | E | — |
| `?seduta=<id>` | Pannello della seduta | `WorkoutDrawer`, `StepEditor`, `StepFields` | riga della seduta, anomalie | bozza, annullata (sola lettura), id inesistente | `?seduta=` di un'altra seduta | E, F03, F20 | A-09, A-17, A-21 |
| `?dialogo=genera\|prosegui\|ripianifica` | Generazione con Claude | `RegenerateDialog` | pulsanti del Piano, URL | parametri, proposta, ritorno ai parametri, ricaricamento | → anteprima → applicazione | E, F08, F23, F24 | **A-01**, A-07, A-27 |
| `?dialogo=sincronizza` | Invio della settimana a Intervals.icu | `SyncWeekDialog` | «Sincronizza settimana» | anteprima, settimana vuota | esiti per riga | E (apertura); flusso completo negli e2e | — |
| `?guida=<gruppo>` | Guida di un gruppo di dati | `GuidePanel` | icona Info | aperta, chiave non valida (ignorata) | «indietro» la chiude | E | — |
| `/:pathMatch(.*)*` | Fallback | redirect a `#/` | URL sbagliato | `#/xyz`, tab non valida | → home | E, F11 | A-24 |
| (fuori dal router) | Conferme, toast, sidebar mobile | `ConfirmDialog`, `ToastHost`, `AthleteSidebar` | ovunque | conferma, toast informativo, drawer aperto e chiuso | — | E, F01-F03, F09 | A-02, A-08, A-09, A-12, A-13 |

**Rotte non raggiungibili dalla navigazione principale**: `?dialogo=genera` con un piano attivo (solo da URL), `?dialogo=sincronizza` su una settimana senza sedute (solo da URL: il pulsante è nascosto), `#/atleta/nuovo/<tab>` (URL costruito a mano).

**Flussi principali esaminati**: accesso; creazione di un atleta; consultazione della home; revisione del feedback; navigazione del Piano; apertura e modifica di una seduta; generazione fino all'anteprima e ritorno ai parametri; prosecuzione e ripianificazione dopo un ricaricamento; apertura della sincronizzazione; modifica e salvataggio delle Impostazioni con un errore; eliminazione (fino alla conferma). L'applicazione di una generazione, la sincronizzazione completa, l'approvazione del feedback e i salvataggi con conflitto sono coperti dai 106 e2e esistenti, rieseguiti tutti con esito positivo.

## C. Registro delle criticità

Ordinato per priorità. Il dettaglio di ogni voce è sotto la tabella.

| ID | P | Dove | Categoria | Problema | Verifica |
|---|---|---|---|---|---|
| [A-01](#a-01) | P1 | `RegenerateDialog` | Funzionale | Dopo un ricaricamento con il dialogo aperto: «Prosegui» parte da domani e propone di sostituire le sedute; la seduta bloccata non è più mantenuta | E (F23, F24) |
| [A-28](#a-28) | P1 | `router.ts` (bozza di nuovo atleta) | Funzionale, dati non salvati | Uscita annullata («Resta», o «Salva e continua» rifiutato): la bozza si chiude, quanto scritto è perso e la scheda resta su «Caricamento…». Trovato durante le correzioni | E (F25) |
| [A-02](#a-02) | P2 | Sidebar < 720 px | Accessibilità, responsive | Sidebar chiusa raggiungibile con il Tab ed esposta ai lettori di schermo | E (F01) |
| [A-03](#a-03) | P2 | Profilo, Impostazioni | Accessibilità | Il focus finisce sotto l'intestazione sticky (WCAG 2.4.11) | E (F19) |
| [A-04](#a-04) | P2 | `WorkoutRow` | Accessibilità | Il nome della riga nasconde stati e durata ai lettori di schermo | E (F03) |
| [A-05](#a-05) | P2 | Campi, tema scuro | Accessibilità, sistema visivo | Segnaposto «predefinito: N» a 3,55:1; controlli nativi chiari nel tema scuro | E (F22) |
| [A-06](#a-06) | P2 | Nuovo atleta | UX, errori | Senza nome: solo un toast, la sezione Identità resta chiusa, il campo non è segnato | E (F07) |
| [A-07](#a-07) | P2 | `RegenerateDialog` | UX | «Modifica i parametri» scarta la proposta di Claude senza dirlo né chiedere | E (F08) |
| [A-08](#a-08) | P2 | `useToast` | UX, accessibilità | I toast informativi spariscono dopo 2,6 s anche con 150 caratteri o quando spiegano un blocco | E (F09), C |
| [A-09](#a-09) | P3 | `ConfirmDialog`, `WorkoutDrawer` | Accessibilità | Il dialogo di conferma non ha nome; il pannello si chiama «Nome della seduta» | E (F03) |
| [A-10](#a-10) | P3 | Tutte le pagine | Accessibilità, semantica | Titoli che saltano un livello (h1 → h3, storico h1 → h4) | E (matrice) |
| [A-11](#a-11) | P3 | Tutte le pagine | Accessibilità | Il titolo del documento è sempre «PCoach» | E (matrice) |
| [A-12](#a-12) | P3 | Sidebar aperta < 720 px | Accessibilità | Il focus esce dal drawer e va sotto lo sfondo | E (F02) |
| [A-13](#a-13) | P3 | Sidebar chiusa < 720 px | Sistema visivo | L'ombra della sidebar chiusa si vede sul bordo sinistro | E (screenshot) |
| [A-14](#a-14) | P3 | Impostazioni › Modelli di zone | UX, errori | Conferma «Salvare?» prima della validazione; sezione chiusa senza segnale d'errore | E (F10) |
| [A-15](#a-15) | P3 | Login | UX, accessibilità | Errore di rete mostrato come «Credenziali non valide.»; il focus va perso | E (F12) |
| [A-16](#a-16) | P3 | «Da fare» | Responsive | Link alti 20 px anche al tocco, contro la regola dei 44 px | E (matrice) |
| [A-17](#a-17) | P3 | `StepEditor` | Accessibilità | Cinque «Sposta su» con lo stesso nome; «Sposta su» del primo step attivo | E (F03, F20) |
| [A-18](#a-18) | P3 | `FeedbackWeek` | UX | La nota «senza email» sta sotto «Approva»; «Aggiungi l'indirizzo nel Profilo» non è un link | E (screenshot), C |
| [A-19](#a-19) | P3 | Toast | Coerenza | Stesso errore informativo in un posto ed errore nell'altro; messaggio tecnico nel salvataggio del testo | C |
| [A-20](#a-20) | P3 | `LoadMetricsChart` | Accessibilità | Valori giorno per giorno solo al passaggio del mouse o al tocco | E (F16) |
| [A-21](#a-21) | P3 | `WorkoutDrawer` al tocco | UX mobile | All'apertura il focus va nel campo del nome: su telefono può aprire la tastiera | I |
| [A-22](#a-22) | P3 | Documentazione | Manutenibilità | Quattro frasi dei file di stato non più vere; un commento superato | C |
| [A-23](#a-23) | P4 | Build | Prestazioni | Bundle unico da 588 kB (178 kB compressi), oltre l'avviso di Vite | E (build) |
| [A-24](#a-24) | P4 | Router | Robustezza | Casi limite degli URL: messaggio sbagliato, settimana sbagliata, parametri ignorati | E (F11) |
| [A-25](#a-25) | P4 | Sidebar | Semantica | «Nuovo atleta» con `aria-pressed` pur essendo navigazione | C |
| [A-26](#a-26) | P4 | Login, toast | Interno | Nessuna prova automatica di accessibilità né linter (U-28 ancora aperto) | C |
| [A-27](#a-27) | P4 | `RegenerateDialog` | UX | «Settimane da generare» oltre il massimo viene ridotto senza avviso | C |

### Dettaglio

<a id="a-01"></a>
#### A-01 — Dialoghi di generazione inizializzati prima del caricamento delle sedute · P1

- **Dove**: `RegenerateDialog.vue` (`fromDate`, `resetKeep()` in `onMounted`); rotte `?dialogo=prosegui` e `?dialogo=ripianifica`.
- **Categoria**: funzionale, integrità del piano.
- **Gravità**: P1. Il caso è previsto dal prodotto: lo stato nell'URL serve proprio a riaprire il dialogo dopo un ricaricamento o alla riapertura della PWA (ADR 0023). Il valore proposto porta a sostituire sedute già approvate e già su Intervals.icu. Non è P0 perché l'anteprima mostra «4 sostituite» e l'avviso sulle rimozioni prima dell'applicazione, e lo storico resta.
- **Evidenza** (backend finto, piano attivo fino all'8 novembre, sedute dal 12 al 18 ottobre):
  - F23: dal pulsante la partenza è il 9 novembre, con 0 sedute coinvolte; dopo un ricaricamento, l'11 ottobre con 4 sedute, nessuna spuntata (`evidence/F23-prosegui-dopo-ricaricamento.png`);
  - F24: in «Ripianifica» la seduta bloccata è spuntata dal pulsante e non spuntata dopo il ricaricamento.
- **Comportamento attuale**: `fromDate` e le scelte «mantieni» si calcolano una volta, al montaggio. Dopo un ricaricamento le sedute arrivano più tardi: `continueFromDate` non vede il piano e `resetKeep()` trova un elenco vuoto.
- **Comportamento desiderato**: il dialogo mostra gli stessi valori iniziali qualunque sia il modo in cui è stato aperto.
- **Soluzione**: finché `workouts` non è caricato per l'atleta, il dialogo mostra «Carico le sedute…»; i valori iniziali si calcolano una volta, a caricamento finito. Stessa attesa per la ripresa di una proposta in sospeso (`pendingGeneration`), che usa lo stesso elenco (**I**: non provato, stesso codice).
- **Impatto**: solo `RegenerateDialog`. `SyncWeekDialog` attende già l'anteprima e ricarica; `WorkoutDrawer` compare solo quando la seduta esiste.
- **Test**: e2e che apre `?dialogo=prosegui` con un ricaricamento e verifica partenza e nessuna seduta coinvolta; lo stesso per «Ripianifica» con una seduta bloccata spuntata.

<a id="a-28"></a>
#### A-28 — Una navigazione annullata chiude la bozza del nuovo atleta · P1

Trovato il 13 ottobre durante la correzione di A-06, quindi non è nel registro originale dell'audit.

- **Dove**: `router.ts`, `installNavigationGuards` (`afterEach`).
- **Categoria**: funzionale; perdita di dati non ancora salvati.
- **Gravità**: P1. Il coach sceglie «Resta» proprio per non perdere la bozza: invece la perde, e la pagina resta bloccata. Non tocca dati già salvati.
- **Evidenza**: F25 sul codice di `d9c4996` (`evidence/F25-bozza-resta.png`):
  1. bozza di nuovo atleta, cognome «Rossi»;
  2. «Da fare» → «Resta»;
  3. l'URL resta `#/atleta/nuovo`, il contenuto è «Caricamento…» e il campo non esiste più.

  Lo stesso succede con «Salva e continua» quando il salvataggio non riesce (nome mancante). Per questo il test e2e di quel percorso (A-06) è segnato `fixme`.
- **Causa**: vue-router chiama `afterEach` anche per le navigazioni annullate dalla guardia; la regola «uscendo dalla bozza si chiude» guarda solo la destinazione `to` e chiude la bozza anche se la navigazione non è avvenuta. Dopo `closeEditor()` l'editor non trova più una scheda e nessuna delle sue dipendenze cambia, quindi resta su «Caricamento…».
- **Desiderato**: con «Resta» o con un salvataggio rifiutato la bozza resta com'era.
- **Soluzione proposta**: in `afterEach` ignorare le navigazioni fallite (terzo argomento `failure`). Una riga, senza altri effetti: le uscite confermate continuano a chiudere la bozza.
- **Test**: e2e «Resta» su una bozza modificata (il campo conserva il valore) e attivazione del test `fixme` di A-06.
- **Stato**: **risolto** dopo l'autorizzazione del coach (vedi §H).

<a id="a-02"></a>
#### A-02 — Sidebar chiusa raggiungibile da tastiera e lettore di schermo · P2

- **Dove**: `.sidebar` sotto i 720 px (`base.css`, `useMobileSidebar.ts`). Vale su telefono, tablet in verticale stretto e su desktop con lo zoom al 200%.
- **Categoria**: accessibilità (WCAG 2.4.3 ordine del focus, 2.4.7 focus visibile), responsive.
- **Evidenza**: F01 a 390 px. Dopo l'hamburger il Tab passa per «PCoach», «Da fare», «Nuovo atleta», i due atleti, «Impostazioni» ed «Esci», tutti a x = −284. Il focus è invisibile per 7 passi. L'albero accessibile espone l'intera sidebar chiusa.
- **Attuale**: chiusa, la sidebar è solo spostata con `transform: translateX(-100%)`.
- **Desiderato**: chiusa, la sidebar non è né raggiungibile né letta.
- **Soluzione**: attributo `inert` sulla sidebar quando è in modalità mobile e chiusa (gestito da `useMobileSidebar`), oppure `visibility: hidden` con la transizione ritardata. Risolve anche A-13 se l'ombra si applica solo a `.open`.
- **Impatto**: tutte le pagine sotto i 720 px; nessuno sopra.
- **Test**: e2e a 390 px: dopo l'hamburger il Tab arriva nel contenuto; `ariaSnapshot` senza la sidebar quando è chiusa.

<a id="a-03"></a>
#### A-03 — Focus coperto dall'intestazione sticky · P2

- **Dove**: pagine con `.page-header` sticky (Profilo, Impostazioni, Panoramica, Piano).
- **Categoria**: accessibilità (WCAG 2.2 · 2.4.11 Focus non oscurato, AA).
- **Evidenza**: F19, Profilo con le sezioni aperte, 60 passi con Shift+Tab dal fondo. Elementi sotto l'intestazione: 10 a 1440 px, 11 a 390 px, 19 a 640×400 (zoom al 200%). Fra questi:
  - una casella 16×16 a y = 49, tutta coperta dall'intestazione alta circa 70 px;
  - campi a y = 0.
- **Attuale**: il browser porta in vista il campo al bordo superiore, dietro l'intestazione.
- **Desiderato**: un campo che riceve il focus resta sotto l'intestazione.
- **Soluzione**: `scroll-padding-top` sul documento pari all'altezza dell'intestazione (più `--titlebar-h`), in un solo punto di `base.css`. Vale anche per `scrollIntoView` di `scrollToSection` e del feedback.
- **Impatto**: tutte le pagine; nessun cambio visivo.
- **Test**: e2e che ripete F19 e richiede zero elementi sotto l'intestazione.

<a id="a-04"></a>
#### A-04 — Stati della seduta assenti dal nome della riga · P2

- **Dove**: `WorkoutRow.vue` (`aria-label="Apri {titolo}, {giorno}"` sul pulsante che contiene tutta la riga). Compare in Piano, storico e Panoramica.
- **Categoria**: accessibilità (WCAG 1.3.1, 4.1.2).
- **Evidenza**: F03. Il nome accessibile è «Apri VO2max 5 × 4', martedì 13 ott». Il contenuto «1 h 05 min Bozza» non viene letto, perché `aria-label` sostituisce il testo. Lo stesso vale per «Invio non riuscito», «Da verificare» e «Da aggiornare su Intervals.icu».
- **Attuale**: chi usa un lettore di schermo vede solo titolo e data.
- **Desiderato**: titolo, data, durata e stati da sistemare nella lettura della riga.
- **Soluzione**: niente `aria-label`; il nome viene dal contenuto, con il giorno in testo nascosto a schermo quando non è visibile. In alternativa, `aria-describedby` verso durata e stati.
- **Impatto**: tutte le liste di sedute.
- **Test**: e2e con `ariaSnapshot`: la riga della bozza contiene «Bozza», quella da verificare «Da verificare».

<a id="a-05"></a>
#### A-05 — Segnaposto e controlli nativi nel tema scuro · P2

- **Dove**: tutti i campi con segnaposto. Contano soprattutto quelli «predefinito: N», che dopo la decisione UX-32 portano l'informazione del valore predefinito. Poi date, select e caselle nel tema scuro.
- **Categoria**: accessibilità (WCAG 1.4.3 contrasto, 1.4.11 contrasto non testuale), sistema visivo.
- **Evidenza**:
  - F22: il segnaposto usa il grigio predefinito del browser (`rgb(117,117,117)`), 4,61:1 sul campo chiaro e **3,55:1** sul campo scuro;
  - `color-scheme` vale `normal`: nel tema scuro l'icona del calendario si vede appena (`evidence/1440-dark-seduta-bozza.png`) e i menu nativi restano chiari.
- **Attuale**: nessuna regola `::placeholder` né `color-scheme` in `tokens.css` o `base.css`.
- **Desiderato**: segnaposto almeno a 4,5:1 nei due temi; controlli nativi nel tema della pagina.
- **Soluzione**:
  - `::placeholder { color: var(--text-muted); opacity: 1; }`;
  - `color-scheme: light` in `:root`, `dark` nei due blocchi del tema scuro.

  `tokens.test.ts` già verifica `--text-muted` sugli sfondi dei campi.
- **Impatto**: tutti i campi; nessun cambio di layout.
- **Test**: estendere `tokens.test.ts` o un e2e come F22 (rapporto ≥ 4,5 nei due temi).

<a id="a-06"></a>
#### A-06 — Nuovo atleta senza nome: l'errore non porta al campo · P2

- **Dove**: `#/atleta/nuovo`, `athletes.saveCurrent()` e `AthleteEditor.onSave`.
- **Categoria**: UX, gestione degli errori (WCAG 3.3.1).
- **Evidenza**: F07 (`evidence/F07-nuovo-atleta-senza-nome.png`). La bozza si apre sul Profilo con tutte le sezioni chiuse (scelta del coach). Scritta una nota e premuto «Salva», compare il toast «Il nome dell'atleta è obbligatorio.»; Identità resta chiusa e «Nome» non ha `aria-invalid`.
- **Attuale**: il primo salvataggio di ogni nuovo atleta passa da questo errore, se il coach non apre Identità per primo.
- **Desiderato**: l'errore apre la sezione e porta al campo, come già succede per le altre sezioni con un errore (design-ui: «si aprono da sole quando contengono un errore»).
- **Soluzione**: con il nome vuoto, `onSave` apre `sec-identita`, porta il focus su «Nome», mostra l'errore sotto il campo (`aria-invalid`, `aria-describedby`) e non mostra il toast. Le sezioni restano chiuse all'arrivo, come deciso.
- **Impatto**: solo la creazione e il salvataggio con il nome cancellato.
- **Test**: e2e: bozza, «Salva» senza nome → Identità aperta, focus su «Nome», errore visibile.

<a id="a-07"></a>
#### A-07 — «Modifica i parametri» scarta la proposta senza dirlo · P2

- **Dove**: `RegenerateDialog.backToParams()`.
- **Categoria**: UX (conferme proporzionate al rischio).
- **Evidenza**: F08: dopo la proposta, «Modifica i parametri» riporta ai parametri; la generazione risulta `discarded` e non compare nessuna conferma.
- **Attuale**: l'etichetta descrive la navigazione, non la perdita. Una proposta richiede fino a due minuti e consuma token; «Scarta la proposta», accanto, dice invece cosa fa.
- **Desiderato**: il coach sa che perde la proposta prima di farlo, oppure non la perde.
- **Soluzione**: vedi [decisione D-01](#d-01).
- **Impatto**: solo il dialogo di generazione.
- **Test**: e2e sul comportamento scelto.

<a id="a-08"></a>
#### A-08 — Toast informativi troppo brevi · P2

- **Dove**: `useToast.ts` (`INFO_DURATION_MS = 2600`) e ogni `showToast(…)` senza `"error"`.
- **Categoria**: UX, accessibilità (WCAG 2.2.1 tempo regolabile).
- **Evidenza**: F09, toast visibile per circa 3,0 s (2,6 s più la transizione). Messaggi informativi lunghi (C):
  - «La proposta del … partiva dal …, una data già passata: è stata scartata.» (157 caratteri con le date);
  - «Nuova programmazione applicata: N sedute in bozza.»;
  - «Salva o annulla prima le modifiche della scheda.», che spiega perché un'azione non è partita.
- **Attuale**: stessa durata per tutti; il toast non si ferma al passaggio del mouse né con il focus.
- **Desiderato**: il tempo basta a leggere; ciò che blocca un'azione resta finché non viene chiuso.
- **Soluzione**:
  - durata proporzionale alla lunghezza, con un minimo e un massimo (scelta mia da confermare: 4 s più 60 ms per carattere, al massimo 10 s);
  - pausa al passaggio del mouse e al focus;
  - i messaggi che spiegano un blocco diventano `error`, quindi persistenti.
- **Impatto**: tutti i toast; nessun cambio visivo.
- **Test**: unitario su `showToast` (durata in funzione della lunghezza); e2e: il toast resta con il mouse sopra.

<a id="a-09"></a>
#### A-09 — Dialoghi senza nome utile · P3

- **Dove**: `ConfirmDialog.vue` (`role="alertdialog"` con `aria-describedby`, senza `aria-labelledby` né `aria-label`); `WorkoutDrawer.vue` (`aria-labelledby` verso l'etichetta nascosta «Nome della seduta»).
- **Evidenza**: F03. Snapshot: `alertdialog` senza nome; il pannello è annunciato «Nome della seduta».
- **Soluzione**: `aria-label="Conferma"` (o `aria-labelledby` sul messaggio) per la conferma; `aria-label` «Seduta: {titolo}» per il pannello. Si possono anche coprire con un test.
- **Test**: e2e con `ariaSnapshot` dei due dialoghi.

<a id="a-10"></a>
#### A-10 — Livelli dei titoli · P3

- **Dove**: le sezioni usano `h3` direttamente sotto l'`h1` della pagina (Panoramica, Profilo, Impostazioni, dialoghi, pannello); lo storico usa `h4` per le settimane.
- **Evidenza**: matrice, salti h1 → h3 in 18 schermate su 21; storico h1 → h4.
- **Soluzione**: sezioni in `h2`, sotto-sezioni in `h3`, settimane dello storico in `h3`, titoli dei dialoghi in `h2`, con gli stili attuali spostati sulle classi. Nessun cambio visivo.
- **Test**: un controllo nell'e2e: nessun salto di livello.

<a id="a-11"></a>
#### A-11 — Titolo del documento fisso · P3

- **Dove**: `index.html` (`<title>PCoach</title>`); il router non lo aggiorna.
- **Evidenza**: matrice, `document.title` è «PCoach» in tutte le 21 schermate.
- **Effetto**: schede del browser, cronologia e annuncio del cambio pagina non dicono dove si è (WCAG 2.4.2).
- **Soluzione**: `router.afterEach` imposta «Da fare – PCoach», «Giulia Ferri, Piano – PCoach», «Impostazioni – PCoach» (formato scelto da me, da confermare).

<a id="a-12"></a>
#### A-12 — Drawer della sidebar senza trappola del focus · P3

- **Dove**: `useMobileSidebar.ts`.
- **Evidenza**: F02. Con la sidebar aperta, dopo «Esci» il Tab arriva a «Panoramica», «Guida», «Approva»…, tutti coperti dal drawer e dallo sfondo.
- **Soluzione**: lo stesso comportamento di `useModalFocus`, oppure `inert` su `.main` mentre il drawer è aperto. Con A-02 è un'unica modifica a `useMobileSidebar`.

<a id="a-13"></a>
#### A-13 — Ombra della sidebar chiusa visibile · P3

- **Dove**: `.sidebar` sotto i 720 px, `box-shadow: 2px 0 12px` anche da chiusa.
- **Evidenza**: bordo sinistro sfumato in tutte le schermate a 390 e 320 px (`evidence/390-light-piano.png`, `evidence/320-light-home.png`).
- **Soluzione**: ombra solo su `.sidebar.open`.

<a id="a-14"></a>
#### A-14 — Modelli di zone non validi · P3

- **Dove**: `useSettingsSave.saveSettings()` e la sezione «Modelli di zone» in `SettingsPanel.vue`.
- **Evidenza**: F10, con un limite a 500. Chiusa, la sezione dice «1 modello diverso dai predefiniti», senza segnale d'errore. «Salva impostazioni» apre la conferma «Hai cambiato i modelli di zone… Salvare?»; dopo «Salva i modelli» arriva il toast «Correggi i modelli di zone prima di salvare.», e la sezione resta chiusa (`evidence/F10-modelli-non-validi.png`).
- **Soluzione**:
  - validare prima di chiedere la conferma;
  - `attention` e apertura automatica della sezione, come per «Classificazione» e «Intensità»;
  - aprire anche il `<details>` della misura con l'errore.

<a id="a-15"></a>
#### A-15 — Login: errore di rete e focus · P3

- **Dove**: `stores/auth.ts` (`signIn`), `LoginView.vue`.
- **Evidenza**: F12. Con la rete assente il messaggio è «Credenziali non valide.», come per una password sbagliata. Dopo l'errore il focus resta sul `body`, perché il pulsante era disattivato durante l'invio.
- **Soluzione**:
  - distinguere l'errore di rete («Server non raggiungibile: controlla la connessione») dalle credenziali;
  - dopo un errore, focus sul campo password;
  - il messaggio resta in `role="alert"`.

<a id="a-16"></a>
#### A-16 — Link della home troppo bassi al tocco · P3

- **Dove**: `TodoPage.vue`, link `.anomaly-items a`.
- **Evidenza**: matrice: 6 link alti 20 px a 390 e 320 px, al tocco. La regola del progetto ([design-ui § Regole mobile](../../design-ui.md#regole-mobile)) dà ai link un'area di tocco più alta, ma vale solo per `.link-btn`.
- **Soluzione**: la stessa area di tocco dei `.link-btn` per i link nelle liste della home e delle anomalie.

<a id="a-17"></a>
#### A-17 — Comandi dell'editor della struttura · P3

- **Dove**: `StepEditor.vue`.
- **Evidenza**:
  - F03: 5 pulsanti «Sposta su» con lo stesso nome; lo stesso vale per «Sposta giù» e «Rimuovi lo step»;
  - F20: «Sposta su» del primo step è attivo e non fa nulla;
  - (C) le chiavi per indice fanno restare il focus sulla posizione, non sullo step spostato.
- **Soluzione**:
  - nomi con posizione e tipo («Sposta su lo step 2, Lavoro»);
  - comandi disattivati agli estremi;
  - focus sullo stesso comando dello step spostato.

<a id="a-18"></a>
#### A-18 — Nota «senza email» nel feedback · P3

- **Dove**: `FeedbackWeek.vue`.
- **Evidenza**: `evidence/1440-light-panoramica.png`. La nota rossa «L'atleta non ha un indirizzo email: approvando… Aggiungi l'indirizzo nel Profilo, sezione Identità…» sta sotto «Approva», come la casella del reinvio prima di FB-06. «Profilo, sezione Identità» è testo, mentre la home e le anomalie hanno il link «Aggiungila nel Profilo».
- **Soluzione**: nota sopra i pulsanti, con il link a `?sezione=sec-identita`; lo stesso link nella riga «Email non inviata».

<a id="a-19"></a>
#### A-19 — Severità e testi dei toast · P3

- **Evidenza (C)**:
  - «Copia non riuscita» è un errore persistente in Impostazioni e un toast informativo in `RegenerateDialog.copyPrompt`;
  - `reviews.ts` mostra `error.message` del database dentro un testo italiano («Testo del feedback non salvato: {messaggio}. …»).
- **Soluzione**: errore persistente in entrambi i casi; messaggio leggibile con il dettaglio tecnico solo in console.

<a id="a-20"></a>
#### A-20 — Grafico del carico solo con il puntatore · P3

- **Evidenza**: F16. Il grafico non contiene elementi raggiungibili da tastiera; l'`aria-label` dà periodo e valori attuali, mentre i valori di un giorno si leggono solo con mouse o tocco.
- **Soluzione**: vedi [decisione D-04](#d-04).

<a id="a-21"></a>
#### A-21 — Tastiera virtuale all'apertura della seduta · P3

- **Dove**: `WorkoutDrawer` (`useModalFocus(root, …, titleInput)`).
- **Evidenza**: **I**. Il focus va nel campo del nome all'apertura (E: anello di focus negli screenshot). Su Android e iOS un focus dato dentro un gesto dell'utente può aprire la tastiera e coprire metà pannello. Non verificabile senza un dispositivo.
- **Soluzione**: al tocco (`pointer: coarse`), focus sul pannello o sul pulsante di chiusura; il campo resta raggiungibile con un tocco.

<a id="a-22"></a>
#### A-22 — Documentazione non allineata · P3

Frasi dei file di stato non più vere (regola 7 di `CLAUDE.md`):

| File | Frase | Stato reale |
|---|---|---|
| design-ui.md, Design token | «il tema scuro è il default» | `:root` è chiaro; il tema scuro segue `prefers-color-scheme` |
| design-ui.md, Layout | «solo il numero nel tondo `--warning`» | quadrato da 22 px, come scritto poco sopra |
| design-ui.md, Regole mobile | «sotto 480px … l'etichetta "Modifiche non salvate" è nascosta» | l'etichetta non esiste più: c'è solo la nuvola |
| architettura.md, diagramma | «lista atleti (nome con il numero di cose da fare…)» | nessun numero accanto agli atleti, un solo contatore su «Da fare» |

Un commento di codice superato: `SettingsPanel.vue` cita «la versione nella barra laterale», tolta nella 1.2.0.

<a id="a-23"></a>
#### A-23 — Bundle unico · P4

`vite build`: `index-*.js` da 588 kB (178 kB compressi), oltre l'avviso dei 500 kB. Proposta: caricare a richiesta `SettingsPanel`, `RegenerateDialog`, `SyncWeekDialog` e `GuidePanel` (`defineAsyncComponent` o import dinamico nel router). Beneficio ridotto per un solo utente con la cache del browser: è un'evolutiva.

<a id="a-24"></a>
#### A-24 — Casi limite degli URL · P4

F11:
- `#/atleta/nuovo/anomalie` porta alla home con «Questa scheda non esiste più.», un messaggio sbagliato;
- `#/atleta/<id>/xyz` porta alla home invece che alla Panoramica dell'atleta;
- `?settimana=2026-13-45` apre la settimana «8 feb – 14 feb» (data accettata dal controllo di formato);
- `?seduta=<id inesistente>` resta nell'URL senza effetto.

Si raggiungono solo scrivendo l'URL a mano. Soluzione: tab non valida → Panoramica; data della settimana validata; parametro di una seduta inesistente tolto dall'URL con un toast.

<a id="a-25"></a>
#### A-25 — Semantica della sidebar · P4

«Nuovo atleta» usa `aria-pressed`, cioè un interruttore, ma porta a una pagina. «Da fare» e gli atleti usano invece `aria-current`. La riga della bozza è uno `<span aria-current="true">`. Soluzione: `aria-current="page"` anche per «Nuovo atleta», niente `aria-pressed`.

<a id="a-26"></a>
#### A-26 — Controlli automatici mancanti · P4

Nessun linter (U-28 aperto dal primo audit) e nessun controllo automatico di accessibilità negli e2e. I problemi A-02, A-04, A-09 e A-10 li troverebbe axe in pochi secondi. Vedi [§ Strumenti](#strumenti-consigliati).

<a id="a-27"></a>
#### A-27 — Settimane da generare oltre il massimo · P4

`RegenerateDialog.startGeneration()` riduce un valore oltre `MAX_PLAN_WEEKS` senza dirlo; il campo ha `max`, ma accetta comunque la digitazione. Soluzione: messaggio sotto il campo e «Genera la proposta» disattivato finché il valore non è valido.

## D. Problemi sistemici

| Causa | Problemi | Descrizione |
|---|---|---|
| **S-1 Stato iniziale letto prima del caricamento** | A-01 | I componenti che si aprono dall'URL calcolano i valori iniziali al montaggio. I flussi testati partono sempre da dati già in memoria; nessun e2e ricarica la pagina con un dialogo aperto. |
| **S-2 Layout mobile nascosto solo visivamente** | A-02, A-12, A-13 | Il drawer è spostato con `transform`: per tastiera e lettori di schermo la sidebar è sempre presente. Una sola correzione in `useMobileSidebar` (`inert`) risolve tre problemi. |
| **S-3 Accessibilità verificata a mano, non nei test** | A-03, A-04, A-09, A-10, A-11, A-17 | Il progetto testa i contrasti dei token, ma non la semantica nel browser: nomi dei dialoghi, livelli dei titoli, nomi che sostituiscono il contenuto. Ogni nuovo componente rischia lo stesso. |
| **S-4 Errori comunicati solo con il toast** | A-06, A-08, A-14, A-15, A-19 | Validazioni che falliscono al salvataggio mostrano un toast lontano dal campo, a volte dopo una conferma. Il pattern corretto esiste già (sezione che si apre e campo segnato, in Classificazione e Fuso orario) ma non è applicato ovunque. |
| **S-5 Tema scuro senza `color-scheme`** | A-05 | I token sono doppi, i controlli nativi no. |
| **S-6 Documentazione aggiornata per aggiunta** | A-22 | Le frasi cambiate nella 1.1.0 e nella 1.2.0 sono state aggiunte accanto alle vecchie, senza togliere quelle superate. |

**Differenze giustificate**, da non uniformare:
- il Profilo ha «Salva» esplicito, il feedback si salva da solo (ADR 0038);
- le sezioni sono sempre chiuse all'arrivo (scelta del coach, ADR 0035): A-06 non la cambia, apre la sezione solo su errore, come già succede;
- la nuvola senza testo (scelta del coach, 1.2.0): resta, con la frase per i lettori di schermo che già esiste.

## E. Matrice responsive e accessibilità

**Metodo**: Playwright 1.56 con Chromium, backend finto degli e2e (`app/e2e/mockBackend.ts`), data fissa 10 ottobre 2026, due atleti con bozza del feedback, email fallita, zone diverse, seduta da verificare, sedute in cinque stati. Script e misure in [`evidence/`](evidence/). Contrasto calcolato in pagina: colore del testo contro il primo sfondo pieno degli antenati, con l'alfa; immagini e sfumature escluse. Il segnaposto è misurato a parte (F22).

**Schermi di altezza** (pagina intera ÷ altezza del viewport; nessuno scorrimento orizzontale in nessuna cella):

| Schermata | 1440×900 | 1280×800 | 768×1024 tocco | 390×844 tocco | 320×640 tocco | 640×400 (zoom 200%) |
|---|---|---|---|---|---|---|
| Da fare | 1 | 1 | 1 | 1 | 1,4 | 2 |
| Impostazioni (chiuse) | 1 | 1 | 1 | 1 | 1,2 | 1,9 |
| Impostazioni (tutto aperto) | 4,3 | 4,8 | 4,7 | 6,6 | 8,8 | 10,3 |
| Nuovo atleta | 1,1 | 1,3 | 1 | 1,2 | 1,7 | 2,6 |
| Panoramica (bozza del feedback) | 1,5 | 1,7 | 1,3 | 1,7 | 2,2 | 3,3 |
| Piano, settimana con sedute (F21) | 1,2 | — | — | 1,8 | 2,5 | 2,7 |
| Storico | 1 | 1,2 | 1 | 1,3 | 1,9 | 2,3 |
| Profilo (chiuso) | 1,2 | 1,4 | 1,1 | 1,3 | 1,8 | 2,7 |
| Profilo (tutto aperto) | 5,2 | 5,9 | 5,7 | 9,2 | 12,1 | 13 |
| Anomalie | 1 | 1 | 1 | 1 | 1 | 1,2 |
| Pannello, dialoghi, guida, login | 1 | 1 | 1 | 1 | 1 | 1 |

**Criteri verificati**:

| Criterio | Esito | Evidenza |
|---|---|---|
| 1.4.10 Riflusso (320 px, zoom 200%) | superato | nessuno scorrimento orizzontale né elementi oltre il bordo |
| 1.4.3 Contrasto del testo, tema chiaro e scuro | superato per il testo; **non superato** per il segnaposto scuro (3,55:1) | matrice; F22 (A-05) |
| 1.4.11 Contrasto non testuale | **parziale**: icona del calendario nel tema scuro | screenshot (A-05) |
| 1.3.1 / 4.1.2 Nomi e ruoli | superato per i campi (nessuno senza nome); **non superato** per riga della seduta e dialoghi | matrice; F03 (A-04, A-09) |
| 2.4.3 Ordine del focus | **non superato** sotto i 720 px | F01, F02 (A-02, A-12) |
| 2.4.7 Focus visibile | superato sopra i 720 px | stili `:focus-visible`, screenshot |
| 2.4.11 Focus non oscurato | **non superato** | F19 (A-03) |
| 2.4.2 Titolo della pagina | **non superato** | matrice (A-11) |
| 2.4.6 Intestazioni | **parziale**: salti di livello | matrice (A-10) |
| 2.5.8 Dimensione dei bersagli (24 px) | superato con l'eccezione della spaziatura; link della home a 20 px (A-16) | matrice |
| 2.2.1 Tempo regolabile | **parziale**: toast informativi da 2,6 s | F09 (A-08) |
| 3.3.1 Identificazione degli errori | **parziale**: nome mancante e modelli di zone solo nel toast | F07, F10 |
| 2.1.1 Tastiera | **parziale**: valori giornalieri del grafico | F16 (A-20) |
| Testo sotto 12 px | nessuno | matrice |
| Console del browser | nessun errore. Due richieste interrotte, entrambe senza effetto:<br>• `HEAD … ERR_ABORTED`, limite noto ([limiti-roadmap](../../limiti-roadmap.md));<br>• `OPTIONS weekly-feedback … ERR_ABORTED` all'apertura di Informazioni, dove la versione del server compare comunque (1.2.0) | matrice |

Non si dichiara conformità WCAG 2.2 AA: non sono stati usati axe, un lettore di schermo né dispositivi reali (§G).

## F. Piano di intervento

Ogni passo si chiude con `vue-tsc` e build, test unitari, e2e desktop e mobile, più la ripetizione degli script di `evidence/` sulle stesse schermate. Le voci vanno in `## [Unreleased]` del CHANGELOG.

| Fase | Contenuto | Dipende da | Rischio di regressione | Criterio di accettazione |
|---|---|---|---|---|
| 1. Correzioni urgenti | A-01 | nessuna | basso: solo `RegenerateDialog`; e2e esistenti della generazione | F23 e F24 diventano e2e e passano: stessa partenza e stesse sedute mantenute dal pulsante e dopo un ricaricamento |
| 2. Funzionali e UX | A-06, A-07, A-14, A-15, A-18, A-19, A-08, A-27 | D-01 per A-07; D-02 per A-08 | medio: messaggi e conferme cambiano negli e2e esistenti | ogni errore di validazione apre la sezione e segna il campo; nessuna conferma prima di una validazione che fallirà; nessun messaggio informativo che spiega un blocco sparisce da solo |
| 3. Sistema e componenti condivisi | A-02, A-12, A-13 (`useMobileSidebar`), A-03 (`scroll-padding`), A-05 (`color-scheme`, `::placeholder`), A-10 (titoli), A-11 (titolo del documento) | nessuna | medio: A-10 tocca molti selettori CSS (`.block h3`, `.op-group h4`); A-02 tocca l'apertura del drawer | a 390 px il Tab dopo l'hamburger è nel contenuto; F19 senza elementi coperti; segnaposto ≥ 4,5:1 nei due temi; nessun salto di livello nelle 21 schermate |
| 4. Accessibilità dei componenti | A-04, A-09, A-16, A-17, A-21, A-25 | fase 3 per il controllo automatico | basso | snapshot ARIA: riga con stati, dialoghi con nome, comandi dell'editor distinti; link della home alti 44 px al tocco |
| 5. Documentazione | A-22 | fasi 1-4 (i file descrivono lo stato finale) | nessuno | nessuna delle quattro frasi resta; commit dedicato (regola 8) |
| 6. Evolutive | A-20, A-23, A-24, A-26 | D-03, D-04 | basso | da definire con le decisioni |

**Proposta complessiva**: nessun redesign. Le correzioni sono quasi tutte nei componenti condivisi (`useMobileSidebar`, `useToast`, `base.css`, `ConfirmDialog`, `PageSection`) e in tre componenti di dominio (`RegenerateDialog`, `WorkoutRow`, `StepEditor`). Il pattern d'errore già presente in Impostazioni (sezione che si apre, campo segnato, niente toast) diventa la regola per tutte le validazioni al salvataggio, e va scritto in `design-ui.md`. Un controllo automatico di accessibilità negli e2e (D-03) evita che i problemi di semantica tornino.

**Versione**: sono correzioni e testi, quindi PATCH secondo il CHANGELOG (1.2.1). Diventa MINOR (1.3.0) se D-01 sceglie l'opzione B, perché il coach vede un comportamento nuovo. Il numero si decide alla preparazione del rilascio, non ora.

## Decisioni richieste

<a id="d-01"></a>
**D-01 — Ritorno ai parametri dopo una proposta** (A-07)
- **A**, conferma e nome chiaro: il pulsante diventa «Scarta e cambia i parametri» e chiede «Perdi la proposta di Claude: per una nuova serve un'altra generazione». È una modifica minima, coerente con le altre conferme.
- **B**, la proposta resta: si torna ai parametri senza scartarla, con «Torna alla proposta» finché non si genera di nuovo; si scarta solo alla nuova generazione o con «Scarta la proposta». Più comoda per un ripensamento, ma aggiunge uno stato al dialogo.
- **Raccomandazione**: **A**. Cambiando i parametri la proposta non vale più, e B complica un dialogo già a quattro passi.

<a id="d-02"></a>
**D-02 — Durata dei toast** (A-08)
- Proposta: durata proporzionale al testo (4 s più 60 ms per carattere, al massimo 10 s), pausa con il mouse sopra o con il focus, e i messaggi che spiegano un blocco diventano errori che restano.
- I numeri sono una mia scelta. Basta una conferma o numeri diversi.

<a id="d-03"></a>
**D-03 — Strumenti di controllo automatico** (A-26)
- `@axe-core/playwright` come dipendenza di sviluppo: un controllo axe nelle schermate principali degli e2e esistenti, desktop e mobile.
- ESLint con `eslint-plugin-vue` ed `eslint-plugin-vuejs-accessibility`: è il punto U-28, aperto dal primo audit.
- Entrambi modificano `package.json` e `package-lock.json`. Raccomando axe subito, perché copre la causa S-3. ESLint lo raccomando dopo, in un passo a sé: al primo avvio avrà molti avvisi da smaltire.

<a id="d-04"></a>
**D-04 — Grafico del carico da tastiera** (A-20)
- **A**, tabella dei valori in un `<details>` «Valori giorno per giorno» sotto il grafico: semplice, leggibile anche dai lettori di schermo.
- **B**, il grafico prende il focus e le frecce muovono il mirino: più vicino all'uso col mouse, ma più codice.
- **C**, lasciare com'è: legenda e `aria-label` danno già i valori attuali.
- **Raccomandazione**: **A**, se i valori dei giorni passati ti servono anche senza mouse; altrimenti **C**.

Scelte che posso fare io senza chiedere, salvo indicazione diversa:
- formato del titolo del documento (A-11): «Pagina – Atleta – PCoach»;
- `inert` invece di `visibility` per la sidebar (A-02);
- livelli dei titoli senza cambi visivi (A-10);
- testi dei nuovi messaggi d'errore (A-06, A-14, A-15).

<a id="strumenti-consigliati"></a>
## Strumenti e skill

- **Usati**: Playwright 1.56 e Chromium già installati nel progetto, Vitest, `vue-tsc`, `vite build`. Script dell'audit nello scratchpad, copiati in `evidence/*.txt`.
- **Skill disponibili**: `frontend-design` riguarda la progettazione visiva di nuove interfacce. Non serve a questo audit e non è stata caricata: il riferimento sono le regole di [design-ui.md](../../design-ui.md). `claude-in-chrome` e il browser integrato pilotano l'app reale con i dati veri: non usati, per non toccare i dati degli atleti. Il plugin Playwright MCP non si è collegato all'avvio della sessione: non serviva, perché Playwright è già nel progetto. Non esistono skill di accessibilità o di design review da installare.
- **Mancanti** (vedi D-03): axe, linter. Non installati.

## G. Limiti e verifiche mancanti

- **Backend finto**: dati di prova, non i 4 atleti reali. Lunghezze e densità reali possono essere maggiori.
- **Solo Chromium in emulazione**: niente Safari o Firefox, nessun dispositivo reale, nessuna PWA installata (standalone, safe area, rotazione, tastiera virtuale). A-21 resta un'ipotesi.
- **Zoom**: il 200% è approssimato con un viewport di 640×400, non con lo zoom del browser. Le dimensioni in px non seguono la dimensione del testo scelta nelle impostazioni del browser: va bene per WCAG 1.4.4, che si soddisfa con lo zoom della pagina, ma non è stato provato.
- **Accessibilità**: controlli scritti per l'audit e snapshot ARIA di Playwright. Non usati axe né un lettore di schermo (NVDA, VoiceOver, TalkBack). Il contrasto calcolato ignora immagini e sfumature.
- **Non eseguiti in questa sessione**, perché coperti dagli e2e esistenti (106, tutti superati):
  - applicazione di una generazione;
  - sincronizzazione completa con errori parziali;
  - approvazione e rigenerazione del feedback;
  - conflitti di salvataggio.
- **Non verificati**:
  - scadenza della sessione con modifiche non salvate (l'app mostra il login: cosa resta delle modifiche non è stato provato);
  - ripresa di una proposta in sospeso dopo un ricaricamento (A-01, stesso codice);
  - la pagina «Da fare» con errore di rete (letta nel codice: messaggio senza «Riprova»).
- **Produzione**: nessun accesso. Nessun dato reale letto; nessun file di credenziali aperto.
- Nessun file di codice, test o dato modificato. Questo report e la cartella `evidence/` sono i soli file aggiunti.

## Verifiche eseguite

| Verifica | Comando | Esito |
|---|---|---|
| Test unitari | `npx vitest run` | 217 superati, 25 file |
| Type-check e build | `npm run build` | riuscita; avviso sul bundle da 588 kB |
| End-to-end esistenti | `npx playwright test` | 106 superati (53 flussi, desktop e mobile) |
| Matrice delle rotte | `rotte.audit.ts` | 168 misure, 8 esecuzioni superate |
| Flussi mirati | `flussi.audit.ts` | F01-F24: tutti eseguiti; tre falliti al primo giro per errori dello script (settimana vuota nei dati, selettore ambiguo), corretti e rieseguiti |

## H. Stato delle correzioni

Decisioni del coach (13 ottobre 2026): D-01 **A**, D-02 durata adattiva con pausa (gli errori bloccanti restano, quelli di validazione stanno sul campo), D-03 axe-core con Playwright dopo una verifica di compatibilità (ESLint a parte, più avanti), D-04 **A**, poi ritirata dal coach (tabella tolta prima del rilascio, vedi A-20). Lavoro sul ramo `correzioni-ux-1-2-1`.

| ID | Stato | Modifica | Test che riproduce il difetto |
|---|---|---|---|
| A-01 | **risolto** | `stores/workouts.ts`: `loadedFor` e `isLoadedFor(id)` distinguono «mai letto», «letto» e «lettura non riuscita». `RegenerateDialog.vue` calcola partenza, sedute da mantenere e proposta in sospeso una volta sola, a sedute lette; prima mostra «Carico le sedute dell'atleta…», con un errore «Riprova»; «Genera la proposta» e «Applica» restano disattivati, e `generate()`/`apply()` ricontrollano lo stato | 5 e2e in `plan.spec.ts` (desktop e mobile): falliscono tutti e 5 sul codice di `d9c4996`, passano con la correzione. Script dell'audit: F23 ora 9 nov sia dal pulsante sia dopo il ricaricamento, 0 sedute; F24 seduta bloccata spuntata in entrambi i casi |
| A-07 | **risolto** | `RegenerateDialog.vue`: «Modifica i parametri» con una proposta, e «Indietro» con una risposta incollata, chiedono conferma («Scarta la proposta e modifica i parametri» / «Tieni la proposta»); la risposta incollata si svuota solo dopo la conferma. Estensione a «Indietro» del passo manuale confermata dal coach; senza nulla da perdere, nessuna conferma | 2 e2e `plan.spec.ts` (proposta; risposta incollata e «Indietro» senza testo), il primo fallisce su `d9c4996`; script F08: conferma mostrata, generazione ancora `proposed` |
| A-14 | **risolto** | `stores/settings.ts` (`validationError`), `useSettingsSave.ts` (validazione prima della conferma), `SettingsPanel.vue` (riepilogo «Un limite non è valido» in avviso, sezione aperta su errore e dopo un salvataggio rifiutato), `ZoneModelsEditor.vue` (apre la misura con l'errore, senza richiuderla) | e2e `zones.spec.ts` (fallisce su `d9c4996`); script F10: nessuna conferma prima del rifiuto, riepilogo in avviso, sezione riaperta |
| A-27 | **risolto** | `RegenerateDialog.vue`: errore «Scegli da 1 a 4 settimane.» sul campo (`aria-invalid`, `aria-describedby`), «Genera la proposta» disattivato; niente più riduzione silenziosa | e2e `plan.spec.ts` (fallisce su `d9c4996`) |
| A-06 | **risolto** | `stores/athletes.ts` (`nameRequiredAttempts`, messaggio «…: scrivilo in Identità.»), `AthleteEditor.vue` (apre Identità e porta il focus su «Nome» a ogni salvataggio rifiutato), `ProfileIdentity.vue` (errore sotto il campo, `aria-invalid`, `aria-describedby`; etichetta con `for`, così l'errore non entra nel nome del campo). Toast ed errore sul campo insieme, come deciso dal coach | 2 e2e `navigation.spec.ts` («Salva»; «Salva e continua», attivo dopo A-28, con la bozza intatta), entrambi falliscono su `d9c4996`. Script F07: Identità aperta, `aria-invalid="true"` |
| A-15 | **risolto** | `stores/auth.ts`: `AuthRetryableFetchError` → «Server di accesso non raggiungibile: controlla la connessione e riprova.»; `LoginView.vue`: focus e selezione sulla password dopo un errore, `aria-describedby` verso il messaggio | e2e `navigation.spec.ts` (fallisce su `d9c4996`); script F12: i due messaggi distinti, focus sul campo |
| A-18 | **risolto** | `FeedbackWeek.vue`: nota «senza email» o «email disattivata» prima dei pulsanti; «Aggiungi l'indirizzo nel Profilo» è un link a `profilo?sezione=sec-identita`, anche nella riga «Email non inviata» | e2e `feedback-ui.spec.ts` (fallisce su `d9c4996`) |
| A-28 | **risolto** | `router.ts`: `afterEach` ignora le navigazioni con `failure` (annullate, superate, duplicate). Verificato nel sorgente di vue-router 5.3.1: `afterEach` è chiamato anche per i fallimenti, sia con `push` sia con «indietro»; con `failure` la rotta corrente non cambia. Altri percorsi esaminati: «Esci senza salvare» chiude la bozza prima della navigazione (voluto), polling e «Esci» non la toccano | 5 e2e `navigation.spec.ts`: «Resta», «indietro» + «Resta», «Salva e continua» rifiutato (falliscono su `34930cd`), uscita confermata e uscita salvata (passavano già: proteggono il comportamento corretto). Script F25: cognome conservato, nessun «Caricamento…». Su telefono, dopo «Resta» il drawer da cui si era usciti resta aperto con il focus su «Da fare»: comportamento invariato, coerente con «Resta» |
| A-08 | **risolto** | `useToast.ts`: durata dei messaggi informativi `min(10 s, 4 s + 60 ms × caratteri)`, pausa e ripresa (almeno 2 s per finire di leggere); `ToastHost.vue`: pausa con puntatore e focus, «Chiudi messaggio» anche sui messaggi informativi. La formula è una regola pratica (circa 15 caratteri al secondo), non una prova di accessibilità: la pausa e la chiusura sono ciò che dà il controllo del tempo | 5 unitari `useToast.test.ts` (falliscono sul codice precedente); e2e `ux.spec.ts`: toast fermo con il puntatore oltre la sua durata, poi sparisce; fermo con il focus, chiuso con Invio (fallisce su `51276a2`). Script F09: prima 3,0 s per «Seduta approvata.», ora 5,0 s più la pausa |
| A-19 | **risolto** | Errori persistenti: fallimenti di «Usa N zone in PCoach», «Porta Intervals.icu a…» e «Aggiorna Intervals.icu» (`useAthleteAnomalies.ts`), «Salva o annulla prima le modifiche della scheda.», «Copia non riuscita» del prompt (`RegenerateDialog.vue`). `reviews.ts`: messaggio senza `error.message`, che va in console | e2e `zones.spec.ts` (il messaggio è in `role=alert`; fallisce sul codice precedente); `feedback-ui.spec.ts`: testo esatto e nessun dettaglio del server (fallisce sul codice precedente) |
| A-02 | **risolto** | `useMobileSidebar.ts` espone `isMobile`; `App.vue` mette `inert` sulla barra chiusa in layout mobile | e2e `navigation.spec.ts`: dopo l'hamburger 4 Tab restano nel contenuto; la barra chiusa non è nell'albero accessibile di Chromium (CDP), aperta sì (fallisce su `2e87b1b`). Script F01: dopo l'hamburger «Panoramica», non più 7 comandi a x = −284. Verifica con un lettore di schermo reale non fatta: `inert` è la sola garanzia, letta nell'albero accessibile del browser |
| A-12 | **risolto** | `App.vue`: `<main>` `inert` con il drawer aperto. Il focus resta nel drawer; Esc lo chiude e il focus torna sull'hamburger. Effetto trovato dalla suite: un'uscita annullata per il nome mancante lascia il drawer aperto sopra il campo da correggere, ora inerte; `closeMobileSidebarFor()` lo chiude prima di portare il focus su «Nome» | stesso e2e: 14 Tab con il drawer aperto restano nella barra (o nel browser); e2e A-06 «Salva e continua» su mobile. Script F02: il focus non esce più sotto lo sfondo |
| A-13 | **risolto** | `base.css`: ombra solo su `.sidebar.open` | e2e: `box-shadow` `none` con la barra chiusa a 390 px (fallisce su `2e87b1b`) |
| A-03 | **risolto** | `base.css`: `html { scroll-padding-top: calc(var(--titlebar-h) + 88px) }`; l'intestazione non va a capo ed è alta al più circa 74 px | e2e `ux.spec.ts`: 60 Shift+Tab dal fondo del Profilo aperto, nessun elemento sotto l'intestazione a 1440×900, 390×844 e 640×400 (fallisce su `9c677d0`: 18 elementi coperti a 1440). Script F19: da 10, 11 e 19 elementi coperti a 0, 0 e 0 |
| A-05 | **risolto** | `tokens.css`: `color-scheme: light` in `:root`, `dark` nei due blocchi scuri; `base.css`: `::placeholder { color: var(--text-muted); opacity: 1 }`. Corretta anche la frase di design-ui sul tema predefinito (una delle quattro di A-22) | unitario `tokens.test.ts` (`color-scheme` nei tre blocchi) ed e2e `ux.spec.ts` (contrasto calcolato del segnaposto ≥ 4,5:1 e `color-scheme` nei due temi), entrambi falliscono su `83079cc`. Script F22: 6,19:1 scuro (era 3,55), 5,39:1 chiaro (era 4,61). `evidence/dopo-A-05-seduta-scura-1440.png`: icona del calendario chiara, segnaposto leggibili. Menu a tendina e selettore di data aperti non verificati a schermo (finestre del sistema) |
| A-10 | **risolto** | Sezioni, dialoghi, pannello della seduta e settimane dello storico `h2`, sottosezioni `h3`; `PageSection` con `level` (3 sotto «Avanzate», dove «Qualità dei dati» resta `h4`). In `base.css` lo stile passa a classi e contesto (`section.block h2`, `section.block .section-title` con peso e colore espliciti, `.history-week h2`, `.drawer-section h2`, `.dialog-head h2`, `.op-group h3`). Nessun cambio visivo, verificato pixel per pixel sugli screenshot dell'audit prima e dopo: restano solo il pallino «Online» (animazione, differenza ≤ 18 su 255), la riga «Build» con il commit e 35 pixel di antialiasing (differenza 1). Una differenza vera, «Niente da fare» nella home vuota passato da 700 a 600, è stata riportata a 700 per non cambiare l'aspetto. È un'incoerenza preesistente: gli altri titoli di sezione usano 600 | e2e `ux.spec.ts`: nessun salto di livello in dieci schermate (fallisce su `d7c0f12`). Un test esistente cercava i titoli della Panoramica con `#panel-panoramica h3`: il selettore ora è `h2`, la verifica (il feedback prima del grafico) è la stessa |
| A-11 | **risolto** | `App.vue`: `watchEffect` sul titolo del documento, «Pagina – Atleta – PCoach», «Accesso – PCoach» senza sessione; il nome arriva anche se l'elenco degli atleti si carica dopo. Formato scelto da me, come proposto nel report: da confermare | stesso e2e: titolo atteso in dieci schermate (fallisce su `d7c0f12`, «PCoach» ovunque) |
| D-03 | **fatto** | `@axe-core/playwright` 4.13.0 (2026-08-11; peer `playwright-core >= 1.0.0`, compatibile con 1.56.1; licenza MPL-2.0, solo sviluppo). `e2e/a11y.spec.ts`: regole WCAG 2.0, 2.1, 2.2 A e AA, 14 schermate × 2 temi × desktop e mobile, più un test di sensibilità (un pulsante senza nome deve essere segnalato) | 58 test, nessuna violazione WCAG. Esplorazione con `best-practice` (non bloccante), sotto |
| A-20 | **aperto, accettato dal coach** | La tabella «Valori giorno per giorno» (commit `66966b0`) è stata tolta prima del rilascio, su decisione del coach del 13 ottobre 2026: il codice è tornato com'era. Il problema resta: i valori dei singoli giorni si leggono solo nel tooltip, con il puntatore o al tocco; da tastiera e con un lettore di schermo c'è solo il riepilogo del grafico (periodo e valori attuali) | e2e `ux.spec.ts`: nessuna tabella sotto il grafico; axe sulla Panoramica con il grafico e la legenda |
| A-22 | **risolto** | `design-ui.md`: tema predefinito (con A-05), «quadrato» del numero delle anomalie, regola dei 480 px senza l'etichetta «Modifiche non salvate»; `architettura.md`: diagramma della barra laterale senza numeri accanto agli atleti; commento superato in `SettingsPanel.vue`. Nuova [ADR 0039](../../decisioni/0039-correzioni-dell-audit-ui-ux-1-2-0.md) con decisioni e regole di questo audit | verifica a lettura: `grep` delle quattro frasi senza risultati; documenti e commento in due commit separati dal codice (regola 8) |
| A-23 | **valutato, non fatto** | Esperimento annullato: con Impostazioni, «Genera/Prosegui/Ripianifica» e «Sincronizza settimana» caricati a richiesta, il bundle passa da un blocco da 594 kB (180 kB compressi) a: avvio 231 kB più un blocco condiviso da 322 kB, che serve comunque all'avvio (in tutto circa 171 kB compressi), più 47 kB caricati all'apertura. Risparmio al primo caricamento circa 9 kB compressi, il 5%. Il peso sta nelle librerie, non nei componenti. Raccomandazione: non farlo ora; se serve, separare le librerie in un blocco che cambia di rado, così resta nella cache del browser fra un rilascio e l'altro | build prima e dopo l'esperimento; codice ripristinato (`git status` pulito) |
| A-24 | **valutato, in attesa del coach** | Quattro casi, raggiungibili solo scrivendo l'URL a mano. Raccomandazione, una riga ciascuno: correggere i due che danno un'informazione sbagliata, cioè `#/atleta/nuovo/anomalie` («Questa scheda non esiste più.» → la bozza sul Profilo) e `?settimana=2026-13-45` (settimana di febbraio → la settimana di oggi). Lasciare gli altri due: tab sconosciuta → home, `?seduta=` inesistente ignorato | script F11 dell'audit |

**Instabilità osservate nei test** (non attribuite ad A-xx):
- con 2 worker, timeout intermittenti di `newPage` e di attesa in test diversi a ogni giro; con un solo worker e ripetuti, gli stessi test passano (50 su 50). Da qui in poi gli e2e girano con `--workers=1`;
- una volta, nella suite completa in serie, `ux.spec.ts` «la versione non è nella barra laterale…»: la versione del server (`OPTIONS weekly-feedback`) non è arrivata entro l'attesa. Ripetuto 10 volte isolato e 2 volte con tutto `ux.spec.ts`, passa sempre. La lettura avviene una sola volta, senza nuovi tentativi: se la richiesta si interrompe, Informazioni mostra «non disponibile» fino al ricaricamento. Nessun intervento: è da tenere d'occhio.

**Problemi trovati dai controlli automatici** (axe-core 4.13, 13 ottobre, sul codice dopo A-10):
- regole WCAG A e AA: nessuna violazione nelle 14 schermate, nei due temi;
- regole `best-practice`, non bloccanti:
  - `aria-dialog-name` sul dialogo di conferma: è A-09, ancora aperto;
  - `aria-allowed-role` (minore) sul pannello della seduta, un `<aside>` con `role="dialog"`: da correggere con A-09, insieme a `GuidePanel`, che usa lo stesso schema.

**Problemi che richiedono verifiche manuali** (axe non li rileva o non li può rilevare):
- nomi accessibili che nascondono informazioni (A-04, riga della seduta);
- comandi con lo stesso nome (A-17);
- focus coperto (A-03), ordine del focus e trappole (A-02, A-12);
- durata dei messaggi (A-08);
- dimensione dei bersagli al tocco (A-16);
- tastiera virtuale su dispositivo (A-21);
- comportamento con un lettore di schermo reale.

Gran parte dei problemi di questo audit appartiene a questa seconda lista: un controllo axe verde non dice che l'app sia accessibile.
