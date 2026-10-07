# CLAUDE.md

**Quando leggerlo**: prima di qualunque modifica a questo repository — è il punto d'ingresso alla documentazione e alle regole di manutenzione della documentazione stessa.

## Mappa della documentazione

| Area | File |
|---|---|
| Architettura | [docs/architettura.md](docs/architettura.md) |
| Linee guida grafiche | [docs/design-ui.md](docs/design-ui.md) |
| Modello dati | [docs/modello-dati.md](docs/modello-dati.md) |
| Backend | [docs/backend.md](docs/backend.md) |
| Integrazioni | [docs/integrazioni.md](docs/integrazioni.md) |
| Sicurezza | [docs/sicurezza.md](docs/sicurezza.md) |
| Sviluppo e deploy | [docs/sviluppo-deploy.md](docs/sviluppo-deploy.md) |
| Limiti noti e roadmap | [docs/limiti-roadmap.md](docs/limiti-roadmap.md) |
| Decisioni (ADR) | [docs/decisioni/](docs/decisioni/) — un file per decisione/iniziativa, `NNNN-titolo-kebab.md` |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

## Regole di manutenzione della documentazione

1. Ogni file di stato (architettura, design-ui, modello-dati, backend, integrazioni, sicurezza, sviluppo-deploy, limiti-roadmap) descrive **solo lo stato attuale** del sistema, già corretto — mai "prima si faceva X, ora si fa Y". Lo storico delle decisioni appartiene solo alle ADR e al changelog.
2. Ogni informazione ha **una sola casa**: se un fatto è già descritto per esteso in un file, gli altri file linkano a quella sezione invece di ripeterlo.
3. Ogni decisione architetturale rilevante è un ADR in `docs/decisioni/`, con uno **stato esplicito** (`attiva` oppure `superata da NNNN`). Un ADR copre una decisione o un'iniziativa coerente (una fase, un gruppo di scelte correlate), non ogni singola frase del codice.
4. Lo storico dei cambiamenti va in `CHANGELOG.md`, in **ordine inverso** (più recente in cima), in voci condensate nel formato: data — cambiamento — motivazione — docs aggiornati.
5. Ogni file di documentazione (inclusi le ADR e il changelog) inizia con una riga **`Quando leggerlo`**, che spiega in una frase quando è il momento di aprirlo.
6. Questo file (`CLAUDE.md`) va aggiornato **per ultimo** quando cambia la mappa della documentazione o le regole stesse, perché riflette lo stato finale di tutti gli altri file.
7. Quando un file di stato risulta disallineato dal codice reale, va **corretto sul posto** — non lasciato "sbagliato ma storicamente accurato": solo `CHANGELOG.md` e le ADR hanno il diritto di descrivere stati passati.
8. Un cambiamento sostanziale alla **struttura** della documentazione (non una singola correzione puntuale) va in un commit dedicato, separato dalle eventuali modifiche di codice che lo hanno motivato.
