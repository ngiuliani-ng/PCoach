# PCoach

App per un coach che segue più atleti: usa [Supabase](https://supabase.com)
come database e il download nativo del browser per l'export JSON.
Un solo file HTML, nessuna build, nessun server da scrivere.

Dettagli su modello dati, architettura e roadmap: [docs/specifica-tecnica.md](docs/specifica-tecnica.md).

## 1. Crea il progetto Supabase

1. Vai su [Supabase](https://supabase.com) → crea un account → **New project**.
2. Aspetta che il progetto sia pronto (circa 1-2 minuti).
3. Vai su **SQL Editor** (menu a sinistra) → **New query**, incolla e esegui:

   ```sql
   create table athletes (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );

   -- Per iniziare in fretta: disabilita la Row Level Security.
   -- ATTENZIONE: con RLS disabilitata, chiunque abbia la tua anon key
   -- (che è pubblica, visibile nel file HTML) può leggere/scrivere la tabella.
   -- Va bene per uso personale/prototipo con un link non condiviso.
   -- Se in futuro serve più sicurezza, riabilita RLS e aggiungi Supabase Auth.
   alter table athletes disable row level security;
   ```

4. Vai su **Project Settings → API**. Ti servono due valori:
   - **Project URL** (es. `https://xxxxx.supabase.co`)
   - **anon public key** (una stringa lunga)

## 2. Configura il file HTML

Apri `index.html` con un editor di testo, cerca queste due righe
vicino all'inizio dello script (subito dopo `<style>...</style>`):

```js
const SUPABASE_URL = "INSERISCI_QUI_LA_TUA_SUPABASE_URL";
const SUPABASE_ANON_KEY = "INSERISCI_QUI_LA_TUA_SUPABASE_ANON_KEY";
```

Sostituisci i due placeholder con i valori copiati al punto 1.4. Salva il file.

## 3. Prova in locale

Apri semplicemente il file HTML con doppio click nel browser. In basso a
sinistra dovresti vedere "Connesso a Supabase." Se vedi un errore di
connessione, ricontrolla URL e chiave.

## 4. Pubblica su GitHub Pages

1. Il file è già in root e già chiamato `index.html`: basta pubblicare il
   repository su GitHub (può essere privato o pubblico — privato è
   consigliato, dato che la anon key resta visibile nel codice).
2. Vai su **Settings → Pages** del repository.
3. In "Build and deployment", scegli **Deploy from a branch**, branch
   `main`, cartella `/ (root)`. Salva.
4. Dopo un paio di minuti, GitHub ti mostra l'URL pubblico (tipo
   `https://tuonome.github.io/tuorepo/`).

In alternativa a GitHub Pages puoi trascinare `index.html` su
[Netlify Drop](https://app.netlify.com/drop) per un URL immediato, senza
nemmeno creare un repository.

## Funzionalità avanzate: generazione piano e feedback con Claude

L'app include (opzionalmente) pulsanti per generare un piano di allenamento
e un feedback settimanale con l'assistenza di Claude. Richiede un piccolo
setup aggiuntivo (una tabella Supabase in più, una Edge Function, una API
key Claude): vedi [docs/impostazioni-claude.md](docs/impostazioni-claude.md).
Senza questo setup l'app resta comunque completa per l'uso base.

## Limiti di questa versione

- **Niente autenticazione**: chiunque abbia il link e la anon key (visibile
  nel sorgente) può leggere/modificare i dati. Adatto a uso personale con
  link non condiviso pubblicamente, non a un prodotto multi-coach.
- **Aggiornamento a polling**: la lista atleti si aggiorna da sola ogni 15
  secondi (non in tempo reale) se modifichi da un altro dispositivo/scheda.
- Se in futuro questi dati devono dialogare con un backend più strutturato
  (es. un servizio che analizza allenamenti e riprogramma dinamicamente),
  la tabella `athletes` con colonna `data jsonb` è già pensata per essere
  letta facilmente da un altro servizio: la struttura di `data` è quella
  descritta in `docs/athlete_profile.schema.json`.
