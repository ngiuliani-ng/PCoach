# 0024 — Interfaccia coerente con i dati usati: scheda salvata a Claude, campi tecnici vincolati

**Quando leggerlo**: prima di cambiare quali dati riceve la generazione, i campi «schema di carico e scarico» e «fuso orario», o le promesse dei pulsanti del feedback (invio, aggiornamento).

**Stato**: attiva.

## Contesto

L'[audit UI/UX di ottobre 2026](../audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md) ha verificato casi in cui l'interfaccia mostrava o prometteva qualcosa di diverso da ciò che il sistema usava:
- **U-04**: «Schema carico e scarico» era testo libero. Un valore non nella forma `N:M` toglieva in silenzio tutte le fasi del ciclo dal calendario inviato a Claude.
- **U-06**: la generazione usava la scheda in modifica e le Impostazioni non salvate, mentre il feedback del server usava quelle salvate.
- **U-05**: il fuso orario era testo libero. Un fuso non valido fa lanciare un'eccezione a `Intl` e avrebbe fermato ogni esecuzione del feedback automatico.
- **U-03**: un doppio clic su «Genera la proposta» creava due generazioni e due chiamate a Claude.
- **U-09**: con l'email attiva, il pulsante diceva «Approva e invia» anche per un atleta senza indirizzo; il server poi saltava l'invio e proponeva un «Riprova» inutile.
- **U-11**: «Struttura da verificare» indicava anche sedute fuori dalla disponibilità dell'atleta.
- **U-17**: una valutazione «in preparazione» chiedeva di ricaricare la pagina.
- **U-18**: gli avvisi sulla proposta erano testo grigio poco visibile.

## Decisione

Decisioni del coach D-UX-2 e D-UX-4, più scelte tecniche:
1. **Schema di carico e scarico**: due selettori, settimane di carico (1-8) e di scarico (1-4), che salvano la stessa stringa `N:M`, senza migrazione. Un valore salvato non riconosciuto è segnalato nel Profilo e nel dialogo di generazione.
2. **Dati della generazione**: Claude riceve la scheda salvata. Con modifiche non salvate, aprire la generazione chiede «Salva e genera» oppure «Genera con i dati salvati». Le Impostazioni sono sempre quelle salvate, perché uscirne con modifiche richiede di salvarle o scartarle ([0023](0023-navigazione-router-modifiche-non-salvate.md)).
3. **Fuso orario**: un elenco dei fusi riconosciuti dal browser; il salvataggio rifiuta un fuso non valido. Sul server `safeTimeZone` ripiega su `Europe/Rome`, così un valore sbagliato già salvato non ferma il feedback.
4. **Generazione**: «Genera la proposta» resta disattivato dal clic alla chiamata a Claude, e il dialogo non si chiude in quella fase.
5. **Feedback**: senza indirizzo dell'atleta il pulsante dice «Approva» con una nota, e al posto di «Riprova l'invio» c'è l'indicazione di aggiungere l'indirizzo. Le valutazioni in preparazione si rileggono da sole ogni 30 secondi, con «Aggiorna ora».
6. **Etichette e avvisi**: badge e filtro «Da verificare», con il motivo nel pannello; gli avvisi della proposta stanno in un riquadro d'avviso con il conteggio.

## Motivo

- Ciò che riceve Claude deve coincidere con ciò che è salvato e tracciato in `plan_generations`.
- Un campo tecnico che il sistema interpreta in un solo formato non deve accettarne altri in silenzio.

## Alternative scartate

- **Schema in testo libero con validazione**: lascia scrivere valori che il calcolo non usa.
- **Generazione sempre con i dati salvati, senza chiedere**: il coach non saprebbe che le modifiche appena fatte non sono state usate.
