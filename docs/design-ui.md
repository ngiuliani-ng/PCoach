# Linee guida grafiche

**Quando leggerlo**: prima di aggiungere o modificare un componente visuale, per restare coerenti con la direzione visiva, i token di design, la tipografia, gli stati dei componenti, le regole di accessibilità o il comportamento mobile.

## Direzione visiva

PCoach è uno strumento di lavoro per un coach di endurance, non una vetrina. Le scelte di fondo, motivate in [decisioni/0016](decisioni/0016-direzione-visiva-dati-al-centro.md):

- **I dati di allenamento sono l'unico elemento visivamente forte**: la curva di forma nel grafico del carico e le barre a zone delle sessioni. Tutto il resto (sezioni, campi, navigazione) è sobrio e piatto.
- **Un solo livello di card.** Le sezioni sono piatte, separate da un filetto e dal titolo; il bordo con raggio è riservato alle *unità* di contenuto (una disciplina, un evento, una rilevazione, una settimana del piano, il grafico). Dentro un'unità le parti si separano con filetti, mai con altre card.
- **Ogni colore ha un solo significato**: l'accento indica l'azione primaria e la selezione; i colori di zona indicano solo le zone; i colori semantici solo errori e avvisi; le serie del grafico non riusano nessuno di questi.
- **Struttura, non decorazione**: niente stringhe di metadati unite da punti mediani, niente etichette in maiuscolo, niente numerazioni ("Disciplina 1") per elementi che non sono una sequenza. Le unità si intitolano con il loro contenuto (la disciplina, il nome dell'evento, la data della rilevazione).

## Design token

Variabili CSS definite in `app/src/styles/tokens.css`, con supporto a tema chiaro/scuro tramite `:root:not([data-theme="light"])` (il tema scuro è il default; `data-theme="light"` sul root attiva esplicitamente il tema chiaro).

| Token | Uso |
|---|---|
| `--bg` | Sfondo della pagina (le sezioni piatte stanno direttamente su di esso) |
| `--surface`, `--surface-2` | Sfondo di sidebar, unità di contenuto, campi di input e dialoghi / sfondo di hover, selezione in sidebar e badge neutri |
| `--text`, `--text-muted` | Testo primario / testo secondario |
| `--border` | Bordi delle unità, filetti tra sezioni e righe |
| `--border-control` | Bordo dei campi (input, select, textarea): almeno 3:1 con lo sfondo del campo e della pagina |
| `--accent`, `--accent-contrast` | Azione primaria e selezione (tab attiva, atleta aperto, segmento scelto, settimana corrente) / testo sopra uno sfondo accento |
| `--focus` | Colore del bordo e dell'alone di focus |
| `--danger`, `--danger-bg`, `--warning`, `--warning-bg` | Stati semantici di errore e attenzione: colore del testo e relativo sfondo |
| `--chart-ctl`, `--chart-atl`, `--chart-tsb`, `--chart-bar` | Serie del grafico del carico — vedi [§ Grafico del carico](#grafico-del-carico) |
| `--zone-1`…`--zone-7`, `--zone-unknown` | Colori delle zone di allenamento, da Z1 (recupero) a Z7 (massimale), e delle zone non riconosciute |
| `--font-ui`, `--font-mono` | Stack tipografico dell'interfaccia / delle chiavi, degli identificatori tecnici e del JSON |
| `--fs-xs` … `--fs-2xl` | Scala tipografica: 12, 13, 14, 16, 20, 28px |
| `--sp-1` … `--sp-7` | Spaziature: 4, 8, 12, 16, 24, 32, 48px |
| `--radius-sm`, `--radius-md` | Raggi: 6px per i controlli (input, pulsanti, badge), 8px per le unità di contenuto |
| `--titlebar-h` | Altezza della barra di trascinamento della PWA desktop (linea di 1px inclusa); `0px` fuori da Window Controls Overlay |

Dimensioni dei caratteri, spaziature e raggi nei componenti usano questi token. Restano valori in px diretti solo dove la misura è geometrica e non tipografica (larghezze fisse come la sidebar da 260px, dimensioni delle icone, altezze minime dei controlli, coordinate del grafico SVG).

La barra del titolo della finestra PWA e la barra di stato mobile seguono `--surface` (lo sfondo della sidebar): `#1C2025` su tema scuro e `#FFFFFF` su tema chiaro, dichiarati via `prefers-color-scheme` in `index.html` (vedi [sviluppo-deploy.md § PWA](sviluppo-deploy.md#pwa-progressive-web-app) e [decisioni/0014](decisioni/0014-colore-finestra-pwa-continuita-sidebar.md)).

## Barra di trascinamento (PWA desktop)

Sulla PWA installata su desktop Chromium (Edge/Chrome) la finestra usa Window Controls Overlay: la barra di sistema non mostra nome né icona dell'app, il contenuto si estende sotto di essa e restano visibili solo i pulsanti di sistema. La fascia superiore è disegnata dall'app (`body::before` in `base.css`, attivo solo con `@media (display-mode: window-controls-overlay)`): sfondo `--surface`, linea inferiore di 1px in `--border` (lo stesso colore dei bordi della sidebar) e `app-region: drag` per trascinare la finestra. L'altezza è `--titlebar-h`; fuori da quella modalità la fascia non esiste. Il manifest che attiva la modalità è descritto in [sviluppo-deploy.md § PWA](sviluppo-deploy.md#pwa-progressive-web-app), le motivazioni in [decisioni/0015](decisioni/0015-barra-titolo-window-controls-overlay.md).

Regole per chi modifica il layout:
- Ogni regola che assume una viewport che parte da 0 usa `--titlebar-h`: `.app`, `.sidebar` e le schermate di caricamento e login sottraggono `--titlebar-h` a `100vh`; sidebar sticky, header di pagina sticky, drawer, toggle e backdrop mobile partono da `--titlebar-h`.
- Un elemento interattivo posto dentro la fascia deve dichiarare `app-region: no-drag`, altrimenti non riceve i click.

## Tipografia

- Font di sistema (`--font-ui`, stack `-apple-system, ...`). Nessun web font viene caricato da remoto. `--font-mono` (`JetBrains Mono` se installato, altrimenti i monospace di sistema) è riservato a chiavi API, identificatori tecnici (modello Claude, fuso orario) e JSON: mai per numeri o etichette.
- Le cifre sono tabulari ovunque (`font-variant-numeric: tabular-nums` su `body` e sui campi), così i numeri si allineano senza monospace.
- Gerarchia: titolo di pagina `--fs-2xl` (600, `--fs-xl` su mobile), titolo di sezione `h3` `--fs-lg` (600, colore `--text`), sottosezione `--fs-md` (600), testo `--fs-md`, etichette dei campi e testi di aiuto `--fs-xs` in `--text-muted`. Nessuna etichetta in maiuscolo (`text-transform` non viene usato).
- I testi lunghi (aiuto, feedback, note) hanno una larghezza massima di 70 caratteri.

## Testi dell'interfaccia

- **Date** sempre in italiano tramite `formatDate` (`constants.ts`): "10 ott 2026", o "10 ott" quando l'anno è implicito (giorni di una settimana del piano). Mai date ISO a schermo.
- **Valori interni** (enum dello schema, chiavi di disciplina) non compaiono a schermo: passano da etichette (`disciplineLabel`, `PERIODIZATION_LABELS`, le liste di opzioni in `constants.ts`).
- **Valori con segno** come il TSB usano `formatSigned`: segno sempre esplicito e vero segno meno ("+4", "−12").
- **Pulsanti** con verbo e oggetto quando l'azione non è ovvia ("Elimina scheda", "Ricarica e scarta le modifiche"); il pulsante di conferma di un dialogo dice esattamente cosa succede.
- **Errori e stati vuoti** spiegano cosa fare: "Nessun piano. Scegli da quando partire e per quante settimane: Claude propone le sedute, tu le controlli e le approvi", non un generico "Nessun dato".

## Iconografia

- Set vettoriale unificato basato su `lucide-vue-next` per tutti i controlli e gli indicatori: toggle sidebar mobile, pulsanti sidebar, caret delle sezioni comprimibili, toggle password, azioni di aggiunta (`Plus`) e rimozione (`Trash2`, `X`), esporta (`Download`), icone delle discipline (`Footprints` corsa, `Bike` bici, `Waves` nuoto, `Dumbbell` palestra, `Activity` per le discipline non riconosciute, da `disciplineIcon` in `constants.ts`). Nessuna emoji, nessun glifo testuale ("+") e nessun SVG inline cablato a mano per i comandi UI.
- Tratto uniforme (stroke-width di default 2px) e dimensioni calibrate (`14px` per azioni compatte, `16px` nei pulsanti e nelle righe, `18px` nel footer della sidebar, `20px` per il toggle mobile).
- Le icone puramente decorative o contenute in elementi già provvisti di etichetta accessibile includono `aria-hidden="true"`; un'icona che porta da sola un'informazione (la disciplina di una sessione) ha `role="img"` e `aria-label`.

## Componenti generici (`components/ui/`)

- **Toast** (`ToastHost.vue` + `useToast`): notifiche non bloccanti. Con un pannello o un dialogo aperto il toast sale sopra il loro piede, così un errore che resta visibile non copre i pulsanti. `showToast(msg)` mostra un messaggio informativo che sparisce da solo; `showToast(msg, "error")` mostra un errore che resta finché l'utente non lo chiude con il pulsante dedicato; `showResultToast(result)` sceglie tra i due in base all'esito `{ ok, message }` di un'azione dello store. Due regioni live sempre presenti nel DOM: `role="status"` per le informazioni, `role="alert"` per gli errori.
- **ConfirmDialog** (`ConfirmDialog.vue` + `useConfirmDialog`): unico punto per le domande al coach; mai `window.confirm`.
  - `confirmDialog(messaggio, { confirmLabel, cancelLabel?, tone? })` per una conferma: l'etichetta descrive l'azione e il pulsante è rosso (`danger`) salvo `tone: "primary"`.
  - `choiceDialog(messaggio, scelte, annulla)` per più scelte, ad esempio all'uscita da una scheda modificata: «Esci senza salvare» in rosso, «Salva e continua» primario, «Resta» come annullamento.

  In entrambi i casi è un `role="alertdialog"` modale: all'apertura il focus va sul pulsante di annullamento, Tab resta dentro il dialog, Esc annulla, alla chiusura il focus torna all'elemento che lo aveva aperto.
- **PasswordField**: campo per segreti digitati dall'utente (chiave Intervals.icu, chiave Claude) con toggle mostra/nascondi (`Eye`/`EyeOff`, `aria-label` e `aria-pressed`, senza tooltip nativo), mai loggato né esposto in chiaro nel DOM a riposo. Riceve `input-id` e va etichettato con `<label :for>`, non avvolto in una `<label>`, perché il pulsante interno finirebbe nel nome accessibile del campo.
- **PageSection** (`PageSection.vue`, stato in `useSections`, decisione in [decisioni/0035](decisioni/0035-pagina-da-fare-sezioni-e-guida.md)): sezione comprimibile di una pagina lunga (Profilo, Impostazioni).
  - L'intestazione è un `<h3>` che contiene un pulsante (`aria-expanded`, `aria-controls`) con il caret, il titolo e, a sezione chiusa, una riga di riepilogo del contenuto in `--text-muted`, oppure in `--warning` se c'è qualcosa da sistemare.
  - A destra, se la sezione ha una guida, l'`IconButton` Info («Guida: …»).
  - Il contenuto resta nel DOM anche chiuso (`v-show`). Arrivando sulla pagina, o cambiando atleta, le sezioni sono tutte chiuse (scelta del coach); si aprono a mano, da un link che porta a una sezione (`?sezione=`, indice, anomalie) o da sole quando contengono un errore.
- **SectionNav** (`SectionNav.vue`): indice delle sezioni a destra della colonna, sticky, solo da 1360px. Un clic apre la sezione e la porta in vista. Sotto quella larghezza l'indice sono le intestazioni chiuse.
- **GuidePanel** (`GuidePanel.vue`, testi in `help/fieldHelp.ts`, gruppi in `help/guide.ts`): la guida di un gruppo di dati, aperta dall'icona Info.
  - È un pannello a destra come quello della seduta, a tutto schermo su mobile, con una voce per campo: titolo, testo e approfondimento.
  - Sta nell'URL (`?guida=`): «indietro» la chiude e le modifiche non salvate restano.
  - Sotto i campi non c'è testo d'aiuto. Restano visibili:
    - gli errori;
    - il motivo di un campo disattivato;
    - lo stato della chiave;
    - il segnaposto «predefinito: N» dei campi che, vuoti, usano un valore predefinito.
  - Le conseguenze che bloccano qualcosa compaiono come conferma prima dell'azione o come anomalia.
  - Un nuovo testo si aggiunge a `fieldHelp.ts` e a una guida, non nel componente; le etichette citate fra «» devono esistere (test).
- **InfoToggle** (`InfoToggle.vue`): dentro un pannello modale, dove una guida sarebbe un livello di troppo, un'icona Info (`aria-expanded`) apre il testo di un campo sotto la sua etichetta. Oggi solo «Target espressi in» nel pannello della seduta.
- **IconButton**: bottone compatto solo icona con stato hover/focus accessibile (`aria-label` obbligatorio, nessun tooltip nativo via `title`), ospita icone Lucide tramite slot. Usato nel footer della sidebar ("Impostazioni", "Esci") e per rimuovere un'unità (disciplina, evento, rilevazione).

## Layout

- **Desktop**: sidebar atleti a sinistra (260px, `flex-shrink: 0`, sticky), contenuto a destra (`.main`, `flex: 1`) in una colonna centrata di 680px massimi (`.form-wrap`). Lo scroll è quello della pagina: `.main` non ha `overflow`, così l'header sticky funziona.
- **Sidebar**: il marchio «PCoach» porta alla pagina iniziale; poi «Da fare» (la pagina iniziale), "Nuovo atleta" (pulsante tratteggiato in colore accento) e gli atleti in ordine alfabetico. «Da fare» ha l'unico contatore della barra: il totale di tutti gli atleti in un tondo grigio (`--surface-2`, bordo `--border-control`) se ci sono solo cose da approvare, giallo (`--warning` su `--warning-bg`) se c'è almeno un'anomalia da sistemare; il nome accessibile lo dice («Da fare, 3 in tutto, con anomalie da sistemare»). Ogni atleta è una riga resa come `<button>`:
  - il nome, che va a capo invece di essere troncato, senza contatori;
  - sotto, su righe proprie, le discipline e l'ultimo TSB, così il TSB è sempre allineato a sinistra qualunque sia la lunghezza del nome.

  La riga aperta ha sfondo `--surface-2` e un filetto d'accento a sinistra (`aria-current`). Nell'elenco non ci sono azioni: l'eliminazione è solo in Profilo › Gestione scheda. Nel piede, sotto lo stato della connessione, «Versione X.Y.Z» in `--fs-xs` e `--text-muted`, link a Impostazioni › Informazioni ([decisioni/0036](decisioni/0036-versione-dell-app-e-rilasci.md)).
- **Header di pagina** (`.page-header`): titolo in `<h1>` e azioni principali ("Salva", "Salva impostazioni"; nella scheda, fuori dalla vista Profilo il pulsante compare solo con modifiche e dice "Salva il profilo") con lo stato "Modifiche non salvate"; i pulsanti di salvataggio sono attivi solo con modifiche. È sticky (`top: --titlebar-h`) in cima alla scheda atleta e alle impostazioni, così il salvataggio è sempre raggiungibile. Sotto l'header, la scheda atleta mostra una riga di riepilogo (discipline, prossimo evento, data di aggiornamento) e, se un'altra sessione ha salvato la scheda, un avviso con "Ricarica i dati più recenti".
- **Scheda atleta: tre viste** a tab (`role="tablist"`, frecce sinistra/destra per cambiare):
  - **Panoramica**: carico e forma, la settimana in corso in sola lettura (un clic su una seduta apre il suo pannello nel Piano) con «Apri il piano», feedback settimanale (vedi [sotto](#feedback-settimanale)). Se all'apertura della scheda c'è un feedback da approvare, il feedback è la prima sezione;
  - **Piano**: vedi [sotto](#tab-piano);
  - **Profilo**: sezioni comprimibili (`PageSection`) per identità, Intervals.icu, discipline, soglie e zone, stato di allenamento, obiettivi, vincoli e disponibilità, metodologia, note, gestione scheda, tutte chiuse all'arrivo;
  - **Anomalie** (solo per una scheda salvata): vedi [sotto](#tab-anomalie). L'etichetta della tab porta il numero di anomalie in un tondo `--warning`.

  Si apre sulla Panoramica; una bozza di nuovo atleta si apre sul Profilo e il suo primo salvataggio non cambia vista.
- **Richiamo delle anomalie**: solo il numero nel tondo `--warning` accanto all'etichetta «Anomalie» ([decisioni/0033](decisioni/0033-zone-e-soglie-bloccano-l-invio.md)). In cima alla scheda resta solo l'avviso «Questa scheda è stata modificata altrove».
- **Sezioni** (`<section class="block">`, stile in `base.css`): piatte, separate da un filetto superiore in `--border`, titolo `h3`. Nelle pagine lunghe sono `PageSection` comprimibili. Le **unità** (`.unit`) sono l'unico livello di card: sfondo `--surface`, bordo, `--radius-md`, intestazione `.unit-head` con titolo e `IconButton` di rimozione.
- **Soglie**: una sola sezione con un selettore a segmenti (`.segmented`, `aria-pressed`) Corsa / Bici / Nuoto.
- **Campi**: `<label class="field">` che avvolge `<span class="field-label">` e il controllo, così ogni etichetta è associata al suo campo senza `id`. Le righe di campi (`.field-row`) sono una griglia `auto-fit` con colonne da almeno 150px.
- **Pagina iniziale «Da fare»** (`TodoPage.vue`, [decisioni/0035](decisioni/0035-pagina-da-fare-sezioni-e-guida.md)):
  - una sezione per atleta, con il nome come link alla scheda, e un'unità con una riga per voce, come la tab Anomalie: icona (`CircleAlert` `--danger` per ciò che è fallito, `TriangleAlert` `--warning` per ciò che va sistemato, `Clock` `--text-muted` per ciò che aspetta un'approvazione), titolo, dettaglio e link al punto esatto;
  - gli atleti senza nulla da fare non compaiono; senza voci, «Niente da fare» con una frase su cosa compare qui;
  - in fondo, una riga dice cosa non vi compare (zone e soglie diverse da Intervals.icu, chiave non valida) e dove si vede (tab Anomalie della scheda);
  - senza atleti: «Nessun atleta» e come crearne uno.

### Tab Piano

Una sola vista, un pannello e due dialoghi, al posto di schermate separate (motivazione in [decisioni/0017](decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md)).

- **Barra**: navigazione per settimana (frecce, intervallo di date, «Oggi»), selettore `.segmented` Settimana / Storico, «Prosegui il piano» e «Ripianifica da…» (oppure «Genera il piano» se non ci sono sedute attive) e il pulsante primario «Sincronizza settimana». Quest'ultimo è disattivato senza chiave Intervals.icu; un testo spiega dove aggiungerla.
- **Riepilogo della settimana**: piano ed etichetta della settimana, badge «Scarico» neutro, numero di sedute e durata, quante sono da sincronizzare.
- **Avviso** con filetto `--warning` se ci sono bozze approvabili, con «Approva le N»: le bozze non vanno a Intervals.icu finché non sono approvate.
- **Settimana**: un'unità (`.week-unit`) con una riga per giorno, etichetta del giorno a sinistra (112px) e le sedute a destra, oppure «Riposo». Il giorno di oggi ha un filetto d'accento a sinistra e la scritta «Oggi». Sotto i 560px il giorno va sopra le sedute.
- **Riga di una seduta** (`WorkoutRow`): tutta la riga è un `<button>` che apre il pannello. Contiene:
  - icona della disciplina (`role="img"`) e nome;
  - durata, distanza e obiettivo;
  - la barra mini della struttura;
  - i badge di stato.

  «Approva» è un pulsante fratello, presente solo per le bozze valide. Le sedute annullate o sostituite hanno il nome barrato e in `--text-muted`.
- **Badge di stato** (`WorkoutBadges`): icona e testo, mai solo colore; un badge per asse (approvazione, sincronizzazione, esecuzione). Il colore segnala solo ciò che richiede attenzione:
  - `--warning` per «Bozza», «Da verificare» (struttura incompleta o vincolo di disponibilità non rispettato, con il motivo nel pannello), «Da aggiornare su Intervals.icu», «Da rimuovere da Intervals.icu»;
  - `--danger` per «Invio non riuscito»;
  - neutri gli stati a posto («Approvata», «Su Intervals.icu», «Svolta»), che non usano l'accento, riservato alla selezione e all'azione primaria.

  Nella riga (`WorkoutBadges row`) mancano «Approvata», «Su Intervals.icu» e «Bloccata», che sono lo stato normale: restano nel pannello. I nomi vengono dal glossario `STATE_LABELS` (`domain/workoutState.ts`), con «Versione N» per il numero di revisione.
- **Pannello della seduta** (`WorkoutDrawer`): modale a destra (600px, a tutta larghezza su mobile), con focus intrappolato, Esc e ritorno del focus (`useModalFocus`). Dall'alto:
  - nome modificabile nell'intestazione;
  - stati e numero di revisione;
  - avvisi (sostituita, annullata con «Ripristina come bozza», motivo per cui è da verificare, errore o avviso dell'ultimo invio);
  - data, disciplina, obiettivo;
  - struttura: metrica dei target come `.segmented`, barra grande e `StepEditor`;
  - note per l'atleta, «Mantienila se ripianifico il programma»;
  - «Testo inviato a Intervals.icu» in un `<details>` (l'unico testo in monospace);
  - cronologia.

  Il piede contiene «Elimina bozza» (solo bozze mai inviate) o «Annulla seduta», poi «Salva modifiche» e, per le bozze, «Salva e approva» / «Approva»; per le sedute già approvate «Da verificare», «Salva e segna verificata» / «Segna verificata». Chiudere con modifiche non salvate chiede conferma.
- **Editor della struttura** (`StepEditor`): ogni step è un'unità con una striscia del colore della zona a sinistra e i campi tipo, durata, unità (min, s, km, m), zona, «fino a…», indicazione per l'atleta. Le zone proposte sono quelle del sistema dell'atleta per la disciplina; una zona già oltre resta visibile come «Z5, oltre le 3 zone», con il motivo sotto la struttura. Ha i comandi sposta su/giù e rimuovi, anche per gli step dentro una ripetuta. Le ripetute sono un riquadro con nome e numero di ripetizioni che contiene i propri step. L'errore di validazione compare sotto lo step, con il bordo `--danger` sul campo interessato.
- **Dialoghi** di generazione («Genera il piano», «Prosegui il piano», «Ripianifica da una data») e «Sincronizza settimana». Nella generazione, «Genera la proposta» resta disattivato con «Preparo la richiesta…» fino alla chiamata a Claude; uno schema di carico non riconosciuto è segnalato nei parametri; nella proposta gli avvisi (sedute a settimana, variazione di volume, date riallineate o scartate) sono in un riquadro d'avviso con il conteggio. In generale: box centrato di 720px (a schermo intero sotto i 560px), con intestazione, corpo scorrevole e piede con le azioni a destra. Il pulsante di conferma dice cosa succede e quante sedute coinvolge («Applica la nuova programmazione», «Sincronizza 3 sedute, di cui 1 da rimuovere»). Le liste dentro i dialoghi (`.op-list`, `.keep-list`, differenze per giorno) sono unità con righe separate da filetti. Gli esiti per riga usano icona e testo: in corso in `--accent`, riuscita neutra, non riuscita in `--danger` con il motivo.
- **Storico**: due selettori affiancati, «Piano» (attivo, chiusi con la data) e «Sedute». «Sedute» ha i filtri con il conteggio, raggruppati per asse:
  - tutte;
  - da sistemare: bozze, da verificare, da aggiornare su Intervals.icu, invii non riusciti;
  - approvazione e invio: approvate, su Intervals.icu;
  - esecuzione: in programma, svolte, svolte in parte, non registrate;
  - chiuse: annullate o sostituite.

  Niente chip. Le sedute sono raggruppate per settimana, dalla più recente.

### Tab Anomalie

`AnomaliesTab.vue`, elenco da `useAthleteAnomalies.ts`; decisione in [decisioni/0034](decisioni/0034-anomalie-in-un-elenco-ed-email-dell-atleta.md).

- **Un solo elenco**, in un'unità con una riga per anomalia separata da filetti: prima ciò che è già fallito, poi ciò che va sistemato. Riga:
  - icona: `CircleAlert` in `--danger` per ciò che è fallito, `TriangleAlert` in `--warning` per ciò che va sistemato;
  - titolo;
  - la riga «Ferma: …» in grassetto: feedback settimanale e invio a Intervals.icu, feedback settimanale, invio a Intervals.icu, email del feedback all'atleta;
  - dettaglio in `--text-muted`;
  - azioni. Quelle che scrivono (su Intervals.icu o nella scheda) sono pulsanti `secondary` con conferma; quelle che portano dove si sistema («Aggiungila nel Profilo», «Apri il feedback») sono link. «Apri il feedback» porta alla settimana indicata.
- **Anomalie**:
  - zone o soglie diverse da Intervals.icu, soglia mancante, chiave non valida;
  - email mancante con l'invio email attivo;
  - feedback non preparato o approvato ma non inviato (ultime 4 settimane);
  - sedute da verificare, invii non riusciti.
- **Sedute**: sedute da verificare e invii non riusciti sono una sola anomalia con l'elenco delle sedute (data e nome come link che apre il pannello, motivo sotto). Nel conteggio ogni seduta vale uno. Dal pannello «indietro» torna alle anomalie.
- **Vuota**: «Nessuna anomalia» e una frase su cosa compare qui. Durante la lettura da Intervals.icu: «Controllo zone e soglie su Intervals.icu…».

## Stati dei componenti

Un valore fisso che ha senso mostrare accanto a campi modificabili (es. il sistema di zone del nuoto) è un campo `disabled`, con sfondo `--surface-2` e testo pieno, più una riga che dice perché non si cambia.

Ogni componente interattivo gestisce esplicitamente: default, hover, focus (visibile via `:focus-visible`, mai rimosso con `outline: none` senza sostituto), disabled, loading (dove rilevante, es. salvataggio o generazione in corso), errore. Attenzione alla specificità: le classi dei pulsanti (`button.primary`, `button.secondary`, …) hanno specificità elemento+classe, quindi una regola che deve nasconderli o sovrascriverli ha bisogno di almeno due classi.

## Accessibilità

- Contrasti dei token verificati da `styles/tokens.test.ts` in entrambi i temi: testo (anche d'avviso ed errore) almeno 4,5:1 sugli sfondi in cui compare, bordo dei campi almeno 3:1.
- Tutti i controlli interattivi sono elementi nativi (`button`, `input`, `select`) raggiungibili da tastiera; ordine di tabulazione naturale (nessun `tabindex` positivo; l'unico `tabindex="-1"` è sulle tab inattive, secondo il pattern ARIA delle tab).
- Ogni campo ha un'etichetta associata (vedi [§ Layout](#layout)); i campi senza etichetta visibile (note libere, prompt, JSON del piano) hanno `aria-label`.
- Icone e pulsanti solo-icona privi di testo visibile accompagnati da `aria-label` (nessun attributo `title`, per evitare tooltip nativi ridondanti).
- Dialoghi (`ConfirmDialog`, drawer mobile, pannello della seduta, guida, dialoghi di generazione e «Sincronizza settimana») intrappolano il focus e lo restituiscono all'elemento che li ha aperti alla chiusura; Esc chiude (tranne durante un'operazione in corso). Pannello della seduta e dialoghi del piano si chiudono anche con «indietro» del browser o del telefono (vedi [architettura.md](architettura.md#flussi-principali)). Gli esiti asincroni dei dialoghi sono in una regione `aria-live`.
- Il grafico del carico ha un `aria-label` con periodo e valori attuali; il tooltip è solo visivo (`aria-hidden`).
- Animazioni continue e transizioni rispettano `prefers-reduced-motion`.

## Zone e discipline

- Colori di zona (Z1-Z7, `--zone-1`…`--zone-7`; gli step senza zona usano `--zone-unknown`) da una scala condivisa, non hardcoded per componente. Il colore di uno step è quello della zona più alta del suo target (`peakZone`).
- Le tinte di zona sono distinte dall'accento e dai colori semantici. Sono usate come riempimento dei segmenti della barra della struttura (`StructureBar`) e come striscia a sinistra degli step nell'editor, mai come sfondo di testo.
- **Barra della struttura**: è l'elemento visivamente forte della tab Piano.
  - Mini (8px, piatta, decorativa) nelle righe delle sedute.
  - Grande nel pannello: 64px, larghezza proporzionale alla durata, altezza crescente con la zona, `role="img"` con un `aria-label` riassuntivo.
  - Gli step a distanza sono proporzionati con la durata stimata dal passo della zona, come i totali ([decisioni/0030](decisioni/0030-soglie-allineate-e-stima-della-durata.md)).
- Icone ed etichette delle discipline da `constants.ts` (`disciplineIcon`, `disciplineLabel`), associate per chiave disciplina.
- Il badge "Scarico" di una settimana è neutro (`--surface-2`): non è un avviso.

## Grafico del carico

`LoadMetricsChart.vue`, SVG puro con `aspect-ratio` fisso (nessun salto di layout durante il caricamento):

- **CTL (fitness)**: linea piena spessa in `--chart-ctl` (= `--text`), la serie principale.
- **ATL (fatica)**: linea sottile in `--chart-atl`, una tinta viola che non compare tra le zone.
- **TSB (forma)**: banda tra lo zero e il valore in `--chart-tsb` (neutro trasparente); il segno si legge dalla posizione rispetto alla linea dello zero, più marcata delle altre linee di griglia.
- **Allenamenti al giorno**: barre in `--chart-bar` in una striscia separata sotto il grafico, mai sovrapposte alle serie.
- Asse y con etichette a passo "tondo" (1, 2, 5 × 10ⁿ); date di inizio e fine sotto la striscia; legenda con l'ultimo valore di CTL, ATL e TSB. Etichette e date sono HTML in `--fs-xs` posizionate sopra l'SVG, non testo SVG: non rimpiccioliscono con il grafico.
- Crosshair e tooltip al passaggio del mouse o al tocco (eventi touch e mouse unificati). Senza dati, al posto del grafico compare uno stato vuoto fornito dal chiamante (slot `empty`), che indica come ottenere i dati.

## Regole mobile

Breakpoint: `720px` (passaggio a layout mobile a singola colonna), `560px` (tab Piano: giorno sopra le sedute, dialoghi a schermo intero) e `480px` (ulteriori compattazioni).

Sotto i `720px` la sidebar atleti diventa un **drawer**: nascosta di default, aperta con un bottone hamburger, sovrapposta al contenuto con backdrop cliccabile. Tutta la logica del drawer — apertura/chiusura, backdrop cliccabile, chiusura con Esc, blocco dello scroll del body mentre è aperto, gestione del focus — vive nel composable `app/src/composables/useMobileSidebar.ts`, non in `App.vue`. Il bottone hamburger è nascosto mentre il drawer è aperto (si usano il backdrop o Esc per chiuderlo). Motivazioni in [decisioni/0009-rifinitura-mobile-fase-8.md](decisioni/0009-rifinitura-mobile-fase-8.md) e [decisioni/0011-rifinitura-sidebar-iconbutton.md](decisioni/0011-rifinitura-sidebar-iconbutton.md).

L'hamburger è fisso in alto a sinistra e sta dentro la fascia dell'header di pagina sticky: su mobile l'header ha un rientro sinistro di 48px, così il titolo non viene mai coperto durante lo scroll.

Altre compattazioni:
- sotto `400px`: le tab si avvicinano (`--sp-3`), così quattro tab e il numero delle anomalie stanno in 320px;
- sotto `720px`: titolo di pagina a `--fs-xl`; la disponibilità settimanale passa da quattro colonne a due (giorno e "Disponibile", poi durata e attività);
- sotto `480px`: campi e checkbox su una colonna, pulsanti delle barre d'azione a tutta larghezza, l'etichetta "Modifiche non salvate" è nascosta (lo stato resta leggibile dal pulsante "Salva" attivo); nella barra del Piano «Prosegui il piano» e «Ripianifica da…» stanno affiancati e «Sincronizza settimana» occupa la riga sotto.

**Dispositivi touch** (`@media (pointer: coarse)`, decisione in [decisioni/0026](decisioni/0026-touch-e-orientamento-pwa.md)):
- i campi hanno il testo a 16px, perché sotto quella misura Safari su iOS ingrandisce la pagina al tocco;
- pulsanti, campi, tab, voci dell'elenco atleti, pulsanti-icona, caselle con etichetta, «Aggiungi…» e «Versione X.Y.Z» sono alti almeno 44px;
- i link nel testo restano in riga, con un'area di tocco più alta.

## Feedback settimanale

Sezione della Panoramica (`WeeklyReviews.vue`):
- **Titolo con l'icona Info**: la guida spiega il flusso (ogni lunedì PCoach prepara il feedback, parte solo all'approvazione).
- **Elenco delle settimane**, dalla più recente; ne mostra 4 e il resto con «Mostra tutti». Per ogni settimana:
  - intervallo di date e badge di stato (`.w-badge`, testo e icona, mai solo colore): «Da approvare» in avviso, «Approvato», «Inviato all'atleta», «In preparazione», «Nessuna seduta da valutare», «Non riuscito» o «Approvato, email non inviata» in errore;
  - riga di conteggi senza punti mediani (sedute assegnate, svolte, senza attività registrata, non valutabili, extra, tasso di completamento solo se comunicabile);
  - «Sedute della settimana» (`<details>`): data, titolo ed esito di ogni seduta. Gli esiti che chiedono attenzione («Nessuna attività registrata», «Dato non disponibile», «Non attribuibile con certezza», «Al suo posto un'altra disciplina», «Molto più breve del previsto») sono in `--warning`;
  - limitazioni dei dati, in testo secondario;
  - «Per te:» con la sintesi di Claude per il coach.
- **Bozza**: testo per l'atleta in un campo modificabile, «Approva e invia» e «Rigenera». Il pulsante dice solo «Approva», con una nota, se l'email è disattivata o se l'atleta non ha un indirizzo. Senza indirizzo la nota è in `--danger`: approvando il feedback non arriva e resta fra le anomalie; aggiunto l'indirizzo, «Riprova l'invio».
- **In preparazione**: la sezione si rilegge da sola ogni 30 secondi finché c'è una valutazione in preparazione, con «Aggiorna ora».
- **Approvata**: il testo inviato, la data di invio oppure l'errore con «Riprova l'invio», e «Rigenera».
- **Non riuscita**: il messaggio d'errore e «Riprova».
- **In fondo**, «Prepara il feedback di un'altra settimana»: un selettore delle ultime sei settimane (in corso compresa) e «Prepara il feedback». Un link `?feedback=<id>` porta la settimana indicata in vista, aprendo «Mostra tutti» se serve.

## Impostazioni

`SettingsPanel.vue`, sezioni comprimibili con indice e guida, tutte chiuse all'arrivo ([decisioni/0035](decisioni/0035-pagina-da-fare-sezioni-e-guida.md)):
- **Claude e generazione**: chiave e modello, preferenze per generare il piano con «Ripristina le preferenze predefinite».
- **Feedback settimanale**: ora del lunedì, fuso orario (un elenco dei fusi riconosciuti dal browser; un valore salvato non valido compare segnalato e il salvataggio è bloccato), invio via email, tono del feedback.
- **Avanzate**, un titolo `h2` in `--text-muted` con una riga sugli effetti, poi tre sezioni chiuse, il cui riepilogo dice «Valori predefiniti» o quanti valori sono personalizzati:
  - «Classificazione delle sedute»: soglie principali e, sotto «Qualità dei dati», le altre, con validazione per campo;
  - «Intensità per sistema di zone»: una tabella con una riga per sistema (3, 5, 7 zone) e le colonne «Bassa fino alla zona» e «Media fino alla zona»; ogni campo ha il nome dalla riga e dalla colonna;
  - «Modelli di zone»: per misura e sistema, un preset o limiti propri, con la fonte del preset. Salvare modelli cambiati chiede conferma, perché cambiano la durata stimata delle sedute a distanza per tutti gli atleti.

  Ogni sezione ha il suo «Ripristina…», che chiede conferma solo se ci sono valori personalizzati.
- **Informazioni**: versione, build e data, versione del server, «Copia per una segnalazione», novità della versione ([decisioni/0036](decisioni/0036-versione-dell-app-e-rilasci.md)).

Nel Profilo, la sezione Metodologia ha lo schema di carico e scarico come due selettori («Settimane di carico» 1-8, «Settimane di scarico» 1-4; un valore salvato non riconosciuto è segnalato) e i tre campi della progressione del carico.

