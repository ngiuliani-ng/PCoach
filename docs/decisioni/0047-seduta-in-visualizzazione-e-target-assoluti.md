# 0047 — Seduta aperta in visualizzazione e zone tradotte in watt e passo

**Quando leggerlo**: prima di cambiare come si apre il pannello della seduta, il passaggio fra visualizzazione e modifica, o il modo in cui le zone diventano valori assoluti (watt, passo) e quale soglia si usa.

**Stato**: attiva.

## Contesto

Il pannello della seduta (`?seduta=<id>`) era solo un modulo di modifica: all'apertura il focus andava nel campo del nome e ogni dato era un campo, anche quando il coach voleva solo leggere la seduta. Le sedute sono prescritte in zone (Z1-Z7) e il coach conosce soglie e percentuali delle zone di ogni atleta, ma in PCoach vedeva solo «Z3», senza i watt o il passo corrispondenti.

## Decisione

1. **Il pannello si apre in visualizzazione** (`WorkoutView`): data, disciplina, obiettivo, barra della struttura, un elenco leggibile degli step (tipo, durata, zona, valore assoluto, indicazione) e note per l'atleta. Il nome è il titolo del dialogo. Le azioni che non sono modifiche restano disponibili senza entrare nell'editor: «Approva» o «Segna verificata», «Segna come svolta», «Annulla seduta» o «Elimina bozza», «Ripristina come bozza».
2. **«Modifica» apre l'editor** di sempre, con il focus sul nome. In modifica il piede ha «Scarta modifiche» (conferma se ci sono modifiche e torna alla visualizzazione), «Salva modifiche» (torna alla visualizzazione) e «Salva e approva» o «Salva e segna verificata» (chiude il pannello). Le sedute annullate o sostituite si vedono solo in visualizzazione.
3. **Zone tradotte in valori assoluti, solo da mostrare** (`domain/zoneTargets.ts`):
   - bici in potenza: watt dall'FTP;
   - corsa in passo: min/km dal passo di soglia;
   - nuoto: min/100 m dalla CSS.

   La soglia è quella della **rilevazione valida nel giorno della seduta**: l'ultima dello storico con data uguale o precedente. Una seduta precedente alla prima rilevazione usa la prima. Spostando la seduta in modifica, il valore segue la nuova data. La visualizzazione dice da quale rilevazione viene: «FTP 230 W, rilevazione del 1 set 2026». Sistema di zone e modelli di Impostazioni non hanno uno storico: valgono quelli attuali.

   I limiti delle zone sono quelli del modello di Impostazioni per il sistema di zone dell'atleta. Per il passo le percentuali sono della velocità di soglia, quindi il passo è la soglia divisa per la percentuale. Z1 parte da zero («fino a 127 W», «più lento di 6:09 /km») e l'ultima zona è aperta («oltre 375 W», «più veloce di 3:40 /km»). Un intervallo Zx–Zy va dal limite inferiore di Zx al superiore di Zy. Il valore compare accanto alla zona sia in visualizzazione sia nell'editor, accanto al selettore.
4. **La frequenza cardiaca resta in zone**: la scheda non ha una FC di soglia della bici. Senza la soglia della metrica scelta, una nota dice che si vedono solo le zone.

Decisione del coach del 27 novembre 2026: corsa in min/km, FC solo in zone, approvazione possibile dalla visualizzazione, soglia del giorno della seduta.

## Conseguenze

- Le sedute restano salvate, generate da Claude e inviate a Intervals.icu in zone. I valori assoluti si ricalcolano dallo storico delle soglie: una nuova rilevazione cambia i valori delle sedute dalla sua data in poi, non quelli delle sedute precedenti.
- Intervals.icu traduce le zone con una sola soglia, quella attuale del suo account: per le sedute dall'ultima rilevazione in poi coincide con PCoach quando le soglie sono allineate (tab Anomalie); per le sedute precedenti i valori di PCoach sono quelli dell'epoca.
- Una rilevazione inserita con una data passata cambia i valori delle sedute da quella data in poi.
- Il nome del dialogo è quello della seduta e non più «Nome della seduta». Aprire una seduta su telefono non apre la tastiera.
