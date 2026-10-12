# 0031 — Anomalie dell'atleta in una tab

**Quando leggerlo**: prima di aggiungere un nuovo tipo di avviso sulla scheda atleta, o di cambiare la tab «Anomalie» e il richiamo sopra le tab.

**Stato**: attiva; la decisione 2 (richiamo sopra le tab) è superata da [0033](0033-zone-e-soglie-bloccano-l-invio.md). Cambia la presentazione degli avvisi di [0029](0029-zone-allineate-con-intervals.md) e [0030](0030-soglie-allineate-e-stima-della-durata.md), non le loro regole.

## Contesto

Gli avvisi in cima alla scheda crescevano: zone diverse da Intervals.icu, soglie diverse, soglie mancanti. Altre anomalie erano sparse nell'app: sedute «Da verificare» nel Piano, invii non riusciti nei badge, feedback fermo nella Panoramica, chiave non valida nel Profilo. Il coach ha chiesto di raggruppare le anomalie di ogni atleta.

## Decisione

Decisioni del coach (2026-10-12):
1. **Una tab «Anomalie»** nella scheda atleta, con l'elenco completo e l'azione di ciascuna anomalia.
2. **Un richiamo sopra le tab**: una sola riga, visibile in tutte le viste tranne la tab stessa, con il numero di anomalie e «Vedi le anomalie». Prende il posto degli avvisi separati di zone e soglie.
3. **Raggruppare** le anomalie per atleta.

Scelte dell'assistente, da confermare:
- **Gruppi per ciò che fermano**: «Fermano il feedback settimanale» e «Fermano l'invio a Intervals.icu». È la domanda che il coach si fa davanti a un'anomalia, e dice quanto è urgente.
- **Anomalie raccolte**:
  - zone o soglie diverse da Intervals.icu;
  - soglia mancante;
  - feedback non preparato, oppure approvato ma non inviato. Solo nelle ultime 4 settimane, le stesse mostrate senza «Mostra tutti», così una settimana vecchia non resta per sempre tra le anomalie;
  - chiave Intervals.icu non valida;
  - sedute «Da verificare» da svolgere;
  - invii non riusciti.
- Sedute da verificare e invii non riusciti sono **una sola anomalia con l'elenco delle sedute**. Nel conteggio ogni seduta vale uno.
- Le azioni che scrivono restano quelle di prima, con le stesse conferme: «Usa N zone in PCoach», «Porta Intervals.icu a N zone», «Aggiorna Intervals.icu». Le altre portano dove si sistema: le soglie nel Profilo, il feedback nella Panoramica, il pannello della seduta, la chiave nel Profilo.
- La tab esiste solo per una scheda salvata: una bozza non ha sedute, feedback né Intervals.icu.

## Motivo

Un solo posto in cui vedere cosa non va per un atleta e cosa blocca, al posto di avvisi sparsi che si sommano in cima alla pagina.

## Conseguenze

- Un nuovo tipo di anomalia si aggiunge in `useAthleteAnomalies.ts`, scegliendo il gruppo, e compare sia nella tab sia nel conteggio del richiamo.
- Zone e soglie si leggono da Intervals.icu una sola volta all'apertura della scheda, per tab e richiamo insieme.
