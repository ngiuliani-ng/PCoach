# 0013 — PWA installabile: manifest-only, nessun Service Worker

**Quando leggerlo**: per capire perché l'app usa `vite-plugin-pwa` senza Service Worker attivo, e cosa cambia se in futuro si vuole aggiungere supporto offline.

**Stato**: attiva.

## Contesto

L'app è servita come build statica su GitHub Pages (`https://<utente>.github.io/PCoach/`). L'obiettivo immediato è renderla installabile sulla schermata home di dispositivi mobili e desktop (prompt "Aggiungi a schermata home", apertura senza barra del browser), senza introdurre la complessità di una strategia offline.

## Decisione

- `vite-plugin-pwa` è aggiunto come devDependency e configurato in `vite.config.ts` per generare un `manifest.webmanifest` con nome, colori brand, `start_url` e `scope` relativi alla base `/PCoach/`, e icone PNG 192×192 e 512×512.
- `selfDestroying: true`: il Service Worker viene auto-disattivato (o non registrato); l'app **non funziona offline**.
- Le icone PNG sono generate a partire dal favicon SVG esistente e messe in `app/public/icons/`.
- `index.html` riceve i meta tag necessari: `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`.

## Motivo

Una strategia offline per questa app richiede scelte non banali: le chiamate Supabase (autenticazione, lettura/scrittura atleti) non possono essere semplicemente cachate senza gestire conflitti di sincronizzazione. Affrontare queste scelte ora sarebbe prematuro. Il manifest-only è reversibile: rimuovere `selfDestroying: true` e aggiungere la configurazione Workbox sono operazioni circoscritte a `vite.config.ts`.

## Alternativa scartata

**App shell con pre-cache degli asset statici** (SW attivo, nessuna cache delle API): avrebbe reso l'interfaccia visibile offline, ma con tutti i dati assenti — esperienza potenzialmente confusa per il coach. Rimandato a quando si deciderà una strategia di sincronizzazione offline completa.
