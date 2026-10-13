// Audit UI/UX completo di ottobre 2026 (docs/audit/2026-10-ux-ui-completo): comportamenti verificati
// dopo le correzioni.
import { expect, test } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend } from "./mockBackend";

test("a 320 px la scheda non scorre in orizzontale, anche con il numero delle anomalie (UX-03)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const state = createState();
  // Una seduta da verificare: la tab «Anomalie» mostra il numero.
  (state.tables.workouts[0] as Record<string, unknown>).needs_review = "Durata oltre il massimo del giorno.";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.getByRole("tab", { name: /Anomalie/ })).toContainText("1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("una seduta della settimana in Panoramica apre il suo pannello, e «indietro» torna alla Panoramica (UX-12)", async ({ page }) => {
  const state = createState();
  (state.tables.workouts[0] as Record<string, unknown>).planned_date = "2026-10-09";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await page.getByRole("button", { name: /^Apri Corsa rigenerativa/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nome della seduta" })).toHaveValue("Corsa rigenerativa");
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Panoramica" })).toHaveAttribute("aria-selected", "true");
});

test("righe delle sedute con i soli stati da sistemare; storico filtrato da un selettore (D-03)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  // «Lungo» è approvata e su Intervals.icu: nella riga nessun badge, nel pannello entrambi.
  const row = page.getByRole("button", { name: /^Apri Lungo/ });
  await expect(row).not.toContainText("Approvata");
  await expect(row).not.toContainText("Su Intervals.icu");
  await expect(page.getByRole("button", { name: /^Apri VO2max/ })).toContainText("Bozza");
  await row.click();
  await expect(page.getByRole("dialog")).toContainText("Approvata");
  await expect(page.getByRole("dialog")).toContainText("Su Intervals.icu");
  await expect(page.getByRole("dialog")).toContainText("Versione 1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Storico" }).click();
  await expect(page.locator(".chip")).toHaveCount(0);
  await page.getByLabel("Sedute").selectOption("review");
  await expect(page.locator(".w-row-open")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Apri VO2max/ })).toBeVisible();
});
