# Impostazioni globali e integrazione Claude (funzionalità avanzata)

Questa guida copre la parte **opzionale** dell'app: generazione del piano di allenamento e feedback settimanale tramite Claude. Se non ti interessa, ignora questo documento — il resto dell'app (schede atleta, sync Intervals.icu) funziona senza.

Per il setup di base (Supabase + pubblicazione) vedi [README.md](../README.md).

## 1. Crea la tabella `app_settings`

Nello stesso progetto Supabase già creato per `athletes`, vai su **SQL Editor** → **New query**:

```sql
create table app_settings (
  id integer primary key,
  claude_api_key text,
  claude_model text,
  plan_generation_prompt_template text,
  weekly_feedback_prompt_template text
);

alter table app_settings disable row level security;
```

Stessa scelta di sicurezza già fatta per `athletes`: RLS disabilitata, uso personale con link non condiviso. Vedi `docs/specifica-tecnica.md` §5.5 per il perché.

## 2. Ottieni una API key Claude

Su [platform.claude.com](https://platform.claude.com) → **Settings → API Keys** → crea una nuova chiave. Tienila da parte: la incollerai nell'app al punto 4.

## 3. Pubblica la Edge Function `claude-proxy`

Serve perché l'API di Claude blocca le chiamate dirette da browser (verificato — vedi specifica tecnica §5.5): la Edge Function fa da tramite, gira sul tuo stesso progetto Supabase e non richiede altro hosting.

1. Installa la [Supabase CLI](https://supabase.com/docs/guides/cli) se non l'hai già.
2. Dalla cartella del progetto:

   ```bash
   supabase login
   supabase link --project-ref <il-tuo-project-ref>
   supabase functions deploy claude-proxy
   ```

   Il `project-ref` è nell'URL del progetto Supabase (`https://<project-ref>.supabase.co`).
3. Non serve impostare secret aggiuntivi: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili automaticamente dentro ogni Edge Function del progetto. Verifica comunque, al primo utilizzo, che la chiamata non fallisca per configurazione mancante (la funzione risponde con un errore chiaro in quel caso).

## 4. Configura l'app

Apri l'app → **⚙ Impostazioni** (nella sidebar):

- **API key Claude**: incolla quella del punto 2.
- **Modello**: lascia il default o cambialo se Anthropic rilascia un modello più recente — è un campo libero, non serve toccare il codice.
- **Prompt di generazione piano / feedback settimanale**: precompilati con un default ragionevole, modificabili liberamente. I placeholder tra `{{doppie graffe}}` vengono sostituiti automaticamente dall'app prima di inviare il prompt — non rimuoverli, altrimenti Claude non riceve i dati dell'atleta o non sa che formato usare.

Salva. Da questo momento i pulsanti "Genera piano con Claude" e "Confronta settimana con il piano" (dentro ogni scheda atleta) chiamano Claude tramite la Edge Function.

## Senza API key Claude

Se il campo è vuoto, i due pulsanti restano utilizzabili in modalità manuale: l'app assembla comunque il prompt (con i dati dell'atleta già inseriti) e lo copia negli appunti, pronto da incollare in una chat Claude qualsiasi. Utile per provare l'app senza impegnarsi con una API key, o come piano B se la Edge Function non è ancora stata pubblicata.
