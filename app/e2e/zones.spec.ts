// Zone allineate fra PCoach e Intervals.icu (ADR 0029): avviso all'apertura della scheda, nei due
// sensi, e modelli di zone in Impostazioni.
import { expect, test } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend, type MockState } from "./mockBackend";

const profileOf = (state: MockState) => state.tables.athletes[0].data as Record<string, any>;

test("con zone uguali la scheda non mostra avvisi", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.getByRole("heading", { name: "Giulia Ferri" })).toBeVisible();
  await expect(page.getByText("Zone diverse da Intervals.icu.")).toHaveCount(0);
});

test("zone diverse: «Usa 7 zone in PCoach» aggiorna e salva la scheda", async ({ page }) => {
  const state = createState();
  profileOf(state).physiological_thresholds.running.zone_system = "5-zone";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.getByText("Corsa (passo): 5 zone in PCoach, 7 zone su Intervals.icu.")).toBeVisible();
  await page.getByRole("button", { name: "Usa 7 zone in PCoach" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Impostare 7 zone per corsa in PCoach");
  // Con un piano in corso la stessa conferma avvisa delle sedute da ricontrollare.
  await expect(page.getByRole("alertdialog")).toContainText("le 3 sedute di corsa (da 5 a 7 zone) da oggi in poi tornano «Da verificare»");
  await page.getByRole("alertdialog").getByRole("button", { name: "Usa 7 zone in PCoach" }).click();
  await expect(page.getByText("3 sedute sono da verificare")).toBeVisible();
  await expect(page.getByText("Zone diverse da Intervals.icu.")).toHaveCount(0);
  expect(profileOf(state).physiological_thresholds.running.zone_system).toBe("7-zone");
  const runs = state.tables.workouts.filter((w) => w.discipline === "running" && String(w.planned_date) >= "2026-10-10");
  expect(runs.map((w) => w.needs_review)).toEqual(Array(3).fill("Il sistema di zone della corsa è passato da 5 a 7 zone il 10/10/2026: adatta le zone della seduta."));
  expect(state.zoneApplyCalls).toHaveLength(0);
});

test("zone diverse: «Porta Intervals.icu a 5 zone» mostra i limiti e li scrive dopo la conferma", async ({ page }) => {
  const state = createState();
  profileOf(state).physiological_thresholds.running.zone_system = "5-zone";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await page.getByRole("button", { name: "Porta Intervals.icu a 5 zone" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Friel, 5 zone");
  await expect(dialog).toContainText("Z1 fino a 77,5%, Z2 fino a 87,7%, Z3 fino a 94,3%, Z4 fino a 100%, Z5 oltre");
  await dialog.getByRole("button", { name: "Aggiorna Intervals.icu" }).click();
  await expect(page.getByText("Zone aggiornate su Intervals.icu: 5 zone per corsa.")).toBeVisible();
  await expect(page.getByText("Zone diverse da Intervals.icu.")).toHaveCount(0);
  expect(state.zoneApplyCalls).toEqual([expect.objectContaining({ action: "zones_apply", discipline: "running", key: "running_pace", zones: 5 })]);
  expect(profileOf(state).physiological_thresholds.running.zone_system).toBe("5-zone");
});

test("in Impostazioni si sceglie il modello di zone da un preset o con limiti propri", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto("./#/impostazioni");
  await page.getByText("Bici, potenza").click();
  const model3 = page.getByRole("combobox", { name: "3 zone · modello" }).first();
  await expect(model3).toHaveValue("seiler3");
  const z1 = page.getByRole("group", { name: "Bici, potenza, 3 zone: limiti in percentuale" }).getByLabel("Z1 fino a");
  await z1.fill("110");
  await expect(page.getByText("I valori devono crescere da una zona alla successiva.")).toBeVisible();
  await z1.fill("70");
  await expect(model3).toHaveValue("custom");
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  await expect(page.getByText("Impostazioni salvate.")).toBeVisible();
  expect((state.tables.app_settings[0].zone_models as Record<string, any>).cycling_power[3]).toEqual({ preset: "custom", bounds: [70, 100] });
});

test("cambiare il sistema di zone nel Profilo con un piano in corso: conferma, poi le sedute da oggi tornano da verificare", async ({ page }) => {
  const state = createState();
  // Intervals.icu allineato al nuovo sistema, per non mostrare anche l'avviso sulle zone.
  state.icuSportSettings[1].pace_zones = [77.5, 87.7, 94.3, 100, 999];
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await page.getByRole("combobox", { name: "Sistema di zone" }).selectOption("5-zone");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Stai cambiando il sistema di zone. Se procedi, le 3 sedute di corsa (da 7 a 5 zone) da oggi in poi tornano «Da verificare»");

  // «Non salvare» lascia tutto com'era.
  await dialog.getByRole("button", { name: "Non salvare" }).click();
  expect(profileOf(state).physiological_thresholds.running.zone_system).toBe("7-zone");
  expect(state.tables.workouts.every((w) => !w.needs_review)).toBe(true);

  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await dialog.getByRole("button", { name: "Salva e segna le sedute" }).click();
  await expect(page.getByText("Scheda salvata. 3 sedute sono da verificare")).toBeVisible();
  expect(profileOf(state).physiological_thresholds.running.zone_system).toBe("5-zone");
  const marked = state.tables.workouts.filter((w) => w.needs_review).map((w) => w.title);
  expect(marked.sort()).toEqual(["Corsa rigenerativa", "Lungo", "Tempo"]);
});
