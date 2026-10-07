# 0004 — Decisioni minori di Fase 1-2

**Quando leggerlo**: per il contesto di alcune scelte piccole ma non ovvie prese nelle prime fasi (rotazione anon key, `PW.md` non tracciato, un commit per fase, comportamento della card "Nuovo atleta").

**Stato**: attiva.

## Contesto

Durante Fase 1-2 (2026-09-30/2026-10-03) sono state prese diverse decisioni minori, ciascuna non abbastanza grande da meritare un ADR a sé, ma utili da ricordare perché non deducibili guardando solo il codice attuale.

## Decisioni

- **Rotazione anon key Supabase**: eseguita almeno una volta durante lo sviluppo iniziale (nessun impatto sul codice, solo su `.env` locale e repository secrets GitHub).
- **`PW.md` non tracciato in git**: il file con le credenziali personali del coach resta sempre fuori da `.gitignore`-tracked paths, per evitare che finisca mai in un commit.
- **Un commit per fase**: ogni fase di sviluppo (Fase 1, Fase 2, ...) corrisponde a un commit dedicato nello storico, per poter ricostruire facilmente cosa è stato introdotto in ciascuna fase.
- **Card "Nuovo atleta"**: mostrata sempre come ultima card nella sidebar, stato puramente locale (non persistito finché l'atleta non viene salvato la prima volta).

## Motivo

Rotazione anon key: precauzione standard quando una chiave è stata vista/condivisa durante lo sviluppo. Un commit per fase: tracciabilità e possibilità di tornare a uno stato noto. Card "Nuovo atleta" locale: evitare righe vuote in `athletes` per schede mai effettivamente compilate.

## Alternativa scartata

Persistere subito una riga vuota alla creazione della card "Nuovo atleta": scartata per evitare di popolare il database di schede fantasma se il coach apre il form e poi lo abbandona senza salvare.
