# Modello dati

**Quando leggerlo**: prima di aggiungere/modificare un campo della scheda atleta o delle sedute, o per capire cosa significa un campo esistente di `AthleteTrainingProfile`, di una seduta o dei suoi stati.

## Fonte di verità

Lo schema è **`app/src/schema/athlete_profile.schema.json`** (JSON Schema draft 2020-12). È l'unica fonte di verità: i tipi TypeScript (`types.generated.ts`) sono generati da qui con `npm run gen:types` (vedi [sviluppo-deploy.md](sviluppo-deploy.md)) e non vanno mai modificati a mano. Un file con lo stesso nome esiste anche sotto `docs/`, ma è un duplicato storico non più referenziato: non modificarlo per riflettere cambi di schema.

Procedura per aggiungere un campo: [architettura.md](architettura.md#come-aggiungere-un-campo-al-modello-dati).

## `AthleteTrainingProfile`: sezioni principali

- **`schema_version`**: versione dello schema (attuale: `1.5.0`, senza il piano: le sedute sono in tabelle proprie). Tutte le schede salvate sono a questa versione; serve a riconoscere le schede da aggiornare se lo schema cambierà.
- **`meta`**: metadati della scheda stessa (non dell'atleta) — `athlete_id` (generato alla creazione, non derivato dal nome), `coach_id`, `created_at`/`updated_at`, `data_source` (`manual` / `garmin_export` / `intervals_icu_api` / `mixed`).
- **`identity`**: `nome`, `cognome` (campi separati dallo schema 1.4.0, vedi [decisioni/0006-modello-dati-identita-e-sync-automatica.md](decisioni/0006-modello-dati-identita-e-sync-automatica.md)), `email` (usata per l'invio del feedback settimanale automatico), `birth_year`, `biological_sex` (per formule fisiologiche standard, opzionale), `height_cm`, `weight_kg`.
- **`disciplines`**: una voce per sport praticato (`running`/`cycling`/`swimming`/`strength`; il triathlon non è una disciplina a sé, ma tre righe separate), con livello, anni di pratica, volume settimanale attuale e picco volume ultimi 12 mesi.
- **`physiological_thresholds`**: soglie per sport. `zone_system` è configurazione stabile; `thresholds_log` è uno storico datato (ogni voce con `date`+`source`, vedi `loggedEntryMeta`) — il valore corrente è semplicemente la voce con la data più recente, non un campo separato da tenere sincronizzato.
- **`training_status`**: fotografia dello stato di allenamento corrente.
  - `detraining_period`: `active` (booleano), più durata/causa/severità se true.
  - `load_metrics_log`: storico datato di CTL/ATL/TSB (+ `workouts_count`), stesso pattern "ultima voce = valore attuale" di `thresholds_log`. Scritto sia da sincronizzazione Intervals.icu (`source: intervals_icu_sync`) che manualmente (`source: manual`).
  - `lifestyle_factors` / `lifestyle_factors_note`: fattori di vita ricorrenti (turni variabili, viaggi frequenti, sonno disturbato, ecc.), non eventi isolati.
- **`goals`**: `primary_objective`/`secondary_objective` (+ dettaglio libero se `altro`), `periodization_model` (derivato automaticamente da `primary_objective`, non scelto indipendentemente: `race_peak_taper` se `preparazione_gara`, altrimenti `continuous_improvement`), `target_events` (gare con priorità A/B/C).
- **`constraints`**: `days_available` per giorno della settimana — `active`/`max_duration_minutes` sono il vincolo reale per la programmazione; `fixed_activity` è solo informativo (cosa l'atleta fa oggi), non vincola il piano futuro. Più `sessions_per_week_target`.
- **`methodology_preferences`**: `intensity_distribution_model` (polarizzato 80/20, piramidale, soglia prevalente, misto) e `load_deload_pattern` (formato `N:1`).
- **`notes_free_text`**: testo libero per informazioni non modellate altrove.
- **`weekly_feedback_log`**: storico dei feedback generati confrontando piano e reale, con `generated_by` (`claude`/`manual`). Scritto dalla Edge Function `weekly-feedback` — vedi [backend.md](backend.md).
- **`integrations`**: `intervals_icu_api_key`, salvata **in chiaro** (compromesso di sicurezza accettato — vedi [sicurezza.md](sicurezza.md)), per-atleta.

## Sedute e piani

Le sedute vivono in tabelle Postgres proprie, separate dalla scheda (definizione in `supabase/migrations/0004_workouts.sql`, motivazione in [decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md](decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md)). La scheda resta un blob `jsonb` e il suo salvataggio non tocca mai le sedute.

| Tabella | Contenuto |
|---|---|
| `training_plans` | Un periodo di programmazione: `name`, `status` (`active` / `ended` / `archived`), `start_date`, `end_date`, `weeks_meta` (per settimana: `week_start` del lunedì, `label`, `is_deload`), `end_reason`. Un solo piano `active` per atleta (indice unico parziale). |
| `plan_generations` | Una proposta di sedute: `kind` (`initial` / `regenerate`), `from_date`, `weeks`, `reason`, `kept_workout_ids`, `raw_response` (testo di Claude), `proposal` (JSON letto), `status` (`proposed` / `applied` / `discarded` / `failed`). |
| `workouts` | Una seduta (vedi sotto). |
| `workout_sync` | Stato di sincronizzazione per seduta e provider (oggi solo `intervals_icu`): `remote_event_id`, `external_id` (`pcoach:<id>`), `synced_revision`, `synced_date`, `remote_updated`, `state` (`synced` / `error` / `removed` / `unlinked`), `pending_delete`, `create_uncertain`, `last_error`, `last_warning`. |
| `workout_events` | Cronologia della seduta, scritta solo in aggiunta: `type`, `revision`, istantanee del contenuto `before`/`after`, `note`. Serve sia da audit sia da storico delle versioni. |

**Seduta (`workouts`)**
- **Identità**: `id` uuid stabile. Non cambia con una modifica, uno spostamento di data o il passaggio a un altro piano. `plan_id` indica il piano di appartenenza, `generation_id` la generazione che l'ha creata.
- **Contenuto** (ciò che, se cambia, rende obsoleta la copia su Intervals.icu): `planned_date` (data nel calendario locale dell'atleta; il giorno della settimana si ricava dalla data), `discipline` (`running`/`cycling`/`swimming`/`strength`), `title`, `objective`, `notes_for_athlete`, `duration_min` (solo per la palestra), `structure`, `primary_target`.
- **`slot`**: posizione nel giorno (0, 1, …). Un indice unico parziale su `(athlete_id, planned_date, slot)`, limitato alle sedute attive, impedisce i doppioni. Annullate e sostituite non occupano il giorno.
- **`revision`**: la gestisce solo il database. Un trigger la incrementa a ogni cambio di contenuto, e ogni modifica dell'app è condizionata alla revisione nota.
- **`locked`**: il coach chiede di mantenerla nelle rigenerazioni. **`needs_review`**: motivo per cui la seduta va verificata (struttura non valida, giorno non disponibile, durata oltre il massimo del giorno); ne blocca l'approvazione e l'invio a Intervals.icu finché il coach non la rivede.

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
  - svolta se `completed_at` è valorizzato (da un'attività Intervals.icu abbinata, `completion_source: intervals`, oppure a mano, `manual`);
  - non svolta se la data è passata senza esecuzione;
  - altrimenti in programma.
- **Sincronizzazione** (da `workout_sync`): non inviata, su Intervals.icu, da aggiornare (revisione o data cambiate dopo l'invio), invio non riuscito, da rimuovere, rimossa, scollegata. La logica è in `localSyncState` (`_shared/workouts/sync.ts`).

**Regole di aggiornamento e cancellazione**
- Dall'interfaccia si elimina fisicamente solo una bozza mai approvata e mai inviata. Tutto il resto si annulla e resta nello storico.
- Annullare o sostituire una seduta già su Intervals.icu (e non svolta) imposta `pending_delete`, tramite trigger. La rimozione remota avviene solo con «Sincronizza settimana».
- Eliminare l'atleta elimina a cascata piani, generazioni, sedute e cronologia.

**Date e settimane**: date come `YYYY-MM-DD` nel calendario locale. «Oggi» si calcola nel fuso del dispositivo per l'app e in `weekly_feedback_timezone` lato server. La settimana va da lunedì a domenica. L'aritmetica sulle date (`_shared/workouts/calendar.ts`) lavora a mezzogiorno UTC, così nessun fuso orario può spostare il giorno.

## Note di modellazione

- **Storici datati** (`thresholds_log`, `load_metrics_log`): tutti condividono la stessa forma (`loggedEntryMeta`: `date` + `source` + `note` opzionale). Il campo `source` è un enum volutamente aperto a fonti future (es. `garmin_sync`) senza richiedere un cambio di struttura.
- **`periodization_model`** non è un input libero del coach: è sempre derivato da `primary_objective` dalla UI, per evitare incoerenze tra obiettivo e modello di periodizzazione.
- **`secondary_objective`** esclude deliberatamente `preparazione_gara` e `ripartenza_post_stop`, perché questi due riguardano solo l'obiettivo primario (definiscono l'impianto dell'intero piano, non possono essere "secondari").

## Sezioni volutamente assenti

Non esistono campi per dati sanitari sensibili, storico infortuni dettagliato, o dati biometrici continui (es. HRV giornaliero) — scelta di perimetro, non lacuna. Dettagli e motivazione in [limiti-roadmap.md](limiti-roadmap.md).

## Storico `schema_version`

L'evoluzione delle versioni dello schema (incluso lo split `nome`/`cognome` introdotto in `1.4.0`) è tracciata in [CHANGELOG.md](../CHANGELOG.md) e nelle relative ADR ([decisioni/0006-modello-dati-identita-e-sync-automatica.md](decisioni/0006-modello-dati-identita-e-sync-automatica.md)), non qui: questo file descrive solo lo stato attuale dello schema.
