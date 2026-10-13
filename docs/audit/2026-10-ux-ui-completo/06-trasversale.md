# 06 — Problemi trasversali

**Quando leggerlo**: per i problemi che attraversano più pagine (aiuti contestuali, nomi degli stati, coerenza fra testi e comportamento), per i risultati di responsive e accessibilità e per la qualità del frontend e della documentazione. Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

## Aiuti e testi

<a id="ux-50"></a>
### UX-50 — Aiuti sempre visibili ovunque · P2

- **Osservabile**: l'ADR 0027 ha deciso «niente tooltip: l'essenziale si legge senza interazione». Ne viene una riga d'aiuto sempre visibile per ogni campo tecnico, più «Come lo usa PCoach». Oggi sono 51 blocchi nel Profilo (≈7.500 caratteri) e 36 nelle Impostazioni (≈4.000). Molte righe descrivono il campo invece di evitare un errore: «Quante sedute in una settimana normale», «Come si divide il tempo fra intensità basse e alte», «Informazioni utili non previste dagli altri campi». Sono testi in `--text-muted` alti quanto i campi e l'occhio li deve scavalcare.
- **Evidenza**: `misure.jsonl` (`helpers`, `helperChars`); `help/fieldHelp.ts`; screenshot `Profilo3.png`, `Profilo4.png`.
- **Verifica**: E, C.
- **Causa radice**: RC-1. La regola dell'ADR 0027 era giusta per pochi campi tecnici; applicata a tutti diventa rumore.
- **Soluzione** (D-04 A): `FieldHelp` con due livelli rivisti.
  - **Visibile** solo ciò che cambia cosa scrivi o evita un errore: un vincolo controllato, un dato che va a Claude, il significato del campo vuoto, un effetto bloccante.
  - **Nel `<details>`** il resto.
  
  Un campo `essential` in `fieldHelp.ts` decide quale testo resta visibile. L'ADR 0027 va aggiornata o superata.
- **Criteri**: caratteri d'aiuto visibili ridotti di almeno metà nel Profilo e nelle Impostazioni; nessun aiuto visibile che ripeta l'etichetta del campo.
- **Test**: unità su `fieldHelp.ts`: ogni voce `essential` è dichiarata con il motivo (vincolo, privacy, vuoto, blocco).

<a id="ux-51"></a>
### UX-51 — Nessun controllo che i testi corrispondano al comportamento · P2

- **Osservabile**: in questo audit ci sono quattro testi che descrivono un'interfaccia o una regola diversa da quella reale: UX-24, UX-33, UX-41, UX-45. `fieldHelp.test.ts` verifica solo cosa va a Claude.
- **Verifica**: C.
- **Causa radice**: RC-2.
- **Soluzione**:
  - le etichette dei pulsanti citate in aiuti e messaggi vengono da costanti condivise con i pulsanti;
  - un test raccoglie le citazioni «…» da `fieldHelp.ts` e dai componenti e verifica che esistano come etichette;
  - nella checklist di ogni ADR: «testi d'aiuto toccati».
- **Criteri**: il test fallisce se si rinomina un pulsante citato in un aiuto.

<a id="ux-20"></a>
### UX-20 — Nomi degli stati quasi uguali per cose diverse · P2

- **Osservabile**:

  | Etichetta | Significato | Dove |
  |---|---|---|
  | Da revisionare | seduta in bozza, non approvata | badge, filtro, avviso «Approva le N» |
  | Da verificare | seduta che viola un vincolo o dopo un cambio di zone, blocca l'invio | badge, filtro, anomalie |
  | Da rivedere | feedback in bozza da approvare | badge del feedback |
  | Revisione N | numero di versione della seduta o del feedback | pannello, feedback |
  | Da aggiornare su Intervals.icu | inviata, poi cambiata | badge |

  «Revisione 1» compare accanto a «Da revisionare» con un significato diverso. «Da verificare» e «Da revisionare» sono indistinguibili per chi non conosce il modello dati.
- **Evidenza**: `WorkoutBadges.vue`, `WeeklyReviews.vue:55-59`, `PlanTab.vue` (`FILTERS`), `runtime/1440-pannello-seduta.png`.
- **Verifica**: C, E.
- **Causa radice**: RC-4.
- **Soluzione** (D-03): glossario unico in `constants.ts`. Proposta: «Bozza», «Da verificare», «Feedback da approvare», «Versione N», «Da aggiornare su Intervals.icu».
- **Criteri**: nessuna etichetta di stato con la stessa radice («revision-», «verific-», «rived-») su assi diversi; un test sul glossario.

## Responsive

Larghezze provate: 1440×900, 1024×768 e 768×1024 al tocco, 390×844 e 320×640 al tocco, 640×450 come zoom al 200%.

| Controllo | Esito |
|---|---|
| Scorrimento orizzontale | nessuno da 390 px in su; **a 320 px sì in tutte le viste dell'atleta** (UX-03) |
| Campi a 16 px e controlli ≥ 44 px al tocco | rispettati a 320 px, salvo link nel testo (32 px) e `<summary>` (36 px), già accettati dall'audit precedente |
| Dialoghi su mobile | a tutto schermo, piede sempre visibile (`runtime/390-dialogo-prosegui.png`) |
| Pannello della seduta su mobile | usabile; contenuto lungo 2,7 schermi per una seduta con ripetute (UX-25) |
| Profilo su mobile | 10,6 schermi a 390 px, 14,1 a 320 (UX-30) |
| Zoom al 200% (approssimato) | Piano e Impostazioni senza traboccamenti; Impostazioni 4,4 schermi |
| Tablet | i layout a 768 e 1024 px sono quelli desktop con sidebar fissa; nessun problema specifico |

## Accessibilità

| Controllo | Esito | Verifica |
|---|---|---|
| Nomi accessibili di controlli e pulsanti | nessuno mancante, in tutte le viste e larghezze | E |
| Focus visibile | presente sui 25 elementi attraversati nella Panoramica | E |
| Ordine di tabulazione | naturale: sidebar, tab, contenuto | E (Panoramica) |
| Struttura dei titoli | manca un `h1` per pagina (UX-06) | C |
| Testo sotto 12 px | 7 testi del grafico (UX-13) | E |
| Contrasti | verificati dal test dei token (4 test, superati) | C |
| Tab con conteggio | il numero ha un `aria-label` («, 2 da sistemare») | C |
| Lettore di schermo, axe, dispositivi reali | **non verificati** | — |

Non si dichiara conformità WCAG.

## Qualità del frontend

<a id="ux-55"></a>
### UX-55 — `AthleteEditor.vue` contiene tutte le sezioni del Profilo · P3

- **Osservabile**: 717 righe, con le 10 sezioni del Profilo inline. Il selettore del sistema di zone è ripetuto tre volte. La posizione degli aiuti (UX-31) è un sintomo: il componente è troppo lungo per vedere a colpo d'occhio cosa segue cosa.
- **Verifica**: C.
- **Soluzione**: estrarre le sezioni in componenti (`ProfileThresholds`, `ProfileGoals`, …) **solo quando si interviene per UX-30**, che comunque richiede di avvolgerle in una sezione comprimibile. Non è un refactoring da fare a sé.

Altri punti tecnici, senza effetto visibile oggi: nessun linter (U-28 del precedente audit, ancora aperto); bundle sopra i 500 kB (solo un avviso di Vite).

<a id="d-doc"></a>
## D-DOC — Documentazione di stato disallineata dal codice · P2

La regola 7 di [CLAUDE.md](../../../CLAUDE.md) chiede di correggere sul posto. L'audit non modifica la documentazione esistente, quindi le segnalo:

| File | Testo attuale | Stato reale |
|---|---|---|
| [sviluppo-deploy.md § Test](../../sviluppo-deploy.md#test) | «153 test in 16 file», tabella per file, «38 test» e2e | 196 test in 19 file (eseguiti il 13 ottobre); 60 e2e (elenco di Playwright) |
| [limiti-roadmap.md § Struttura delle sedute](../../limiti-roadmap.md#struttura-delle-sedute) | «Le zone sono quelle impostate sull'account Intervals.icu… PCoach non le legge; il feedback confronta solo FTP e soglia… 3%» | PCoach legge e confronta zone e soglie (ADR 0029, 0030, 0033) e lo stesso file lo dice più sotto |

La tabella dei test per file è il tipo di dato che invecchia a ogni commit: conviene sostituirla con il comando che la produce e il solo totale.
