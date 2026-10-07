# 0011 — Rifinitura sidebar: IconButton e drawer mobile gestito da composable

**Quando leggerlo**: per capire perché il footer della sidebar usa `IconButton` invece di bottoni testuali, e perché la logica del drawer mobile vive in `useMobileSidebar.ts`.

**Stato**: attiva.

## Contesto

Documentazione retroattiva: decisione presa con il commit `b318e30` (2026-10-04), non documentata al momento in cui è stata realizzata.

## Decisione

- Il footer della sidebar atleti (`AthleteSidebar.vue`) sostituisce i precedenti bottoni testuali "Impostazioni"/"Esci" con due `IconButton` compatti (nuovo componente generico in `components/ui/`).
- Tutta la logica del drawer mobile — apertura/chiusura, backdrop cliccabile, chiusura con Esc, blocco dello scroll del body mentre è aperto, gestione del focus — è stata estratta in un composable dedicato, `useMobileSidebar.ts`, invece di restare dentro `App.vue`.
- Il bottone hamburger che apre il drawer viene nascosto mentre il drawer è aperto (si chiude solo tramite backdrop o Esc).

## Motivo

Due bottoni solo-icona occupano meno spazio verticale nel footer della sidebar, coerente con l'obiettivo di lasciare più spazio alla lista atleti. Estrarre la logica del drawer in un composable la rende testabile e riusabile indipendentemente da `App.vue`, e separa una responsabilità (comportamento del drawer) che non riguarda il resto del bootstrap applicativo. Nascondere l'hamburger a drawer aperto evita un bottone che aprirebbe un drawer già aperto.

## Alternativa scartata

Lasciare la logica del drawer dentro `App.vue` come metodi/stato del componente: scartata perché mischia la responsabilità di bootstrap dell'app con il comportamento di un singolo elemento di UI (la sidebar mobile), rendendo più difficile testare quest'ultimo in isolamento.
