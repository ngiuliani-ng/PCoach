# 0001 — Niente autenticazione, RLS rimandata

**Quando leggerlo**: per capire perché le prime fasi del progetto non avevano login né RLS, e cosa è cambiato dopo.

**Stato**: superata da [0010](0010-autenticazione-coach-rls-reale.md).

## Contesto

All'avvio del progetto (Fase 1-2, 2026-09-30) l'app doveva solo validare il modello dati e il flusso di base (CRUD schede atleta) con un solo utilizzatore (il coach stesso), in locale o su un link non condiviso.

## Decisione

Nessuna autenticazione applicativa, nessuna Row Level Security sulle tabelle `athletes`/`app_settings`. Le uniche credenziali in gioco erano quelle Supabase (anon key) in `.env`, mai committate.

## Motivo

Aggiungere login e RLS prima di validare il modello dati e i flussi principali avrebbe rallentato l'iterazione senza benefici concreti: con un solo utente e un link non pubblico, il rischio era giudicato accettabile nel breve periodo.

## Alternativa scartata

Implementare da subito Supabase Auth + RLS: scartata per non bloccare le prime fasi su un problema (autenticazione) non ancora rilevante rispetto a validare il dominio applicativo.
