# 0015 — Barra del titolo PWA desktop: Window Controls Overlay

**Quando leggerlo**: per capire perché la PWA su desktop non mostra nome e icona nella barra del titolo, come è disegnata la fascia di trascinamento e cosa cambia nel layout per effetto di `--titlebar-h`.

**Stato**: attiva.

## Contesto

Installata su Windows, la PWA mostra nella barra del titolo di sistema l'icona e il nome dell'app, che si ripete nell'intestazione "PCoach" della sidebar. Il coach vuole togliere il nome dalla barra di trascinamento e distinguerla dal resto dell'interfaccia con una linea di 1px dello stesso colore dei bordi della sidebar. Il colore della barra è già allineato allo sfondo della sidebar ([0014](0014-colore-finestra-pwa-continuita-sidebar.md)).

## Decisione

1. Il manifest dichiara `display_override: ['window-controls-overlay']`, con `display: 'standalone'` come fallback per i browser che non supportano la modalità.
2. Con la modalità attiva (`@media (display-mode: window-controls-overlay)`) la fascia superiore è disegnata dall'app con `body::before`: sfondo `--surface`, bordo inferiore di 1px in `--border` e `app-region: drag` per trascinare la finestra. L'altezza è il token `--titlebar-h`, pari a `env(titlebar-area-height, 33px)` più 1px: la linea occupa il pixel sotto i pulsanti di sistema e non viene coperta da essi.
3. `body` riceve `padding-top: var(--titlebar-h)` e le regole che assumono una viewport che parte da 0 (altezze `100vh`, sidebar sticky, drawer/toggle/backdrop mobile, schermate di caricamento e login) usano `--titlebar-h`. Dettagli in [design-ui.md § Barra di trascinamento](../design-ui.md#barra-di-trascinamento-pwa-desktop).
4. `<title>` e `name`/`short_name` del manifest restano "PCoach": servono a taskbar, Alt-Tab e cronologia.

## Motivo

La barra di sistema non è personalizzabile via CSS: Window Controls Overlay è il meccanismo che rimuove nome e icona lasciando i pulsanti di sistema e che permette di disegnare la linea di separazione. Il colore dei pulsanti segue `theme-color` ([0014](0014-colore-finestra-pwa-continuita-sidebar.md)), quindi resta coerente con la fascia in `--surface`. Fuori dalla modalità il token vale `0px` e la fascia non esiste: browser, mobile e browser non Chromium non cambiano.

## Alternative scartate

- **Svuotare `short_name` nel manifest**: tentata e annullata nel repository. Agisce sull'etichetta di sistema, non permette di disegnare la linea e degrada l'identificazione dell'app in taskbar e Alt-Tab.
- **Componente Vue dedicato per la fascia**: scartato a favore di `body::before`, che copre caricamento, login e app da un unico punto senza toccare i template.
