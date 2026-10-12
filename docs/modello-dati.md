# Modello dati

**Quando leggerlo**: prima di aggiungere/modificare un campo della scheda atleta o delle sedute, o per capire cosa significa un campo esistente di `AthleteTrainingProfile`, di una seduta o dei suoi stati.

## Fonte di verità

Lo schema è **`app/src/schema/athlete_profile.schema.json`** (JSON Schema draft 2020-12). È l'unica fonte di verità: i tipi TypeScript (`types.generated.ts`) sono generati da qui con `npm run gen:types` (vedi [sviluppo-deploy.md](sviluppo-deploy.md)) e non vanno mai modificati a mano. Un file con lo stesso nome esiste anche sotto `docs/`, ma è un duplicato storico non più referenziato: non modificarlo per riflettere cambi di schema.

Procedura per aggiungere un campo: [architettura.md](architettura.md#come-aggiungere-un-campo-al-modello-dati).

## `AthleteTrainingProfile`: sezioni principali

- **`schema_version`**: versione dello schema (attuale: `1.6.0`: senza il piano e senza lo storico dei feedback, che vivono in tabelle proprie). Tutte le schede salvate sono a questa versione; serve a riconoscere le schede da aggiornare se lo schema cambierà.
- **`meta`**: metadati della scheda stessa (non dell'atleta) — `athlete_id` (generato alla creazione, non derivato dal nome), `coach_id`, `created_at`/`updated_at`, `data_source` (`manual` / `garmin_export` / `intervals_icu_api` / `mixed`).
- **`identity`**: `nome`, `cognome` (campi separati dallo schema 1.4.0, vedi [decisioni/0006-modello-dati-identita-e-sync-automatica.md](decisioni/0006-modello-dati-identita-e-sync-automatica.md)), `email` (destinataria del feedback settimanale approvato dal coach), `birth_year`, `biological_sex` (opzionale), `height_cm`, `weight_kg`. A Claude vanno solo il nome di battesimo e l'età (vedi [integrazioni.md](integrazioni.md#claude-generazione-delle-sedute)).
- **`disciplines`**: una voce per sport praticato (`running`/`cycling`/`swimming`/`strength`; il triathlon non è una disciplina a sé, ma tre righe separate), con livello, anni di pratica, volume settimanale attuale e picco volume ultimi 12 mesi.
- **`physiological_thresholds`**: soglie per sport. `zone_system` (corsa e bici: 3, 5 o 7 zone) è il sistema di zone dell'atleta: limita le zone delle sedute nella generazione, nei controlli della proposta e nell'editor, decide i domini d'intensità del feedback, e deve coincidere con quello impostato su Intervals.icu (la scheda lo verifica all'apertura, [integrazioni.md](integrazioni.md#intervalsicu-zone-dellatleta)); il nuoto usa sempre 7 zone (`zoneCountsOf`, `_shared/workouts/zones.ts`); `thresholds_log` è uno storico datato (ogni voce con `date`+`source`, vedi `loggedEntryMeta`) — il valore corrente è semplicemente la voce con la data più recente, non un campo separato da tenere sincronizzato.
- **`training_status`**: fotografia dello stato di allenamento corrente.
  - `detraining_period`: `active` (booleano), più durata/causa/severità se true.
  - `load_metrics_log`: storico datato di CTL/ATL/TSB (+ `workouts_count`), stesso pattern "ultima voce = valore attuale" di `thresholds_log`. Scritto sia da sincronizzazione Intervals.icu (`source: intervals_icu_sync`) che manualmente (`source: manual`).
  - `lifestyle_factors` / `lifestyle_factors_note`: fattori di vita ricorrenti (turni variabili, viaggi frequenti, sonno disturbato, ecc.), non eventi isolati.
- **`goals`**: `primary_objective`/`secondary_objective` (+ dettaglio libero se `altro`), `periodization_model` (derivato automaticamente da `primary_objective`, non scelto indipendentemente: `race_peak_taper` se `preparazione_gara`, altrimenti `continuous_improvement`), `target_events` (gare con priorità A/B/C; per ognuna `taper_weeks`, le settimane di tapering prima della settimana di gara, predefinite per priorità A 2, B 1, C 0, e `taper_volume_decrease_pct`, il calo del volume nel tapering, facoltativo).
- **`constraints`**: `days_available` per giorno della settimana — `active`/`max_duration_minutes` sono il vincolo reale per la programmazione; `fixed_activity` è l'abitudine attuale (cosa l'atleta fa di solito quel giorno): Claude la usa come preferenza per disciplina e tipo di seduta, ma PCoach non la verifica. Più `sessions_per_week_target`.
- **`methodology_preferences`**: `intensity_distribution_model` (polarizzato 80/20, piramidale, soglia prevalente, misto), `load_deload_pattern` (formato `N:M`: settimane di carico 1-8 e di scarico 1-4, scelte con due selettori) e la progressione del carico scelta per l'atleta: `load_increase_min_pct` e `load_increase_max_pct` (aumento fra due settimane di carico, predefiniti 5 e 10) e `deload_decrease_pct` (calo nella settimana di scarico, predefinito 33). Le percentuali entrano nel calendario del prompt del piano e nel confronto fra settimane del feedback (`loadProgressionOf` in `_shared/feedback/params.ts`).
- **`notes_free_text`**: testo libero per informazioni non modellate altrove.
- **`integrations`**: `intervals_icu_api_key`, salvata **in chiaro** (compromesso di sicurezza accettato — vedi [sicurezza.md](sicurezza.md)), per-atleta.

## Sedute e piani

Le sedute vivono in tabelle Postgres proprie, separate dalla scheda (definizione in `supabase/migrations/0004_workouts.sql`, motivazione in [decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md](decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md)). La scheda resta un blob `jsonb` e il suo salvataggio non tocca mai le sedute.

| Tabella | Contenuto |
|---|---|
| `training_plans` | Un periodo di programmazione: `name`, `status` (`active` / `ended` / `archived`), `start_date`, `end_date`, `weeks_meta` (per settimana: `week_start` del lunedì, `label`, `is_deload` e, se lo schema di carico e scarico è noto, `cycle_week` da 1, che fa da ancora del ciclo per la generazione successiva; vedi [integrazioni.md](integrazioni.md#claude-generazione-delle-sedute)), `end_reason`. Un solo piano `active` per atleta (indice unico parziale). |
| `plan_generations` | Una proposta di sedute: `kind` (`initial`: primo piano; `continue`: prosegue dopo il piano attivo senza sostituire nulla; `regenerate`: sostituisce le sedute da una data), `from_date`, `weeks`, `reason`, `kept_workout_ids`, `model` (richiesto), `system_prompt` e `user_prompt` (ciò che è stato inviato a Claude), `prompt_version`, `preferences_default`, `max_tokens`, `raw_response` (testo di Claude), `response_model`, `response_id`, `stop_reason`, `usage` (token), `proposal` (JSON letto), `status` (`proposed` / `applied` / `discarded` / `failed`), `error`. Le generazioni precedenti alla migrazione `0008` non hanno prompt né metadati della risposta. |
| `workouts` | Una seduta (vedi sotto). |
| `workout_sync` | Stato di sincronizzazione per seduta e provider (oggi solo `intervals_icu`): `remote_event_id`, `external_id` (`pcoach:<id>`), `synced_revision`, `synced_date`, `remote_updated`, `state` (`synced` / `error` / `removed` / `unlinked`), `pending_delete`, `create_uncertain`, `last_error`, `last_warning`, `synced_hash` (impronta del contenuto inviato, [decisioni/0032](decisioni/0032-indicazioni-separate-e-verifica-di-ritorno.md); null per gli invii precedenti). |
| `workout_events` | Cronologia della seduta, scritta solo in aggiunta: `type`, `revision`, istantanee del contenuto `before`/`after`, `note`. Serve sia da audit sia da storico delle versioni. |

**Seduta (`workouts`)**
- **Identità**: `id` uuid stabile. Non cambia con una modifica, uno spostamento di data o il passaggio a un altro piano. `plan_id` indica il piano di appartenenza, `generation_id` la generazione che l'ha creata.
- **Contenuto** (ciò che, se cambia, rende obsoleta la copia su Intervals.icu): `planned_date` (data nel calendario locale dell'atleta; il giorno della settimana si ricava dalla data), `discipline` (`running`/`cycling`/`swimming`/`strength`), `title`, `objective`, `notes_for_athlete`, `duration_min` (solo per la palestra), `structure`, `primary_target`.
- **`slot`**: posizione nel giorno (0, 1, …). Un indice unico parziale su `(athlete_id, planned_date, slot)`, limitato alle sedute attive, impedisce i doppioni. Annullate e sostituite non occupano il giorno.
- **`revision`**: la gestisce solo il database. Un trigger la incrementa a ogni cambio di contenuto, e ogni modifica dell'app è condizionata alla revisione nota.
- **`locked`**: il coach chiede di mantenerla nelle rigenerazioni. **`needs_review`**: motivo per cui la seduta va verificata (struttura da completare, giorno non disponibile, durata oltre il massimo del giorno, zone oltre il sistema dell'atleta, sistema di zone cambiato con la seduta da svolgere); ne blocca l'approvazione rapida e l'invio a Intervals.icu. Si ricalcola quando il coach salva la seduta nel pannello; approvarla nonostante un vincolo non rispettato (o, se è già approvata, segnarla verificata con «Segna verificata») richiede conferma.

**Struttura (`structure`, versione 2)**, indipendente da qualunque provider (tipi in `supabase/functions/_shared/workouts/structure.ts`):
- `steps[]` contiene step o ripetute.
- Uno step ha:
  - `role`: `warmup` / `work` / `recovery` / `steady` / `cooldown`;
  - `duration`: `{type: "time", seconds}` oppure `{type: "distance", meters}`;
  - `target`: `{zone, zone_to?}`, con zone da 1 a 7;
  - `cue`: indicazione facoltativa per l'atleta.
- Una ripetuta (`{kind: "repeat", count, label?, steps[]}`) contiene solo step, non altre ripetute.
- La palestra non ha struttura: esercizi e serie stanno in `notes_for_athlete`.
- **`primary_target`** è la metrica di tutte le zone della seduta:
  - bici: `power` se l'ultima soglia di bici ha un FTP, altrimenti `hr`;
  - corsa e nuoto: `pace`;
  - palestra: `none`.

  PCoach la ricava in modo deterministico e il coach può cambiarla seduta per seduta.

**Tre stati separati**
- **Approvazione** (`status`, salvato): `draft` (da revisionare), `approved`, `cancelled`, `superseded`. Lo cambiano solo il coach o una rigenerazione confermata.
  - Una seduta approvata e poi modificata resta approvata.
  - Approvare non invia nulla a Intervals.icu.
- **Esecuzione** (derivata, non salvata come stato):
  - svolta se `completed_at` è valorizzato: da un'attività Intervals.icu abbinata con certezza (`completion_source: intervals`), oppure a mano (`manual`). Per le prime si salvano anche `completion_outcome` (`completed`, `over`, `partial`, `short`: gli ultimi due si mostrano come «Svolta in parte»), `completion_ratio` (svolto/prescritto) e i dati dell'attività `activity_minutes`, `activity_meters`, `activity_load`, `activity_rpe`. Queste colonne non fanno parte del contenuto: non cambiano la revisione. L'abbinamento viene registrato all'apertura della scheda (ultimi 14 giorni), dall'anteprima di «Sincronizza settimana» e dall'analisi del feedback, con la regola in `_shared/feedback/completion.ts`;
  - non registrata se la data è passata senza esecuzione: PCoach sa solo che non c'è un'attività abbinata, non che l'allenamento non sia stato fatto;
  - altrimenti in programma.
- **Sincronizzazione** (da `workout_sync`): non inviata, su Intervals.icu, da aggiornare (revisione o data cambiate dopo l'invio), invio non riuscito, da rimuovere, rimossa, scollegata. La logica è in `localSyncState` (`_shared/workouts/sync.ts`).

**Regole di aggiornamento e cancellazione**
- Dall'interfaccia si elimina fisicamente solo una bozza mai approvata e mai inviata. Tutto il resto si annulla e resta nello storico.
- Annullare o sostituire una seduta già su Intervals.icu (e non svolta) imposta `pending_delete`, tramite trigger. La rimozione remota avviene solo con «Sincronizza settimana».
- Eliminare l'atleta elimina a cascata piani, generazioni, sedute e cronologia.

**Date e settimane**: date come `YYYY-MM-DD` nel calendario locale. «Oggi» si calcola nel fuso del dispositivo per l'app e in `weekly_feedback_timezone` lato server. La settimana va da lunedì a domenica. L'aritmetica sulle date (`_shared/workouts/calendar.ts`) lavora a mezzogiorno UTC, così nessun fuso orario può spostare il giorno.

## Valutazioni settimanali

Tabella `weekly_reviews` (migrazione `0007_weekly_reviews.sql`, motivazioni in [decisioni/0019](decisioni/0019-feedback-analisi-deterministica-approvazione.md)). Una riga è il feedback di una settimana di un atleta.

| Campo | Significato |
|---|---|
| `athlete_id`, `period_start`, `period_end` | Atleta e settimana valutata: da lunedì a domenica (vincolo sul giorno ISO e sulla durata). |
| `kind`, `revision` | Oggi solo `weekly`. Ogni rigenerazione crea la revisione successiva. |
| `status` | Vedi sotto. |
| `skip_reason` | Perché la valutazione è `skipped` (`no_assigned_workouts`). |
| `plan_id`, `analysis_version`, `input`, `metrics` | Piano di riferimento, versione dell'analisi e contratto `feedback_input` usato (con le metriche anche a parte, per le query). |
| `model`, `prompt_template_hash`, `output`, `output_text` | Modello che ha scritto, hash del template di tono, risposta strutturata di Claude, testo per l'atleta (modificabile dal coach fino all'approvazione). |
| `error`, `attempts`, `locked_until` | Ultimo errore, tentativi del passo in corso, blocco durante l'elaborazione. |
| `delivery_status`, `delivery_attempts`, `delivery_error`, `delivered_at` | Consegna dell'email: `not_requested`, `pending`, `sent`, `failed`, `skipped`. |
| `created_at`, `analyzed_at`, `generated_at`, `approved_at`, `updated_at` | Tempi dei passi. |

**Stati**:
- `pending`: da analizzare;
- `analyzed`: analisi salvata, testo da scrivere;
- `draft`: da rivedere;
- `approved`: approvata dal coach; da qui, e solo da qui, parte l'email;
- `skipped`: nessuna seduta approvata;
- `analysis_failed` o `generation_failed`: errore dopo i tentativi;
- `superseded`: sostituita da una revisione successiva.

**Vincoli**: una revisione per numero (`athlete_id`, `period_start`, `kind`, `revision`) e una sola valutazione non sostituita per settimana. Cancellare l'atleta cancella le valutazioni; cancellare un piano lascia la valutazione con `plan_id` vuoto.

## Note di modellazione

- **Storici datati** (`thresholds_log`, `load_metrics_log`): tutti condividono la stessa forma (`loggedEntryMeta`: `date` + `source` + `note` opzionale). Il campo `source` è un enum volutamente aperto a fonti future (es. `garmin_sync`) senza richiedere un cambio di struttura.
- **`periodization_model`** non è un input libero del coach: è sempre derivato da `primary_objective` dalla UI, per evitare incoerenze tra obiettivo e modello di periodizzazione.
- **`secondary_objective`** esclude deliberatamente `preparazione_gara` e `ripartenza_post_stop`, perché questi due riguardano solo l'obiettivo primario (definiscono l'impianto dell'intero piano, non possono essere "secondari").

## Sezioni volutamente assenti

Non esistono campi per dati sanitari sensibili, storico infortuni dettagliato, o dati biometrici continui (es. HRV giornaliero) — scelta di perimetro, non lacuna. Dettagli e motivazione in [limiti-roadmap.md](limiti-roadmap.md).

## Storico `schema_version`

L'evoluzione delle versioni dello schema (incluso lo split `nome`/`cognome` introdotto in `1.4.0`) è tracciata in [CHANGELOG.md](../CHANGELOG.md) e nelle relative ADR ([decisioni/0006-modello-dati-identita-e-sync-automatica.md](decisioni/0006-modello-dati-identita-e-sync-automatica.md)), non qui: questo file descrive solo lo stato attuale dello schema.
