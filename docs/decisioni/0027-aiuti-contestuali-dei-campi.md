# 0027 — Aiuti contestuali dei campi tecnici, da una sola fonte verificata

**Quando leggerlo**: prima di aggiungere o cambiare il testo d'aiuto di un campo, o di cambiare quali dati della scheda vanno a Claude.

**Stato**: superata da [0035](0035-pagina-da-fare-sezioni-e-guida.md) per la presentazione (aiuti nella guida di ogni gruppo, non sotto i campi); resta valida la fonte unica dei testi in `fieldHelp.ts` con i suoi test.

## Contesto

L'[audit UI/UX di ottobre 2026](../audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md) (§7, §8) ha ricostruito il percorso dei campi tecnici fino a Claude:
- molti campi non dicevano come venivano usati (distribuzione dell'intensità, sedute a settimana, disponibilità);
- altri lasciavano credere a un effetto che non c'era;
- note libere e dati personali andavano a Claude senza che l'interfaccia lo dicesse.

I testi d'aiuto erano scritti a mano in ogni componente, senza alcun legame con il codice che usa i dati.

## Decisione

1. **Componente** `components/ui/FieldHelp.vue`:
   - una riga sempre visibile sotto il campo, perché su telefono non c'è hover;
   - se serve, un approfondimento «Come lo usa PCoach» in un `<details>`, apribile da tastiera e al tocco e annunciato dai lettori di schermo.

   Niente tooltip.
2. **Fonte unica dei testi**: `help/fieldHelp.ts`, con chiavi uguali ai percorsi dello schema della scheda (`settings.*` e `workout.*` per Impostazioni e pannello della seduta). Ogni voce dichiara se il dato va a Claude e dove (`claude`), oppure che non deve andarci (`claude: false`).
3. **Verifica** (`help/fieldHelp.test.ts`):
   - ogni chiave esiste nello schema;
   - ogni dato dichiarato «inviato» è presente nel contesto costruito da `buildAthleteContextForPrompt`;
   - quelli dichiarati «mai inviati» (email, chiave Intervals.icu, cognome) non lo sono.

## Motivo

- Un aiuto che descrive un effetto deve restare vero quando il codice cambia: il test lega testo e prompt.
- L'essenziale deve essere leggibile senza interazione; l'approfondimento resta a un tocco.

## Alternative scartate

- **Tooltip o popover a comparsa**: non funzionano al tocco e nascondono informazioni essenziali.
- **Testi nelle `description` dello schema**: lo schema è documentazione tecnica, in un registro diverso da quello per il coach; resta la fonte per i percorsi, non per le frasi.
