// Flussi principali della tab Piano (ADR 0017), su backend finto: modifica e approvazione,
// rigenerazione con anteprima, sincronizzazione con errore parziale e nuovo tentativo.
import { expect, test, type Page } from "@playwright/test";
import { createState, installMockBackend, type MockState } from "./mockBackend";

async function openPlan(page: Page, state: MockState) {
  await installMockBackend(page, state);
  await page.goto("./");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: /Giulia Ferri/ }).first().click();
  await page.getByRole("tab", { name: "Piano" }).click();
  // Settimana successiva a quella di oggi (10 ottobre): 12-18 ottobre.
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  await expect(page.getByText("12 ott – 18 ott")).toBeVisible();
}

test("modifica una bozza e la approva: la revisione sale e lo stato cambia", async ({ page }) => {
  const state = createState();
  await openPlan(page, state);

  await page.getByRole("button", { name: /Apri VO2max/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Da revisionare")).toBeVisible();
  await expect(drawer.getByText("Serie principale 5x")).toBeAttached();

  await drawer.getByLabel("Ripetizioni").fill("6");
  await drawer.getByLabel("Obiettivo della seduta").fill("Potenza aerobica massima");
  await drawer.getByRole("button", { name: "Salva e approva" }).click();

  await expect(page.getByText("Seduta approvata.")).toBeVisible();
  const saved = state.tables.workouts.find((w) => w.title === "VO2max 5 × 4'")!;
  expect(saved.status).toBe("approved");
  expect(saved.revision).toBe(2);
  expect((saved.structure as { steps: { count?: number }[] }).steps[1].count).toBe(6);
});

test("ripianifica da una data: anteprima delle differenze e applicazione in bozza", async ({ page }) => {
  const state = createState();
  state.claudeResponse = {
    plan_name: "Ripresa graduale",
    weeks: [{ week_start: "2026-10-12", label: "Ripresa", is_deload: true }],
    workouts: [
      { date: "2026-10-14", discipline: "running", title: "Corsa facile", objective: "Riattivare", steps: [{ kind: "step", role: "steady", duration_sec: 2100, zone: "Z2" }] },
      { date: "2026-10-15", discipline: "cycling", title: "Bici aerobica", steps: [{ kind: "step", role: "steady", duration_sec: 3600, zone: "Z2" }] }
    ]
  };
  await openPlan(page, state);

  await page.getByRole("button", { name: /Ripianifica da/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ripianifica da").fill("2026-10-14");
  await dialog.getByLabel("Ripianifica da").dispatchEvent("change");
  await dialog.getByLabel("Settimane da generare").fill("1");
  await dialog.getByLabel("Cosa è cambiato").fill("Affaticamento: ridurre l'intensità");
  // La seduta del 18 la mantengo.
  await dialog.getByRole("checkbox", { name: /Lungo/ }).check();
  await dialog.getByRole("button", { name: "Genera la proposta" }).click();

  await expect(dialog.getByText("1 mantenute, 1 sostituite, 1 aggiunte, 0 tolte")).toBeVisible();
  await expect(dialog.getByText(/sostituita o tolta è già su Intervals.icu/)).toBeVisible();
  await dialog.getByRole("button", { name: "Applica la nuova programmazione" }).click();

  await expect(page.getByText(/Nuova programmazione applicata: 2 sedute/)).toBeVisible();
  const call = state.rpcCalls.find((c) => c.name === "apply_plan_generation")!;
  const p = (call.body as { p: { keep: { id: string }[]; supersede: unknown[]; insert: { primary_target: string; title: string }[] } }).p;
  expect(p.keep).toHaveLength(1);
  expect(p.supersede).toHaveLength(1);
  expect(p.insert.find((i) => i.title === "Bici aerobica")?.primary_target).toBe("power"); // FTP presente
  await expect(page.getByRole("button", { name: /Apri Corsa facile/ })).toBeVisible();
  await expect(page.getByText(/Ripresa graduale/)).toBeVisible();
});

test("sincronizza la settimana: anteprima, errore parziale e nuovo tentativo solo sul fallito", async ({ page }) => {
  const state = createState();
  const toCreate = state.tables.workouts.find((w) => w.title === "Corsa rigenerativa")!;
  state.failOnceIds.add(String(toCreate.id));
  await openPlan(page, state);

  await page.getByRole("button", { name: "Sincronizza settimana" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Da creare" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Da aggiornare" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /Da rimuovere/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Non verranno inviate" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Rimuovi da Intervals.icu" })).toBeChecked();

  await dialog.getByRole("button", { name: /Sincronizza 3 sedute, di cui 1 da rimuovere/ }).click();
  await expect(dialog.getByText("2 riuscite, 1 non riuscita")).toBeVisible();
  await expect(dialog.getByText(/429/)).toBeVisible();
  expect(state.applyCalls.map((c) => c.op).sort()).toEqual(["create", "delete", "update"]);

  await dialog.getByRole("button", { name: "Riprova la non riuscita" }).click();
  await expect(dialog.getByText("Tutte le 3 operazioni sono riuscite.")).toBeVisible();
  expect(state.applyCalls.filter((c) => c.workout_id === toCreate.id)).toHaveLength(2);
  // La bozza non e' mai stata inviata.
  const draft = state.tables.workouts.find((w) => w.status === "draft")!;
  expect(state.applyCalls.some((c) => c.workout_id === draft.id)).toBe(false);
});
