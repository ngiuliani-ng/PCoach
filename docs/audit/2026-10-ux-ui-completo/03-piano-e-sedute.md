# 03 — Piano, sedute e dialoghi

**Quando leggerlo**: per i problemi della tab Piano (settimana e storico), del pannello della seduta, dell'editor della struttura e dei dialoghi di generazione e sincronizzazione. Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

## Cosa funziona

- La settimana è leggibile: una riga per giorno, «Riposo», «Oggi», barra della struttura come unico elemento forte (ADR 0016).
- Il pannello ha il piede sempre visibile e azioni che dicono cosa fanno («Salva e approva», «Segna verificata»).
- Generazione e sincronizzazione passano da un'anteprima confermata: nessuna scrittura sul calendario dell'atleta senza conferma.

## Problemi

<a id="ux-21"></a>
### UX-21 — Badge neutri sempre visibili nelle righe · P2

- **Osservabile**: una riga può avere «Approvata», «Da verificare», «Su Intervals.icu» e «Svolta» insieme. Nello storico quasi ogni riga ha 2 o 3 badge e quelli neutri, cioè lo stato normale, sono la maggioranza. Su 390 px vanno su due righe.
- **Evidenza**: `runtime/1440-piano-storico.png`, `runtime/390-piano-storico.png`; `WorkoutBadges.vue` (un badge per asse, sempre).
- **Verifica**: E.
- **Causa radice**: RC-4; la regola «un badge per asse» del design non distingue fra lista e dettaglio.
- **Impatto**: i badge d'avviso («Da verificare», «Da aggiornare») sono gli unici che chiedono un'azione, ma competono con quelli che confermano che tutto va bene.
- **Soluzione**: nella riga solo i badge che chiedono un'azione (`warn`, `err`) e quello d'esecuzione («Svolta», «Svolta in parte», «Non registrata»). «Approvata», «Su Intervals.icu» e «Revisione N» restano nel pannello. Per «tutto a posto» basta l'assenza di avvisi. Decisione D-03 (insieme ai nomi).
- **Alternativa**: badge neutri come sola icona con nome accessibile (meno rumore, ma un'icona sola si legge peggio).
- **Criteri**: una seduta approvata, inviata e non ancora svolta non ha badge nella riga; le informazioni restano nel pannello e nei filtri.
- **Test**: unità su `WorkoutBadges` per variante `row`/`detail`; screenshot.

<a id="ux-22"></a>
### UX-22 — Dodici filtri dello storico sempre visibili, anche a zero · P2

- **Osservabile**: «Tutte», «Da revisionare», «Da verificare», «Approvate», «Su Intervals.icu», «Da aggiornare», «Errori di sincronizzazione», «Svolte», «Svolte in parte», «Non registrate», «In programma», «Annullate o sostituite», ognuno con il conteggio, anche quando è 0. A 390 px occupano 5 righe (~150 px) prima delle sedute.
- **Evidenza**: `runtime/390-piano-storico.png`; `PlanTab.vue` (`FILTERS`).
- **Verifica**: E.
- **Soluzione**: nascondere i filtri a zero (salvo quello attivo) e raggrupparli per asse: approvazione, Intervals.icu, esecuzione. Su mobile un `select` per asse.
- **Alternativa**: solo nascondere quelli a zero (cambio minimo).
- **Criteri**: a 390 px i filtri occupano al massimo 2 righe con i dati di prova; il filtro attivo resta visibile anche se va a zero.

<a id="ux-23"></a>
### UX-23 — «Sincronizza settimana» disattivato senza motivo · P3

- **Osservabile**: in una settimana senza sedute il pulsante primario è grigio. Il motivo è scritto solo quando manca la chiave.
- **Evidenza**: `runtime/1440-piano-settimana.png`; `PlanTab.vue` (`:disabled="!hasKey || !inWeek.length"`).
- **Verifica**: E.
- **Soluzione**: nascondere il pulsante quando la settimana è vuota. Il messaggio «Nessuna seduta in questa settimana» basta.
- **Criteri**: nessun pulsante primario disattivato senza una spiegazione visibile.

<a id="ux-24"></a>
### UX-24 — Il dialogo «Prosegui il piano» consiglia di usare «Prosegui il piano» · P3

- **Osservabile**: nel dialogo aperto da «Prosegui il piano» il testo dice «Quando stanno per finire, usa «Prosegui il piano»…».
- **Evidenza**: `runtime/390-dialogo-prosegui.png`.
- **Verifica**: E.
- **Causa radice**: RC-2, un testo comune a tutti e tre i tipi di generazione.
- **Soluzione**: testo per tipo; in «Prosegui» basta «Al massimo 4 settimane per volta».

<a id="ux-25"></a>
### UX-25 — Editor della struttura: campi senza etichetta visibile, «fino a…» ambiguo · P3

- **Osservabile**: ogni step è una riga di controlli senza etichette visibili: tipo, durata, unità, zona, «fino a…», indicazione. Hanno un nome accessibile, ma a schermo non si capisce che «fino a…» è il limite superiore di un intervallo di zone. A 390 px ogni step occupa 3-4 righe e il corpo del pannello è lungo 2,7 schermi (1833 px contro 675 visibili).
- **Evidenza**: `runtime/1440-pannello-seduta.png`, `runtime/390-pannello-seduta.png`; `StepEditor.vue:131-141`; `misure.jsonl` (`pannello-seduta-scroll`).
- **Verifica**: E.
- **Soluzione**:
  - la zona come intervallo esplicito: «Z2» e, solo se serve, «fino a Z3» dietro un comando «Intervallo»;
  - etichette visibili compatte sopra il primo step di ogni gruppo su desktop e su ogni step su mobile.
- **Criteri**: un coach che non conosce l'editor capisce cosa imposta ogni campo senza aprire l'aiuto (da verificare con il coach).

<a id="ux-26"></a>
### UX-26 — Aiuto sempre visibile nel pannello d'uso quotidiano · P3

- **Osservabile**: sotto «Target espressi in» compaiono due righe d'aiuto e «Come lo usa PCoach» a ogni apertura del pannello, anche se è l'informazione che cambia meno.
- **Evidenza**: `runtime/1440-pannello-seduta.png`; `WorkoutDrawer.vue:252`.
- **Verifica**: E.
- **Soluzione**: con D-04 la riga va nel `<details>`.

## Osservazioni senza intervento

- La sincronizzazione una settimana alla volta è una scelta documentata ([limiti-roadmap.md](../../limiti-roadmap.md#sincronizzazione-delle-sedute-con-intervalsicu)). Con più atleti significa molte conferme, ma ogni conferma protegge il calendario dell'atleta: va rivista solo se il coach lo chiede.
- La barra degli strumenti a 1440 px va su due righe, con le azioni sotto il selettore Settimana/Storico (`runtime/1440-piano-settimana.png`). Non è un problema d'uso, ma una sola riga sarebbe più ordinata. Da sistemare solo se si tocca il Piano per UX-21 e UX-22.
