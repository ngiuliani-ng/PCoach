# 0038 — Bozza del feedback salvata in automatico e storico compatto

**Quando leggerlo**: prima di cambiare come il coach corregge, rigenera o approva il feedback settimanale, la colonna `weekly_reviews.coach_text` o la sostituzione del lunedì di una valutazione anticipata.

**Stato**: attiva. Completa [0019](0019-feedback-analisi-deterministica-approvazione.md); cambia la regola D-08 di quell'iniziativa per le bozze corrette dal coach.

## Contesto

La [verifica UI/UX del feedback](../audit/2026-10-feedback-settimanale-ui/README.md) ha trovato due modi di perdere il lavoro del coach senza avviso:
- **FB-01:** «Rigenera» buttava il testo corretto, anche quando la rigenerazione non riusciva;
- **FB-02:** uscendo dalla scheda, il testo corretto si perdeva, e la nuvola restava verde.

Ha trovato anche uno storico lungo fino a 3,4 schermi (FB-04) e alcuni messaggi sbagliati (FB-03). Il coach ha approvato tutte le soluzioni, compresa una modifica al server: il testo corretto si salva sul database.

## Decisione

1. **Testo del coach sul server**: due colonne nuove in `weekly_reviews` (migrazione `0014`):
   - `coach_text`: il testo della bozza corretto dal coach; resta vuota se il testo è uguale a quello di Claude;
   - `coach_text_at`: quando è stato salvato.

   L'app lo scrive con la RLS del coach, solo su una riga ancora `draft`. `output_text` resta il testo di Claude fino all'approvazione, che lo sostituisce con il testo approvato, come prima.
2. **Salvataggio automatico**: un secondo dopo l'ultima battuta e all'uscita dal campo. Sotto il campo non c'è nessuna scritta: lo stato lo mostra la nuvola dell'intestazione, rossa finché il testo non è salvato (decisione del coach). Se il salvataggio non riesce:
   - compare un messaggio d'errore, una volta sola;
   - si riprova alla modifica successiva;
   - uscendo dalla scheda si tenta ancora il salvataggio; se non riesce, l'app chiede «Esci senza salvare» oppure «Resta».
3. **Rigenera**: con il testo corretto chiede conferma («perdi le tue correzioni»). Il testo del coach si scarta solo se la rigenerazione riesce. Nessun «Ripristina il testo di Claude» (decisione del coach).
4. **Lunedì**: una valutazione anticipata non approvata viene sostituita dalla settimana conclusa (D-08 di 0019), **salvo se il coach ne ha corretto il testo** (`coach_text` presente). In quel caso decide lui con «Rigenera».
5. **Storico compatto**:
   - le settimane approvate e quelle non riuscite sono una riga che si apre con un clic;
   - l'email non partita e la valutazione non riuscita mostrano motivo e azione anche con la riga chiusa;
   - la bozza da approvare e quella in preparazione restano aperte;
   - una settimana senza sedute ha solo il suo stato.
6. **Preparare una settimana**: il selettore propone solo le settimane senza feedback; se non ce ne sono, una riga lo dice. Una settimana già approvata non risponde più «Valutazione in corso».

Scelte dell'assistente, confermate dal coach il 13 ottobre 2026:
- un secondo di attesa;
- il lunedì non sostituisce una bozza corretta;
- il contenuto della riga chiusa: settimana, stato, data d'invio o motivo dell'errore.

## Conseguenze

- Il testo corretto sopravvive a uscite, ricaricamenti e cambi di dispositivo. Due dispositivi aperti sulla stessa bozza: vince l'ultimo salvataggio.
- Lo stato delle bozze del feedback vive in `stores/reviews.ts` (`texts`, `unsavedText`); la guardia di navigazione e l'avviso alla chiusura della pagina lo considerano insieme al Profilo.
- `WeeklyReviews.vue` diventa l'elenco; ogni settimana è `FeedbackWeek.vue`; la frase dei conteggi è `domain/feedbackText.ts`.
- Ordine di pubblicazione: migrazione `0014` prima di `weekly-feedback`, che legge `coach_text`.
