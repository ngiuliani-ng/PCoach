# 0020 — Generazione delle sedute: regole nel codice, preferenze del coach, prompt salvato e modelli ammessi

**Quando leggerlo**: per capire perché il coach modifica solo le «preferenze» del piano e non il prompt intero, perché ogni generazione salva ciò che è stato inviato a Claude, perché il modello si sceglie da un elenco chiuso e perché l'app non rilegge la chiave di Claude.

**Stato**: attiva.

## Contesto

L'audit del 2026-10-11 ([docs/audit/2026-10-generazione-e-feedback/](../audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md)) ha verificato che:
- il prompt della generazione era un unico testo modificabile dal coach, con dentro regole di dominio, formato della risposta e preferenze. Togliendo il segnaposto del contesto, Claude non riceveva più il profilo dell'atleta, senza avvisi; con un testo vuoto non riceveva né dati né regole;
- il predefinito valeva solo finché la colonna era vuota: il primo salvataggio delle impostazioni lo scriveva nel database e da lì nessuna correzione del codice arrivava più;
- il prompt inviato non veniva salvato, né il modello effettivo, lo `stop_reason` o i token: un piano sbagliato non si poteva ricostruire;
- il modello era testo libero: i modelli Claude più recenti rifiutano lo strumento forzato del feedback, che avrebbe smesso di funzionare;
- l'app leggeva e mostrava la chiave di Claude, mentre la documentazione lo escludeva; `claude-proxy` accettava qualunque utente autenticato.

## Decisione

1. **Istruzioni separate** (decisione del coach D-01):
   - le regole di dominio e il formato della risposta sono nel codice (`PLAN_RULES` in `services/planPrompt.ts`) e vanno nel prompt di sistema;
   - il coach modifica solo le **preferenze metodologiche** (Impostazioni), aggiunte dopo le regole come testo che non può cambiarle;
   - i dati dell'atleta, il calendario, il motivo e le sedute fisse sono sempre nel messaggio, qualunque sia il testo del coach.
2. **Predefiniti vivi**: preferenze del piano e tono del feedback uguali al predefinito si salvano vuoti, così un miglioramento nel codice arriva a chi non li ha cambiati. Un template del vecchio formato viene ignorato. Il salvataggio delle impostazioni è bloccato se il caricamento non è riuscito.
3. **Generazione tracciabile** (migrazione `0008`): `plan_generations` salva istruzioni e messaggio inviati, versione del prompt (`PLAN_PROMPT_VERSION`), se le preferenze erano predefinite, `max_tokens`, modello effettivo, id della risposta, `stop_reason` e token.
4. **Modelli ammessi** (D-06): elenco chiuso in `_shared/claude/models.ts`, usato da Impostazioni, `claude-proxy` e `weekly-feedback`. Oggi contiene solo `claude-sonnet-4-5`, l'unico verificato con entrambi i flussi. Prima di aggiungere un modello recente va adattata la chiamata del feedback (niente `tool_choice` forzato) e provato il piano su atleti di prova.
5. **Chiave di Claude**: l'app non la rilegge; la scrive solo quando il coach ne inserisce una nuova e chiede se è configurata con `claude_key_configured()`.
6. **`claude-proxy`**: accetta le istruzioni di sistema, verifica che il chiamante sia il coach (lettura di `app_settings` con la sua RLS, come `weekly-feedback`), limita `max_tokens` a 20 000 e restituisce modello, `usage` e id.
7. **`fixed_activity`** (D-04): è l'abitudine attuale e Claude la usa come preferenza; non è un vincolo verificato. Schema, documentazione e regole del prompt dicono la stessa cosa.
8. **Date passate**: una proposta che parte da una data passata non si riprende e `apply_plan_generation` la rifiuta.

## Motivo

- Ciò che garantisce la correttezza di un piano (dati, vincoli, formato) non deve dipendere da un testo che si modifica come una preferenza.
- Senza il prompt salvato non si può diagnosticare un piano, misurare i troncamenti né confrontare due versioni delle istruzioni.
- Un elenco chiuso trasforma il cambio di modello in una scelta verificata invece che in un guasto silenzioso del feedback.

## Alternative scartate

- **Template unico con segnaposto obbligatori e validazione**: protegge i dati, non le regole; il coach potrebbe ancora cancellarle.
- **Salvare solo l'hash del prompt**: non permette di ricostruire cosa ha ricevuto Claude.
- **Log della Edge Function invece delle colonne**: meno interrogabili e non legati alla generazione.
- **Modello libero con avviso**: un errore di battitura o un modello incompatibile romperebbero comunque il feedback.
