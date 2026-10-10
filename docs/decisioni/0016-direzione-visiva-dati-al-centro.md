# 0016 — Direzione visiva: dati di allenamento al centro, scheda divisa in Panoramica e Profilo

**Quando leggerlo**: per capire perché la scheda atleta è divisa in due viste, perché le sezioni sono piatte e le card hanno un solo livello, perché colori, tipografia e spaziature sono token e perché il grafico del carico disegna il TSB come una banda.

**Stato**: attiva.

## Contesto

Una revisione della UI (2026-10-10) ha rilevato tre gruppi di problemi:

1. **Gerarchia invertita.** La scheda atleta era una colonna di 13 sezioni nell'ordine dei dati: identità e chiave API in cima; carico, piano e feedback (ciò che il coach consulta ogni giorno) in fondo. "Salva" stava solo in fondo alla pagina. Il TSB, il dato più utile per decidere, compariva solo nel tooltip del grafico.
2. **Regole già scritte in `design-ui.md` non rispettate dal codice**: righe della sidebar non raggiungibili da tastiera, toast di errore che sparivano da soli, dialog di conferma senza focus trap e con il pulsante sempre etichettato "Elimina" (anche per "chiudere senza salvare"), emoji al posto delle icone Lucide, etichette non associate ai campi, un colore hardcoded nella login.
3. **Linguaggio visivo generico**: card dentro card fino a tre livelli con raggi quasi uguali, stringhe di metadati unite da punti mediani, monospace usato per piccole etichette, dieci dimensioni di carattere senza una scala, colori con più significati (la serie CTL con lo stesso esadecimale della Z1, la Z3 quasi uguale all'accento in tema scuro, la Z4 uguale a `--warning`), date ISO e valori interni (`race_peak_taper`) a schermo.

## Decisione

1. **Il rischio visivo si spende sui dati**: la curva di forma e le barre a zone delle sessioni sono gli unici elementi visivamente forti; il resto è sobrio e piatto.
2. **Scheda atleta in due viste a tab**: *Panoramica* (carico e forma, piano, feedback) e *Profilo* (dati dell'atleta e gestione della scheda). Header sticky con nome, stato di salvataggio e "Salva", sempre raggiungibile. Le tre sezioni delle soglie diventano una sola, con un selettore di disciplina.
3. **Un solo livello di card**: sezioni piatte separate da un filetto; il bordo con raggio solo per le unità di contenuto. Le sessioni di una settimana sono righe dentro il blocco settimana, non card annidate.
4. **Token per scala tipografica (6 passi), spaziature (base 4px) e raggi (2 valori)**, oltre ai colori.
5. **Colori con un solo significato**: Z3 e Z7 ricolorate per staccarsi da accento e `--danger`; badge "Scarico" neutro; serie del grafico separate dalle zone (CTL in `--text`, ATL viola, TSB banda neutra attorno allo zero, allenamenti in una striscia separata).
6. **Monospace solo per chiavi, identificatori tecnici e JSON**; cifre tabulari ovunque.
7. **Conformità alle regole esistenti**: righe della sidebar come `<button>`, toast di errore persistenti con chiusura e regioni live, `ConfirmDialog` modale con focus trap ed etichetta di conferma obbligatoria, icone Lucide per le discipline, etichette associate ai campi, date e valori interni tradotti in testo leggibile.

Lo stato risultante è descritto in [design-ui.md](../design-ui.md).

## Motivo

Il coach apre una scheda per capire come sta l'atleta e cosa deve fare questa settimana: la vista che si apre per prima deve rispondere a questo. I dati del profilo si compilano di rado e possono stare in una seconda vista senza costare nulla. Le sezioni piatte e il livello unico di card rendono la struttura leggibile dal titolo e dallo spazio invece che dai bordi; i token impediscono che dimensioni e colori tornino a divergere componente per componente. Disegnare il TSB come banda rispetto allo zero ne rende leggibile il segno senza introdurre un colore "buono/cattivo", che si sarebbe confuso con le zone o con gli stati semantici.

## Alternative scartate

- **Riordinare le sezioni lasciando una pagina unica**: risolve l'ordine ma non la lunghezza (il grafico in cima e il salvataggio in fondo restano lontani) e non separa i dati da consultare da quelli da compilare.
- **Web font caricato da remoto per dare carattere alla tipografia**: scartato per restare coerenti con la scelta di non caricare risorse da terzi; il carattere viene dalla scala e dai pesi, non dal font.
- **Colorare il TSB (verde sopra lo zero, rosso sotto)**: scartato perché verde e rosso sono già zone (Z3, Z6) e stati (`--danger`); la posizione rispetto allo zero basta.
- **Rinnovare anche le tinte di fondo del tema scuro**: scartato per ora; `--surface` è legato al colore della finestra PWA ([0014](0014-colore-finestra-pwa-continuita-sidebar.md)) e cambiarlo non risolveva nessuno dei problemi rilevati.
