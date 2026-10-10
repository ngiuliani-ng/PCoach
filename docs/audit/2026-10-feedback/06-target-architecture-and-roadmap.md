# 06 — Architettura raccomandata e piano di migrazione

**Quando leggerlo**: per scegliere come rifare il feedback, in che ordine e con quali punti di verifica e di ritorno indietro.

**Stato**: proposta dell'audit del 2026-10-10, da approvare. Diventerà un ADR (0019) quando sarà scelta.

## Alternative

| | A. Correzioni mirate | B. Modulo di analisi deterministico + tabella delle valutazioni | C. B + fasi separate (analisi, generazione, consegna) con stati espliciti | D. Servizio di analisi separato, fuori da Supabase |
|---|---|---|---|---|
| Cosa | finestra lun-dom, solo `approved`, `stop_reason`, email disattivata o solo al coach; resta tutto nel blob | `_shared/feedback/` puro (normalizzazione, abbinamento, metriche, contratto); `weekly_reviews` con istantanea; Claude riceve il contratto | come B, più una macchina a stati sulla riga (`pending` → `analyzed` → `draft` → `approved` → consegna) e un atleta per invocazione | microservizio, ad esempio in Python, con pipeline di dati, coda e database analitico |
| Correttezza | migliora P-01, P-02, P-05, P-07; restano l'abbinamento fatto dal modello, la riproducibilità e il «dato assente = non svolto» | risolve P-03, P-04, P-08, P-13, P-14, P-17 | in più risolve P-09, P-11, P-15 | come C |
| Complessità | bassa | media: un modulo, una tabella, una migrazione | media: qualche transizione in più sulla stessa tabella | alta: nuovo runtime, deploy, segreti, monitoraggio |
| Costo operativo | nullo | nullo: stessa piattaforma | nullo | nuovo hosting |
| Compatibilità con i dati | totale | totale: `weekly_feedback_log` è vuoto in produzione | totale | totale |
| Testabilità | bassa: la funzione resta monolitica | alta: modulo puro con Vitest | alta | alta, ma su due stack |
| Verificabilità | nulla | completa | completa, più l'esito di ogni passo | completa |
| Rischio di regressioni | basso | medio, mitigato dal periodo in parallelo | medio | alto |
| Costo di migrazione | ore | alcuni giorni | B + circa un giorno | settimane |

**Raccomandazione: C, introdotta in modo incrementale**:
1. A come correzione immediata (fase 0);
2. B (fasi 1-2);
3. gli stati e la consegna di C (fase 3).

**Perché**:
- D non è giustificata: il volume è di pochi atleti a settimana e tutto il necessario (cron, Edge Function, Postgres, moduli condivisi) c'è già. Una riscrittura completa non è necessaria.
- A da sola lascia il difetto centrale, cioè l'abbinamento e i conteggi delegati al modello.
- C costa poco più di B e risolve idempotenza, email perse e durata della funzione, che con B restano aperti.

## Architettura obiettivo

```
pg_cron (ogni ora) → weekly-feedback (service-role)
  1. PIANIFICA: nel giorno e ora configurati, per ogni atleta con piano attivo:
       insert into weekly_reviews (athlete_id, period_start, …, status 'pending') on conflict do nothing
  2. LAVORA (al massimo N righe per invocazione, una per volta, entro un tempo limite di 100 s):
       pending            → legge le sedute (approved, con revisione) + workout_events del periodo
                            + Intervals.icu (attività del periodo ±1 g, benessere, abbinamenti)
                            → _shared/feedback: normalize → match → metrics → contract
                            → salva input/metrics, status 'analyzed' | 'skipped' | 'analysis_failed'
       analyzed           → Claude con il contratto + schema di output → validazione
                            → status 'draft' | 'generation_failed'
       approved & delivery pending|failed → Resend → delivery_status 'sent' | 'failed'
  3. nessuna email da 'draft': l'approvazione viene dal coach in UI
     (o è automatica se app_settings.feedback_auto_approve e data_quality = complete
      e nessuna anomalia bloccante)

UI (tab Panoramica, poi tab dedicata):
  elenco delle valutazioni per settimana → dettaglio: esiti delle sedute (dal contratto), metriche,
  limitazioni, testo modificabile → «Approva e invia» / «Rigenera»
```

**Scelte motivate**:
- **Niente nuova coda o servizio**: la tabella stessa è la coda, tramite lo stato. Un atleta per passo tiene ogni invocazione lontana dal limite di 150 s (P-15).
- **Nessuna tabella di uscita separata**: la consegna sta sulla riga (vedi [03](03-data-contract-and-model.md#weekly_reviews)).
- **Nessuna tabella delle attività**: l'istantanea nel contratto basta a riprodurre la valutazione. La lettura da Intervals.icu resta la fonte autorevole.
- **Sincronizzazione del carico** (P-12): nella fase 2, la rilettura degli ultimi 14 giorni sostituisce la logica «dal giorno dopo l'ultima voce», nell'app e nella funzione. Si usa un solo modulo in `_shared/`, e la duplicazione di P-19 scompare.

## Ordine di intervento

| Fase | Contenuto | Impatto | Rischio | Verifica |
|---|---|---|---|---|
| **0. Messa in sicurezza** (prima del 18-10) | 1) email all'atleta **disattivata** (impostazione), oppure inviata solo al coach; 2) `weekly-feedback`: periodo lun-dom dell'ultima settimana conclusa, solo `approved`, controllo di `stop_reason` e del testo vuoto, timeout sulle `fetch`; 3) nessun feedback se i giorni del periodo precedono `training_plans.start_date` per oltre metà | elimina gli errori più visibili per l'atleta | basso | caso 1 e regressioni P-01 e P-02 in `deno test`; esecuzione manuale su un branch con dati finti |
| **1. Tabella e istantanea** | migrazione `0007_weekly_reviews.sql`; la funzione scrive in `weekly_reviews` (input grezzo ridotto, output, modello, hash del template) invece che nel blob; UI in sola lettura dalla tabella | riproducibilità, nessun conflitto con il salvataggio della scheda | basso: `weekly_feedback_log` è vuoto | test SQL dell'indice; una valutazione completa su un branch |
| **2. Analisi deterministica** | `_shared/feedback/` (normalizzazione, abbinamento, metriche, contratto v1) con i test 1-15; il prompt riceve il contratto; sincronizzazione del carico sugli ultimi 14 giorni | correttezza del confronto | medio | due settimane in parallelo: il coach confronta gli esiti con Intervals.icu (criterio 5 di [05](05-test-strategy.md#criteri-di-accettazione)) |
| **3. Stati, output strutturato, consegna** | macchina a stati, schema di output e validazione, approvazione in UI, consegna con nuovi tentativi; email riattivata | il coach controlla ciò che arriva all'atleta | medio | test 16-20; Playwright sul pannello |
| **4. Correzioni del coach** | tabella `workout_matches` (abbinamento confermato o corretto dal coach, R0), con `unique(activity_id)` attivo; rigenerazione di una settimana dopo la correzione; lo stato «svolta» nella tab Piano viene dagli abbinamenti, non solo dall'anteprima di sincronizzazione (P-17) | spostamenti oltre la settimana, sostituzioni autorizzate | medio | casi 4 e 5 con R0 |
| **5. Risposta dell'atleta** | RPE, sensazione e benessere di Intervals.icu nel contratto, con le loro coperture; sRPE per disciplina; zone e soglie lette da Intervals.icu e confrontate con PCoach (P-18) | permette osservazioni proporzionate sulla risposta | basso | casi con copertura alta e bassa; nessuna affermazione su `forbidden_claims` |
| **6. Esecuzione delle sedute chiave (L3)** | lettura degli intervalli per le sedute di qualità; `zone_ratio_high` per ripetuta | qualità delle sedute chiave | medio: dati fragili | fixture con giri reali |

## Migrazione e ritorno indietro

- **Dati storici**:
  - `athletes.data.weekly_feedback_log` è vuoto in produzione (verificato il 2026-10-10), quindi non va migrato nulla;
  - il campo resta nello schema della scheda fino alla fase 3. Poi va rimosso con una versione dello schema (1.6.0), come fatto per `training_plan` con la 1.5.0.
- **Ritorno indietro**:
  - fase 0: è un `git revert` più un nuovo deploy della funzione;
  - fasi 1-3: la tabella nuova è additiva. Il ritorno è un nuovo deploy della versione precedente della funzione, mentre `weekly_reviews` resta e non è letta;
  - nessuna fase cancella dati.
- **Senza interruzioni**: ogni fase sostituisce la funzione con un solo deploy. Il cron non cambia. Fra due esecuzioni settimanali c'è una settimana per verificare.
- **Documentazione da aggiornare**, in ogni fase, secondo `CLAUDE.md`:
  - `backend.md` (funzione e tabella);
  - `modello-dati.md` (`weekly_reviews`, stati);
  - `integrazioni.md` (Claude feedback, Intervals.icu);
  - `architettura.md` (flusso);
  - `sicurezza.md` (dati non attendibili);
  - `sviluppo-deploy.md` (test Deno in CI);
  - ADR 0008 «superata da 0019»;
  - CHANGELOG.

## Rischi

| Rischio | Mitigazione |
|---|---|
| L'abbinamento automatico sbaglia in casi non previsti | confidenza esplicita; `ambiguous` invece di un'ipotesi; periodo in parallelo; correzioni del coach (fase 4) |
| Le soglie operative (50/80/120%, ±10/20%) non vanno bene per tutti gli atleti | configurabili in `app_settings`, salvate con la valutazione (`analysis_version` più i parametri) |
| Comportamento dell'API di Intervals.icu documentato solo nel forum (Strava, carico) | test con fixture reali registrate da un atleta con il suo consenso; controllo difensivo dei campi |
| Più costo del modello per l'output strutturato | input molto più piccolo (contratto invece del JSON grezzo): verosimilmente costo netto inferiore, da misurare (P-22) |
| L'approvazione manuale aggiunge lavoro al coach | approvazione automatica facoltativa solo con dati completi e senza anomalie |
