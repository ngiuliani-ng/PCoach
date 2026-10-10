# 0018 — Generazione a finestre di al massimo 4 settimane, con il ciclo di carico ancorato al piano

**Quando leggerlo**: per capire perché una generazione non supera 4 settimane, perché «Prosegui il piano» e «Ripianifica» sono azioni diverse, perché la fase di ogni settimana (carico, scarico) la calcola PCoach e non Claude, e come prosegue il ciclo tra una generazione e l'altra.

**Stato**: attiva.

## Contesto

Il 2026-10-10 un piano di 10 settimane è fallito con l'errore 546: Supabase interrompe una Edge Function dopo 150 secondi, e Claude impiega circa 25-30 secondi per settimana di sedute. La prima correzione ha diviso la generazione in parti di 2-3 settimane, chieste in sequenza e poi riunite.

Il piano di 12 settimane ottenuto così (ciclo 3:1) rispettava il ciclo solo in parte:
- le settimane 1-3 calavano invece di crescere;
- la settimana 11 era già scaricata;
- dalla settimana 3 il nuoto si dimezzava.

Ogni parte doveva dedurre da sola la propria posizione nel ciclo, senza conoscere il volume delle parti precedenti. Il piano inoltre partiva di domenica, quindi ogni parte andava da domenica a sabato.

## Decisione

1. **Una sola chiamata per generazione, di al massimo 4 settimane** (`MAX_PLAN_WEEKS`), cioè un ciclo 3:1 intero. La generazione a parti è stata eliminata. Le settimane successive si pianificano con «Ripianifica», partendo da ciò che l'atleta ha svolto.
2. **Fasi calcolate da PCoach** (`domain/planWeeks.ts`):
   - dallo schema di carico e scarico dell'atleta (`3:1`, `2:1`…) PCoach ricava numero e fase di ogni settimana di calendario;
   - le passa a Claude nel calendario del prompt;
   - le salva nel piano (`weeks_meta`: `is_deload` e `cycle_week`).
3. **Ciclo ancorato al piano attivo**:
   - la generazione successiva, o una ripianificazione a metà ciclo, riparte dall'ultima settimana del piano attivo con `cycle_week` noto, fino alla settimana della data di partenza;
   - senza piano attivo, il ciclo parte dalla settimana 1.
4. **Regole sulle fasi nel template modificabile** (`DEFAULT_PLAN_PROMPT`), accanto alle altre regole di metodo: carico crescente nelle settimane di carico, scarico di circa un terzo, ripartenza del ciclo successivo. Nel formato fisso resta solo come scrivere `weeks`.

## Correzione del 2026-10-11: «Prosegui il piano» separato da «Ripianifica»

Il punto 1 indicava «Ripianifica» per le settimane successive. Il coach ha fatto notare che proseguire un piano alla fine delle 4 settimane non è una ripianificazione: non cambia nulla e non c'è niente da sostituire. Le azioni sono quindi tre:
- **Genera il piano**: nessun piano attivo.
- **Prosegui il piano**: aggiunge settimane dal giorno dopo la fine del piano attivo o dell'ultima seduta attiva, mai prima di domani, senza sostituire nulla.
- **Ripianifica da…**: sostituisce le sedute da una data scelta, chiedendo cosa è cambiato e quali sedute tenere.

Lo storico delle generazioni le distingue con il tipo `continue` (migrazione `0006_generation_kind_continue.sql`).

## Motivo

- La coerenza di un piano nasce da un ragionamento unico. Ricucire più risposte con istruzioni di raccordo non è verificabile, se non a posteriori.
- Oltre 3-4 settimane un piano dettagliato raramente viene eseguito com'è. Pianificare a finestre, con «Ripianifica», i feedback settimanali e il carico da Intervals.icu, usa come base i dati reali invece di sedute ipotetiche.
- Una chiamata invece di 5-6 elimina i casi di errore parziale e la dipendenza dalla pagina aperta, riduce il costo dei token d'ingresso e semplifica il codice.
- Calcolare la fase in modo deterministico, e salvarla, è l'unico modo per far proseguire il ciclo tra finestre diverse.

## Alternative scartate

- **Generazione a parti in sequenza**: è la soluzione superata da questa decisione, per i motivi sopra.
- **Macro-piano più dettaglio per ciclo** (uno scheletro leggero di tutta la stagione, poi le sedute un ciclo alla volta): è la soluzione giusta se serve vedere la stagione intera in anticipo. È un'iniziativa a sé, rinviata finché non serve.
- **Piano a pagamento di Supabase**: secondo le informazioni disponibili porterebbe il limite a circa 400 secondi, da verificare sulla documentazione. In ogni caso sposta il tetto, non risolve la coerenza.
- **Generazione in background lato server**: risolve la pagina chiusa, non la coerenza; ogni chiamata resta legata al limite di durata.
- **Percentuali di progressione come campi della scheda atleta**: utile solo per differenziarle tra atleti. Per ora bastano le regole nel template.
