# 07 — Versionamento dell'applicazione e CHANGELOG

**Quando leggerlo**: per capire come oggi si identifica (o non si identifica) la versione di PCoach, e per la proposta su versione nell'interfaccia, fonte del dato, convenzione del CHANGELOG e processo di rilascio. Fotografia del 13 ottobre 2026. Risponde al [requisito trasversale](PCOACH_UX-UI_REQUISITO_TRASVERSALE_AUDIT.md).

Indice centrale: [README.md](README.md). Nessuna modifica al codice né alla versione è stata fatta.

## 1. Sistema attuale

| Elemento | Stato al 13 ottobre 2026 | Verifica |
|---|---|---|
| `app/package.json` | `"version": "0.0.0"`, il valore iniziale del modello di Vite, mai aggiornato. Non c'è un `package.json` alla radice | codice |
| Tag Git | nessuno; 92 commit su `main`; `HEAD` = `origin/main` = `1a98ab3` | `git tag`, `git log` |
| Messaggi di commit | in parte con prefisso (`feat`, `fix`, `docs`), non in modo sistematico | `git log` |
| Pubblicazione del frontend | ogni push su `main` esegue test e build e pubblica su GitHub Pages (`.github/workflows/deploy.yml`). Ogni push è quindi un rilascio | codice |
| Versione nella build | nessuna: `vite.config.ts` non inietta versione, commit o data; il manifest PWA non ha versione; nessun `version.json` | codice |
| Versione nell'interfaccia | assente | esecuzione |
| Edge Function | pubblicate a mano (MCP Supabase), con il contatore di Supabase come unica versione: `claude-proxy` v9, `weekly-feedback` v23, `intervals-sync` v7. Il numero aumenta a ogni pubblicazione e non dice da quale commit viene il codice | MCP, sola lettura |
| Migrazioni | applicate a mano. 10 nella cronologia del database contro 12 file nel repository: 0001 e 0002 assenti dalla cronologia; 0010 e 0012 registrate senza numero (`weekly_feedback_cron_timeout`, `workout_sync_hash`) | MCP, sola lettura |
| Versioni interne | `PLAN_PROMPT_VERSION` 2.4.0 (`planPrompt.ts`), `ANALYSIS_VERSION` 1.2.0 (`_shared/feedback/types.ts`), `schema_version` 1.6.0 della scheda. Sono versioni di **contratti** (prompt, analisi, schema dei dati) salvate con i dati, non dell'app | codice |
| `CHANGELOG.md` | 57 voci datate, ordine inverso, formato «data — cambiamento — motivazione — docs aggiornati» (regola 4 di `CLAUDE.md`). Nessuna versione né sezione `Unreleased`. Mescola novità per il coach, dettagli interni (conteggi dei test, nomi di file) e passi di pubblicazione. Due formati di voce convivono (elenco con «Motivazione:» e paragrafi in corsivo) | lettura |
| Procedura di rilascio | non scritta come procedura. Di fatto: commit locali, conferma del coach, migrazioni, Edge Function, push (vedi [sviluppo-deploy.md § Edge Function](../../sviluppo-deploy.md#edge-function)) | documentazione, memoria di progetto |

Rischi concreti, legati a ciò che già succede:

<a id="v-01"></a>
- **V-01 · P2 — Versione non identificabile.** In una segnalazione il coach non può dire quale versione usa. Nemmeno chi sviluppa può capire da una schermata se la PWA aperta ha l'ultimo push: GitHub Pages mette in cache `index.html` per qualche minuto e una scheda aperta da giorni resta alla versione vecchia.
- **V-02 · P2 — Rilascio = push.** Qualsiasi push su `main` va in produzione, anche un commit di sola documentazione o un lavoro a metà. Il concetto di «release» esiste solo nella conferma del coach, non nel processo.
- **V-03 · P2 — Frontend e server pubblicati separatamente.** L'app può essere più nuova o più vecchia delle Edge Function, e niente lo rivela. L'ordine (migrazioni, funzioni, app) è affidato alla memoria. Un caso è già successo: il 12 ottobre una pubblicazione di `weekly-feedback` senza tutti i moduli è stata rifiutata e la versione in produzione è rimasta la precedente.
- **V-04 · P3 — CHANGELOG senza versioni.** Una voce non si può collegare a ciò che è in produzione.
- **V-05 · P3 — Versioni interne confondibili.** Mostrare «2.4.0» o «1.6.0» come versione dell'app sarebbe sbagliato: vanno tenute distinte.

## 2. Versione nell'interfaccia

Obiettivo: leggibile quando serve (segnalazione di un problema), invisibile il resto del tempo.

- **Sidebar, in basso**: nel piede, sotto lo stato «Online», una riga `--fs-xs` in `--text-muted`: «Versione 1.0.0». È un link alla sezione «Informazioni» delle Impostazioni.
  - Sul telefono la sidebar è il menu a scomparsa: la versione si vede aprendo il menu, nello stesso posto. Non serve un elemento sempre visibile.
  - Sul desktop nella PWA, dove la sidebar è fissa, non aggiunge righe: il piede ha già spazio.
- **Impostazioni › Informazioni** (ultima sezione, breve):
  - Versione 1.0.0;
  - Build `a1b2c3d` del 13 ott 2026;
  - Server: funzioni 1.0.0, solo se si decide di esporle (D-08c);
  - «Note di rilascio»: la sezione del CHANGELOG di questa versione, mostrata nell'app (vedi sotto);
  - «Copia per una segnalazione»: copia in una riga «PCoach 1.0.0 (a1b2c3d, 13/10/2026), Chrome 141, Windows».
- **Ambiente**: mostrato solo fuori dalla produzione («Sviluppo locale», con commit `locale` o `-modificato`). La produzione non ha etichetta.
- **Mai**: chiavi, URL di Supabase, variabili d'ambiente, id dell'utente.
- **Accessibilità**: testo reale, non immagine. Il link ha il nome «Versione 1.0.0, informazioni sull'app». Contrasto `--text-muted`, già verificato dal test dei token.
- **Note di rilascio nell'app** invece che su GitHub: il repository `ngiuliani-ng/PCoach` potrebbe non essere pubblico (non verificato: `gh` non è installato). La build importa la sezione della versione da `CHANGELOG.md` (`?raw`) e la mostra; nessuna chiamata di rete.

Nessuna nuova pagina, nessun elemento prominente.

## 3. Fonte attendibile del dato

- **Versione applicativa**: una sola fonte, `app/package.json` › `version`.
- **Commit e data**: dalla build. In CI `GITHUB_SHA`; in locale `git rev-parse --short HEAD`, con `-modificato` se l'albero ha modifiche; senza git, `locale`.
- **Esposizione al frontend**: `vite.config.ts` legge le tre informazioni e le passa con `define` (`__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILD_DATE__`), dichiarate in un `env.d.ts`. Un solo modulo `src/version.ts` le espone; nessun componente le scrive a mano.
- **Verifica di ciò che è in linea**: la build scrive anche `dist/version.json` (`{ version, commit, builtAt }`). Serve:
  - a controllare dopo la pubblicazione che GitHub Pages serva la build attesa;
  - in futuro, a un avviso «È disponibile una versione nuova, ricarica» quando il file in linea è diverso da quello caricato. Lo propongo come possibilità, non per ora.
- **Server**: per V-03, un modulo `supabase/functions/_shared/version.ts` con la stessa versione. Le funzioni la restituiscono in un'intestazione (`x-pcoach-version`) e l'app la confronta. Un test di Vitest garantisce che coincida con `package.json`, così non si aggiorna a mano in due posti senza accorgersene. L'esposizione all'utente è D-08c.

Rischi del requisito e come la proposta li copre:

| Rischio | Copertura |
|---|---|
| La UI mostra una versione diversa da quella distribuita | versione e commit nascono nella stessa build che viene pubblicata; `version.json` controllato dopo la pubblicazione |
| Una build di produzione mostra un valore predefinito | la CI fallisce se la versione è `0.0.0` o se manca il commit |
| Frontend e backend incompatibili | versione del server in un'intestazione e confronto nell'app; test di uguaglianza fra i due file |
| Versione confusa con build o commit | campi separati e nominati («Versione», «Build»); le versioni interne non compaiono come versione dell'app |
| Sviluppo locale | commit `locale` o `-modificato` ed etichetta «Sviluppo locale» |

## 4. Convenzione proposta per il CHANGELOG

La regola 4 di `CLAUDE.md` resta valida (ordine inverso; voci condensate con cambiamento, motivazione e docs) e si aggiunge la versione. **Va aggiornata la regola 4**: per la regola 6 lo si fa per ultimo, e per la regola 8 in un commit dedicato.

```markdown
## [Unreleased]

### Aggiunto
- 2026-10-14 — Versione dell'app nella barra laterale e in Impostazioni › Informazioni — serve nelle segnalazioni — docs: design-ui, sviluppo-deploy

### Interno
- 2026-10-14 — Versione iniettata dalla build — una sola fonte — docs: sviluppo-deploy, decisioni/0034

## [1.0.0] — 2026-10-14
…

## Prima del versionamento
(voci attuali, invariate)
```

- **Categorie**: Aggiunto, Modificato, Corretto, Rimosso, Sicurezza per ciò che il coach nota o che cambia i dati; **Interno** per test, refactoring, documentazione e dipendenze. Le note di rilascio mostrate nell'app escludono «Interno».
- **Storico esistente**: non si attribuisce a versioni inventate. Le 57 voci vanno sotto «Prima del versionamento». La prima versione con tag è lo stato al momento del rilascio, con una sola voce: «Prima versione numerata: corrisponde al commit …».
- **SemVer adattato a un'app senza API pubbliche**:
  - **MAJOR**: richiede un'azione o rompe la compatibilità dei dati o dei flussi (migrazione con intervento manuale, funzione tolta);
  - **MINOR**: una funzione nuova o cambiata che il coach vede;
  - **PATCH**: correzioni e testi.
  
  `PLAN_PROMPT_VERSION`, `ANALYSIS_VERSION` e `schema_version` restano indipendenti e si citano nella voce quando cambiano.
- **Formato unico della voce**: la riga sopra. I paragrafi in corsivo spariscono nelle voci nuove; quelle vecchie restano come sono.

## 5. Processo

| Momento | Cosa succede | Versione |
|---|---|---|
| **Modifica in sviluppo** | commit con codice e documenti di stato; la voce va in `Unreleased` nella stessa serie di commit | invariata |
| **Aggiornamento di `Unreleased`** | obbligatorio per ogni cambiamento con effetto per il coach o sui dati; facoltativo per «Interno» | invariata |
| **Preparazione del rilascio** (dopo la tua conferma, come oggi) | `Unreleased` diventa `[X.Y.Z] — data`; la versione si aggiorna in `package.json` e `_shared/version.ts` (uno script `npm run release -- minor` fa le tre cose) | incrementata |
| **Pubblicazione** | nell'ordine: migrazioni, Edge Function (con il file di versione), tag `vX.Y.Z`, push del tag | — |
| **Verifica** | `version.json` in linea = tag; intestazione delle funzioni = tag | — |

Il nodo è **V-02**: se ogni push pubblica, la versione mostrata e quella in linea divergono fra due rilasci. Due modi (D-08b):
- **A, pubblicare solo i tag** `v*`. Il push su `main` esegue solo i test. La versione in linea è sempre una versione numerata, e una pubblicazione si può ripetere ripubblicando il tag. Cambia un'abitudine: un push non basta più a pubblicare.
- **B, pubblicare a ogni push come oggi**. La versione mostra «1.0.0+a1b2c3d» fra due rilasci. Più semplice, ma «1.0.0» non identifica più un solo stato.

Raccomandazione: **A**. È proporzionata: un solo sviluppatore, rilasci già confermati uno per uno.

Non si incrementa la versione a ogni commit.

## 6. Test e controlli raccomandati

- **Vitest**:
  - `src/version.ts` espone una versione SemVer valida e diversa da `0.0.0`;
  - `package.json` e `_shared/version.ts` coincidono;
  - `CHANGELOG.md` ha `## [Unreleased]` in cima e una sezione `## [X.Y.Z]` per la versione di `package.json`, con data e almeno una voce non «Interno».
- **CI sui tag**:
  - il tag è uguale a `v` + `package.json`;
  - la sezione del CHANGELOG esiste;
  - `__APP_COMMIT__` non è vuoto;
  - dopo il deploy, `curl …/version.json` restituisce la versione del tag.
- **e2e**: la riga «Versione …» nel piede della sidebar ha un nome accessibile e porta a «Informazioni»; «Copia per una segnalazione» copia versione e commit; nessuna stringa sensibile nella sezione.
- **Funzioni**: un test unitario sul gestore comune verifica l'intestazione `x-pcoach-version`.

## 7. Decisioni da sottoporre

**D-08a — Versione di partenza**
- Raccomando `1.0.0`: l'app è in uso con dati reali.
- Alternativa: `0.x` finché non consideri il prodotto stabile.

**D-08b — Pubblicazione solo sui tag (A) o a ogni push (B)**
- Raccomando A.

**D-08c — Versione del server**
- Mostrarla in «Informazioni» e avvisare se diversa dall'app, oppure registrarla solo per la verifica dopo la pubblicazione.
- Raccomando di mostrarla solo in «Informazioni», senza avvisi in giro.

**D-08d — Note di rilascio**
- Nell'app (raccomandato) oppure link al file su GitHub, se il repository è pubblico.

**D-08e — Struttura del CHANGELOG**
- Accetti le categorie e la sezione «Prima del versionamento»?
- La regola 4 di `CLAUDE.md` va riscritta di conseguenza.

Dipendenze con l'architettura:
- `vite.config.ts` (`define`) e il workflow;
- `_shared/` è già importato sia dall'app sia dalle funzioni, quindi un modulo di versione lì non aggiunge meccanismi;
- il piede della sidebar ([design-ui.md § Layout](../../design-ui.md#layout));
- [sviluppo-deploy.md](../../sviluppo-deploy.md), da aggiornare;
- un'ADR nuova per la convenzione.
