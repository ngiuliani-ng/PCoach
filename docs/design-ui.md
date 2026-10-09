# Linee guida grafiche

**Quando leggerlo**: prima di aggiungere o modificare un componente visuale, per restare coerenti con i token di design, la tipografia, gli stati dei componenti, le regole di accessibilità o il comportamento mobile.

## Design token

Variabili CSS definite in `app/src/styles/tokens.css`, con supporto a tema chiaro/scuro tramite `:root:not([data-theme="light"])` (il tema scuro è il default; `data-theme="light"` sul root attiva esplicitamente il tema chiaro).

| Token | Uso |
|---|---|
| `--bg`, `--bg-elevated` | Sfondo pagina / sfondo di card e pannelli sollevati |
| `--text`, `--text-muted` | Testo primario / testo secondario |
| `--border` | Bordi di card, input, separatori |
| `--accent` | Colore di accento (azioni primarie, stato attivo) |
| `--success`, `--warning`, `--danger` | Stati semantici (conferma, attenzione, errore) |
| `--chart-ctl`, `--chart-atl`, `--chart-tsb` | Colori delle tre serie nel grafico del carico |
| `--chart-bar` | Colore delle barre nel grafico del carico (TSS giornaliero) |
| `--radius` | Raggio di bordo standard per card/input/bottoni |
| `--shadow` | Ombra standard delle card sollevate |

La barra del titolo della finestra PWA e la barra di stato mobile seguono `--surface` (lo sfondo della sidebar): `#1C2025` su tema scuro e `#FFFFFF` su tema chiaro, dichiarati via `prefers-color-scheme` in `index.html` (vedi [sviluppo-deploy.md § PWA](sviluppo-deploy.md#pwa-progressive-web-app)).

## Tipografia e spaziatura

- Font di sistema (stack `-apple-system, ...`), nessun web font caricato da remoto.
- Scala tipografica a step fissi (`--font-size-sm/md/lg/xl`), nessun valore `px` libero nei componenti.
- Spaziatura su scala a multipli di 4px (`--space-1`...`--space-6`), usata per padding/gap/margin.

## Iconografia

- Set vettoriale unificato basato su `lucide-vue-next` per i controlli e gli indicatori di interfaccia (toggle sidebar mobile, pulsanti sidebar, caret delle sezioni comprimibili, toggle password, azioni di eliminazione/creazione).
- Tratto uniforme (stroke-width di default 2px, 1.5px per icone placeholder grandi) e dimensioni calibrate (`14px` per azioni compatte, `16px`/`18px` per pulsanti, `20px` per toggle mobile). Nessun SVG inline cablato a mano nei componenti per i comandi UI.
- Le icone puramente decorative o contenute in elementi già provvisti di etichetta accessibile includono `aria-hidden="true"`.

## Componenti generici (`components/ui/`)

- **Toast** (`ToastHost.vue` + `useToast`): notifiche non bloccanti, auto-dismiss salvo errori (restano finché l'utente non li chiude, per garantire che errori importanti non scompaiano prima di essere letti).
- **ConfirmDialog** (`ConfirmDialog.vue` + `useConfirmDialog`): unico punto per conferme distruttive (eliminazione atleta, scarto di dati non salvati); mai `window.confirm`.
- **PasswordField**: campo per segreti digitati dall'utente (es. chiave Intervals.icu) con toggle mostra/nascondi basato su icone Lucide (`Eye`/`EyeOff`, pulsante con `aria-label`, senza tooltip nativo), mai loggato né esposto in chiaro nel DOM a riposo.
- **Card**: contenitore standard con `--bg-elevated`, `--radius`, `--shadow`; base per sidebar, pannelli impostazioni, card sessione.
- **IconButton**: bottone compatto solo icona con stato hover/focus accessibile (`aria-label` obbligatorio, nessun tooltip nativo via `title`), ospita icone Lucide (es. `Settings`, `LogOut`) tramite slot, usato nel footer della sidebar per "Impostazioni" ed "Esci".

## Layout

- Layout a due colonne su desktop: sidebar atleti a sinistra, contenuto (editor atleta o stato vuoto) a destra.
- Il contenitore della sidebar e il contenuto principale sono flex; la larghezza relativa è impostata inline sul segmento figlio direttamente coinvolto (es. la lista atleti), non sul contenitore padre.

## Stati dei componenti

Ogni componente interattivo gestisce esplicitamente: default, hover, focus (visibile via `:focus-visible`, mai rimosso con `outline: none` senza sostituto), disabled, loading (dove rilevante, es. salvataggio in corso), errore.

## Accessibilità

- Contrasto testo/sfondo verificato per i token di colore principali in entrambi i temi.
- Tutti i controlli interattivi raggiungibili da tastiera; ordine di tabulazione naturale (nessun `tabindex` positivo).
- Icone e pulsanti solo-icona privi di testo visibile accompagnati da `aria-label` (nessun attributo `title` per evitare tooltip nativi ridondanti sul cursore).
- Dialoghi (`ConfirmDialog`, drawer mobile) intrappolano il focus e lo restituiscono all'elemento che li ha aperti alla chiusura.

## Zone e discipline

- Colori di zona (Z1-Z5 o equivalenti) derivati da una scala semantica condivisa, non hardcoded per componente.
- Icone disciplina da un set condiviso in `constants.ts`, associate per chiave disciplina.
- Il testo delle etichette (zone, discipline) non è forzato in maiuscolo: il CSS imposta `text-transform: none` esplicitamente.

## Regole mobile

Breakpoint: `720px` (passaggio a layout mobile a singola colonna) e `480px` (ulteriori compattazioni, es. header).

Sotto i `720px` la sidebar atleti diventa un **drawer**: nascosta di default, aperta con un bottone hamburger, sovrapposta al contenuto con backdrop cliccabile. Tutta la logica del drawer — apertura/chiusura, backdrop cliccabile, chiusura con Esc, blocco dello scroll del body mentre è aperto, gestione del focus — vive nel composable `app/src/composables/useMobileSidebar.ts`, non in `App.vue`. Il bottone hamburger è nascosto mentre il drawer è aperto (si usano il backdrop o Esc per chiuderlo). Motivazioni in [decisioni/0009-rifinitura-mobile-fase-8.md](decisioni/0009-rifinitura-mobile-fase-8.md) e [decisioni/0011-rifinitura-sidebar-iconbutton.md](decisioni/0011-rifinitura-sidebar-iconbutton.md).

Il grafico del carico (`LoadMetricsChart.vue`) unifica gli eventi touch e mouse per tooltip/interazione, ed ha un `aspect-ratio` fisso per evitare salti di layout durante il caricamento.
