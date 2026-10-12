# 0029 — Zone allineate fra PCoach e Intervals.icu

**Quando leggerlo**: prima di cambiare il confronto delle zone con Intervals.icu, i modelli di zone in Impostazioni o la scrittura delle zone sull'account dell'atleta.

**Stato**: attiva. Completa [0025](0025-sistema-di-zone-e-dati-personali-a-claude.md) e [0028](0028-domini-d-intensita-per-sistema-di-zone.md); per le scritture su Intervals.icu segue [0017](0017-sedute-entita-proprie-sincronizzazione-intervals.md).

## Contesto

Le sedute e il feedback seguono il sistema di zone della scheda, ma le zone viste dall'atleta e il tempo nelle zone delle attività vengono da Intervals.icu. Se i due sistemi hanno un numero di zone diverso, le sedute e il feedback non corrispondono a ciò che vede l'atleta. Il coach ha chiesto di verificarlo con la chiave di ogni atleta, con un avviso che proponga di allineare PCoach a Intervals.icu o viceversa.

Formato delle zone su Intervals.icu (`GET /athlete/0/sport-settings`), verificato in sola lettura sull'account di un atleta il 2026-10-12:
- `power_zones`: limite superiore di ogni zona in % dell'FTP, l'ultima vale 999;
- `hr_zones`: limite superiore in bpm, l'ultimo è la FC massima;
- `pace_zones`: limite superiore in % della velocità di soglia, l'ultima vale 999.

Il numero di zone è la lunghezza della lista. Intervals.icu ammette da 3 a 7 zone; i predefiniti sono Coggan (potenza) e Friel (FC e passo), con 7 zone.

## Decisione

Decisioni del coach (2026-10-12):
1. **Cosa si confronta**: solo le zone con cui PCoach prescrive le sedute. Bici: potenza se la scheda ha l'FTP, altrimenti FC; corsa e nuoto: passo. Solo le discipline praticate dall'atleta.
2. **Quando**: all'apertura della scheda. Il confronto usa il profilo salvato. Se una disciplina non coincide, la scheda mostra un avviso con le due scelte. Una lettura non riuscita non mostra nulla: la chiave non valida è già segnalata nel Profilo.
3. **«Usa N zone in PCoach»**: cambia `zone_system` nella scheda e la salva, dopo una conferma. È possibile solo con 3, 5 o 7 zone su Intervals.icu, e non per il nuoto, che in PCoach ha sempre 7 zone.
4. **«Porta Intervals.icu a N zone»**: scrive le zone del modello scelto in Impostazioni, dopo una conferma che mostra i nuovi limiti. Per la FC i limiti in bpm si calcolano dalla FC di soglia e dalla FC massima registrate su Intervals.icu; senza quei valori la scrittura non è possibile.
5. **Modelli di zone in Impostazioni** («Zone su Intervals.icu», colonna `app_settings.zone_models`): per ogni misura (potenza della bici, FC della bici, passo di corsa, passo di nuoto) e per ogni sistema di zone, un preset noto oppure limiti personalizzati. Il coach ha chiesto preset dalla letteratura, con il più usato come predefinito:
   - potenza (% dell'FTP): Coggan 7 livelli (55, 75, 90, 105, 120, 150), Coggan livelli 1-5 (55, 75, 90, 105), Seiler 3 zone (75, 100);
   - FC della bici (% della FC di soglia): Friel 7 zone (81, 89, 93, 99, 102, 106), Friel 5 zone (81, 89, 93, 99), Coggan 5 zone (68, 83, 94, 105), Seiler 3 zone (89, 99);
   - passo di corsa (% della velocità di soglia): Friel 7 zone (77,5, 87,7, 94,3, 100, 103,4, 111,5), Friel 5 zone (77,5, 87,7, 94,3, 100), Seiler 3 zone (87,7, 100);
   - passo di nuoto: il modello predefinito di Intervals.icu a 7 zone.
6. **Scritture solo lato server**, come per le sedute ([0017](0017-sedute-entita-proprie-sincronizzazione-intervals.md)): `intervals-sync` ha le azioni `zones_read` e `zones_apply`. `zones_apply` legge i modelli salvati, scrive con `PUT /sport-settings/{id}?recalcHrZones=false` e controlla che Intervals.icu abbia salvato il numero di zone richiesto.

Scelte dell'assistente, da confermare:
- Seiler definisce le zone rispetto a LT1 e LT2 (zona 1 sotto LT1, zona 2 fra LT1 e LT2, zona 3 sopra LT2), ma PCoach non conosce LT1. LT1 è stimata alla fine della resistenza di Coggan (75% dell'FTP) e della zona 2 di Friel (89% della FC di soglia, 87,7% della velocità di soglia); LT2 coincide con la soglia.
- I modelli a 5 zone di Coggan e Friel uniscono in una zona quelle sopra la soglia (5-7 di Coggan, 5a-5c di Friel).
- L'avviso sta nella scheda, sopra le viste, e non è una finestra che blocca l'apertura.

## Motivo

Sedute, feedback e zone viste dall'atleta devono usare lo stesso sistema. I limiti scritti su Intervals.icu vengono dai modelli di Impostazioni, così la scelta fisiologica resta al coach.

## Conseguenze

- Allineare Intervals.icu cambia le zone dell'atleta anche in ciò che l'atleta vede su Intervals.icu e nelle analisi successive.
- Passare a meno zone in PCoach non cambia le sedute già pianificate: quelle con zone oltre il nuovo limite risultano da verificare ([0025](0025-sistema-di-zone-e-dati-personali-a-claude.md)).
- La FC della corsa e la potenza nel nuoto non si confrontano, perché PCoach non prescrive le sedute con quelle misure.
