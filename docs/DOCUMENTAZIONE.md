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

*Sezione principale da completare in Fase 8, con riferimento ai componenti `ui/` definitivi e alle regole mobile (Fase 2/Fase 8). Sotto, le convenzioni già stabilite in Fase 6 per la vista grafica del piano.*

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
- **Setup richiesto** (manuale, lato coach): creare la tabella `app_settings` (SQL sopra), inserire la propria API key Claude tramite l'interfaccia Impostazioni dell'app, effettuare il deploy della function con la Supabase CLI (`supabase functions deploy claude-proxy`). Nessun secret aggiuntivo da configurare: la function usa la chiave service-role del progetto, già disponibile automaticamente nell'ambiente di ogni Edge Function Supabase.

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

*Da completare in Fase 1 (sezione dedicata a chiavi/segreti del nuovo setup Vite) e aggiornata man mano. Punti già stabiliti, da riportare qui per esteso quando la sezione sarà scritta:*
- *URL e anon key Supabase in variabili d'ambiente Vite (`.env`, non committato), centralizzate in `services/supabase.ts`.*
- *`app_settings.claude_api_key` e le chiavi Intervals.icu per-atleta restano salvate in chiaro nel database, con RLS disabilitata (nessuna autenticazione): rischio accettato per uso personale con link non condiviso, da rivedere se l'uso cambiasse (multi-coach, link condiviso pubblicamente).*

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

*Sezione popolata progressivamente. Le decisioni principali già prese (risposte alle [DECISIONE] bloccanti e scelte autonome di Fase 1) verranno riportate qui per esteso, con data, motivo e alternative scartate, entro la fine della Fase 1/inizio Fase 2.*

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

### Fase 5 — Modello dati e form
Identità divisa in `nome`/`cognome`/`email` (`schema_version` 1.4.0), con migrazione euristica in lettura e avviso al coach quando applicata. Nuova sezione "Connessione con app esterne" tra Identità e Discipline, con la chiave Intervals.icu spostata qui (componente `PasswordField` riutilizzabile) e rimossa dalla vecchia posizione in "Stato di allenamento". Sincronizzazione Intervals.icu resa interamente automatica (composable `useIntervalsSync`, tre trigger lato client con dedup/debounce) al posto del pulsante manuale, con un esito leggero di validità della chiave mostrato in UI. Etichette dei volumi in Discipline rese esplicitamente settimanali. Grafico del carico (`LoadMetricsChart`) ora mantiene sempre la propria struttura (zero-line, barre, curve CTL/ATL) anche senza dati, mostrando un messaggio di stato vuoto al posto dei soli assi.

### Fase 6 — Vista grafica del piano
Nuova trasformazione pura e testata `training_plan` → view-model (`planViewModel.ts`, 13 test Vitest sui casi di dati mancanti/malformati: step assenti, durate null, blocchi `repeat`, settimane vuote, date non valide). Nuovi componenti `PlanView.vue` (intestazione piano, controlli "Apri/Chiudi tutte", ancora alla settimana corrente), `PlanWeekBlock.vue` (settimana comprimibile, corrente aperta di default, badge "Scarico", riepilogo ore/km per disciplina) e `PlanSessionCard.vue` (icona disciplina, chip zona colorato, barra segmentata proporzionale alla durata per sessioni strutturate con testo "6 × (3' Z4 / 2' Z1)" per i blocchi `repeat`, lista testuale step come fallback accessibile, note pieghevoli). Stato di apertura/chiusura delle settimane spostato in un nuovo composable a stato di modulo (`usePlanWeeksUi`), fuori dal profilo atleta e dal confronto "modifiche non salvate". In `AthleteEditor.vue`, sia il piano salvato sia l'anteprima pre-conferma usano ora `PlanView` al posto del riepilogo testuale/JSON grezzo; l'editing JSON manuale resta disponibile dietro un toggle "avanzato" nell'anteprima, con avviso quando il JSON non è valido.

### Fase 7 — Impostazioni feedback e backend schedulato
Nuove colonne in `app_settings` (`weekly_feedback_day`, `weekly_feedback_time`, `weekly_feedback_timezone`, `weekly_feedback_email_enabled`), editabili dal coach in una nuova sezione "Feedback settimanale automatico" del pannello Impostazioni. Nuova Edge Function schedulata `supabase/functions/weekly-feedback/index.ts`, invocata ogni ora da `pg_cron` ma attiva solo nella finestra giorno/ora configurata (fuso orario esplicito via `Intl.DateTimeFormat`): per ogni atleta idoneo, sincronizza/confronta la settimana pianificata con quella reale da Intervals.icu, genera il feedback con Claude (stesso pattern di `claude-proxy`), lo salva in `weekly_feedback_log` con lo stesso controllo di concorrenza ottimistico del client, e — se l'invio email è attivo e l'atleta ha un indirizzo — lo invia tramite la nuova interfaccia `EmailSender` (`supabase/functions/_shared/emailSender.ts`) con implementazione Resend (`resendEmailSender.ts`, chiave come secret della function, mai nel DB). Idempotente (mai due feedback per la stessa settimana) ed errori isolati per atleta. Rimossi dall'editor atleta il confronto manuale e il pulsante "Rimuovi" per-voce: lo storico feedback è ora di sola lettura, con collasso oltre 5 voci.
