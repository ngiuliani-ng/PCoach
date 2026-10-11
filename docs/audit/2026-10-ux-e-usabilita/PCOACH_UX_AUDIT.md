# Audit di prodotto, UI/UX e usabilità cross-platform (ottobre 2026)

**Quando leggerlo**: per capire quali problemi di interfaccia, usabilità mobile/PWA, accessibilità e trasparenza dei campi tecnici sono stati trovati l'11 ottobre 2026, con le evidenze, le priorità e il piano proposto. È una fotografia datata: non descrive lo stato corrente.

Classificazione delle evidenze usata in tutto il documento:
- **VERIFICATO (codice)**: letto nel codice, con riferimento `file:riga`;
- **VERIFICATO (prova)**: riprodotto nel browser (Chromium via Playwright, backend finto `app/e2e/mockBackend.ts`);
- **INFERENZA**: deduzione da codice o comportamento noto delle piattaforme, non riprodotta;
- **NON DETERMINABILE**: mancano gli strumenti o i dati per verificarlo.

Stato del repository al momento dell'audit: `main` a `5b851c2`, nessuna modifica locale tracciata. Controlli eseguiti: 143 test unitari superati, 8 e2e superati, `vue-tsc -b` senza errori. Il progetto non ha un linter configurato.

---

## 1. Executive summary

PCoach ha una base solida:
- design system piccolo e coerente, con token, due temi, icone uniformi e focus visibile;
- dialoghi con focus intrappolato;
- nessuno scorrimento orizzontale a nessuna larghezza provata (320–1440 px);
- test unitari ed e2e in CI.

Molte scelte delicate sono già trasparenti all'utente: anteprima delle differenze, avvisi sulle sedute già su Intervals.icu, approvazione esplicita del feedback.

I problemi più seri non sono estetici. Riguardano **dati che l'utente crede salvati e non lo sono**, e **valori che l'interfaccia mostra ma che il sistema usa in modo diverso o non usa**:

1. **Modifiche alla scheda perse senza avviso** (U-01, P1, verificato): cambiare atleta, aprire Impostazioni e poi un atleta, uscire o ricaricare la pagina scarta le modifiche non salvate. La conferma esiste solo per la bozza di un *nuovo* atleta.
2. **Salvataggio fallito presentato come riuscito** (U-02, P1, verificato). Un errore di rete al salvataggio mostra «Salvato in locale», ma non esiste alcun salvataggio locale. Il pulsante «Salva» si disattiva e la scheda sembra salvata. Per un atleta nuovo, il secondo salvataggio dice «Scheda salvata.» senza scrivere nulla, e dopo 15 secondi la scheda sparisce.
3. **Da Impostazioni non si torna all'atleta aperto** (U-07, P1, verificato): il clic sull'atleta già aperto non fa nulla. Con un solo atleta l'unica uscita è ricaricare.
4. **Schema di carico e scarico in testo libero** (U-04, P1, verificato). Se il testo non è nella forma `N:M`, la generazione perde in silenzio tutte le fasi del ciclo: niente «carico 1 di 3», niente «scarico». Claude decide da solo e l'interfaccia non avvisa.
5. **Valori usati diversi da quelli salvati** (U-06, P2, verificato). La generazione usa le preferenze e il modello scritti in Impostazioni anche se non salvati, e la scheda dell'atleta anche se non salvata. Il feedback automatico invece usa i valori salvati.

Sul piano mobile/PWA l'app è utilizzabile, ma con limiti precisi:
- nessuno stato nell'URL: il ricaricamento o la ripresa della PWA riportano alla schermata vuota, e il «indietro» di Android esce dall'app;
- campi a 14 px, che su iOS fanno zoomare la pagina al tocco (INFERENZA, nessun iPhone disponibile);
- contrasto insufficiente per il testo d'avviso e per i bordi dei campi;
- PWA bloccata in verticale.

Per i campi tecnici il quadro è misto:
- le soglie del feedback e i campi della metodologia hanno già testi d'aiuto buoni;
- `zone_system` («Sistema di zone») non ha **alcun effetto** nel sistema;
- le note libere e i dati anagrafici arrivano a Claude senza che l'interfaccia lo dica;
- il fuso orario è testo libero e un valore non valido **blocca il feedback automatico** di ogni settimana.

## 2. Architettura reale (verificata)

L'architettura è descritta per esteso in [architettura.md](../../architettura.md); qui solo ciò che conta per l'audit.

- **Una sola pagina, nessun router.** `App.vue` sceglie fra login, Impostazioni (`showSettings`), scheda atleta e stato vuoto. La scheda ha tre tab interne (Panoramica, Piano, Profilo) gestite con uno `ref` locale (`AthleteEditor.vue:41`). Nessuno stato finisce nell'URL o nella cronologia: non ci sono `popstate`, `history` né hash.
- **Stato condiviso** in Pinia:
  - `athletes`: schede, copia in modifica `currentProfile`, istantanea di confronto, polling ogni 15 s;
  - `workouts`, `reviews`, `settings`, `auth`.

  La scheda in modifica è un clone. Lo stato «modificato» confronta il clone con un'istantanea (`useDirtyState.ts`).
- **Persistenza**: Supabase. La scheda è un blob `jsonb` con concorrenza ottimistica su `updated_at`. Sedute, piani e generazioni hanno tabelle proprie. Nessuna persistenza locale: niente `localStorage` per i dati, nessun Service Worker.
- **AI**:
  - **generazione**: parte dal browser (`RegenerateDialog.vue`) verso `claude-proxy`, con il prompt costruito da `services/planPrompt.ts`;
  - **feedback**: lo genera il server (`weekly-feedback`, cron orario) con i valori di `app_settings` salvati.
- **Design system**: `styles/tokens.css` e `styles/base.css`, componenti generici in `components/ui/` (ConfirmDialog, ToastHost, IconButton, PasswordField), composables per modali e drawer.
- **PWA**: solo manifest (`vite.config.ts`, `selfDestroying: true`), `display_override: window-controls-overlay`, `orientation: 'portrait'`.

Flusso di un parametro della scheda:
1. campo in `AthleteEditor.vue`;
2. `currentProfile`, reattivo, non validato;
3. «Salva»: `athletes.saveCurrent()` scrive tutto il blob;
4. alla generazione: `buildAthleteContextForPrompt`, che invia un sottoinsieme, e `planningCalendar`/`planWeeks` per i valori calcolati;
5. Claude;
6. `parseProposal` e `weeklyIssues` per i controlli;
7. anteprima.

## 3. Audit UI/UX per schermata e flusso

### 3.1 Barra laterale e navigazione
- **U-01 (P1, VERIFICATO prova R1 e codice)**. `AthleteSidebar.vue:42-66`: `guardDraftDiscard` protegge solo la bozza di un atleta nuovo (`isDraftOpen`).
  - Con modifiche non salvate su un atleta esistente, il clic su un altro atleta chiama `openAthlete`, che sovrascrive `currentProfile`. Prova: peso cambiato da 58 a 61, cambio atleta e ritorno, il peso torna 58, senza alcuna conferma.
  - Lo stesso vale per «Esci» (`auth.signOut()` senza controllo) e per la chiusura o il ricaricamento della pagina: nessun `beforeunload`.
- **U-07 (P1, VERIFICATO prova R2 e codice)**. `onSelect` esce subito se `currentId === id` (`AthleteSidebar.vue:63`), e `App.vue:46-52` nasconde le Impostazioni solo quando cambia `currentProfile`. Dalle Impostazioni, il clic sull'atleta già aperto non fa nulla.
- **U-27 (P3, VERIFICATO codice)**. Il messaggio di conflitto dice «Usa "Aggiorna"» (`athletes.ts:168`), ma il pulsante si chiama «Ricarica i dati più recenti» (`AthleteEditor.vue:222`). Anche il commento a `athletes.ts:154` cita un `docs/DOCUMENTAZIONE.md` che non esiste.

### 3.2 Header della scheda
- **U-12 (P3, VERIFICATO codice e screenshot)**. «Salva» e «Modifiche non salvate» sono nell'header in tutte e tre le tab, ma riguardano solo i dati del Profilo. Nella tab Piano la seduta si salva nel suo pannello. Un coach può pensare che «Salva» salvi anche il piano, o non capire perché sia disattivato.
- **U-02 (P1, VERIFICATO prova R3/R4 e codice `athletes.ts:137-178`)**. Su errore di rete, `saveCurrent` mostra «Salvato in locale, ma la sincronizzazione con Supabase è fallita.» e poi chiama `refreshBaseline()`: la scheda risulta non modificata e «Salva» si disattiva.
  - Su una scheda esistente il database resta invariato e l'interfaccia mostra la scheda come salvata.
  - Su un atleta nuovo, `currentId` viene impostato prima dell'insert. Il salvataggio successivo è quindi un update senza condizione su una riga che non esiste: risponde «Scheda salvata.» e non scrive nulla. Al polling successivo la scheda sparisce dall'elenco e l'editor si chiude, con tutti i dati inseriti.

### 3.3 Panoramica
- Gerarchia chiara: carico, settimana, feedback. Il grafico ha un'etichetta accessibile e una legenda con i valori.
- **U-17 (P2, VERIFICATO codice `WeeklyReviews.vue:219`)**. Un feedback «In preparazione» dice «ricarica tra qualche minuto», ma non c'è un comando per aggiornare né un aggiornamento automatico. L'unico modo è ricaricare la pagina, e su PWA si perde il contesto (U-14).
- **U-09 (P2, VERIFICATO prova R10 e codice `pipeline.ts:245`)**. Con l'email attiva e un atleta senza indirizzo, il pulsante dice «Approva e invia». Il server poi registra `delivery_status = skipped`, che compare in rosso come «Approvato, email non inviata» con «Riprova l'invio», un comando inutile finché manca l'indirizzo. Il campo Email del Profilo non dice che serve al feedback.

### 3.4 Piano (settimana, storico, pannello, dialoghi)
- Le cose che funzionano bene:
  - badge con icona e testo, mai solo colore;
  - riga intera cliccabile con «Approva» separato;
  - anteprima delle differenze;
  - avvisi sulle rimozioni remote;
  - esito per riga della sincronizzazione.
- **U-11 (P2, VERIFICATO codice)**. Il badge «Struttura da verificare» (`WorkoutBadges.vue:299`) e il filtro omonimo (`PlanTab.vue:91`) compaiono per ogni `needs_review`, compresi giorno non disponibile e durata oltre il massimo (`WorkoutDrawer.vue:89`). L'etichetta indica una causa sbagliata.
- **U-18 (P2, VERIFICATO codice `RegenerateDialog.vue:286`)**. Gli avvisi sulla proposta (sedute a settimana, variazione di volume rispetto alla fase) sono testo grigio da 12 px, poco evidente. Sono proprio i casi «l'AI non ha rispettato un vincolo».
- **U-03 (P2, VERIFICATO prova R6)**. «Genera la proposta» non si disattiva durante la sincronizzazione del carico che precede la chiamata. Un doppio clic ha creato **2 generazioni e 2 chiamate a Claude**.
- **U-19 (P2, VERIFICATO codice `WorkoutDrawer.vue:92-95`)**. Se il salvataggio di una seduta fallisce, anche per un errore di rete e non solo per un conflitto di revisione, il pannello si chiude e le modifiche locali vanno perse.
- **U-25 (P3, VERIFICATO codice)**. Nel modo «incolla a mano» (senza chiave):
  - non c'è un pulsante «Copia il prompt» se la copia automatica fallisce;
  - «Indietro» lascia una generazione `proposed` orfana, che viene chiusa solo dopo 30 minuti.
- **U-26 (P3, VERIFICATO codice `StepEditor.vue:426-429`)**. Gli step dentro una ripetuta non hanno «Sposta giù». I campi degli step hanno solo l'etichetta accessibile (nessuna visibile) e su mobile occupano quattro righe per step.
- **U-23 (P3, VERIFICATO screenshot 320 px)**. Su mobile la barra del Piano impila segmentato e tre pulsanti a tutta larghezza (~200 px) prima della settimana. Il riepilogo sotto il titolo occupa altre tre righe.

### 3.5 Profilo
- Struttura a sezioni piatte con unità, etichette sempre associate e aiuti presenti su volume, periodizzazione, tapering e metodologia.
- **U-04 (P1, VERIFICATO prova R7 e codice `planWeeks.ts:26-32`)**. «Schema carico e scarico» è un campo di testo senza formato dichiarato, né aiuto, né validazione. Un valore come «tre settimane e una di scarico» rende `parseLoadPattern` nullo e il calendario inviato a Claude perde tutte le fasi. Prova: con «3:1» il prompt contiene `carico 1 di 3…scarico`, con il testo libero nessuna fase. Nessun avviso nel Profilo né nel dialogo di generazione.
- **U-10 (P2, VERIFICATO codice)**. «Sistema di zone» (3/5/7) per corsa e bici si salva ma non è letto da nessun modulo: non entra nel prompt, che invia solo l'ultima rilevazione, né nel feedback. Le sedute usano sempre Z1–Z7 e le zone reali sono quelle dell'account Intervals.icu.
- **U-13 (P2, VERIFICATO codice `planPrompt.ts:81-108`)**. Nome, cognome, anno di nascita, sesso, altezza, peso, fattori di vita con la loro nota e le **note libere** vengono inviati a Claude a ogni generazione. L'interfaccia non lo dice in nessun punto: un coach può scrivere nelle note informazioni che considera private.
- **R8 non riprodotto**: l'ipotesi che aprire un atleta con obiettivo «Preparazione gara» e senza eventi lo segnasse come modificato (watch in `AthleteEditor.vue:81`) non si è verificata nei casi provati.

### 3.6 Impostazioni
- **U-06 (P2, VERIFICATO prova R5)**. Le Impostazioni:
  - non hanno uno stato «modificato» né un avviso all'uscita;
  - hanno «Salva impostazioni» sempre attivo.

  Uscire senza salvare non perde subito i valori, perché restano nello store, ma la generazione dal browser li usa. Prova: una preferenza scritta e mai salvata è finita nel prompt di sistema inviato a `claude-proxy`, mentre il database aveva ancora il valore predefinito. Lo stesso vale per il modello. Le soglie del feedback non salvate decidono anche «Svolta / Svolta in parte» nel Piano (`AthleteEditor.vue:179`), mentre il feedback del server usa quelle salvate.
- **U-05 (P2, VERIFICATO prova R11, codice e Node)**. «Fuso orario» è testo libero e il valore «Roma» è stato salvato con «Impostazioni salvate.». `Intl.DateTimeFormat` con un fuso non valido lancia `RangeError` (verificato con Node). `runScheduled` (`pipeline.ts:300-301`) lo usa prima di tutto, quindi ogni esecuzione oraria fallirebbe e nessun feedback verrebbe preparato o elaborato, senza segnali nell'app. La probabilità è bassa (il campo è precompilato), l'impatto bloccante.
- **U-31 (P3)**. «Ripristina le preferenze predefinite» sostituisce il testo senza conferma né annullamento.

### 3.7 Login
- Semplice e corretta: etichette, `autocomplete`, errore in `role="alert"`, pulsante con stato di caricamento. Nessun problema rilevante.

### 3.8 Componenti generici
- **U-21 (P3, VERIFICATO codice `ConfirmDialog.vue:435`)**. Il pulsante di conferma è sempre `danger` (rosso), anche per conferme non distruttive come «Approva comunque», «Rigenera» o «Ricarica e scarta le modifiche». Il rosso perde significato.

## 4. Audit responsive

Metodo: Chromium (Playwright 1.56), backend finto, data fissata al 10 ottobre 2026. Per ognuna delle 10 schermate (vuoto, sidebar aperta, Panoramica, Piano, pannello, Ripianifica, Sincronizza, Storico, Profilo, Impostazioni) e per il login, sono stati misurati:
- scorrimento orizzontale;
- elementi fuori viewport;
- bersagli interattivi sotto 24 px;
- campi con testo sotto 16 px;
- controlli senza nome o senza etichetta.

**Non è una verifica su dispositivo reale.**

| Larghezza | Scorrimento orizzontale | Elementi fuori viewport | Controlli senza nome/etichetta | Note |
|---|---|---|---|---|
| 320 | nessuno | 0 | 0 | barra del Piano alta (U-23); riepilogo su tre righe |
| 375 / 430 | nessuno | 0 | 0 | pannello della seduta a tutto schermo con il piede sempre visibile, anche con il viewport ridotto a 360 px (tastiera simulata) |
| 768 | nessuno | 0 | 0 | layout desktop con sidebar; colonna di 680 px |
| 740×360 (orizzontale) | nessuno | 0 | 0 | il dialogo Ripianifica lascia ~130 px al corpo: usabile solo scorrendo |
| 1280 / 1440 | nessuno | 0 | 0 | colonna centrata di 680 px: molto spazio vuoto, ma una scelta di leggibilità coerente |

Bersagli sotto 24 px:
- i chip dei filtri dello Storico (23 px di altezza);
- i link-pulsante isolati, come «Ripristina le preferenze predefinite» e «Ripristina i valori predefiniti» (16–19 px);
- la casella «Rimuovi da Intervals.icu» con la sua etichetta (circa 20 px).

Quasi tutti gli altri controlli sono alti 32–36 px: sopra il minimo WCAG 2.2 AA (24 px), sotto i 44 px consigliati per il tocco (**U-22, P3**).

Campi con testo sotto 16 px: **tutti** (14 px, 13 px i campi monospazio; 55 nel Profilo, 30 nel pannello).
- **U-15 (P2, INFERENZA)**: Safari su iOS ingrandisce la pagina al tocco di un campo sotto i 16 px.
- Non verificato su iPhone: WebKit non è installato e non c'è un dispositivo.

Zoom al 200% e testo ingrandito: NON DETERMINABILE in questa sessione, non provati.

## 5. Audit PWA

| Aspetto | Stato | Evidenza |
|---|---|---|
| Manifest e icone | presenti: nome, icone 192/512 e maskable, `start_url` e `scope` `/PCoach/` | `vite.config.ts` |
| Service Worker | assente per scelta (`selfDestroying`) | [decisioni/0013](../../decisioni/0013-pwa-manifest-only.md) |
| Offline | non supportato. Aperta senza rete, la PWA mostra la pagina d'errore del browser, non un messaggio dell'app | INFERENZA dalla configurazione; non provato su dispositivo |
| Rete instabile durante l'uso | pallino di connessione nella sidebar; i salvataggi falliti sono comunicati in modo fuorviante | U-02 |
| Aggiornamenti | sempre l'ultima versione pubblicata (nessuna cache dell'app) | configurazione |
| Desktop Chromium | barra del titolo disegnata dall'app (Window Controls Overlay) | [decisioni/0015](../../decisioni/0015-barra-titolo-window-controls-overlay.md) |
| Orientamento | `orientation: 'portrait'`: su Android e sui tablet la PWA installata non ruota | **U-20 (P3)**, VERIFICATO codice |
| Ripresa, deep link, «indietro» | nessuno stato nell'URL. Dopo un ricaricamento o la chiusura dell'app da parte del sistema si riparte da «Scegli un atleta»; il gesto «indietro» di Android in modalità standalone esce dall'app, anche con un pannello aperto o con modifiche non salvate | **U-14 (P2)**, VERIFICATO codice; comportamento di Android: INFERENZA |
| Safe area | `viewport-fit=cover` non è usato, quindi i margini di sistema li gestisce il browser; nessun contenuto finisce sotto notch o barra | VERIFICATO codice |
| Installazione reale | NON DETERMINABILE (nessun dispositivo) | — |

## 6. Accessibilità

Verifiche fatte: contrasto dei token calcolato con la formula WCAG, scansione del DOM, ordine di tabulazione nella Panoramica e lettura del codice dei componenti. Non usati: lettore di schermo, axe (non installato).

- Punti di forza verificati:
  - dialoghi e pannelli con focus intrappolato, Esc e ritorno del focus;
  - tab con il pattern ARIA e le frecce;
  - toast in due regioni live;
  - icone con `aria-hidden` o `role="img"`;
  - nessun controllo senza nome o etichetta nelle 60 schermate misurate;
  - focus visibile: contorno di 2 px sui pulsanti, alone sui campi;
  - `prefers-reduced-motion` rispettato.
- **U-16 (P2, VERIFICATO calcolo)**. Contrasti:

  | Coppia | Contrasto | Esito |
  |---|---|---|
  | testo d'avviso `#9A6B07` su `#FBF1DA` (tema chiaro) | 4,17:1 | non supera 1.4.3 per il testo normale (badge «Da revisionare», note di avviso) |
  | bordi dei campi `#DDE1E7` su bianco | 1,31:1 | non supera 1.4.11 (3:1 per i confini dei controlli), e anche il fondo del campo è appena distinguibile da `--bg` |
  | tema scuro, bordi | 1,4–1,5:1 | come sopra |
  | colori di zona sul bianco | 2,2–2,7:1 | accettabili come decorazione, perché la barra ha un'etichetta e l'altezza codifica la zona; da non usare per testo |

  [design-ui.md](../../design-ui.md) afferma «Contrasto testo/sfondo verificato per i token di colore principali»: la verifica non comprende la coppia d'avviso.
- I campi della struttura hanno solo l'etichetta accessibile: con l'ingrandimento lo scopo di «4» e di «min» si capisce solo dalla posizione (U-26).

## 7. Matrice dei parametri complessi

Legenda effetto sull'AI:
- **Diretto**: il valore entra nel prompt e una regola fissa dice a Claude come usarlo;
- **Calcolato**: PCoach ne ricava un dato che entra nel prompt;
- **Contesto**: il valore entra nel prompt senza una regola specifica;
- **Controllo**: PCoach lo verifica sulla risposta;
- **Nessuno**.

La presenza nel prompt non garantisce che Claude lo rispetti.

| Campo (UI → dato) | Persistenza | Utilizzo reale | Effetto sull'AI | Evidenza | Aiuto necessario |
|---|---|---|---|---|---|
| Schema carico e scarico → `methodology_preferences.load_deload_pattern` | blob scheda | `parseLoadPattern` decide le fasi del calendario e le settimane di scarico salvate nel piano | Calcolato; **nessuno se il testo non è `N:M`** | codice + prova R7 | sì, critico (U-04) |
| Aumento min/max %, calo nello scarico % | blob scheda | variazione attesa nel calendario (`loadChangeText`), controllo `weeklyIssues`, tendenza del feedback | Calcolato + Controllo | codice | presente; aggiungere l'effetto sul controllo della proposta |
| Disponibile / Durata massima (min) per giorno | blob scheda | calendario per Claude, `parseProposal` (needs_review), ricontrollo nel pannello | Diretto + Controllo | codice | breve: «PCoach lo verifica sulle sedute proposte» |
| Attività abituale | blob scheda | calendario (`attivita_abituale`) | Diretto (preferenza, non verificata) | codice | presente nello schema, non in UI |
| Sessioni a settimana (obiettivo) | blob scheda | regola nel prompt; controllo `weeklyIssues` | Diretto + Controllo (solo avviso) | codice | sì |
| Distribuzione dell'intensità | blob scheda | regola nel prompt | Diretto, non verificato da PCoach | codice | sì: «non viene controllata sulla proposta» |
| Obiettivo principale → `periodization_model` | blob scheda | derivato; in `goals` nel prompt | Contesto | codice | presente |
| Eventi target: data, priorità, settimane di tapering, calo % | blob scheda | `raceEvents` → fasi «tapering»/«gara», giorno di gara nel calendario | Calcolato + Diretto | codice | presente; ricordare che senza data valida l'evento è ignorato |
| Sistema di zone (corsa, bici) | blob scheda | **nessun modulo lo legge** | Nessuno | codice (grep) | togliere o spiegare (U-10, D-UX-3) |
| Rilevazioni delle soglie (FTP, LTHR, passo, CSS) | blob scheda | solo l'**ultima per data** va nel prompt; l'FTP decide bici in potenza o in FC (`hasFtp`); FTP e LTHR confrontati con Intervals.icu nel feedback (scarto > 3%) | Contesto + Calcolato | codice | sì: «conta l'ultima rilevazione»; «senza FTP la bici è in frequenza cardiaca» |
| Volume attuale / picco 12 mesi, livello, anni | blob scheda | `disciplines` nel prompt | Contesto | codice | presente sui volumi |
| Calo degli allenamenti, fattori di vita, nota | blob scheda | nel prompt | Contesto | codice | sì: «Claude li usa per dosare il carico» |
| Note libere | blob scheda | **intere nel prompt** | Contesto | codice | sì, privacy (U-13) |
| Identità (nome, anno, sesso, altezza, peso) | blob scheda | nel prompt (l'email no) | Contesto | codice | sì, privacy; lo schema dice «usato per stime FC max», ma PCoach non le calcola |
| Email | blob scheda | solo per l'invio del feedback | Nessuno | codice | sì (U-09) |
| Chiave Intervals.icu | blob scheda (in chiaro) | sincronizzazione del carico, sedute svolte, invio delle sedute | Indiretto (carico recente nel prompt) | codice | presente |
| Modello | `app_settings.claude_model` | proxy e feedback; elenco chiuso | Diretto (quale modello) | codice | presente; valore non salvato usato subito (U-06) |
| Preferenze per generare il piano | `app_settings` (null = predefinito) | in coda alle regole fisse del prompt di sistema | Diretto, subordinato alle regole | codice + prova R5 | presente; dire che vale dalla prossima generazione **dopo il salvataggio** |
| Tono del feedback | `app_settings` | prompt del feedback (server) | Diretto sullo stile, non sul contenuto | codice | presente |
| Soglie del feedback (11 valori) | `app_settings.feedback_params` | classificazione delle sedute (server) e «Svolta / in parte» nel Piano (browser) | Calcolato (contratto del feedback) | codice | presenti; aggiungere esempi (vedi §8) |
| Ora del lunedì, Fuso orario | `app_settings` | finestra del cron, periodo della settimana | Nessuno (programmazione) | codice + prova R11 | fuso da selezionare, non da scrivere (U-05) |
| Invia via email | `app_settings` | consegna all'approvazione | Nessuno | codice | presente |
| Generazione: primo giorno, settimane, indicazioni, sedute da mantenere | `plan_generations` | prompt, `max_tokens` (4000 per settimana), vincoli fissi | Diretto | codice | presenti |
| Pannello: «Target espressi in» | `workouts.primary_target` | testo per Intervals.icu (potenza / FC / passo) | Nessuno sull'AI; decide la metrica sul calendario dell'atleta | codice | sì: «le zone sono quelle dell'account Intervals.icu dell'atleta» |
| Pannello: «Mantienila se ripianifico» | `workouts.locked` | seduta fissa nelle rigenerazioni | Diretto (vincolo fisso) | codice | presente |

## 8. Proposta di aiuti contestuali

**Componente**: uno solo, `FieldHelp`, in `components/ui/`.
- **Primo livello**: una riga sempre visibile sotto il campo (la `helper-text` esistente). È essenziale su mobile, dove non c'è hover.
- **Approfondimento facoltativo**: un `<details>` «Come lo usa PCoach». Funziona con tastiera e tocco senza codice né librerie, è annunciato dai lettori di schermo e resta nel flusso della pagina, quindi niente popover da posizionare.
- **Niente tooltip a comparsa**: il design system li esclude già (`design-ui.md`, IconButton e PasswordField senza `title`).

**Fonte dei testi**: un modulo `app/src/help/fieldHelp.ts` con chiavi uguali ai percorsi dello schema (ad esempio `methodology_preferences.load_deload_pattern`). Un test verifica che ogni chiave esista nello schema e che i campi marcati come «inviati a Claude» corrispondano a quelli che `buildAthleteContextForPrompt` include davvero. Le `description` dello schema restano la documentazione tecnica e vanno corrette dove sono imprecise (§10).

**Testi proposti** (primo livello / approfondimento):

| Campo | Primo livello | Approfondimento |
|---|---|---|
| Schema carico e scarico | «Settimane di carico e di scarico, ad esempio 3:1.» | «PCoach calcola da qui la fase di ogni settimana (carico 1 di 3, scarico…) e la passa a Claude. Se il formato non è riconosciuto le fasi non vengono calcolate.» Con la scelta D-UX-2 il campo diventa una selezione. |
| Sessioni a settimana | «Quante sedute vuoi in una settimana normale.» | «Claude deve rispettarle; se la proposta ne ha un numero diverso, l'anteprima lo segnala.» |
| Distribuzione dell'intensità | «Come si divide il tempo fra intensità basse e alte.» | «È un'indicazione per Claude: PCoach non la verifica sulla proposta.» |
| Durata massima (min) | «Il tempo massimo per allenarsi quel giorno.» | «PCoach controlla le sedute proposte: quelle che lo superano arrivano da verificare.» |
| Attività abituale | «Cosa fa di solito quel giorno, ad esempio “uscita in bici col gruppo”.» | «Claude la usa come preferenza, non come vincolo.» |
| Rilevazioni delle soglie | «Conta l'ultima rilevazione per data.» | «Senza un FTP la bici si pianifica in frequenza cardiaca. Le zone delle sedute sono quelle impostate su Intervals.icu; se FTP o soglia differiscono di oltre il 3% il feedback lo segnala.» |
| Note libere | «Informazioni utili non previste dagli altri campi.» | «Vengono inviate a Claude a ogni generazione insieme al resto della scheda (l'email no).» |
| Sezione Identità | — | «Nome, anno di nascita, sesso, altezza e peso vengono inviati a Claude per la generazione; l'email serve solo all'invio del feedback.» |
| Email | «Serve per inviare il feedback settimanale, se attivo in Impostazioni.» | — |
| Preferenze per generare il piano | testo attuale | aggiungere: «Valgono dopo il salvataggio, per le generazioni successive.» |
| Soglie del feedback | testo attuale | per ogni soglia un esempio. «Svolta da 80%: una seduta di 60 minuti conta come svolta da 48 minuti.» «In parte da 50%: fra 30 e 48 minuti è svolta in parte; sotto, molto più breve.» Precisare che decidono anche il badge «Svolta in parte» nel Piano. |
| Fuso orario | «Il fuso in cui valgono il lunedì e l'ora.» | — (con un selettore, l'errore non è più possibile) |
| Target espressi in | «La misura con cui l'atleta vede le zone su Intervals.icu.» | «Le zone sono quelle dell'account Intervals.icu dell'atleta; PCoach invia solo il numero di zona.» |

## 9. Problemi funzionali e architetturali (cause)

| ID | Causa | Livello |
|---|---|---|
| U-01 | La guardia delle modifiche è pensata solo per le bozze; manca un unico punto di uscita dalla scheda (cambio atleta, Impostazioni, uscita, chiusura) | frontend, orchestrazione |
| U-02 | `saveCurrent` aggiorna lo stato locale e l'istantanea anche in caso d'errore; `currentId` è impostato prima dell'esito; l'update senza versione nota non verifica le righe toccate | store |
| U-07 | La visibilità delle Impostazioni dipende da un `watch` sul profilo invece che da un'azione di navigazione | frontend |
| U-04 | Un parametro strutturato è modellato come testo libero | modello dati e UI |
| U-06 | Generazione e classificazione nel browser leggono lo store in modifica, non i valori salvati | orchestrazione AI |
| U-05 | Campo tecnico in testo libero, nessuna validazione né lato client né lato server | UI e backend |
| U-03 | Il pulsante non riflette lo stato asincrono che precede il passo «generating» | frontend |
| U-14 | Nessuno stato di navigazione persistente (URL) | architettura frontend |

## 10. Incoerenze documentali

| Dove | Problema | Correzione |
|---|---|---|
| [design-ui.md](../../design-ui.md) § Accessibilità | «Contrasto verificato per i token principali»: la coppia d'avviso non supera AA, i bordi non superano 1.4.11 | correggere dopo il ritocco dei token |
| design-ui.md § Componenti generici | ConfirmDialog descritto come «unico punto per conferme distruttive», ma è usato anche per conferme non distruttive con stile distruttivo | descrivere le due varianti dopo U-21 |
| design-ui.md § Tab Piano | «Struttura da verificare» descritto come stato della struttura, ma copre anche i vincoli di disponibilità | allineare dopo U-11 |
| `athlete_profile.schema.json` | `birth_year` e `biological_sex` «usati per stime (FC max…)», ma PCoach non fa stime e li invia solo a Claude; `zone_system` «configurazione», ma non è usato | correggere le descrizioni |
| `athletes.ts:94,154,168` | chip «Aggiorna» e `docs/DOCUMENTAZIONE.md` inesistenti | correggere commenti e messaggio |
| [sviluppo-deploy.md](../../sviluppo-deploy.md) § PWA | non cita il blocco in verticale né il comportamento all'apertura senza rete | aggiornare dopo D-UX-6 |
| [architettura.md](../../architettura.md) | non dice che la generazione usa la scheda e le impostazioni non salvate | aggiornare dopo D-UX-4 |

## 11. Backlog prioritizzato

| ID | Area | Priorità | Soluzione raccomandata | Test necessari | Decisione |
|---|---|---|---|---|---|
| U-01 | Scheda, sidebar | P1 | un'unica guardia `confirmLeaveProfile()` usata da cambio atleta, Impostazioni, nuovo atleta ed «Esci», più `beforeunload` se la scheda è modificata | e2e: modifica, cambio atleta, conferma (annulla e prosegui) | D-UX-1 |
| U-02 | Store atleti | P1 | in caso d'errore lasciare la scheda modificata, non toccare `currentId`/`athletes` finché l'insert non riesce, messaggio vero («Non salvato: …, riprova»); per l'update senza versione, verificare le righe toccate | unità sullo store con Supabase finto; e2e R3/R4 | no |
| U-07 | Navigazione | P1 | la selezione dell'atleta già aperto chiude le Impostazioni (navigazione esplicita, non un `watch`) | e2e R2 | no |
| U-04 | Profilo, generazione | P1 | selettore strutturato N carico : M scarico che produce la stessa stringa `N:M`; valore attuale non riconosciuto segnalato nel Profilo e nel dialogo di generazione | unità `parseLoadPattern`; e2e del dialogo con valore non valido | D-UX-2 |
| U-06 | Impostazioni, generazione | P2 | stato «modificato» e avviso all'uscita dalle Impostazioni; la generazione usa i valori salvati (o chiede di salvare) | e2e R5 | D-UX-4 |
| U-05 | Impostazioni, feedback | P2 | selettore dei fusi (`Intl.supportedValuesOf('timeZone')`), validazione nello store e fallback sicuro nel server (fuso non valido → Europe/Rome con errore registrato) | unità `localDayHour` con fuso non valido; e2e | no |
| U-03 | Generazione | P2 | pulsante disattivato con indicatore dall'inizio di `generate()` | e2e R6 | no |
| U-09 | Feedback | P2 | etichetta «Approva» e nota «L'atleta non ha un'email: aggiungila nel Profilo» quando manca l'indirizzo; niente «Riprova l'invio» per `skipped` senza email | e2e | no |
| U-10 | Profilo | P2 | togliere il campo dall'interfaccia, mantenendo il dato | — | D-UX-3 |
| U-11 | Piano | P2 | badge e filtro «Da verificare» con il motivo nel pannello | unità sui badge | no |
| U-13 | Profilo, privacy | P2 | aiuto «inviato a Claude» su Identità e Note | test di coerenza fra aiuto e prompt | D-UX-7 |
| U-14 | PWA, navigazione | P2 | atleta e tab nell'hash dell'URL (`#/atleta/ID/piano`), pannelli e dialoghi chiudibili con «indietro» | e2e: ricaricamento e ritorno alla stessa vista | D-UX-5 |
| U-15 | Mobile | P2 | testo dei campi a 16 px con `pointer: coarse` | screenshot; verifica su iPhone a cura del coach | no |
| U-16 | Accessibilità | P2 | scurire `--warning` nel tema chiaro (circa `#8A5E00`, da verificare ≥ 4,5:1); bordi dei campi ≥ 3:1 | calcolo dei contrasti come test unitario dei token | no |
| U-17 | Feedback | P2 | pulsante «Aggiorna» e aggiornamento automatico ogni 30 s finché ci sono valutazioni in preparazione | e2e | no |
| U-18 | Generazione | P2 | avvisi della proposta in un riquadro `--warning` con conteggio | e2e | no |
| U-19 | Pannello seduta | P2 | chiudere il pannello solo su conflitto di revisione; su errore di rete restare aperti con l'errore | e2e con errore 500 | no |
| U-12 | Header | P3 | «Salva» e stato visibili solo nella tab Profilo, o etichetta «Salva il profilo» | screenshot | no |
| U-20 | PWA | P3 | `orientation: 'any'` | — | D-UX-6 |
| U-21 | Componenti | P3 | `confirmDialog(..., { tone: "danger" \| "primary" })` | unità | no |
| U-22 | Tocco | P3 | altezza minima 44 px con `pointer: coarse` per chip, link-pulsante e caselle | misura automatica come in §4 | no |
| U-23 | Piano mobile | P3 | sotto i 560 px, «Prosegui» e «Ripianifica» in un'unica riga o in un menu «Pianifica» | screenshot 320 px | no |
| U-25 | Generazione manuale | P3 | pulsante «Copia il prompt»; «Indietro» scarta la generazione | e2e | no |
| U-26 | Editor struttura | P3 | «Sposta giù» anche dentro la ripetuta; etichette visibili compatte su mobile | e2e | no |
| U-27 | Testi | P3 | correggere il messaggio di conflitto e i commenti | — | no |
| U-31 | Impostazioni | P3 | conferma prima di ripristinare le preferenze personalizzate | — | no |
| U-28 | Qualità | P3 | aggiungere un linter (ESLint con `eslint-plugin-vue`) alla CI | — | no |

## 12. Piano di intervento

Ogni fase finisce con i test unitari, gli e2e (desktop e mobile), `vue-tsc` e la build, più gli screenshot a 320, 375, 768 e 1280 px per le modifiche visive. Le riproduzioni R1–R11 di questo audit diventano test e2e permanenti (`app/e2e/`).

1. **Sicurezza dei dati e navigazione** (U-01, U-02, U-07, U-19, U-27).
   - Criteri: nessuna modifica si perde senza una conferma esplicita; un salvataggio fallito resta visibile come non salvato e si può ripetere; dalle Impostazioni si torna all'atleta con un clic.
   - Dipendenza: D-UX-1.
2. **UI coerente con il comportamento** (U-04, U-05, U-06, U-03, U-09, U-10, U-11, U-17, U-18).
   - Criteri: ogni valore che influenza la generazione o il feedback è quello salvato; i campi tecnici non accettano valori che il sistema ignora o che lo bloccano.
   - Dipendenze: D-UX-2, D-UX-3, D-UX-4.
3. **Mobile e PWA** (U-14, U-15, U-20, U-22, U-23).
   - Criteri: ricaricando si torna alla stessa vista; «indietro» chiude pannelli e dialoghi; nessun campo sotto 16 px su touch; bersagli ≥ 44 px su touch.
   - Dipendenze: D-UX-5, D-UX-6.
4. **Aiuti contestuali** (§8, U-13).
   - Criteri: ogni campo della matrice con «aiuto necessario» ha il testo; il test di coerenza fra aiuti e prompt è superato.
   - Dipendenza: D-UX-7.
5. **Design system e accessibilità** (U-16, U-21, U-26, U-31).
   - Criteri: contrasti verificati da test; conferme non distruttive non in rosso.
6. **Documentazione** (§10, U-28): file di stato, ADR delle decisioni prese, changelog, in un commit dedicato.

## 13. Decisioni richieste

**D-UX-1 — Modifiche non salvate della scheda**
- Situazione: si perdono senza avviso (U-01).
- **A, conferma all'uscita** («Salva e continua» / «Esci senza salvare» / «Resta»), più `beforeunload`. Rischio basso; coerente con il «Salva» esplicito e con la concorrenza ottimistica.
- **B, salvataggio automatico** dopo qualche secondo. Niente da ricordare, ma ogni battitura scrive tutto il blob, i conflitti diventano più frequenti e l'annullamento delle modifiche richiede uno storico.
- Raccomandazione: **A**.
- Se si rinvia: resta un rischio di perdita dati quotidiano.

**D-UX-2 — Schema di carico e scarico**
- Situazione: testo libero; un formato diverso da `N:M` toglie le fasi in silenzio (U-04).
- **A, selettore** (carico 1–8, scarico 1–4) che scrive la stessa stringa `N:M`, senza migrazione. Un valore attuale non riconosciuto compare come «da scegliere». Si perde la possibilità di schemi non regolari, che oggi comunque non funzionano.
- **B, testo con validazione e avviso**. Mantiene la libertà di scrittura, che però resta inutile per il calcolo.
- Raccomandazione: **A**.

**D-UX-3 — «Sistema di zone»**
- Situazione: salvato e mai usato (U-10).
- **A**: toglierlo dall'interfaccia (il dato resta).
- **B**: renderlo efficace, cioè passarlo a Claude e adattare le zone delle sedute. Non è coerente con l'uso delle zone di Intervals.icu, che sono 7 per la potenza.
- Raccomandazione: **A**.

**D-UX-4 — Generazione con dati non salvati**
- Situazione: la generazione usa scheda e impostazioni in modifica (U-06).
- **A**: se ci sono modifiche, il dialogo propone «Salva e genera» oppure «Genera con i dati salvati».
- **B**: usare sempre e solo i dati salvati, senza chiedere.
- **C**: lasciare com'è, ma dirlo nel dialogo.
- Raccomandazione: **A**, che rende esplicito cosa riceve Claude e cosa resta tracciato in `plan_generations`.

**D-UX-5 — Stato nell'URL**
- Situazione: nessuno (U-14).
- **A**: stato nell'hash, gestito da un piccolo composable, senza nuove dipendenze. Copre ricaricamento, ripresa della PWA e «indietro».
- **B**: `vue-router`. Più strutturato, ma più codice da cambiare per tre viste.
- **C**: rinviare.
- Raccomandazione: **A**.

**D-UX-6 — Orientamento della PWA**
- Situazione: bloccato in verticale.
- **A**: libero. Su tablet e telefono in orizzontale il layout regge, come verificato a 740×360.
- **B**: lasciare il blocco.
- Raccomandazione: **A**.

**D-UX-7 — Dati personali inviati a Claude**
- Situazione: nome, cognome, dati fisici e note libere vanno a Claude, senza che l'interfaccia lo dica (U-13).
- **A**: lasciare tutto e dirlo negli aiuti.
- **B**: inviare solo il nome di battesimo (o «l'atleta») e l'età invece dell'anno di nascita, e dirlo negli aiuti.
- Raccomandazione: **B** se la riservatezza delle note e dell'identità conta per te, altrimenti **A**. È una scelta di prodotto e di privacy, non tecnica.

Le altre scelte di §11 (16 px sui campi, 44 px su touch, contrasti, selettore del fuso, varianti del dialogo di conferma, linter) sono tecniche e reversibili: le prendo io, salvo tua indicazione diversa.

## 14. Limiti dell'analisi

- Nessun dispositivo reale né WebKit/Safari: il comportamento iOS (zoom sui campi, standalone, tastiera) e l'installazione della PWA sono inferenze. La tastiera virtuale è stata simulata riducendo il viewport.
- Solo Chromium, solo il backend finto degli e2e: nessuna chiamata reale a Supabase, Claude o Intervals.icu. I tempi reali di rete e di generazione non sono stati osservati.
- Niente lettore di schermo né axe: l'accessibilità è verificata su codice, DOM e contrasti calcolati.
- Zoom al 200%, testo ingrandito dal sistema e orientamento su dispositivo non provati.
- `PW.md` non è stato letto, come previsto da [sicurezza.md](../../sicurezza.md).
- Le verifiche dell'audit sono script temporanei, non versionati. Il piano propone di trasformare le riproduzioni R1–R11 in test e2e permanenti.

## 15. Decisioni del coach (11 ottobre 2026)

| Decisione | Scelta |
|---|---|
| D-UX-1 | **A**: conferma all'uscita dalla scheda modificata («Salva e continua» / «Esci senza salvare» / «Resta») e avviso del browser alla chiusura |
| D-UX-2 | **A**: selettore N carico : M scarico che salva la stessa stringa `N:M` |
| D-UX-3 | **Renderlo efficace** (non l'opzione raccomandata): «gli allenamenti che produce devono essere allineati alla gestione delle zone che ho settato per quell'atleta». Il sistema di zone entra nel prompt, nei controlli della proposta e nell'editor della struttura |
| D-UX-4 | **A**: con modifiche non salvate la generazione chiede «Salva e genera» oppure «Genera con i dati salvati» |
| D-UX-5 | **B**: `vue-router` |
| D-UX-6 | **A**: orientamento libero |
| D-UX-7 | **B**: a Claude solo il nome di battesimo e l'età al posto dell'anno di nascita, con l'aiuto che lo dichiara |
| Procedura | commit dedicato del report, poi le fasi in commit separati con le riproduzioni R1–R11 come test e2e; pubblicazione solo con conferma finale |

Scelte tecniche conseguenti (mie, da confermare):
- la navigazione con `vue-router` passa nella fase 1, perché la protezione delle modifiche non salvate si appoggia alle sue guardie;
- cronologia con hash (`createWebHashHistory`), perché GitHub Pages non riscrive i percorsi e un ricaricamento su `/PCoach/atleta/...` darebbe 404;
- la riduzione dei dati personali (D-UX-7) vale anche per il feedback settimanale, che oggi invia a Claude nome e cognome.
