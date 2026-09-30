# Specifica tecnica — App Schede Atleta

> Stato: **v1 funzionante** (sezioni 1-4) + **§5.1-§5.5 implementate** (refresh Intervals.icu, log giornaliero, generazione piano e feedback settimanale via Claude, Impostazioni globali). Deploy manuale richiesto per due passaggi infrastrutturali: tabella `app_settings` e pubblicazione della Edge Function — vedi `docs/impostazioni-claude.md`.
> Questo documento è la fonte di verità su cosa esiste oggi e cosa è stato deciso per gli sviluppi futuri, per evitare di reinterpretare da zero le chat precedenti.

---

## 1. Scopo

Strumento per un coach che segue più atleti (corsa, bici, nuoto, palestra): raccogliere in una scheda strutturata tutto ciò che serve per programmare l'allenamento, generare il piano con l'assistenza di Claude e confrontare automaticamente quanto assegnato con quanto l'atleta ha effettivamente fatto (via Intervals.icu). Questo progetto **è** l'implementazione concreta di quello che nelle prime bozze veniva chiamato "Adaptive AI Coach" — non un sistema separato ancora da costruire (vedi §5.3-§5.5 e §6).

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

`source`: oggi enum `["manual", "intervals_icu_sync"]` — vedi §5.1.

### 3.5 `training_status`

- `detraining_period`: stato binario tramite menu — "Nessun calo" oppure "È reduce da un calo" (con `duration_weeks`, `cause`, `severity` visibili solo nel secondo caso).
- `load_metrics_log[]`: stesso pattern di storico datato di `thresholds_log`, per `ctl`/`atl`/`tsb`/`workouts_count`. **Nessun editing manuale in UI**: popolato esclusivamente dal pulsante "Aggiorna da Intervals.icu" e visualizzato come grafico (non più come card per rilevazione), vedi §4 e §5.1.
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

### 3.10 `training_plan` e `weekly_feedback_log`

Vedi §5.3 e §5.4 per il modello dati completo — generati con l'assistenza di Claude, non compilati a mano.

### 3.11 `integrations`

`intervals_icu_api_key` (per-atleta). La Claude API key **non** è qui: è per-coach, vive in `app_settings` (§5.5), fuori da questo schema.

### Sezioni volutamente NON presenti (rimosse dopo revisione)

Infortuni/limitazioni, eccezioni temporanee, risultati recenti, forza in palestra (fase/esperienza/attrezzatura), monitoraggio (fonti dati/metriche tracciate), regole di adattamento automatico. Erano state progettate e poi tolte su richiesta esplicita: **non vanno re-introdotte per iniziativa propria** in sviluppi futuri.

---

## 4. UI — struttura del form

Ordine reale delle sezioni: Identità → Discipline → Soglie e zone fisiologiche → Stato di allenamento attuale → Fattori di vita ricorrenti → Obiettivi → Evento/i target (condizionale) → Vincoli e disponibilità → Metodologia → Note libere.

Pattern ricorrenti nel codice:

- **Card dinamiche aggiungi/rimuovi** per liste (discipline, rilevazioni soglie, eventi target), tutte costruite a mano con lo stesso schema di funzioni `render*()` + array di stato in memoria.
- **Grafico di sola lettura** per `load_metrics_log` (CTL/ATL/TSB come linee, allenamenti/giorno come barre sullo sfondo): niente card, niente aggiunta manuale — l'unica fonte è la sincronizzazione da Intervals.icu (§5.1). Le vecchie rilevazioni manuali eventualmente già presenti restano visibili nel grafico e protette dal sync (non vengono sovrascritte).
- **Stato "modifiche non salvate"**: uno snapshot del profilo viene confrontato ad ogni input/change/click dentro `#editor` contro il baseline dell'ultimo caricamento/salvataggio; il pulsante "Salva" è disabilitato finché non c'è uno scostamento reale (i campi di bookkeeping come `updated_at` sono esclusi dal confronto).
- **Conferme distruttive**: dialogo di conferma disegnato in-page (non `window.confirm`), per uno stile coerente con il resto dell'app.

---

## 5. Sviluppi pianificati

### 5.1 Refresh da Intervals.icu (solo versione standalone) — IMPLEMENTATO

Pulsante "Aggiorna da Intervals.icu" nella scheda atleta: chiamata **manuale** (non automatica/periodica) che recupera i dati dall'ultima rilevazione registrata (o dagli ultimi 30 giorni se il log è vuoto) **fino al momento del click**.

- Endpoint `GET /api/v1/athlete/0/wellness?oldest=...&newest=...` per CTL/ATL (campo `id` = data, `ctl`, `atl`); TSB **calcolato** come CTL−ATL, non richiesto all'API. L'id atleta `0` indica "l'atleta della API key usata", per non dover configurare anche un id numerico.
- Endpoint `GET /api/v1/athlete/0/activities?oldest=...&newest=...` per il conteggio allenamenti per data (raggruppati su `start_date_local`).
- Autenticazione: HTTP Basic (username letterale `API_KEY`, password = la chiave), API key **per atleta** (non del coach), salvata in chiaro nel documento su Supabase — compromesso di sicurezza accettato esplicitamente per questo contesto d'uso. Campo `integrations.intervals_icu_api_key`, UI in una sotto-sezione dedicata dentro "Stato di allenamento attuale".
- **Verifica CORS effettuata (2026-09-30)**: l'API di Intervals.icu risponde con `Access-Control-Allow-Origin` che riflette l'origin della richiesta (incluso `null`, il caso di un file aperto con doppio click) sia sulla richiesta reale sia sul preflight `OPTIONS` con `Authorization` tra gli header consentiti. **Nessun proxy necessario**: la chiamata parte direttamente dal browser.
- Le rilevazioni sincronizzate hanno `source: "intervals_icu_sync"` e non sovrascrivono mai una rilevazione manuale già presente per la stessa data.
- Rate limit noto lato Intervals.icu (API key): 5000 richieste/giorno, 2500/15 minuti — non rilevante per un uso manuale saltuario.
- **Test end-to-end confermato dal coach con una API key reale (2026-09-30)**: funziona.
- **Editing manuale del log rimosso** (2026-09-30): il pulsante "+ Aggiungi rilevazione" e le card per riga non esistono più — l'unica fonte di `load_metrics_log` è questo pulsante di sync. Visualizzazione sostituita da un grafico, vedi §4.

### 5.2 Log giornaliero — IMPLEMENTATO

`load_metrics_log[]` include ora il campo:

```text
"workouts_count": <integer>
```

accanto a `date`, `source`, `ctl`, `atl`, `tsb`. Al termine della settimana: N allenamenti totali + andamento giorno per giorno dei 3 parametri, leggibili direttamente dal log.

### 5.3 Piano assegnato — `training_plan` — IMPLEMENTATO

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

```text
{ "kind": "warmup" | "cooldown" | "block", "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" }
```

oppure, per le ripetute uniformi:

```text
{
  "kind": "repeat",
  "repetitions": <integer>,
  "work": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" },
  "recovery": { "duration_sec": null, "distance_m": null, "zone": "string", "description": "string" }
}
```

**Limite noto e accettato**: sessioni "a piramide" (ripetute non uniformi tra loro, es. 1'-2'-3'-2'-1') non hanno un `kind` dedicato — si modellano come sequenza di più `block` singoli. Non generalizzato oltre per non appesantire il caso comune (intervalli uniformi).

**UI prevista — generazione via Claude (workflow deciso 2026-09-30)**: non un form a 90+ campi, e non un semplice incolla-testo scritto a mano in chat. Flusso concordato:

1. Il coach clicca "Genera piano con Claude" nella scheda atleta e indica quante settimane generare (campo numerico).
2. L'app assembla un prompt a partire da un **template salvato e modificabile in Impostazioni** (§5.5), sostituendo placeholder con i dati reali già in scheda: identità, discipline, soglie correnti (§3.4), stato di allenamento e ultimi 30gg di CTL/ATL/TSB da Intervals.icu (§5.1-5.2), obiettivi, vincoli/disponibilità, metodologia. Il template include per intero la struttura JSON di `training_plan` descritta sopra, così Claude sa esattamente cosa restituire.
3. Il prompt viene inviato a Claude **tramite il proxy di §5.5**, mai con una chiamata diretta dal browser (motivazione lì).
4. La risposta viene ripulita (rimozione di eventuali fence markdown), passata per `JSON.parse` e validata strutturalmente (presenza di `weeks[]`/`sessions[]` coerenti) prima di un'anteprima leggibile.
5. Il coach può correggere a mano righe/valori nell'anteprima, o rigenerare da capo; solo alla conferma esplicita i dati vengono scritti in `training_plan`, dentro il normale salvataggio della scheda (nessun salvataggio automatico silenzioso).

### 5.4 Feedback settimanale automatico — IMPLEMENTATO (decisione 2026-09-30 — **supera la decisione precedente** di restare manuale)

Pulsante "Aggiorna e confronta settimana": oltre a rieseguire il refresh di §5.1 (CTL/ATL/allenamenti), recupera per la settimana appena conclusa i **dati reali per sessione** (non solo presenza/conteggio) dagli endpoint Intervals.icu — durata (`moving_time`), tipo attività (`type`), nome (`name`), carico (`icu_training_load`) e altri campi da confermare in fase di implementazione — e li confronta data per data con le sessioni pianificate nello stesso intervallo di `training_plan` (§5.3).

- Il confronto (piano vs reale) viene assemblato in un secondo prompt salvato (§5.5) e inviato a Claude tramite lo stesso proxy di §5.3, chiedendo un feedback testuale (aderenza al piano, scostamenti di carico, suggerimenti).
- Il feedback ricevuto viene mostrato in UI e **salvato** in un nuovo storico datato per atleta, `weekly_feedback_log[]` (stesso pattern di `loggedEntryMeta`: `date` = fine settimana, `source`, `note` = testo del feedback), per poterlo rivedere nel tempo.
- Se `claude_api_key` non è configurata in Impostazioni (§5.5), il pulsante assembla comunque il confronto come testo pronto da copiare (comportamento manuale preesistente), senza generare feedback automatico.
- **Perché ora si può fare in automatico**: la limitazione originale ("una pagina pubblicata/standalone non può farlo in produzione in modo affidabile") valeva per il contesto della vecchia versione Claude Artifact; con l'app autonoma su hosting proprio + Supabase, un proxy leggero (§5.5) risolve il vincolo tecnico reale (CORS dell'API Claude), non un vincolo ipotetico.

### 5.5 Impostazioni globali e integrazione Claude — IMPLEMENTATO (lato codice; richiede setup manuale, vedi `docs/impostazioni-claude.md`)

Nuova area "Impostazioni" nell'interfaccia, separata dalla scheda dei singoli atleti: configurazione **per-coach**, non per-atleta, quindi **non fa parte** di `athlete_profile.schema.json` né del documento `athletes`.

**Perché serve un proxy e non solo una chiamata diretta o il copia-incolla**: verificato (2026-09-30, documentazione ufficiale Anthropic) che, a differenza di Intervals.icu, l'API di Claude (`api.anthropic.com`) **blocca le richieste dirette da browser per default** (CORS), proprio per evitare di esporre la API key; l'SDK ufficiale richiede l'opzione esplicita `dangerouslyAllowBrowser` (nome scelto deliberatamente da Anthropic) per abilitarle, e la documentazione stessa la sconsiglia salvo che per "tool interni con utenti fidati" — condizione che corrisponde al profilo d'uso di questa app (§1), ma resta un rischio più alto della key di Intervals.icu (qui la key è legata alla fatturazione Anthropic del coach, non solo ai dati di un singolo atleta).

**Verifica empirica effettuata (2026-09-30, stesso rigore usato per Intervals.icu)**: test diretto con `curl` su `api.anthropic.com/v1/messages`. Una richiesta reale senza l'header speciale non riceve alcun `Access-Control-Allow-Origin` (il browser la bloccherebbe); il preflight `OPTIONS` "normale" risponde `400 Bad Request` senza `Access-Control-Allow-Origin` (preflight fallito, chiamata mai eseguita da un browser reale). Includendo l'header `anthropic-dangerous-direct-browser-access` tra quelli richiesti, il preflight risponde `200 OK` con `Access-Control-Allow-Origin: *` — **wildcard, non limitato all'origine del richiedente**: se la key trapelasse, letteralmente qualsiasi sito web potrebbe riusarla contro l'API. Questo conferma e rafforza la scelta del proxy: l'alternativa "diretta dal browser" non è solo sconsigliata da Anthropic, è strutturalmente più esposta di quanto lo sia stata l'integrazione Intervals.icu.

**Decisione (2026-09-30, presa in autonomia in assenza del coach — rivedibile)**: usare un **proxy leggero**, una Supabase Edge Function dedicata (`supabase/functions/claude-proxy`, da creare) invece della chiamata diretta dal browser. Il client chiama la Edge Function (stesso dominio Supabase già in uso, nessun problema di CORS aggiuntivo), che a sua volta chiama `api.anthropic.com` server-side (nessun header "dangerous", nessun problema di CORS lato server) e restituisce la risposta al client.

**Dove vive la configurazione**: nuova tabella Supabase `app_settings` (riga singola, stessa filosofia di `athletes`: nessuna autenticazione oltre alla anon key — scelta invece di `localStorage` perché sincronizza tra dispositivi/browser diversi da cui il coach può aprire l'app), con almeno:

- `claude_api_key`: API key personale del coach, salvata in chiaro — stesso compromesso già accettato per `intervals_icu_api_key`, qui con impatto potenzialmente più costoso (fatturazione Claude) se il link/anon key trapelano: da tenere a mente esplicitamente.
- `plan_generation_prompt_template`: testo del prompt per §5.3, modificabile dal coach, con placeholder da sostituire (sintassi da definire in fase di implementazione, es. `{{nome_atleta}}`, `{{settimane}}`, `{{contesto_atleta_json}}`).
- `weekly_feedback_prompt_template`: testo del prompt per §5.4, stessa logica.

**Sicurezza**: la Edge Function legge `claude_api_key` da `app_settings` e non deve mai restituirla al client nella risposta. Alternativa più robusta ma meno comoda da modificare da UI: tenere la key come secret della Edge Function stessa (dashboard/CLI Supabase) invece che nella tabella — non scelta ora per non perdere l'editing da Impostazioni, ma da riconsiderare se il rischio percepito cresce. Non generalizzato oltre: se in futuro l'app dovesse diventare multi-coach o pubblica, questa parte andrebbe rivista da zero (RLS, auth reale) — fuori scope per lo strumento a singolo coach descritto in §1.

---

## 6. Problema di manutenzione noto (non ancora risolto)

Un campo semplice oggi richiede modifiche in **7 punti** tenuti allineati a mano: `blankProfile()`, HTML, `fillForm()`, `readForm()`, wiring eventi, `schema.json`, `example.json`. Nessun meccanismo impedisce che si disallineino.

Discusso ma **non deciso di procedere**: un registro dichiarativo unico in JS per sezione (tipo `IDENTITY_FIELDS = [{key, label, type, options}, ...]`) da cui derivare meccanicamente sia il rendering del form sia lo `schema.json` generato — scartate le librerie schema-driven generiche (JSONForms/RJSF) perché gran parte della logica dell'app (log storici, esclusioni reciproche, viste derivate) non si presta a generazione automatica e richiederebbe comunque renderer custom, vanificando il beneficio.

Nota aggiornata (2026-09-30): l'idea originaria era che un futuro backend Python/FastAPI + Pydantic, chiamato "Adaptive AI Coach", avrebbe preso in carico la programmazione automatica e sarebbe diventato la fonte di verità naturale dello schema. Non è più così: la programmazione automatica è stata realizzata **dentro questo stesso progetto** (generazione piano e feedback via Claude, §5.3-§5.5) — non esiste, né è pianificato, un backend Python separato con quel nome. Resta comunque valido il principio: qualsiasi soluzione scelta qui per il problema dei 7 punti deve restare economica da buttare via, non un'infrastruttura pesante da smontare, nel caso in futuro si decida di riscrivere questa logica in un servizio dedicato.

---

## 7. File del progetto

| File | Contenuto |
| --- | --- |
| `index.html` | App (storage: Supabase) |
| `README.md` | Setup Supabase + pubblicazione GitHub Pages/Netlify |
| `docs/specifica-tecnica.md` | Questo documento |
| `docs/athlete_profile.schema.json` | JSON Schema del modello dati, mantenuto a mano in parallelo al codice |
| `docs/impostazioni-claude.md` | Setup della funzionalità avanzata: tabella `app_settings`, deploy Edge Function, API key Claude |
| `supabase/functions/claude-proxy/index.ts` | Edge Function proxy verso l'API Claude (§5.5) |

---

## 8. Ordine di implementazione concordato per gli sviluppi §5

1. ~~Pulsante "Aggiorna da Intervals.icu" (§5.1-5.2)~~ — **fatto**: test CORS reale eseguito (nessun proxy necessario), funzionalità implementata.
2. ~~Impostazioni globali: tabella `app_settings` + area UI "Impostazioni" (§5.5)~~ — **fatto** lato codice (UI + load/save); la creazione della tabella su Supabase è un passaggio manuale del coach (SQL in `docs/impostazioni-claude.md`).
3. ~~Proxy Claude: Supabase Edge Function `claude-proxy` (§5.5)~~ — **fatto** lato codice; la pubblicazione (`supabase functions deploy`) è un passaggio manuale del coach.
4. ~~Modello `training_plan` + generazione via Claude attraverso il proxy + validazione/anteprima del JSON ricevuto (§5.3)~~ — **fatto**.
5. ~~Arricchimento del fetch Intervals.icu con i campi reali per sessione, necessario per il confronto di §5.4~~ — **fatto** (chiamata dedicata dentro il confronto settimanale, non nel refresh leggero di §5.1).
6. ~~Feedback settimanale automatico (§5.4)~~ — **fatto**.
