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

test("Profilo: sezioni chiuse con il riepilogo, guida dall'icona Info chiusa da «indietro» senza perdere le modifiche (D-02, D-04)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  const identity = page.getByRole("button", { name: /^Identità/ });
  await expect(identity).toHaveAttribute("aria-expanded", "false");
  await expect(identity).toContainText("Giulia Ferri, 36 anni, senza email");
  // Nessun testo d'aiuto sotto i campi: la spiegazione e' nella guida.
  await expect(page.getByText("Come lo usa PCoach")).toHaveCount(0);
  await page.getByLabel("Sessioni a settimana (obiettivo)").fill("4");
  await page.getByRole("button", { name: "Guida: Vincoli e disponibilità" }).click();
  const guide = page.getByRole("dialog", { name: "Vincoli e disponibilità" });
  await expect(guide).toContainText("Disponibilità e durata massima sono vincoli");
  await page.goBack();
  await expect(guide).toHaveCount(0);
  await expect(page.getByLabel("Sessioni a settimana (obiettivo)")).toHaveValue("4");
  await expect(page.getByRole("button", { name: "Salva", exact: true })).toBeEnabled();
  await identity.click();
  await expect(page.getByLabel("Peso (kg)")).toBeVisible();
});

test("Impostazioni: le regole avanzate partono chiuse con il riepilogo; un ripristino senza valori personalizzati non chiede nulla (D-02, UX-42)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./#/impostazioni");
  await expect(page.getByRole("heading", { name: "Avanzate" })).toBeVisible();
  for (const title of ["Classificazione delle sedute", "Intensità per sistema di zone"]) {
    const toggle = page.getByRole("button", { name: new RegExp(`^${title}`) });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toContainText("Valori predefiniti");
  }
  await expect(page.getByRole("button", { name: /^Modelli di zone/ })).toContainText("Modelli predefiniti");
  await page.getByRole("button", { name: /^Classificazione delle sedute/ }).click();
  await page.getByLabel("Seduta svolta da (% della durata)").fill("75");
  await expect(page.getByRole("button", { name: /^Classificazione delle sedute/ })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Ripristina le soglie predefinite" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ripristina i predefiniti" }).click();
  await expect(page.getByLabel("Seduta svolta da (% della durata)")).toHaveValue("80");
  await page.getByRole("button", { name: "Ripristina le soglie predefinite" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
