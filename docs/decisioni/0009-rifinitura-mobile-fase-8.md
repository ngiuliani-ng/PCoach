# 0009 — Rifinitura mobile (Fase 8)

**Quando leggerlo**: per capire perché la sidebar su mobile è un drawer invece di un accordion, perché il grafico del carico unifica touch e mouse, e perché `training_status` è `required` nello schema.

**Stato**: attiva.

## Contesto

Fase 8 (2026-10-04, con un fix successivo per la pipeline CI) ha portato l'app a un comportamento mobile dedicato, invece di un layout desktop semplicemente ristretto.

## Decisione

- Sidebar atleti su schermi stretti (< 720px): **drawer** sovrapposto con backdrop, non un accordion che si apre/chiude inline nel flusso della pagina.
- `LoadMetricsChart.vue`: eventi touch e mouse gestiti dallo stesso codice di interazione (tooltip, selezione punto), invece di due percorsi separati; `aspect-ratio` fisso per evitare salti di layout durante il caricamento dei dati.
- `training_status` è stato reso **obbligatorio** (`required`) nello schema, non più opzionale: una scheda senza stato di allenamento non ha senso ai fini della generazione del piano.
- Un fix successivo alla Fase 8 ha corretto la pipeline CI (vedi [CHANGELOG.md](../../CHANGELOG.md)) relativo a `training_status`.

## Motivo

Un drawer è il pattern più familiare su mobile per un elenco secondario che non deve competere con lo spazio del contenuto principale. Unificare touch/mouse evita di mantenere due implementazioni parallele della stessa interazione. Rendere `training_status` obbligatorio evita stati incompleti che altrimenti richiederebbero controlli difensivi sparsi nel codice.

## Alternativa scartata

Accordion per la sidebar su mobile (sidebar che si comprime/espande inline sopra il contenuto): scartata perché sposta il contenuto principale invece di sovrapporsi, risultando più scomodo su schermi piccoli.
