# Architettura

**Quando leggerlo**: per orientarti nello stack, nella struttura delle cartelle, nell'albero dei componenti o nei flussi principali (apertura scheda, salvataggio, generazione e rigenerazione delle sedute, modifica e approvazione, sincronizzazione con Intervals.icu, feedback settimanale) prima di toccare codice.

## Scopo e perimetro

PCoach è uno strumento di lavoro per un singolo coach (allenatore) che segue più atleti. Permette di tenere una scheda per ciascun atleta (identità, discipline praticate, soglie, stato di allenamento, obiettivi, vincoli, note), di generare le sedute con l'assistenza di Claude, di rivederle, approvarle e ripianificarle senza perdere lo storico, di inviarle al calendario Intervals.icu dell'atleta, di sincronizzare i carichi di allenamento da Intervals.icu e di ricevere un confronto automatico tra piano e reale ogni settimana.

Applicazione mono-coach, pensata per uso personale con un link non condiviso pubblicamente. Non è un prodotto multi-tenant.

**Cosa NON è**:
- Non è una piattaforma multi-coach o multi-organizzazione: l'autenticazione identifica un singolo utente coach, senza separazione di permessi tra utenti diversi.
- Non è un sistema di allenamento in tempo reale: i carichi arrivano da Intervals.icu con la cadenza della sincronizzazione.
- Non è un sostituto del giudizio del coach: piano e feedback generati da Claude sono una bozza da rivedere, non un output automatico definitivo.

**Glossario**:
- **Atleta**: una persona seguita dal coach, rappresentata da una scheda (`AthleteTrainingProfile`).
- **Scheda**: l'insieme dei dati di un atleta, salvato come riga nella tabella `athletes` (colonna `data`, formato JSON validato dallo schema — vedi [modello-dati.md](modello-dati.md)).
- **Seduta** (`workouts`): un singolo allenamento pianificato, con identità stabile, data, disciplina, struttura (step e ripetute) e tre stati separati: approvazione, esecuzione, sincronizzazione — vedi [modello-dati.md](modello-dati.md#sedute-e-piani).
- **Piano** (`training_plans`): un periodo di programmazione che raggruppa sedute. Un solo piano è attivo per atleta; una rigenerazione chiude il piano attivo e ne apre uno nuovo, senza cancellare nulla.
- **Generazione** (`plan_generations`): una proposta di sedute prodotta da Claude, salvata prima di essere applicata.
- **Feedback (settimanale)**: confronto testuale tra quanto pianificato e quanto effettivamente svolto (da Intervals.icu) per una settimana, generato con l'assistenza di Claude.
- **CTL** (Chronic Training Load): carico di allenamento cronico, media mobile a lungo termine del carico giornaliero.
- **ATL** (Acute Training Load): carico di allenamento acuto, media mobile a breve termine del carico giornaliero.
- **TSB** (Training Stress Balance): equilibrio tra forma e affaticamento, calcolato come `round((CTL − ATL) × 10) / 10`.

## Stack

- **Frontend**: Vue 3 (Composition API, `<script setup>`), Vite, Pinia (store), TypeScript, `lucide-vue-next` (icone).
- **Tipi**: generati automaticamente dallo schema JSON tramite `json-schema-to-typescript` (script `npm run gen:types` — vedi [sviluppo-deploy.md](sviluppo-deploy.md)), per evitare disallineamenti manuali tra schema e codice.
- **Backend**: Supabase (Postgres + REST autogenerata tramite `@supabase/supabase-js`), più Edge Functions (Deno) per operazioni che richiedono un segreto lato server — vedi [backend.md](backend.md).
- **Integrazioni esterne**: Intervals.icu, Anthropic Claude — vedi [integrazioni.md](integrazioni.md).
- **Hosting**: GitHub Pages, build statica via GitHub Actions — vedi [sviluppo-deploy.md](sviluppo-deploy.md).
- **PWA**: l'app è installabile come Progressive Web App (manifest + icone, nessun Service Worker attivo). Configurata tramite `vite-plugin-pwa` con `selfDestroying: true` — vedi [sviluppo-deploy.md](sviluppo-deploy.md).

## Struttura delle cartelle

```
app/
  src/
    components/
      ui/        Componenti generici riutilizzabili (toast, dialog di conferma, IconButton, ...)
      domain/    Componenti specifici del dominio PCoach (scheda atleta, sidebar, grafico carico, ...)
    composables/ Logica riutilizzabile con stato reattivo (toast, dialog di conferma, stato mobile sidebar, ...)
    constants.ts Opzioni condivise tra componenti (discipline, obiettivi, ...), prompt predefiniti e helper di presentazione (formatDate, formatSigned, icone ed etichette delle discipline)
    domain/      Funzioni pure delle sedute: import dei piani salvati nella scheda, lettura della proposta di Claude e differenze di una rigenerazione, stati derivati
    stores/      Pinia: athletes.ts (schede atleti, CRUD, polling), workouts.ts (sedute, piani e stato di sincronizzazione dell'atleta aperto), settings.ts (impostazioni globali del coach), auth.ts (sessione del coach)
    services/    Accesso a sistemi esterni: supabase.ts, intervals.ts (lettura del carico), intervalsSync.ts (Edge Function intervals-sync), claude.ts, planPrompt.ts
    schema/      athlete_profile.schema.json (sorgente di verità, vedi modello-dati.md), types.generated.ts (generato, non modificare a mano), migrations/
    styles/      tokens.css (variabili di design), base.css (stili globali)
  public/
    favicon.png             Favicon del browser (PNG circolare 32×32)
    icons/                  Icone PNG per la PWA (circolari 192×192 e 512×512)
  e2e/                      Test end-to-end Playwright con backend finto in memoria
  index.html, main.ts, App.vue  Bootstrap applicazione
supabase/
  functions/claude-proxy/     Edge Function: proxy verso l'API Claude
  functions/intervals-sync/   Edge Function: anteprima e invio delle sedute al calendario Intervals.icu
  functions/weekly-feedback/  Edge Function schedulata: feedback settimanale + email
  functions/_shared/          EmailSender astratto + implementazione Resend
  functions/_shared/workouts/ Moduli puri condivisi con l'app (alias @shared): calendario, struttura della seduta, conversione per Intervals.icu, classificazione della sincronizzazione
  migrations/0001_enable_rls.sql  is_coach() + policy RLS su athletes/app_settings
  migrations/0002_move_is_coach_private.sql  sposta is_coach() nello schema private (non esposto)
  migrations/0003_baseline_tables.sql  definizione versionata di athletes e app_settings
  migrations/0004_workouts.sql  tabelle delle sedute, trigger di revisione e cronologia, RLS, apply_plan_generation, import_legacy_plan
.github/workflows/deploy.yml  Build + pubblicazione su GitHub Pages
```

Nessuna chiamata di rete viene fatta direttamente nei componenti `.vue`: ogni accesso a Supabase, Intervals.icu o Claude passa da `services/`.

## Diagramma dei componenti

```
App.vue
  ├─ LoginView.vue              (form email+password, mostrato se non autenticato)
  └─ (autenticato)
     ├─ domain/AthleteSidebar.vue
     │    ├─ "Nuovo atleta" + lista atleti (nome, discipline e ultimo TSB per atleta)
     │    ├─ pallino di stato connessione (useConnectionStatus)
     │    └─ footer compatto: IconButton "Impostazioni" + IconButton "Esci" (auth.signOut)
     ├─ domain/AthleteEditor.vue  (scheda atleta: header sticky con "Salva", viste Panoramica / Piano / Profilo)
     │    ├─ Panoramica
     │    │    ├─ domain/LoadMetricsChart.vue   (grafico CTL/ATL/TSB, tooltip, legenda con valori attuali)
     │    │    ├─ questa settimana              (domain/WorkoutRow.vue in sola lettura, collegamento al Piano)
     │    │    └─ feedback settimanale
     │    ├─ Piano: domain/PlanTab.vue          (settimana o storico filtrabile)
     │    │    ├─ domain/WorkoutRow.vue         (riga di una seduta: StructureBar mini + WorkoutBadges)
     │    │    ├─ domain/WorkoutDrawer.vue      (pannello della seduta: dati, StepEditor, testo per Intervals.icu, cronologia)
     │    │    ├─ domain/RegenerateDialog.vue   (genera o ripianifica: parametri, proposta di Claude, anteprima delle differenze)
     │    │    └─ domain/SyncWeekDialog.vue     (Sincronizza settimana: anteprima, scelte, esito per riga)
     │    └─ Profilo
     │         ├─ ui/PasswordField.vue          (chiave Intervals.icu, mostra/nascondi)
     │         ├─ domain/MetricLogList.vue      (rilevazioni delle soglie per corsa/bici/nuoto)
     │         └─ identità, discipline, stato, obiettivi, vincoli, metodologia, note, esporta/elimina
     ├─ stato vuoto (nessun atleta aperto: indica di scegliere o creare un atleta dall'elenco)
     └─ domain/SettingsPanel.vue  (Impostazioni: Claude, prompt, orario feedback settimanale)
  ui/ConfirmDialog.vue + ui/ToastHost.vue  (montati una volta in App.vue, pilotati da composables condivisi)
```

Ogni componente `domain/` incapsula markup e stato locale di una sezione; lo stato condiviso (schede atleta, impostazioni, sessione) vive nei store Pinia, mai passato per prop attraverso più livelli.

Il drawer della sidebar su mobile (backdrop cliccabile, Esc, scroll-lock, gestione del focus) è interamente gestito dal composable `app/src/composables/useMobileSidebar.ts`, non da `App.vue` — vedi [design-ui.md](design-ui.md) per le regole mobile.

## Flussi principali

**Apertura scheda + sincronizzazione**
```
Sidebar (click atleta) → store athletes.openAthlete(id)
  → sincrono: legge la scheda già in memoria (nessuna chiamata di rete)
  → popola il form (AthleteEditor.vue)
AthleteEditor.vue → watch su apertura atleta
  → se presente una chiave Intervals.icu, avvia sincronizzazione del carico (services/intervals.ts)
```
La sincronizzazione Intervals.icu all'apertura è innescata da un `watch` dentro `AthleteEditor.vue`, non dallo store — vedi [integrazioni.md](integrazioni.md) per i tre trigger lato client.

**Salvataggio**
```
AthleteEditor → store athletes.saveCurrent()
  → insert (scheda nuova) oppure update condizionato a updated_at noto (scheda esistente)
  → in caso di conflitto (nessuna riga aggiornata): avviso, nessuna sovrascrittura
```
Il salvataggio scrive comunque l'intero blob `data`, ma l'update è condizionato al valore di `updated_at` noto al momento dell'apertura/ultimo salvataggio (controllo di concorrenza ottimistico). Se un'altra sessione ha salvato nel frattempo, l'update non trova righe da modificare e il coach viene avvisato del conflitto invece di sovrascrivere silenziosamente. Rischio residuo e mitigazione completa in [limiti-roadmap.md](limiti-roadmap.md).

**Generazione e rigenerazione delle sedute**
```
PlanTab → RegenerateDialog: data di ripartenza, settimane, motivo, sedute da mantenere
  → plan_generations (status proposed)
  → services/planPrompt.ts → services/claude.ts → claude-proxy → api.anthropic.com
  → risposta salvata nella generazione → domain/regeneration.ts parseProposal (date nel periodo, metrica per disciplina)
  → anteprima: regenerationDiff (mantenute, sostituite, aggiunte, tolte)
  → conferma del coach → rpc apply_plan_generation (una transazione)
```
La funzione SQL:
- chiude il piano attivo e ne apre uno nuovo;
- segna come «sostituite» le sedute non mantenute, che restano nello storico;
- inserisce le nuove sedute come bozze.

Rifiuta l'applicazione se nel frattempo una seduta è cambiata, se una seduta dalla data di ripartenza non è classificata, o se la proposta è già stata applicata. Nulla prima della data di ripartenza viene toccato e le sedute svolte restano sempre.

Se non è configurata una chiave Claude, il prompt viene copiato negli appunti e la risposta si incolla nel dialogo. Dettagli in [backend.md](backend.md#funzioni-sql-delle-sedute) e [integrazioni.md](integrazioni.md#claude-generazione-delle-sedute).

**Modifica e approvazione di una seduta**
```
PlanTab → WorkoutDrawer (bozza locale) → store workouts.update(id, patch)
  → update ... eq("revision", revisione nota)
  → trigger: revisione +1 se cambia il contenuto, evento in workout_events
```
Se nessuna riga viene aggiornata, la seduta è cambiata altrove: lo store ricarica i dati e il coach riapplica le modifiche. Approvare cambia solo lo stato e non invia nulla a Intervals.icu.

**Sincronizza settimana**
```
PlanTab → SyncWeekDialog → Edge Function intervals-sync (preview): eventi della settimana, eventi spariti, sedute svolte
  → classifyWeek (modulo condiviso): da creare, da aggiornare, conflitti, da rimuovere, escluse
  → conferma del coach → intervals-sync (apply) una seduta alla volta → workout_sync + workout_events
```
Dettagli e regole in [integrazioni.md](integrazioni.md#intervalsicu-sincronizzazione-delle-sedute).

**Feedback settimanale** (generato automaticamente da una Edge Function schedulata)
```
pg_cron (ogni ora, legge la service-role key da Vault) → Edge Function weekly-feedback
  → verifica che il chiamante presenti la service-role key come bearer (altrimenti 401)
  → se nel resto della giornata configurata (app_settings): per ogni atleta idoneo
  → sincronizza CTL/ATL da Intervals.icu (stessa logica di services/intervals.ts)
  → confronto tra le sedute pianificate (tabella workouts) e le attività reali Intervals.icu
  → prompt di confronto → Claude (stesso pattern di claude-proxy)
  → risultato aggiunto a weekly_feedback_log nella scheda atleta
  → invio email opzionale (EmailSender/Resend) se attivo e atleta con email
```
Dettagli completi in [backend.md](backend.md) (contratto della function) e [integrazioni.md](integrazioni.md) (Intervals.icu/Claude/Resend). Motivazioni delle scelte in [decisioni/0008-feedback-automatico-schedulato.md](decisioni/0008-feedback-automatico-schedulato.md).

## Convenzioni di codice

- **Componenti**: `<script setup lang="ts">`, logica in cima, template sotto. Componenti generici e privi di conoscenza del dominio in `components/ui/`; componenti che conoscono `AthleteTrainingProfile` o altre strutture di dominio in `components/domain/`.
- **Store (Pinia)**: un solo store per area di responsabilità (`athletes`, `workouts`, `settings`, `auth`). Le letture e le scritture sul database passano dalle azioni degli store. Le chiamate che orchestrano un flusso in più passi verso un servizio esterno (Claude per la generazione, `intervals-sync` per la sincronizzazione) partono dal componente che guida il flusso (`RegenerateDialog`, `SyncWeekDialog`) tramite `services/`, mai con un `fetch` diretto.
- **Services**: wrapper sottili attorno a un sistema esterno (Supabase, Intervals.icu, Claude). Restituiscono dati già nella forma attesa dall'app o un esito esplicito di errore (es. `{ ok: false, error }`), non lanciano eccezioni non gestite verso i componenti.
- **Composables**: logica con stato reattivo riutilizzabile tra più componenti (es. toast, dialog di conferma, stato mobile sidebar). Quando la stessa logica è esprimibile come funzione pura (senza stato Vue), si preferisce una funzione pura testabile con Vitest a un composable, riservando i composable ai casi che hanno davvero bisogno di stato reattivo o lifecycle.
- **Gestione errori**: gli errori verso l'utente passano dal sistema di toast (`showToast(msg, "error")`, o `showResultToast` per gli esiti `{ ok, message }` degli store); le azioni distruttive (eliminazione atleta, scarto di una bozza con dati, annullamento o eliminazione di una seduta) richiedono conferma esplicita tramite `useConfirmDialog`, mai `window.confirm`/`alert` nativi. Le rimozioni da Intervals.icu si confermano solo nel dialogo «Sincronizza settimana».
- **Codice condiviso con le Edge Function**: i moduli puri in `supabase/functions/_shared/workouts/` non hanno dipendenze e importano i moduli vicini con l'estensione `.ts`, richiesta da Deno. L'app li importa con l'alias `@shared`, configurato in `vite.config.ts` e `tsconfig.app.json`.
- **Naming**: identificatori di codice in inglese (variabili, funzioni, nomi di file); testo visibile all'utente, commenti e messaggi in italiano.

## Come aggiungere un campo al modello dati

1. Modificare `app/src/schema/athlete_profile.schema.json` (unica sorgente di verità — vedi [modello-dati.md](modello-dati.md)).
2. Se il nuovo campo richiede un valore di default per le schede esistenti, incrementare `schema_version` e aggiungere una migrazione in `app/src/schema/migrations/`.
3. Rigenerare i tipi: `npm run gen:types` (dentro `app/`).
4. Aggiornare `blankProfile()`/i default usati per le nuove schede.
5. Aggiornare il componente del form interessato (`components/domain/AthleteEditor.vue` o un suo sotto-componente).
6. Documentare il campo in [modello-dati.md](modello-dati.md).

## Come aggiungere una nuova integrazione esterna

1. Creare un nuovo file in `services/` dedicato all'integrazione (stesso pattern di `intervals.ts`/`claude.ts`): funzioni che incapsulano le chiamate HTTP e restituiscono dati già normalizzati o un esito di errore esplicito.
2. Se l'integrazione richiede un segreto che non deve mai arrivare al browser, passare da una Edge Function dedicata (come `claude-proxy`), non da una chiamata diretta dal client.
3. Aggiungere i campi di configurazione necessari (chiavi, stato di connessione) al modello dati o a `app_settings`, a seconda che siano per-atleta o per-coach.
4. Documentare endpoint, autenticazione e limiti noti in [integrazioni.md](integrazioni.md).
