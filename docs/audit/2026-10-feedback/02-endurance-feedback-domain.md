# 02 — Dominio del feedback endurance: cosa misurare e cosa si può concludere

**Quando leggerlo**: prima di decidere quali metriche il feedback calcola, come le interpreta e cosa il testo per l'atleta può o non può affermare.

**Stato**: proposta dell'audit del 2026-10-10, da approvare.

## Principio

Il feedback settimanale risponde a cinque domande distinte. Ciascuna ha dati, fonti e limiti diversi, e non vanno fuse in un solo giudizio:

| Livello | Domanda | Natura |
|---|---|---|
| L0 Qualità dei dati | Abbiamo dati sufficienti per rispondere? | fatto calcolato |
| L1 Aderenza | L'atleta ha svolto le sedute assegnate? | fatto calcolato |
| L2 Dose | Quanto volume e quanta intensità ha accumulato, e quanto rispetto al prescritto? | fatto calcolato |
| L3 Esecuzione | Le sedute chiave hanno centrato l'obiettivo fisiologico? | fatto calcolato con limiti forti |
| L4 Risposta | Come ha risposto l'atleta (RPE, sensazioni, benessere)? | dato soggettivo, se presente |
| L5 Interpretazione | Cosa significa e cosa fare la settimana prossima? | giudizio: modello più coach |

Ogni livello vale solo se quello sotto ha dati sufficienti. Se la copertura L0 è insufficiente, L1-L3 si riportano come «non determinabili» e L5 non deve fare affermazioni su quei punti.

Il quadro segue la distinzione, consolidata in letteratura, fra carico esterno (ciò che l'atleta fa: tempo, distanza, potenza, passo) e carico interno (la risposta psicofisiologica: FC, RPE). Il carico interno è il determinante dell'adattamento, e i due non sono intercambiabili [Impellizzeri 2019; Bourdon 2017].

## L0 — Qualità e copertura dei dati

È il presupposto di tutto e oggi manca (problemi P-04 e P-17).

| Indicatore | Definizione | Fonte |
|---|---|---|
| `sync_complete` | La lettura di Intervals.icu per il periodo è riuscita (HTTP 2xx per attività e benessere) | backend |
| `activities_unavailable` | Attività presenti ma senza dati (fonte Strava via API, voce vuota) | campo `source` più assenza di `moving_time` |
| `sensor_coverage[disciplina]` | Quota del tempo con FC, potenza o passo validi | campi di sensore dell'attività |
| `rpe_coverage` | Attività con RPE inserito sul totale delle attività abbinate | attività |
| `wellness_coverage` | Giorni con almeno un campo di benessere sui 7 | benessere |
| `late_data_risk` | La valutazione è stata eseguita prima di N ore dalla fine del periodo | backend |

**Regola**: una seduta senza attività abbinata si classifica come `not_recorded` (non registrata), **mai** come «non eseguita», se `sync_complete` è falso o se esistono attività non disponibili nello stesso giorno. «Non eseguita» è un'interpretazione che il sistema non può dimostrare: può solo dire «nessuna attività registrata», e l'atleta o il coach confermano.

## L1 — Aderenza al piano

### Riferimenti

- **Prescrizione originale** (`P0`): sedute `approved` al primo istante del periodo, ricostruite da `workout_events` (revisione valida a quella data).
- **Piano assegnato** (`P1`): sedute `approved` nel periodo alla chiusura della valutazione. È il riferimento per l'aderenza: se il coach ha cambiato il piano, l'atleta va valutato sul piano nuovo.
- **Modifiche del coach** = `P0 − P1`: annullate, spostate o modificate. Si riportano come contesto, non come mancanza dell'atleta.
- Le bozze (`draft`) sono **escluse** da entrambi.

### Esito per seduta (piano assegnato)

| Esito | Definizione operativa |
|---|---|
| `completed` | Attività abbinata con disciplina compatibile e durata fra l'80% e il 120% del prescritto (vedi nota sulle soglie) |
| `partial` | Abbinata, durata fra il 50% e l'80% del prescritto |
| `short` | Abbinata, durata sotto il 50% |
| `over` | Abbinata, durata oltre il 120% |
| `moved` | Abbinata a un'attività di un altro giorno della stessa settimana (regola in [04](04-matching-and-metrics.md)) |
| `substituted` | Nel giorno c'è un'attività di **altra** disciplina e nessuna della disciplina prevista. Non conta come completata. Diventa `substituted_authorized` solo con la conferma del coach |
| `not_recorded` | Nessuna attività abbinabile e copertura dei dati completa |
| `data_unavailable` | Nessuna attività abbinabile e copertura incompleta |
| `pending` | Data futura o di oggi al momento della valutazione |
| `ambiguous` | Più abbinamenti possibili e nessuna regola li separa |

**Nota sulle soglie 50/80/120%**: sono **euristiche operative**, non soglie fisiologiche. Servono a dare un nome stabile alle categorie e vanno rese configurabili. Il valore di riferimento è la durata prescritta, che per le sedute di endurance è la dose più stabile e confrontabile fra le discipline (la distanza dipende da terreno e condizioni) [Mujika 2017].

### Metriche con denominatori espliciti

Sia `A` l'insieme delle sedute del piano assegnato con data passata, escluse quelle `pending`.

- `sessions_assigned = |A|`
- `sessions_completed = |{completed, over}|`, `sessions_partial = |{partial, short}|`, `sessions_moved = |{moved}|`
- `sessions_not_recorded = |{not_recorded}|`, `sessions_unknown = |{data_unavailable, ambiguous}|`
- **Tasso di completamento** = `(completed + over + moved) / (|A| − sessions_unknown)`, riportato **sempre** insieme a `sessions_unknown`. Se `sessions_unknown / |A| > 0,25`, il tasso non si comunica.
- **Sedute extra**: attività non abbinate, contate a parte (`extra_sessions`, `extra_minutes` per disciplina). **Non entrano mai** nel numeratore dell'aderenza: niente percentuali oltre il 100%.
- **Aderenza di volume per disciplina** = minuti svolti nelle sedute abbinate / minuti prescritti. È un rapporto fra dosi, non un giudizio.

### Casi notevoli

- **Corsa sostituita da bici**: `substituted`. Il volume della bici conta nel volume osservato del ciclismo; la seduta di corsa resta non completata. Il testo può dire «al posto della corsa di martedì c'è un'uscita in bici di 60′», non «aderenza 100%».
- **Seduta spostata al giorno dopo, nella stessa settimana**: `moved`, completata. Se lo spostamento supera il confine della settimana, l'attività finisce nella settimana successiva come extra: abbinarla attraverso le settimane richiede la conferma del coach, perché quella settimana è già stata valutata.
- **Seduta interrotta**: `partial` o `short`, con la causa sconosciuta. Il testo può chiedere, non attribuire.
- **Seduta multidisciplinare (brick)**: in PCoach oggi non esiste: una seduta ha una sola disciplina (`workouts.discipline`). Il caso tipico è una seduta prescritta come due sedute nello stesso giorno, ciascuna abbinata alla propria attività.

## L2 — Dose: volume e intensità

### Volume

| Metrica | Fenomeno | Dati | Fonte autorevole | Applicabilità |
|---|---|---|---|---|
| Tempo di movimento | Durata dello stimolo | `moving_time` | Intervals.icu (dispositivo) | tutte le discipline |
| Distanza | Lavoro meccanico (in parte) | `distance` | Intervals.icu | nuoto in vasca (affidabile), corsa, bici. In bici è poco informativa: dipende da vento, terreno, scia |
| Dislivello | Costo aggiuntivo | `total_elevation_gain` | Intervals.icu | corsa e bici, come contesto |

- **Regola**: il volume si somma **per disciplina**. Il «totale ore» fra discipline è solo descrittivo.
- **Corsa**: il passo dipende dalla pendenza; se disponibile, si usa il passo corretto per la pendenza calcolato da Intervals.icu. Il passo grezzo su percorsi collinari non si confronta con il target.

### Distribuzione dell'intensità

- **Dato**: tempo nelle zone calcolato da Intervals.icu (potenza, FC o passo) con le soglie che Intervals.icu ha per l'atleta (P-18).
- **Modello di confronto**: le zone 1-7 si riducono a 3 domini (sotto la prima soglia, fra le due soglie, sopra la seconda), il modello in cui sono formulate le distribuzioni polarizzata, piramidale e a soglia [Seiler 2010; Stöggl & Sperlich 2015]. La corrispondenza fra 7 zone e 3 domini va definita per sistema di zone (potenza di Coggan, FC, passo) e salvata come configurazione versionata: **non** è universale.
- **Prescritto**: si ricava dalla struttura (`structure.steps`, zona e durata), nella stessa metrica della seduta (`primary_target`).
- **Confronto lecito**: prescritto contro osservato **nella stessa metrica**. Il tempo in zona di FC prescritto in potenza non si confronta, perché la FC ritarda di 1-3 minuti rispetto alla potenza e sottostima le ripetute brevi.
- **Limiti**:
  - la FC sale a parità di potenza con il caldo, la disidratazione e la durata (deriva cardiovascolare [Coyle & González-Alonso 2001]);
  - la FC da sensore ottico al polso in acqua non è affidabile;
  - la potenza stimata (senza misuratore) non è potenza.

  Ogni tempo in zona porta con sé la metrica e la fonte.

### Carico (sintesi di volume e intensità)

| Metrica | Formula e semantica | Uso consentito | Uso vietato |
|---|---|---|---|
| `icu_training_load` di Intervals.icu | Punteggio per attività calcolato da Intervals.icu con priorità configurabile fra potenza, passo e FC (HRSS). Il metodo varia per tipo di attività ([forum Intervals.icu](https://forum.intervals.icu/t/hrss-normalized-trimp-training-load/569)) | Somma settimanale **per disciplina**, confronto con settimane precedenti dello **stesso** atleta, disciplina e metodo | Sommare fra discipline come se fossero equivalenti; confrontare atleti diversi |
| CTL/ATL/TSB | Medie mobili esponenziali del carico giornaliero (42 e 7 giorni), dal modello impulso-risposta [Banister 1975] | Descrivere la tendenza del carico | Dedurre forma, prestazione, rischio di infortunio |
| Rapporto acuto/cronico (ACWR) | — | **Non usare.** I problemi concettuali e di accoppiamento matematico sono documentati, e non c'è evidenza causale per usarlo come leva sul rischio [Impellizzeri 2020; Lolli 2019] | — |
| sRPE | RPE (CR-10) × minuti [Foster 2001] | Carico interno, confrontabile fra discipline per lo stesso atleta; validato anche nel nuoto [Wallace 2009] | Usarlo con copertura RPE bassa |

**Conclusione per PCoach**: con i dati di oggi (niente RPE raccolto), PCoach può **descrivere** volume, intensità osservata e carico di Intervals.icu per disciplina. Non può fare affermazioni sul carico «complessivo» fra le discipline né sulla risposta fisiologica.

## L3 — Esecuzione delle sedute chiave

Vale solo per le sedute con lavoro in zona 4 o superiore, o con struttura a ripetute.

- **Prescritto**: ripetute (numero, durata, zona), recuperi.
- **Osservato**: intervalli rilevati da Intervals.icu o giri dell'attività. È un dato da leggere per singola attività, non incluso nell'elenco.
- **Metrica**: `work_in_target_ratio` = tempo di lavoro nella zona target / tempo di lavoro prescritto, e numero di ripetute completate.
- **Limiti**:
  - l'abbinamento fra ripetute prescritte e osservate è fragile (giri manuali, pause);
  - il mancato raggiungimento del target può essere una scelta deliberata, per fatica, caldo o indicazione del coach. Il sistema lo riporta come scostamento, non come errore, e il testo può chiedere il motivo.
- **Raccomandazione**: fase successiva (vedi [06](06-target-architecture-and-roadmap.md)). Nella prima versione, L3 si limita a «seduta di qualità: durata e tempo in zona alta osservato contro prescritto».

## L4 — Risposta dell'atleta e recupero

| Dato | Raccolto oggi? | Fonte possibile | Frequenza | Affidabilità longitudinale |
|---|---|---|---|---|
| RPE di seduta | No | Intervals.icu (inserito dall'atleta per attività) | per seduta | buona se raccolto con costanza [Foster 2001] |
| Sensazione | No | Intervals.icu, inserita dall'atleta | per seduta | moderata |
| HRV, FC a riposo | No: letti nel benessere ma scartati (P-12) | benessere di Intervals.icu (da dispositivi) | giornaliera | richiede una base individuale e tendenze su più giorni [Plews 2013] |
| Sonno, fatica, dolore, stress, umore | No: come sopra | benessere di Intervals.icu (inseriti) | giornaliera | le misure soggettive sono sensibili al carico quanto o più di quelle oggettive [Saw 2016] |
| Fattori di vita | Sì (`lifestyle_factors`), statici | scheda | rara | contesto, non misura |

**Regole**:
- Nessuna conclusione su recupero insufficiente, sovrallenamento, rischio di infortunio o adattamento da una metrica isolata o da una sola settimana. La diagnosi di sovrallenamento richiede l'esclusione di altre cause e un calo di prestazione persistente [Meeusen 2013].
- Con `rpe_coverage < 0,5` e `wellness_coverage < 4/7`, il feedback **deve** dire che non dispone di dati sulla risposta dell'atleta e può **chiedere** come si è sentito.
- Se i dati ci sono, la regola descrittiva lecita è «l'HRV media della settimana è sotto la tua media dei 30 giorni precedenti» (fatto). Non è lecito dire «sei in sovrallenamento».

## Valutazione settimanale e tendenze

| Confronto | Significativo quando | Fuorviante quando |
|---|---|---|
| Settimana contro il piano della stessa settimana | sempre, con L0 sufficiente | dati incompleti |
| Settimana contro quella precedente | stessa fase o fase attesa (carico 2 contro carico 1) | si confronta uno scarico con un carico; c'è stata una gara, una malattia o un viaggio |
| Scarico osservato contro scarico prescritto | sempre: lo scarico è voluto (ADR 0018, `weeks_meta.is_deload`) | — |
| Volume di quattro settimane | per vedere la progressione del ciclo | cambi di piano a metà ciclo |
| Distribuzione dell'intensità osservata contro quella del metodo dell'atleta | su 2-4 settimane, stessa metrica | una sola settimana con poche sedute |

**Regola**: una riduzione di carico **prescritta** (scarico, raccordo, avvicinamento alla gara) si valuta come aderenza a quella prescrizione, mai come un calo da segnalare. Il contratto porta sempre la fase della settimana (`weeks_meta`, `cycle_week`).

**Soglie di scostamento della settimana** (euristiche, configurabili):
- volume per disciplina oltre ±20% rispetto al prescritto → «scostamento rilevante»;
- oltre ±10% → «lieve».

Non sono soglie di rischio. Servono a decidere cosa il testo mette in evidenza.

## Conclusioni consentite e vietate

| Consentito, con dati sufficienti | Vietato |
|---|---|
| «4 sedute su 5 registrate e abbinate al piano; per 1 non c'è un'attività registrata» | «Hai saltato una seduta», se non confermato dall'atleta |
| «Corsa: 3 h 10′ svolte contro 3 h 30′ prescritte (−10%)» | «Volume complessivo 105%», sommando le extra |
| «Nella seduta di soglia il tempo in Z4 è stato 18′ contro 24′ prescritti» | «Non sei riuscito a tenere la soglia perché sei stanco» |
| «Settimana di scarico: il volume è calato del 30% come previsto» | «Il carico è calato, attenzione» in una settimana di scarico |
| «Non abbiamo dati su come ti sei sentito: com'è andata?» | Affermazioni su recupero, sovrallenamento, rischio di infortunio, forma |
| «Il tuo CTL di Intervals.icu è passato da 52 a 55» | «Sei più in forma»; confronti di CTL fra atleti |

## Specificità per disciplina

| Disciplina | Dose principale | Intensità affidabile | Attenzioni |
|---|---|---|---|
| Corsa | tempo | passo corretto per pendenza, FC | caldo e deriva della FC; dislivello; tapis roulant (passo dal sensore del piede o stimato) |
| Ciclismo | tempo | potenza, se misurata da un misuratore; altrimenti FC | potenza stimata dal software ≠ misurata; rulli e strada |
| Nuoto | distanza (vasca) o tempo | passo su 100 m rispetto alla CSS | FC al polso in acqua poco affidabile; acque libere con GPS impreciso |
| Forza | tempo, sRPE | — | nessuna zona; l'aderenza è solo «svolta o non svolta» e la durata |

## Cosa calcola il backend e cosa scrive il modello

Tutto L0-L4 è **calcolato dal backend** in modo deterministico. Il modello riceve fatti, scostamenti, limiti e domande consentite, e produce solo L5 (sintesi, spiegazione, domande, indicazioni coerenti con il piano). Dettaglio in [03](03-data-contract-and-model.md).

## Fonti

Le voci con DOI sono riferimenti noti della letteratura. Ho verificato online i dati bibliografici di Bourdon 2017 e Impellizzeri 2020. Le altre sono citate dalla conoscenza della letteratura e i loro testi non sono stati riletti in questa sessione: vanno controllate prima di citarle in materiali per gli atleti.

- **Consolidate**:
  - Banister EW et al. (1975). A systems model of training for athletic performance. *Aust J Sports Med* 7:57-61.
  - Bourdon PC et al. (2017). Monitoring athlete training loads: consensus statement. *IJSPP* 12(Suppl 2):S2-161–S2-170. doi:10.1123/IJSPP.2017-0208 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/28463642/)).
  - Coyle EF, González-Alonso J (2001). Cardiovascular drift during prolonged exercise: new perspectives. *Exerc Sport Sci Rev* 29(2):88-92.
  - Foster C et al. (2001). A new approach to monitoring exercise training. *J Strength Cond Res* 15(1):109-115.
  - Impellizzeri FM, Marcora SM, Coutts AJ (2019). Internal and external training load: 15 years on. *IJSPP* 14(2):270-273. doi:10.1123/ijspp.2018-0935.
  - Impellizzeri FM et al. (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *IJSPP* 15(6):907-913. doi:10.1123/ijspp.2019-0864 ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/)).
  - Lolli L et al. (2019). Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *Br J Sports Med* 53(15):921-922.
  - Meeusen R et al. (2013). Prevention, diagnosis and treatment of the overtraining syndrome: joint consensus statement ECSS/ACSM. *Med Sci Sports Exerc* 45(1):186-205.
  - Mujika I (2017). Quantification of training and competition loads in endurance sports: methods and applications. *IJSPP* 12(Suppl 2):S2-9–S2-17.
  - Plews DJ et al. (2013). Training adaptation and heart rate variability in elite endurance athletes. *Sports Med* 43(9):773-781.
  - Saw AE, Main LC, Gastin PB (2016). Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures. *Br J Sports Med* 50(5):281-291.
  - Seiler S (2010). What is best practice for training intensity and duration distribution in endurance athletes? *IJSPP* 5(3):276-291.
  - Stöggl TL, Sperlich B (2015). The training intensity distribution among well-trained and elite endurance athletes. *Front Physiol* 6:295.
  - Wallace LK, Slattery KM, Coutts AJ (2009). The ecological validity and application of the session-RPE method for quantifying training loads in swimming. *J Strength Cond Res* 23(1):33-38.
- **Documentazione dei provider**, informazioni dal forum ufficiale e non da una specifica formale:
  - attività Strava non disponibili via API ([forum](https://forum.intervals.icu/t/solved-data-misssing-through-api-strava-restrictions/108827), [forum](https://forum.intervals.icu/t/strava-privacy-update-nov24/79940));
  - carico di allenamento e HRSS ([forum](https://forum.intervals.icu/t/hrss-normalized-trimp-training-load/569), [forum](https://forum.intervals.icu/t/correct-training-load-calculations/107855));
  - abbinamento attività-evento ([forum](https://forum.intervals.icu/t/how-to-check-if-a-calendar-event-is-completed-in-intervals-icu/106140)).
- **Euristiche operative proposte qui**, non evidenze:
  - soglie 50/80/120% per l'esito della seduta;
  - ±10% e ±20% per gli scostamenti di volume;
  - copertura minima RPE 0,5 e benessere 4/7;
  - quota massima di sedute indeterminate 0,25.

  Tutte vanno rese configurabili e riviste dal coach.
