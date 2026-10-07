# 0002 — Email del feedback settimanale via Resend, dietro un'interfaccia astratta

**Quando leggerlo**: per capire perché l'invio email passa da un'interfaccia `EmailSender` invece di chiamare Resend direttamente, o prima di aggiungere un secondo provider email.

**Stato**: attiva.

## Contesto

Deciso in Fase 2 (2026-09-30) che il feedback settimanale avrebbe potuto essere inviato via email, realizzato poi in Fase 7 (2026-10-04) insieme alla Edge Function `weekly-feedback` — vedi [0008](0008-feedback-automatico-schedulato.md).

## Decisione

Interfaccia `EmailSender` (`supabase/functions/_shared/emailSender.ts`) con un'unica implementazione concreta, `ResendEmailSender`. Il secret `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` vive solo nelle env della Edge Function, mai in `app_settings` (quindi mai esposto al client né scrivibile da UI).

## Motivo

Isolare il provider email dietro un'interfaccia permette di cambiare servizio (o aggiungerne un secondo, es. per fallback) senza toccare la logica di `weekly-feedback`. Tenere il secret fuori da `app_settings` evita che finisca, anche per errore, in una risposta REST letta dal client.

## Alternativa scartata

Chiamata diretta all'API Resend dentro `weekly-feedback`, senza interfaccia: scartata perché accoppia la logica di business al provider specifico, rendendo più costoso un eventuale cambio futuro.
