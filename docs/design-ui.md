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
| `--border` | Bordi di unità e input, filetti tra sezioni e righe |
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

- **Toast** (`ToastHost.vue` + `useToast`): notifiche non bloccanti. `showToast(msg)` mostra un messaggio informativo che sparisce da solo; `showToast(msg, "error")` mostra un errore che resta finché l'utente non lo chiude con il pulsante dedicato; `showResultToast(result)` sceglie tra i due in base all'esito `{ ok, message }` di un'azione dello store. Due regioni live sempre presenti nel DOM: `role="status"` per le informazioni, `role="alert"` per gli errori.
- **ConfirmDialog** (`ConfirmDialog.vue` + `useConfirmDialog`): unico punto per conferme distruttive (eliminazione atleta, scarto di una bozza o di modifiche non salvate); mai `window.confirm`. `confirmDialog(messaggio, { confirmLabel, cancelLabel? })`: l'etichetta di conferma è obbligatoria e descrive l'azione. Il dialog è un `role="alertdialog"` modale: all'apertura il focus va sul pulsante di annullamento, Tab resta dentro il dialog, Esc annulla, alla chiusura il focus torna all'elemento che lo aveva aperto.
- **PasswordField**: campo per segreti digitati dall'utente (chiave Intervals.icu, chiave Claude) con toggle mostra/nascondi (`Eye`/`EyeOff`, `aria-label` e `aria-pressed`, senza tooltip nativo), mai loggato né esposto in chiaro nel DOM a riposo. Riceve `input-id` e va etichettato con `<label :for>`, non avvolto in una `<label>`, perché il pulsante interno finirebbe nel nome accessibile del campo.
- **IconButton**: bottone compatto solo icona con stato hover/focus accessibile (`aria-label` obbligatorio, nessun tooltip nativo via `title`), ospita icone Lucide tramite slot. Usato nel footer della sidebar ("Impostazioni", "Esci") e per rimuovere un'unità (disciplina, evento, rilevazione).

## Layout

- **Desktop**: sidebar atleti a sinistra (260px, `flex-shrink: 0`, sticky), contenuto a destra (`.main`, `flex: 1`) in una colonna centrata di 680px massimi (`.form-wrap`). Lo scroll è quello della pagina: `.main` non ha `overflow`, così l'header sticky funziona.
- **Sidebar**: "Nuovo atleta" in cima (pulsante tratteggiato in colore accento), poi gli atleti in ordine alfabetico. Ogni atleta è una riga resa come `<button>`: il nome, che va a capo invece di essere troncato, e sotto, su righe proprie, le discipline e l'ultimo TSB (così il TSB è sempre allineato a sinistra, qualunque sia la lunghezza del nome); la riga aperta ha sfondo `--surface-2` e un filetto d'accento a sinistra (`aria-current`). Il pulsante di eliminazione è un fratello del pulsante di selezione (mai annidato) e compare al passaggio del mouse o al focus; sui dispositivi senza hover è sempre visibile.
- **Header di pagina** (`.page-header`): titolo e azioni principali ("Salva", "Salva impostazioni") con lo stato "Modifiche non salvate". È sticky (`top: --titlebar-h`) in cima alla scheda atleta e alle impostazioni, così il salvataggio è sempre raggiungibile. Sotto l'header, la scheda atleta mostra una riga di riepilogo (discipline, prossimo evento, data di aggiornamento) e, se un'altra sessione ha salvato la scheda, un avviso con "Ricarica i dati più recenti".
- **Scheda atleta: tre viste** a tab (`role="tablist"`, frecce sinistra/destra per cambiare):
  - **Panoramica**: carico e forma, la settimana in corso in sola lettura con «Apri il piano», feedback settimanale;
  - **Piano**: vedi [sotto](#tab-piano);
  - **Profilo**: identità, Intervals.icu, discipline, soglie, stato di allenamento, obiettivi, vincoli, metodologia, note, esporta/elimina.

  Si apre sulla Panoramica; una bozza di nuovo atleta si apre sul Profilo e il suo primo salvataggio non cambia vista.
- **Sezioni** (`<section class="block">`, stile in `base.css`): piatte, separate da un filetto superiore in `--border`, titolo `h3`. Le **unità** (`.unit`) sono l'unico livello di card: sfondo `--surface`, bordo, `--radius-md`, intestazione `.unit-head` con titolo e `IconButton` di rimozione.
- **Soglie**: una sola sezione con un selettore a segmenti (`.segmented`, `aria-pressed`) Corsa / Bici / Nuoto.
- **Campi**: `<label class="field">` che avvolge `<span class="field-label">` e il controllo, così ogni etichetta è associata al suo campo senza `id`. Le righe di campi (`.field-row`) sono una griglia `auto-fit` con colonne da almeno 150px.
- **Stato vuoto** (nessun atleta aperto): titolo e una frase su cosa fare. Non ha pulsanti: non ripete i comandi della sidebar, che su mobile si apre con l'hamburger.

### Tab Piano

Una sola vista, un pannello e due dialoghi, al posto di schermate separate (motivazione in [decisioni/0017](decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md)).

- **Barra**: navigazione per settimana (frecce, intervallo di date, «Oggi»), selettore `.segmented` Settimana / Storico, «Ripianifica da…» (o «Genera il piano» se non ci sono sedute attive) e il pulsante primario «Sincronizza settimana». Quest'ultimo è disattivato senza chiave Intervals.icu; un testo spiega dove aggiungerla.
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
  - `--warning` per «Da revisionare», «Struttura da verificare», «Da aggiornare su Intervals.icu», «Da rimuovere da Intervals.icu»;
  - `--danger` per «Invio non riuscito»;
  - neutri gli stati a posto («Approvata», «Su Intervals.icu», «Svolta»), che non usano l'accento, riservato alla selezione e all'azione primaria.
- **Pannello della seduta** (`WorkoutDrawer`): modale a destra (600px, a tutta larghezza su mobile), con focus intrappolato, Esc e ritorno del focus (`useModalFocus`). Dall'alto:
  - nome modificabile nell'intestazione;
  - stati e numero di revisione;
  - avvisi (sostituita, annullata con «Ripristina come bozza», struttura da verificare, errore o avviso dell'ultimo invio);
  - data, disciplina, obiettivo;
  - struttura: metrica dei target come `.segmented`, barra grande e `StepEditor`;
  - note per l'atleta, «Mantienila se ripianifico il programma»;
  - «Testo inviato a Intervals.icu» in un `<details>` (l'unico testo in monospace);
  - cronologia.

  Il piede contiene «Elimina bozza» (solo bozze mai inviate) o «Annulla seduta», poi «Salva modifiche» e, per le bozze, «Salva e approva» / «Approva». Chiudere con modifiche non salvate chiede conferma.
- **Editor della struttura** (`StepEditor`): ogni step è un'unità con una striscia del colore della zona a sinistra e i campi tipo, durata, unità (min, s, km, m), zona, «fino a…», indicazione per l'atleta. Ha i comandi sposta su/giù e rimuovi. Le ripetute sono un riquadro con nome e numero di ripetizioni che contiene i propri step. L'errore di validazione compare sotto lo step, con il bordo `--danger` sul campo interessato.
- **Dialoghi** «Ripianifica» e «Sincronizza settimana»: box centrato di 720px (a schermo intero sotto i 560px), con intestazione, corpo scorrevole e piede con le azioni a destra. Il pulsante di conferma dice cosa succede e quante sedute coinvolge («Applica la nuova programmazione», «Sincronizza 3 sedute, di cui 1 da rimuovere»). Le liste dentro i dialoghi (`.op-list`, `.keep-list`, differenze per giorno) sono unità con righe separate da filetti. Gli esiti per riga usano icona e testo: in corso in `--accent`, riuscita neutra, non riuscita in `--danger` con il motivo.
- **Storico**: selettore del piano (attivo, chiusi con la data) e filtri a chip con conteggio: tutte, da revisionare, approvate, su Intervals.icu, da aggiornare, errori, svolte, non svolte, in programma, annullate o sostituite. Le sedute sono raggruppate per settimana, dalla più recente.

## Stati dei componenti

Ogni componente interattivo gestisce esplicitamente: default, hover, focus (visibile via `:focus-visible`, mai rimosso con `outline: none` senza sostituto), disabled, loading (dove rilevante, es. salvataggio o generazione in corso), errore. Attenzione alla specificità: le classi dei pulsanti (`button.primary`, `button.secondary`, …) hanno specificità elemento+classe, quindi una regola che deve nasconderli o sovrascriverli ha bisogno di almeno due classi.

## Accessibilità

- Contrasto testo/sfondo verificato per i token di colore principali in entrambi i temi.
- Tutti i controlli interattivi sono elementi nativi (`button`, `input`, `select`) raggiungibili da tastiera; ordine di tabulazione naturale (nessun `tabindex` positivo; l'unico `tabindex="-1"` è sulle tab inattive, secondo il pattern ARIA delle tab).
- Ogni campo ha un'etichetta associata (vedi [§ Layout](#layout)); i campi senza etichetta visibile (note libere, prompt, JSON del piano) hanno `aria-label`.
- Icone e pulsanti solo-icona privi di testo visibile accompagnati da `aria-label` (nessun attributo `title`, per evitare tooltip nativi ridondanti).
- Dialoghi (`ConfirmDialog`, drawer mobile, pannello della seduta, dialoghi «Ripianifica» e «Sincronizza settimana») intrappolano il focus e lo restituiscono all'elemento che li ha aperti alla chiusura; Esc chiude (tranne durante un'operazione in corso). Gli esiti asincroni dei dialoghi sono in una regione `aria-live`.
- Il grafico del carico ha un `aria-label` con periodo e valori attuali; il tooltip è solo visivo (`aria-hidden`).
- Animazioni continue e transizioni rispettano `prefers-reduced-motion`.

## Zone e discipline

- Colori di zona (Z1-Z7, `--zone-1`…`--zone-7`; gli step senza zona usano `--zone-unknown`) da una scala condivisa, non hardcoded per componente. Il colore di uno step è quello della zona più alta del suo target (`peakZone`).
- Le tinte di zona sono distinte dall'accento e dai colori semantici. Sono usate come riempimento dei segmenti della barra della struttura (`StructureBar`) e come striscia a sinistra degli step nell'editor, mai come sfondo di testo.
- **Barra della struttura**: è l'elemento visivamente forte della tab Piano.
  - Mini (8px, piatta, decorativa) nelle righe delle sedute.
  - Grande nel pannello: 64px, larghezza proporzionale alla durata, altezza crescente con la zona, `role="img"` con un `aria-label` riassuntivo.
  - Gli step a distanza sono proporzionati con una velocità di riferimento per disciplina, solo a scopo visivo.
- Icone ed etichette delle discipline da `constants.ts` (`disciplineIcon`, `disciplineLabel`), associate per chiave disciplina.
- Il badge "Scarico" di una settimana è neutro (`--surface-2`): non è un avviso.

## Grafico del carico

`LoadMetricsChart.vue`, SVG puro con `aspect-ratio` fisso (nessun salto di layout durante il caricamento):

- **CTL (fitness)**: linea piena spessa in `--chart-ctl` (= `--text`), la serie principale.
- **ATL (fatica)**: linea sottile in `--chart-atl`, una tinta viola che non compare tra le zone.
- **TSB (forma)**: banda tra lo zero e il valore in `--chart-tsb` (neutro trasparente); il segno si legge dalla posizione rispetto alla linea dello zero, più marcata delle altre linee di griglia.
- **Allenamenti al giorno**: barre in `--chart-bar` in una striscia separata sotto il grafico, mai sovrapposte alle serie.
- Asse y con etichette a passo "tondo" (1, 2, 5 × 10ⁿ); date di inizio e fine sotto la striscia; legenda con l'ultimo valore di CTL, ATL e TSB.
- Crosshair e tooltip al passaggio del mouse o al tocco (eventi touch e mouse unificati). Senza dati, al posto del grafico compare uno stato vuoto fornito dal chiamante (slot `empty`), che indica come ottenere i dati.

## Regole mobile

Breakpoint: `720px` (passaggio a layout mobile a singola colonna), `560px` (tab Piano: giorno sopra le sedute, dialoghi a schermo intero) e `480px` (ulteriori compattazioni).

Sotto i `720px` la sidebar atleti diventa un **drawer**: nascosta di default, aperta con un bottone hamburger, sovrapposta al contenuto con backdrop cliccabile. Tutta la logica del drawer — apertura/chiusura, backdrop cliccabile, chiusura con Esc, blocco dello scroll del body mentre è aperto, gestione del focus — vive nel composable `app/src/composables/useMobileSidebar.ts`, non in `App.vue`. Il bottone hamburger è nascosto mentre il drawer è aperto (si usano il backdrop o Esc per chiuderlo). Motivazioni in [decisioni/0009-rifinitura-mobile-fase-8.md](decisioni/0009-rifinitura-mobile-fase-8.md) e [decisioni/0011-rifinitura-sidebar-iconbutton.md](decisioni/0011-rifinitura-sidebar-iconbutton.md).

L'hamburger è fisso in alto a sinistra e sta dentro la fascia dell'header di pagina sticky: su mobile l'header ha un rientro sinistro di 48px, così il titolo non viene mai coperto durante lo scroll.

Altre compattazioni:
- sotto `720px`: titolo di pagina a `--fs-xl`; la disponibilità settimanale passa da quattro colonne a due (giorno e "Disponibile", poi durata e attività);
- sotto `480px`: campi e checkbox su una colonna, pulsanti delle barre d'azione a tutta larghezza, l'etichetta "Modifiche non salvate" è nascosta (lo stato resta leggibile dal pulsante "Salva" attivo).
