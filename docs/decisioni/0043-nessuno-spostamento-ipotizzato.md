# 0043 — Nessuno spostamento di seduta ipotizzato

**Quando leggerlo**: prima di aggiungere all'abbinamento sedute-attività (`_shared/feedback/match.ts`) una regola che abbina un'attività a una seduta prevista in un altro giorno.

**Stato**: attiva. Modifica la regola R5 di [0019](0019-feedback-analisi-deterministica-approvazione.md).

## Contesto

La regola R5 abbinava una seduta passata senza attività a un'attività della stessa disciplina fatta entro 2 giorni, se la durata era compatibile (fra metà e una volta e mezza). L'esito era «spostata», con confidenza bassa. Era un'ipotesi basata solo sulla durata.

Nella settimana 16-22 novembre 2026 Elia ha fatto sabato un'uscita in bici di 88 minuti, che non era una seduta del piano. R5 l'ha abbinata alla soglia 3x10' di venerdì (76 minuti previsti). Ne sono seguiti tre effetti:
- il feedback ha detto all'atleta che la soglia sembrava fatta sabato;
- l'aderenza è risultata 1 su 5 invece di 0 su 5;
- la scheda ha mostrato la seduta come «Probabilmente spostata».

Il coach non vuole che PCoach supponga cosa ha fatto l'atleta.

## Decisione

1. **R5 non si applica.** Un'attività in un giorno senza una seduta della sua disciplina resta «extra» (non aumenta l'aderenza), e la seduta prevista resta «non registrata».
2. **Una seduta davvero spostata si sposta di data** in PCoach o su Intervals.icu. Si abbina allora con R1 (evento abbinato) o R2 (stesso giorno), e la valutazione va rigenerata.
3. **Nelle regole per Claude**, le attività «extra» non si presentano mai come una seduta del piano o come uno spostamento.

Decisione del coach del 24 novembre 2026.

## Conseguenze

- L'esito `moved` resta nei tipi solo per le valutazioni già salvate, che la scheda continua a mostrare come «Probabilmente spostata».
- Una seduta fatta davvero in un altro giorno, senza spostarne la data, risulta «non registrata» e abbassa l'aderenza finché il coach non la sposta.
- Le sedute segnate come svolte non cambiano: R5 aveva confidenza bassa e non segnava mai una seduta come svolta.
