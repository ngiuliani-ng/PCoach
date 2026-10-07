# 0003 — Tipi TypeScript generati dallo schema JSON

**Quando leggerlo**: prima di scrivere a mano un tipo che dovrebbe rispecchiare `AthleteTrainingProfile`, o per capire perché `types.generated.ts` non va mai modificato direttamente.

**Stato**: attiva.

## Contesto

Il modello dati (`AthleteTrainingProfile`) è definito come JSON Schema fin dall'inizio del progetto (2026-09-30), per poterlo validare indipendentemente dal linguaggio e riusarlo sia lato client (TypeScript) che, potenzialmente, lato server.

## Decisione

I tipi TypeScript sono generati automaticamente da `app/src/schema/athlete_profile.schema.json` tramite `json-schema-to-typescript` (`npm run gen:types`), non scritti/mantenuti a mano.

## Motivo

Mantenere manualmente due rappresentazioni (schema JSON + tipi TS) dello stesso modello dati avrebbe garantito, nel tempo, disallineamenti tra i due. Generare i tipi dallo schema rende lo schema l'unica fonte di verità per definizione, non per disciplina.

## Alternativa scartata

Libreria generica di validazione/tipizzazione form-schema-driven (es. generazione di form UI dallo schema): scartata perché il progetto ha bisogno solo dei tipi TypeScript, non di un motore di rendering form generico — avrebbe aggiunto complessità senza un bisogno corrispondente.
