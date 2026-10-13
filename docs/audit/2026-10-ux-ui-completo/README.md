# Audit UI/UX completo di PCoach (13 ottobre 2026)

**Quando leggerlo**: per sapere dove l'interfaccia di PCoach è più faticosa da usare, quali problemi sono verificati e quali decisioni servono prima di intervenire. È una fotografia del 13 ottobre 2026 (commit `1a98ab3`): non descrive lo stato corrente dopo eventuali correzioni.

Richiesta: [PCOACH_UX-UI_AUDIT.md](PCOACH_UX-UI_AUDIT.md) e il requisito trasversale [PCOACH_UX-UI_REQUISITO_TRASVERSALE_AUDIT.md](PCOACH_UX-UI_REQUISITO_TRASVERSALE_AUDIT.md). L'audit precedente, [2026-10-ux-e-usabilita](../2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md), è chiuso: i suoi problemi U-xx risolti non sono ripetuti qui.

## Report per area

| File | Contenuto |
|---|---|
| [01-navigazione-e-struttura.md](01-navigazione-e-struttura.md) | barra laterale, scheda atleta (intestazione e tab), tab Anomalie, vista d'insieme fra atleti |
| [02-panoramica-e-feedback.md](02-panoramica-e-feedback.md) | carico e forma, settimana in corso, feedback settimanale |
| [03-piano-e-sedute.md](03-piano-e-sedute.md) | settimana, storico, pannello della seduta, editor della struttura, dialoghi |
| [04-profilo.md](04-profilo.md) | scheda dell'atleta da compilare |
| [05-impostazioni.md](05-impostazioni.md) | impostazioni globali |
| [06-trasversale.md](06-trasversale.md) | aiuti contestuali, terminologia, responsive, accessibilità, qualità del frontend, documentazione |
| [07-versionamento-e-changelog.md](07-versionamento-e-changelog.md) | requisito trasversale: versione nell'interfaccia, fonte del dato, CHANGELOG, processo di rilascio |
| [evidence/](evidence/) | screenshot forniti dal coach (radice) e generati dall'audit (`runtime/`), misure (`runtime/misure.jsonl`), script di cattura |

## 1. Sintesi esecutiva

PCoach funziona ed è tecnicamente curato: nessun errore in console, nessun controllo senza nome accessibile, focus visibile su tutti gli elementi provati, bersagli di 44 px al tocco, nessuno scorrimento orizzontale da 390 px in su. Il problema non è la qualità dei singoli componenti ma **come si sono accumulati**.

Ogni decisione recente (zone allineate, soglie, modelli di zone, domini d'intensità, anomalie) ha aggiunto campi, avvisi e testi d'aiuto alla pagina che già esisteva, sempre allo stesso livello gerarchico. Il risultato si misura:

| Pagina | Campi | Blocchi d'aiuto (caratteri) | Lunghezza a 1440 px | a 390 px |
|---|---|---|---|---|
| Profilo | 91 | 51 (≈7.500) | 6,7 schermi | 10,6 schermi |
| Impostazioni (sezioni chiuse) | 74 | 36 (≈4.000) | 2,2 schermi | 2,8 schermi |
| Impostazioni (sezioni aperte, come negli screenshot) | 74 | 36 | 4,6 schermi | 6,8 schermi |

I cinque punti con il maggiore beneficio:

1. **Non esiste un punto che dica cosa richiede attenzione fra tutti gli atleti** (UX-01, P1). Il lunedì, per rivedere i feedback e controllare le anomalie, il coach deve aprire ogni atleta e cambiare tab.
2. **Profilo e Impostazioni sono pagine lineari senza indice né livelli** (UX-30, UX-40, P1). Dati che si toccano ogni settimana e dati che si impostano una volta stanno sullo stesso piano. Le tre sezioni sul feedback, nelle Impostazioni, sono separate fra loro.
3. **Alcuni testi d'aiuto non dicono più la verità** (UX-41, UX-33, UX-45). Il più rilevante, P1: i modelli di zone in Impostazioni, oltre ad allineare Intervals.icu, stimano la durata di tutte le sedute a distanza, ma il testo non lo dice. Inoltre cita un pulsante che non esiste.
4. **Gli stati hanno nomi quasi uguali per cose diverse** (UX-20): «Da revisionare», «Da verificare», «Da rivedere», «Revisione N». Nelle righe delle sedute, poi, i badge neutri competono con quelli che chiedono un'azione (UX-21).
5. **La versione dell'app non è identificabile** (V-01). `package.json` dice `0.0.0`, non ci sono tag, ogni push su `main` va in produzione e le Edge Function hanno numeri di versione propri, scollegati dal codice.

Sono stati trovati anche un difetto latente di coerenza nel feedback (UX-11: atleta senza email con l'invio attivo, oggi non si verifica in produzione) e un traboccamento della barra delle tab a 320 px (UX-03).

## 2. Inventario delle pagine e dei flussi

**Route** (`router.ts`, cronologia con hash):

| Route | Componente | Note |
|---|---|---|
| `/` | `EmptyState` | «Scegli un atleta», «Nessun atleta», «Caricamento…» |
| `/impostazioni` | `SettingsPanel` (+ `ZoneModelsEditor`) | guardia «modifiche non salvate» |
| `/atleta/nuovo` | `AthleteEditor` (bozza) | tab Panoramica, Piano, Profilo; si apre sul Profilo |
| `/atleta/:id/:tab?` | `AthleteEditor` | tab `panoramica`, `piano`, `profilo`, `anomalie` |
| `?seduta=ID` | `WorkoutDrawer` (+ `StepEditor`, `StructureBar`) | pannello a destra o a tutto schermo |
| `?dialogo=genera\|prosegui\|ripianifica` | `RegenerateDialog` | parametri, proposta, differenze, applicazione; ramo manuale «Copia il prompt» |
| `?dialogo=sincronizza` | `SyncWeekDialog` | anteprima, scelte per conflitti, esiti |
| (fuori dal router) | `LoginView`, `ToastHost`, `ConfirmDialog` | login unico coach; conferme `confirmDialog`/`choiceDialog` |

**Flussi principali ricostruiti**:

| Flusso | Punto d'ingresso | Verifica |
|---|---|---|
| Accesso ed uscita | `LoginView`, «Esci» in sidebar | codice (login reale non usato) |
| Creare, modificare, salvare, esportare ed eliminare un atleta | «Nuovo atleta», tab Profilo, «Gestione scheda», «X» in sidebar | esecuzione (finto) + codice |
| Carico da Intervals.icu | chiave nel Profilo, apertura della scheda | codice; finto senza dati reali |
| Generare, proseguire, ripianificare | tab Piano | esecuzione fino all'apertura del dialogo; resto coperto dagli e2e esistenti |
| Rivedere, modificare, approvare una seduta | riga → pannello | esecuzione |
| Sincronizzare la settimana con Intervals.icu | «Sincronizza settimana» | codice + e2e esistenti |
| Feedback settimanale: preparare, rivedere, approvare, rigenerare, reinviare | Panoramica | esecuzione (finto) + codice del server |
| Anomalie: zone, soglie, chiave, sedute da verificare, invii falliti, feedback fermi | tab Anomalie | esecuzione (finto) + codice |
| Impostazioni globali (Claude, preferenze, tono, soglie, modelli di zone, orario) | icona ingranaggio | esecuzione (finto) + screenshot del coach |

**Ruoli**: un solo utente coach ([limiti-roadmap.md](../../limiti-roadmap.md#autenticazione-mono-utente)); l'atleta non usa l'app. Non ci sono differenze di permessi da verificare.

## 3. Copertura dell'audit

| Area | Codice | Esecuzione | Screenshot del coach | Note |
|---|---|---|---|---|
| Sidebar, header, tab | sì | sì (5 larghezze) | sì | |
| Panoramica e feedback | sì (anche `pipeline.ts`) | sì | no | dati finti |
| Piano: settimana, storico | sì | sì | no | |
| Pannello seduta, editor struttura | sì | sì | no | |
| Dialoghi generazione e sincronizzazione | sì | apertura | no | il flusso completo è negli e2e esistenti (60 test), non rieseguito |
| Profilo | sì | sì | sì (4) | |
| Anomalie | sì | sì | no | |
| Impostazioni | sì | sì | sì (6) | |
| Login | sì | **no** | no | la sessione finta entra direttamente |
| Grafico del carico | parziale | sì | no | interazione al tocco non provata |
| PWA installata, iOS, Android, lettore di schermo | no | **no** | no | non verificabile con gli strumenti disponibili |

Larghezze verificate: 1440×900 (desktop), 1024×768 e 768×1024 (tablet, tocco), 390×844 e 320×640 (telefono, tocco), 640×450 come approssimazione dello zoom al 200% su 1280×900.

**Strumenti disponibili e usati**: Playwright 1.56 con Chromium già installato, lanciato da uno script nello scratchpad (copia in `evidence/runtime/cattura.audit.ts.txt`) che riusa il backend finto degli e2e (`app/e2e/mockBackend.ts`) con dati arricchiti: due atleti, eventi, 60 giorni di carico, una seduta da verificare, un feedback approvato con email non partita. Vitest (196 test, tutti superati). MCP Supabase in sola lettura: versioni delle Edge Function, migrazioni applicate e due conteggi aggregati sui feedback.

**Skill**: è disponibile `frontend-design:frontend-design`, che riguarda la progettazione visiva di nuove interfacce. Per un audit senza implementazione non è stata caricata: le regole di riferimento sono quelle del progetto ([design-ui.md](../../design-ui.md)). `run` e le skill del browser (Chrome, browser integrato) servono a pilotare l'app reale e non sono state usate: si è scelto il backend finto per non toccare dati reali. Non ci sono skill di accessibilità o di design review. axe non è installato e non è stato installato (vincolo dell'audit).

## 4. Problemi più rilevanti

Elenco completo con evidenze e criteri di accettazione nei report per area. Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

| ID | P | Area | Problema | Verifica |
|---|---|---|---|---|
| [UX-01](01-navigazione-e-struttura.md#ux-01) | P1 | Navigazione | Nessuna vista di ciò che richiede attenzione fra gli atleti (feedback da rivedere, anomalie, bozze) | C, E |
| [UX-40](05-impostazioni.md#ux-40) | P1 | Impostazioni | Pagina lineare: 74 campi allo stesso livello, sezioni del feedback separate, nessun indice | E, S |
| [UX-41](05-impostazioni.md#ux-41) | P1 | Impostazioni | I modelli di zone stimano anche la durata delle sedute a distanza: il testo non lo dice e cita un pulsante inesistente | C |
| [UX-30](04-profilo.md#ux-30) | P1 | Profilo | 6,7-14 schermi, 91 campi e 51 aiuti in una colonna, senza indice né livelli per frequenza d'uso | E, S |
| [UX-11](02-panoramica-e-feedback.md#ux-11) | P2 | Feedback | Atleta senza email: «il feedback resta solo qui», poi badge rosso e anomalia «non inviato» | C, E (stato iniettato) |
| [UX-20](06-trasversale.md#ux-20) | P2 | Terminologia | «Da revisionare», «Da verificare», «Da rivedere», «Revisione N» | C, E |
| [UX-10](02-panoramica-e-feedback.md#ux-10) | P2 | Panoramica | Il feedback da rivedere sta in fondo, dopo grafico, settimana e «Prepara il feedback» | E |
| [UX-21](03-piano-e-sedute.md#ux-21) | P2 | Piano | Fino a 3 badge per riga, quelli neutri sempre visibili | E |
| [UX-22](03-piano-e-sedute.md#ux-22) | P2 | Storico | 12 filtri sempre visibili, anche a zero | E |
| [UX-33](04-profilo.md#ux-33) | P2 | Profilo | L'aiuto delle soglie tace che una soglia diversa da Intervals.icu ferma feedback e invio | C |
| [UX-32](04-profilo.md#ux-32) | P2 | Profilo | Valori predefiniti mostrati come placeholder che sembrano valori impostati | S, C |
| [UX-50](06-trasversale.md#ux-50) | P2 | Aiuti | Aiuti sempre visibili ovunque: il testo d'aiuto compete con i campi | E, C |
| [UX-03](01-navigazione-e-struttura.md#ux-03) | P2 | Responsive | A 320 px la barra delle tab trabocca, il numero delle anomalie è tagliato | E |
| [V-01](07-versionamento-e-changelog.md#v-01) | P2 | Versione | Nessuna versione identificabile nell'app né nel processo di rilascio | C |

## 5. Incoerenze e cause radice trasversali

| Causa | Problemi | Descrizione |
|---|---|---|
| **RC-1 Accumulo per aggiunta** | UX-30, UX-40, UX-31, UX-50, UX-26 | Ogni nuova regola aggiunge una sezione o un testo nella pagina esistente, senza rivedere la gerarchia. Non c'è una primitiva per pagine lunghe (indice, sezioni comprimibili con riepilogo, area «avanzate»). |
| **RC-2 Testi non vincolati al comportamento** | UX-41, UX-33, UX-45, UX-24, D-DOC | Aiuti e descrizioni citano etichette e regole a mano. `fieldHelp.test.ts` controlla solo cosa va a Claude, non le etichette citate né gli effetti. Quando una regola cambia, il testo resta indietro. Lo stesso vale per due file di stato della documentazione. |
| **RC-3 Attenzione calcolata per atleta** | UX-01, UX-10, UX-14 | Anomalie e feedback si calcolano solo per l'atleta aperto (`useAthleteAnomalies`, `reviews.current`). Il prodotto ha più atleti, ma l'interfaccia non ha un livello «tutti». |
| **RC-4 Terminologia degli stati non governata** | UX-20, UX-21 | Le etichette nascono componente per componente (`WorkoutBadges`, `WeeklyReviews`, filtri dello storico). Non esiste un glossario. |
| **RC-5 Release senza identità** | V-01…V-05 | Frontend pubblicato a ogni push, Edge Function e migrazioni pubblicate a mano, nessuna versione condivisa. |

**Incoerenze reali** (non giustificate dal contesto): conferma presente su un ripristino e assente sugli altri due (UX-42); eliminazione dell'atleta in due posti con icone diverse (UX-04); aiuto del tono scritto a mano invece che con `FieldHelp` (UX-46); punto mediano nelle etichette, che le regole grafiche escludono (UX-43).

**Differenze giustificate**, da non uniformare: il Profilo ha «Salva» esplicito mentre la seduta ha un pannello con i suoi pulsanti (entità diverse, ADR 0017); «Sincronizza settimana» lavora una settimana alla volta per scelta ([limiti-roadmap.md](../../limiti-roadmap.md#sincronizzazione-delle-sedute-con-intervalsicu)); le azioni che scrivono su Intervals.icu sono pulsanti, quelle che portano altrove sono link (ADR 0031).

## 6. Raccomandazioni sul design system e sui pattern condivisi

1. **Pagina lunga con indice** (per Profilo e Impostazioni, UX-30 e UX-40): un indice delle sezioni (ancore, sticky su desktop, a scomparsa su mobile) e sezioni comprimibili che, chiuse, mostrano una riga di riepilogo del contenuto («Corsa: 4:26/km, 7 zone»). Lo stato aperto/chiuso si ricorda per sessione. Un solo componente (`SectionNav` + `CollapsibleSection`), non soluzioni per pagina.
2. **Area «Avanzate»** per i parametri che cambiano i calcoli e si toccano raramente (soglie del feedback sulla qualità dei dati, domini d'intensità, modelli di zone): chiusa di default, con un riepilogo («Valori predefiniti» oppure «3 valori personalizzati») e un avviso sugli effetti.
3. **Aiuto a due livelli rivisto** (UX-50): resta visibile solo la riga che evita un errore; la descrizione generica passa nel `<details>` o diventa un pulsante Info (`aria-expanded`, funziona al tocco). Serve rivedere l'ADR 0027 (decisione D-04).
4. **Glossario degli stati** in `constants.ts`, usato da badge, filtri, anomalie e feedback (UX-20), con un test che vieta etichette duplicate fra assi diversi.
5. **Testi che citano l'interfaccia**: le etichette dei pulsanti citate negli aiuti vengono dalle stesse costanti dei pulsanti, e un test verifica che ogni «…» citato in `fieldHelp.ts` esista (UX-51).
6. **Valori predefiniti visibili come tali** (UX-32): un pattern unico «vuoto = predefinito (N)» con il testo nel placeholder (`predefinito: 2`) o una nota sotto il campo, mai il solo numero grigio.
7. **Ripristini**: un solo comportamento. Conferma se si perdono valori personalizzati e perimetro scritto nel pulsante: «Ripristina tutte le soglie del feedback (anche quelle avanzate)».

## 7. Decisioni richieste

Le decisioni sono raggruppate in un unico momento. Per ognuna: problema, alternative, raccomandazione, domanda.

**D-01 — Vista d'insieme degli atleti** (UX-01)
- Problema: ciò che chiede un'azione (feedback da rivedere, anomalie, bozze da approvare) si scopre solo aprendo ogni atleta.
- A, **indicatori nella sidebar**: accanto al nome un numero o un'icona per «feedback da rivedere» e «anomalie». Poco spazio e nessuna nuova pagina. Le anomalie di zone e soglie però richiedono una lettura da Intervals.icu per atleta, oggi fatta solo all'apertura.
- B, **pagina «Da fare»** come home (`/`, oggi «Scegli un atleta»): un elenco per atleta di ciò che chiede un'azione, con link diretti. È più chiara e usa una pagina oggi vuota, ma è più codice.
- C, entrambe.
- Raccomandazione: **B**, più un indicatore minimo in sidebar (solo «feedback da rivedere» e sedute da verificare, che sono già nel database). Le anomalie di Intervals.icu restano calcolate all'apertura della scheda, oppure si spostano in un controllo lato server: va deciso a parte.
- Domanda: vuoi una pagina iniziale «Da fare» con tutti gli atleti? Gli indicatori in sidebar servono anche, o bastano lì?

**D-02 — Pattern per Profilo e Impostazioni** (UX-30, UX-40)
- A, **indice + sezioni comprimibili con riepilogo** (§6.1), nella stessa pagina. Il salvataggio resta unico e le guardie esistenti non cambiano.
- B, **sotto-schede** (Profilo: «Atleta», «Soglie e zone», «Obiettivi e vincoli», «Metodo»; Impostazioni: «Generazione», «Feedback», «Zone»). Più ordine, ma un livello di navigazione in più e i campi di sezioni diverse non sono più visibili insieme.
- C, solo riordino e area «Avanzate».
- Raccomandazione: **A** per il Profilo, **A + riordino** per le Impostazioni (gruppi «Claude e generazione», «Feedback settimanale» con orario, email e tono in alto, poi le soglie in «Avanzate», infine «Zone e Intervals.icu» in «Avanzate»).
- Domanda: va bene A? Quali sezioni del Profilo tocchi davvero ogni settimana? Propongo soglie, disponibilità ed eventi aperte di default e le altre chiuse con il riepilogo.

**D-03 — Nomi degli stati** (UX-20, UX-21)
- Proposta:
  - «Bozza» al posto di «Da revisionare»;
  - «Da verificare» resta per i vincoli;
  - «Feedback da approvare» al posto di «Da rivedere»;
  - «Versione N» al posto di «Revisione N».
- Nelle righe delle sedute restano solo i badge che chiedono un'azione e quello d'esecuzione; «Approvata» e «Su Intervals.icu» si vedono nel pannello.
- Alternativa: tenere i nomi e cambiare solo i badge.
- Domanda: approvi i nomi? Preferisci altre parole, per esempio quelle che usi con gli atleti?

**D-04 — Aiuti contestuali** (UX-50; rivede l'ADR 0027)
- A, resta visibile solo la riga che evita un errore; il resto va in «Come lo usa PCoach».
- B, un pulsante Info per campo al posto della riga visibile.
- C, lasciare com'è.
- Raccomandazione: **A**. Vanno fuori dalla riga visibile le spiegazioni che non cambiano cosa scrivi, per esempio «Quante sedute in una settimana normale». Restano quelle con un effetto: vincoli, dati inviati a Claude, valori vuoti.
- Domanda: va bene A?

**D-05 — Atleta senza email con l'invio attivo** (UX-11)
- Raccomandazione: approvare senza chiedere l'invio (`send = false`, come la nota promette) e non segnalarlo come anomalia. Un'alternativa è tenere il comportamento attuale e cambiare la nota. È una correzione del flusso, non solo del testo: per questo la chiedo.
- Domanda: confermi?

**D-06 — Eliminazione dell'atleta dalla sidebar** (UX-04)
- Raccomandazione: togliere la «X» dalla sidebar e lasciare «Elimina scheda» nel Profilo.
- Domanda: confermi?

**D-07 — Preferenze di generazione in linguaggio tecnico** (UX-44)
- Le regole con `distance_m`, `duration_sec` e «cue» passerebbero dalle preferenze modificabili alle regole fisse del prompt (`planPrompt.ts`). Le preferenze restano in linguaggio da coach.
- Cambia il prompt (nuova `PLAN_PROMPT_VERSION`), non il risultato atteso.
- Domanda: va bene?

**D-08 — Versionamento** (dettaglio in [07](07-versionamento-e-changelog.md#7-decisioni-da-sottoporre))
- Semantic Versioning con la versione in `package.json`, tag Git `vX.Y.Z` e sezione `Unreleased` nel CHANGELOG.
- Nella sidebar, in basso, «v1.0.0» e il commit; in Impostazioni una sezione «Informazioni» con versione, commit, data di build e link alle note di rilascio.
- Domande: da che versione partiamo (raccomando `1.0.0`, perché l'app è in uso)? Le versioni del backend (Edge Function) vanno mostrate?

**D-09 — Cartella dell'audit**: `2026-13-…` non è un mese valido per la convenzione `AAAA-MM-argomento`, e `2026-10-ux-e-usabilita` esiste già. Propongo di rinominarla `2026-10-ux-ui-completo`. Non l'ho rinominata perché l'hai creata tu.

Scelte che prendo io senza chiedere, salvo indicazione diversa: correzione dei testi d'aiuto falsi (UX-33, UX-41, UX-45, UX-24), traboccamento delle tab a 320 px (UX-03), riga della settimana in Panoramica che apre la seduta (UX-12), conferma uniforme sui ripristini (UX-42), filtri a zero nascosti (UX-22), documentazione disallineata (D-DOC).

## 8. Roadmap di intervento

Ogni fase si chiude con: test unitari, e2e desktop e mobile, `vue-tsc` e build; nuove misure con lo script di cattura confrontate con la tabella del §1; screenshot a 1440, 768, 390 e 320 px.

| Fase | Contenuto | Dipende da | Criterio misurabile |
|---|---|---|---|
| 0. Verità dei testi e piccoli difetti | UX-03, UX-12, UX-24, UX-33, UX-41 (testo), UX-42, UX-45, UX-46, UX-43; documenti di stato (D-DOC); test che verifica le etichette citate negli aiuti (UX-51) | nessuna | nessuna etichetta citata inesistente (test); nessun traboccamento a 320 px con 4 tab e un numero a due cifre |
| 1. Attenzione fra atleti | UX-01, UX-10, UX-14 | D-01 | il lunedì, dalla home, ogni feedback da approvare è a un clic; nella Panoramica il feedback da approvare è il primo contenuto sotto le tab |
| 2. Profilo e Impostazioni | UX-30, UX-31, UX-32, UX-40, UX-41 (avviso sugli effetti), UX-44, UX-50 | D-02, D-04, D-07 | Impostazioni ≤ 1,5 schermi a 1440 px con le sezioni avanzate chiuse; Profilo con le sezioni chiuse ≤ 2,5 schermi a 1440 px; caratteri d'aiuto visibili ridotti di almeno la metà; ogni sezione raggiungibile in un clic dall'indice |
| 3. Stati e Piano | UX-20, UX-21, UX-22, UX-23, UX-25, UX-26 | D-03 | nessuna etichetta di stato duplicata fra assi (test); al massimo 2 badge per riga in condizioni normali; filtri dello storico ≤ 1 riga a 390 px quando nessun filtro è a zero |
| 4. Feedback e sidebar | UX-11, UX-04 | D-05, D-06 | e2e con email attiva e atleta senza indirizzo: nessun badge d'errore né anomalia |
| 5. Versionamento | V-01…V-05 | D-08 | la build mostra versione e commit; il controllo in CI fallisce se `Unreleased` è vuoto o il tag non corrisponde a `package.json` (dettagli in 07) |

Le fasi 0 e 5 sono indipendenti e si possono fare subito. La fase 2 è la più grande e conviene dopo la fase 0, perché sposta testi che la fase 0 corregge.

## 9. Limiti delle verifiche

- **Backend finto**: le pagine sono state eseguite con `mockBackend.ts` e dati di prova, non con i 4 atleti reali. Lunghezze e densità del Profilo reale, con più rilevazioni ed eventi, sono maggiori: lo mostrano gli screenshot del coach.
- **Solo Chromium in emulazione**: niente Safari/WebKit, niente dispositivi reali, niente PWA installata. Zoom al 200% approssimato con un viewport di 640×450, non con lo zoom del browser.
- **Accessibilità**: verificate nomi accessibili, focus visibile, ordine di tabulazione (solo Panoramica, 25 passi), dimensioni dei bersagli e testo sotto 12 px con script propri. Non provati lettore di schermo e axe. Non si dichiara conformità WCAG.
- **Login** non eseguito; dialoghi di generazione e sincronizzazione aperti ma non completati in questa sessione (li coprono i 60 e2e esistenti, non rieseguiti).
- **Produzione**: lette solo le versioni delle Edge Function, le migrazioni e due conteggi aggregati sui feedback, in sola lettura. Nessun dato personale estratto.
- `PW.md` (credenziali, non tracciato) non andava letto ([sicurezza.md](../../sicurezza.md)). Durante l'esplorazione iniziale ne ho visualizzato per errore l'inizio, con i valori solo in parte mascherati dal comando. Non è stato usato per nessuna verifica: la sessione di prova è quella finta degli e2e.
- Nessun file del codice, della documentazione esistente o del database è stato modificato.

## 10. Decisioni del coach (13 ottobre 2026)

| Decisione | Scelta |
|---|---|
| D-01 | **Sì**: pagina iniziale «Da fare» con tutti gli atleti |
| D-02 | **Sì**: indice e sezioni comprimibili con riepilogo per Profilo e Impostazioni, parametri tecnici in «Avanzate» |
| D-03 | **Sì** ai nuovi nomi, con un vincolo: pochi filtri nello storico del piano |
| D-04 | **Diversa dalle opzioni proposte**: come in Garmin Connect, le informazioni di ogni gruppo di dati non si vedono di default e si aprono da un'icona Info in alto a destra; da progettare senza appesantire. Proposta in attesa di conferma |
| D-05 | **Diversa dalla raccomandazione**: con l'invio email attivo in Impostazioni, un atleta senza email è un'anomalia; la scheda si salva comunque anche senza email. Tab Anomalie: un unico elenco senza gruppi (prima ciò che è fallito, poi ciò che va sistemato), ogni voce con una riga «Ferma: …» |
| D-06 | **Sì**: via la «X» dalla sidebar |
| D-07 | Chiesto un chiarimento |
| D-08 | **Sì** a `1.0.0` e pubblicazione sui tag; chiesto dove si mostra la versione |
| D-09 | **Sì**: cartella rinominata `2026-10-ux-ui-completo` |
| GitHub | Repository e pubblicazione restano come sono |
