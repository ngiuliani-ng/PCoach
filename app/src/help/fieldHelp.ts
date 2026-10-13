// Testi d'aiuto dei campi (ADR 0027, rivista dall'ADR 0035): non compaiono sotto i campi ma nella
// guida di ogni gruppo di dati (help/guide.ts), aperta dall'icona Info della sezione. Le chiavi sono i
// percorsi dello schema della scheda (`[]` per gli elementi di un elenco), `settings.*` per le
// Impostazioni e `workout.*` per il pannello della seduta.
// fieldHelp.test.ts verifica che le chiavi esistano nello schema, che cio' che un aiuto dice sull'invio
// a Claude corrisponda al contesto costruito da planPrompt.ts e che le etichette citate fra «» esistano.

export interface FieldHelp {
  /** Cos'e' e a cosa serve, in una frase. */
  text: string;
  /** Come lo usa PCoach: effetti e limiti. */
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
    text: "Serve per inviare all'atleta il feedback settimanale che approvi. Non va a Claude.",
    more: "Con l'invio via email attivo in Impostazioni, un atleta senza indirizzo compare fra le anomalie e il feedback approvato non gli arriva. La scheda si salva anche senza.",
    claude: false
  },
  "integrations.intervals_icu_api_key": {
    text: "Con la chiave il carico si aggiorna da solo (quando la inserisci, apri la scheda o generi un piano) e le sedute approvate si inviano al calendario dell'atleta con «Sincronizza settimana».",
    more: "La chiave resta nel database e non va a Claude. Claude riceve il carico che ne deriva: CTL, ATL e TSB degli ultimi 30 giorni. Con una chiave non valida PCoach non invia le sedute e non legge carico, zone e attività.",
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
    text: "Conta l'ultima rilevazione per data, per ogni sport.",
    more: "Claude riceve l'ultima rilevazione di ogni sport. Senza un FTP la bici si pianifica in frequenza cardiaca. Passo di soglia, CSS e FTP devono coincidere con quelli su Intervals.icu: se sono diversi, o se manca la soglia di uno sport praticato, il feedback settimanale e l'invio delle sedute si fermano (tab Anomalie). La soglia serve anche a stimare la durata degli step a distanza.",
    claude: "latest_thresholds"
  },
  "physiological_thresholds.running.zone_system": {
    text: "Le sedute di corsa e di bici usano solo le zone da Z1 a quella indicata, nella generazione e nell'editor. Il nuoto usa sempre 7 zone.",
    more: "Deve coincidere con il numero di zone impostato su Intervals.icu per l'atleta: le zone delle sedute si riferiscono a quelle del suo account, e se sono diverse feedback e invio si fermano. Cambiarlo con un piano in corso rimette «Da verificare» le sedute da svolgere della disciplina. Una seduta proposta con zone oltre il limite arriva da verificare. Il feedback divide le zone in intensità bassa, media e alta con le soglie di questo sistema (Impostazioni, Avanzate).",
    claude: "zone_per_disciplina.running"
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
    more: "Un evento senza una data valida non conta per le fasi del piano. Il calo del volume nel tapering, se indicato, entra nel calendario; altrimenti lo decide Claude.",
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
    more: "PCoach calcola da qui la fase di ogni settimana del piano («carico 1 di 3», «scarico») e la passa a Claude; senza uno schema valido le settimane non hanno fase.",
    claude: "methodology_preferences.load_deload_pattern"
  },
  "methodology_preferences.load_increase_min_pct": {
    text: "Aumento fra settimane di carico e calo nella settimana di scarico. Vuoti valgono 5-10% di aumento e 33% di calo.",
    more: "Claude le riceve come variazione attesa di ogni settimana; l'anteprima segnala le settimane fuori da questa variazione (tolleranza di 5 punti) e il feedback dice se la variazione fra due settimane era quella prevista.",
    claude: "methodology_preferences.load_increase_min_pct"
  },
  notes_free_text: {
    text: "Informazioni utili non previste dagli altri campi.",
    more: "Vanno a Claude a ogni generazione, insieme al resto della scheda: non scriverci ciò che non vuoi condividere con il servizio.",
    claude: "notes_free_text"
  },
  "settings.claude_api_key": {
    text: "La chiave del tuo account Claude e il modello con cui PCoach genera i piani e scrive i feedback. Compaiono solo i modelli verificati con entrambi.",
    more: "La chiave resta nel database: una chiave già salvata non si mostra, e lasciando vuoto il campo resta quella. Senza chiave, la generazione copia il prompt negli appunti: lo incolli in Claude e poi incolli qui la risposta («Copia il prompt»)."
  },
  "settings.plan_generation_prompt_template": {
    text: "Come preferisci impostare le settimane: scarico, ripartenza del ciclo, uso del carico recente.",
    more: "Si aggiungono alle regole fisse di PCoach e valgono dalla generazione successiva al salvataggio. Dati dell'atleta, calendario, disponibilità, fasi del ciclo, zone e formato della risposta li aggiunge PCoach e non dipendono da questo testo. {{nome_atleta}} diventa il nome."
  },
  "settings.weekly_feedback_schedule": {
    text: "Ogni lunedì, dall'ora indicata, il server prepara il feedback della settimana appena conclusa (da lunedì a domenica).",
    more: "Lo trovi da approvare nella pagina iniziale e nella Panoramica dell'atleta: niente parte senza la tua approvazione. Il fuso orario decide quando inizia il lunedì; un fuso non riconosciuto blocca il salvataggio."
  },
  "settings.weekly_feedback_email_enabled": {
    text: "Con l'invio attivo, il feedback che approvi arriva all'atleta per email.",
    more: "Un atleta senza indirizzo compare fra le anomalie. Senza invio, il feedback approvato resta in PCoach."
  },
  "settings.weekly_feedback_prompt_template": {
    text: "Come scrivere all'atleta: tono, lunghezza, priorità. {{nome_atleta}} diventa il nome.",
    more: "Cosa il feedback può affermare lo decidono i dati calcolati da PCoach, non questo testo."
  },
  "settings.feedback_params": {
    text: "Regole pratiche, non valori fisiologici: decidono come PCoach classifica le sedute e gli scostamenti prima che Claude scriva il feedback, per tutti gli atleti.",
    more: "Esempio con i valori predefiniti: una seduta di 60 minuti è svolta da 48 minuti (80%) a 72 (120%), svolta in parte da 30 a 48 (50%), molto più breve sotto i 30. Le stesse soglie decidono «Svolta in parte» nel Piano. Le soglie sulla qualità dei dati decidono quando il feedback può parlare di completamento, RPE, benessere e distribuzione dell'intensità."
  },
  "settings.intensity_domains": {
    text: "Per ogni sistema di zone, fino a quale zona l'intensità è bassa e fino a quale è media; oltre è alta.",
    more: "Ogni atleta usa la riga del proprio sistema: corsa e bici come nella scheda, il nuoto sempre 7 zone. Il feedback usa queste fasce per la distribuzione dell'intensità."
  },
  "settings.zone_models": {
    text: "Limiti delle zone in percentuale della soglia, per tutti gli atleti. Ogni valore è il limite superiore della zona; l'ultima zona non ha limite.",
    more: "PCoach li usa per stimare il passo di ogni zona, e quindi la durata degli step a distanza: totali delle sedute, durata massima del giorno (che segna le sedute «Da verificare»), abbinamento delle attività e feedback. Li scrive anche su Intervals.icu con «Porta Intervals.icu a N zone». I predefiniti sono i modelli più usati."
  },
  "review.flow": {
    text: "Ogni lunedì PCoach confronta la settimana appena finita con le sedute approvate e Claude scrive un feedback. Lo rivedi qui: parte verso l'atleta solo quando lo approvi.",
    more: "Puoi correggere il testo prima di approvarlo: le correzioni si salvano da sole (la nuvola in alto è verde quando sono salvate). «Rigenera» chiede a Claude di riscriverlo e rifà la valutazione con i dati aggiornati. Per una settimana che non ha ancora un feedback usa «Prepara il feedback». Un feedback già inviato si può rigenerare: all'approvazione scegli se inviarlo di nuovo. Le settimane chiuse si aprono con un clic."
  },
  "workout.primary_target": {
    text: "La misura con cui l'atleta vede le zone su Intervals.icu: potenza, frequenza cardiaca o passo.",
    more: "PCoach invia solo il numero di zona: i valori sono quelli dell'account Intervals.icu dell'atleta."
  }
} satisfies Record<string, FieldHelp>;

export type FieldHelpKey = keyof typeof FIELD_HELP;
