# 0022 — Gare e tapering calcolati da PCoach, controlli deterministici sulla proposta

**Quando leggerlo**: per capire come una gara cambia le fasi del piano (tapering, settimana di gara, ripartenza del ciclo), dove si impostano le settimane di tapering e quali regole del piano PCoach controlla dopo la risposta di Claude.

**Stato**: attiva. Integra [0018](0018-generazione-a-finestre-ciclo-ancorato.md) (fasi calcolate da PCoach).

## Contesto

L'[audit della generazione e del feedback](../audit/2026-10-generazione-e-feedback/PCOACH_GENERATION_AND_FEEDBACK_AUDIT.md) ha verificato che:
- le fasi del ciclo erano calcolate senza conoscere le gare: nella settimana di una gara il calendario poteva indicare «carico 3 di 3»; il tapering dipendeva solo da Claude, che secondo il coach ne introduceva comunque un minimo;
- delle regole del prompt PCoach verificava solo giorni disponibili e durata massima: numero di sedute a settimana e variazione di carico della fase non erano controllati;
- una seduta con struttura incompleta arrivava senza alcuna segnalazione, e salvarla nel pannello azzerava la verifica senza ricontrollare la disponibilità.

## Decisione

Decisioni del coach D-02 e D-03:
1. **Tapering gara per gara**: ogni evento target ha `taper_weeks` (0-4) e, facoltativo, `taper_volume_decrease_pct`. Senza valori valgono i predefiniti per priorità: A 2 settimane, B 1, C nessuna.
2. **Fasi**: la settimana che contiene la gara è «gara», le precedenti indicate sono «tapering». In quelle settimane il ciclo di carico è sospeso; dopo una gara A riparte da «carico 1», anche quando la gara cade fra l'ancora del piano attivo e l'inizio del periodo. Il calendario indica il giorno della gara e la riduzione; una regola fissa del prompt chiede di rispettarle e di non pianificare altre sedute quel giorno.
3. **Controlli sulla proposta** (`domain/planChecks.ts`), solo come avvisi nell'anteprima: sedute di una settimana completa diverse da `sessions_per_week_target`; variazione di volume fra due settimane consecutive del ciclo fuori da quella attesa per la fase (percentuali dell'atleta, tolleranza di 5 punti). Tapering, gara e raccordo non si controllano.
4. **Struttura incompleta**: la seduta arriva «da verificare» con il motivo. Nel pannello, salvare ricontrolla disponibilità e durata massima; approvare nonostante un vincolo non rispettato chiede conferma.

## Motivo

- Una gara è un dato certo: la fase che ne deriva deve essere calcolata e salvata come le altre, non dedotta ogni volta.
- Gli avvisi mostrano al coach dove la proposta si discosta dalle regole senza bloccarla: la decisione resta sua (D-02).

## Alternative scartate

- **Tapering scelto da Claude**: non verificabile e diverso a ogni generazione.
- **Durata del tapering ricavata dalla distanza della gara**: il campo «distanza o durata» è testo libero; il coach ha preferito impostarla gara per gara.
- **Rifiutare e rigenerare le proposte fuori regola**: più chiamate, più costo, e il coach perderebbe la possibilità di accettare consapevolmente uno scostamento.
