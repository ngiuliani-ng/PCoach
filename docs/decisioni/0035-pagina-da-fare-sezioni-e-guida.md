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
   
   Ogni voce porta al punto esatto (`?feedback=`, `?sezione=`, `?seduta=`, `?settimana=`). Accanto a ogni atleta, nella barra laterale, il numero di cose da fare. Zone e soglie diverse da Intervals.icu restano nella tab Anomalie: richiedono una lettura da Intervals.icu per atleta.
2. **Sezioni comprimibili con riepilogo** (D-02). Ogni sezione di Profilo e Impostazioni ha un'intestazione che apre e chiude; chiusa, mostra una riga di riepilogo. Sugli schermi larghi c'è un indice a destra. Le sezioni aperte si ricordano per la sessione del browser.
   - Nel Profilo partono aperte Soglie e zone, Obiettivi, Vincoli e disponibilità; una bozza si apre tutta.
   - Le Impostazioni hanno due gruppi d'uso comune (Claude e generazione, Feedback settimanale), poi «Avanzate» (classificazione, intensità, modelli di zone), poi Informazioni.
   - Una sezione con un errore si apre da sola.
3. **Guida per gruppo** (D-04, sul modello di Garmin Connect). Sotto i campi non c'è testo d'aiuto: l'icona Info della sezione apre un pannello con una voce per campo. Il pannello sta nell'URL (`?guida=`) e «indietro» lo chiude senza perdere le modifiche. Nel pannello della seduta, dove un secondo livello sarebbe di troppo, un'icona Info apre il testo sotto il campo.
   - **Restano visibili**: errori di compilazione, il motivo di un campo disattivato, lo stato della chiave, il segnaposto «predefinito: N» dei campi che vuoti usano un valore predefinito.
   - **Le conseguenze che bloccano qualcosa** compaiono quando servono: come conferma prima dell'azione (cambio del sistema di zone con un piano in corso, salvataggio dei modelli di zone) o come anomalia finché il problema esiste.
4. **Glossario degli stati** (D-03), in `domain/workoutState.ts`: «Bozza», «Da verificare», «Da approvare» (feedback), «Versione N». Nelle righe delle sedute restano solo gli stati da sistemare e quello d'esecuzione. Lo storico filtra con un selettore raggruppato per asse al posto dei chip, come richiesto dal coach («non troppi chip»).

Scelte dell'assistente, da confermare:
- le sezioni aperte di default;
- le due settimane delle bozze;
- l'indice solo da 1360 px;
- il numero in sidebar che conta una per una le sedute raggruppate, come la tab Anomalie;
- la Panoramica che parte dal feedback quando ce n'è uno da approvare, deciso all'apertura della scheda.

## Conseguenze

- Componenti nuovi in `components/ui/`: `PageSection`, `SectionNav`, `GuidePanel`, `InfoToggle`. `FieldHelp.vue` è rimosso. Le guide sono in `help/guide.ts`.
- `fieldHelp.test.ts` verifica che ogni testo sia in una guida e che le etichette citate fra «» esistano nell'interfaccia.
- `useSections` usa `sessionStorage` solo come comodità: senza, valgono le sezioni predefinite.
- `stores/todo.ts` legge sedute, invii e feedback di tutti gli atleti a ogni cambio di pagina: tre query leggere, adatte al numero di atleti attuale.
