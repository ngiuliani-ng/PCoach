// Aiuti contestuali dei campi tecnici (audit UX di ottobre 2026, §8): una riga sempre visibile e,
// facoltativo, un approfondimento su come PCoach usa il campo. Le chiavi sono i percorsi dello schema
// della scheda (`[]` per gli elementi di un elenco) o `settings.*` per le Impostazioni.
// fieldHelp.test.ts verifica che le chiavi esistano nello schema e che cio' che un aiuto dice sull'invio
// a Claude corrisponda al contesto costruito da planPrompt.ts.

export interface FieldHelp {
  /** Primo livello: cos'e' e a cosa serve, in una frase. */
  text: string;
  /** Approfondimento: come lo usa PCoach, effetti e limiti. */
  more?: string;
  /**
   * Percorso del dato nel contesto inviato a Claude (`buildAthleteContextForPrompt`), oppure false se
   * il campo non deve mai arrivare a Claude. Assente: il campo non riguarda la generazione.
   */
  claude?: string | false;
}

export const FIELD_HELP = {
  identity: {
    text: "A Claude vanno solo il nome, l'età calcolata dall'anno di nascita, il sesso, l'altezza e il peso: né il cognome né l'email.",
    claude: "identity.nome"
  },
  "identity.email": {
    text: "Serve per inviare il feedback settimanale che approvi, se l'invio è attivo in Impostazioni. Non va a Claude.",
    claude: false
  },
  "integrations.intervals_icu_api_key": {
    text: "Con la chiave il carico si aggiorna da solo (quando la inserisci, apri la scheda o generi un piano) e le sedute approvate si inviano al calendario dell'atleta con «Sincronizza settimana».",
    more: "La chiave resta nel database e non va a Claude. Claude riceve il carico che ne deriva: CTL, ATL e TSB degli ultimi 30 giorni.",
    claude: false
  },
  "disciplines[].current_weekly_volume": {
    text: "Il volume di oggi, non quello storico: serve a capire da dove si riparte.",
    claude: "disciplines"
  },
  "disciplines[].peak_weekly_volume_last_12_months": {
    text: "Il volume massimo raggiunto: è il riferimento per la crescita del carico.",
    claude: "disciplines"
  },
  physiological_thresholds: {
    text: "Conta l'ultima rilevazione per data.",
    more: "Claude riceve l'ultima rilevazione di ogni sport. Senza un FTP la bici si pianifica in frequenza cardiaca. Il feedback segnala se FTP o soglia differiscono di oltre il 3% da quelli registrati su Intervals.icu.",
    claude: "latest_thresholds"
  },
  "physiological_thresholds.running.zone_system": {
    text: "Le sedute di corsa usano solo le zone da Z1 a quella indicata, nella generazione e nell'editor.",
    more: "Deve coincidere con il numero di zone impostato su Intervals.icu per l'atleta: le zone delle sedute si riferiscono a quelle del suo account. Una seduta proposta con zone oltre il limite arriva da verificare. Il feedback divide le zone in intensità bassa, media e alta con le soglie di questo sistema (Impostazioni).",
    claude: "zone_per_disciplina.running"
  },
  "physiological_thresholds.cycling.zone_system": {
    text: "Le sedute di bici usano solo le zone da Z1 a quella indicata, nella generazione e nell'editor.",
    more: "Deve coincidere con il numero di zone impostato su Intervals.icu per l'atleta: le zone delle sedute si riferiscono a quelle del suo account. Una seduta proposta con zone oltre il limite arriva da verificare. Il feedback divide le zone in intensità bassa, media e alta con le soglie di questo sistema (Impostazioni).",
    claude: "zone_per_disciplina.cycling"
  },
  "training_status.lifestyle_factors": {
    text: "Condizioni ricorrenti che chiedono più prudenza con i carichi.",
    more: "Fattori, nota e un eventuale calo degli allenamenti vanno a Claude, che li usa per dosare il carico.",
    claude: "training_status.lifestyle_factors"
  },
  "goals.periodization_model": {
    text: "Deriva dall'obiettivo principale: «Preparazione gara» porta a picco e scarico, gli altri obiettivi a un miglioramento continuo.",
    claude: "goals.periodization_model"
  },
  "goals.target_events": {
    text: "Prima della settimana di gara PCoach pianifica le settimane di tapering indicate (vuoto: A 2, B 1, C 0) e sospende il ciclo di carico; dopo una gara A il ciclo riparte da «carico 1».",
    more: "Un evento senza una data valida non conta per le fasi del piano. Il calo del volume, se indicato, entra nel calendario; altrimenti lo decide Claude.",
    claude: "goals.target_events"
  },
  "constraints.days_available": {
    text: "Disponibilità e durata massima sono vincoli: PCoach controlla le sedute proposte e segna da verificare quelle che non li rispettano.",
    more: "L'attività abituale (ad esempio «uscita in bici col gruppo») è una preferenza per Claude, non un vincolo: PCoach non la controlla.",
    claude: "constraints.days_available"
  },
  "constraints.sessions_per_week_target": {
    text: "Quante sedute in una settimana normale.",
    more: "Claude deve rispettarle; se la proposta ne ha un numero diverso, l'anteprima lo segnala come punto da controllare.",
    claude: "constraints.sessions_per_week_target"
  },
  "methodology_preferences.intensity_distribution_model": {
    text: "Come si divide il tempo fra intensità basse e alte.",
    more: "È un'indicazione per Claude: PCoach non la verifica sulla proposta.",
    claude: "methodology_preferences.intensity_distribution_model"
  },
  "methodology_preferences.load_deload_pattern": {
    text: "Il ciclo di carico e scarico, ad esempio 3 settimane di carico e 1 di scarico.",
    more: "PCoach calcola da qui la fase di ogni settimana del piano (carico 1 di 3, scarico…) e la passa a Claude; senza uno schema valido le settimane non hanno fase.",
    claude: "methodology_preferences.load_deload_pattern"
  },
  "methodology_preferences.load_increase_min_pct": {
    text: "Vuote: 5-10% di aumento e 33% di calo.",
    more: "Claude le riceve come variazione attesa di ogni settimana; l'anteprima segnala le settimane fuori da questa variazione (tolleranza di 5 punti) e il feedback dice se la variazione fra due settimane era quella prevista.",
    claude: "methodology_preferences.load_increase_min_pct"
  },
  notes_free_text: {
    text: "Informazioni utili non previste dagli altri campi.",
    more: "Vanno a Claude a ogni generazione, insieme al resto della scheda: non scriverci ciò che non vuoi condividere con il servizio.",
    claude: "notes_free_text"
  },
  "settings.plan_generation_prompt_template": {
    text: "Come preferisci impostare le settimane: scarico, ripartenza del ciclo, uso del carico recente.",
    more: "Si aggiungono alle regole fisse di PCoach e valgono dalla generazione successiva al salvataggio. Dati dell'atleta, calendario, disponibilità, fasi del ciclo, zone e formato della risposta li aggiunge PCoach e non dipendono da questo testo. {{nome_atleta}} diventa il nome."
  },
  "settings.feedback_params": {
    text: "Regole pratiche, non valori fisiologici: decidono come PCoach classifica le sedute e gli scostamenti prima che Claude scriva il testo.",
    more: "Esempio con i valori predefiniti: una seduta di 60 minuti è svolta da 48 minuti (80%) a 72 (120%), svolta in parte da 30 a 48 (50%), molto più breve sotto i 30. Le stesse soglie decidono «Svolta in parte» nel Piano."
  },
  "workout.primary_target": {
    text: "La misura con cui l'atleta vede le zone su Intervals.icu: potenza, frequenza cardiaca o passo.",
    more: "PCoach invia solo il numero di zona: i valori sono quelli dell'account Intervals.icu dell'atleta."
  }
} satisfies Record<string, FieldHelp>;

export type FieldHelpKey = keyof typeof FIELD_HELP;
