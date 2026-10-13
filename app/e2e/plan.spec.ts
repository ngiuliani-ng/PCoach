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
  await expect(drawer.getByText("Bozza", { exact: true })).toBeVisible();
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

test("zone o soglie non allineate: «Sincronizza settimana» blocca creazioni e aggiornamenti, non le rimozioni", async ({ page }) => {
  const state = createState();
  state.previewBlocked = "Non si invia finché zone e soglie non sono allineate con Intervals.icu: soglie diverse (Corsa, passo di soglia: 4:00/km in PCoach, 4:10/km su Intervals.icu). Sistemale dalla tab Anomalie.";
  await openPlan(page, state);
  await page.getByRole("button", { name: "Sincronizza settimana" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Bloccate, da correggere" })).toBeVisible();
  await expect(dialog.getByText(/Non si invia finché zone e soglie non sono allineate/).first()).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Da creare" })).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Da aggiornare" })).toHaveCount(0);
  await dialog.getByRole("button", { name: /Sincronizza 1 seduta/ }).click();
  await expect(dialog.getByText(/Tutte le|riuscita/).first()).toBeVisible();
  expect(state.applyCalls.map((c) => c.op)).toEqual(["delete"]);
});

// ---------- Audit A-01: dialoghi di generazione aperti prima che le sedute siano caricate ----------
// Lo stato nell'URL riapre il dialogo dopo un ricaricamento (ADR 0023): i valori iniziali devono essere
// gli stessi dell'apertura dal pulsante, e niente si genera o si applica su sedute non lette.

/** Trattiene le letture della tabella workouts finché il test non chiama il rilascio. */
async function holdWorkouts(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("http://e2e.supabase.test/rest/v1/workouts?**", async (route) => {
    if (route.request().method() === "GET") await gate;
    await route.fallback();
  });
  return release;
}

test("Prosegui il piano: stessa partenza dal pulsante e dopo un ricaricamento (A-01)", async ({ page }) => {
  await openPlan(page, createState());
  await page.getByRole("button", { name: "Prosegui il piano" }).click();
  const dialog = page.getByRole("dialog");
  // Il piano attivo finisce l'8 novembre: si prosegue dal 9, senza toccare sedute esistenti.
  await expect(dialog.getByLabel("Primo giorno")).toHaveValue("2026-11-09");
  await expect(dialog.locator(".keep-list label")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("dialog").getByLabel("Primo giorno")).toHaveValue("2026-11-09");
  await expect(page.getByRole("dialog").locator(".keep-list label")).toHaveCount(0);
});

test("Ripianifica: la seduta bloccata resta da mantenere anche dopo un ricaricamento (A-01)", async ({ page }) => {
  const state = createState();
  state.tables.workouts.find((w) => w.title === "Tempo")!.locked = true;
  await openPlan(page, state);
  await page.getByRole("button", { name: /Ripianifica da/ }).click();
  const locked = () => page.getByRole("dialog").locator(".keep-list label", { hasText: "Tempo" }).getByRole("checkbox");
  await expect(locked()).toBeChecked();

  await page.reload();
  await expect(locked()).toBeChecked();
});

test("dialogo aperto dall'URL: niente parametri né generazione finché le sedute non sono caricate (A-01)", async ({ page }) => {
  await installMockBackend(page, createState());
  const release = await holdWorkouts(page);
  await page.goto("./#/atleta/ATL00001/piano?dialogo=prosegui");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Carico le sedute dell'atleta…")).toBeVisible();
  await expect(dialog.getByLabel("Primo giorno")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeDisabled();

  release();
  await expect(dialog.getByLabel("Primo giorno")).toHaveValue("2026-11-09");
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeEnabled();
});

test("sedute non lette: errore, generazione bloccata e «Riprova» (A-01)", async ({ page }) => {
  await installMockBackend(page, createState());
  let fail = true;
  await page.route("http://e2e.supabase.test/rest/v1/workouts?**", async (route) => {
    if (fail && route.request().method() === "GET" && route.request().url().includes("athlete_id=eq.")) {
      return route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ message: "errore" }) });
    }
    await route.fallback();
  });
  await page.goto("./#/atleta/ATL00001/piano?dialogo=prosegui");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("Non riesco a leggere le sedute");
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeDisabled();

  fail = false;
  await dialog.getByRole("button", { name: "Riprova" }).click();
  await expect(dialog.getByLabel("Primo giorno")).toHaveValue("2026-11-09");
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeEnabled();
});

test("proposta in sospeso ripresa dopo un ricaricamento: confronto e applicazione solo a sedute caricate (A-01)", async ({ page }) => {
  const state = createState();
  const tempo = state.tables.workouts.find((w) => w.title === "Tempo")!;
  tempo.locked = true;
  state.tables.plan_generations.push({
    id: "gen-pending", athlete_id: "ATL00001", kind: "regenerate", from_date: "2026-10-14", weeks: 1, reason: "", status: "proposed",
    kept_workout_ids: [tempo.id], created_at: "2026-10-10T08:00:00Z",
    proposal: {
      plan_name: "Ripresa", weeks: [{ week_start: "2026-10-12", label: "Ripresa", is_deload: false }],
      workouts: [{ date: "2026-10-17", discipline: "running", title: "Corsa facile", steps: [{ kind: "step", role: "steady", duration_sec: 2400, zone: "Z2" }] }]
    }
  });
  await installMockBackend(page, state);
  const release = await holdWorkouts(page);
  await page.goto("./#/atleta/ATL00001/piano?dialogo=ripianifica");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Carico le sedute dell'atleta…")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Applica la nuova programmazione" })).toHaveCount(0);

  release();
  // La seduta bloccata e scelta nella proposta resta: nell'anteprima è «Mantenuta».
  await expect(dialog.locator(".diff-item", { hasText: "Tempo" })).toContainText("Mantenuta");
  await expect(dialog.getByRole("button", { name: "Applica la nuova programmazione" })).toBeEnabled();
});

// ---------- Audit A-07 e A-27: proposta che si perde, settimane fuori dai limiti ----------

test("«Modifica i parametri» chiede conferma prima di scartare la proposta di Claude (A-07, D-01)", async ({ page }) => {
  const state = createState();
  state.claudeResponse = {
    plan_name: "Prosecuzione", weeks: [{ week_start: "2026-11-09", label: "Carico", is_deload: false }],
    workouts: [{ date: "2026-11-10", discipline: "running", title: "Corsa facile", steps: [{ kind: "step", role: "steady", duration_sec: 2400, zone: "Z2" }] }]
  };
  await openPlan(page, state);
  await page.getByRole("button", { name: "Prosegui il piano" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Settimane da generare").fill("1");
  await dialog.getByRole("button", { name: "Genera la proposta" }).click();
  await expect(dialog.getByRole("button", { name: "Applica la nuova programmazione" })).toBeVisible();

  await dialog.getByRole("button", { name: "Modifica i parametri" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("perdi la proposta di Claude");
  await confirm.getByRole("button", { name: "Tieni la proposta" }).click();
  await expect(dialog.getByRole("button", { name: "Applica la nuova programmazione" })).toBeVisible();
  expect(state.tables.plan_generations[0].status).toBe("proposed");

  await dialog.getByRole("button", { name: "Modifica i parametri" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Scarta la proposta e modifica i parametri" }).click();
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeVisible();
  expect(state.tables.plan_generations[0].status).toBe("discarded");
});

test("settimane da generare oltre il massimo: errore sul campo e generazione disattivata (A-27)", async ({ page }) => {
  await openPlan(page, createState());
  await page.getByRole("button", { name: "Prosegui il piano" }).click();
  const dialog = page.getByRole("dialog");
  const weeks = dialog.getByLabel("Settimane da generare");
  await weeks.fill("9");
  await expect(weeks).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("Scegli da 1 a 4 settimane.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeDisabled();
  await weeks.fill("2");
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeEnabled();
});

test("«Indietro» dal passo manuale: conferma solo con una risposta incollata, e la si può tenere (A-07)", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  // Senza chiave di Claude la generazione passa dal prompt copiato e dalla risposta incollata.
  await page.route("http://e2e.supabase.test/rest/v1/rpc/claude_key_configured", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "false" }));
  await page.goto("./#/atleta/ATL00001/piano?dialogo=prosegui");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Settimane da generare").fill("1");
  await dialog.getByRole("button", { name: "Genera la proposta" }).click();
  await expect(dialog.getByLabel("Risposta di Claude")).toBeVisible();

  // Niente da perdere: nessuna conferma.
  await dialog.getByRole("button", { name: "Indietro" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeVisible();

  await dialog.getByRole("button", { name: "Genera la proposta" }).click();
  await dialog.getByLabel("Risposta di Claude").fill("{ \"plan_name\": \"x\" }");
  await dialog.getByRole("button", { name: "Indietro" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("perdi la risposta incollata");
  await confirm.getByRole("button", { name: "Tieni la risposta" }).click();
  await expect(dialog.getByLabel("Risposta di Claude")).toHaveValue("{ \"plan_name\": \"x\" }");

  await dialog.getByRole("button", { name: "Indietro" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Scarta la risposta e modifica i parametri" }).click();
  await expect(dialog.getByRole("button", { name: "Genera la proposta" })).toBeVisible();
});
