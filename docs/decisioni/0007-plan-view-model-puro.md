# 0007 — `planViewModel` come funzione pura testabile

**Quando leggerlo**: prima di modificare come il piano viene trasformato per la visualizzazione (colori zona, stato apertura settimane, larghezza delle barre).

**Stato**: superata da [0017](0017-sedute-entita-proprie-sincronizzazione-intervals.md): la vista del piano basata su `training_plan`, con `planViewModel`, è stata sostituita dalla tab Piano sulle tabelle delle sedute.

## Contesto

Fase 6 (2026-10-04): la vista del piano (`PlanView.vue` → `PlanWeekBlock.vue` → `PlanSessionCard.vue`) necessitava di logica di trasformazione (colore per zona, quali settimane mostrare espanse, percentuale di larghezza delle barre) che non doveva vivere sparsa nei componenti.

## Decisione

- `planViewModel` è una funzione pura (nessuno stato Vue, nessun side-effect), che prende il `training_plan` e restituisce una struttura già pronta per il rendering — testata con Vitest (`services/planViewModel.test.ts`, 13 test).
- L'euristica di colore-zona è una funzione pura dentro lo stesso modulo, non un composable.
- Lo stato di "quali settimane sono espanse" è tenuto a livello di modulo (persiste tra un render e l'altro della stessa sessione, non ricalcolato da zero ogni volta), non dentro ogni istanza di `PlanWeekBlock.vue`.
- `widthPercent` (barra di una sessione nel grafico settimanale) non ha una soglia minima: una sessione molto breve può risultare visivamente quasi invisibile, per non falsare la proporzione reale tra sessioni.

## Motivo

Isolare la trasformazione in una funzione pura la rende testabile senza montare componenti Vue, e riutilizzabile se in futuro servisse un'altra vista sullo stesso piano. Tenere lo stato "settimane espanse" a livello di modulo evita che riaprire la stessa scheda ricollassi tutto.

## Alternativa scartata

Calcolare colori/stato direttamente nei componenti `.vue` con `computed`: scartata perché meno testabile in isolamento e perché duplicherebbe logica tra `PlanWeekBlock.vue` e `PlanSessionCard.vue`.
