# 0032 — Indicazioni separate, verifica di ritorno e rinvio quando cambia la conversione

**Quando leggerlo**: prima di cambiare il testo inviato a Intervals.icu (`_shared/workouts/intervals.ts`), il controllo dopo l'invio o la regola che decide quando una seduta è da aggiornare.

**Stato**: attiva. Completa [0017](0017-sedute-entita-proprie-sincronizzazione-intervals.md).

## Contesto

Su Intervals.icu alcune sedute di corsa avevano durate assurde: «5x1000m» risultava di centinaia di minuti. La seduta in PCoach era corretta (ripetute da 4'). Il problema era l'indicazione per l'atleta, «1000m @ ritmo gara 5K», che PCoach scriveva davanti alla durata: `- 1000m @ ritmo gara 5K 4m Z5 Pace`. Intervals.icu legge come durata il primo token che le somiglia, e `m` vuol dire minuti. Il controllo dopo l'invio confrontava solo il numero di step, quindi l'errore era passato in silenzio. Inoltre una correzione della conversione non sarebbe arrivata alle sedute già inviate, perché il rinvio dipendeva solo dalla revisione.

C'era anche un'ambiguità di generazione: Claude pensava le ripetute a distanza («1000m») ma le scriveva a tempo, con la distanza ripetuta nell'indicazione.

Prova su un account di prova (2026-10-13, eventi creati e cancellati subito):
- senza separatore: `- 1000m @ ritmo gara 5K 4m Z5 Pace` → 60000 s, testo perso; `- 8' al 105-110% FTP 6m Z5` → 8', non 6';
- con `<!>`: in tutti i casi provati (`1000m`, `3:40/km`, `3km`, `5min`, `15"`, `Z2`, `8'`, `105-110%`) l'indicazione resta testo dello step, e durata, distanza e zona vengono dalla definizione;
- le intestazioni delle ripetute («Serie 1000m 3x») non vengono interpretate; `<!>` in un'intestazione resta scritto nel testo.

## Decisione

Decisioni del coach (2026-10-12):
1. Le ripetute di corsa e nuoto sono di solito a distanza, quelle di bici a tempo. Gli allunghi sono ripetute di circa 100 m. È una preferenza di generazione, non un vincolo: va nelle preferenze del piano (Impostazioni), e il validatore accetta entrambe le forme.
2. La correzione segue il piano a più livelli proposto: separatore, verifica di ritorno, rinvio automatico.

Scelte dell'assistente, da confermare:
- **Separatore**: ogni step con un'indicazione si scrive `- <indicazione><!> <durata> <zona>`. Dall'indicazione si tolgono `<!>` e `^` (i suggerimenti a tempo di Intervals.icu). Le intestazioni delle ripetute restano senza separatore.
- **Verifica di ritorno**: dopo ogni invio si confronta il `workout_doc` restituito da Intervals.icu con la struttura, step per step: stesso numero di step, ripetizioni e step di ogni ripetuta, stessa durata (step a tempo) o distanza (step a distanza), con tolleranza di 1 s o 1 m. Al primo scostamento la seduta riceve un avviso (`last_warning`), per esempio «Intervals.icu ha letto lo step 1 come 1000' invece di 4'».
- **Impronta del contenuto inviato** (`workout_sync.synced_hash`): FNV-1a sul JSON dell'evento. Una seduta approvata, non svolta e già su Intervals.icu è «da aggiornare» se l'impronta di ciò che PCoach invierebbe oggi è diversa da quella salvata. Gli invii precedenti non hanno impronta, quindi quelle sedute risultano da aggiornare una volta. Le sedute svolte non si confrontano.
- Nel prompt la stessa preferenza aggiunge che il cue non ripete durata o distanza. L'esempio di formato mostra una ripetuta a distanza. `PLAN_PROMPT_VERSION` 2.4.0.

## Motivo

Il testo libero non deve poter cambiare la seduta su Intervals.icu, e una lettura diversa da quella prevista deve vedersi subito. La sintassi di Intervals.icu è documentata solo in parte, quindi la conversione non si può dare per corretta: si verifica a ogni invio.

## Conseguenze

- Il testo inviato contiene `<!>` dopo ogni indicazione, anche nell'anteprima del pannello («Testo inviato a Intervals.icu»).
- Al rilascio, decisione del coach (2026-10-13): risultano «Da aggiornare» solo le sedute già inviate, non svolte, con numeri in un'indicazione (11 su 41), le sole che Intervals.icu poteva leggere male. Alle altre è stata salvata l'impronta del nuovo formato: restano con il vecchio testo, letto correttamente, finché non si modificano.
- I test end-to-end calcolano l'impronta con lo stesso modulo dell'Edge Function. Per farlo `supabase/functions/_shared/package.json` dichiara `"type": "module"`, così Node carica quei moduli come ESM. Il deploy delle funzioni non lo include.
