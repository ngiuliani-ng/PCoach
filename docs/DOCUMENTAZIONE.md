# PCoach — Documentazione

Fonte unica di verità per architettura, convenzioni, modello dati, backend e processo di sviluppo di PCoach. Sostituisce `docs/specifica-tecnica.md` e `docs/impostazioni-claude.md` (migrati e poi eliminati — vedi §12).

> Documento in costruzione progressiva durante la migrazione a Vue 3 + Vite + Pinia (vedi §10, §12). Le sezioni non ancora completate riportano una nota esplicita con la fase in cui verranno popolate.

## Indice

1. [Panoramica](#1-panoramica)
2. [Architettura](#2-architettura)
3. [Convenzioni tecniche](#3-convenzioni-tecniche)
4. [Linee guida grafiche](#4-linee-guida-grafiche)
5. [Modello dati](#5-modello-dati)
6. [Database e backend](#6-database-e-backend)
7. [Integrazioni](#7-integrazioni)
8. [Sicurezza](#8-sicurezza)
9. [Sviluppo e deploy](#9-sviluppo-e-deploy)
10. [Decisioni prese](#10-decisioni-prese)
11. [Limiti noti e roadmap](#11-limiti-noti-e-roadmap)
12. [Changelog per fase](#12-changelog-per-fase)

---

## 1. Panoramica

**Scopo**: PCoach è uno strumento di lavoro per un singolo coach (allenatore) che segue più atleti. Permette di tenere una scheda per ciascun atleta (identità, discipline praticate, soglie, stato di allenamento, obiettivi, vincoli, note), di generare un piano di allenamento assistito da un modello linguistico (Claude), di sincronizzare i carichi di allenamento da Intervals.icu e di ricevere un confronto automatico tra piano e reale ogni settimana.

**Perimetro**: applicazione mono-coach, pensata per uso personale con un link non condiviso pubblicamente. Non è un prodotto multi-tenant.

**Cosa NON è**:
- Non è una piattaforma multi-coach o multi-organizzazione: non esiste login/autenticazione, non esiste separazione di permessi tra utenti diversi.
- Non è un sistema di allenamento in tempo reale (niente dati live durante l'allenamento): i carichi arrivano da Intervals.icu con la cadenza della sincronizzazione.
- Non è un sostituto del giudizio del coach: piano e feedback generati da Claude sono una bozza da rivedere, non un output automatico definitivo.

**Glossario**:
- **Atleta**: una persona seguita dal coach, rappresentata da una scheda (`AthleteTrainingProfile`).
- **Scheda**: l'insieme dei dati di un atleta, salvato come riga nella tabella `athletes` (colonna `data`, formato JSON validato da `athlete_profile.schema.json`).
- **Piano** (`training_plan`): il piano di allenamento assegnato all'atleta, strutturato in settimane e sessioni, generabile con l'assistenza di Claude.
- **Feedback (settimanale)**: confronto testuale tra quanto pianificato e quanto effettivamente svolto (da Intervals.icu) per una settimana, generato con l'assistenza di Claude.
- **CTL** (Chronic Training Load): carico di allenamento cronico, media mobile a lungo termine del carico giornaliero.
- **ATL** (Acute Training Load): carico di allenamento acuto, media mobile a breve termine del carico giornaliero.
- **TSB** (Training Stress Balance): equilibrio tra forma e affaticamento, calcolato come `round((CTL − ATL) × 10) / 10`.

---

## 2. Architettura

### Stack

- **Frontend**: Vue 3 (Composition API, `<script setup>`), Vite, Pinia (store), TypeScript.
- **Tipi**: generati automaticamente da `athlete_profile.schema.json` tramite `json-schema-to-typescript` (script `npm run gen:types`), per evitare disallineamenti manuali tra schema e codice.
- **Backend**: Supabase (Postgres + REST autogenerata tramite `@supabase/supabase-js`), più Edge Functions (Deno) per operazioni che richiedono un segreto lato server (chiamate a Claude).
- **Integrazioni esterne**: Intervals.icu (import carico di allenamento), Anthropic Claude (generazione piano/feedback, sempre tramite proxy server-side — mai dal browser).
- **Hosting**: GitHub Pages, build statica via GitHub Actions.

### Struttura delle cartelle

```
app/
  src/
    components/
      ui/        Componenti generici riutilizzabili (toast, dialog di conferma, ...)
      domain/    Componenti specifici del dominio PCoach (scheda atleta, sidebar, grafico carico, ...)
    composables/ Logica riutilizzabile con stato reattivo (toast, dialog di conferma, ...)
    constants.ts Opzioni condivise tra componenti (discipline, obiettivi, ...)
    stores/      Pinia: athletes.ts (schede atlete, CRUD, polling), settings.ts (impostazioni globali del coach)
    services/    Accesso a sistemi esterni: supabase.ts, intervals.ts, claude.ts, planPrompt.ts
    schema/      athlete_profile.schema.json (sorgente), types.generated.ts (generato, non modificare a mano), migrations/
    styles/      tokens.css (variabili di design), base.css (stili globali)
  index.html, main.ts, App.vue  Bootstrap applicazione
supabase/
  functions/claude-proxy/  Edge Function: proxy verso l'API Claude
.github/workflows/deploy.yml  Build + pubblicazione su GitHub Pages
docs/
  DOCUMENTAZIONE.md            Questo file
  athlete_profile.schema.json  Schema JSON del modello dati (sorgente di verità, letto anche da app/src/schema)
```

Nessuna chiamata di rete viene fatta direttamente nei componenti `.vue`: ogni accesso a Supabase, Intervals.icu o Claude passa da `services/`.

### Flussi principali

**Apertura scheda + sincronizzazione**
```
Sidebar (click atleta) → store athletes.openAthlete(id)
  → carica la scheda da Supabase (tabella athletes, colonna data)
  → se presente una chiave Intervals.icu, avvia sincronizzazione del carico (services/intervals.ts)
  → popola il form (AthleteEditor.vue)
```

**Salvataggio**
```
AthleteEditor → store athletes.saveCurrent()
  → insert (scheda nuova) oppure update condizionato a updated_at noto (scheda esistente)
  → in caso di conflitto (nessuna riga aggiornata): avviso, nessuna sovrascrittura
```
*Nota (Fase 3)*: il salvataggio scrive comunque l'intero blob `data`, ma l'update è condizionato al valore di `updated_at` noto al momento dell'apertura/ultimo salvataggio (controllo di concorrenza ottimistico). Se un'altra sessione ha salvato nel frattempo, l'update non trova righe da modificare e il coach viene avvisato del conflitto invece di sovrascrivere silenziosamente. Rischio residuo e mitigazione completa in §11.

**Generazione piano**
```
AthleteEditor → services/planPrompt.ts (costruisce il prompt dal profilo atleta)
  → services/claude.ts → Supabase Edge Function claude-proxy → api.anthropic.com
  → risposta → anteprima a schermo → conferma esplicita del coach → scrittura in training_plan
```
Se non è configurata una chiave Claude in `app_settings`, il prompt viene copiato negli appunti invece di essere inviato (fallback sempre disponibile).

**Feedback settimanale** (generazione manuale in Fase 1; automazione schedulata pianificata per la Fase 7, vedi §11)
```
AthleteEditor → confronto tra training_plan e attività reali (services/intervals.ts)
  → prompt di confronto → services/claude.ts → claude-proxy
  → risultato aggiunto a weekly_feedback_log nella scheda atleta
```

---

## 3. Convenzioni tecniche

- **Componenti**: `<script setup lang="ts">`, logica in cima, template sotto. Componenti generici e privi di conoscenza del dominio in `components/ui/`; componenti che conoscono `AthleteTrainingProfile` o altre strutture di dominio in `components/domain/`.
- **Store (Pinia)**: un solo store per area di responsabilità (`athletes`, `settings`). Le azioni dello store sono l'unico punto che tocca `services/`; i componenti chiamano azioni dello store, mai `services/` direttamente.
- **Services**: wrapper sottili attorno a un sistema esterno (Supabase, Intervals.icu, Claude). Restituiscono dati già nella forma attesa dall'app o un esito esplicito di errore (es. `{ ok: false, error }`), non lanciano eccezioni non gestite verso i componenti.
- **Composables**: logica con stato reattivo riutilizzabile tra più componenti (es. toast, dialog di conferma). Quando la stessa logica è esprimibile come funzione pura (senza stato Vue), si preferisce una funzione pura testabile con Vitest a un composable, riservando i composable ai casi che hanno davvero bisogno di stato reattivo o lifecycle.
- **Gestione errori**: gli errori verso l'utente passano dal sistema di toast (`useToast`); le azioni distruttive (eliminazione atleta, scarto di una bozza con dati) richiedono conferma esplicita tramite `useConfirmDialog`, mai `window.confirm`/`alert` nativi.
- **Naming**: identificatori di codice in inglese (variabili, funzioni, nomi di file); testo visibile all'utente, commenti e messaggi in italiano.
- **Schema e tipi**: `docs/athlete_profile.schema.json` è la sorgente di verità del modello dati. `app/src/schema/athlete_profile.schema.json` ne è una copia identica usata in build; `app/src/schema/types.generated.ts` è generato da questo file con `npm run gen:types` e non va mai modificato a mano.

### Come aggiungere un campo al modello dati

1. Modificare `docs/athlete_profile.schema.json` (e copiarlo identico in `app/src/schema/athlete_profile.schema.json`).
2. Se il nuovo campo richiede un valore di default per le schede esistenti, incrementare `schema_version` e aggiungere una migrazione in `app/src/schema/migrations/` (vedi §5 per lo storico).
3. Rigenerare i tipi: `npm run gen:types` (dentro `app/`).
4. Aggiornare `blankProfile()`/i default usati per le nuove schede.
5. Aggiornare il componente del form interessato (`components/domain/AthleteEditor.vue` o un suo sotto-componente).
6. Documentare il campo in questo file, §5.

### Come aggiungere una nuova integrazione esterna

1. Creare un nuovo file in `services/` dedicato all'integrazione (stesso pattern di `intervals.ts`/`claude.ts`): funzioni che incapsulano le chiamate HTTP e restituiscono dati già normalizzati o un esito di errore esplicito.
2. Se l'integrazione richiede un segreto che non deve mai arrivare al browser, passare da una Edge Function dedicata (come `claude-proxy`), non da una chiamata diretta dal client.
3. Aggiungere i campi di configurazione necessari (chiavi, stato di connessione) al modello dati o a `app_settings`, a seconda che siano per-atleta o per-coach.
4. Documentare endpoint, autenticazione e limiti noti in §7.

---

## 4. Linee guida grafiche

*Da completare in Fase 8, con riferimento ai componenti `ui/` definitivi e alle regole mobile (Fase 2/Fase 8).*

---

## 5. Modello dati

*Da completare progressivamente a partire dalla Fase 5 (split Identità, sezione "Connessione con app esterne", relabeling Discipline). Fino ad allora il modello dati coincide con quello descritto in `docs/athlete_profile.schema.json`, invariato rispetto alla versione precedente alla migrazione.*

---

## 6. Database e backend

### Tabella `athletes`

Una riga per scheda atleta.

```sql
create table athletes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS disabilitata: uso personale, accesso protetto solo dalla segretezza
-- del link e della anon key. Vedi §8 per i rischi e le alternative valutate.
alter table athletes disable row level security;
```

- `id`: identificativo dell'atleta (stringa).
- `data`: l'intera scheda atleta, conforme a `athlete_profile.schema.json`.
- `updated_at`: timestamp di ultimo salvataggio, aggiornato lato client ad ogni scrittura. Usato dalla Fase 3 come campo di versione per il controllo di concorrenza ottimistico e per rilevare quando sul server è disponibile una versione più recente di quella aperta in editor (vedi §11).

### Tabella `app_settings`

Configurazione globale del coach (non per-atleta): riga singola con `id = 1`.

```sql
create table app_settings (
  id integer primary key,
  claude_api_key text,
  claude_model text,
  plan_generation_prompt_template text,
  weekly_feedback_prompt_template text
);

alter table app_settings disable row level security;
```

- `claude_api_key`: API key personale del coach per Anthropic Claude, salvata in chiaro. Stesso compromesso di sicurezza già accettato per la chiave Intervals.icu per-atleta (vedi §8), qui con un impatto potenzialmente più costoso in caso di fuga (fatturazione Claude a carico del coach).
- `claude_model`: modello Claude da usare (es. `claude-sonnet-...`); se assente, la Edge Function usa un modello di default.
- `plan_generation_prompt_template` / `weekly_feedback_prompt_template`: eventuali template di prompt personalizzati (opzionali).

Ulteriori colonne per le impostazioni di feedback schedulato (giorno/orario/fuso, toggle email) sono pianificate per la Fase 7 (vedi §11); verranno documentate qui con la relativa migrazione SQL quando introdotte.

### Edge Function `claude-proxy`

Percorso: `supabase/functions/claude-proxy/index.ts`. Scopo: inoltrare una richiesta a Claude senza esporre la API key nel browser.

- **Trigger**: HTTP, chiamata dal client autenticata con la anon key (header `Authorization: Bearer <anonKey>` e `apikey: <anonKey>`).
- **Input** (corpo della richiesta POST, JSON): `{ prompt: string, max_tokens?: number, model?: string }`.
- **Comportamento**: legge `claude_api_key` e `claude_model` dalla tabella `app_settings` usando la chiave service-role (iniettata automaticamente nell'ambiente della Edge Function da Supabase, nessun secret da configurare a mano per questo), poi chiama `api.anthropic.com/v1/messages` server-side.
- **Output**: `{ text: string }` in caso di successo, `{ error: string }` in caso di errore (chiave assente, errore dell'API Claude, ecc.).
- **Setup richiesto** (manuale, lato coach): creare la tabella `app_settings` (SQL sopra), inserire la propria API key Claude tramite l'interfaccia Impostazioni dell'app, effettuare il deploy della function con la Supabase CLI (`supabase functions deploy claude-proxy`). Nessun secret aggiuntivo da configurare: la function usa la chiave service-role del progetto, già disponibile automaticamente nell'ambiente di ogni Edge Function Supabase.

Job schedulato per il feedback settimanale e relativo invio email: pianificati per la Fase 7 (vedi §11); questa sezione verrà estesa con la function `weekly-feedback`, lo scheduler (`pg_cron` o equivalente) e il provider email scelto.

---

## 7. Integrazioni

*Da completare in Fase 5/6 (Intervals.icu: dettaglio endpoint/regole di sync) e Fase 7 (Claude: aggiornamento con i prompt definitivi del piano grafico). Il contratto corrente del proxy Claude è già descritto in §6.*

---

## 8. Sicurezza

*Da completare in Fase 1 (sezione dedicata a chiavi/segreti del nuovo setup Vite) e aggiornata man mano. Punti già stabiliti, da riportare qui per esteso quando la sezione sarà scritta:*
- *URL e anon key Supabase in variabili d'ambiente Vite (`.env`, non committato), centralizzate in `services/supabase.ts`.*
- *`app_settings.claude_api_key` e le chiavi Intervals.icu per-atleta restano salvate in chiaro nel database, con RLS disabilitata (nessuna autenticazione): rischio accettato per uso personale con link non condiviso, da rivedere se l'uso cambiasse (multi-coach, link condiviso pubblicamente).*

---

## 9. Sviluppo e deploy

### Setup locale

Prerequisito: Node.js (versione 22 usata in build, vedi workflow CI sotto).

```bash
cd app
npm install
cp .env.example .env   # poi inserire i valori reali del progetto Supabase
npm run dev
```

Variabili d'ambiente richieste in `app/.env` (mai committato; vedi `.env.example` per il formato):
- `VITE_SUPABASE_URL`: URL del progetto Supabase.
- `VITE_SUPABASE_ANON_KEY`: anon key pubblica del progetto Supabase (vedi §8 per la natura di questa chiave).

### Generazione dei tipi dallo schema

```bash
npm run gen:types
```
Rigenera `src/schema/types.generated.ts` da `src/schema/athlete_profile.schema.json`. Da eseguire ogni volta che lo schema cambia; l'output va committato (per avere una build riproducibile senza passi impliciti in CI).

### Test

```bash
npm run test
```
Esegue la suite Vitest (`vitest run`). Nella Fase 1 la suite è ancora vuota/minima: i test di logica pura (confronto dirty, macchina a stati connessione, trasformazione piano, migrazioni schema) vengono aggiunti dalla Fase 2 in poi, insieme alla logica che testano.

### Build di produzione

```bash
npm run build
```
Esegue `vue-tsc -b` (type-check) seguito da `vite build`. L'output statico viene scritto in `app/dist`.

### Pubblicazione (GitHub Pages)

Il deploy è automatizzato da `.github/workflows/deploy.yml`: ad ogni push su `main` (o manualmente da GitHub Actions), il workflow installa le dipendenze, esegue `npm run build` dentro `app/` e pubblica `app/dist` su GitHub Pages.

Il workflow richiede due **secret del repository GitHub** (Settings → Secrets and variables → Actions), da configurare manualmente una tantum:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Senza questi due secret configurati, la build in CI fallisce o produce una build priva di connessione a Supabase. `vite.config.ts` imposta `base: '/PCoach/'`, corrispondente al nome del repository GitHub (`ngiuliani-ng/PCoach`); se il repository cambiasse nome, questo valore andrebbe aggiornato di conseguenza.

---

## 10. Decisioni prese

*Sezione popolata progressivamente. Le decisioni principali già prese (risposte alle [DECISIONE] bloccanti e scelte autonome di Fase 1) verranno riportate qui per esteso, con data, motivo e alternative scartate, entro la fine della Fase 1/inizio Fase 2.*

**Fase 3 — Concorrenza ottimistica e scrittura mirata per Intervals.icu**
- *Decisione*: il salvataggio continua a scrivere l'intero blob `data` (non un merge lato server), ma l'`update` è condizionato al valore di `updated_at` noto quando la scheda è stata aperta/salvata l'ultima volta (`.eq("id", id).eq("updated_at", baseVersion)`), verificando poi che almeno una riga sia stata effettivamente modificata.
  - *Motivo*: `jsonb` su Postgres non supporta un merge parziale lato server senza funzioni ad hoc; la verifica condizionata è il modo più semplice per rilevare (non per risolvere automaticamente) un conflitto scrittura-scrittura tra due sessioni, coerente con l'uso personale/mono-coach dell'app.
  - *Alternativa scartata*: merge campo-per-campo lato server (richiede una funzione Postgres dedicata, complessità non giustificata per il volume d'uso previsto).
- *Decisione*: i dati sincronizzati da Intervals.icu (`training_status.load_metrics_log` con `source === "intervals_icu_sync"`) sono esclusi dal confronto "modifiche non salvate" (vedi `useDirtyState.snapshotForCompare`) e persistiti con una scrittura mirata (`athletes.syncLoadMetrics`) che rilegge la copia più recente da Supabase e vi fonde solo `load_metrics_log`, senza passare dal salvataggio manuale dell'intera scheda.
  - *Motivo*: i dati di sincronizzazione cambiano in autonomia (non per iniziativa dell'utente) e non devono né far comparire il chip "Modifiche non salvate" né rischiare di sovrascrivere altre modifiche locali dell'utente ancora in corso (che restano solo in `currentProfile` finché non vengono salvate esplicitamente).
- *Decisione*: il rilevamento di "dati più recenti disponibili sul server" (chip "Aggiorna") si basa sul confronto tra `updated_at` noto all'apertura/ultimo salvataggio e quello osservato dal polling periodico della lista (15s), non su una richiesta dedicata.
  - *Motivo*: il polling della lista aggiorna già `rowVersions` per tutte le schede; riusarlo evita richieste di rete aggiuntive.

---

## 11. Limiti noti e roadmap

*Da completare progressivamente. Debiti tecnici già noti e tracciati nel piano di lavoro (riferimento rapido, da dettagliare qui):*
- *Nessuna autenticazione/RLS: rischio noto, accettato per uso personale (vedi §8).*

**Rischio residuo: salvataggio dell'intero blob `jsonb` (Fase 3)**

Il salvataggio scrive sempre l'intero oggetto `data`, non un merge parziale lato server. Il controllo di concorrenza ottimistico (condizione su `updated_at`) evita che una sessione sovrascriva silenziosamente le modifiche di un'altra, ma non risolve il conflitto: se due sessioni modificano la stessa scheda in finestre temporali sovrapposte, la seconda a salvare riceve un avviso di conflitto e deve ricaricare i dati più recenti (chip "Aggiorna") e riapplicare manualmente le proprie modifiche, perdendo quindi il lavoro non ancora salvato se non lo riporta a mano.

*Mitigazione scelta*: controllo di concorrenza ottimistico lato client (update condizionato + verifica del numero di righe modificate) più rilevamento proattivo di versioni più recenti tramite polling, così da ridurre la finestra in cui un conflitto può verificarsi e rendere visibile all'utente quando sta per salvare su dati non più aggiornati. Non è stata scelta una soluzione di merge automatico campo-per-campo (vedi §10) perché non giustificata per un uso mono-coach; resta un limite noto accettato, da rivalutare se l'app venisse usata da più coach in concorrenza sulla stessa scheda.

---

## 12. Changelog per fase

### Fase 1 — Scaffold + parità funzionale
Migrazione dell'app da file HTML singolo a Vue 3 + Vite + Pinia + TypeScript, con parità funzionale rispetto alla versione precedente. Tipi generati da `athlete_profile.schema.json`. Setup di build e deploy automatizzato su GitHub Pages. Creazione di questo documento.

### Fase 2 — Sidebar e stato di connessione
Sidebar definitiva con card "Nuovo atleta" fissa in cima, bozza inline con conferma di chiusura se contiene dati, stato di connessione a 4 stati (`useConnectionStatus`, funzione pura testata) con pallino pulsante rispettoso di `prefers-reduced-motion`. Layout responsive di base (sidebar come drawer sotto breakpoint mobile).

### Fase 3 — Sincronizzazione sicura e concorrenza ottimistica
Eliminato il bug di polling che sovrascriveva la scheda in editing: il polling periodico ora aggiorna solo l'elenco atleti e le relative versioni (`updated_at`), mai `currentProfile`. Aggiunto controllo di concorrenza ottimistico al salvataggio (update condizionato a `updated_at` noto, con avviso esplicito in caso di conflitto). Nuovo chip sticky "Dati aggiornati disponibili — Aggiorna" accanto al chip "Modifiche non salvate", con conferma se si ricaricano dati sopra modifiche locali non salvate. Estratta la logica di confronto "modifiche non salvate" in un composable dedicato (`useDirtyState`, con funzioni pure testate da Vitest), estesa per escludere le voci di `load_metrics_log` sincronizzate da Intervals.icu. Nuova azione `syncLoadMetrics` per persistere le sincronizzazioni Intervals.icu con scrittura mirata sulla copia più recente del server, senza richiedere un salvataggio manuale.
