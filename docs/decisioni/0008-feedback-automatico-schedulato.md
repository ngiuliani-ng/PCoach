# 0008 — Feedback settimanale automatico e schedulato

**Quando leggerlo**: per capire perché il feedback settimanale è una Edge Function invocata oralmente da `pg_cron` invece di un match esatto sull'orario, perché la logica di sync/confronto è duplicata rispetto al client, e perché lo storico feedback è di sola lettura.

**Stato**: attiva.

## Contesto

Fase 7 (2026-10-04): prima di questa fase il confronto piano/reale per il feedback settimanale era un flusso manuale lato client (il coach doveva innescarlo esplicitamente). È stato sostituito da una generazione completamente automatica.

## Decisione

- Edge Function `weekly-feedback`, pensata per essere invocata **ogni ora** da `pg_cron`, non a un orario esatto: internamente verifica se si è nel giorno configurato e se l'ora corrente ha raggiunto o superato quella configurata ("finestra resto della giornata"). Questo disaccoppia la cadenza del cron dalle impostazioni modificabili da UI (giorno/ora), che restano effettive senza dover toccare la configurazione del cron.
- Idempotenza: un solo feedback per atleta per settimana, garantita controllando se esiste già una voce in `weekly_feedback_log` con la data odierna.
- La logica di sincronizzazione Intervals.icu e di costruzione del prompt è **duplicata** tra `app/src/services/intervals.ts`/`planPrompt.ts` (client) e `supabase/functions/weekly-feedback/index.ts` (server): le Edge Function Deno non possono importare moduli TypeScript da `app/src` (runtime/bundling separati), quindi non è un problema di disciplina ma un vincolo tecnico della piattaforma.
- Lo storico `weekly_feedback_log` è di sola lettura dalla UI: nessuna funzione di modifica/eliminazione manuale di una voce già generata.
- Dettagli email in [0002](0002-email-feedback-via-resend.md).

## Motivo

Un match esatto sull'ora (es. "solo se l'invocazione cade esattamente alle 08:00") renderebbe il sistema fragile a invocazioni cron mancate o in ritardo; la finestra "resto della giornata" tollera questo senza perdere la generazione. Il flusso manuale lato client richiedeva al coach di ricordarsi di generarlo ogni settimana: automatizzarlo rimuove questo carico cognitivo.

## Alternativa scartata

Invocazione del cron a un orario fisso preciso (match esatto, non finestra): scartata perché un'invocazione mancata avrebbe fatto slittare il feedback alla settimana successiva anziché recuperarlo nella stessa giornata.
