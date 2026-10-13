// Interfaccia coerente con il comportamento (audit UX di ottobre 2026, fase 2): cio' che la UI mostra
// o promette e' cio' che il sistema usa davvero.
import { expect, test, type Page } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend, type MockState } from "./mockBackend";

const profileOf = (state: MockState) => state.tables.athletes[0].data as Record<string, any>;

/** Corpo dell'ultima richiesta a claude-proxy. */
async function captureClaude(page: Page) {
  const calls: { system: string; prompt: string }[] = [];
  await page.route("http://e2e.supabase.test/functions/v1/claude-proxy", async (route) => {
    calls.push(route.request().postDataJSON());
    return route.fallback();
  });
  return calls;
}

test("un doppio clic su «Genera la proposta» crea una sola generazione", async ({ page }) => {
  const state = createState();
  state.claudeResponse = { plan_name: "x", weeks: [], workouts: [] };
  await installMockBackend(page, state);
  const calls = await captureClaude(page);
  // La sincronizzazione del carico che precede la chiamata richiede tempo.
  await page.route("https://intervals.icu/**", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: /Prosegui il piano/ }).click();
  const generate = page.getByRole("dialog").getByRole("button", { name: "Genera la proposta" });
  await generate.click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Preparo la richiesta…" })).toBeDisabled();
  await page.waitForTimeout(2000);
  expect(state.tables.plan_generations).toHaveLength(1);
  expect(calls).toHaveLength(1);
});

test("uno schema di carico non riconosciuto è segnalato nel Profilo e prima di generare", async ({ page }) => {
  const state = createState();
  profileOf(state).methodology_preferences.load_deload_pattern = "tre settimane e una di scarico";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: /Prosegui il piano/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Lo schema di carico e scarico dell'atleta non è riconosciuto");
  await page.getByRole("dialog").getByRole("button", { name: "Annulla" }).click();

  await page.getByRole("tab", { name: "Profilo" }).click();
  await expect(page.getByText(/Lo schema salvato «tre settimane e una di scarico» non è riconosciuto/)).toBeVisible();
  await page.getByRole("combobox", { name: "Settimane di carico", exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Scheda salvata.")).toBeVisible();
  expect(profileOf(state).methodology_preferences.load_deload_pattern).toBe("4:1");
});

test("con modifiche non salvate la generazione chiede se salvarle; Claude riceve la scheda salvata", async ({ page }) => {
  const state = createState();
  state.claudeResponse = { plan_name: "x", weeks: [], workouts: [] };
  await installMockBackend(page, state);
  const calls = await captureClaude(page);
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await page.getByLabel("Sessioni a settimana (obiettivo)").fill("3");
  await page.getByRole("tab", { name: "Piano" }).click();
  await page.getByRole("button", { name: /Prosegui il piano/ }).click();

  const question = page.getByRole("alertdialog");
  await expect(question).toContainText("Claude riceve la scheda salvata");
  await question.getByRole("button", { name: "Genera con i dati salvati" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Genera la proposta" }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].prompt).toContain('"sessions_per_week_target": 5');
  // Le modifiche restano nella scheda, non salvate: fuori dal Profilo l'header offre «Salva il profilo».
  await expect(page.getByRole("button", { name: "Salva il profilo" })).toBeEnabled();
});

test("«Salva e genera» salva la scheda prima di aprire la generazione", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await page.getByLabel("Sessioni a settimana (obiettivo)").fill("4");
  await page.getByRole("tab", { name: "Piano" }).click();
  await page.getByRole("button", { name: /Prosegui il piano/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Salva e genera" }).click();
  await expect(page.getByRole("dialog")).toContainText("Prosegui il piano");
  expect(profileOf(state).constraints.sessions_per_week_target).toBe(4);
});

test("con l'email attiva un atleta senza indirizzo è un'anomalia; approvando, il feedback resta da inviare (D-05)", async ({ page }) => {
  const state = createState();
  state.tables.app_settings[0].weekly_feedback_email_enabled = true;
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.getByText("L'atleta non ha un indirizzo email: approvando, il feedback non gli arriva")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approva e invia" })).toHaveCount(0);
  await page.getByRole("button", { name: "Approva", exact: true }).click();
  await expect(page.getByText("Approvato, email non inviata")).toBeVisible();
  await page.getByRole("tab", { name: /Anomalie/ }).click();
  await expect(page.getByText("Manca l'email dell'atleta")).toBeVisible();
  // Prima cio' che e' gia' fallito (l'email non partita), poi cio' che va sistemato.
  const titles = await page.locator(".anomaly-title").allTextContents();
  expect(titles[0]).toContain("approvato ma non inviato");
  await page.getByRole("button", { name: "Aggiungila nel Profilo" }).click();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeInViewport();
});

test("con l'invio email disattivato un atleta senza indirizzo non è un'anomalia (D-05)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/anomalie`);
  await expect(page.getByRole("heading", { name: "Nessuna anomalia" })).toBeVisible();
});

test("il fuso orario si sceglie da un elenco; un valore salvato non valido è segnalato", async ({ page }) => {
  const state = createState();
  state.tables.app_settings[0].weekly_feedback_timezone = "Roma";
  await installMockBackend(page, state);
  await page.goto("./#/impostazioni");
  await expect(page.getByText(/Fuso non riconosciuto/)).toBeVisible();
  await page.getByLabel("Fuso orario").selectOption("Europe/Rome");
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  await expect(page.getByText("Impostazioni salvate.")).toBeVisible();
  expect(state.tables.app_settings[0].weekly_feedback_timezone).toBe("Europe/Rome");
});

test("una valutazione in preparazione si aggiorna senza ricaricare la pagina", async ({ page }) => {
  const state = createState();
  Object.assign(state.tables.weekly_reviews[0], { status: "pending", output_text: null, output: null });
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.getByText("In preparazione")).toBeVisible();
  Object.assign(state.tables.weekly_reviews[0], { status: "draft", output_text: "Testo pronto.", output: { summary: "Pronto.", limitations: [] } });
  await page.getByRole("button", { name: "Aggiorna ora" }).click();
  await expect(page.getByText("Da rivedere")).toBeVisible();
});

test("il sistema di zone dell'atleta limita l'editor e chiede conferma per approvare una seduta oltre", async ({ page }) => {
  const state = createState();
  profileOf(state).physiological_thresholds.cycling.zone_system = "3-zone";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  await page.getByRole("button", { name: /Apri VO2max/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(/Usa la zona Z5, oltre le 3 zone impostate per la bici/)).toBeVisible();
  // L'editor propone solo Z1-Z3, piu' la zona gia' presente segnalata.
  const zone = drawer.getByRole("combobox", { name: "Zona", exact: true }).first();
  await expect(zone.locator("option")).toHaveText(["Zona…", "Z1", "Z2", "Z3"]);
  await drawer.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Usa la zona Z5, oltre le 3 zone impostate per la bici. Approvarla comunque?");
});

test("una seduta già approvata ma da verificare si segna verificata dal pannello", async ({ page }) => {
  const state = createState();
  const tempo = state.tables.workouts.find((w) => w.title === "Tempo")!;
  // Avviso rimasto da un controllo precedente: ricalcolato al salvataggio, il vincolo non c'e' piu'.
  tempo.needs_review = "Il giovedì l'atleta ha al massimo 60 minuti: le sedute del giorno ne fanno 67.";
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano`);
  await page.getByRole("button", { name: "Settimana successiva" }).click();
  await page.getByRole("button", { name: /Apri Tempo/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Segna verificata" }).click();
  await expect(page.getByText("Seduta verificata.")).toBeVisible();
  expect(tempo.needs_review).toBeNull();
  expect(tempo.status).toBe("approved");
});

test("le intensità del feedback si impostano per sistema di zone; il nuoto mostra 7 zone fisse", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  await page.goto("./#/impostazioni");
  await page.getByText("Intensità bassa, media e alta per sistema di zone").click();
  const moderate3 = page.getByLabel("3 zone · media fino alla zona");
  await moderate3.fill("4");
  await expect(page.getByText("Valore tra 2 e 3.")).toBeVisible();
  await moderate3.fill("3");
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  await expect(page.getByText("Impostazioni salvate.")).toBeVisible();
  expect(state.tables.app_settings[0].feedback_params).toMatchObject({ z3_low_max: 1, z3_moderate_max: 3, z7_low_max: 2, z7_moderate_max: 4 });

  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await page.getByRole("button", { name: "Nuoto" }).click();
  const swim = page.getByRole("combobox", { name: "Sistema di zone" });
  await expect(swim).toBeDisabled();
  await expect(swim).toHaveValue("7 zone");
});
