# Sviluppo e deploy

**Quando leggerlo**: per configurare l'ambiente locale, eseguire test/build, o capire come viene pubblicata l'app.

## Setup locale

```
cd app
npm install
cp .env.example .env   # se presente; altrimenti creare .env con le due variabili sotto
npm run dev
```

**Variabili d'ambiente** (`app/.env`, non tracciato in git):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Senza queste due variabili l'app parte comunque (`configured` risulta `false` nei services), ma login e ogni funzionalità che tocca Supabase restano disabilitati.

## Rigenerare i tipi dallo schema

```
npm run gen:types
```

Rigenera `app/src/schema/types.generated.ts` da `app/src/schema/athlete_profile.schema.json` (`json-schema-to-typescript`). Il file generato non va mai modificato a mano (lo dichiara anche il banner comment generato automaticamente). Vedi [modello-dati.md](modello-dati.md) e [architettura.md](architettura.md#come-aggiungere-un-campo-al-modello-dati).

## Test

```
npm run test
```

Esegue Vitest (`vitest run`) su tutti i file `*.test.ts`. Stato attuale: **38 test** in 5 file:

| File | Test |
|---|---|
| `composables/useConnectionStatus.test.ts` | 4 |
| `composables/useDirtyState.test.ts` | 9 |
| `schema/migrations/identitySplit.test.ts` | 7 |
| `services/planViewModel.test.ts` | 13 |
| `stores/auth.test.ts` | 5 |

Questo conteggio descrive solo lo stato corrente; l'evoluzione nel tempo (es. "33 test" a una fase precedente) è nel [CHANGELOG.md](../CHANGELOG.md), non qui.

## Build

```
npm run build
```

Esegue `vue-tsc -b` (type-check, build incrementale) seguito da `vite build`. Un errore di tipo blocca la build.

## Pubblicazione su GitHub Pages

Workflow `.github/workflows/deploy.yml`, innescato da push su `main` (o manualmente via `workflow_dispatch`):

1. Checkout, setup Node 22, `npm ci` (dentro `app/`, con cache su `package-lock.json`).
2. `npm run build`, con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` presi dai **repository secrets** GitHub (non dal file `.env` locale).
3. Upload di `app/dist` come artifact Pages, poi deploy.

`vite.config.ts` imposta `base: '/PCoach/'`, necessario perché l'app è servita da un sotto-percorso (`https://<utente>.github.io/PCoach/`) e non dalla radice del dominio.
