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
  functions/claude-proxy/     Edge Function: proxy verso l'API Claude
  functions/weekly-feedback/  Edge Function schedulata: feedback settimanale + email (Fase 7)
  functions/_shared/          EmailSender astratto + implementazione Resend (Fase 7)
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

**Feedback settimanale** (generato automaticamente da una Edge Function schedulata, Fase 7 — vedi §6/§7)
```
pg_cron (ogni ora) → Edge Function weekly-feedback
  → se nella finestra giorno/ora configurata (app_settings): per ogni atleta idoneo
  → confronto tra training_plan e attività reali Intervals.icu
  → prompt di confronto → Claude (stesso pattern di claude-proxy)
  → risultato aggiunto a weekly_feedback_log nella scheda atleta
  → invio email opzionale (EmailSender/Resend) se attivo e atleta con email
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

### Design tokens e componenti generici

Tutte le variabili di design (colori, in chiaro/scuro dove previsto, font) vivono in `app/src/styles/tokens.css`; gli stili globali condivisi (layout, form, bottoni, toast, dialog) in `app/src/styles/base.css`. Nessun componente definisce colori o dimensioni "a mano": si usano sempre le variabili CSS (`var(--accent)`, `var(--border)`, `var(--font-ui)`, ...), per poter cambiare tema senza toccare i componenti.

Componenti generici riutilizzabili, in `components/ui/`:
- **Toast** (`ToastHost.vue` + `useToast`): un solo messaggio visibile alla volta, in basso al centro, si chiude da solo; usato per esiti di operazioni (salvataggio, errori di rete), mai per conferme che richiedono una decisione.
- **ConfirmDialog** (`ConfirmDialog.vue` + `useConfirmDialog`): dialogo modale disegnato in-page per ogni azione distruttiva o che scarta dati (eliminazione atleta, chiusura di una bozza con contenuto, ricaricamento di dati sopra modifiche non salvate) — mai `window.confirm`/`alert` nativi, per uno stile coerente e per poter controllare la larghezza su mobile (vedi sotto).
- **PasswordField** (`PasswordField.vue`): campo chiave/password con pulsante mostra/nascondi, usato per ogni credenziale inserita dall'utente (oggi solo la chiave Intervals.icu).
- **Card generiche** (`section.block` in `base.css`): contenitore con bordo, titolo e corpo, pattern ripetuto per ogni blocco del form atleta (Identità, Discipline, Soglie, ...).

### Convenzioni di layout

- **Chip di stato** (badge "Scarico", chip sticky "Modifiche non salvate"/"Aggiorna", stato di connessione in sidebar): sempre un pallino o badge colorato + testo breve, mai solo colore, per restare leggibili anche senza percezione del colore.
- **Azioni distruttive**: sempre dietro `ConfirmDialog`, mai immediate al click, e visivamente distinte (classe `button.danger`, colore `--danger`).
- **Area di lavoro**: un solo form visibile alla volta nella colonna centrale (`main`), largo al massimo 640px (`.form-wrap`) e centrato, per restare leggibile anche su schermi molto larghi.

### Regole mobile (360–430px, Fase 2/Fase 8)

- **Sidebar**: sotto i 720px diventa un drawer (`position: fixed`, scorrimento con `transform: translateX`), aperto/chiuso da un pulsante flottante a tocco (44×44px, soglia minima consigliata per i target touch) e da un overlay di sfondo cliccabile per chiudere; si chiude da sola alla selezione di un atleta o all'apertura delle Impostazioni (vedi `App.vue`). La transizione è disabilitata sotto `prefers-reduced-motion: reduce`, stesso trattamento già riservato al pallino di stato pulsante.
- **Form a colonna singola**: sotto i 480px, le griglie `field-row`/`checkbox-grid` (altrimenti `auto-fit, minmax(...)`, che su schermi di 360–430px possono ancora produrre due colonne strette) e la barra azioni (`action-bar`) passano a una sola colonna, per evitare celle troppo strette per input ed etichette.
- **Intestazioni che possono traboccare**: righe flessibili con testo di lunghezza variabile (es. `plan-week-header`, che unisce titolo, intervallo date e un riepilogo multi-disciplina) vanno in `flex-wrap: wrap` con `order` espliciti sotto i 480px, in modo che l'elemento più lungo (il riepilogo) vada su una riga propria invece di restringere gli altri elementi o causare overflow orizzontale.
- **Grafico del carico**: nessun `preserveAspectRatio="none"` sull'SVG — il contenitore CSS ha un `aspect-ratio` identico al `viewBox` (`600 / 180`), così il comportamento di default (`meet`) non introduce distorsione né bande vuote. Il tooltip calcola la propria posizione orizzontale in percentuale del box renderizzato (non in unità del `viewBox`, che su schermi più stretti di 600px darebbe una posizione fuori scala) e la logica di aggiornamento (`updateHover`) è condivisa tra eventi mouse e touch; `touch-action: pan-y` sull'SVG lascia passare lo scroll verticale della pagina mentre il trascinamento orizzontale è gestito dal componente.

### Colori zona e icone disciplina (Fase 6)

- **Colori zona** (`--zone-1` … `--zone-7`, `app/src/styles/tokens.css`): usati solo come tinta di swatch/bordo (barra segmentata, chip zona), mai come sfondo di testo esteso — per questo è definita una sola scala nel blocco `:root`, senza varianti per tema chiaro/scuro. Il campo `zone` nello schema è una stringa libera (non un enum); il colore si ricava estraendo la prima cifra con una regex e mappandola su `--zone-N` (clamp 1–7), con fallback a `--zone-unknown` (alias di `--text-muted`) per stringhe non interpretabili (`zoneColorVar`, `app/src/services/planViewModel.ts`).
- **Icone disciplina** (`DISCIPLINE_ICONS`/`disciplineIcon()`, `app/src/constants.ts`): emoji per `running`/`cycling`/`swimming`/`strength`, fallback `"•"` per valori non riconosciuti (anche qui `discipline` è un campo libero nel JSON generato da Claude, non garantito all'enum dello schema).
- **Barra segmentata delle sessioni strutturate**: la larghezza di ogni segmento è una quota proporzionale pulita (`widthPercent`, senza soglia minima artificiale nel calcolo); la leggibilità/tappabilità dei segmenti molto brevi è garantita a livello CSS (`flex-grow: widthPercent` sul contenitore flex + `min-width: 6px` su `.segment`), non deformando la matematica della trasformazione (vedi §10).

---

## 5. Modello dati

Il modello dati è descritto in `app/src/schema/athlete_profile.schema.json`; i tipi TypeScript in `app/src/schema/types.generated.ts` sono generati da questo schema (`npm run gen:types`, vedi §9) e non vanno modificati a mano.

### Identità (Fase 5)

`identity.name` (stringa unica) è stato sostituito da `identity.nome`, `identity.cognome` ed `identity.email`, con `schema_version` incrementata a `1.4.0`. Le schede esistenti vengono migrate al volo in lettura da `migrateProfile` (`app/src/schema/migrations/`), che applica `splitLegacyName`: la prima parola del nome completo diventa `nome`, il resto `cognome` (euristica non sempre corretta per nomi composti o cognomi con più parole). Quando l'euristica viene applicata, l'apertura della scheda (`athletes.openAthlete`) mostra un avviso che invita a verificare la divisione; la migrazione non viene ripersistita automaticamente, solo al primo salvataggio successivo della scheda. `fullName()` (in `app/src/constants.ts`) centralizza la composizione `nome + cognome` per intestazioni, card sidebar e ordinamento.

### Connessione con app esterne (Fase 5)

Nuova sezione `integrations` nel profilo (oggi con il solo campo `intervals_icu_api_key`, pensata per essere estesa con altre integrazioni future), visualizzata tra Identità e Discipline nell'editor. Il campo chiave usa il componente riutilizzabile `ui/PasswordField.vue` (mostra/nascondi). La vecchia posizione del campo (dentro "Stato di allenamento attuale", con pulsante di refresh manuale) è stata rimossa: la sincronizzazione ora è sempre automatica (vedi §7).

### Discipline (Fase 5)

Le etichette dei volumi sono state rese esplicitamente settimanali ("Volume settimanale attuale /settimana", "Picco settimanale (ultimi 12 mesi) /settimana"), con testo d'aiuto a corredo. Nessuna migrazione dati: i valori esistenti si considerano già settimanali, solo l'etichetta era ambigua.

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

-- Fase 7: impostazioni del feedback settimanale automatico.
alter table app_settings add column weekly_feedback_day text not null default 'domenica';
alter table app_settings add column weekly_feedback_time text not null default '08:00';
alter table app_settings add column weekly_feedback_timezone text not null default 'Europe/Rome';
alter table app_settings add column weekly_feedback_email_enabled boolean not null default false;
```

- `claude_api_key`: API key personale del coach per Anthropic Claude, salvata in chiaro. Stesso compromesso di sicurezza già accettato per la chiave Intervals.icu per-atleta (vedi §8), qui con un impatto potenzialmente più costoso in caso di fuga (fatturazione Claude a carico del coach).
- `claude_model`: modello Claude da usare (es. `claude-sonnet-...`); se assente, la Edge Function usa un modello di default.
- `plan_generation_prompt_template` / `weekly_feedback_prompt_template`: eventuali template di prompt personalizzati (opzionali).
- `weekly_feedback_day` (Fase 7): giorno della settimana in cui generare il feedback automatico, come chiave italiana minuscola (`domenica`…`sabato`, stesso vocabolario di `DayKey` in `app/src/constants.ts`).
- `weekly_feedback_time` (Fase 7): orario nel formato `HH:MM`, interpretato nel fuso di `weekly_feedback_timezone`. La funzione schedulata (vedi sotto) confronta solo l'ora (non i minuti), essendo invocata al più ogni ora.
- `weekly_feedback_timezone` (Fase 7): nome fuso orario IANA (es. `Europe/Rome`), usato con `Intl.DateTimeFormat` per calcolare giorno/ora correnti lato server senza dipendere dal fuso del server Supabase.
- `weekly_feedback_email_enabled` (Fase 7): se `true`, oltre a salvare il feedback in `weekly_feedback_log` la funzione schedulata prova a inviarlo via email all'atleta (se ha un `identity.email`); se `false`, il feedback viene comunque generato e salvato, ma nessuna email viene inviata.

Queste quattro colonne sono editabili dal coach nel pannello Impostazioni (sezione "Feedback settimanale automatico"); modificarle non richiede alcuna modifica alla configurazione dello scheduler (`pg_cron`, vedi sotto), perché la funzione schedulata le rilegge ad ogni invocazione.

### Edge Function `claude-proxy`

Percorso: `supabase/functions/claude-proxy/index.ts`. Scopo: inoltrare una richiesta a Claude senza esporre la API key nel browser.

- **Trigger**: HTTP, chiamata dal client autenticata con la anon key (header `Authorization: Bearer <anonKey>` e `apikey: <anonKey>`).
- **Input** (corpo della richiesta POST, JSON): `{ prompt: string, max_tokens?: number, model?: string }`.
- **Comportamento**: legge `claude_api_key` e `claude_model` dalla tabella `app_settings` usando la chiave service-role (iniettata automaticamente nell'ambiente della Edge Function da Supabase, nessun secret da configurare a mano per questo), poi chiama `api.anthropic.com/v1/messages` server-side.
- **Output**: `{ text: string }` in caso di successo, `{ error: string }` in caso di errore (chiave assente, errore dell'API Claude, ecc.).
- **Setup richiesto** (manuale, lato coach, una tantum):
  1. Creare la tabella `app_settings` (SQL sopra).
  2. Ottenere una API key Claude da `platform.claude.com` → Settings → API Keys.
  3. `supabase login`, poi `supabase link --project-ref <ref>` (una sola volta per macchina/progetto) per collegare la CLI al progetto Supabase.
  4. Deploy della function: `supabase functions deploy claude-proxy`.
  5. Inserire la API key Claude ottenuta al passo 2 tramite l'interfaccia Impostazioni dell'app (campo salvato in `app_settings.claude_api_key`, mai come secret della function).

  Nessun secret aggiuntivo da configurare per questa function: usa la chiave service-role del progetto, già disponibile automaticamente nell'ambiente di ogni Edge Function Supabase. Senza una API key Claude configurata, il pulsante "Genera piano" copia il prompt negli appunti invece di inviarlo (fallback sempre disponibile, vedi §2).

### Edge Function `weekly-feedback` (Fase 7)

Percorso: `supabase/functions/weekly-feedback/index.ts`, più `supabase/functions/_shared/emailSender.ts` (interfaccia astratta `EmailSender`) e `supabase/functions/_shared/resendEmailSender.ts` (implementazione su Resend). Scopo: generare automaticamente il feedback settimanale per ogni atleta idoneo e, se attivo, inviarlo via email.

- **Trigger**: HTTP, pensata per essere invocata **ogni ora** da `pg_cron` (via `pg_net`, vedi setup sotto). Non esegue nulla all'ora sbagliata: la funzione stessa confronta giorno/ora correnti (nel fuso `weekly_feedback_timezone`) con `weekly_feedback_day`/`weekly_feedback_time` e restituisce `{ skipped: true, reason: "..." }` se non corrispondono. Questo disaccoppia la cadenza del cron (fissa, configurata una volta) dalle impostazioni modificabili dal coach in UI (vedi §6 sopra).
- **Comportamento per atleta** (ogni atleta gestito in un blocco try/catch isolato, un errore non blocca gli altri):
  1. Salta (con motivo in log) se l'atleta non ha una chiave Intervals.icu o non ha un `training_plan`.
  2. Salta (idempotenza) se `weekly_feedback_log` ha già una voce con `date` uguale a oggi (nel fuso configurato) — garantisce **mai due feedback/email per la stessa settimana**, indipendentemente da `generated_by`.
  3. Recupera le attività Intervals.icu degli ultimi 7 giorni e le sessioni pianificate nello stesso intervallo da `training_plan` (stessa logica, duplicata in forma Deno, di `app/src/services/intervals.ts`/`planPrompt.ts` — vedi §10 per il perché della duplicazione).
  4. Costruisce il prompt di confronto (`weekly_feedback_prompt_template` da `app_settings`) e chiama `api.anthropic.com/v1/messages` direttamente (stesso pattern di `claude-proxy`, chiave letta da `app_settings.claude_api_key`).
  5. Salva la nuova voce in `weekly_feedback_log` con lo stesso controllo di concorrenza ottimistico usato dal client (`update` condizionato a `id` + `updated_at` noto; in caso di conflitto, il feedback di quell'atleta viene segnalato come errore in quel ciclo e ritentato al prossimo trigger orario, dato che l'idempotenza del passo 2 non ha ancora trovato una voce per oggi).
  6. Se `weekly_feedback_email_enabled` è `true` e l'atleta ha `identity.email`, invia il feedback via `ResendEmailSender`; altrimenti registra nel risultato che l'invio è stato saltato (provider non configurato, nessuna email, o toggle disattivato).
- **Output**: `{ ranAt, newest, results: [{ athleteId, status: "ok"|"skipped"|"error", detail? }] }`, oppure `{ skipped: true, ... }` se fuori dalla finestra oraria configurata.
- **Setup richiesto** (manuale, lato coach, una tantum):
  1. Eseguire la migrazione SQL delle quattro nuove colonne di `app_settings` (vedi sopra).
  2. Deploy della function: `supabase functions deploy weekly-feedback`.
  3. Configurare il secret `RESEND_API_KEY` (API key Resend) e `RESEND_FROM_ADDRESS` (indirizzo mittente verificato su Resend) con `supabase secrets set RESEND_API_KEY=... RESEND_FROM_ADDRESS=...` — **mai** in `app_settings` o nel client.
  4. Creare un cron job orario che invoca la function via `pg_net` (richiede le estensioni `pg_cron` e `pg_net` abilitate sul progetto Supabase):
     ```sql
     select cron.schedule(
       'weekly-feedback-hourly',
       '5 * * * *',
       $$
       select net.http_post(
         url := '<URL_PROGETTO>.supabase.co/functions/v1/weekly-feedback',
         headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
         body := '{}'::jsonb
       );
       $$
     );
     ```
     Questo passo è manuale e una tantum: non va ripetuto quando il coach cambia giorno/orario/fuso/toggle email dalle Impostazioni (vedi §6 sopra).

---

## 7. Integrazioni

### Intervals.icu (Fase 5)

La chiave API si inserisce nella sezione "Connessione con app esterne" dell'editor atleta (vedi §5). `app/src/services/intervals.ts` (`refreshFromIntervalsIcu`) interroga Intervals.icu e confronta il log restituito con quello già salvato, evitando scritture inutili quando non ci sono novità (`upToDate`).

La sincronizzazione è automatica, non più legata a un pulsante manuale, tramite il composable singleton `app/src/composables/useIntervalsSync.ts`, invocata da tre trigger lato client (il quarto, il job di feedback settimanale, è lato backend — Fase 7):
1. chiave inserita o modificata (con debounce di 1,5s, per non lanciare una richiesta ad ogni tasto premuto);
2. apertura della scheda atleta;
3. avvio della generazione di un piano ("Genera piano").

Il composable mantiene uno stato a livello di modulo (non per istanza di componente) per evitare chiamate concorrenti sullo stesso atleta (dedup via `inFlightIds`) e per tracciare un esito leggero per chiave (`valid` / `invalid` / `offline`), derivato dal messaggio di errore di `refreshFromIntervalsIcu` (`"...non valida"` → chiave non valida, altrimenti → rete/CORS non disponibile), mostrato come testo accanto al campo. Non è una validazione formale (nessun endpoint dedicato di verifica): è un sottoprodotto del primo tentativo di sincronizzazione.

I dati sincronizzati sono persistiti con la scrittura mirata `athletes.syncLoadMetrics` (vedi §10, Fase 3), non tramite il salvataggio manuale della scheda.

### Claude

Il contratto del proxy `claude-proxy` è descritto in §6. La vista grafica del piano (Fase 6, `app/src/services/planViewModel.ts` e componenti `domain/Plan*.vue`) è una trasformazione puramente client-side dello stesso JSON `training_plan` già prodotto da Claude: non introduce né richiede alcuna modifica al prompt o al contratto del proxy.

### Feedback settimanale automatico ed email (Fase 7)

Il template `weekly_feedback_prompt_template` (`app_settings`) supporta i segnaposto `{{nome_atleta}}`, `{{settimana_pianificata_json}}`, `{{settimana_reale_json}}`, interpolati sia dal flusso manuale lato client sia dalla Edge Function schedulata `weekly-feedback` (§6) — stessa funzione di interpolazione, duplicata in forma Deno per i vincoli descritti in §10. Il testo restituito da Claude è salvato in `weekly_feedback_log` (`generated_by: "claude"`, uguale al flusso manuale) e, se l'invio email è attivo, inviato come corpo testuale semplice tramite `EmailSender`/Resend, senza ulteriore formattazione HTML.

### Resend (Fase 7)

Provider email dietro l'interfaccia astratta `EmailSender` (`supabase/functions/_shared/emailSender.ts`), con un'unica implementazione concreta `ResendEmailSender` (`supabase/functions/_shared/resendEmailSender.ts`) che chiama `POST https://api.resend.com/emails`. La API key Resend vive solo come secret della Edge Function (`RESEND_API_KEY`, insieme a `RESEND_FROM_ADDRESS` per il mittente), mai in `app_settings` né nel client — vedi §6 per il comando di setup e §10 per il motivo della scelta di un'interfaccia astratta.

---

## 8. Sicurezza

### Credenziali Supabase (client)

URL e anon key del progetto Supabase sono variabili d'ambiente Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), lette in un unico punto (`app/src/services/supabase.ts`) e mai cablate nel codice. In locale vivono in `app/.env` (non committato, escluso da `.gitignore`; `.env.example` è il template committato senza valori reali). In CI sono due secret del repository GitHub, iniettati in build da `.github/workflows/deploy.yml` (vedi §9). La anon key resta comunque pubblica per costruzione (finisce nel bundle statico distribuito su GitHub Pages): la sicurezza dell'app non dipende dalla sua segretezza, ma dal fatto che RLS è disabilitata e l'accesso è protetto solo dalla segretezza del link (vedi sotto) — spostarla in una variabile d'ambiente serve a evitare di doverla ruotare ad ogni commit del sorgente, non a nasconderla.

**Rotazione della anon key (Fase 1)**: la chiave originale era stata committata in chiaro in `index.html` nella cronologia git (versione pre-migrazione). È stata ruotata dal dashboard Supabase e il nuovo valore comunicato solo tramite `.env` locale/secret GitHub Actions, mai rientrato nel repository. La vecchia chiave resta recuperabile da chiunque ispezioni la cronologia git pubblica: ruotarla rende quel valore storico inutilizzabile, azione reversibile e a basso rischio che non richiede riscrivere la cronologia.

### Nessuna autenticazione/RLS

Sia `athletes` sia `app_settings` hanno la Row Level Security disabilitata (vedi SQL in §6): non esiste login, non esiste separazione tra utenti. Chiunque conosca l'URL dell'app e la anon key (pubblica, vedi sopra) può leggere e scrivere entrambe le tabelle. Rischio accettato esplicitamente per il perimetro d'uso dichiarato in §1 (un singolo coach, link non condiviso pubblicamente); da rivedere se l'uso cambiasse (multi-coach, link condiviso pubblicamente) — richiederebbe introdurre Supabase Auth e riscrivere le policy RLS da zero, fuori dallo scope di questa migrazione.

### Chiavi di terze parti salvate in chiaro

`app_settings.claude_api_key` (per-coach) e `integrations.intervals_icu_api_key` (per-atleta, dentro il blob `data`) sono salvate in chiaro nel database, senza cifratura applicativa. Stesso compromesso di fondo del punto precedente (nessuna autenticazione a proteggerle oltre alla segretezza del link), ma con impatto diverso in caso di fuga: la chiave Claude è legata alla fatturazione Anthropic del coach (impatto economico diretto), quella Intervals.icu ai dati di allenamento di un singolo atleta (impatto più contenuto). Non è stata introdotta cifratura lato applicazione perché richiederebbe comunque decifrare la chiave in un contesto fidato per poterla usare (client per Intervals.icu, Edge Function per Claude), spostando il problema invece di risolverlo, senza autenticazione reale a monte.

### `DB_PW.md`

File in root del repository, non tracciato da git (`.gitignore` lo esclude esplicitamente da Fase 1), contenente una password in chiaro legata al progetto Supabase. Non viene mai letto, copiato in altri file né committato durante lo sviluppo assistito da AI di questo progetto — lo gestisce esclusivamente il coach al di fuori del repository versionato.

**Fase 7 — Secret della Edge Function `weekly-feedback`**

La API key Resend (`RESEND_API_KEY`) e l'indirizzo mittente (`RESEND_FROM_ADDRESS`) sono configurati esclusivamente come secret della Edge Function (`supabase secrets set ...`), mai come colonne di `app_settings` né esposti al client: a differenza di `claude_api_key` (letta anche da `claude-proxy` dal DB), non esiste alcun flusso in cui il coach debba vederla/modificarla da UI, quindi non c'è motivo di accettare lo stesso compromesso "chiave in chiaro nel DB" già fatto per `claude_api_key`/Intervals.icu.

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

**Fase 1/2 — Decisioni d'impianto della migrazione**
- *Decisione*: sicurezza delle credenziali Supabase → variabili d'ambiente Vite (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`), centralizzate in `services/supabase.ts`, nessun Supabase Auth/RLS per ora (2026-09-30, risposta alla [DECISIONE] bloccante §3 del documento di specifica originale).
  - *Motivo*: è l'opzione raccomandata a parità di perimetro d'uso (mono-coach, link non condiviso): introdurre Auth/RLS avrebbe un costo di implementazione non giustificato per il rischio accettato, mentre spostare le credenziali fuori dal sorgente versionato rende possibile ruotarle senza un nuovo commit (vedi §8).
  - *Alternativa scartata*: Supabase Auth + RLS completo — rimandato, non scartato in modo permanente: resta l'opzione da adottare se il perimetro d'uso cambiasse (vedi §11).
- *Decisione*: invio email del feedback settimanale → Resend, dietro un'interfaccia astratta `EmailSender` (2026-09-30, risposta alla [DECISIONE] bloccante §9.2).
  - *Motivo*: opzione raccomandata; l'interfaccia astratta tiene il provider sostituibile senza toccare la logica di business della Edge Function (vedi dettaglio Fase 7 sotto).
  - *Alternativa scartata*: invio diretto senza interfaccia astratta — avrebbe reso un futuro cambio di provider un refactor della function invece che l'aggiunta di una classe.
- *Decisione*: confermato il comportamento assunto per la card "Nuovo atleta" in sidebar (bozza inline al click, conferma di chiusura se contiene dati) (2026-09-30, risposta alla [DECISIONE] §5).
- *Decisione*: i dati Intervals.icu sincronizzati sono esclusi dal confronto "modifiche non salvate" e scritti in modo mirato, non tramite il salvataggio manuale dell'intera scheda (2026-09-30, risposta alla [DECISIONE] §6) — dettaglio implementativo completo in Fase 3 sotto.
- *Decisione*: TypeScript con tipi generati automaticamente da `athlete_profile.schema.json` (`json-schema-to-typescript`, script `npm run gen:types`), presa in autonomia.
  - *Motivo*: risolve alla radice il problema dei "7 punti disallineati a mano" descritto nella specifica tecnica precedente (schema, `blankProfile()`, form, wiring eventi, ...): con i tipi generati, un disallineamento tra schema e codice diventa un errore di compilazione invece di un bug silenzioso scoperto a runtime.
  - *Alternativa scartata*: librerie di form schema-driven generiche (JSONForms/RJSF) — già valutate e scartate nella specifica precedente perché gran parte della logica dell'app (log storici, esclusioni reciproche, viste derivate) non si presta a generazione automatica del form, solo dei tipi.
- *Decisione*: rotazione della anon key Supabase, presa in autonomia — dettaglio e motivo in §8.
- *Decisione*: `DB_PW.md` resta untracked, non letto né spostato; `.gitignore` aggiunto in Fase 1 lo esclude esplicitamente, senza cancellare o spostare il file — la decisione se rimuoverlo o tenerlo resta del coach.
- *Decisione*: un commit per fase, con messaggio descrittivo in italiano, al termine di ogni fase in cui l'app è in uno stato funzionante — presa in autonomia per rendere la cronologia git leggibile e ogni fase isolatamente revisionabile/ripristinabile.

**Fase 3 — Concorrenza ottimistica e scrittura mirata per Intervals.icu**
- *Decisione*: il salvataggio continua a scrivere l'intero blob `data` (non un merge lato server), ma l'`update` è condizionato al valore di `updated_at` noto quando la scheda è stata aperta/salvata l'ultima volta (`.eq("id", id).eq("updated_at", baseVersion)`), verificando poi che almeno una riga sia stata effettivamente modificata.
  - *Motivo*: `jsonb` su Postgres non supporta un merge parziale lato server senza funzioni ad hoc; la verifica condizionata è il modo più semplice per rilevare (non per risolvere automaticamente) un conflitto scrittura-scrittura tra due sessioni, coerente con l'uso personale/mono-coach dell'app.
  - *Alternativa scartata*: merge campo-per-campo lato server (richiede una funzione Postgres dedicata, complessità non giustificata per il volume d'uso previsto).
- *Decisione*: i dati sincronizzati da Intervals.icu (`training_status.load_metrics_log` con `source === "intervals_icu_sync"`) sono esclusi dal confronto "modifiche non salvate" (vedi `useDirtyState.snapshotForCompare`) e persistiti con una scrittura mirata (`athletes.syncLoadMetrics`) che rilegge la copia più recente da Supabase e vi fonde solo `load_metrics_log`, senza passare dal salvataggio manuale dell'intera scheda.
  - *Motivo*: i dati di sincronizzazione cambiano in autonomia (non per iniziativa dell'utente) e non devono né far comparire il chip "Modifiche non salvate" né rischiare di sovrascrivere altre modifiche locali dell'utente ancora in corso (che restano solo in `currentProfile` finché non vengono salvate esplicitamente).
- *Decisione*: il rilevamento di "dati più recenti disponibili sul server" (chip "Aggiorna") si basa sul confronto tra `updated_at` noto all'apertura/ultimo salvataggio e quello osservato dal polling periodico della lista (15s), non su una richiesta dedicata.
  - *Motivo*: il polling della lista aggiorna già `rowVersions` per tutte le schede; riusarlo evita richieste di rete aggiuntive.

**Fase 5 — Modello dati e form**
- *Decisione*: la migrazione `identity.name` → `nome`/`cognome` usa un'euristica (prima parola → nome, resto → cognome) applicata al volo in lettura (`migrateProfile`), non uno script di migrazione batch del database.
  - *Motivo*: evita un passo manuale separato e un downtime; l'euristica è segnalata esplicitamente all'apertura della scheda interessata, così il coach può correggere a mano i casi sbagliati (nomi composti, cognomi con più parole) senza che l'errore passi inosservato.
  - *Alternativa scartata*: script SQL una tantum su tutte le righe — avrebbe richiesto un passo manuale aggiuntivo e non avrebbe comunque potuto distinguere automaticamente i casi ambigui meglio dell'euristica a runtime.
- *Decisione*: la validazione della API key di Intervals.icu è "leggera" (esito del primo tentativo di sincronizzazione reale: valida/non valida/non verificabile offline), non una chiamata dedicata di verifica.
  - *Motivo*: Intervals.icu non espone un endpoint di validazione a basso costo distinto da quello dati; riusare il primo sync evita una richiesta di rete aggiuntiva e tiene la UI semplice.
- *Decisione*: i tre trigger di sincronizzazione automatica lato client (chiave inserita/modificata con debounce, apertura scheda, "Genera piano") condividono stato a livello di modulo (non di istanza componente) in `useIntervalsSync`, sul modello già usato da `useToast`/`useConnectionStatus`.
  - *Motivo*: il dedup (`inFlightIds`) e il debounce devono valere per atleta a prescindere da quale istanza di `AthleteEditor` li invoca; uno stato per-istanza permetterebbe sincronizzazioni concorrenti duplicate se l'editor venisse mai montato più volte.

**Fase 6 — Vista grafica del piano**
- *Decisione*: la trasformazione `training_plan` (JSON) → view-model (`buildPlanViewModel`, `app/src/services/planViewModel.ts`) è una funzione pura che non legge mai `new Date()` internamente, ma riceve `todayISO` come parametro esplicito, e non lancia mai eccezioni (dati mancanti/malformati producono campi `null`/liste vuote invece di un errore).
  - *Motivo*: rende la logica interamente testabile con Vitest in modo deterministico (il "today" dei test è controllato dal test stesso) e tollerante ai piani generati da Claude, che non garantiscono la presenza di ogni campo opzionale dello schema.
  - *Alternativa scartata*: calcolare la settimana corrente dentro i componenti Vue con `new Date()` diretto — non testabile senza mock globali del tempo.
- *Decisione*: il colore delle zone (`zoneColorVar`) si ricava con un'euristica regex (prima cifra trovata nella stringa `zone`, clamp 1–7) invece di richiedere un campo dedicato o estendere lo schema con un enum di colore.
  - *Motivo*: `zone` è un campo libero nello schema (non un enum), popolato da Claude con convenzioni non rigide (es. "Z4", "zona 4"); un'euristica tollerante evita di dover validare/normalizzare l'output di Claude solo per colorare la UI, con un fallback neutro (`--zone-unknown`) per i casi non interpretabili.
  - *Alternativa scartata*: aggiungere un campo `zone_color`/enum allo schema — avrebbe richiesto una migrazione e la modifica del prompt di generazione per un beneficio puramente visivo.
- *Decisione*: lo stato di apertura/chiusura delle settimane (`usePlanWeeksUi`) vive in un composable a stato di modulo (stesso pattern di `useIntervalsSync`), con una chiave arbitraria (`stateKey`, es. `"<id atleta>:plan"` vs `"<id atleta>:preview"`) e non nel profilo atleta né in `AthleteTrainingProfile`.
  - *Motivo*: è puro stato di interfaccia (quali settimane sono espanse), che non deve mai comparire nel confronto "modifiche non salvate" (`useDirtyState`) né essere persistito lato server; la chiave distingue lo stato del piano salvato da quello dell'anteprima pre-conferma, che devono potersi aprire/chiudere indipendentemente.
  - *Alternativa scartata*: stato locale per istanza di componente (`ref` dentro `PlanView.vue`) — si perderebbe riaprendo/richiudendo il componente (es. passando da scheda ad anteprima e ritorno) e non sarebbe condivisibile se la vista venisse mai mostrata da più punti contemporaneamente.
- *Decisione*: la larghezza dei segmenti nella barra delle sessioni strutturate (`widthPercent`) è una quota proporzionale pulita, senza una soglia minima applicata nel calcolo; la visibilità/tappabilità dei segmenti molto brevi è garantita solo a livello CSS (`min-width` sul singolo segmento).
  - *Motivo*: mantiene la trasformazione matematicamente corretta e testabile (le percentuali sommano sempre a 100, verificabile nei test) senza mescolare una preoccupazione di layout/accessibilità nella logica pura; il vincolo "resta visibile/tappabile" richiesto dalla specifica è comunque soddisfatto, solo a un livello diverso dello stack.
  - *Alternativa scartata*: applicare un pavimento minimo di percentuale dentro `planViewModel.ts` — avrebbe reso la somma dei `widthPercent` non più esattamente 100 e complicato i test senza un reale beneficio aggiuntivo rispetto al `min-width` CSS.

**Fase 7 — Feedback settimanale automatico**
- *Decisione*: la Edge Function `weekly-feedback` è invocata **ogni ora** da `pg_cron`, ma internamente confronta giorno/ora correnti (nel fuso `weekly_feedback_timezone`, via `Intl.DateTimeFormat`) con `weekly_feedback_day`/`weekly_feedback_time` letti da `app_settings`, no-op altrimenti.
  - *Motivo*: rende le impostazioni di giorno/orario/fuso modificabili dal coach in UI realmente effettive senza richiedere di toccare la configurazione del cron (SQL) ogni volta che cambiano — un cron con espressione dinamica per-riga non è disponibile in `pg_cron`/`pg_net` in modo pratico.
  - *Alternativa scartata*: ricreare/aggiornare il cron job via SQL ad ogni modifica delle impostazioni — avrebbe richiesto dare alla Edge Function o al client i permessi per modificare `cron.job`, aumentando la superficie di rischio per un beneficio minimo.
- *Decisione*: idempotenza basata sulla presenza di una voce in `weekly_feedback_log` con `date` uguale a "oggi" (nel fuso configurato), indipendentemente dal valore di `generated_by`.
  - *Motivo*: garantisce al massimo un feedback/email per atleta per settimana anche se la function viene invocata più volte nella stessa finestra oraria o se un'invocazione precedente è fallita a metà dopo aver già scritto il log.
- *Decisione*: la logica di fetch Intervals.icu, confronto piano/reale e interpolazione del prompt è duplicata in forma Deno dentro `weekly-feedback/index.ts`, invece di essere condivisa come modulo importato da `app/src`.
  - *Motivo*: le Edge Function Supabase girano su runtime Deno con bundling separato da Vite/Vitest; importare moduli TypeScript da `app/src` non è supportato in modo affidabile. La duplicazione è circoscritta a poche funzioni pure di media dimensione (fetch attività, filtro settimana pianificata, interpolazione template), un compromesso accettabile rispetto a un pacchetto condiviso cross-runtime.
  - *Alternativa scartata*: estrarre un pacchetto npm/workspace condiviso consumabile sia da Vite sia da Deno — complessità di tooling non giustificata per questo volume di logica.
- *Decisione*: invio email dietro un'interfaccia astratta `EmailSender` (`supabase/functions/_shared/emailSender.ts`), con un'unica implementazione `ResendEmailSender` dietro di essa; `weekly_feedback_email_enabled` gates solo il passo di invio email, non la generazione/salvataggio del feedback (che avviene comunque ad ogni ciclo schedulato idoneo).
  - *Motivo*: come da [DECISIONE] §9.2 risolta a inizio migrazione (vedi introduzione del piano), il provider email deve restare sostituibile senza toccare la logica di business della function; separare "genera feedback" da "invia email" evita di perdere il feedback salvato se l'invio email fallisce o è disattivato.
  - *Alternativa scartata*: chiamare l'SDK/API Resend direttamente dentro `weekly-feedback/index.ts` — avrebbe reso un futuro cambio di provider un refactor della function invece che l'aggiunta di una nuova classe.
- *Decisione*: la API key Resend e l'indirizzo mittente sono secret della Edge Function (`RESEND_API_KEY`, `RESEND_FROM_ADDRESS`), mai colonne di `app_settings`.
  - *Motivo*: a differenza di `claude_api_key`, non esiste alcun flusso UI in cui il coach debba leggerla/modificarla; tenerla come secret evita di esporla anche solo potenzialmente lato client (vedi §8).
- *Decisione*: rimossi dall'editor atleta il pulsante "Confronta settimana con il piano" e il pulsante "Rimuovi" per-voce di `weekly_feedback_log`; lo storico diventa di sola lettura, con collasso automatico oltre 5 voci dietro un link "Mostra tutti".
  - *Motivo*: con la generazione automatica e schedulata, il confronto manuale e la rimozione diventano superflui (il feedback è generato dal backend, non più dal coach a richiesta) e l'elenco può crescere indefinitamente nel tempo, da qui il collasso per non appesantire la scheda.

**Fase 8 — Rifinitura mobile**
- *Decisione*: la sidebar su mobile (≤720px) diventa un drawer `position: fixed` con `transform: translateX`, aperto da un pulsante flottante dedicato (`.sidebar-toggle`, z-index sopra sia il drawer sia l'overlay) e chiuso anche da un overlay di sfondo cliccabile, invece di un pattern "accordion" che spinga in basso il contenuto principale.
  - *Motivo*: un drawer sovrapposto lascia intatta l'altezza disponibile per il form principale (il caso d'uso più frequente su mobile è consultare/modificare una scheda già aperta, non la lista atleti), mentre un accordion ridurrebbe lo spazio utile del form ogni volta che la sidebar è visibile.
  - *Alternativa scartata*: sidebar sempre visibile ma ridotta in altezza (pattern già usato in Fase 2 per il layout responsive "di base") — insufficiente sotto i 480px, dove anche una sidebar compressa lascia troppo poco spazio al form.
- *Decisione*: il grafico del carico (`LoadMetricsChart.vue`) non usa più `preserveAspectRatio="none"`; il box CSS ha un `aspect-ratio` identico al `viewBox` SVG (`600 / 180`), e la posizione orizzontale del tooltip è calcolata in percentuale del box renderizzato invece che in unità del `viewBox`.
  - *Motivo*: `preserveAspectRatio="none"` permette la distorsione del grafico (le proporzioni di CTL/ATL non sono più confrontabili visivamente); allineare l'`aspect-ratio` CSS al `viewBox` rende `meet`/`slice`/`none` equivalenti senza bisogno di disabilitare la proiezione. Il tooltip in unità `viewBox` applicato come pixel CSS diretti (bug pre-esistente, scoperto durante questa fase) posizionava il tooltip fuori dall'area visibile su ogni schermo più stretto di 600px, cioè quasi sempre: la percentuale lo rende corretto a qualunque larghezza.
  - *Alternativa scartata*: rimuovere solo `preserveAspectRatio="none"` senza aggiungere l'`aspect-ratio` CSS — avrebbe introdotto bande vuote (letterboxing) nel contenitore, dato che senza un `aspect-ratio` esplicito il box manterrebbe la propria proporzione (non quella del `viewBox`).
- *Decisione*: la gestione del tocco sul grafico (`onTouchMove`/`onTouchEnd`) riusa la stessa funzione `updateHover` degli eventi mouse, con un solo helper di conversione coordinate (`relXFromClientX`) condiviso tra i due percorsi.
  - *Motivo*: evita di duplicare la logica di ricerca del punto più vicino e di clamping della posizione del tooltip tra i due tipi di evento, con il rischio che si disallineino nel tempo.
- *Decisione*: l'intestazione comprimibile di ogni settimana (`PlanWeekBlock.vue`) passa a `flex-wrap: wrap` con `order` espliciti sotto i 480px, invece di troncare il riepilogo testuale (sessioni/ore/km per disciplina) con `text-overflow: ellipsis`.
  - *Motivo*: il riepilogo è informazione utile al coach per farsi un'idea della settimana senza aprirla; troncarlo lo renderebbe inutile proprio sugli schermi più piccoli, dove lo spazio orizzontale scarseggia di più.
- *Decisione*: `training_status` aggiunto ai campi `required` di `athlete_profile.schema.json` (tipi rigenerati di conseguenza), così da risolvere un fallimento del deploy GitHub Pages: `vue-tsc -b` segnalava `training_status` come possibilmente `undefined` in `stores/athletes.ts` e `useDirtyState.test.ts`, che invece lo trattano sempre come presente.
  - *Motivo*: `blankProfile()` (`app/src/constants.ts`) popola `training_status` come oggetto completo per ogni scheda, nuova o esistente — non è mai omesso a runtime. Lo schema non lo dichiarava `required` semplicemente perché il campo esisteva già prima dell'introduzione dei tipi generati (Fase 1) e nessuno aveva ancora allineato i due; con i tipi generati un disallineamento tra schema e invariante reale va corretto nello schema (fonte di verità), non con controlli difensivi nel codice applicativo (vedi §10 Fase 1/2). Nessun validatore a runtime legge questo schema (è usato solo per la generazione dei tipi), quindi il cambio non ha effetto sui dati già salvati su Supabase.
  - *Alternativa scartata*: aggiungere controlli `?.`/asserzioni non-null nei punti d'uso — avrebbe nascosto il disallineamento invece di correggerlo, lasciando lo schema a descrivere un'invariante falsa.

---

## 11. Limiti noti e roadmap

- Nessuna autenticazione/RLS: rischio noto, accettato per uso personale (vedi §8).
- Nessuna cifratura applicativa per le chiavi di terze parti salvate in chiaro nel database (vedi §8).

**Sezioni volutamente non presenti nel modello dati**

Le voci seguenti erano state progettate in una fase precedente e poi rimosse su richiesta esplicita del coach: infortuni/limitazioni, eccezioni temporanee, risultati recenti, forza in palestra (fase/esperienza/attrezzatura), monitoraggio (fonti dati/metriche tracciate), regole di adattamento automatico del piano. **Non vanno reintrodotte per iniziativa autonoma in sviluppi futuri** — se servissero, richiedono una nuova richiesta esplicita del coach, non un'estrapolazione dal contesto esistente.

**Sessioni a piramide**

`training_plan`/`weekly_feedback_log` non hanno un `kind` dedicato per le sessioni a piramide (ripetute non uniformi tra loro, es. 1'-2'-3'-2'-1'): si modellano come sequenza di più `block` singoli consecutivi, non come un blocco `repeat` con variazione. Scelta per non appesantire con un caso raro la generalizzazione del modello `repeat`, pensato per il caso comune (ripetute identiche).

**Limite di frequenza Intervals.icu**

L'API di Intervals.icu impone 5000 richieste/giorno e 2500/15 minuti. Non rilevante per l'uso attuale (sincronizzazione manuale/automatica saltuaria per singolo atleta), ma da tenere presente se in futuro si aggiungesse una sincronizzazione massiva o più frequente per molti atleti contemporaneamente.

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

### Fase 5 — Modello dati e form
Identità divisa in `nome`/`cognome`/`email` (`schema_version` 1.4.0), con migrazione euristica in lettura e avviso al coach quando applicata. Nuova sezione "Connessione con app esterne" tra Identità e Discipline, con la chiave Intervals.icu spostata qui (componente `PasswordField` riutilizzabile) e rimossa dalla vecchia posizione in "Stato di allenamento". Sincronizzazione Intervals.icu resa interamente automatica (composable `useIntervalsSync`, tre trigger lato client con dedup/debounce) al posto del pulsante manuale, con un esito leggero di validità della chiave mostrato in UI. Etichette dei volumi in Discipline rese esplicitamente settimanali. Grafico del carico (`LoadMetricsChart`) ora mantiene sempre la propria struttura (zero-line, barre, curve CTL/ATL) anche senza dati, mostrando un messaggio di stato vuoto al posto dei soli assi.

### Fase 6 — Vista grafica del piano
Nuova trasformazione pura e testata `training_plan` → view-model (`planViewModel.ts`, 13 test Vitest sui casi di dati mancanti/malformati: step assenti, durate null, blocchi `repeat`, settimane vuote, date non valide). Nuovi componenti `PlanView.vue` (intestazione piano, controlli "Apri/Chiudi tutte", ancora alla settimana corrente), `PlanWeekBlock.vue` (settimana comprimibile, corrente aperta di default, badge "Scarico", riepilogo ore/km per disciplina) e `PlanSessionCard.vue` (icona disciplina, chip zona colorato, barra segmentata proporzionale alla durata per sessioni strutturate con testo "6 × (3' Z4 / 2' Z1)" per i blocchi `repeat`, lista testuale step come fallback accessibile, note pieghevoli). Stato di apertura/chiusura delle settimane spostato in un nuovo composable a stato di modulo (`usePlanWeeksUi`), fuori dal profilo atleta e dal confronto "modifiche non salvate". In `AthleteEditor.vue`, sia il piano salvato sia l'anteprima pre-conferma usano ora `PlanView` al posto del riepilogo testuale/JSON grezzo; l'editing JSON manuale resta disponibile dietro un toggle "avanzato" nell'anteprima, con avviso quando il JSON non è valido.

### Fase 7 — Impostazioni feedback e backend schedulato
Nuove colonne in `app_settings` (`weekly_feedback_day`, `weekly_feedback_time`, `weekly_feedback_timezone`, `weekly_feedback_email_enabled`), editabili dal coach in una nuova sezione "Feedback settimanale automatico" del pannello Impostazioni. Nuova Edge Function schedulata `supabase/functions/weekly-feedback/index.ts`, invocata ogni ora da `pg_cron` ma attiva solo nella finestra giorno/ora configurata (fuso orario esplicito via `Intl.DateTimeFormat`): per ogni atleta idoneo, sincronizza/confronta la settimana pianificata con quella reale da Intervals.icu, genera il feedback con Claude (stesso pattern di `claude-proxy`), lo salva in `weekly_feedback_log` con lo stesso controllo di concorrenza ottimistico del client, e — se l'invio email è attivo e l'atleta ha un indirizzo — lo invia tramite la nuova interfaccia `EmailSender` (`supabase/functions/_shared/emailSender.ts`) con implementazione Resend (`resendEmailSender.ts`, chiave come secret della function, mai nel DB). Idempotente (mai due feedback per la stessa settimana) ed errori isolati per atleta. Rimossi dall'editor atleta il confronto manuale e il pulsante "Rimuovi" per-voce: lo storico feedback è ora di sola lettura, con collasso oltre 5 voci.

### Fase 8 — Rifinitura mobile e documentazione finale
Sidebar trasformata in drawer sotto i 720px (`position: fixed` + `transform: translateX`, pulsante flottante 44×44px, overlay di sfondo, chiusura automatica alla selezione atleta/apertura Impostazioni, nessuna transizione sotto `prefers-reduced-motion`). Form a colonna singola e barra azioni impilata sotto i 480px. Intestazione di `PlanWeekBlock` resa `flex-wrap` con `order` espliciti sotto i 480px per evitare overflow del riepilogo multi-disciplina. Corretto `LoadMetricsChart`: rimosso `preserveAspectRatio="none"` (sostituito da un `aspect-ratio` CSS identico al `viewBox`, senza distorsione né bande vuote) e corretto il posizionamento del tooltip, ora calcolato in percentuale del box renderizzato invece che in unità del `viewBox` (bug che lo collocava fuori schermo su schermi più stretti di 600px); gestione del tocco unificata con quella del mouse tramite gli stessi helper (`updateHover`/`relXFromClientX`), con `touch-action: pan-y` per non bloccare lo scroll verticale della pagina. Completate tutte le sezioni di questo documento (§4, §8, §10, §11); migrato il contenuto ancora valido da `docs/specifica-tecnica.md` e `docs/impostazioni-claude.md`, poi eliminati entrambi i file. `README.md` riscritto in forma minimale. Rimosso l'`index.html` legacy dalla radice del repository.

### Fix post-Fase 8 — build GitHub Pages
Il deploy falliva in CI (`vue-tsc -b`, 4 errori) perché `training_status` non era `required` in `athlete_profile.schema.json` pur essendo sempre popolato da `blankProfile()`. Aggiunto ai campi `required` dello schema (in entrambe le copie, `docs/` e `app/src/schema/`) e rigenerati i tipi; build e suite Vitest (33 test) verificati in locale.
