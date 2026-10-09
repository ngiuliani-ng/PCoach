# 0014 — Colore finestra PWA: continuità con lo sfondo sidebar

**Quando leggerlo**: per capire come è definito il colore della barra del titolo/stato della PWA e perché riflette lo sfondo della sidebar anziché quello della pagina o un colore di accento.

**Stato**: attiva.

## Contesto

L'applicazione espone un layout desktop a due colonne, con la sidebar atleti ancorata a sinistra a tutta altezza (`--surface`). Nella configurazione iniziale della PWA (manifest e meta tag HTML), il colore della finestra era impostato su un valore statico (`#863bff`, viola), ereditato come placeholder non appartenente al design system di PCoach. Questo generava una barra del titolo marcatamente dissonante rispetto al resto dell'interfaccia.

## Decisione

1. In `app/index.html`, il `theme-color` è suddiviso in due meta tag con media query `prefers-color-scheme`:
   - Dark: `#1C2025` (corrispondente al token `--surface` scuro);
   - Light: `#FFFFFF` (corrispondente al token `--surface` chiaro).
2. Nel manifest PWA (`app/vite.config.ts`), `theme_color` e `background_color` sono impostati su `#1C2025`, in linea con il tema scuro predefinito del sistema.

## Motivo

La barra del titolo della finestra PWA si trova a diretto contatto con la testata della sidebar in alto a sinistra. L'allineamento con `--surface` garantisce una continuità visiva verticale pulita, facendo apparire la finestra come un'applicazione desktop integrata sia in tema scuro che chiaro.

## Alternative scartate

- **Sfondo pagina (`--bg`: `#14171B` / `#F5F6F8`)**: inizialmente valutato, ma scartato perché produceva un salto cromatico percepibile proprio sopra la colonna della sidebar.
- **Accento brand (`--accent`: `#37C2AE` / `#0F6E64`)**: scartato perché una barra del titolo a colore pieno saturo distrae dall'area di lavoro ed è contraria alla sobrietà definita in [design-ui.md](../design-ui.md).
- **Colore fisso unico**: scartato perché risulterebbe inadatto non appena il dispositivo dell'utente passa dal tema scuro al tema chiaro o viceversa.
