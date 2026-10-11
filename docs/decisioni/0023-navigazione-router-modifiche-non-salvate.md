# 0023 — Navigazione con vue-router, modifiche non salvate protette, salvataggi falliti visibili

**Quando leggerlo**: prima di toccare la navigazione (rotte, pannelli e dialoghi nell'URL), le conferme all'uscita da una scheda o dalle Impostazioni, o la gestione degli errori di salvataggio della scheda atleta.

**Stato**: attiva.

## Contesto

L'[audit UI/UX di ottobre 2026](../audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md) ha verificato nel browser che:
- cambiare atleta, aprire le Impostazioni, uscire o ricaricare la pagina perdeva le modifiche non salvate della scheda senza avviso; la conferma esisteva solo per la bozza di un nuovo atleta (U-01);
- un salvataggio fallito mostrava «Salvato in locale», ma non esiste un salvataggio locale. La scheda risultava salvata e «Salva» si disattivava. Per un atleta nuovo il tentativo successivo rispondeva «Scheda salvata.» senza scrivere nulla, e la scheda spariva al polling successivo (U-02);
- dalle Impostazioni il clic sull'atleta già aperto non faceva nulla (U-07);
- senza stato nell'URL, un ricaricamento o la ripresa della PWA riportavano alla schermata vuota, e «indietro» su Android usciva dall'app (U-14);
- un errore di rete al salvataggio di una seduta chiudeva il pannello e perdeva le modifiche (U-19).

## Decisione

Decisioni del coach D-UX-1 e D-UX-5:
1. **Rotte** (`app/src/router.ts`, `vue-router` con cronologia a hash):
   - `/`;
   - `/impostazioni`;
   - `/atleta/nuovo`;
   - `/atleta/:id/:tab` con le viste `panoramica`, `piano` e `profilo`.

   Il pannello della seduta e i dialoghi del piano sono parametri di query (`?seduta=…`, `?dialogo=genera|prosegui|ripianifica|sincronizza`, composable `useQueryLayer`): «indietro» li chiude, un ricaricamento li riapre. Il cambio di vista sostituisce la voce della cronologia invece di aggiungerne una.
2. **Uscita con modifiche non salvate**: una guardia di navigazione chiede «Salva e continua», «Esci senza salvare» o «Resta». Vale quando si lascia una scheda per un'altra pagina e quando si lasciano le Impostazioni; la stessa domanda precede «Esci». Alla chiusura o al ricaricamento della pagina il browser mostra il suo avviso (`beforeunload`). Il pannello della seduta chiede conferma anche quando lo chiude «indietro». Durante una generazione, un'applicazione o una sincronizzazione i dialoghi non si chiudono.
3. **Salvataggi falliti**: la scheda resta modificata, «Salva» resta attivo e l'elenco non cambia finché il database non conferma. Un atleta nuovo riceve l'id definitivo solo dopo l'insert riuscito. L'eliminazione di una scheda avviene prima nel database, poi in locale. Il pannello della seduta si chiude solo su un conflitto di revisione; su un errore di rete resta aperto con le modifiche.
4. **Impostazioni**: hanno uno stato «Modifiche non salvate» e «Salva impostazioni» è attivo solo con modifiche.

## Motivo

- Il salvataggio esplicito resta il modello (il coach ha scartato il salvataggio automatico). Diventa però impossibile perdere modifiche senza una scelta consapevole.
- `vue-router` gestisce in un solo punto cronologia, guardie e ripristino della vista.
- La cronologia a hash funziona su GitHub Pages, che non riscrive i percorsi: un ricaricamento su `/PCoach/atleta/...` darebbe 404.

## Alternative scartate

- **Salvataggio automatico della scheda**: ogni modifica riscriverebbe l'intero blob, con più conflitti e senza un modo semplice di annullare.
- **Stato nell'URL gestito a mano**, senza router: meno dipendenze, ma guardie e cronologia andrebbero riscritte; il coach ha scelto il router.
- **Cronologia HTML5** (`createWebHistory`): richiede una pagina 404 che reindirizzi, un artificio fragile su GitHub Pages.
