# 05 — Impostazioni

**Quando leggerlo**: per i problemi della pagina Impostazioni (Claude, preferenze di generazione, tono e soglie del feedback, modelli di zone, feedback automatico). Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

Evidenze:
- screenshot del coach `Impostazioni1.png`…`Impostazioni6.png` (dati reali, tutte le sezioni aperte);
- `runtime/1440-impostazioni.png` (sezioni chiuse, come all'apertura);
- `runtime/1440-impostazioni-tutto-aperto.png` e `runtime/390-impostazioni-tutto-aperto.png`.

## Inventario della pagina

| Sezione | Campi | Uso | Effetto |
|---|---|---|---|
| Claude | chiave, modello | una volta | generazione e feedback |
| Preferenze per generare il piano | testo | raro | prompt di ogni generazione |
| Tono del feedback settimanale | testo | raro | testo per l'atleta |
| Soglie del feedback | 5 visibili + 4 «qualità dei dati» + 6 «intensità per sistema di zone» | quasi mai | classificazione delle sedute e del feedback |
| Zone su Intervals.icu | 4 misure × 1-3 sistemi: 37 limiti e 10 modelli | quasi mai | allineamento zone **e stima della durata** (UX-41) |
| Feedback settimanale automatico | ora, fuso, email | una volta | pianificazione e invio |

Totale 74 campi e 36 blocchi d'aiuto (≈4.000 caratteri): 2,2 schermi a 1440 px con le sezioni chiuse, 4,6 con le sezioni aperte; 2,8 e 6,8 a 390 px.

## Problemi

<a id="ux-40"></a>
### UX-40 — Tutto allo stesso livello, feedback diviso in tre punti · P1

- **Osservabile**:
  - le sei sezioni hanno lo stesso peso visivo;
  - le impostazioni del feedback sono in tre sezioni non consecutive: «Tono» (3ª), «Soglie» (4ª) e «Feedback settimanale automatico» (6ª), con le zone in mezzo;
  - la sezione che si usa davvero (ora, fuso, email) è l'ultima;
  - i parametri avanzati, che cambiano i calcoli per tutti gli atleti, sono accanto alla chiave di Claude;
  - non c'è un indice; aperte le sezioni avanzate, la pagina raddoppia.
- **Evidenza**: `misure.jsonl` (`*-impostazioni*`); `SettingsPanel.vue`; screenshot del coach.
- **Verifica**: E, S.
- **Causa radice**: RC-1. Ogni ADR (0019, 0028, 0029) ha aggiunto una sezione in fondo o in mezzo.
- **Impatto**: per una modifica ordinaria, come attivare l'email o cambiare il tono, il coach attraversa decine di parametri tecnici. Chi apre una sezione avanzata per curiosità vede 37 numeri senza sapere quali effetti hanno.
- **Soluzione raccomandata** (D-02):
  1. **Claude e generazione**: chiave, modello, preferenze.
  2. **Feedback settimanale**: ora, fuso, email, tono.
  3. **Avanzate**, chiusa, con un riepilogo per gruppo («Valori predefiniti» oppure «2 valori personalizzati»):
     - regole di classificazione del feedback;
     - domini d'intensità;
     - modelli di zone, con il loro effetto (UX-41).
  
  Indice in alto se la pagina resta oltre 2 schermi. Il salvataggio resta unico.
- **Alternative**: sotto-schede; pagina separata «Zone e calcoli».
- **Criteri**:
  - con «Avanzate» chiusa, la pagina sta in ≤ 1,5 schermi a 1440 px;
  - tutte le impostazioni del feedback sono in una sola sezione;
  - il riepilogo di «Avanzate» dice se ci sono valori diversi dai predefiniti.
- **Test**: e2e che modifica un valore avanzato e verifica il riepilogo; misura con lo script di cattura.

<a id="ux-41"></a>
### UX-41 — I modelli di zone cambiano la durata stimata delle sedute, ma il testo non lo dice · P1

- **Osservabile**: il testo della sezione dice «Servono per «Allinea Intervals.icu a PCoach»: quando un atleta ha su Intervals.icu un numero di zone diverso…».
  - Il pulsante citato non esiste: l'azione reale si chiama «Porta Intervals.icu a N zone».
  - Il testo tace l'effetto principale. Gli stessi limiti, salvati, servono a stimare il passo di ogni zona, quindi la durata degli step a distanza di corsa e nuoto (ADR 0030). Da qui dipendono:
    - i totali delle sedute e della settimana nell'app;
    - il controllo della durata massima del giorno, che segna le sedute «Da verificare» e quindi ne blocca l'invio;
    - l'anteprima di «Sincronizza settimana»;
    - l'abbinamento delle attività e il feedback.
  - Cambiare un limite, quindi, cambia questi calcoli per **tutti** gli atleti, senza avviso.
- **Evidenza**:
  - `ZoneModelsEditor.vue:37-41`;
  - `stores/athletes.ts:51-53` (`paceContexts` dai modelli salvati);
  - `intervals-sync/index.ts:195` (`paceContextOf(..., resolveZoneModels(zoneModels))`);
  - `_shared/feedback/pipeline.ts:211`;
  - `useAthleteAnomalies.ts:188` (etichetta reale);
  - [limiti-roadmap.md § Feedback settimanale](../../limiti-roadmap.md#feedback-settimanale), che lo dice.
- **Verifica**: C.
- **Causa radice**: RC-2. L'effetto è stato aggiunto con l'ADR 0030, dopo il testo scritto con l'ADR 0029.
- **Impatto**: le informazioni essenziali per evitare un errore mancano proprio dove l'errore si fa. È il caso che l'audit chiede di non nascondere.
- **Soluzione**:
  - testo corretto: «Limiti delle zone in percentuale della soglia. PCoach li usa per stimare il passo, e quindi la durata degli step a distanza, per tutti gli atleti, e li scrive su Intervals.icu con «Porta Intervals.icu a N zone»»;
  - al salvataggio di un modello cambiato, una conferma che dice l'effetto. Non ho verificato se, dopo un cambio di modello, i «Da verificare» per durata già presenti si ricalcolano (I). Va controllato, e semmai deciso, quando si implementa, come per il cambio di sistema di zone (ADR 0029).
- **Criteri**: il testo nomina gli effetti dell'ADR 0030 e l'etichetta reale; un test verifica che l'etichetta citata esista (UX-51).

<a id="ux-42"></a>
### UX-42 — Tre ripristini, tre comportamenti · P2

- **Osservabile**:
  - «Ripristina le preferenze predefinite» chiede conferma se il testo è personalizzato;
  - «Ripristina i valori predefiniti» (soglie del feedback) e «Ripristina i modelli predefiniti» non chiedono nulla;
  - il primo dei due rimette anche i valori dentro le sezioni chiuse, che il coach non vede.
- **Evidenza**: `SettingsPanel.vue` (`resetPreferences`, `resetParams`); `ZoneModelsEditor.vue` (`resetModels`).
- **Verifica**: C.
- **Mitigazione esistente**: nulla si salva senza «Salva impostazioni», e all'uscita compare l'avviso delle modifiche non salvate.
- **Soluzione**: stessa regola per tutti (conferma se ci sono valori personalizzati) e perimetro nel pulsante: «Ripristina tutte le soglie del feedback».
- **Criteri**: ogni ripristino che sostituirebbe valori personalizzati chiede conferma, con l'elenco dei gruppi coinvolti.

<a id="ux-43"></a>
### UX-43 — Etichette con punto mediano e griglie ripetitive · P3

- **Osservabile**: «3 zone · bassa fino alla zona», «5 zone · modello», contrari alla regola «niente stringhe di metadati unite da punti mediani». I domini d'intensità sono sei campi su tre righe: si leggerebbero meglio come una tabella (righe 3/5/7 zone, colonne «bassa fino a» e «media fino a»).
- **Evidenza**: `Impostazioni3.png`; `SettingsPanel.vue:128-138`, `ZoneModelsEditor.vue:46`; [design-ui.md § Direzione visiva](../../design-ui.md#direzione-visiva).
- **Verifica**: S, C.
- **Soluzione**: tabella con intestazioni (`<th scope>`) e campi etichettati dall'intersezione.
- **Criteri**: nessun «·» nelle etichette; la tabella è navigabile da tastiera e ha nomi accessibili completi.

<a id="ux-44"></a>
### UX-44 — Preferenze modificabili in linguaggio tecnico · P3

- **Osservabile**: le preferenze predefinite contengono `distance_m`, `duration_sec` e «cue», nomi dei campi del formato di risposta. Sono testo che il coach può modificare o cancellare, e l'aiuto stesso dice che il formato «lo aggiunge PCoach».
- **Evidenza**: `runtime/1440-impostazioni.png`; `constants.ts:154-159`.
- **Verifica**: E, C.
- **Soluzione**: le due regole tecniche vanno nelle regole fisse di `planPrompt.ts`; nelle preferenze resta «Ripetute di corsa e nuoto di solito a distanza, di bici a tempo; allunghi di circa 100 m». Decisione D-07 (cambia il prompt).

<a id="ux-45"></a>
### UX-45 — Etichetta citata che non esiste · P3

- **Osservabile**: sotto la sezione Claude: «Senza chiave, «Genera piano» copia il prompt negli appunti». I pulsanti si chiamano «Genera il piano», «Prosegui il piano», «Ripianifica da…», e la copia avviene in tutti e tre.
- **Evidenza**: `SettingsPanel.vue:85`; `RegenerateDialog.vue:178`.
- **Verifica**: C.
- **Soluzione**: «Senza chiave, la generazione copia il prompt negli appunti: lo incolli in Claude e incolli qui la risposta».

<a id="ux-46"></a>
### UX-46 — Aiuti scritti fuori dal sistema degli aiuti · P3

- **Osservabile**:
  - l'aiuto di «Tono del feedback», il testo della sezione zone e quello del feedback automatico sono paragrafi scritti nel componente, non voci di `fieldHelp.ts`, quindi i test sugli aiuti non li vedono;
  - l'aiuto della chiave Claude è uno `span` non collegato al campo (`aria-describedby` assente).
- **Evidenza**: `SettingsPanel.vue:82-85, 96, 166`; `ZoneModelsEditor.vue:37`.
- **Verifica**: C.
- **Soluzione**: portarli in `fieldHelp.ts` (regola già scritta in [design-ui.md § Componenti generici](../../design-ui.md#componenti-generici-componentsui)) e collegare l'aiuto della chiave.
