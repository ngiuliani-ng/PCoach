// Navigazione e protezione delle modifiche (audit UX di ottobre 2026, fase 1): conferma all'uscita da
// una scheda o dalle Impostazioni modificate, salvataggi falliti segnalati come tali, stato nell'URL.
import { expect, test, type Page } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend, type MockState } from "./mockBackend";
import { openSection } from "./helpers";

const SECOND_ID = "ATL00002";

function twoAthletes(): MockState {
  const state = createState();
  const second = JSON.parse(JSON.stringify(state.tables.athletes[0].data));
  second.meta.athlete_id = SECOND_ID;
  second.identity = { ...second.identity, nome: "Marco", cognome: "Bianchi" };
  state.tables.athletes.push({ id: SECOND_ID, data: second, updated_at: "2026-10-01T10:00:00Z" });
  return state;
}

/** Su mobile l'elenco degli atleti va aperto prima di sceglierne uno. */
async function sidebar(page: Page) {
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
}

async function openAthlete(page: Page, name: RegExp) {
  await sidebar(page);
  await page.getByRole("button", { name }).first().click();
}

const weightOf = (state: MockState, id = ATHLETE_ID) =>
  (state.tables.athletes.find((a) => a.id === id)!.data as { identity: { weight_kg: number } }).identity.weight_kg;

/** Fa fallire la prossima richiesta con quel metodo verso la tabella degli atleti. */
async function failNext(page: Page, method: string) {
  let failed = false;
  await page.route("http://e2e.supabase.test/rest/v1/athletes*", async (route) => {
    if (!failed && route.request().method() === method) {
      failed = true;
      return route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    }
    return route.fallback();
  });
}

test("cambiare atleta con modifiche non salvate chiede cosa fare", async ({ page }) => {
  const state = twoAthletes();
  await installMockBackend(page, state);
  await page.goto("./");
  await openAthlete(page, /Giulia Ferri/);
  await page.getByRole("tab", { name: "Profilo" }).click();
  await openSection(page, "Identità");
  await page.getByLabel("Peso (kg)").fill("61");

  await openAthlete(page, /Marco Bianchi/);
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("modifiche non salvate alla scheda di Giulia Ferri");
  await dialog.getByRole("button", { name: "Resta" }).click();
  await openSection(page, "Identità");
  await expect(page.getByLabel("Peso (kg)")).toHaveValue("61");

  await openAthlete(page, /Marco Bianchi/);
  await page.getByRole("alertdialog").getByRole("button", { name: "Salva e continua" }).click();
  await expect(page.getByRole("heading", { name: "Marco Bianchi" })).toBeVisible();
  expect(weightOf(state)).toBe(61);
});

test("uscire senza salvare torna all'ultima versione salvata", async ({ page }) => {
  const state = twoAthletes();
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await openSection(page, "Identità");
  await page.getByLabel("Peso (kg)").fill("63");
  await openAthlete(page, /Marco Bianchi/);
  await page.getByRole("alertdialog").getByRole("button", { name: "Esci senza salvare" }).click();
  await openAthlete(page, /Giulia Ferri/);
  await page.getByRole("tab", { name: "Profilo" }).click();
  await openSection(page, "Identità");
  await expect(page.getByLabel("Peso (kg)")).toHaveValue("58");
  expect(weightOf(state)).toBe(58);
});

test("dalle Impostazioni si torna all'atleta aperto; le Impostazioni modificate chiedono conferma", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto("./");
  await openAthlete(page, /Giulia Ferri/);
  await sidebar(page);
  await page.getByRole("button", { name: "Impostazioni" }).click();
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
  await openSection(page, "Feedback settimanale");
  await page.getByLabel("Tono del feedback").fill("Tono asciutto.");
  await expect(page.getByRole("button", { name: "Salva impostazioni" })).toBeEnabled();

  await openAthlete(page, /Giulia Ferri/);
  await page.getByRole("alertdialog").getByRole("button", { name: "Esci senza salvare" }).click();
  await expect(page.getByRole("heading", { name: "Giulia Ferri" })).toBeVisible();
  expect(state.tables.app_settings[0].weekly_feedback_prompt_template).toBeNull();
});

test("un nuovo atleta non salvato per un errore resta modificato e si salva al nuovo tentativo", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await failNext(page, "POST");
  await page.goto("./");
  await sidebar(page);
  await page.getByRole("button", { name: "Nuovo atleta" }).click();
  await openSection(page, "Identità");
  await page.getByLabel("Nome", { exact: true }).fill("Luca");
  const save = page.getByRole("button", { name: "Salva", exact: true });
  await save.click();

  await expect(page.getByText(/Scheda non salvata: il server non ha risposto/)).toBeVisible();
  await expect(save).toBeEnabled();
  expect(state.tables.athletes).toHaveLength(1);

  await save.click();
  await expect(page.getByText("Scheda salvata.")).toBeVisible();
  expect(state.tables.athletes).toHaveLength(2);
  await expect(page).toHaveURL(/#\/atleta\/[A-Z0-9]{8}\/profilo$/);
});

test("una scheda esistente non salvata per un errore non risulta salvata", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await failNext(page, "PATCH");
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await openSection(page, "Identità");
  await page.getByLabel("Peso (kg)").fill("62");
  const save = page.getByRole("button", { name: "Salva", exact: true });
  await save.click();
  await expect(page.getByText(/Scheda non salvata/)).toBeVisible();
  await expect(save).toBeEnabled();
  expect(weightOf(state)).toBe(58);
  await save.click();
  await expect(page.getByText("Scheda salvata.")).toBeVisible();
  expect(weightOf(state)).toBe(62);
});

test("atleta, vista e seduta restano nell'URL; «indietro» chiude il pannello", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await expect(page.getByRole("tab", { name: "Piano" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  await page.getByRole("button", { name: /Apri VO2max/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/seduta=/);

  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("dialog").getByLabel("Obiettivo della seduta").fill("Cambiato");
  await page.goBack();
  await expect(page.getByRole("alertdialog")).toContainText("Chiudere la seduta senza salvare");
  await page.getByRole("alertdialog").getByRole("button", { name: "Chiudi senza salvare" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("tab", { name: "Piano" })).toHaveAttribute("aria-selected", "true");
});

test("un errore di rete al salvataggio della seduta lascia il pannello aperto con le modifiche", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  let failed = false;
  await page.route("http://e2e.supabase.test/rest/v1/workouts*", async (route) => {
    if (!failed && route.request().method() === "PATCH") {
      failed = true;
      return route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    }
    return route.fallback();
  });
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  await page.getByRole("button", { name: /Apri VO2max/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Obiettivo della seduta").fill("Potenza aerobica");
  await drawer.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText(/Salvataggio non riuscito/)).toBeVisible();
  await expect(drawer.getByLabel("Obiettivo della seduta")).toHaveValue("Potenza aerobica");
  await drawer.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
});

// ---------- Audit A-06 e A-15: errori che portano al campo ----------

test("nuovo atleta senza nome: «Salva» apre Identità, porta al campo e lo segna (A-06)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./#/atleta/nuovo");
  await openSection(page, "Note libere");
  await page.locator("textarea[aria-label='Note libere']").fill("prima nota");
  await page.getByRole("button", { name: "Salva", exact: true }).click();

  const nome = page.getByLabel("Nome", { exact: true });
  await expect(page.locator("#sec-identita .section-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(nome).toBeFocused();
  await expect(nome).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Il nome è obbligatorio per salvare la scheda.")).toBeVisible();

  await nome.fill("Anna");
  await expect(page.getByText("Il nome è obbligatorio per salvare la scheda.")).toHaveCount(0);
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/#\/atleta\/[A-Z0-9]+\/profilo/);
});

// In attesa della correzione di A-28 (audit 2026-10-ux-ui-1-2-0): una navigazione annullata dalla guardia
// chiude la bozza in router.afterEach, e la scheda resta su «Caricamento…».
test.fixme("nuovo atleta senza nome: «Salva e continua» resta sulla scheda e porta al campo (A-06)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./#/atleta/nuovo");
  await openSection(page, "Note libere");
  await page.locator("textarea[aria-label='Note libere']").fill("prima nota");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: /^Da fare/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Salva e continua" }).click();

  await expect(page).toHaveURL(/#\/atleta\/nuovo/);
  await expect(page.getByLabel("Nome", { exact: true })).toBeFocused();
  await expect(page.getByText("Il nome è obbligatorio per salvare la scheda.")).toBeVisible();
});

test("login: rete assente e credenziali sbagliate hanno messaggi diversi, il focus torna sulla password (A-15)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.addInitScript(() => localStorage.clear());
  await page.goto("./");
  await page.route("**/auth/v1/token**", (r) => r.abort("internetdisconnected"));
  await page.getByLabel("Email").fill("coach@example.com");
  await page.getByLabel("Password").fill("x");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toHaveText("Server di accesso non raggiungibile: controlla la connessione e riprova.");
  await expect(page.getByLabel("Password")).toBeFocused();

  await page.unroute("**/auth/v1/token**");
  await page.route("**/auth/v1/token**", (r) => r.fulfill({
    status: 400, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" })
  }));
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toHaveText("Credenziali non valide.");
  await expect(page.getByLabel("Password")).toBeFocused();
});
