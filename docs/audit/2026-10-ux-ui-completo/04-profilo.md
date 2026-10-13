# 04 — Profilo dell'atleta

**Quando leggerlo**: per i problemi della tab Profilo (identità, Intervals.icu, discipline, soglie e zone, stato, obiettivi ed eventi, disponibilità, metodologia, note). Fotografia del 13 ottobre 2026.

Indice centrale: [README.md](README.md). Stato della verifica: **E** esecuzione, **C** codice, **S** solo screenshot, **I** ipotesi.

Evidenze: screenshot del coach `Profilo1.png`…`Profilo4.png` (dati reali, 1920 px, sezioni d'aiuto aperte) e `runtime/1440-profilo.png`, `runtime/390-profilo.png` (dati di prova).

## Problemi

<a id="ux-30"></a>
### UX-30 — Una colonna di 10 sezioni senza indice né livelli · P1

- **Osservabile**:
  - 10 sezioni in sequenza: Identità, Intervals.icu, Discipline, Soglie e zone, Stato di allenamento, Obiettivi (con gli eventi), Vincoli e disponibilità, Metodologia, Note, Gestione scheda;
  - con i dati di prova: 91 campi e 51 blocchi d'aiuto (≈7.500 caratteri), per 6,7 schermi a 1440 px, 6,8 a 768, 10,6 a 390 e 14,1 a 320;
  - nessun indice e nessun modo di chiudere una sezione;
  - i dati che il coach aggiorna spesso (nuova rilevazione di soglia, disponibilità della settimana, eventi) stanno in mezzo a quelli che si compilano una volta (identità, chiave, anni di pratica).
- **Evidenza**: `misure.jsonl` (`*-profilo`); `AthleteEditor.vue:361-715`; screenshot del coach.
- **Verifica**: E, S.
- **Causa radice**: RC-1.
- **Impatto**: per aggiornare una soglia si scorre fino a metà pagina; su telefono si scorrono 5-7 schermi. L'occhio non distingue i campi dai testi d'aiuto (UX-50). Il rischio di modifiche involontarie è basso (c'è «Salva»), ma il costo di ogni visita è alto.
- **Dipendenze**: D-02, D-04, UX-31, UX-32.
- **Soluzione raccomandata** (D-02 A):
  - indice delle sezioni sticky su desktop, a scomparsa su mobile;
  - ogni sezione comprimibile, con una riga di riepilogo quando è chiusa (per esempio «Soglie e zone: corsa 4:26/km, 7 zone; bici —; nuoto —», «Disponibilità: 6 giorni, max 90'»);
  - aperte di default le sezioni d'uso frequente (da confermare con il coach), le altre chiuse;
  - una sezione con un errore di validazione o un'anomalia si apre da sola.
- **Alternative**: sotto-schede (D-02 B); solo riordino.
- **Criteri**:
  - con le sezioni predefinite chiuse, il Profilo sta in ≤ 2,5 schermi a 1440 px;
  - ogni sezione si raggiunge con un clic dall'indice;
  - il link dalle anomalie («Aggiungila nel Profilo», «Cambia la chiave») apre la sezione giusta;
  - nessun dato si perde chiudendo una sezione con modifiche.
- **Test**: e2e su apertura e chiusura e sul link dalle anomalie; misura con lo script di cattura.

<a id="ux-31"></a>
### UX-31 — Aiuti ripetuti o lontani dal campo · P2

- **Osservabile**:
  - l'aiuto degli eventi target (3 righe + «Come lo usa PCoach») compare dentro **ogni** evento: con due eventi, due volte uguale (`Profilo2.png`);
  - l'aiuto del «Sistema di zone» compare **dopo** l'elenco delle rilevazioni e «Aggiungi rilevazione», non sotto il campo (`Profilo1.png`). Subito dopo c'è l'aiuto delle soglie: due aiuti diversi uno sotto l'altro, separati dal campo a cui si riferiscono.
- **Evidenza**: `AthleteEditor.vue:466-506` (FieldHelp dopo `MetricLogList`), `AthleteEditor.vue:630` (dentro il `v-for` degli eventi).
- **Verifica**: S, C.
- **Soluzione**: aiuto degli eventi una volta sola, sotto il titolo «Eventi target»; aiuto del sistema di zone subito sotto il suo campo.
- **Criteri**: nessun testo d'aiuto ripetuto nella stessa vista; ogni aiuto segue il campo che descrive.

<a id="ux-32"></a>
### UX-32 — Valori predefiniti che sembrano valori impostati · P2

- **Osservabile**: «Settimane di tapering» mostra «2» o «1» in grigio; «Aumento fra settimane di carico» mostra «5» e «10», «Calo nella settimana di scarico» «33». Sono segnaposto (campo vuoto = valore predefinito), ma a colpo d'occhio sembrano valori inseriti. Solo un aiuto in fondo dice «Vuote: 5-10% di aumento e 33% di calo». «Calo del volume nel tapering» invece usa una frase («lo decide Claude»): due convenzioni nella stessa unità.
- **Evidenza**: `Profilo2.png`, `Profilo4.png`; `AthleteEditor.vue:621, 688-696`.
- **Verifica**: S, C.
- **Impatto**: il coach non sa se ha impostato un valore o se vale quello predefinito. È rilevante perché sono parametri che cambiano il calendario del tapering e i controlli della proposta.
- **Soluzione**: segnaposto testuale «predefinito: 2», uguale per tutti i campi con un default.
- **Criteri**: nessun segnaposto composto solo da un numero (controllo automatico sui `placeholder` della vista).

<a id="ux-33"></a>
### UX-33 — L'aiuto delle soglie non dice cosa le blocca · P2

- **Osservabile**: «Come lo usa PCoach» delle soglie dice: «Il feedback segnala se FTP o soglia differiscono di oltre il 3% da quelli registrati su Intervals.icu». Da ADR 0030 e 0033, però, una soglia diversa da Intervals.icu (tolleranza 1 s/km, 1 s/100 m, 1 W) **ferma il feedback e l'invio delle sedute**, e una soglia mancante per uno sport praticato fa lo stesso. L'aiuto descrive l'effetto minore (l'avviso del 3% sulle attività, che esiste ancora in `contract.ts:318-323`) e tace quello bloccante.
- **Evidenza**: `help/fieldHelp.ts` (`physiological_thresholds.more`); `useAthleteAnomalies.ts` (gruppo `both`); [decisioni/0033](../../decisioni/0033-zone-e-soglie-bloccano-l-invio.md).
- **Verifica**: C.
- **Causa radice**: RC-2.
- **Soluzione**: «L'ultima rilevazione deve coincidere con la soglia su Intervals.icu: se è diversa, o manca per uno sport che l'atleta pratica, feedback e invio delle sedute si fermano (vedi Anomalie). Serve anche a stimare la durata degli step a distanza».
- **Criteri**: il testo cita gli effetti elencati nell'ADR 0033; test di coerenza (UX-51).

<a id="ux-35"></a>
### UX-35 — Testo tagliato nei selettori delle rilevazioni · P3

- **Osservabile**: «Tipo test» mostra «Time trial in camp…» a 1920 px.
- **Evidenza**: `Profilo1.png`.
- **Verifica**: S.
- **Soluzione**: colonne della rilevazione con larghezza minima per i `select`, oppure etichette più corte.
- **Criteri**: nessun valore tagliato a 1440 e 390 px.

## Osservazioni senza intervento

- Le icone che compaiono a destra di alcuni campi negli screenshot del coach non sono dell'app: le aggiunge un'estensione del browser. Non compaiono nelle catture con Chromium pulito.
- «Gestione scheda» in fondo è al posto giusto: azioni rare e distruttive lontane dal lavoro quotidiano.
