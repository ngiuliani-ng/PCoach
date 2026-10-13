// Feedback settimanale (ADR 0019), su backend finto: il coach rivede la bozza con gli esiti
// calcolati da PCoach, modifica il testo e lo approva.
import { expect, test } from "@playwright/test";
import { createState, installMockBackend } from "./mockBackend";

test("rivede una bozza di feedback, modifica il testo e la approva", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto("./");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: /Giulia Ferri/ }).first().click();

  await expect(page.getByText("Da approvare", { exact: true })).toBeVisible();
  await expect(page.getByText("completamento 75%")).toBeVisible();
  await expect(page.getByText("1 senza attività registrata")).toBeVisible();
  await page.getByText("Sedute della settimana").click();
  await expect(page.getByText("Nessuna attività registrata")).toBeVisible();

  const text = page.getByLabel("Testo per l'atleta (modificabile)");
  await text.fill("Ciao Giulia, tre sedute su quattro: com'è andata giovedì?");
  await page.getByRole("button", { name: "Approva", exact: true }).click();

  await expect(page.getByText("Feedback approvato. L'invio via email è disattivato in Impostazioni.")).toBeVisible();
  const review = state.tables.weekly_reviews[0];
  expect(review.status).toBe("approved");
  expect(review.output_text).toBe("Ciao Giulia, tre sedute su quattro: com'è andata giovedì?");
  await expect(page.getByText("Approvato", { exact: true })).toBeVisible();
});
