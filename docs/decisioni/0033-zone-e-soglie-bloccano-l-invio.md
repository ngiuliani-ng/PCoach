# 0033 — Zone e soglie bloccano anche l'invio; anomalie senza richiamo sopra le tab

**Quando leggerlo**: prima di cambiare cosa blocca l'invio delle sedute a Intervals.icu, o come la scheda segnala le anomalie fuori dalla tab «Anomalie».

**Stato**: attiva. Supera la decisione 2 di [0031](0031-anomalie-dell-atleta-in-una-tab.md) (il richiamo sopra le tab) ed estende [0029](0029-zone-allineate-con-intervals.md) e [0030](0030-soglie-allineate-e-stima-della-durata.md) dal feedback all'invio.

## Contesto

Zone e soglie non allineate fermavano solo il feedback settimanale. Una seduta inviata con un sistema di zone o una soglia diversi da quelli di Intervals.icu arriva però all'atleta con zone e durate diverse da quelle pensate in PCoach. La riga di richiamo sopra le tab, inoltre, ripeteva un'informazione già data dal numero nell'etichetta della tab «Anomalie».

## Decisione

Decisioni del coach (2026-10-13):
1. **Niente riga di richiamo** sopra le tab: fuori dalla tab, le anomalie si segnalano solo con il numero nel tondo arancione accanto a «Anomalie».
2. **Zone e soglie bloccano anche l'invio**: zone diverse, soglie diverse o soglia mancante nella scheda fermano l'invio delle sedute a Intervals.icu, oltre al feedback.

Scelte dell'assistente, da confermare:
- **Una regola sola** (`alignmentProblems` e `syncBlockReason` in `_shared/workouts/thresholds.ts`) per feedback, invio e tab Anomalie.
- **Nell'anteprima di «Sincronizza settimana»** le sedute da creare o aggiornare (anche conflitti ed eventi spariti) diventano «Bloccate» con il motivo. Le rimozioni di sedute annullate o sostituite restano possibili, perché non dipendono da zone e soglie. Il motivo lo calcola `intervals-sync` nell'anteprima (`blocked`).
- **`apply` ricontrolla lato server** prima di ogni creazione o aggiornamento, rileggendo le impostazioni su Intervals.icu. Se la lettura non riesce non blocca: l'invio dell'evento fallirebbe comunque con il suo errore.
- **Nella tab Anomalie** c'è un nuovo gruppo, «Fermano il feedback e l'invio a Intervals.icu». Contiene zone, soglie, soglie mancanti e la chiave non valida (che ferma entrambi).

## Motivo

Le sedute sul calendario dell'atleta devono usare le stesse zone e soglie di PCoach. Il numero nella tab basta come richiamo e non aggiunge un avviso in cima a ogni vista.

## Conseguenze

- Con zone o soglie non allineate «Sincronizza settimana» non invia nulla di nuovo finché non si sistemano dalla tab Anomalie.
- Ogni invio di una seduta fa una lettura in più su Intervals.icu (le impostazioni degli sport).
