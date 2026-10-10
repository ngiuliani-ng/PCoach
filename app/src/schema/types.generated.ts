// File generato automaticamente da athlete_profile.schema.json. Non modificare a mano.\n// Rigenerare con: npm run gen:types

/**
 * Profilo completo di un atleta ai fini della programmazione dell'allenamento. Compilato manualmente dal coach. Le sedute di allenamento non fanno parte della scheda: vivono in tabelle proprie (vedi docs/modello-dati.md).
 */
export interface AthleteTrainingProfile {
  /**
   * Versione dello schema, per gestire migrazioni future.
   */
  schema_version: string;
  /**
   * Metadati sulla scheda stessa, non sull'atleta.
   */
  meta: {
    /**
     * Codice univoco generato alla creazione, non derivato dal nome.
     */
    athlete_id: string;
    /**
     * Identificativo del coach che gestisce il piano.
     */
    coach_id?: string;
    created_at: string;
    updated_at: string;
    /**
     * Origine principale dei dati compilati in questa scheda.
     */
    data_source?: "manual" | "garmin_export" | "intervals_icu_api" | "mixed";
    [k: string]: unknown;
  };
  /**
   * Dati anagrafici rilevanti per calcolo carichi/zone (non dati sensibili).
   */
  identity: {
    nome?: string;
    cognome?: string;
    /**
     * Usata per l'invio del feedback settimanale automatico, se attivo.
     */
    email?: string;
    /**
     * Usato per stime età-correlate (es. FC max teorica), non l'età esatta.
     */
    birth_year?: number;
    /**
     * Rilevante per formule fisiologiche standard (FC max, VO2max stimato). Opzionale.
     */
    biological_sex?: "male" | "female" | "unspecified";
    height_cm?: number;
    /**
     * Utile per calcolo W/kg in bici e per monitorare variazioni di peso ai fini della performance.
     */
    weight_kg?: number;
    [k: string]: unknown;
  };
  /**
   * Una voce per ogni sport praticato dall'atleta.
   */
  disciplines: {
    /**
     * Discipline di allenamento con volume proprio. Il triathlon non è qui: è nuoto+bici+corsa, già rappresentabili come tre righe separate.
     */
    sport: "running" | "cycling" | "swimming" | "strength";
    level: "principiante" | "intermedio" | "avanzato" | "esperto_agonista";
    years_practice?: number;
    /**
     * Volume settimanale attuale reale (non storico), usato per capire da dove si riparte.
     */
    current_weekly_volume?: {
      value?: number;
      unit?: "km" | "ore" | "sessioni";
      [k: string]: unknown;
    };
    /**
     * Volume settimanale massimo raggiunto negli ultimi 12 mesi: serve come riferimento per il ramp-up.
     */
    peak_weekly_volume_last_12_months?: {
      value?: number;
      unit?: "km" | "ore" | "sessioni";
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }[];
  /**
   * Soglie per ciascuno sport. 'zone_system' è configurazione (cambia raramente); 'thresholds_log' è uno storico datato — il valore corrente è l'ultima voce per data, non un campo a sé da sovrascrivere.
   */
  physiological_thresholds?: {
    running?: {
      zone_system?: "3-zone" | "5-zone" | "7-zone";
      /**
       * Una voce per ogni rilevazione/test nel tempo. Il valore attuale è quella con la data più recente.
       */
      thresholds_log?: (LoggedEntryMeta & {
        threshold_pace_per_km?: string;
        lthr_bpm?: number;
        vo2max_estimated?: number;
        test_type?: "campo_time_trial" | "laboratorio" | "stima_gara" | "nessun_test";
        [k: string]: unknown;
      })[];
      [k: string]: unknown;
    };
    cycling?: {
      zone_system?: "3-zone" | "5-zone" | "7-zone";
      /**
       * Una voce per ogni test FTP nel tempo. Il valore attuale è quella con la data più recente.
       */
      thresholds_log?: (LoggedEntryMeta & {
        ftp_watts?: number;
        [k: string]: unknown;
      })[];
      [k: string]: unknown;
    };
    swimming?: {
      /**
       * Una voce per ogni rilevazione CSS nel tempo. Il valore attuale è quella con la data più recente.
       */
      thresholds_log?: (LoggedEntryMeta & {
        css_pace_per_100m?: string;
        [k: string]: unknown;
      })[];
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  /**
   * Fotografia dello stato di allenamento attuale: fondamentale per decidere se serve un ramp-up.
   */
  training_status: {
    /**
     * Stato attuale: nessun calo, oppure reduce da un calo (con dettagli).
     */
    detraining_period?: {
      /**
       * false = nessun calo di volumi/allenamenti; true = reduce da un calo (compilare gli altri campi).
       */
      active?: boolean;
      duration_weeks?: number;
      cause?: "lavoro" | "infortunio" | "malattia" | "viaggio" | "motivazionale" | "altro";
      severity?: "stop_totale" | "forte_riduzione" | "lieve_riduzione";
      [k: string]: unknown;
    };
    /**
     * Storico datato di CTL/ATL/TSB. Il valore attuale è la voce con la data più recente, non un campo a sé.
     */
    load_metrics_log?: (LoggedEntryMeta & {
      /**
       * Fitness cronica (Chronic Training Load).
       */
      ctl?: number;
      /**
       * Fatica acuta (Acute Training Load).
       */
      atl?: number;
      /**
       * Form/Freschezza (Training Stress Balance).
       */
      tsb?: number;
      /**
       * Numero di allenamenti registrati in quel giorno (da sync Intervals.icu o conteggio manuale).
       */
      workouts_count?: number;
      [k: string]: unknown;
    })[];
    /**
     * Fattori di vita ricorrenti/strutturali (non un evento isolato) che condizionano quanto essere aggressivi con i carichi.
     */
    lifestyle_factors?: (
      | "turni_lavoro_variabili"
      | "viaggia_spesso"
      | "sonno_spesso_disturbato"
      | "stress_lavorativo_elevato"
      | "carichi_familiari_elevati"
    )[];
    lifestyle_factors_note?: string;
    [k: string]: unknown;
  };
  goals: {
    primary_objective:
      | "forma_fisica_generale"
      | "miglioramento_ftp"
      | "miglioramento_vo2max"
      | "miglioramento_soglia"
      | "preparazione_gara"
      | "ripartenza_post_stop"
      | "altro";
    /**
     * Testo libero, usato solo quando primary_objective è 'altro'.
     */
    primary_objective_detail?: string;
    /**
     * Solo obiettivi 'di sviluppo' (esclusi 'preparazione_gara' e 'ripartenza_post_stop', che riguardano solo l'obiettivo principale in quanto definiscono l'impianto del piano). Non deve coincidere con primary_objective. Stringa vuota = nessun obiettivo secondario.
     */
    secondary_objective?:
      "" | "forma_fisica_generale" | "miglioramento_ftp" | "miglioramento_vo2max" | "miglioramento_soglia" | "altro";
    /**
     * Testo libero, usato solo quando secondary_objective è 'altro'.
     */
    secondary_objective_detail?: string;
    /**
     * Derivato automaticamente: 'race_peak_taper' se primary_objective è 'preparazione_gara', altrimenti 'continuous_improvement'. Non è un campo scelto indipendentemente.
     */
    periodization_model: "continuous_improvement" | "race_peak_taper";
    target_events?: {
      name?: string;
      date?: string;
      /**
       * Qui 'triathlon' è corretto: è una categoria di evento, non un bucket di volume di allenamento.
       */
      discipline?: "running" | "cycling" | "swimming" | "triathlon" | "other";
      distance_or_duration?: string;
      priority?: "A" | "B" | "C";
      target_result?: string;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  constraints: {
    /**
     * Un elemento per ogni giorno. 'active'/'max_duration_minutes' sono il vincolo reale di disponibilità; 'fixed_activity' è puramente informativo (cosa fai oggi), non un vincolo per la programmazione futura.
     */
    days_available: {
      day?: "lunedi" | "martedi" | "mercoledi" | "giovedi" | "venerdi" | "sabato" | "domenica";
      /**
       * Se il giorno è realisticamente utilizzabile per allenarsi.
       */
      active?: boolean;
      max_duration_minutes?: number;
      /**
       * Informativo: cosa l'atleta fa attualmente quel giorno. Non vincola la programmazione futura.
       */
      fixed_activity?: string;
      [k: string]: unknown;
    }[];
    sessions_per_week_target?: number;
    [k: string]: unknown;
  };
  methodology_preferences: {
    intensity_distribution_model: "polarizzato_80_20" | "piramidale" | "soglia_prevalente" | "misto";
    /**
     * Formato N:1 (settimane carico : settimane scarico).
     */
    load_deload_pattern: string;
    [k: string]: unknown;
  };
  /**
   * Qualsiasi informazione utile non modellata sopra.
   */
  notes_free_text?: string;
  /**
   * Storico dei feedback generati confrontando le sedute pianificate con gli allenamenti realmente svolti (specifica-tecnica.md §5.4).
   */
  weekly_feedback_log?: {
    /**
     * Data di fine della settimana confrontata.
     */
    date: string;
    /**
     * Testo del feedback.
     */
    note: string;
    /**
     * 'claude' se generato tramite il proxy, 'manual' se scritto/incollato a mano dal coach.
     */
    generated_by?: "claude" | "manual";
    [k: string]: unknown;
  }[];
  /**
   * Credenziali/config per sincronizzazioni automatiche con servizi esterni, per-atleta.
   */
  integrations?: {
    /**
     * API key personale Intervals.icu dell'atleta, salvata in chiaro (compromesso di sicurezza accettato, vedi docs/DOCUMENTAZIONE.md §3). Attiva e aggiorna automaticamente la sincronizzazione del carico di allenamento.
     */
    intervals_icu_api_key?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
/**
 * Metadati comuni a ogni voce di uno storico datato: quando risale il dato e da dove viene.
 */
export interface LoggedEntryMeta {
  date: string;
  /**
   * 'manual' per voci inserite dal coach, 'intervals_icu_sync' per voci scritte dalla sincronizzazione automatica con Intervals.icu. Enum pensato per accogliere in futuro altre fonti (es. garmin_sync) senza cambiare struttura.
   */
  source: "manual" | "intervals_icu_sync";
  note?: string;
  [k: string]: unknown;
}
