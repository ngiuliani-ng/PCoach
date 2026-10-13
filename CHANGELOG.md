# Changelog

**Quando leggerlo**: per sapere quando e perché è cambiato qualcosa, in quale versione, o per collegare un comportamento attuale alla versione e al commit che lo ha introdotto.

Ordine: più recente in cima. Versioni con [Semantic Versioning](https://semver.org/lang/it/) adattato a un'app senza API pubbliche: MAJOR se serve un'azione o si rompe la compatibilità di dati o flussi, MINOR per una funzione nuova o cambiata che il coach vede, PATCH per correzioni e testi ([decisioni/0036](docs/decisioni/0036-versione-dell-app-e-rilasci.md)).

- `## [Unreleased]` in cima raccoglie ciò che è nel codice ma non ancora rilasciato. Al rilascio diventa `## [X.Y.Z] — AAAA-MM-GG`, con la versione in `app/package.json` e in `supabase/functions/_shared/version.ts` e il tag `vX.Y.Z`.
- Categorie: **Aggiunto**, **Modificato**, **Corretto**, **Rimosso**, **Sicurezza** per ciò che il coach nota o che cambia i dati; **Interno** per test, refactoring, documentazione e dipendenze.
- Formato per voce: **cambiamento — motivazione — docs aggiornati**, in una riga che inizia con «- ».

---

## [Unreleased]

## [1.3.0] — 2026-10-13

Correzioni dell'audit UI/UX della 1.2.0 ([docs/audit/2026-10-ux-ui-1-2-0](docs/audit/2026-10-ux-ui-1-2-0/README.md), [decisioni/0039](docs/decisioni/0039-correzioni-dell-audit-ui-ux-1-2-0.md)): dialoghi di generazione affidabili dopo un ricaricamento, bozze che non si perdono con «Resta», errori che portano al campo, messaggi che restano il tempo di leggerli, tastiera e lettori di schermo su telefono e desktop, tema scuro leggibile. Tolto «Copia per una segnalazione».

### Modificato
- «Modifica i parametri» dopo una proposta di Claude, e «Indietro» con una risposta incollata, chiedono conferma («Scarta la proposta e modifica i parametri» / «Tieni la proposta») — la proposta si perdeva con un clic — decisione del coach D-01 ([audit A-07](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-07)) — docs: design-ui, sviluppo-deploy.
- I messaggi informativi restano a schermo in base alla lunghezza del testo (da 4 a 10 secondi), si fermano con il puntatore o il focus sopra e hanno il pulsante di chiusura — sparivano dopo 2,6 secondi anche se lunghi — decisione del coach D-02 ([audit A-08](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-08)) — docs: design-ui, sviluppo-deploy.

### Corretto
- «Prosegui il piano» e «Ripianifica», riaperti da un ricaricamento o da un link, partivano da domani invece che dopo il piano attivo e non tenevano più le sedute bloccate: ora aspettano che sedute e piano siano letti, e con una lettura non riuscita mostrano l'errore con «Riprova» e non preparano né applicano la proposta — i valori iniziali si calcolavano prima del caricamento ([audit A-01](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-01)) — docs: design-ui, sviluppo-deploy.
- Impostazioni con un modello di zone non valido: l'app non chiede più «Salvare?» prima di rifiutare il salvataggio; la sezione «Modelli di zone» si apre sulla misura con l'errore e, chiusa, dice «Un limite non è valido» — la conferma arrivava prima della validazione e l'errore restava nascosto ([audit A-14](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-14)) — docs: design-ui, sviluppo-deploy.
- «Settimane da generare» oltre il massimo è segnato sul campo e blocca «Genera la proposta», invece di essere ridotto in silenzio ([audit A-27](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-27)) — docs: design-ui.
- Salvare una scheda senza nome apre Identità, porta il focus su «Nome» e mostra l'errore sotto il campo — c'era solo un toast, con la sezione chiusa ([audit A-06](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-06)) — docs: design-ui, sviluppo-deploy.
- Login: senza rete il messaggio è «Server di accesso non raggiungibile» e non più «Credenziali non valide.»; dopo un errore il focus torna sulla password ([audit A-15](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-15)) — docs: sicurezza, sviluppo-deploy.
- Feedback di un atleta senza email: la nota su cosa succede approvando sta prima di «Approva», e «Aggiungi l'indirizzo nel Profilo» è un link che apre Identità, anche nella riga «Email non inviata» ([audit A-18](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-18)) — docs: design-ui, sviluppo-deploy.
- Bozza di un nuovo atleta: scegliendo «Resta» all'uscita (o con «Salva e continua» rifiutato, o con «indietro» del browser) quanto scritto restava perso e la pagina bloccata su «Caricamento…»; ora la bozza resta intatta — la chiusura della bozza scattava anche sulle navigazioni annullate ([audit A-28](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-28)) — docs: architettura, sviluppo-deploy.
- Gli errori delle azioni su Intervals.icu dalla tab Anomalie, «Salva o annulla prima le modifiche della scheda.» e «Copia non riuscita» del prompt sono errori che restano, non messaggi che spariscono; il salvataggio non riuscito del testo del feedback non mostra più il messaggio tecnico del server ([audit A-19](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-19)) — docs: design-ui, sviluppo-deploy.
- Barra laterale su telefono (e con lo zoom al 200%): chiusa non si raggiunge più con il Tab né la legge un lettore di schermo, aperta tiene il focus fino alla chiusura, e chiusa non lascia l'ombra sul bordo sinistro — il Tab passava per sette comandi fuori schermo ([audit A-02, A-12, A-13](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-02)) — docs: design-ui, sviluppo-deploy.
- Navigando con la tastiera, un campo che riceve il focus non finisce più dietro l'intestazione fissa della pagina — andando indietro con Shift+Tab caselle e campi restavano coperti ([audit A-03](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-03)) — docs: design-ui, sviluppo-deploy.
- Tema scuro: il segnaposto dei campi («predefinito: N») è leggibile (da 3,55:1 a 6,2:1) e date, menu e caselle native seguono il tema invece di restare chiari, con l'icona del calendario che si vedeva appena ([audit A-05](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-05)) — docs: design-ui, sviluppo-deploy.
- Titoli delle pagine senza salti di livello (sezioni, dialoghi e storico erano `h3` e `h4` sotto l'`h1`) e titolo della scheda del browser che dice dove si è, per esempio «Piano – Giulia Ferri – PCoach» invece di sempre «PCoach»; nessun cambio visivo ([audit A-10, A-11](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-10)) — docs: design-ui, sviluppo-deploy.

### Rimosso
- «Copia per una segnalazione» in Impostazioni › Informazioni: restano versione, build e versione del server — decisione del coach — docs: design-ui, sviluppo-deploy, decisioni/0036.

### Interno
- Controllo automatico di accessibilità negli e2e con axe-core (`@axe-core/playwright` 4.13.0, dipendenza di sviluppo): regole WCAG A e AA su 14 schermate nei due temi; nessuna violazione oggi. Non è una prova di conformità WCAG — decisione del coach D-03 ([audit](docs/audit/2026-10-ux-ui-1-2-0/README.md#h-stato-delle-correzioni)) — docs: sviluppo-deploy, design-ui.
- Documentazione allineata al codice: tre frasi di design-ui e architettura non più vere (numero delle anomalie, etichetta «Modifiche non salvate» su telefono, numeri accanto agli atleti); nuova [decisioni/0039](docs/decisioni/0039-correzioni-dell-audit-ui-ux-1-2-0.md) con le decisioni e le regole emerse dall'audit ([audit A-22](docs/audit/2026-10-ux-ui-1-2-0/README.md#a-22)) — docs: design-ui, architettura, decisioni/0039.

## [1.2.0] — 2026-10-13

Feedback settimanale rivisto dopo la verifica UI/UX ([docs/audit/2026-10-feedback-settimanale-ui](docs/audit/2026-10-feedback-settimanale-ui/README.md)): il testo corretto si salva da solo e non si perde più. Stato del salvataggio come sola nuvola colorata; versione tolta dalla barra laterale.

### Aggiunto
- Il testo del feedback che correggi si salva da solo, sul server, un secondo dopo l'ultima battuta: la nuvola è rossa finché non è salvato, e uscendo dalla scheda con un salvataggio non riuscito l'app chiede cosa fare — le correzioni si perdevano uscendo dalla scheda (audit FB-02) — docs: modello-dati, backend, design-ui, architettura, decisioni/0038.

### Modificato
- «Rigenera» con il testo corretto chiede conferma; se la rigenerazione non riesce, le correzioni restano — prima sparivano senza avviso (audit FB-01) — docs: design-ui, decisioni/0038.
- Il lunedì non sostituisce più una bozza anticipata di cui hai corretto il testo: decidi tu con «Rigenera» — docs: backend, architettura, decisioni/0038.
- Feedback settimanale più compatto: le settimane già chiuse sono una riga che si apre con un clic, con l'email non partita e «Riprova l'invio» sempre visibili; il campo del testo cresce con il contenuto; «Invia anche questa versione» sta sopra «Approva»; conteggi in una frase, «Limiti dei dati:» e «Sintesi per te:» — la sezione passa da 2,2 a 1,3 schermi a 1440 px e da 2,8 a 1,6 a 390 px (audit FB-04…FB-09) — docs: design-ui, decisioni/0038.
- Lo stato del salvataggio è solo una nuvola colorata, senza testo né data: verde se salvato, rossa con modifiche, grigia e barrata per una bozza mai salvata; c'è anche nelle Impostazioni; su telefono «Salva impostazioni» e «Salva il profilo» diventano «Salva», così il titolo non si taglia — richiesta del coach — docs: design-ui, architettura.

### Corretto
- «Prepara il feedback» propone solo le settimane che non ne hanno ancora uno e non risponde più «Valutazione in corso» per una settimana già approvata; la guida non suggerisce più di usarlo per rivalutare una settimana; il selettore compare solo a feedback caricati (audit FB-03) — docs: design-ui, backend.

### Rimosso
- «Versione X.Y.Z» in fondo alla barra laterale: la versione resta in Impostazioni › Informazioni — richiesta del coach — docs: design-ui, architettura, sviluppo-deploy, decisioni/0036.

### Interno
- Feedback diviso in `WeeklyReviews.vue` (elenco) e `FeedbackWeek.vue` (settimana); conteggi in `domain/feedbackText.ts`; e2e `feedback-ui.spec.ts`; il backend finto gestisce «Rigenera» e «Prepara il feedback»; i test della nuvola distinguono `saved` da `unsaved` — docs: architettura, sviluppo-deploy.

## [1.1.0] — 2026-10-13

Rifiniture dopo la 1.0.0: richieste del coach e i quattro punti P3 dell'audit UI/UX completo (UX-05, UX-25, UX-35, UX-55).

### Modificato
- Il contatore «Da fare» nella barra laterale è sempre un quadrato della stessa misura, grigio o giallo: il giallo prendeva lo stile del riquadro d'avviso del Piano e cambiava forma — richiesta del coach — docs: design-ui.
- La pagina «Da fare» non dice più a che ora sono state controllate chiave, zone e soglie — richiesta del coach — docs: design-ui, decisioni/0037.
- Editor della struttura: etichette visibili sopra i campi (sul primo step di ogni gruppo, su ogni step da telefono) e zona singola, con «+ Intervallo» per un intervallo di zone — «fino a…» non si capiva (audit UX-25) — docs: design-ui, architettura.
- Il numero sulla tab «Anomalie» ha la stessa forma quadrata del contatore «Da fare» — un solo aspetto per i numeri d'anomalia — docs: design-ui.
- Sotto il nome dell'atleta, su telefono, solo il prossimo evento; accanto a «Salva», in ogni vista e anche su telefono, una nuvola dice se la scheda è salvata (con la data, al posto di «Aggiornata il»), ha modifiche non salvate o è una bozza mai salvata — su telefono la riga occupava tre righe sopra le tab e la data si leggeva come aggiornamento del carico (audit UX-05) — docs: design-ui.

### Rimosso
- Novità della versione in Impostazioni › Informazioni: l'utente non le deve leggere — decisione del coach — docs: design-ui, architettura, sviluppo-deploy, decisioni/0036.

### Corretto
- Il riepilogo giallo di una sezione chiusa (per esempio «Manca l'email») prendeva il bordo e lo sfondo del riquadro d'avviso del Piano; ora cambia solo il colore del testo.
- Rilevazioni delle soglie: i selettori «Fonte» e «Tipo test» non tagliano più «Intervals.icu (sync)», «Time trial in campo» e «Nessun test (stima)» (audit UX-35) — docs: design-ui.

### Interno
- Il Profilo è diviso in una componente per sezione (`Profile*.vue`); `AthleteEditor.vue` passa da 749 a 419 righe e tiene ordine, riepiloghi e stato condiviso (audit UX-55) — docs: architettura.

## [1.0.0] — 2026-10-13

Prima versione numerata: corrisponde al commit con cui viene pubblicata e comprende tutto ciò che è elencato sotto «Prima del versionamento». Le voci di questa sezione sono l'audit UI/UX completo di ottobre 2026 ([docs/audit/2026-10-ux-ui-completo](docs/audit/2026-10-ux-ui-completo/README.md)).

### Aggiunto
- Pagina iniziale «Da fare»: per ogni atleta feedback da approvare o fermi, email e soglie mancanti, sedute da verificare, invii non riusciti e bozze delle prossime due settimane, con il link al punto esatto; si torna alla pagina dalla voce «Da fare» in cima alla barra laterale, con un contatore globale grigio se ci sono solo cose da approvare e giallo se c'è almeno un'anomalia — prima bisognava aprire ogni atleta — docs: design-ui, decisioni/0035.
- Profilo e Impostazioni a sezioni comprimibili con riepilogo e indice, tutte chiuse all'arrivo; nelle Impostazioni i parametri che cambiano i calcoli per tutti gli atleti sono in «Avanzate» — pagine lunghe fino a 14 schermi su telefono — docs: design-ui, decisioni/0035.
- Guida per ogni gruppo di dati, aperta dall'icona Info: i testi d'aiuto non stanno più sotto i campi — decisione del coach, sul modello di Garmin Connect — docs: design-ui, decisioni/0035.
- Controllo automatico ogni 30 minuti di chiave, zone e soglie su Intervals.icu per tutti gli atleti, con il risultato nella pagina «Da fare», e aggiornamento del carico (fitness, fatica, forma) senza aprire la scheda — richiesta del coach — docs: backend, modello-dati, integrazioni, sicurezza, limiti-roadmap, decisioni/0037.
- Versione dell'app in fondo alla barra laterale e in Impostazioni › Informazioni, con build, versione del server, novità e «Copia per una segnalazione» — la versione non era identificabile — docs: sviluppo-deploy, design-ui, decisioni/0036.
- Anomalia «Manca l'email dell'atleta» quando l'invio via email è attivo; la scheda si salva anche senza — decisione del coach — docs: design-ui, decisioni/0034.

### Modificato
- Tab Anomalie: un solo elenco, prima ciò che è fallito, ognuno con la riga «Ferma: …» — i gruppi non aiutavano a scegliere cosa fare prima — docs: design-ui, decisioni/0034.
- Nomi degli stati: «Bozza» al posto di «Da revisionare», «Da approvare» per il feedback, «Versione N» al posto di «Revisione N»; nelle righe delle sedute solo gli stati da sistemare — nomi quasi uguali per cose diverse — docs: design-ui.
- Storico del piano: un selettore «Sedute» al posto dei dodici filtri a chip — docs: design-ui.
- Con un feedback da approvare la Panoramica parte dal feedback; «Prepara il feedback» va in fondo; un clic su una seduta della settimana apre il suo pannello — docs: design-ui.
- Valori predefiniti scritti «predefinito: N» nei campi vuoti; fasce d'intensità in tabella; salvare modelli di zone cambiati chiede conferma; i ripristini chiedono conferma se ci sono valori personalizzati — docs: design-ui.
- Le regole tecniche sul formato degli step passano dalle preferenze di generazione alle istruzioni fisse; prompt 2.5.0 — le preferenze del coach restano in italiano semplice — docs: architettura.
- Eliminazione dell'atleta solo da Profilo › Gestione scheda — la «X» nella barra laterale stava accanto alla navigazione — docs: design-ui.

### Corretto
- Testi d'aiuto non più veri: soglie (una soglia diversa ferma feedback e invio), modelli di zone (stimano anche la durata delle sedute a distanza), chiave Claude, «Prosegui il piano»; la nota del feedback per un atleta senza email — docs: design-ui.
- A 320 px la barra delle tab non scorre più in orizzontale; etichette del grafico del carico a 12 px anche su telefono; titolo della pagina in `h1`; «Sincronizza settimana» nascosto in una settimana senza sedute.

### Interno
- Test sulle etichette citate nei testi d'aiuto, sul glossario degli stati, sulla coerenza della versione fra app, server e CHANGELOG; backend finto degli e2e con la consegna del feedback come il server.
- Tabella `athlete_checks` e job `athlete-checks-30min` (migrazione 0013), Edge Function `athlete-checks`; unione del carico in `_shared/workouts/loadMetrics.ts`.
- `version.json` nella build; intestazione `x-pcoach-version` nelle Edge Function; pubblicazione su GitHub Pages solo dai tag `v*`.

## Prima del versionamento

Voci datate fino al 13 ottobre 2026 (commit `1a98ab3`), nel formato precedente: **data — cambiamento — motivazione — docs aggiornati**.

**2026-10-13 — Zone e soglie bloccano anche l'invio; anomalie senza richiamo sopra le tab**
- Zone diverse, soglie diverse o soglia mancante fermano anche l'invio delle sedute a Intervals.icu: in «Sincronizza settimana» creazioni e aggiornamenti risultano bloccati con il motivo, e `apply` ricontrolla lato server. Le rimozioni restano possibili.
- Tolta la riga di richiamo sopra le tab: resta il numero accanto a «Anomalie». Nuovo gruppo «Fermano il feedback e l'invio a Intervals.icu».
- Motivazione: sedute inviate con zone o soglie diverse arrivano all'atleta diverse da come sono state pensate; il richiamo ripeteva il numero della tab.
- Test: 196 unitari, 60 end-to-end.
- Docs: decisioni/0033 (nuova), decisioni/0031 (stato), design-ui, integrazioni, backend.

**2026-10-13 — Indicazioni separate nel testo per Intervals.icu, verifica di ritorno, rinvio quando cambia la conversione**
- Il testo inviato chiude ogni indicazione con `<!>`: «1000m @ ritmo gara 5K» non diventa più una durata di 1000 minuti. Verificato su un account di prova.
- Dopo ogni invio la struttura letta da Intervals.icu si confronta step per step con quella della seduta, con un avviso sullo scostamento.
- Nuova colonna `workout_sync.synced_hash` (migrazione 0012): una seduta torna «Da aggiornare» se ciò che PCoach invierebbe oggi è diverso da ciò che ha inviato. Al rilascio tornano da aggiornare solo le 11 sedute già inviate con numeri in un'indicazione; le altre ricevono l'impronta del nuovo formato.
- Preferenze di generazione: ripetute di corsa e nuoto di solito a distanza, bici a tempo, allunghi di circa 100 m; il cue non ripete durata o distanza. `PLAN_PROMPT_VERSION` 2.4.0.
- Motivazione: sedute di corsa con durate assurde su Intervals.icu, perché la distanza scritta nell'indicazione veniva letta come durata, senza alcun avviso.
- Test: 193 unitari, 58 end-to-end.
- Docs: decisioni/0032 (nuova), integrazioni, modello-dati, architettura.

**2026-10-12 — Tab «Anomalie» della scheda atleta**
- Nuova tab «Anomalie», con il conteggio nell'etichetta. Raggruppa le anomalie per ciò che fermano: il feedback settimanale (zone o soglie diverse da Intervals.icu, soglia mancante, feedback non preparato o non inviato) o l'invio a Intervals.icu (chiave non valida, sedute da verificare, invii non riusciti). Ogni anomalia ha la sua azione. Sopra le tab, una riga di richiamo con «Vedi le anomalie» sostituisce gli avvisi separati di zone e soglie (`ZoneAlignBanner.vue` rimosso, logica in `useAthleteAnomalies.ts`).
- Motivazione: gli avvisi in cima alla scheda stavano diventando troppi; il coach ha chiesto di raggrupparli per atleta.
- Test: 186 unitari, 58 end-to-end.
- Docs: decisioni/0031 (nuova), design-ui (tab Anomalie, richiamo), integrazioni, decisioni/0030.

**2026-10-12 — Durata degli step a distanza dalla soglia; soglie allineate con Intervals.icu**
- La durata degli step a distanza di corsa e nuoto si stima dal passo della zona, a partire dall'ultima soglia della scheda (passo di soglia, CSS) e dal modello di zone, come Intervals.icu. Le zone intermedie valgono il loro centro, Z1 il limite superiore, l'ultima zona quello inferiore. Prima si usava una velocità fissa (5:30/km, 2:00/100 m), che resta solo senza soglia e per la bici. La nuova stima vale per totali, barra, durata massima del giorno, controlli della generazione, prompt, abbinamento delle attività e feedback (`ANALYSIS_VERSION` 1.2.0).
- La scheda confronta passo di soglia, CSS e FTP con Intervals.icu (tolleranza 1 s/km, 1 s/100 m, 1 W) e propone «Aggiorna Intervals.icu» (azione `threshold_apply` di `intervals-sync`). Il feedback settimanale si ferma con soglie diverse o mancanti. «Soglia mancante» per corsa e nuoto praticati senza soglia.
- Motivazione: con ripetute a distanza veloci la stima fissa era troppo lunga (8×800 m a 4:00/km di soglia: 67' invece di circa 56') e segnava per errore le sedute «Da verificare» per la durata massima del giorno.
- Test: 186 unitari, 56 end-to-end.
- Docs: decisioni/0030 (nuova), integrazioni, backend, design-ui, limiti-roadmap.

**2026-10-12 — «Segna verificata» per le sedute già approvate «Da verificare»**
- Il pannello di una seduta già approvata con un avviso («Da verificare») mostra «Segna verificata» (o «Salva e segna verificata»). Il vincolo viene ricalcolato: se è ancora violato chiede conferma, altrimenti chiude l'avviso.
- Motivazione: il pulsante di approvazione esisteva solo per le bozze. Una seduta approvata, modificata e finita oltre la durata massima del giorno restava bloccata in «Da verificare», e quindi non si poteva più inviare a Intervals.icu.
- Test: 174 unitari, 52 end-to-end.
- Docs: design-ui (piede del pannello), modello-dati (`needs_review`).

**2026-10-12 — Feedback solo con zone allineate; sedute da verificare dopo un cambio di zone**
- Il feedback settimanale controlla le zone su Intervals.icu prima dell'analisi. Se non coincidono con la scheda si ferma («Zone non allineate con Intervals.icu…») e riparte con «Riprova».
- Cambiare il sistema di zone con un piano in corso chiede conferma. Se il coach procede, le sedute da svolgere della disciplina, da oggi compreso, tornano «Da verificare» con il motivo. Vale per ogni salvataggio della scheda: Profilo, uscita, «Salva e genera», «Usa N zone in PCoach».
- Test: 174 unitari, 50 end-to-end.

*Motivazione*: richiesta del coach: il feedback deve partire solo con i sistemi allineati, e le sedute pianificate con il vecchio sistema vanno ricontrollate a mano.
*Docs aggiornati*: [decisioni/0029](docs/decisioni/0029-zone-allineate-con-intervals.md), [backend.md](docs/backend.md), [integrazioni.md](docs/integrazioni.md), [modello-dati.md](docs/modello-dati.md), [limiti-roadmap.md](docs/limiti-roadmap.md).

**2026-10-12 — Zone allineate fra PCoach e Intervals.icu**
- All'apertura della scheda PCoach legge le zone dell'atleta su Intervals.icu. Se il numero di zone non coincide con la scheda, mostra un avviso con due scelte, entrambe con conferma: «Usa N zone in PCoach» oppure «Porta Intervals.icu a N zone».
- Nuova sezione «Zone su Intervals.icu» in Impostazioni: per potenza e FC della bici, passo di corsa e di nuoto, e per 3, 5 e 7 zone, un preset dalla letteratura (Coggan, Friel, Seiler) o limiti propri. I predefiniti sono i modelli più usati.
- `intervals-sync`: azioni `zones_read` e `zones_apply`. Migrazione `0011` (`app_settings.zone_models`).
- Test: 170 unitari, 48 end-to-end.

*Motivazione*: richiesta del coach di verificare, con la chiave di ogni atleta, che PCoach e Intervals.icu usino le stesse zone.
*Docs aggiornati*: [decisioni/0029](docs/decisioni/0029-zone-allineate-con-intervals.md), [integrazioni.md](docs/integrazioni.md), [backend.md](docs/backend.md), [architettura.md](docs/architettura.md), [modello-dati.md](docs/modello-dati.md), [sicurezza.md](docs/sicurezza.md), [limiti-roadmap.md](docs/limiti-roadmap.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-12 — Domini d'intensità del feedback per sistema di zone**
- `feedback_params` ha una coppia di soglie (intensità bassa e media) per ciascun sistema di zone: 3 zone Z1/Z2, 5 zone Z2/Z3, 7 zone Z2/Z4. Si modificano in Impostazioni, nel riquadro «Intensità bassa, media e alta per sistema di zone».
- L'analisi usa la coppia del sistema dell'atleta per disciplina, sia per la distribuzione dell'intensità sia per riconoscere le sedute di qualità; il contratto salva i domini usati. `ANALYSIS_VERSION` 1.1.0.
- Le soglie salvate prima valgono come quelle a 7 zone: per gli atleti attuali, tutti a 7 zone, il feedback non cambia.
- Nel Profilo il nuoto mostra «Sistema di zone: 7 zone» come campo non modificabile.
- Test: 157 unitari, 40 end-to-end.

*Motivazione*: decisione del coach di rendere le soglie modulari per atleta; con 3 zone la Z3 contava come intensità media.
*Docs aggiornati*: [decisioni/0028](docs/decisioni/0028-domini-d-intensita-per-sistema-di-zone.md), [integrazioni.md](docs/integrazioni.md), [backend.md](docs/backend.md), [modello-dati.md](docs/modello-dati.md), [limiti-roadmap.md](docs/limiti-roadmap.md), [design-ui.md](docs/design-ui.md).

**2026-10-12 — Job del feedback versionato, attesa della risposta a 150 s**
- Il job `weekly-feedback-hourly` è ora definito in una migrazione (`0010`) e aspetta la risposta della funzione fino a 150 s invece di 5.

*Motivazione*: al primo feedback reale (lunedì 12 ottobre, circa 35 s di lavoro, riuscito) la risposta risultava «Timeout of 5000 ms» in `net._http_response`, e l'esito del lunedì non era leggibile dal database.
*Docs aggiornati*: [backend.md](docs/backend.md), [architettura.md](docs/architettura.md).

**2026-10-11 — Contrasti, conferme e rifiniture**
- Testo d'avviso del tema chiaro più scuro (`--warning` `#8A5E00`, 5:1 sul suo sfondo) e nuovo token `--border-control` per i bordi dei campi (almeno 3:1); un test verifica i contrasti dei due temi.
- Le conferme non distruttive («Approva comunque», «Rigenera») hanno il pulsante primario, non rosso.
- Nella scheda, fuori dal Profilo, «Salva il profilo» compare solo con modifiche da salvare.
- Editor della struttura: «Sposta giù» anche dentro le ripetute. Generazione manuale: «Copia il prompt», e «Indietro» scarta la richiesta. Ripristinare le preferenze personalizzate chiede conferma.
- Test: 153 unitari, 38 end-to-end.

*Motivazione*: problemi U-12, U-16, U-21, U-25, U-26, U-31 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Aiuti contestuali dei campi tecnici**
- Nuovo componente `FieldHelp`: una riga d'aiuto sempre visibile e, se serve, «Come lo usa PCoach». Usato in Profilo (identità ed email, chiave Intervals.icu, volumi, soglie e sistema di zone, fattori di vita, periodizzazione, eventi, disponibilità, sedute a settimana, metodologia, note libere), Impostazioni (preferenze del piano, soglie del feedback con un esempio) e nel pannello della seduta (metrica dei target).
- I testi vivono in `help/fieldHelp.ts`; un test verifica che i dati dichiarati inviati a Claude siano nel contesto del prompt e quelli dichiarati riservati no.
- Test: 149 unitari, 38 end-to-end.

*Motivazione*: §7-§8 e problema U-13 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [decisioni/0027](docs/decisioni/0027-aiuti-contestuali-dei-campi.md), [design-ui.md](docs/design-ui.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Misure per il tocco e orientamento libero della PWA**
- Su telefono e tablet (`pointer: coarse`) i campi hanno il testo a 16px, per evitare lo zoom di iOS al tocco, e pulsanti, campi, tab, chip e voci dell'elenco sono alti almeno 44px.
- Su schermi stretti «Prosegui il piano» e «Ripianifica da…» stanno affiancati nella barra del Piano.
- La PWA installata non è più bloccata in verticale.
- Test: 147 unitari, 38 end-to-end; misure verificate con emulazione touch a 320, 375, 430 e 768 px.

*Motivazione*: decisione D-UX-6 del coach e problemi U-15, U-20, U-22, U-23 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [decisioni/0026](docs/decisioni/0026-touch-e-orientamento-pwa.md), [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Sistema di zone dell'atleta effettivo, dati personali ridotti verso Claude**
- Il sistema di zone di corsa e bici (3, 5 o 7) entra nel prompt (`zone_per_disciplina`, con una regola fissa), nei controlli della proposta (sedute oltre il limite da verificare), nell'editor della struttura (solo quelle zone) e nel ricontrollo al salvataggio della seduta. Il nuoto usa 7 zone.
- A Claude vanno solo il nome di battesimo e l'età, non più cognome e anno di nascita (prompt 2.3.0).
- Test: 147 unitari, 38 end-to-end.

*Motivazione*: decisioni D-UX-3 e D-UX-7 del coach e problemi U-10, U-13 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [decisioni/0025](docs/decisioni/0025-sistema-di-zone-e-dati-personali-a-claude.md), [integrazioni.md](docs/integrazioni.md), [modello-dati.md](docs/modello-dati.md), [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md); corretta la §15 dell'audit.

**2026-10-11 — Interfaccia coerente con i dati usati**
- Schema di carico e scarico con due selettori (settimane di carico 1-8, di scarico 1-4); un valore salvato non riconosciuto è segnalato nel Profilo e prima di generare.
- La generazione usa la scheda salvata: con modifiche non salvate chiede «Salva e genera» o «Genera con i dati salvati».
- Fuso orario scelto da un elenco. Il feedback automatico ripiega su `Europe/Rome` se il fuso salvato non è valido, invece di fermarsi.
- «Genera la proposta» non accetta un secondo clic; gli avvisi della proposta sono in un riquadro con il conteggio.
- Feedback: per un atleta senza email il pulsante dice «Approva» con una nota; le valutazioni in preparazione si aggiornano da sole.
- Badge e filtro «Da verificare» al posto di «Struttura da verificare», che indicava anche i vincoli di disponibilità.
- Test: 145 unitari, 36 end-to-end.

*Motivazione*: decisioni D-UX-2 e D-UX-4 del coach e problemi U-03, U-04, U-05, U-06, U-09, U-11, U-17, U-18 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [decisioni/0024](docs/decisioni/0024-interfaccia-coerente-con-i-dati-usati.md), [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md), [modello-dati.md](docs/modello-dati.md), [backend.md](docs/backend.md), [integrazioni.md](docs/integrazioni.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Navigazione con vue-router, modifiche non salvate protette, salvataggi falliti visibili**
- Atleta, vista della scheda, Impostazioni, pannello della seduta e dialoghi del piano stanno nell'URL (`vue-router`, cronologia a hash). Ricaricare o riaprire la PWA riporta alla stessa vista; «indietro» chiude pannelli e dialoghi.
- Lasciare una scheda o le Impostazioni con modifiche non salvate, o premere «Esci», chiede «Salva e continua», «Esci senza salvare» o «Resta». Alla chiusura della pagina compare l'avviso del browser.
- Dalle Impostazioni il clic sull'atleta già aperto torna alla sua scheda.
- Un salvataggio fallito della scheda dice «Scheda non salvata» e lascia la scheda modificata con «Salva» attivo; un atleta nuovo riceve l'id solo a salvataggio riuscito. Una scheda si elimina in locale solo dopo il database.
- Un errore di rete al salvataggio di una seduta lascia il pannello aperto con le modifiche; il toast d'errore sale sopra il piede di pannelli e dialoghi.
- Le Impostazioni mostrano «Modifiche non salvate»; il dialogo di conferma accetta più scelte e un pulsante non distruttivo.
- Test: 143 unitari, 22 end-to-end.

*Motivazione*: decisioni D-UX-1 e D-UX-5 del coach e problemi U-01, U-02, U-07, U-14, U-19 dell'[audit UI/UX](docs/audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md).
*Docs aggiornati*: [decisioni/0023](docs/decisioni/0023-navigazione-router-modifiche-non-salvate.md), [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Gare e tapering calcolati da PCoach, controlli sulla proposta**
- Ogni evento target ha le settimane di tapering (predefinite per priorità: A 2, B 1, C 0) e, facoltativo, il calo del volume. PCoach calcola le fasi «tapering» e «gara», sospende il ciclo e, dopo una gara A, lo fa ripartire da «carico 1»; il calendario indica il giorno della gara (prompt 2.2.0).
- La proposta mostra avvisi per le settimane con un numero di sedute diverso da quello dell'atleta o con una variazione di volume fuori dalla fase.
- Le sedute con struttura incompleta arrivano «da verificare»; nel pannello, salvare ricontrolla disponibilità e durata e approvare nonostante un vincolo chiede conferma.
- Test: 143 unitari, 8 end-to-end.

*Motivazione*: decisioni D-02 e D-03 del coach e problemi E-12, E-13, E-15 dell'[audit](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).
*Docs aggiornati*: [decisioni/0022](docs/decisioni/0022-gare-tapering-controlli-proposta.md), [integrazioni.md](docs/integrazioni.md), [modello-dati.md](docs/modello-dati.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Esito e RPE sulle sedute svolte, analisi settimanali nella generazione**
- Una seduta riconosciuta come svolta salva esito, rapporto svolto/prescritto e dati dell'attività (minuti, metri, carico, RPE); sotto la soglia di completamento è «Svolta in parte», con un filtro nello storico (migrazione `0009`).
- All'apertura della scheda i dati delle sedute già svolte negli ultimi 14 giorni si rileggono: un RPE inserito più tardi arriva in PCoach.
- L'anteprima di «Sincronizza settimana» usa la stessa regola di abbinamento dell'apertura della scheda e del feedback.
- La generazione riceve esito, minuti svolti e RPE delle sedute approvate recenti (non più le bozze) e un riepilogo calcolato delle ultime due analisi settimanali, anche non approvate (prompt 2.1.0).
- Corretto in `claude-proxy` il separatore fra i blocchi di testo della risposta, rotto dalla modifica precedente e mai pubblicato.
- Test: 135 unitari, 8 end-to-end.

*Motivazione*: decisioni D-09 e D-10 del coach e problemi E-21, E-26 dell'[audit](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).
*Docs aggiornati*: [decisioni/0021](docs/decisioni/0021-esito-rpe-sedute-feedback-nel-piano.md), [modello-dati.md](docs/modello-dati.md), [integrazioni.md](docs/integrazioni.md), [backend.md](docs/backend.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Feedback: sempre il lunedì, valutazione anticipata sostituita, reinvio a scelta**
- Il feedback automatico parte sempre il lunedì per la settimana appena conclusa; in Impostazioni si sceglie solo l'ora.
- Una valutazione preparata durante la settimana e non ancora approvata viene sostituita da quella del lunedì (nuova revisione).
- «Rigenera» su un feedback già inviato chiede conferma; all'approvazione della nuova versione il coach sceglie se inviarla (azione `approve` con `send`).
- Test: 132 unitari, 8 end-to-end.

*Motivazione*: decisioni D-07, D-08 e D-11 del coach e problemi E-10, E-11, E-25 dell'[audit](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).
*Docs aggiornati*: [decisioni/0019](docs/decisioni/0019-feedback-analisi-deterministica-approvazione.md), [backend.md](docs/backend.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Generazione: regole nel codice, preferenze del coach, prompt salvato e modelli ammessi**
- Il prompt della generazione è diviso in istruzioni di sistema (regole fisse e formato nel codice, poi le preferenze metodologiche del coach) e messaggio con i dati dell'atleta, il calendario, il motivo e le sedute fisse, sempre presenti. In Impostazioni si modificano solo le preferenze, con un pulsante per ripristinarle.
- Preferenze e tono del feedback uguali al predefinito si salvano vuoti; il salvataggio delle impostazioni è bloccato se il caricamento non è riuscito.
- Ogni generazione salva il prompt inviato, la versione, `max_tokens`, il modello effettivo, `stop_reason` e i token (migrazione `0008`).
- Modello scelto da un elenco chiuso (`_shared/claude/models.ts`), applicato anche da `claude-proxy` e `weekly-feedback`.
- L'app non rilegge più la chiave di Claude; `claude-proxy` accetta solo il coach e limita `max_tokens`. `apply_plan_generation` rifiuta una data di partenza passata.
- «Attività abituale»: preferenza per Claude, non vincolo (schema e prompt allineati).
- Test: 129 unitari, 8 end-to-end.

*Motivazione*: decisioni D-01, D-04 e D-06 del coach e problemi E-01, E-02, E-03, E-04, E-06, E-18 dell'[audit](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).
*Docs aggiornati*: [decisioni/0020](docs/decisioni/0020-generazione-istruzioni-separate-tracciabilita.md), [integrazioni.md](docs/integrazioni.md), [backend.md](docs/backend.md), [modello-dati.md](docs/modello-dati.md), [sicurezza.md](docs/sicurezza.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Correzioni puntuali dall'audit della generazione e del feedback**
- Feedback: il controllo dei giorni della settimana nel testo usa l'anno giusto anche nelle settimane a cavallo d'anno (prima «venerdì 1 gennaio 2027» risultava sbagliato).
- Generazione: l'email dell'atleta non è più inviata a Claude; i segnaposto scritti nei dati dell'atleta restano testo; il JSON si legge anche con testo intorno senza blocco di codice.
- Una proposta salvata che parte da una data passata non si riprende più: viene scartata con un avviso. Le richieste senza risposta da oltre 30 minuti si chiudono come fallite.
- La pubblicazione su GitHub Pages esegue prima i test unitari. Test: 127.

*Motivazione*: problemi E-05, E-07 (decisione D-05), E-09, E-16, E-17, E-19 ed E-22 dell'[audit](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Audit della generazione dei piani e del feedback settimanale**
- Nuovo documento `docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md`: flussi effettivi, chiamate a Claude, payload e provenienza dei dati, prompt e configurazioni, rischi di modifica, dominio, test, problemi verificati, decisioni del coach (D-01…D-11) e piano di intervento. Verifiche in sola lettura sul database di produzione. Nessuna modifica al codice o ai dati.

*Motivazione*: sapere con esattezza cosa riceve Claude e dove una modifica può rompere la generazione o il feedback, prima di intervenire. Fra i problemi: prompt della generazione non salvato, template che può togliere a Claude il profilo dell'atleta, feedback incompatibile con i modelli più recenti, proposte riprese con data passata, validazione dei giorni errata a cavallo d'anno.
*Docs aggiornati*: [docs/audit/2026-10-generazione-e-feedback/](docs/audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md).

**2026-10-11 — Sedute svolte riconosciute all'apertura della scheda**
- Aprendo un atleta, l'app legge da Intervals.icu le attività degli ultimi 14 giorni e segna come svolte le sedute approvate abbinate con certezza: evento abbinato su Intervals.icu, oppure stesso giorno e stessa disciplina con una sola coppia possibile.
- La regola è unica (`_shared/feedback/completion.ts`) e vale anche per l'analisi del feedback (`weekly-feedback` versione 17).
- Test: 120 unitari.

*Motivazione*: prima una seduta risultava svolta solo aprendo «Sincronizza settimana» o con l'analisi del lunedì; nel frattempo appariva «Non registrata».
*Docs aggiornati*: [decisioni/0019](docs/decisioni/0019-feedback-analisi-deterministica-approvazione.md), [modello-dati.md](docs/modello-dati.md), [integrazioni.md](docs/integrazioni.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-11 — Feedback settimanale: analisi deterministica, valutazioni con stati e approvazione del coach**
- **Analisi in PCoach** (`supabase/functions/_shared/feedback/`):
  - periodo da lunedì a domenica;
  - solo sedute approvate;
  - attività normalizzate: disciplina, dati non disponibili via API, doppioni;
  - abbinamento a regole con confidenza: evento abbinato su Intervals.icu, stesso giorno, ordine, seduta frazionata, spostamento, sostituzione;
  - esiti «non registrata» e «dato non disponibile» al posto di «non svolta»;
  - metriche con numeratori e denominatori, distribuzione dell'intensità nella stessa metrica, confronto con la settimana precedente solo se significativo;
  - RPE, HRV, frequenza a riposo e sonno con la loro copertura;
  - anomalie e limitazioni.
- **Claude scrive soltanto**:
  - riceve il contratto calcolato e risponde con uno strumento a schema fisso;
  - gli argomenti di interpretazioni e raccomandazioni sono limitati a quelli consentiti per la settimana;
  - il server valida riferimenti, affermazioni vietate, giorni della settimana e limitazioni;
  - un output non valido non diventa un feedback.
- **Tabella `weekly_reviews`** (migrazione `0007`, applicata in produzione):
  - stati da `pending` a `approved`;
  - idempotenza con indici unici e blocco a tempo durante l'elaborazione;
  - rigenerazione come nuova revisione;
  - istantanea dei dati usati, modello e hash del template;
  - consegna dell'email con nuovi tentativi.

  `weekly_feedback_log` è stato rimosso dalla scheda (schema 1.6.0): era vuoto per tutti gli atleti.
- **Approvazione del coach**:
  - nella Panoramica ci sono esiti delle sedute, limitazioni, sintesi, testo modificabile, «Approva e invia», «Rigenera», «Riprova» e «Prepara il feedback» per una settimana a scelta;
  - l'email parte solo dopo l'approvazione.
- **Esecuzione in produzione**: lunedì alle 08:00, sulla settimana appena conclusa. L'email, spenta durante il lavoro, è riattivata.
- **Soglie del feedback modificabili** in Impostazioni (`app_settings.feedback_params`).
- **Percentuali di carico e scarico per atleta** nella Metodologia: valgono nel calendario del prompt del piano (`variazione_carico`) e nel confronto fra settimane del feedback.
- **Altre correzioni**:
  - le sedute abbinate con certezza risultano svolte anche nel piano;
  - «Non svolta» diventa «Non registrata»;
  - il carico si risincronizza sugli ultimi 14 giorni;
  - `intervals-sync` salva l'orario di svolgimento in UTC.
- **Test**: 118 unitari e 8 end-to-end.
- **Prova in produzione**: valutazione della settimana 5-11 ottobre di un atleta, con dati reali, poi eliminata.

*Motivazione*: audit del feedback ([docs/audit/2026-10-feedback/](docs/audit/2026-10-feedback/07-executive-summary.md)) e decisioni del coach:
- approvazione prima dell'invio;
- esecuzione il lunedì mattina;
- soglie modificabili;
- percentuali di carico per atleta;
- uso dei dati RPE già presenti su Intervals.icu.

*Docs aggiornati*: [decisioni/0019](docs/decisioni/0019-feedback-analisi-deterministica-approvazione.md) (nuova), [decisioni/0008](docs/decisioni/0008-feedback-automatico-schedulato.md) (superata), [backend.md](docs/backend.md), [integrazioni.md](docs/integrazioni.md), [modello-dati.md](docs/modello-dati.md), [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md), [sicurezza.md](docs/sicurezza.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [limiti-roadmap.md](docs/limiti-roadmap.md).

**2026-10-11 — Audit del feedback settimanale**
- Nuova cartella `docs/audit/2026-10-feedback/` con sette documenti: stato attuale e problemi verificati, modello di dominio del feedback endurance, contratto dati, abbinamento e metriche, strategia di test, architettura raccomandata e piano, sintesi. Nessuna modifica al codice o ai dati.

*Motivazione*: verificare se il feedback confronta i dati corretti prima di riprogettarlo. L'audit ha trovato, fra l'altro, un periodo di 8 giorni, le bozze incluse, l'abbinamento delegato a Claude e l'invio all'atleta senza revisione.
*Docs aggiornati*: [CLAUDE.md](CLAUDE.md) (mappa), [docs/audit/2026-10-feedback/](docs/audit/2026-10-feedback/07-executive-summary.md).

**2026-10-11 — Ciclo di carico aggiunto ai due piani attivi generati prima dell'ancoraggio**
- In produzione, nei piani attivi di due atleti (schema 3:1), aggiunto `cycle_week` a ogni settimana di `weeks_meta`, contato dalla prima settimana del piano: 1-4 e 1-4-1-4. Gli scarichi già salvati coincidono.
- Nel piano che inizia domenica 11 ottobre, con una seduta approvata in quel giorno, aggiunta la settimana del 5 ottobre come «Raccordo», senza `cycle_week`, come la salverebbe oggi il codice.
- Nessuna seduta modificata.

*Motivazione*: senza `cycle_week` una ripianificazione a metà piano sarebbe ripartita da «carico 1» invece che dalla settimana in corso. Verificato con `planWeeks` e `cycleAnchor` su prosecuzione e ripianificazione di entrambi i piani.
*Docs aggiornati*: nessuno oltre al changelog.

**2026-10-11 — «Prosegui il piano» distinto da «Ripianifica»**
- Nel piano, con sedute attive, due azioni: «Prosegui il piano» aggiunge settimane dopo la fine del piano attivo senza sostituire nulla (`continueFromDate`); «Ripianifica da…» sostituisce le sedute da una data. Il dialogo cambia titolo, testi e campi secondo l'azione e riapre una proposta in sospeso nel modo in cui era stata chiesta.
- Nuovo tipo di generazione `continue` (migrazione `0006_generation_kind_continue.sql`, applicata in produzione).
- Test: 72 unitari.

*Motivazione*: con il limite di 4 settimane, proseguire il piano passava da «Ripianifica», con la domanda «Cosa è cambiato» e le sedute da mantenere. Il coach ha fatto notare che proseguire non è ripianificare.
*Docs aggiornati*: [modello-dati.md](docs/modello-dati.md), [backend.md](docs/backend.md), [architettura.md](docs/architettura.md), [integrazioni.md](docs/integrazioni.md), [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0018](docs/decisioni/0018-generazione-a-finestre-ciclo-ancorato.md).

**2026-10-11 — Generazione di al massimo 4 settimane, con il ciclo di carico calcolato da PCoach**
- Eliminata la generazione a parti: una generazione copre al massimo 4 settimane, in una sola chiamata (`MAX_PLAN_WEEKS`); le successive si pianificano con «Ripianifica».
- Nuovo `domain/planWeeks.ts`: PCoach calcola numero e fase del ciclo di ogni settimana (da lunedì) dallo schema dell'atleta e li passa a Claude nel calendario. Li salva in `weeks_meta` (`is_deload`, `cycle_week`), che fa da ancora per la generazione successiva o per una ripianificazione a metà ciclo.
- Le regole sulle fasi sono nel template predefinito, modificabile in Impostazioni; la proposta tiene una sola voce per settimana.
- In produzione: cancellate su richiesta del coach tutte le sedute, il piano e le generazioni di un atleta. Rimossi da Intervals.icu gli 8 eventi creati da PCoach.
- Test: 71 unitari.

*Motivazione*: il piano di 12 settimane generato a parti rispettava il ciclo 3:1 solo in parte (settimane 1-3 in calo, settimana 11 già scaricata, nuoto dimezzato dalla 3), perché ogni parte deduceva da sola la posizione nel ciclo. Una finestra breve con il ciclo calcolato e ancorato al piano è più semplice e verificabile.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [modello-dati.md](docs/modello-dati.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0018](docs/decisioni/0018-generazione-a-finestre-ciclo-ancorato.md).

**2026-10-10 — Blocchi di 2 settimane e risposta di Claude compatta**
- Blocchi di generazione da 3 a 2 settimane, con `max_tokens` di 4000 per settimana più 2000 (`blockMaxTokens`).
- Il formato richiesto a Claude chiede JSON compatto, una seduta per riga, senza campi null o vuoti.
- In un piano a blocchi, `plan_name` descrive il piano intero.

*Motivazione*: un piano di 10 settimane si fermava con «Risposta di Claude troncata per limite di token». Il primo blocco, 3 settimane e 16 sedute di un triatleta, ha superato i 7400 token concessi, con JSON indentato e pieno di campi null.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md).

**2026-10-10 — Generazione dei piani lunghi a blocchi**
- La generazione chiede a Claude blocchi consecutivi di al massimo 3 settimane, in sequenza, e ne riunisce le risposte in un'unica proposta (`domain/planBlocks.ts`). Ogni blocco conosce la sua posizione nel piano e le sedute proposte nei blocchi precedenti. Il dialogo mostra la parte in corso.
- L'errore 546 di `claude-proxy` è spiegato al coach come superamento del tempo massimo.
- Test: 66 unitari.

*Motivazione*: un piano di 10 settimane falliva con «Errore proxy (546)». Dai log, Supabase interrompe `claude-proxy` dopo 150 secondi (`WallClockTime`), e Claude impiega circa 25 secondi per settimana (4 settimane: 101 s). Oltre 5 settimane la chiamata unica non poteva riuscire.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-10 — Rimossa la migrazione nome/cognome dello schema 1.4.0**
- Eliminata `app/src/schema/migrations/`: la migrazione euristica `identitySplit.ts`, il suo test e il punto d'ingresso `migrateProfile`.
- Lo store atleti carica le schede così come sono, senza l'avviso «Nome e cognome separati automaticamente».
- Verificato in produzione che tutte e 4 le schede sono alla versione 1.5.0 con `nome` e `cognome` separati e senza il vecchio campo `name`.
- Test: 62 unitari.

*Motivazione*: tutte le schede erano già state corrette; la migrazione non aveva più nulla da fare.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [modello-dati.md](docs/modello-dati.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0006](docs/decisioni/0006-modello-dati-identita-e-sync-automatica.md).

**2026-10-10 — Pulizia: atleti senza piani generati, rimozione del codice legacy e dei backup**
- **Dati in produzione**: cancellati piani, generazioni, sedute, cronologia e i 2 feedback settimanali dei 4 atleti, e `training_plan` dalle schede. Profilo, soglie, carico CTL/ATL, vincoli e chiavi sono rimasti. Le schede passano a `schema_version` 1.5.0.
- **Intervals.icu**: rimossi dal calendario di un atleta gli eventi creati da PCoach (7 eliminati, 7 già assenti), lasciando quelli creati fuori da PCoach. Cancellati i backup nello schema `private`.
- **Codice e database**: tolti `legacyPlanToImport`, l'import all'avvio, la funzione SQL `import_legacy_plan`, la colonna `workouts.legacy`, il tipo `legacy_import` (migrazione `0005_remove_legacy_import.sql`), il ripiego di `weekly-feedback` sul vecchio piano (ripubblicata) e la definizione di `training_plan` nello schema della scheda. La lettura degli step accetta solo il formato v2.
- **Test**: 69 unitari.

*Motivazione*: richiesta del coach, a funzionamento verificato, di ripartire da una condizione pulita e semplificare il progetto.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [backend.md](docs/backend.md), [modello-dati.md](docs/modello-dati.md), [limiti-roadmap.md](docs/limiti-roadmap.md), [sicurezza.md](docs/sicurezza.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0017](docs/decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md).

**2026-10-10 — Giorni delle sedute: calendario esplicito per Claude e controllo dei vincoli**
- Nel prompt di generazione, nuovo segnaposto `{{calendario_json}}`: ogni data del periodo con giorno della settimana, disponibilità, durata massima e attività abituale. Claude restituisce `date` e `day`.
- `parseProposal` porta la data al giorno indicato se non coincidono. Segna inoltre «da verificare» le sedute in giorni non disponibili o oltre la durata massima del giorno (`domain/availability.ts`), con il motivo mostrato nell'anteprima.
- Nell'import dei piani salvati vale il giorno e non la data.
- In produzione, 29 sedute importate di 2 atleti sono state riportate di un giorno indietro, al giorno del piano originale, con una nota nella cronologia di ciascuna.
- Test: 75 unitari.

*Motivazione*: molte sedute risultavano spostate di un giorno in avanti e una rigenerazione non rispettava la disponibilità. Claude sbaglia il calcolo del giorno della settimana a partire da una data, e l'import aveva dato ragione alla data.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0017](docs/decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md).

**2026-10-10 — Filtro «Struttura da verificare» nello Storico della tab Piano**
Nuovo chip nello Storico per le sedute attive con `needs_review`, cioè quelle importate con un target non riconoscibile o senza durata, che non si possono inviare a Intervals.icu finché non vengono corrette.
*Motivazione*: dopo l'import dei piani esistenti 4 sedute su 237 richiedevano una correzione e si potevano trovare solo scorrendo le settimane.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md).

**2026-10-10 — Sedute come entità proprie: tab Piano, rigenerazione controllata, «Sincronizza settimana» con Intervals.icu**
Le sedute escono dalla scheda e passano in tabelle proprie (`0004_workouts.sql`: `training_plans`, `plan_generations`, `workouts`, `workout_sync`, `workout_events`). Ogni seduta ha identità stabile, revisione gestita da trigger, cronologia e tre stati separati: approvazione, esecuzione, sincronizzazione.
- **Tab Piano** con vista per settimana e storico filtrabile, pannello della seduta con editor della struttura (step e ripetute) e anteprima del testo per Intervals.icu, approvazione singola o della settimana, annullamento e ripristino.
- **«Genera il piano» / «Ripianifica da…»**: data di ripartenza, sedute da mantenere, motivo; proposta di Claude salvata, anteprima delle differenze, applicazione in un'unica transazione (`apply_plan_generation`).
- **Nuovo formato di risposta di Claude** (solo zone, struttura v2) e nuovi segnaposto del prompt. Il template salvato è stato sostituito dal nuovo predefinito, con backup di quello precedente.
- **«Sincronizza settimana»** con la nuova Edge Function `intervals-sync`: anteprima delle operazioni, conflitti, rimozioni preselezionate ma da confermare, esito per riga, nuovi tentativi, riconciliazione contro i doppioni.
- **Metrica dei target**: bici in potenza con FTP, altrimenti FC; corsa e nuoto in zone di passo.
- **Import** una tantum e idempotente dei piani salvati nella scheda, con sedute approvate e `needs_review` sui target non riconoscibili. `weekly-feedback` legge le tabelle.
- **Correzioni e codice condiviso**: corretto `addDaysISO`, che in UTC+2 restituiva il giorno sbagliato. Codice condiviso tra app ed Edge Function in `supabase/functions/_shared/workouts/` (alias `@shared`). Migrazione baseline versionata di `athletes` e `app_settings`.
- **Rimossi** `PlanView`, `PlanWeekBlock`, `PlanSessionCard`, `planViewModel` e `usePlanWeeksUi`.
- **Test**: 69 test unitari in 8 file e Playwright con 3 flussi end-to-end su desktop e mobile.

*Motivazione*: una nuova generazione sostituiva il piano senza storico; non si poteva ripianificare da una data mantenendo parte del lavoro; non esisteva sincronizzazione verso Intervals.icu e il formato delle sedute non era convertibile.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [modello-dati.md](docs/modello-dati.md), [backend.md](docs/backend.md) (anche: `athletes.id` è text, non uuid), [integrazioni.md](docs/integrazioni.md) (anche: trigger di sincronizzazione del carico corretti sul codice), [design-ui.md](docs/design-ui.md), [sicurezza.md](docs/sicurezza.md), [limiti-roadmap.md](docs/limiti-roadmap.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0017](docs/decisioni/0017-sedute-entita-proprie-sincronizzazione-intervals.md), [decisioni/0007](docs/decisioni/0007-plan-view-model-puro.md) (superata).

**2026-10-10 — Revisione della UI: dati al centro, scheda in Panoramica e Profilo, conformità alle regole di design**
Scheda atleta divisa in due viste (Panoramica: carico e forma, piano, feedback; Profilo: dati dell'atleta, esporta/elimina) con header sticky e "Salva" sempre raggiungibile; soglie unificate con selettore di disciplina. Sezioni piatte e un solo livello di card; sessioni del piano come righe dentro la settimana. Nuovi token per scala tipografica, spaziature e raggi; Z3 e Z7 ricolorate, badge "Scarico" neutro, grafico del carico ridisegnato (CTL in inchiostro, ATL sottile, TSB come banda attorno allo zero, allenamenti in una striscia separata, asse y e valori attuali in legenda). Sidebar con nome per intero (va a capo invece di essere troncato) e, sotto, discipline e ultimo TSB al posto dell'ID; righe come `<button>`. Stato vuoto senza pulsanti che ripetono i comandi della sidebar o dell'hamburger mobile. Toast di errore persistenti con chiusura e regioni live (`showToast(msg, "error")`, `showResultToast`); `ConfirmDialog` modale con focus trap, Esc ed etichetta di conferma obbligatoria. Icone Lucide per le discipline, etichette associate ai campi, date in italiano (`formatDate`), periodizzazione e discipline come testo leggibile, testi di stati vuoti ed errori riscritti. Corretti l'header sticky (non funzionava per l'`overflow` di `.main`) e la sovrapposizione dell'hamburger su mobile.
*Motivazione*: la scheda seguiva l'ordine dei dati invece del lavoro del coach; diverse regole di `design-ui.md` (tastiera, toast, dialog, icone) non erano rispettate dal codice; il linguaggio visivo era generico e i colori avevano più significati.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0016](docs/decisioni/0016-direzione-visiva-dati-al-centro.md).

**2026-10-10 — Cleanup README e formattazione markdown in sicurezza.md**
Eliminato `app/README.md` in quanto ridondante rispetto a `docs/sviluppo-deploy.md` e `CLAUDE.md`; rimossa la riga "Quando leggerlo" da `README.md` per mantenere la descrizione del progetto pulita e diretta. Aggiunta riga vuota prima dell'elenco puntato nella sezione chiamanti Edge Function in `docs/sicurezza.md`.
*Motivazione*: rimozione di ridondanze nel rispetto della regola 2 di CLAUDE.md ("una sola casa per ogni informazione") e corretto parsing della sintassi Markdown.
*Docs aggiornati*: [README.md](README.md), [sicurezza.md](docs/sicurezza.md), rimosso `app/README.md`.

**2026-10-10 — Allineamento dei docs al codice e alle regole di CLAUDE.md**
`design-ui.md`: tabella dei token riallineata a `tokens.css` (rimossi `--bg-elevated`, `--success`, `--chart-tsb`, `--radius`, `--shadow`, `--font-size-*`, `--space-*`, che non esistono; aggiunti `--surface`, `--surface-2`, `--accent-contrast`, `--focus`, `--danger-bg`, `--warning-bg`, `--zone-*`, `--font-ui`, `--font-mono`); tipografia e spaziatura descritte come valori in px diretti; rimosso il componente "Card", che non esiste (il pannello è la classe `section.block`); corretti il layout della sidebar e l'intervallo delle zone (Z1-Z7). `sicurezza.md`: eliminato il riferimento allo stato precedente. ADR 0009: corretto il link al changelog. Rimossa `docs/athlete_profile.schema.json`, copia identica e non referenziata di `app/src/schema/athlete_profile.schema.json`, che resta l'unica fonte di verità. `README.md` e `app/README.md`: aggiunta la riga "Quando leggerlo"; il secondo non contiene più il testo del template Vite ma rimanda ai docs.
*Motivazione*: regole 1, 2, 5 e 7 di CLAUDE.md (solo stato attuale nei file di stato, una sola casa per ogni informazione, riga "Quando leggerlo", correzione sul posto dei docs disallineati dal codice).
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sicurezza.md](docs/sicurezza.md), [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md), [README.md](README.md), [app/README.md](app/README.md).

**2026-10-10 — Barra del titolo PWA desktop senza nome, con linea di separazione (Window Controls Overlay)**
Aggiunto `display_override: ['window-controls-overlay']` al manifest (`vite.config.ts`). Nuovo token `--titlebar-h` (`tokens.css`) e fascia di trascinamento `body::before` con sfondo `--surface` e linea inferiore di 1px in `--border` (`base.css`), attiva solo in quella modalità. Altezze `100vh`, sidebar sticky, drawer/toggle/backdrop mobile e schermate di caricamento/login (`App.vue`, `LoginView.vue`) adeguate a `--titlebar-h`.
*Motivazione*: togliere il nome dell'app dalla barra di trascinamento di Windows e distinguere la barra dal resto dell'interfaccia con una linea dello stesso colore dei bordi della sidebar.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0015](docs/decisioni/0015-barra-titolo-window-controls-overlay.md).

**2026-10-09 — Icona app e favicon ritagliate in formato circolare**
Rigenerate `app/public/favicon.png` (32×32 px), `app/public/icons/icon-192.png` (192×192 px) e `app/public/icons/icon-512.png` (512×512 px) con maschera circolare e trasparenza negli angoli (anti-aliasing tramite supersampling).
*Motivazione*: richiesta del coach di visualizzare l'immagine dell'app e la favicon in forma circolare.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Nuova icona app (favicon + icone PWA)**
Icona dell'app sostituita con un'immagine gradiente multicolore personalizzata. Generati `app/public/favicon.png` (32×32 px, usato come favicon del browser), `app/public/icons/icon-192.png` e `app/public/icons/icon-512.png` (icone PWA per manifest e `apple-touch-icon`). `index.html` aggiornato: `<link rel="icon">` punta ora a `favicon.png` (PNG) invece di `favicon.svg`.
*Motivazione*: allineare l'identità visiva dell'app all'immagine scelta dal coach.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Bump GitHub Actions a runtime Node.js 24**
`actions/checkout` v4→v7, `actions/setup-node` v4→v7, `actions/upload-pages-artifact` v3→v5, `actions/deploy-pages` v4→v5 in `.github/workflows/deploy.yml`.
*Motivazione*: GitHub ha deprecato il runtime Node.js 20 su tutte le runner; le action precedenti venivano forzate su Node.js 24 generando warning nei log di CI/CD.
*Docs aggiornati*: [sviluppo-deploy.md](docs/sviluppo-deploy.md).

**2026-10-09 — Allineamento colore barra PWA allo sfondo sidebar**
`theme-color` in `index.html` impostato tramite due meta tag con `prefers-color-scheme: dark/light` (`#1C2025` / `#FFFFFF`), corrispondenti al token `--surface` (sfondo della sidebar) per garantire continuità visiva verticale. `theme_color` e `background_color` nel manifest (`vite.config.ts`) impostati su `#1C2025`.
*Motivazione*: creare continuità cromatica diretta tra la barra del titolo della finestra PWA e la testata della sidebar sia in modalità scura che in modalità chiara.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0013](docs/decisioni/0013-pwa-manifest-only.md), [decisioni/0014](docs/decisioni/0014-colore-finestra-pwa-continuita-sidebar.md).

**2026-10-09 — Iconografia unificata (lucide-vue-next) e rimozione tooltip nativi**
Introdotta la libreria `lucide-vue-next` come dipendenza in `app/package.json` per uniformare l'iconografia dell'interfaccia ed eliminare glifi Unicode, emoji e SVG inline: icone `Settings` e `LogOut` nella sidebar (`AthleteSidebar.vue`), `X` per l'eliminazione atleta e `UserPlus` per la card nuovo atleta, `Menu` per il toggle mobile (`App.vue`), `User` per il placeholder, `Eye`/`EyeOff` per il toggle password (`PasswordField.vue`) e `ChevronDown`/`ChevronRight` per le sezioni comprimibili del piano (`PlanWeekBlock.vue`). Contestualmente rimossi gli attributi `title`/`:title` a favore di `aria-label` su tutti i controlli a icona e sull'icona disciplina in `PlanSessionCard.vue` per evitare la comparsa di tooltip nativi del browser al passaggio del puntatore preservando la piena accessibilità; armonizzata la label del bottone impostazioni in `AthleteSidebar.vue` e corretto un riferimento documentale obsoleto in `SettingsPanel.vue`.
*Motivazione*: garantire coerenza stilistica e dimensionale nell'iconografia UI, prevenire tooltip nativi ridondanti sui comandi visuali e mantenere piena accessibilità assistiva.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md).

**2026-10-09 — PWA installabile (manifest + icone)**
Aggiunta configurazione `vite-plugin-pwa` in `vite.config.ts` con manifest Web App (nome, colori brand, `start_url`/`scope` relativi alla base `/PCoach/`, icone 192×512 px). Nessun Service Worker attivo (`selfDestroying: true`): l'app è installabile dalla schermata home ma non funziona offline. Aggiunti meta tag PWA in `index.html` (`theme-color`, `apple-mobile-web-app-*`, `apple-touch-icon`). Icone PNG generate in `app/public/icons/`.
*Motivazione*: rendere l'app aggiungibile alla schermata home su mobile/desktop senza barra del browser, con il minimo di complessità (nessuna strategia offline da gestire).
*Docs aggiornati*: [architettura.md](docs/architettura.md), [sviluppo-deploy.md](docs/sviluppo-deploy.md), [decisioni/0013](docs/decisioni/0013-pwa-manifest-only.md).

**2026-10-08 — Hardening: `is_coach()` in schema `private`**
`public.is_coach()` spostata in `private.is_coach()` (migrazione `0002_move_is_coach_private.sql`) con `search_path` vuoto e `EXECUTE` revocato a `public`/`anon` e concesso solo ad `authenticated`; le policy RLS la referenziano per OID e non sono state riscritte. Nessuna modifica al codice dell'app. Verificato: `GET /rest/v1/rpc/is_coach` risponde `404` (`PGRST202`). Documentato come passo di setup opzionale l'attivazione di *Prevent use of leaked passwords*.
*Motivazione*: il Security Advisor di Supabase segnalava la funzione `SECURITY DEFINER` come eseguibile da `anon` e `authenticated` tramite `/rest/v1/rpc/is_coach`.
*Docs aggiornati*: [backend.md](docs/backend.md), [sicurezza.md](docs/sicurezza.md), [architettura.md](docs/architettura.md), [decisioni/0012](docs/decisioni/0012-is-coach-schema-privato.md).

**2026-10-04 — Fix generazione piano senza esito a schermo**
`max_tokens` calcolato in proporzione al numero di settimane richieste (invece di un valore fisso), propagazione di `stop_reason` da `claude-proxy` fino al client per distinguere un piano troncato per limite di token da un JSON malformato, toast di errore reso persistente invece di sparire prima che il coach potesse leggerlo. Verificato end-to-end sul backend reale. Indagato e documentato `ERR_ABORTED` su richieste HEAD come artefatto innocuo di Chromium.
*Motivazione*: piani lunghi (molte settimane) venivano troncati silenziosamente dal limite di token fisso, risultando in un JSON incompleto senza un messaggio d'errore comprensibile per il coach.
*Docs aggiornati*: [integrazioni.md](docs/integrazioni.md), [limiti-roadmap.md](docs/limiti-roadmap.md).

**2026-10-04 — Rifinitura sidebar: IconButton e drawer mobile via composable**
Footer della sidebar compattato con due `IconButton` al posto dei bottoni testuali "Impostazioni"/"Esci"; logica del drawer mobile (backdrop cliccabile, transizioni, Esc, scroll-lock, gestione del focus) estratta nel composable `useMobileSidebar.ts`; bottone hamburger nascosto mentre il drawer è aperto.
*Motivazione*: liberare spazio verticale nel footer della sidebar e separare la responsabilità del comportamento del drawer da `App.vue`.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [design-ui.md](docs/design-ui.md), [decisioni/0011](docs/decisioni/0011-rifinitura-sidebar-iconbutton.md) (voce aggiunta retroattivamente).

**2026-10-04 — Fase 9 (hardening): weekly-feedback**
`weekly-feedback` verifica ora il chiamante (richiede la service-role key come bearer), legge la service-role key da Supabase Vault, sincronizza CTL/ATL prima del confronto piano/reale, usa una finestra di attivazione resiliente (resto della giornata, non match esatto sull'ora).
*Motivazione*: senza verifica del chiamante, il gateway JWT di Supabase avrebbe accettato anche la anon key pubblica per invocare la function; un match esatto sull'ora avrebbe fatto slittare il feedback di una settimana intera in caso di invocazione cron mancata.
*Docs aggiornati*: [backend.md](docs/backend.md), [sicurezza.md](docs/sicurezza.md), [decisioni/0008](docs/decisioni/0008-feedback-automatico-schedulato.md).

**2026-10-04 — Fase 9: autenticazione coach e RLS**
Supabase Auth a singolo utente coach (store/UI di login), poi RLS su `athletes`/`app_settings` con `public.is_coach()` + hardening di `claude-proxy` (richiede JWT di sessione, non la sola anon key), poi aggiornamento della documentazione.
*Motivazione*: l'app era raggiungibile tramite link senza alcuna autenticazione né restrizione a livello database.
*Docs aggiornati*: [sicurezza.md](docs/sicurezza.md), [backend.md](docs/backend.md), [decisioni/0010](docs/decisioni/0010-autenticazione-coach-rls-reale.md) (supera [0001](docs/decisioni/0001-niente-auth-rls-iniziale.md)).

**2026-10-04 — Fix: `training_status` obbligatorio nello schema**
`training_status` reso `required` in `athlete_profile.schema.json`, risolvendo un fallimento della build CI. Stato dei test in quel momento: 33 test.
*Motivazione*: una scheda senza stato di allenamento non ha senso ai fini della generazione del piano; il campo opzionale permetteva stati incompleti non gestiti a valle.
*Docs aggiornati*: [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md).

**2026-10-04 — Fase 8: rifinitura mobile**
Sidebar atleti come drawer sotto i 720px, grafico del carico con interazione touch/mouse unificata e `aspect-ratio` fisso, cleanup e aggiornamento documentazione.
*Motivazione*: il layout desktop semplicemente ristretto non era utilizzabile comodamente su schermi piccoli.
*Docs aggiornati*: [design-ui.md](docs/design-ui.md), [decisioni/0009](docs/decisioni/0009-rifinitura-mobile-fase-8.md).

**2026-10-04 — Fase 7: feedback settimanale automatico**
Introdotta la Edge Function schedulata `weekly-feedback` (confronto piano/reale via Claude, invio email opzionale via Resend) e il relativo pannello impostazioni, sostituendo il precedente flusso manuale lato client.
*Motivazione*: il coach doveva ricordarsi di generare manualmente il confronto ogni settimana; automatizzarlo rimuove questo carico.
*Docs aggiornati*: [backend.md](docs/backend.md), [integrazioni.md](docs/integrazioni.md), [decisioni/0008](docs/decisioni/0008-feedback-automatico-schedulato.md), [decisioni/0002](docs/decisioni/0002-email-feedback-via-resend.md).

**2026-10-04 — Fase 6: vista grafica del piano di allenamento**
`PlanView.vue`/`PlanWeekBlock.vue`/`PlanSessionCard.vue` per visualizzare il piano generato, con `planViewModel` come funzione pura testabile per la trasformazione dei dati.
*Motivazione*: il piano generato da Claude (JSON) necessitava di una vista leggibile invece di essere mostrato come testo grezzo.
*Docs aggiornati*: [architettura.md](docs/architettura.md), [decisioni/0007](docs/decisioni/0007-plan-view-model-puro.md).

**2026-10-03 — Fase 5: modello dati e form**
Split identità (`nome`/`cognome`, schema_version 1.4.0) con migrazione euristica, sezione integrazioni (chiave Intervals.icu per-atleta), discipline multiple, grafico carico (CTL/ATL/TSB).
*Motivazione*: il modello dati iniziale non distingueva nome/cognome né supportava più discipline per atleta in modo strutturato.
*Docs aggiornati*: [modello-dati.md](docs/modello-dati.md), [decisioni/0006](docs/decisioni/0006-modello-dati-identita-e-sync-automatica.md).

**2026-10-03 — Fase 3: sincronizzazione sicura e concorrenza ottimistica**
Update ad `athletes` condizionato a `updated_at` noto; `syncLoadMetrics` come scrittura mirata esclusa dal tracciamento delle modifiche non salvate del form.
*Motivazione*: un salvataggio concorrente (due schermi, o sync in background) rischiava di sovrascrivere silenziosamente dati validi.
*Docs aggiornati*: [backend.md](docs/backend.md), [decisioni/0005](docs/decisioni/0005-concorrenza-ottimistica-sync-mirata.md).

**2026-10-03 — Fase 2: sidebar definitiva e stato di connessione**
Sidebar atleti nella forma attuale (lista + card "Nuovo atleta"), indicatore di stato connessione Supabase.
*Motivazione*: dare un riscontro visivo immediato sulla disponibilità del backend.
*Docs aggiornati*: [architettura.md](docs/architettura.md).

**2026-10-03 — Fase 1: migrazione a Vue 3 + Vite + Pinia**
Riscrittura dell'app (precedentemente un singolo `index.html`) in componenti Vue 3 con Composition API, build Vite, stato in Pinia — a parità funzionale con la versione precedente.
*Motivazione*: il file unico `index.html` non era più gestibile man mano che le funzionalità crescevano.
*Docs aggiornati*: [architettura.md](docs/architettura.md).
