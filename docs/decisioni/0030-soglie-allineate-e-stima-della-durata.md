# 0030 — Soglie allineate con Intervals.icu e durata degli step a distanza

**Quando leggerlo**: prima di cambiare la stima della durata delle sedute, il confronto delle soglie con Intervals.icu o la scrittura della soglia sull'account dell'atleta.

**Stato**: attiva. Completa [0029](0029-zone-allineate-con-intervals.md).

## Contesto

PCoach stimava la durata degli step a distanza con una velocità fissa per disciplina (corsa 5:30/km, nuoto 2:00/100 m, bici 30 km/h). Con ripetute di corsa a distanza veloci la stima era molto più lunga del reale. Esempio: 8 × 800 m in Z6 per un atleta con soglia 4:00/km risultava 67' invece di circa 56'. Questo faceva scattare per errore il controllo della durata massima del giorno, che segnava la seduta «Da verificare», e falsava i minuti previsti nel feedback e nell'abbinamento delle attività.

Il coach ha chiesto di stimare la durata come fa Intervals.icu, partendo dalla soglia più recente dell'atleta e dal suo sistema di zone. Ha chiesto anche di controllare che la soglia in PCoach coincida con quella su Intervals.icu e, se non coincide, di proporre di aggiornare Intervals.icu.

Su Intervals.icu (`GET /sport-settings`) `threshold_pace` è in metri al secondo e `ftp` in watt. Le `pace_zones` sono percentuali della velocità di soglia ([0029](0029-zone-allineate-con-intervals.md)). L'unità di `threshold_pace` è confermata da un account reale: 3,56 m/s, cioè 4:41/km.

## Decisione

Decisioni del coach (2026-10-12):
1. **Stima della durata dalla soglia**: uno step a distanza dura *distanza ÷ passo della sua zona*. Il passo si ricava dalla soglia più recente della scheda (`thresholds_log`: passo di soglia per la corsa, CSS per il nuoto) e dai limiti delle zone.
2. **Confronto delle soglie con Intervals.icu** all'apertura della scheda, insieme alle zone. Se non coincidono si propone «Aggiorna Intervals.icu». Come si presenta: tab «Anomalie», [0031](0031-anomalie-dell-atleta-in-una-tab.md). Il verso è sempre PCoach → Intervals.icu, perché la scheda contiene la rilevazione più recente.
3. **Tolleranza**: 1 s/km per la corsa, 1 s/100 m per il nuoto, 1 W per l'FTP.
4. **Avviso, non blocco**, come per le zone. Fa eccezione il **feedback settimanale**: con soglie diverse si ferma in `analysis_failed` («Soglie non allineate con Intervals.icu…») e riparte con «Riprova», perché il tempo nelle zone di Intervals.icu dipende dalla sua soglia.
5. **Soglia mancante**: nessun problema se lo sport non è praticato. Se è praticato, la scheda la segnala con l'invito ad aggiungerla nel Profilo, e il feedback settimanale si ferma («Soglia mancante nella scheda…») finché non viene aggiunta.
6. **Passo di una zona**: Z1 va da 0 al primo limite e l'ultima zona comprende tutto ciò che sta sopra il suo limite. Per la stima, le zone intermedie valgono il centro fra i loro limiti, mentre Z1 e l'ultima valgono il loro unico limite noto: Z1 il limite superiore, l'ultima quello inferiore.
7. **Limiti delle zone**: quelli del modello di Impostazioni per il sistema di zone dell'atleta, cioè quelli che PCoach scrive su Intervals.icu ([0029](0029-zone-allineate-con-intervals.md)). I limiti su Intervals.icu non vengono riletti, perché devono essere sempre allineati. Si confronta solo il numero di zone.
8. **Bici senza FTP**, per ora: si prescrive in FC (ADR 0017), ma la scheda non ha una FC di soglia della bici da confrontare. Non conta quindi come soglia mancante, e non si confronta.

Scelte dell'assistente, da confermare:
- **Intervallo di zone** (Z3-Z4): vale la media fra il passo della zona più bassa e quello della più alta.
- **Soglie confrontate**: solo quelle della misura con cui PCoach prescrive. Corsa: passo di soglia; nuoto: CSS; bici: FTP, solo se la scheda lo ha.
- **Senza soglia** resta la velocità fissa di prima, per esempio nelle anteprime prima di completare la scheda. Vale anche per la bici, che non ha una soglia di passo.
- La stima dalla soglia vale per gli step a distanza di corsa e nuoto **qualunque sia la metrica della seduta**: anche con target in FC le zone corrispondono, in modo approssimato, al passo.
- **Scrittura lato server** (`intervals-sync`, azione `threshold_apply`), come per le zone: `PUT /sport-settings/{id}?recalcHrZones=false` con `threshold_pace` o `ftp`, poi controllo del valore salvato.
- `ANALYSIS_VERSION` passa a 1.2.0, perché cambiano i minuti previsti nel contratto del feedback.

## Motivo

La durata stimata deve essere quella che vede l'atleta su Intervals.icu. Con soglia e sistema di zone allineati, PCoach e Intervals.icu calcolano lo stesso passo per ogni zona.

## Conseguenze

- Totali delle sedute e della settimana, barra della struttura, controllo della durata massima del giorno, controlli settimanali della generazione, minuti nel prompt a Claude, abbinamento delle attività e feedback usano tutti la stessa stima (`workoutTotals` con `paceContextOf`, in `_shared/workouts/thresholds.ts`).
- Cambiare la soglia nel Profilo cambia la durata stimata delle sedute con step a distanza, anche quelle già pianificate. Non cambia invece la loro revisione né la copia su Intervals.icu, che calcola i propri tempi.
- Aggiornare la soglia su Intervals.icu cambia le zone in valore assoluto viste dall'atleta e il tempo nelle zone delle attività successive.
