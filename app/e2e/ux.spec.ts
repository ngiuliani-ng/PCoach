// Audit UI/UX completo di ottobre 2026 (docs/audit/2026-10-ux-ui-completo): comportamenti verificati
// dopo le correzioni.
import { expect, test } from "@playwright/test";
import { ATHLETE_ID, createState, installMockBackend } from "./mockBackend";
import { openSection } from "./helpers";

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
  await openSection(page, "Vincoli e disponibilità");
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

test("pagina «Da fare»: feedback e bozze di tutti gli atleti, con il numero in sidebar e i link al punto esatto (D-01, UX-10)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Da fare", level: 1 })).toBeVisible();
  const athlete = page.locator(".todo-athlete", { has: page.getByRole("heading", { name: "Giulia Ferri" }) });
  await expect(athlete).toContainText("Feedback della settimana del 5 ott da approvare");
  await expect(athlete).toContainText("Una seduta in bozza da approvare");
  // Un solo contatore globale, nessun numero accanto agli atleti; grigio: ci sono solo cose da approvare.
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await expect(page.getByRole("button", { name: /^Da fare, 2 in tutto, solo da approvare$/ })).toBeVisible();
  await expect(page.locator(".athlete-list .name .todo-count")).toHaveCount(0);
  if (await page.locator(".sidebar.open").count()) await page.keyboard.press("Escape");
  await athlete.getByRole("link", { name: "Apri il feedback" }).click();
  await expect(page).toHaveURL(/panoramica\?feedback=review-1/);
  // Con un feedback da approvare, il feedback viene prima del grafico del carico.
  const headings = await page.locator("#panel-panoramica h3").allTextContents();
  expect(headings[0]).toBe("Feedback settimanale");
  await expect(page.getByLabel("Testo per l'atleta (modificabile)")).toBeInViewport();
  await page.getByRole("button", { name: "Approva", exact: true }).click();
  await page.goBack();
  await expect(page.locator(".todo-athlete")).not.toContainText("Feedback della settimana del 5 ott da approvare");
});

test("la versione in fondo alla barra laterale porta a Informazioni, con build e server, senza novità (D-08)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("link", { name: /^Versione \d+\.\d+\.\d+, informazioni sull'app$/ }).click();
  const info = page.locator("#imp-info");
  await expect(info.getByRole("button", { name: /^Informazioni/ })).toHaveAttribute("aria-expanded", "true");
  await expect(info).toContainText("Versione");
  await expect(info).toContainText("Build");
  await expect(info.locator("dd").nth(2)).toHaveText(/^\d+\.\d+\.\d+$/);
  await expect(info).not.toContainText("Novità");
  await expect(info).not.toContainText("e2e-anon-key");
});

test("«Da fare» nella barra laterale riporta alla home; le sezioni del Profilo e delle Impostazioni partono tutte chiuse", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  const toggles = page.locator("#panel-profilo .section-toggle");
  await expect(toggles.first()).toBeVisible();
  for (const state of await toggles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-expanded")))) expect(state).toBe("false");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: /^Da fare/ }).click();
  await expect(page.getByRole("heading", { name: "Da fare", level: 1 })).toBeVisible();
  await page.goto("./#/impostazioni");
  for (const state of await page.locator(".section-toggle").evaluateAll((els) => els.map((e) => e.getAttribute("aria-expanded")))) expect(state).toBe("false");
});

test("il contatore «Da fare» diventa giallo con almeno un'anomalia, in qualunque atleta", async ({ page }) => {
  const state = createState();
  (state.tables.workouts[0] as Record<string, unknown>).needs_review = "Durata oltre il massimo del giorno.";
  await installMockBackend(page, state);
  await page.goto("./");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  const counter = page.locator(".todo-item .todo-count");
  await expect(counter).toHaveText("3");
  await expect(counter).toHaveClass(/has-anomaly/);
  await expect(page.getByRole("button", { name: /^Da fare, 3 in tutto, con anomalie da sistemare$/ })).toBeVisible();
});

test("il contatore «Da fare» è un quadrato della stessa misura, grigio o giallo", async ({ page }) => {
  async function counterBox(withAnomaly: boolean) {
    const state = createState();
    if (withAnomaly) (state.tables.workouts[0] as Record<string, unknown>).needs_review = "Durata oltre il massimo del giorno.";
    await installMockBackend(page, state);
    await page.goto("./");
    const menu = page.getByRole("button", { name: "Apri la barra laterale" });
    if (await menu.isVisible().catch(() => false)) await menu.click();
    const counter = page.locator(".todo-item .todo-count");
    await expect(counter).toHaveClass(withAnomaly ? /has-anomaly/ : /^todo-count$/);
    const box = (await counter.boundingBox())!;
    const radius = await counter.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    return { width: box.width, height: box.height, radius };
  }
  const grey = await counterBox(false);
  const yellow = await counterBox(true);
  expect(grey.width).toBe(grey.height);
  expect(yellow).toEqual(grey);
  expect(parseFloat(grey.radius)).toBeLessThan(grey.height / 3);
});

test("la home mostra l'esito dell'ultimo controllo su Intervals.icu: zone diverse, senza l'ora del controllo (ADR 0037)", async ({ page }) => {
  const state = createState();
  state.tables.athlete_checks = [{
    athlete_id: ATHLETE_ID, checked_at: "2026-10-10T07:50:00Z", key_status: "valid",
    zone_problems: ["Corsa (passo): 5 zone in PCoach, 7 su Intervals.icu"], threshold_problems: []
  }];
  await installMockBackend(page, state);
  await page.goto("./");
  const athlete = page.locator(".todo-athlete", { has: page.getByRole("heading", { name: "Giulia Ferri" }) });
  await expect(athlete).toContainText("Zone diverse da Intervals.icu");
  await expect(athlete).toContainText("Corsa (passo): 5 zone in PCoach, 7 su Intervals.icu");
  // Nessuna riga sull'ora del controllo: il coach vede solo cosa c'è da fare.
  await expect(page.locator(".todo-page")).not.toContainText("controllate su Intervals.icu");
  await athlete.getByRole("link", { name: "Sistemale nelle Anomalie" }).click();
  await expect(page.getByRole("tab", { name: /Anomalie/ })).toHaveAttribute("aria-selected", "true");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await expect(page.locator(".todo-item .todo-count")).toHaveClass(/has-anomaly/);
});

/** Selettori visibili il cui valore scelto non entra nel campo: testo + margini interni + freccia. */
async function clippedSelects(page: import("@playwright/test").Page, scope: string) {
  return page.locator(`${scope} select`).evaluateAll((selects) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return (selects as HTMLSelectElement[])
      .filter((s) => s.offsetParent !== null && s.selectedIndex >= 0)
      .flatMap((s) => {
        const cs = getComputedStyle(s);
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = s.options[s.selectedIndex].text;
        const need = ctx.measureText(text).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 20;
        return need > s.clientWidth ? [`${text} (${Math.round(need)} > ${s.clientWidth})`] : [];
      });
  });
}

test("rilevazioni delle soglie: nessun valore tagliato nei selettori, a 1440 e su telefono (UX-35)", async ({ page }, info) => {
  if (info.project.name === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
  const state = createState();
  const athlete = state.tables.athletes[0] as { data: { physiological_thresholds: { running: { thresholds_log: Record<string, unknown>[] } } } };
  athlete.data.physiological_thresholds.running.thresholds_log = [
    { date: "2026-09-01", source: "intervals_icu_sync", threshold_pace_per_km: "4:46", test_type: "campo_time_trial" },
    { date: "2026-08-01", source: "manual", test_type: "nessun_test" }
  ];
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
  await openSection(page, "Soglie e zone");
  await expect(page.locator("#sec-soglie select").first()).toBeVisible();
  expect(await clippedSelects(page, "#sec-soglie")).toEqual([]);
});

test("intestazione della scheda: su telefono solo il prossimo evento e le tab in alto; la nuvola del salvataggio sempre, in ogni tab e stato (UX-05)", async ({ page }, info) => {
  const state = createState();
  const profile = (state.tables.athletes[0] as { data: { goals: Record<string, unknown> } }).data;
  profile.goals.target_events = [{ name: "Mezza di Bergamo", date: "2026-11-15", discipline: "running", distance_or_duration: "21 km", priority: "A", target_result: "" }];
  await installMockBackend(page, state);
  if (info.project.name === "mobile") await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  const sub = page.locator(".page-sub");
  await expect(sub).toContainText("Prossimo evento: Mezza di Bergamo, 15 nov 2026");
  await expect(page.getByText(/^Aggiornata il/)).toHaveCount(0);
  const status = page.locator(".page-header .save-status");
  // Salvata: nuvola con la spunta in ogni tab, testo intero (su telefono «1 set», il resto per i lettori di schermo).
  for (const tab of ["Panoramica", "Piano", "Profilo", "Anomalie"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await expect(status.locator(".save-icon")).toBeVisible();
    await expect(status).toHaveClass(/saved/);
    await expect(status).toContainText("Scheda salvata il 1 set 2026");
  }
  // Modifiche non salvate: la nuvola resta, con l'avviso.
  await page.getByRole("tab", { name: "Profilo" }).click();
  await openSection(page, "Vincoli e disponibilità");
  await page.getByLabel("Sessioni a settimana (obiettivo)").fill("4");
  await expect(status).toHaveClass(/unsaved/);
  await expect(status.locator(".save-icon")).toBeVisible();
  await expect(status).toContainText("Modifiche non salvate");
  if (info.project.name === "mobile") {
    await expect(status.locator(".save-long")).not.toBeInViewport();
    await page.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(status.locator(".save-short")).toBeVisible();
    await expect(sub.getByText("Corsa, Bici")).toBeHidden();
    const tabs = (await page.getByRole("tablist", { name: "Sezioni della scheda" }).boundingBox())!;
    expect(tabs.y).toBeLessThanOrEqual(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } else {
    await expect(sub.getByText("Corsa, Bici")).toBeVisible();
  }
});

test("una bozza mai salvata mostra la nuvola barrata", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./#/atleta/nuovo");
  const status = page.locator(".page-header .save-status");
  await expect(status.locator(".save-icon")).toBeVisible();
  await expect(status).toHaveClass(/draft/);
  await expect(status).toContainText("Bozza non ancora salvata");
  await openSection(page, "Identità");
  await page.getByLabel("Nome", { exact: true }).fill("Luca");
  await expect(status).toHaveClass(/unsaved/);
  await expect(status.locator(".save-icon")).toBeVisible();
});

test("editor della struttura: etichette visibili dei campi e intervallo di zone solo su richiesta (UX-25)", async ({ page }, info) => {
  const state = createState();
  const run = state.tables.workouts.find((w) => w.title === "Corsa rigenerativa") as Record<string, unknown>;
  run.structure = { version: 2, steps: [
    { kind: "step", role: "warmup", duration: { type: "time", seconds: 600 }, target: { zone: 1 } },
    { kind: "step", role: "steady", duration: { type: "time", seconds: 1200 }, target: { zone: 2, zone_to: 3 } }
  ] };
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano?seduta=${run.id}`);
  const drawer = page.getByRole("dialog");
  const rows = drawer.locator(".step-row");
  await expect(rows).toHaveCount(2);
  // Etichette sul primo step; sugli altri solo su telefono.
  for (const label of ["Tipo", "Durata", "Zona", "Indicazione"]) await expect(rows.nth(0).locator(".step-label", { hasText: label })).toBeVisible();
  if (info.project.name === "mobile") await expect(rows.nth(1).locator(".step-label", { hasText: "Tipo" })).toBeVisible();
  else await expect(rows.nth(1).locator(".step-label", { hasText: "Tipo" })).toBeHidden();
  // L'intervallo si vede solo dove c'e': «Z2 fino a Z3».
  await expect(rows.nth(0).getByRole("combobox", { name: "Fino alla zona" })).toHaveCount(0);
  await expect(rows.nth(1).getByRole("combobox", { name: "Fino alla zona" })).toHaveValue("3");
  await expect(rows.nth(1)).toContainText("fino a");
  // «Intervallo» aggiunge il limite superiore alla zona successiva; «nessun intervallo» lo toglie.
  await rows.nth(0).getByRole("button", { name: /^Intervallo di zone/ }).click();
  const to = rows.nth(0).getByRole("combobox", { name: "Fino alla zona" });
  await expect(to).toHaveValue("2");
  await to.selectOption({ label: "nessun intervallo" });
  await expect(rows.nth(0).getByRole("combobox", { name: "Fino alla zona" })).toHaveCount(0);
  await expect(rows.nth(0).getByRole("button", { name: /^Intervallo di zone/ })).toBeVisible();
});
