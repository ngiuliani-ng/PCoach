# 0035 — Pagina «Da fare», sezioni comprimibili, guida per gruppo e nomi degli stati

**Quando leggerlo**: prima di aggiungere una sezione o un campo a Profilo e Impostazioni, di scrivere un testo d'aiuto, di aggiungere uno stato di seduta o feedback, o di cambiare la pagina iniziale.

**Stato**: attiva. Supera [0027](0027-aiuti-contestuali-dei-campi.md) per la presentazione degli aiuti: `fieldHelp.ts` resta l'unica fonte dei testi.

## Contesto

L'audit UI/UX completo di ottobre 2026 ([README](../audit/2026-10-ux-ui-completo/README.md)) ha misurato l'accumulo di informazioni:
- Profilo: 91 campi e 51 blocchi d'aiuto, fino a 14 schermi su telefono;
- Impostazioni: 74 campi, fino a 4,6 schermi su desktop;
- nessun punto mostrava cosa chiedeva un'azione fra tutti gli atleti;
- stati con nomi quasi uguali per cose diverse.

Decisioni del coach del 13 ottobre 2026: D-01, D-02, D-03 e D-04, dettagliate nel [§10 dell'audit](../audit/2026-10-ux-ui-completo/README.md#10-decisioni-del-coach-13-ottobre-2026).

## Decisione

1. **Pagina iniziale «Da fare»** (D-01). Elenca per ogni atleta:
   - i feedback da approvare, non preparati o non inviati (ultime 4 settimane);
   - l'email mancante con l'invio attivo e le soglie mancanti;
   - le sedute da verificare e gli invii non riusciti;
   - le bozze delle prossime due settimane.
   
   Ogni voce porta al punto esatto (`?feedback=`, `?sezione=`, `?seduta=`, `?settimana=`). Nella barra laterale la voce «Da fare» (anche il marchio PCoach) riporta alla pagina. Ha l'unico contatore, globale: grigio se ci sono solo cose da approvare, giallo se c'è anche una sola anomalia da sistemare. Nessun numero accanto agli atleti, che confondeva (decisioni del coach). Zone e soglie diverse da Intervals.icu restano nella tab Anomalie: richiedono una lettura da Intervals.icu per atleta.
2. **Sezioni comprimibili con riepilogo** (D-02). Ogni sezione di Profilo e Impostazioni ha un'intestazione che apre e chiude; chiusa, mostra una riga di riepilogo. Sugli schermi larghi c'è un indice a destra.
   - Arrivando sulla pagina, anche per una bozza e cambiando atleta, le sezioni sono **tutte chiuse** (decisione del coach); nessuna memoria fra una visita e l'altra.
   - Le Impostazioni hanno due gruppi d'uso comune (Claude e generazione, Feedback settimanale), poi «Avanzate» (classificazione, intensità, modelli di zone), poi Informazioni.
   - Una sezione con un errore si apre da sola.
3. **Guida per gruppo** (D-04, sul modello di Garmin Connect). Sotto i campi non c'è testo d'aiuto: l'icona Info della sezione apre un pannello con una voce per campo. Il pannello sta nell'URL (`?guida=`) e «indietro» lo chiude senza perdere le modifiche. Nel pannello della seduta, dove un secondo livello sarebbe di troppo, un'icona Info apre il testo sotto il campo.
   - **Restano visibili**: errori di compilazione, il motivo di un campo disattivato, lo stato della chiave, il segnaposto «predefinito: N» dei campi che vuoti usano un valore predefinito.
   - **Le conseguenze che bloccano qualcosa** compaiono quando servono: come conferma prima dell'azione (cambio del sistema di zone con un piano in corso, salvataggio dei modelli di zone) o come anomalia finché il problema esiste.
4. **Glossario degli stati** (D-03), in `domain/workoutState.ts`: «Bozza», «Da verificare», «Da approvare» (feedback), «Versione N». Nelle righe delle sedute restano solo gli stati da sistemare e quello d'esecuzione. Lo storico filtra con un selettore raggruppato per asse al posto dei chip, come richiesto dal coach («non troppi chip»).

Confermate dal coach: le due settimane delle bozze, l'indice solo da 1360 px, la Panoramica che parte dal feedback quando ce n'è uno da approvare.

Scelte dell'assistente, da confermare:
- il contatore che conta una per una le sedute raggruppate, come la tab Anomalie, e considera anomalia tutto ciò che non è un'approvazione (errori e cose da sistemare);
- l'apertura automatica di una sezione con un errore, anche con le sezioni sempre chiuse.

## Conseguenze

- Componenti nuovi in `components/ui/`: `PageSection`, `SectionNav`, `GuidePanel`, `InfoToggle`. `FieldHelp.vue` è rimosso. Le guide sono in `help/guide.ts`.
- `fieldHelp.test.ts` verifica che ogni testo sia in una guida e che le etichette citate fra «» esistano nell'interfaccia.
- `useSections` non ricorda nulla: lo stato delle sezioni vive finché si resta sulla pagina.
- `stores/todo.ts` legge sedute, invii e feedback di tutti gli atleti a ogni cambio di pagina: tre query leggere, adatte al numero di atleti attuale.
