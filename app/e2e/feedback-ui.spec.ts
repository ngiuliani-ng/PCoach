// Verifica UI/UX del feedback settimanale (docs/audit/2026-10-feedback-settimanale-ui, ADR 0038):
// testo salvato in automatico, niente correzioni perse, settimane chiuse, preparazione di una settimana.
import { expect, test, type Page } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend, type MockState } from "./mockBackend";

const LONG = Array.from({ length: 6 }, (_, i) => `Paragrafo ${i + 1}: la settimana è andata bene e il carico è in linea con il piano, continua così senza forzare.`).join("\n\n");

function approved(over: Record<string, unknown>) {
  const base = createState().tables.weekly_reviews[0];
  return { ...base, status: "approved", revision: 1, approved_at: "2026-10-05T08:00:00Z", delivery_status: "sent", delivered_at: "2026-10-05T08:00:00Z", ...over };
}

function withHistory(): MockState {
  const state = createState();
  state.tables.weekly_reviews.push(
    approved({ id: "r-28set", period_start: "2026-09-28", period_end: "2026-10-04", delivery_status: "failed", delivered_at: null, delivery_error: "Il provider ha rifiutato l'indirizzo (422)." }),
    approved({ id: "r-21set", period_start: "2026-09-21", period_end: "2026-09-27", output_text: "Testo già inviato a Giulia." }),
    { ...approved({ id: "r-14set", period_start: "2026-09-14", period_end: "2026-09-20" }), status: "skipped", output: null, output_text: null, delivery_status: "not_requested" }
  );
  (state.tables.athletes[0].data as { identity: { email: string } }).identity.email = "giulia@example.com";
  state.tables.app_settings[0].weekly_feedback_email_enabled = true;
  return state;
}

const cloud = (page: Page) => page.locator(".page-header .save-status");
const draftText = (page: Page) => page.locator("#feedback-review-1 textarea");

test("il testo corretto si salva da solo: nuvola rossa mentre scrivi, verde quando è salvato, e resta dopo un ricaricamento", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(cloud(page)).toHaveClass(/\bsaved\b/);
  await draftText(page).fill("Ciao Giulia, testo corretto dal coach.");
  await expect(cloud(page)).toHaveClass(/unsaved/);
  await expect(cloud(page)).toHaveClass(/\bsaved\b/);
  expect(state.tables.weekly_reviews[0].coach_text).toBe("Ciao Giulia, testo corretto dal coach.");
  // Nessuna scritta sotto il campo: lo stato lo dice la nuvola (decisione del coach).
  await expect(page.locator("#feedback-review-1")).not.toContainText("Salvato");
  await page.reload();
  await expect(draftText(page)).toHaveValue("Ciao Giulia, testo corretto dal coach.");
  // Tornare al testo di Claude: coach_text torna vuoto.
  await draftText(page).fill(String(state.tables.weekly_reviews[0].output_text));
  await draftText(page).blur();
  await expect.poll(() => state.tables.weekly_reviews[0].coach_text).toBeNull();
});

test("un salvataggio non riuscito: errore, nuvola rossa e domanda uscendo dalla scheda (FB-02)", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  let fail = true;
  await page.route("http://e2e.supabase.test/rest/v1/weekly_reviews*", async (route) => {
    if (fail && route.request().method() === "PATCH") {
      return route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ message: "rete non disponibile" }) });
    }
    return route.fallback();
  });
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await draftText(page).fill("Correzione che non si salva.");
  await expect(page.getByRole("alert")).toContainText("Testo del feedback non salvato");
  await expect(cloud(page)).toHaveClass(/unsaved/);
  await page.getByRole("button", { name: "Chiudi messaggio" }).click();
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: "Impostazioni" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Le correzioni al testo del feedback non sono state salvate.");
  await dialog.getByRole("button", { name: "Resta" }).click();
  await expect(draftText(page)).toHaveValue("Correzione che non si salva.");
  // La rete torna: uscendo, il testo si salva e non si chiede nulla.
  fail = false;
  if (await page.locator(".sidebar.open").count()) await page.keyboard.press("Escape");
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: "Impostazioni" }).click();
  await expect(page.getByRole("heading", { name: "Impostazioni", level: 1 })).toBeVisible();
  expect(state.tables.weekly_reviews[0].coach_text).toBe("Correzione che non si salva.");
});

test("«Rigenera» con il testo corretto chiede conferma e, se non riesce, le correzioni restano (FB-01)", async ({ page }) => {
  const state = createState();
  state.regenerateError = "La valutazione è in elaborazione: riprova tra poco.";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await draftText(page).fill("Le mie correzioni.");
  const item = page.locator("#feedback-review-1");
  await item.getByRole("button", { name: "Rigenera" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("perdi le tue correzioni");
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await expect(draftText(page)).toHaveValue("Le mie correzioni.");
  await item.getByRole("button", { name: "Rigenera" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Rigenera e perdi le correzioni" }).click();
  await expect(page.getByRole("alert")).toContainText("in elaborazione");
  await expect(draftText(page)).toHaveValue("Le mie correzioni.");
  // Riesce: la nuova versione ha il testo di Claude.
  state.regenerateError = null;
  await item.getByRole("button", { name: "Rigenera" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Rigenera e perdi le correzioni" }).click();
  await expect(page.locator(".feedback-item textarea").first()).toHaveValue("Testo riscritto da Claude.");
  await expect(cloud(page)).toHaveClass(/\bsaved\b/);
});

test("il campo del testo cresce con il contenuto e la casella del reinvio viene prima di «Approva» (FB-05, FB-06)", async ({ page }) => {
  const state = withHistory();
  Object.assign(state.tables.weekly_reviews[0], { revision: 2, output_text: LONG });
  state.tables.weekly_reviews.push(approved({ id: "r-5ott-1", period_start: "2026-10-05", period_end: "2026-10-11", status: "superseded" }));
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  const ta = draftText(page);
  await expect(ta).toHaveValue(LONG);
  const sizes = await ta.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
  const item = page.locator("#feedback-review-1");
  const box = (s: string) => item.locator(s).boundingBox();
  const checkbox = (await box(".checkbox-line"))!;
  const approve = (await item.getByRole("button", { name: /^Approva/ }).boundingBox())!;
  expect(checkbox.y).toBeLessThan(approve.y);
  await expect(item.locator(".checkbox-line")).toContainText("Invia anche questa versione");
});

test("le settimane chiuse sono una riga che si apre con un clic; l'email non partita resta visibile (FB-04, FB-07, FB-09)", async ({ page }) => {
  await installMockBackend(page, withHistory());
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  const sent = page.locator("#feedback-r-21set");
  const toggle = sent.getByRole("button", { name: /21 set – 27 set 2026/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sent).toContainText("inviato il 5 ott 2026");
  await expect(sent.getByText("Testo già inviato a Giulia.")).toBeHidden();
  await toggle.click();
  await expect(sent.getByText("Testo già inviato a Giulia.")).toBeVisible();
  // Email non partita: motivo e «Riprova l'invio» con la riga chiusa.
  const failed = page.locator("#feedback-r-28set");
  await expect(failed.getByRole("button", { name: /28 set – 4 ott 2026/ })).toHaveAttribute("aria-expanded", "false");
  await expect(failed).toContainText("Email non inviata. Il provider ha rifiutato l'indirizzo (422).");
  await expect(failed.getByRole("button", { name: "Riprova l'invio" })).toBeVisible();
  // Settimana senza sedute: solo lo stato, una volta.
  const skipped = page.locator("#feedback-r-14set");
  await expect(skipped).toContainText("Nessuna seduta da valutare");
  await expect(skipped).not.toContainText("sedute assegnate");
  await expect(skipped).not.toContainText("non c'erano sedute");
  // La bozza resta aperta, con le etichette chiare.
  const draft = page.locator("#feedback-review-1");
  await expect(draft).toContainText("4 sedute assegnate: 3 svolte, 1 senza attività registrata; completamento 75%");
  await expect(draft).toContainText("Limiti dei dati:");
  await expect(draft).toContainText("Sintesi per te:");
});

test("«Prepara il feedback» propone solo le settimane senza feedback (FB-03)", async ({ page }) => {
  const state = withHistory();
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.locator("#feedback-r-21set")).toBeVisible();
  const select = page.locator(".review-create select");
  const options = await select.locator("option").allTextContents();
  for (const taken of ["5 ott – 11 ott 2026", "28 set – 4 ott 2026", "21 set – 27 set 2026", "14 set – 20 set 2026"]) expect(options).not.toContain(taken);
  expect(options.length).toBeGreaterThan(0);
  // Preparate tutte: al posto del selettore, la riga che lo dice.
  for (const opt of options) {
    await page.locator(".review-create select").selectOption({ label: opt });
    await page.getByRole("button", { name: "Prepara il feedback" }).click();
    await expect(page.getByText("Nessuna seduta approvata in quella settimana: niente da valutare.")).toBeVisible();
    await expect(page.locator(".review-create option", { hasText: opt })).toHaveCount(0);
  }
  await expect(page.getByText("Le ultime sei settimane hanno già un feedback: per rifarne uno usa «Rigenera».")).toBeVisible();
  await expect(page.locator(".review-create select")).toHaveCount(0);
});

test("atleta senza email: la nota sta prima di «Approva» e porta al Profilo, sezione Identità (A-18)", async ({ page }) => {
  const state = createState();
  (state.tables.app_settings[0] as Record<string, unknown>).weekly_feedback_email_enabled = true;
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  const week = page.locator(".feedback-item").first();
  const note = week.getByText("L'atleta non ha un indirizzo email");
  await expect(note).toBeVisible();
  const noteBox = await note.boundingBox();
  const approveBox = await week.getByRole("button", { name: "Approva" }).boundingBox();
  expect(noteBox!.y).toBeLessThan(approveBox!.y);

  await week.getByRole("link", { name: "Aggiungi l'indirizzo nel Profilo" }).click();
  await expect(page.getByRole("tab", { name: "Profilo" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#sec-identita .section-toggle")).toHaveAttribute("aria-expanded", "true");
});
