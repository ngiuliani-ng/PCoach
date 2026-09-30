# Specifica tecnica — App Schede Atleta

> Stato: **v1 funzionante** (sezioni 1-4) + **v2 pianificata, non ancora implementata** (sezione 5).
> Questo documento è la fonte di verità su cosa esiste oggi e cosa è stato deciso per gli sviluppi futuri, per evitare di reinterpretare da zero le chat precedenti.

---

## 1. Scopo

Strumento per un coach che segue più atleti (corsa, bici, nuoto, palestra): raccogliere in una scheda strutturata tutto ciò che serve per programmare l'allenamento, e in prospettiva confrontare automaticamente il piano assegnato con quanto l'atleta ha effettivamente fatto (via Intervals.icu).

Non è un prodotto multi-coach pubblico: è uno strumento per un singolo coach (o pochi), pensato per essere semplice da mantenere più che per scalare.

---

## 2. Architettura attuale

Un solo file HTML autosufficiente (nessuna build, nessun framework), pensato per hosting statico esterno (GitHub Pages / Netlify):

- **Storage**: Supabase (Postgres + REST), tabella `athletes` con colonna `data jsonb`.
- **Export**: download nativo del browser (Blob + `<a download>`).
- **Chiamate di rete esterne**: nessuna restrizione imposta dall'ambiente di hosting; restano i limiti CORS del servizio remoto chiamato (rilevante per l'integrazione futura con Intervals.icu, vedi §5.1).
- **File sorgente**: `index.html` + `README.md` (setup Supabase e pubblicazione).

Nessuna autenticazione utente: chi ha l'URL (+ la Supabase anon key, visibile nel sorgente) accede ai dati. Accettabile per uso personale con link non condiviso pubblicamente.

---

## 3. Modello dati attuale — `AthleteTrainingProfile`

Fonte di verità formale: `docs/athlete_profile.schema.json` (JSON Schema draft 2020-12), tenuto allineato a mano con `blankProfile()` nel codice JS (vedi §6 per il problema di manutenzione noto).

Un documento per atleta, salvato con chiave = `meta.athlete_id` (codice univoco di 8 caratteri generato alla creazione, non derivato dal nome).

### 3.1 `meta`
Bookkeeping della scheda: `athlete_id`, `coach_id`, `created_at`, `updated_at`, `data_source`. Non editabile a mano tranne `coach_id`.

### 3.2 `identity`
`name`, `birth_year`, `biological_sex`, `height_cm`, `weight_kg`.

### 3.3 `disciplines[]`
Una riga per sport **praticato con volume proprio**: `sport` (running/cycling/swimming/strength — **niente "triathlon" qui**, si scompone in righe separate; **niente "altro"**), `level`, `years_practice`, `current_weekly_volume`, `peak_weekly_volume_last_12_months`.

### 3.4 `physiological_thresholds`
Per `running`/`cycling`/`swimming`: `zone_system` (3/5/7 zone, solo per running/cycling — informativo, nessuna tabella zone editabile) + `thresholds_log[]`, uno **storico datato** di rilevazioni (non un valore singolo sovrascrivibile). Ogni voce: `date`, `source`, `note` + campi specifici (passo soglia/LTHR/VO2max per running, FTP per cycling, CSS per swimming). Il "valore attuale" mostrato in UI è calcolato come la voce con la data più recente, non un campo a sé.

`source`: oggi enum `["manual"]` — vedi §5.1 per l'estensione a `intervals_icu_sync`.

### 3.5 `training_status`
- `detraining_period`: stato binario tramite menu — "Nessun calo" oppure "È reduce da un calo" (con `duration_weeks`, `cause`, `severity` visibili solo nel secondo caso).
- `load_metrics_log[]`: stesso pattern di storico datato di `thresholds_log`, per `ctl`/`atl`/`tsb`.
- `lifestyle_factors[]` + `lifestyle_factors_note`: fattori **ricorrenti/strutturali** (turni variabili, viaggia spesso, sonno disturbato, ecc.) — sezione propria, distinta dal calo di volumi puntuale.

### 3.6 `goals`
- `primary_objective` (enum) + `primary_objective_detail` (solo se "altro").
- `secondary_objective`: stesso enum del principale **meno** `preparazione_gara` e `ripartenza_post_stop` (sono modalità che definiscono l'impianto del piano, non obiettivi fisiologici componibili) **meno** il valore già scelto come principale (niente duplicati, es. FTP+FTP). Menu ricostruito dinamicamente ad ogni cambio del principale.
- `periodization_model`: **derivato automaticamente**, mai scelto a mano — `race_peak_taper` se principale = "preparazione_gara", altrimenti `continuous_improvement`.
- `target_events[]`: compare solo se principale = "preparazione_gara". Qui `discipline` include "triathlon" (è una categoria di gara, non di volume).

### 3.7 `constraints`
- `days_available[]`: un elemento per i 7 giorni fissi. `active` + `max_duration_minutes` sono il **vincolo reale**; `fixed_activity` è **puramente informativo** (cosa fai oggi quel giorno) e non deve mai essere letto come vincolo per la programmazione futura — distinzione esplicita, causa di una revisione precedente del modello.
- `sessions_per_week_target`.

### 3.8 `methodology_preferences`
`intensity_distribution_model`, `load_deload_pattern` (formato `N:1`). Niente `unit_system` (rimosso).

### 3.9 `notes_free_text`
Campo libero di chiusura per tutto il resto.

### Sezioni volutamente NON presenti (rimosse dopo revisione)
Infortuni/limitazioni, eccezioni temporanee, risultati recenti, forza in palestra (fase/esperienza/attrezzatura), monitoraggio (fonti dati/metriche tracciate), regole di adattamento automatico. Erano state progettate e poi tolte su richiesta esplicita: **non vanno re-introdotte per iniziativa propria** in sviluppi futuri.

---

## 4. UI — struttura del form

Ordine reale delle sezioni: Identità → Discipline → Soglie e zone fisiologiche → Stato di allenamento attuale → Fattori di vita ricorrenti → Obiettivi → Evento/i target (condizionale) → Vincoli e disponibilità → Metodologia → Note libere.

Pattern ricorrenti nel codice:
- **Card dinamiche aggiungi/rimuovi** per liste (discipline, rilevazioni soglie/carico, eventi target), tutte costruite a mano con lo stesso schema di funzioni `render*()` + array di stato in memoria.
- **Stato "modifiche non salvate"**: uno snapshot del profilo viene confrontato ad ogni input/change/click dentro `#editor` contro il baseline dell'ultimo caricamento/salvataggio; il pulsante "Salva" è disabilitato finché non c'è uno scostamento reale (i campi di bookkeeping come `updated_at` sono esclusi dal confronto).
- **Conferme distruttive**: dialogo di conferma disegnato in-page (non `window.confirm`), per uno stile coerente con il resto dell'app.

---

## 5. Sviluppi pianificati (decisi, non ancora scritti)

### 5.1 Refresh da Intervals.icu (solo versione standalone)
Pulsante "Aggiorna da Intervals.icu" nella scheda atleta: chiamata **manuale** (non automatica/periodica) che recupera i dati **fino al momento del click**.

- Endpoint wellness (`/api/v1/athlete/{id}/wellness`) per CTL/ATL; TSB **calcolato** come CTL−ATL, non sincronizzato come campo a sé.
- Endpoint activities per il conteggio allenamenti per data.
- Autenticazione: API key **per atleta** (non del coach), salvata in chiaro nel documento su Supabase — compromesso di sicurezza accettato esplicitamente per questo contesto d'uso.
- **Prima cosa da verificare tecnicamente, prima di costruire il resto**: se l'API di Intervals.icu risponde con header CORS permissivi a una chiamata diretta da browser. Se no, serve un piccolo proxy (es. Supabase Edge Function) prima di poter procedere.
- Aggiunge il campo `workouts_count` a `load_metrics_log` (vedi §5.2) e il campo `intervals_icu_api_key` all'atleta (sezione da definire in UI, probabilmente dentro "Stato di allenamento attuale" o una nuova sotto-sezione dedicata all'integrazione).
- Estende l'enum `source` di `loggedEntryMeta` da `["manual"]` a `["manual", "intervals_icu_sync"]`.

### 5.2 Log giornaliero
`load_metrics_log[]` diventa popolabile automaticamente (una voce per giorno, non sporadica come oggi) con l'aggiunta del campo:
```
"workouts_count": <integer>
```
accanto a `date`, `source`, `ctl`, `atl`, `tsb`. Al termine della settimana: N allenamenti totali + andamento giorno per giorno dei 3 parametri, leggibili direttamente dal log.

### 5.3 Piano assegnato — `training_plan`
Nuovo campo di primo livello nel profilo atleta. Modellato a **sessioni datate**, non a "giorno della settimana ricorrente", per permettere il confronto diretto data-per-data con gli allenamenti reali:

```json
"training_plan": {
  "plan_name": "string",
  "start_date": "date",
  "weeks": [
    {
      "week_number": 1,
      "week_label": "string",
      "is_deload": false,
      "sessions": [
        {
          "date": "date",
          "day": "lunedi",
          "session_type": "string",
          "discipline": "running|cycling|swimming|strength",
          "is_structured": false,
          "target_zone": "string",
          "target_duration_min": null,
          "target_distance_km": null,
          "notes": "string",
          "steps": []
        }
      ]
    }
  ]
}
```

Se `is_structured` è `false`: si usano `target_zone`/`target_duration_min`/`target_distance_km` (sessione a blocco unico — easy, lunga, palestra generica).
Se `is_structured` è `true`: si usa `steps[]`, ignorando i campi target_* piatti. Ogni step:

```json
{ "kind": "warmup" | "cooldown" | "block", "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" }
```
oppure, per le ripetute uniformi:
```json
{
  "kind": "repeat",
  "repetitions": <integer>,
  "work": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" },
  "recovery": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" }
}
```

**Limite noto e accettato**: sessioni "a piramide" (ripetute non uniformi tra loro, es. 1'-2'-3'-2'-1') non hanno un `kind` dedicato — si modellano come sequenza di più `block` singoli. Non generalizzato oltre per non appesantire il caso comune (intervalli uniformi).

**UI prevista**: non un form a 90+ campi. Un campo dove si incolla il testo del piano (quello già scritto in chat) + un parser che lo traduce in questa struttura, con possibilità di correggere a mano le singole righe generate.

### 5.4 Report settimanale
Pulsante "Genera report settimanale": assembla in un unico testo — profilo atleta, log della settimana (data, allenamenti fatti, CTL/ATL/TSB), sessioni pianificate della stessa settimana da `training_plan` — pronto da copiare e incollare in una chat con Claude per la revisione manuale.
**Non** è una chiamata automatica all'API di Claude dentro l'app: una pagina pubblicata/standalone non può farlo in produzione in modo affidabile. Resta un passaggio manuale del coach.

---

## 6. Problema di manutenzione noto (non ancora risolto)

Un campo semplice oggi richiede modifiche in **7 punti** tenuti allineati a mano: `blankProfile()`, HTML, `fillForm()`, `readForm()`, wiring eventi, `schema.json`, `example.json`. Nessun meccanismo impedisce che si disallineino.

Discusso ma **non deciso di procedere**: un registro dichiarativo unico in JS per sezione (tipo `IDENTITY_FIELDS = [{key, label, type, options}, ...]`) da cui derivare meccanicamente sia il rendering del form sia lo `schema.json` generato — scartate le librerie schema-driven generiche (JSONForms/RJSF) perché gran parte della logica dell'app (log storici, esclusioni reciproche, viste derivate) non si presta a generazione automatica e richiederebbe comunque renderer custom, vanificando il beneficio.

Nota strategica: quando il backend di **Adaptive AI Coach** (Python/FastAPI + Pydantic) sarà pronto, quello diventerà la fonte di verità naturale dello schema (un modello Pydantic genera il proprio JSON Schema). Qualsiasi soluzione scelta qui deve restare economica da buttare via a quel punto, non un'infrastruttura pesante da smontare.

---

## 7. File del progetto

| File | Contenuto |
|---|---|
| `index.html` | App (storage: Supabase) |
| `README.md` | Setup Supabase + pubblicazione GitHub Pages/Netlify |
| `docs/specifica-tecnica.md` | Questo documento |
| `docs/athlete_profile.schema.json` | JSON Schema del modello dati, mantenuto a mano in parallelo al codice |

---

## 8. Ordine di implementazione concordato per gli sviluppi §5

1. Pulsante "Aggiorna da Intervals.icu" (§5.1-5.2) — **prima verifica tecnica: test CORS reale** prima di costruire l'interfaccia sopra.
2. Modello `training_plan` a sessioni datate con steps (§5.3) + parser da testo incollato.
3. Generazione report settimanale (§5.4).
