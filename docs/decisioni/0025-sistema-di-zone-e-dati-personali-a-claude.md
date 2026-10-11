# 0025 — Sistema di zone dell'atleta effettivo, dati personali ridotti verso Claude

**Quando leggerlo**: prima di cambiare le zone che Claude può usare, i controlli sulle zone delle sedute o i dati dell'atleta inviati nella generazione.

**Stato**: attiva. Aggiorna [0020](0020-generazione-istruzioni-separate-tracciabilita.md) per il contenuto del contesto (prompt 2.3.0).

## Contesto

L'[audit UI/UX di ottobre 2026](../audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md) ha verificato due problemi:
- **U-10**: «Sistema di zone» (3, 5 o 7, per corsa e bici) si salvava, ma nessun modulo lo leggeva. Le sedute usavano sempre Z1-Z7.
- **U-13**: nome, cognome, anno di nascita, dati fisici e note libere arrivavano a Claude a ogni generazione, senza che l'interfaccia lo dicesse.

## Decisione

Decisioni del coach D-UX-3 e D-UX-7:
1. **Zone** (D-UX-3): il coach ha scelto di rendere il campo efficace e non di toglierlo, perché «gli allenamenti che produce devono essere allineati alla gestione delle zone che ho settato per quell'atleta».
   - `zoneLimits` (`domain/athlete.ts`): corsa e bici dal loro `zone_system`, nuoto 7 zone.
   - Il contesto inviato a Claude contiene `zone_per_disciplina`, e una regola fissa chiede di usare solo le zone da Z1 a quel numero.
   - `parseProposal` segna «da verificare» le sedute che vanno oltre, con il motivo.
   - L'editor della struttura propone solo quelle zone.
   - Salvare una seduta ricontrolla le zone come la disponibilità, e approvarla oltre il sistema chiede conferma.
2. **Dati personali** (D-UX-7): Claude riceve il nome di battesimo, l'età calcolata dall'anno di nascita, sesso, altezza e peso. Non riceve cognome, anno di nascita né email. Il messaggio e `{{nome_atleta}}` usano il nome. Le note libere restano inviate, e l'interfaccia lo dichiara (fase degli aiuti contestuali). Il feedback settimanale inviava già solo il nome di battesimo.
3. `PLAN_PROMPT_VERSION` passa a 2.3.0.

## Motivo

- Le zone di una seduta su Intervals.icu sono quelle dell'account dell'atleta: una Z6 per un atleta a 5 zone non ha significato.
- Nome di battesimo ed età bastano a Claude per scrivere e dosare il carico; cognome e anno di nascita lo renderebbero identificabile senza un vantaggio per il piano.

## Punti aperti

- Le soglie del feedback «Intensità bassa fino alla zona» e «Intensità media fino alla zona» sono globali e non seguono il sistema di zone dell'atleta: con 3 zone, la Z3 conta come intensità media. Serve una decisione del coach.
- Il nuoto non ha un sistema di zone proprio: resta a 7.

## Alternative scartate

- **Togliere «Sistema di zone» dall'interfaccia** (raccomandazione iniziale dell'audit): il coach vuole che le sedute seguano il sistema scelto per l'atleta.
- **Correggere da sé le zone oltre il limite**, ad esempio riportando Z6 a Z5: cambierebbe l'intensità della seduta senza che il coach lo veda.
