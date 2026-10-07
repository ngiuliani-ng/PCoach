# Modello dati

**Quando leggerlo**: prima di aggiungere/modificare un campo della scheda atleta, o per capire cosa significa un campo esistente di `AthleteTrainingProfile`.

## Fonte di verità

Lo schema è **`app/src/schema/athlete_profile.schema.json`** (JSON Schema draft 2020-12). È l'unica fonte di verità: i tipi TypeScript (`types.generated.ts`) sono generati da qui con `npm run gen:types` (vedi [sviluppo-deploy.md](sviluppo-deploy.md)) e non vanno mai modificati a mano. Un file con lo stesso nome esiste anche sotto `docs/`, ma è un duplicato storico non più referenziato: non modificarlo per riflettere cambi di schema.

Procedura per aggiungere un campo: [architettura.md](architettura.md#come-aggiungere-un-campo-al-modello-dati).

## `AthleteTrainingProfile`: sezioni principali

- **`schema_version`**: versione dello schema (attuale: `1.4.0`), usata per capire se una scheda salvata richiede una migrazione all'apertura.
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
- **`training_plan`**: piano assegnato (`null` se non ancora generato), con `weeks[]` → `sessions[]` (`trainingSession`), ciascuna eventualmente strutturata in `steps[]` (`trainingStep`: warmup/cooldown/block/repeat). Generato con l'assistenza di Claude — vedi [integrazioni.md](integrazioni.md).
- **`weekly_feedback_log`**: storico dei feedback generati confrontando piano e reale, con `generated_by` (`claude`/`manual`). Scritto dalla Edge Function `weekly-feedback` — vedi [backend.md](backend.md).
- **`integrations`**: `intervals_icu_api_key`, salvata **in chiaro** (compromesso di sicurezza accettato — vedi [sicurezza.md](sicurezza.md)), per-atleta.

## Note di modellazione

- **Storici datati** (`thresholds_log`, `load_metrics_log`): tutti condividono la stessa forma (`loggedEntryMeta`: `date` + `source` + `note` opzionale). Il campo `source` è un enum volutamente aperto a fonti future (es. `garmin_sync`) senza richiedere un cambio di struttura.
- **`periodization_model`** non è un input libero del coach: è sempre derivato da `primary_objective` dalla UI, per evitare incoerenze tra obiettivo e modello di periodizzazione.
- **`secondary_objective`** esclude deliberatamente `preparazione_gara` e `ripartenza_post_stop`, perché questi due riguardano solo l'obiettivo primario (definiscono l'impianto dell'intero piano, non possono essere "secondari").

## Sezioni volutamente assenti

Non esistono campi per dati sanitari sensibili, storico infortuni dettagliato, o dati biometrici continui (es. HRV giornaliero) — scelta di perimetro, non lacuna. Dettagli e motivazione in [limiti-roadmap.md](limiti-roadmap.md).

## Storico `schema_version`

L'evoluzione delle versioni dello schema (incluso lo split `nome`/`cognome` introdotto in `1.4.0`) è tracciata in [CHANGELOG.md](../CHANGELOG.md) e nelle relative ADR ([decisioni/0006-modello-dati-identita-e-sync-automatica.md](decisioni/0006-modello-dati-identita-e-sync-automatica.md)), non qui: questo file descrive solo lo stato attuale dello schema.
