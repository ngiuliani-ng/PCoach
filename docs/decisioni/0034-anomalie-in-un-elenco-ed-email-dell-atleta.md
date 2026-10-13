# 0034 — Anomalie in un solo elenco; email dell'atleta obbligatoria con l'invio attivo

**Quando leggerlo**: prima di aggiungere un tipo di anomalia, di cambiare l'ordine della tab «Anomalie» o di toccare la regola sull'email dell'atleta.

**Stato**: attiva. Cambia la presentazione della tab decisa in [0031](0031-anomalie-dell-atleta-in-una-tab.md) (gruppi per ciò che fermano) e la regola sull'atleta senza email; le regole di [0029](0029-zone-allineate-con-intervals.md), [0030](0030-soglie-allineate-e-stima-della-durata.md) e [0033](0033-zone-e-soglie-bloccano-l-invio.md) restano.

## Contesto

L'audit UI/UX di ottobre 2026 ([UX-11](../audit/2026-10-ux-ui-completo/02-panoramica-e-feedback.md#ux-11)) ha trovato un'incoerenza. Con l'invio email attivo e un atleta senza indirizzo, la bozza diceva «il feedback resta solo qui». Dopo l'approvazione, però, compariva un errore rosso e un'anomalia «approvato ma non inviato». L'audit proponeva di approvare senza tentare l'invio. Il coach ha deciso diversamente: «La mail ci deve essere, quindi è un'anomalia». Ha anche chiesto di ripensare i gruppi della tab Anomalie, che non aiutavano a scegliere cosa fare prima.

## Decisione

1. **Email**: con l'invio via email attivo (impostazioni salvate), un atleta senza indirizzo ha l'anomalia «Manca l'email dell'atleta», con il link alla sezione Identità. La scheda si salva anche senza email. Con l'invio disattivato non è un'anomalia.
2. **Approvazione senza email**: il server continua a tentare l'invio e a registrare `skipped`. La nota della bozza lo dice: approvando, il feedback non arriva all'atleta e resta fra le anomalie. Aggiunto l'indirizzo, «Riprova l'invio».
3. **Un solo elenco**: la tab non ha più gruppi. Prima ciò che è già fallito (`err`), poi ciò che va sistemato (`warn`), a parità nell'ordine di calcolo. Ogni voce ha la riga «Ferma: …» (feedback settimanale e invio a Intervals.icu, feedback settimanale, invio a Intervals.icu, email del feedback all'atleta).

Scelte dell'assistente, da confermare: la riga «Ferma: …» in grassetto sotto il titolo; l'email mancante in tono `warn`, mentre il feedback approvato e non inviato resta `err`; le due anomalie compaiono insieme quando entrambe valgono.

## Conseguenze

- `useAthleteAnomalies.ts` ha il gruppo `email` e `ANOMALY_STOPS`; `AnomaliesTab.vue` è un elenco unico.
- La stessa regola sull'email vale per la pagina «Da fare» ([0035](0035-pagina-da-fare-sezioni-e-guida.md)).
- Il backend finto degli e2e consegna il feedback come `approveReview`/`deliver` del server, così il caso è coperto da un test.
