# 04 — Abbinamento fra sedute e attività, e calcolo delle metriche

**Quando leggerlo**: prima di implementare o modificare il modulo che collega le attività di Intervals.icu alle sedute di PCoach e ne calcola le metriche.

**Stato**: proposta dell'audit del 2026-10-10, da approvare.

## Posizione nel codice

Il modulo è puro, senza rete e senza database: `supabase/functions/_shared/feedback/`, con alias `@shared` già usato da app e Vitest. I file:
- `normalize.ts`: attività → `NormalizedActivity`;
- `match.ts`: abbinamento;
- `metrics.ts`: metriche;
- `contract.ts`: costruisce `feedback_input`.

La Edge Function si limita a leggere i dati, chiamare il modulo e salvare.

## Passo 1 — Normalizzazione delle attività

Ingresso: elenco `/activities` del periodo, allargato di 1 giorno per lato per riconoscere gli spostamenti. Le attività fuori periodo non entrano nelle metriche.

1. **Disciplina** dal tipo Intervals.icu, tramite una tabella esplicita e versionata. Esempio:

   | Tipo Intervals.icu | Disciplina |
   |---|---|
   | `Run`, `TrailRun`, `VirtualRun` | `running` |
   | `Ride`, `VirtualRide`, `GravelRide`, `MountainBikeRide`, `EBikeRide` | `cycling` (`EBikeRide` segnalata) |
   | `Swim`, `OpenWaterSwim` | `swimming` |
   | `WeightTraining`, `Workout` | `strength` |
   | tutto il resto (`Walk`, `Hike`, …) | `other`: carico osservato, mai abbinato |

   I tipi non mappati vanno in `other` con un'anomalia `unmapped_type`. La lista completa dei tipi va presa dalla specifica OpenAPI di Intervals.icu.

2. **Disponibilità**: un'attività con fonte Strava, senza tempo di movimento, oppure con la nota «not available via the API», prende `status = unavailable`. Conta in `data_quality.activities_unavailable` e rende `data_unavailable` le sedute dello stesso giorno rimaste senza abbinamento.
3. **Doppioni**: due attività sono doppioni se hanno la stessa disciplina, inizi entro 5 minuti e tempi di movimento che differiscono meno del 10%. Si tiene quella con più sensori (potenza > passo > FC > nessuno), a parità quella con `id` minore. L'altra prende `status = duplicate`, resta nell'istantanea e non conta.
4. **Campi**:
   - durata = tempo di movimento;
   - distanza, dislivello;
   - tempo nelle zone ridotto ai 3 domini con la metrica della seduta;
   - carico di Intervals.icu e metodo;
   - RPE e sensazione;
   - presenza dei sensori;
   - `paired_event_id`.

## Passo 2 — Abbinamento

### Insiemi

- `W` = sedute `approved` del periodo (piano assegnato), ordinate per data e `slot`.
- `A` = attività `ok` e non `other` nel periodo allargato.

### Regole in ordine di priorità

Ogni regola si applica solo a sedute e attività ancora libere. Un'attività appartiene al massimo a una seduta; una seduta può avere più attività solo con la regola R4.

| # | Regola | Condizione | Confidenza | Esito |
|---|---|---|---|---|
| R0 | Legame del coach | abbinamento confermato a mano (fase 4, tabella `workout_matches`) | `confirmed` | quello scelto dal coach |
| R1 | Evento abbinato su Intervals.icu | `activity.paired_event_id == workout_sync.remote_event_id` | `confirmed` | dalla durata (vedi passo 3) |
| R2 | Stesso giorno, stessa disciplina, coppia unica | una sola seduta e una sola attività libere di quella disciplina quel giorno | `high` | dalla durata |
| R3 | Stesso giorno, stessa disciplina, più candidati | n sedute e m attività della stessa disciplina nello stesso giorno | `medium` se l'ordine di `slot` e di orario d'inizio dà un'assegnazione con rapporti di durata fra 0,5 e 1,5 per ogni coppia; altrimenti `ambiguous` | dalla durata, oppure `ambiguous` per tutte le sedute del gruppo |
| R4 | Seduta frazionata | ancora libere, una seduta e 2 o più attività della stessa disciplina nello stesso giorno, con somma delle durate fra 0,8 e 1,2 volte il prescritto | `medium` | `completed` con più `activity_ids` |
| R5 | Spostamento | seduta libera con data passata; attività libera della stessa disciplina entro ±2 giorni, **nella stessa settimana**; nel giorno dell'attività nessuna seduta libera della stessa disciplina; rapporto di durata fra 0,5 e 1,5 | `low` | `moved` |
| R6 | Sostituzione | seduta libera con data passata; nello stesso giorno, attività libera di **altra** disciplina di endurance | `low` | la seduta diventa `substituted`; l'attività resta extra nel volume della sua disciplina e porta il riferimento `substitutes` |
| R7 | Restanti | seduta libera | — | `pending` se la data è oggi o futura; altrimenti `data_unavailable` se la copertura del giorno è incompleta, `not_recorded` se è completa |

Le attività rimaste libere sono `extra`.

**Vincoli contro gli errori tipici**:
- *Solo la vicinanza temporale*: R5 richiede la stessa disciplina, la stessa settimana, un rapporto di durata compatibile e nessun candidato migliore nel giorno dell'attività. Fuori da queste condizioni non si abbina.
- *Doppio conteggio delle sostituzioni*: in R6 l'attività non viene assegnata alla seduta. Il suo volume conta una volta sola, nella sua disciplina; la seduta resta non completata.
- *Attività su più sedute*: è un vincolo di unicità nel modulo. Con la tabella `workout_matches` (fase 4) diventa un vincolo del database: `unique (activity_id)` per le righe non annullate.
- *Perdita della provenienza*: ogni abbinamento salva `method`, `confidence` e gli `activity_ids` originali, nell'istantanea della valutazione.
- *Spostamenti oltre la settimana*: non si abbinano mai in automatico. L'attività è extra nella settimana in cui è stata svolta e la seduta è `not_recorded` nella sua; il coach può collegarle (R0) e la valutazione della settimana già chiusa diventa rigenerabile.

**Confidenza nelle metriche**:
- `confirmed`, `high`, `medium`: contano nel tasso di completamento;
- `low` (spostamento): conta come completata ma è elencata nel contratto. Il modello lo dice come ipotesi («sembra che tu abbia spostato…»);
- `ambiguous`: va in `sessions.unknown`.

## Passo 3 — Esito per seduta

Per le sedute abbinate:
- **Rapporto di durata** `r = minuti svolti / minuti prescritti`. Per una seduta di nuoto prescritta in distanza si usa la distanza.
- **Esito**:
  - `over` se `r > 1,2`;
  - `completed` se `0,8 ≤ r ≤ 1,2`;
  - `partial` se `0,5 ≤ r < 0,8`;
  - `short` se `r < 0,5`.

  Le soglie sono configurabili ([02](02-endurance-feedback-domain.md#l1--aderenza-al-piano)).
- **Senza durata prescritta**, come una seduta di forza con `duration_min` nullo: l'esito è `completed` se c'è un abbinamento e `r` non si calcola.
- **Sedute chiave** (lavoro in Z4 o superiore): si aggiunge `zone_ratio_high = minuti osservati nel dominio alto / minuti prescritti nel dominio alto`, solo se la metrica osservata è la stessa della prescrizione e i sensori sono presenti. Altrimenti è `null`, con il motivo.

## Passo 4 — Metriche della settimana

Definizioni e denominatori in [02](02-endurance-feedback-domain.md#metriche-con-denominatori-espliciti). In più:
- `intensity_distribution`:
  - si calcola solo sulle attività con la stessa metrica della prescrizione;
  - se le metriche sono miste (potenza in bici, passo in corsa), la distribuzione si dà **per disciplina** e quella complessiva non si calcola (`metric_mixed: true`);
  - `basis_min` è il tempo su cui è calcolata; sotto i 120 minuti non è comunicabile.
- `trend`:
  - confronto con la settimana precedente **comparabile**: la stessa posizione del ciclo precedente oppure la settimana di carico appena prima;
  - con `weeks_meta` assente, la settimana immediatamente precedente, segnalata `comparison_reason: "previous_week_unknown_phase"`;
  - nessun confronto se nel periodo di riferimento ci sono un evento in `target_events` o modifiche del coach con nota.
- `load_status`:
  - CTL/ATL di Intervals.icu all'inizio e alla fine del periodo, **riletti** al momento della valutazione, non presi da `load_metrics_log` (P-12);
  - solo descrittivi.

## Anomalie (codici)

| Codice | Quando | Effetto |
|---|---|---|
| `sync_failed` | lettura di Intervals.icu non riuscita | valutazione `analysis_failed`, nuovo tentativo al prossimo giro |
| `activities_unavailable` | attività con dati non disponibili | sedute del giorno `data_unavailable`; limitazione obbligatoria |
| `duplicate_removed` | doppioni tolti | solo informativo |
| `unmapped_type` | tipo di attività sconosciuto | informativo, da mappare |
| `ambiguous_match` | R3 non risolve | seduta in `unknown` |
| `threshold_mismatch` | soglie PCoach ≠ Intervals.icu | limitazione sul tempo in zona |
| `early_evaluation` | valutazione prima della fine del periodo | `period.complete = false`; nessuna conclusione sui giorni restanti |
| `plan_changed_midweek` | eventi `superseded`/`moved`/`edited` nel periodo | contesto `coach_changes` |
| `period_before_plan_start` | giorni del periodo prima di `training_plans.start_date` | quei giorni sono fuori piano |

## Casi di prova con dati realistici

| Caso | Sedute (approvate) | Attività | Atteso |
|---|---|---|---|
| A | mer corsa 60′ (evento 101) | mer Run 58′, `paired_event_id` 101 | R1 `confirmed`, `completed`, r = 0,97 |
| B | mer corsa 60′ | mer Run 35′, non abbinata su Intervals.icu | R2 `high`, `partial`, r = 0,58 |
| C | mar corsa 50′, mer bici 90′ | mer Run 48′, mer Ride 92′ | bici: R2 `completed`. Corsa: mercoledì non ha sedute di corsa libere e il rapporto è 0,96, quindi R5 vale: corsa di martedì `moved` (`low`) |
| D | gio corsa 45′ | gio Ride 60′ | corsa `substituted` (R6); 60′ di bici come extra nel ciclismo, `substitutes` = seduta di giovedì |
| E | sab bici 120′ | sab Ride 118′ (Garmin) + sab Ride 119′ (Wahoo), inizi a 2′ di distanza | doppione tolto (si tiene quella con potenza); R2 `completed` |
| F | dom lungo 150′ | dom Ride con fonte STRAVA, senza dati | attività `unavailable`; seduta `data_unavailable`; tasso di completamento con `unknown = 1` |
| G | lun nuoto 45′ (slot 0) + lun corsa 30′ (slot 1) | lun Swim 44′ alle 07:00, lun Run 31′ alle 19:00 | due coppie R2 per disciplina; entrambe `completed` |
| H | mar corsa 40′ Z2 (slot 0) + mar corsa 30′ soglia (slot 1) | mar Run 41′ alle 07:00, mar Run 29′ alle 18:30 | R3: ordine dello slot = ordine dell'orario, rapporti 1,03 e 0,97 → `medium`, entrambe `completed` |
| I | come H | mar Run 70′ (un'unica uscita) | R3: due sedute e un'attività: nessuna assegnazione con rapporti compatibili → `ambiguous` per entrambe |
| J | dom corsa 60′ | lun successivo Run 60′ | domenica `not_recorded` nella settimana 1 (copertura completa); la corsa di lunedì è extra nella settimana 2 |
| K | ven forza (nessuna durata) | ven WeightTraining 40′ | R2 `completed`, r non calcolato |
| L | — | mer Walk 50′ | `other`: non abbinata, non extra; solo nel volume osservato «altro» |
