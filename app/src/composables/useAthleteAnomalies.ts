// Anomalie dell'atleta aperto, raccolte in un solo elenco per la tab «Anomalie» e il numero nella sua
// etichetta (ADR 0031, 0033, 0034). Ogni anomalia dice cosa ferma (feedback settimanale, invio a
// Intervals.icu, email all'atleta) e porta l'azione per sistemarla. L'elenco non ha gruppi: prima cio'
// che e' gia' fallito, poi cio' che va sistemato. Zone e soglie si confrontano con Intervals.icu all'apertura della
// scheda, sul profilo salvato (ADR 0029, 0030).
import { computed, ref, watch } from "vue";
import { useAthletesStore } from "../stores/athletes";
import { useSettingsStore } from "../stores/settings";
import { useWorkoutsStore } from "../stores/workouts";
import { useReviewsStore } from "../stores/reviews";
import { useIntervalsSync } from "./useIntervalsSync";
import { useZoneChange } from "./useZoneChange";
import { showResultToast, showToast } from "./useToast";
import { confirmDialog } from "./useConfirmDialog";
import { hasFtp, type ZoneDiscipline } from "../domain/athlete";
import { applyThreshold, applyZones, readZones } from "../services/intervalsSync";
import { formatDate } from "../constants";
import { localSyncState } from "@shared/workouts/sync.ts";
import { missingThresholds, thresholdChecks, type ThresholdCheck } from "@shared/workouts/thresholds.ts";
import {
  icuZonesUpdate, presetsFor, resolveZoneModels, sportSettingsFor, ZONE_MODEL_INFO, ZONE_PRESETS, zoneChecks,
  type IcuSportSettings, type ZoneCheck
} from "@shared/workouts/zoneModels.ts";
import type { ZoneCount } from "@shared/workouts/zones.ts";

/** Cosa ferma un'anomalia: feedback e invio insieme, solo il feedback, solo l'invio, l'email all'atleta. */
export type AnomalyGroup = "both" | "feedback" | "sync" | "email";

/** Riga «Ferma: …» di ogni anomalia. */
export const ANOMALY_STOPS: Record<AnomalyGroup, string> = {
  both: "feedback settimanale e invio a Intervals.icu",
  feedback: "feedback settimanale",
  sync: "invio a Intervals.icu",
  email: "email del feedback all'atleta"
};

export interface AnomalyAction {
  label: string;
  run: () => void | Promise<void>;
  /** "write" cambia qualcosa (pulsante), "go" porta dove si sistema (link). */
  kind: "write" | "go";
}

export interface AnomalyItem {
  id: string;
  text: string;
  reason: string | null;
  open: () => void;
}

export interface Anomaly {
  key: string;
  group: AnomalyGroup;
  /** "err": qualcosa e' gia' fallito; "warn": va sistemato. */
  tone: "warn" | "err";
  title: string;
  detail: string;
  items?: AnomalyItem[];
  actions: AnomalyAction[];
}

export interface AnomalyNavigation {
  openThresholds: (discipline: ZoneDiscipline) => void;
  openIntervalsKey: () => void;
  openIdentity: () => void;
  openFeedback: (reviewId: string) => void;
  openWorkout: (id: string) => void;
}

const DISCIPLINE_OF: Record<ZoneDiscipline, string> = { running: "della corsa", cycling: "della bici", swimming: "del nuoto" };
/** Settimane di feedback controllate: le stesse mostrate senza «Mostra tutti». */
const FEEDBACK_WEEKS = 4;

export function useAthleteAnomalies(nav: AnomalyNavigation) {
  const athletes = useAthletesStore();
  const settings = useSettingsStore();
  const workouts = useWorkoutsStore();
  const reviews = useReviewsStore();
  const intervalsSync = useIntervalsSync();
  const zoneChange = useZoneChange();

  // ---------- Zone e soglie su Intervals.icu ----------
  const icu = ref<IcuSportSettings[] | null>(null);
  const checking = ref(false);
  const busy = ref(false);
  let request = 0;

  const saved = computed(() => (athletes.currentId ? athletes.athletes[athletes.currentId] : null));
  const apiKey = computed(() => saved.value?.integrations?.intervals_icu_api_key?.trim() ?? "");

  async function load() {
    const id = athletes.currentId;
    const mine = ++request;
    icu.value = null;
    if (!id || !apiKey.value) return;
    checking.value = true;
    const res = await readZones(id);
    if (mine !== request) return;
    checking.value = false;
    // Una lettura non riuscita non aggiunge anomalie: la chiave non valida ha la sua.
    if (res.ok) icu.value = res.data.settings;
  }
  watch([() => athletes.currentId, apiKey], load, { immediate: true });

  const zoneMismatches = computed<ZoneCheck[]>(() =>
    icu.value && saved.value ? zoneChecks(saved.value, hasFtp(saved.value), icu.value).filter((c) => !c.aligned) : []
  );
  const thresholdMismatches = computed<ThresholdCheck[]>(() =>
    icu.value && saved.value ? thresholdChecks(saved.value, icu.value).filter((c) => !c.aligned) : []
  );

  const disciplineWord = (c: ZoneCheck) => c.label.split(" (")[0].toLowerCase();

  async function adoptIntervalsZones(c: ZoneCheck) {
    if (athletes.isDirty) {
      showToast("Salva o annulla prima le modifiche della scheda.");
      return;
    }
    if (c.discipline === "swimming") return;
    const n = c.intervals as ZoneCount;
    // Con un piano in corso le sedute da svolgere tornano da verificare: l'avviso e' nella stessa conferma.
    const warning = zoneChange.warningFor([{ discipline: c.discipline, from: c.pcoach, to: n }]);
    const ok = await confirmDialog(
      `Impostare ${n} zone per ${disciplineWord(c)} in PCoach, come su Intervals.icu? Da ora generazione, editor e feedback usano Z1-Z${n}.${warning ? " " + warning : ""}`,
      { confirmLabel: `Usa ${n} zone in PCoach`, tone: "primary" }
    );
    const profile = athletes.currentProfile;
    if (!ok || !profile) return;
    profile.physiological_thresholds![c.discipline]!.zone_system = `${n}-zone`;
    showResultToast(await zoneChange.saveProfile(true));
  }

  function describeBounds(c: ZoneCheck, bounds: number[]): string {
    const unit = ZONE_MODEL_INFO[c.key].field === "hr_zones" ? " bpm" : "%";
    const upper = bounds.slice(0, -1).map((b, i) => `Z${i + 1} fino a ${b.toLocaleString("it-IT")}${unit}`);
    return `${upper.join(", ")}, Z${bounds.length} oltre`;
  }

  async function writeZones(c: ZoneCheck) {
    const id = athletes.currentId;
    const sport = icu.value ? sportSettingsFor(icu.value, c.discipline) : undefined;
    if (!id || !sport) return;
    // Si scrivono i modelli salvati in Impostazioni (gli stessi che legge il server).
    const models = resolveZoneModels(JSON.parse(settings.baseline).zone_models);
    const update = icuZonesUpdate(c.key, c.pcoach, models, sport);
    if (!update.ok) {
      showToast(update.error);
      return;
    }
    const model = models[c.key][c.pcoach]!;
    const preset = ZONE_PRESETS[c.key].find((p) => p.id === model.preset && p.zones === c.pcoach);
    const ok = await confirmDialog(
      `Portare a ${c.pcoach} zone ${c.label.toLowerCase()} su Intervals.icu? Nuove zone (${preset?.label ?? "modello personalizzato"}): ${describeBounds(c, update.bounds)}. Cambiano le zone dell'atleta su Intervals.icu, anche quelle che vede l'atleta.`,
      { confirmLabel: "Aggiorna Intervals.icu", tone: "primary" }
    );
    if (!ok) return;
    busy.value = true;
    const res = await applyZones(id, c.discipline, c.key, c.pcoach);
    busy.value = false;
    if (!res.ok || !res.data.ok) showToast(res.ok ? res.data.error ?? "Aggiornamento non riuscito." : res.error);
    else showToast(`Zone aggiornate su Intervals.icu: ${c.pcoach} zone per ${disciplineWord(c)}.`);
    await load();
  }

  async function writeThreshold(c: ThresholdCheck) {
    const id = athletes.currentId;
    if (!id || c.pcoach === null) return;
    const ok = await confirmDialog(
      `Impostare su Intervals.icu ${c.label.toLowerCase()} ${c.format(c.pcoach)}, come nella scheda? Cambiano le zone in valore assoluto che vede l'atleta e il calcolo del tempo nelle zone delle prossime attività.`,
      { confirmLabel: "Aggiorna Intervals.icu", tone: "primary" }
    );
    if (!ok) return;
    busy.value = true;
    const res = await applyThreshold(id, c.discipline);
    busy.value = false;
    if (!res.ok || !res.data.ok) showToast(res.ok ? res.data.error ?? "Aggiornamento non riuscito." : res.error);
    else showToast(`Soglia aggiornata su Intervals.icu: ${c.label.toLowerCase()} ${c.format(c.pcoach)}.`);
    await load();
  }

  /** Modello che PCoach scriverebbe su Intervals.icu, per il testo dell'azione. */
  const modelLabel = (c: ZoneCheck) => {
    const m = settings.settings.zone_models[c.key][c.pcoach];
    return ZONE_PRESETS[c.key].find((p) => p.id === m?.preset && p.zones === c.pcoach)?.label ?? presetsFor(c.key, c.pcoach)[0]?.label ?? "";
  };

  // ---------- Elenco ----------
  const workoutText = (w: { planned_date: string; title: string }) => `${formatDate(w.planned_date, false)}, ${w.title}`;

  const anomalies = computed<Anomaly[]>(() => {
    if (!athletes.currentId || !saved.value) return [];
    const out: Anomaly[] = [];

    // Fermano feedback e invio (ADR 0033): zone e soglie non allineate, chiave non valida.
    for (const c of zoneMismatches.value) {
      const actions: AnomalyAction[] = [];
      if (c.canUseIntervals) actions.push({ label: `Usa ${c.intervals} zone in PCoach`, kind: "write", run: () => adoptIntervalsZones(c) });
      if (!c.intervalsBlocked) actions.push({ label: `Porta Intervals.icu a ${c.pcoach} zone`, kind: "write", run: () => writeZones(c) });
      out.push({
        key: `zones-${c.discipline}`, group: "both", tone: "warn",
        title: `Zone ${DISCIPLINE_OF[c.discipline]} diverse da Intervals.icu`,
        detail: `${c.pcoach} zone in PCoach, ${c.intervals === null ? "nessuna zona" : `${c.intervals} zone`} su Intervals.icu.${c.intervalsBlocked ? ` ${c.intervalsBlocked}` : ` «Porta Intervals.icu a ${c.pcoach} zone» scrive il modello ${modelLabel(c)}.`}`,
        actions
      });
    }
    for (const c of thresholdMismatches.value) {
      const what = c.label.split(", ")[1];
      out.push({
        key: `threshold-${c.discipline}`, group: "both", tone: "warn",
        title: `Soglia ${DISCIPLINE_OF[c.discipline]} diversa da Intervals.icu`,
        detail: `${what.charAt(0).toUpperCase()}${what.slice(1)} ${c.format(c.pcoach!)} in PCoach, ${c.intervals === null ? "nessun valore" : c.format(c.intervals)} su Intervals.icu.`,
        actions: [{ label: "Aggiorna Intervals.icu", kind: "write", run: () => writeThreshold(c) }]
      });
    }
    for (const m of missingThresholds(saved.value)) {
      const discipline: ZoneDiscipline = m.includes("corsa") ? "running" : "swimming";
      out.push({
        key: `missing-${discipline}`, group: "both", tone: "warn",
        title: `Manca ${m}`,
        detail: "Serve a stimare la durata degli step a distanza e al feedback settimanale.",
        actions: [{ label: "Aggiungila nel Profilo", kind: "go", run: () => nav.openThresholds(discipline) }]
      });
    }
    if (intervalsSync.statusFor(athletes.currentId) === "invalid") {
      out.push({
        key: "key", group: "both", tone: "err",
        title: "Chiave Intervals.icu non valida",
        detail: "Senza una chiave valida PCoach non invia le sedute e non legge carico, zone e attività.",
        actions: [{ label: "Cambia la chiave nel Profilo", kind: "go", run: nav.openIntervalsKey }]
      });
    }

    // Ferma l'email all'atleta (decisione del coach D-05): con l'invio attivo l'indirizzo e' obbligatorio,
    // ma la scheda si salva anche senza.
    if (settings.savedEmailEnabled && !saved.value.identity?.email?.trim()) {
      out.push({
        key: "email", group: "email", tone: "warn",
        title: "Manca l'email dell'atleta",
        detail: "L'invio via email è attivo in Impostazioni: il feedback approvato non arriva all'atleta finché non aggiungi l'indirizzo.",
        actions: [{ label: "Aggiungila nel Profilo", kind: "go", run: nav.openIdentity }]
      });
    }

    // Fermano il feedback settimanale.
    const weeks = [...new Set(reviews.current.map((r) => r.period_start))].slice(0, FEEDBACK_WEEKS);
    for (const r of reviews.current.filter((x) => weeks.includes(x.period_start))) {
      const week = `del ${formatDate(r.period_start, false)}`;
      if (r.status === "analysis_failed" || r.status === "generation_failed") {
        out.push({
          key: `review-${r.id}`, group: "feedback", tone: "err",
          title: `Feedback della settimana ${week} non preparato`,
          detail: r.error || "Valutazione non riuscita.",
          actions: [{ label: "Apri il feedback", kind: "go", run: () => nav.openFeedback(r.id) }]
        });
      } else if (r.status === "approved" && (r.delivery_status === "failed" || r.delivery_status === "skipped")) {
        out.push({
          key: `delivery-${r.id}`, group: "email", tone: "err",
          title: `Feedback della settimana ${week} approvato ma non inviato`,
          detail: r.delivery_error || "L'email all'atleta non è partita.",
          actions: [{ label: "Apri il feedback", kind: "go", run: () => nav.openFeedback(r.id) }]
        });
      }
    }

    // Fermano l'invio a Intervals.icu.
    const active = workouts.workouts.filter((w) => (w.status === "draft" || w.status === "approved") && !w.completed_at);
    const toVerify = active.filter((w) => w.needs_review);
    if (toVerify.length) {
      out.push({
        key: "needs-review", group: "sync", tone: "warn",
        title: toVerify.length === 1 ? "Una seduta da verificare" : `${toVerify.length} sedute da verificare`,
        detail: "Finché non le verifichi nel pannello della seduta non vanno su Intervals.icu.",
        items: toVerify.map((w) => ({ id: w.id, text: workoutText(w), reason: w.needs_review, open: () => nav.openWorkout(w.id) })),
        actions: []
      });
    }
    const failed = active.filter((w) => localSyncState(w, workouts.syncRows[w.id]) === "error");
    if (failed.length) {
      out.push({
        key: "sync-error", group: "sync", tone: "err",
        title: failed.length === 1 ? "Un invio a Intervals.icu non riuscito" : `${failed.length} invii a Intervals.icu non riusciti`,
        detail: "Riprova da «Sincronizza settimana» nel Piano, dopo aver letto il motivo.",
        items: failed.map((w) => ({ id: w.id, text: workoutText(w), reason: workouts.syncRows[w.id]?.last_error ?? null, open: () => nav.openWorkout(w.id) })),
        actions: []
      });
    }
    // Prima cio' che e' gia' fallito, poi cio' che va sistemato; a parita', l'ordine sopra.
    return out.map((a, i) => ({ a, i })).sort((x, y) => Number(x.a.tone !== "err") - Number(y.a.tone !== "err") || x.i - y.i).map(({ a }) => a);
  });

  /** Numero nell'etichetta della tab: le sedute raggruppate contano una per una. */
  const count = computed(() => anomalies.value.reduce((n, a) => n + (a.items?.length ?? 1), 0));

  return { anomalies, count, checking, busy };
}
