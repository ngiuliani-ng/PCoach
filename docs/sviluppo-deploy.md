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

Actions usate: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` (tutte su runtime Node.js 24).

1. Checkout, setup Node 22, `npm ci` (dentro `app/`, con cache su `package-lock.json`).
2. `npm run build`, con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` presi dai **repository secrets** GitHub (non dal file `.env` locale).
3. Upload di `app/dist` come artifact Pages, poi deploy.

`vite.config.ts` imposta `base: '/PCoach/'`, necessario perché l'app è servita da un sotto-percorso (`https://<utente>.github.io/PCoach/`) e non dalla radice del dominio.

## PWA (Progressive Web App)

L'app è installabile su dispositivi mobili e desktop tramite un Web App Manifest generato da `vite-plugin-pwa`. Non è attivo alcun Service Worker (configurazione `selfDestroying: true`): l'app **non funziona offline**, ma può essere aggiunta alla schermata home e si apre senza barra del browser (`display: standalone`). Motivazione della scelta in [decisioni/0013](decisioni/0013-pwa-manifest-only.md) e [decisioni/0014](decisioni/0014-colore-finestra-pwa-continuita-sidebar.md).

**Componenti della PWA:**
- `vite.config.ts`: configurazione `VitePWA()` — manifest, icone, `start_url: /PCoach/`, `scope: /PCoach/`.
- `app/public/favicon.png`: icona 32×32 px usata come favicon nel browser (`<link rel="icon">` in `index.html`).
- `app/public/icons/icon-192.png` e `icon-512.png`: icone PNG 192×192 e 512×512 px, necessarie per manifest e `apple-touch-icon`.
- `index.html`: meta tag `theme-color` (due tag con `prefers-color-scheme: dark/light`, valori `#1C2025`/`#FFFFFF`), `apple-mobile-web-app-capable`, `apple-touch-icon`.

**Per aggiungere offline support in futuro:** rimuovere `selfDestroying: true` da `vite.config.ts` e configurare una strategia Workbox (es. `NetworkFirst` per le API Supabase, `CacheFirst` per gli asset statici).
