# 0028 — Domini d'intensità del feedback per sistema di zone

**Quando leggerlo**: prima di cambiare come il feedback settimanale divide le zone in intensità bassa, media e alta, o come riconosce le sedute di qualità.

**Stato**: attiva. Completa [0025](0025-sistema-di-zone-e-dati-personali-a-claude.md) (sistema di zone dell'atleta) per l'analisi del feedback ([0019](0019-feedback-analisi-deterministica-approvazione.md)).

## Contesto

Dopo [0025](0025-sistema-di-zone-e-dati-personali-a-claude.md) le sedute seguono il sistema di zone di ogni atleta (3, 5 o 7 zone per corsa e bici, 7 per il nuoto). Il feedback invece aveva un'unica coppia di soglie per tutti («Intensità bassa fino alla zona» 2, «Intensità media fino alla zona» 4). Per un atleta a 3 zone la Z3 contava come intensità media, ma in quel modello è l'intensità alta, e la distribuzione dell'intensità risultava sbagliata.

## Decisione

Decisione del coach: «Voglio che l'app sia più modulare possibile», quindi PCoach ricava le soglie dal sistema di zone di ciascun atleta, con regole definibili in Impostazioni.
1. `feedback_params` ha una coppia di soglie per ogni sistema: `z3_low_max`/`z3_moderate_max`, `z5_…`, `z7_…`. Oltre la zona dell'intensità media l'intensità è alta. Ogni valore resta entro le zone del suo sistema, e la soglia bassa deve essere inferiore alla media.
2. Valori predefiniti, scelti dall'assistente e modificabili dal coach:
   - 3 zone: bassa Z1, media Z2, alta Z3 (le tre zone coincidono con i tre domini);
   - 5 zone: bassa Z1-Z2, media Z3, alta Z4-Z5;
   - 7 zone: bassa Z1-Z2, media Z3-Z4, alta Z5-Z7 (i valori in uso finora).
3. L'analisi (`contract.ts`, `match.ts`) usa per ogni disciplina la coppia del sistema dell'atleta, letta dalla scheda con `zoneCountsOf` (`_shared/workouts/zones.ts`, condiviso con l'app). Vale per la distribuzione dell'intensità e per riconoscere le sedute di qualità (lavoro oltre l'intensità bassa). Il contratto salva i domini usati, per esempio «3 zone: bassa ≤ Z1, media Z2-Z2, alta ≥ Z3». `ANALYSIS_VERSION` passa a 1.1.0.
4. Le soglie salvate prima (`low_zone_max`, `moderate_zone_max`) si leggono come quelle a 7 zone. Al primo salvataggio delle Impostazioni si scrivono con i nomi nuovi.
5. Il nuoto usa sempre 7 zone. Nel Profilo il suo «Sistema di zone» è un campo come quelli di corsa e bici, ma non modificabile (scelta grafica del coach).

## Motivo

Le zone delle sedute e quelle del feedback devono seguire lo stesso sistema: altrimenti il feedback giudica una seduta con regole diverse da quelle con cui è stata pianificata.

## Conseguenze

- Al 2026-10-12 tutti gli atleti usano 7 zone: i feedback restano identici.
- Il tempo nelle zone osservato viene da Intervals.icu. Se lì l'atleta ha un numero di zone diverso da quello della scheda, la distribuzione non è attendibile: il sistema va allineato sui due lati ([limiti-roadmap.md](../limiti-roadmap.md)).
