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
  const headings = await page.locator("#panel-panoramica h2").allTextContents();
  expect(headings[0]).toBe("Feedback settimanale");
  await expect(page.getByLabel("Testo per l'atleta (modificabile)")).toBeInViewport();
  await page.getByRole("button", { name: "Approva", exact: true }).click();
  await page.goBack();
  await expect(page.locator(".todo-athlete")).not.toContainText("Feedback della settimana del 5 ott da approvare");
});

test("la versione non è nella barra laterale: sta in Impostazioni › Informazioni, con build e server, senza novità", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./");
  const menu = page.getByRole("button", { name: "Apri la barra laterale" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await expect(page.locator(".sidebar")).not.toContainText("Versione");
  await page.getByRole("button", { name: "Impostazioni" }).click();
  await openSection(page, "Informazioni");
  const info = page.locator("#imp-info");
  await expect(info.getByRole("button", { name: /^Informazioni/ })).toHaveAttribute("aria-expanded", "true");
  await expect(info).toContainText("Versione");
  await expect(info).toContainText("Build");
  await expect(info.locator("dd").nth(2)).toHaveText(/^\d+\.\d+\.\d+$/);
  await expect(info).not.toContainText("Novità");
  // Niente «Copia per una segnalazione» (decisione del coach del 13 ottobre 2026).
  await expect(info.getByRole("button", { name: "Copia per una segnalazione" })).toHaveCount(0);
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
    // Misura del layout, non del riquadro a schermo: su telefono la barra laterale entra con una
    // transizione e durante lo scorrimento la larghezza a schermo ha decimali.
    return counter.evaluate((el) => ({
      width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight, radius: getComputedStyle(el).borderTopLeftRadius
    }));
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
  // Salvata: nuvola con la spunta in ogni tab, senza testo visibile (la frase e' per i lettori di schermo).
  for (const tab of ["Panoramica", "Piano", "Profilo", "Anomalie"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await expect(status.locator(".save-icon")).toBeVisible();
    await expect(status).toHaveClass(/\bsaved\b/);
    await expect(status).toContainText("Scheda salvata");
  }
  // Modifiche non salvate: la nuvola resta, con l'avviso.
  await page.getByRole("tab", { name: "Profilo" }).click();
  await openSection(page, "Vincoli e disponibilità");
  await page.getByLabel("Sessioni a settimana (obiettivo)").fill("4");
  await expect(status).toHaveClass(/unsaved/);
  await expect(status.locator(".save-icon")).toBeVisible();
  await expect(status).toContainText("Modifiche non salvate");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(status).toHaveClass(/\bsaved\b/);
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

test("Impostazioni: solo la nuvola del salvataggio, colorata per stato, salvata o con modifiche", async ({ page }, info) => {
  await installMockBackend(page, createState());
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("./#/impostazioni");
  const status = page.locator(".page-header .save-status");
  await expect(status.locator(".save-icon")).toBeVisible();
  await expect(status).toHaveClass(/\bsaved\b/);
  await expect(status).toContainText("Impostazioni salvate");
  // Solo la nuvola: nessun testo visibile, il colore cambia con lo stato.
  expect((await status.boundingBox())!.width).toBeLessThanOrEqual(24);
  const colour = () => status.evaluate((el) => getComputedStyle(el).color);
  const savedColour = await colour();
  await openSection(page, "Feedback settimanale");
  await page.getByLabel("Tono del feedback").fill("Tono asciutto.");
  await expect(status).toHaveClass(/unsaved/);
  await expect(status.locator(".save-icon")).toBeVisible();
  expect(await colour()).not.toBe(savedColour);
  await expect(status).toContainText("Modifiche non salvate");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("toast informativo: resta con il puntatore o il focus sopra e si chiude anche da tastiera (A-08, D-02)", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto(`./#/atleta/${ATHLETE_ID}/piano?settimana=2026-10-12`);
  const toast = page.locator(".toast");
  await page.locator(".w-row", { hasText: "VO2max" }).getByRole("button", { name: "Approva" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Seduta approvata." })).toBeVisible();

  // Con il puntatore sopra il toast non sparisce, oltre la sua durata (4 s + 60 ms per carattere).
  await toast.hover();
  await page.waitForTimeout(6500);
  await expect(toast).toHaveClass(/show/);
  // Tolto il puntatore riparte il tempo che restava (almeno 2 s), poi sparisce.
  await page.mouse.move(5, 5);
  await expect(toast).toHaveClass(/show/);
  await expect(toast).not.toHaveClass(/show/, { timeout: 7000 });

  // Il pulsante di chiusura c'e' anche per i messaggi informativi; con il focus sopra il toast resta.
  await page.getByRole("button", { name: /Apri Corsa rigenerativa/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Obiettivo della seduta").fill("Recupero attivo");
  await drawer.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modifiche salvate" })).toBeVisible();
  const close = toast.getByRole("button", { name: "Chiudi messaggio" });
  await close.focus();
  await page.waitForTimeout(7000);
  await expect(toast).toHaveClass(/show/);
  await page.keyboard.press("Enter");
  await expect(toast).not.toHaveClass(/show/);
});

test("il focus da tastiera non finisce sotto l'intestazione fissa (A-03, WCAG 2.4.11)", async ({ page }) => {
  await installMockBackend(page, createState());
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 640, height: 400 }]) {
    await page.setViewportSize(size);
    await page.goto(`./#/atleta/${ATHLETE_ID}/profilo`);
    await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>(".section-toggle[aria-expanded=false]").forEach((b) => b.click()));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.locator("textarea[aria-label='Note libere']").focus();
    const covered: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Shift+Tab");
      const hit = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const header = document.querySelector(".page-header");
        if (!el || !header || el.closest(".page-header") || el.closest("#athlete-sidebar")) return null;
        const r = el.getBoundingClientRect();
        return r.top < header.getBoundingClientRect().bottom - 1 ? `${el.tagName} ${Math.round(r.top)}` : null;
      });
      if (hit) covered.push(hit);
    }
    expect(covered, `${size.width}×${size.height}`).toEqual([]);
  }
});

test("segnaposto «predefinito: N» leggibile e controlli nativi nel tema della pagina (A-05)", async ({ browser }) => {
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme, baseURL: "http://localhost:5181/PCoach/", locale: "it-IT" });
    const page = await context.newPage();
    await installMockBackend(page, createState());
    await page.goto(`./#/atleta/${ATHLETE_ID}/profilo?sezione=sec-metodologia`);
    const input = page.locator("input[placeholder^='predefinito']").first();
    await expect(input).toBeVisible();
    const r = await input.evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ph = getComputedStyle(el, "::placeholder");
      const fg = rgb(ph.color), bg = rgb(getComputedStyle(el).backgroundColor);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return { ratio: (a + 0.05) / (b + 0.05), opacity: ph.opacity, scheme: getComputedStyle(document.documentElement).colorScheme };
    });
    expect(r.ratio, `segnaposto, tema ${scheme}`).toBeGreaterThanOrEqual(4.5);
    expect(r.opacity).toBe("1");
    expect(r.scheme).toBe(scheme);
    await context.close();
  }
});

/** Salti di livello fra titoli visibili consecutivi (h1 → h3, h2 → h4…). */
async function headingSkips(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1, h2, h3, h4, h5")]
      .filter((h) => (h as HTMLElement).offsetParent !== null || getComputedStyle(h).position === "fixed")
      .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").trim().slice(0, 30) }));
    return levels.flatMap((h, i) => (i && h.level > levels[i - 1].level + 1 ? [`h${levels[i - 1].level} → h${h.level} «${h.text}»`] : []));
  });
}

test("titoli senza salti di livello e titolo della pagina che dice dove si è (A-10, A-11)", async ({ page }) => {
  const state = createState();
  await installMockBackend(page, state);
  const seduta = String(state.tables.workouts.find((w) => w.title === "VO2max 5 × 4'")!.id);
  const pages: [string, string, (() => Promise<void>)?][] = [
    ["./#/", "Da fare – PCoach"],
    ["./#/impostazioni", "Impostazioni – PCoach", async () => { await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>(".section-toggle[aria-expanded=false]").forEach((b) => b.click())); }],
    [`./#/atleta/${ATHLETE_ID}/panoramica`, "Panoramica – Giulia Ferri – PCoach"],
    [`./#/atleta/${ATHLETE_ID}/piano?settimana=2026-10-12`, "Piano – Giulia Ferri – PCoach", async () => { await page.getByRole("button", { name: "Storico" }).click(); }],
    [`./#/atleta/${ATHLETE_ID}/profilo`, "Profilo – Giulia Ferri – PCoach", async () => { await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>(".section-toggle[aria-expanded=false]").forEach((b) => b.click())); }],
    [`./#/atleta/${ATHLETE_ID}/anomalie`, "Anomalie – Giulia Ferri – PCoach"],
    [`./#/atleta/${ATHLETE_ID}/piano?seduta=${seduta}`, "Piano – Giulia Ferri – PCoach"],
    [`./#/atleta/${ATHLETE_ID}/piano?dialogo=ripianifica`, "Piano – Giulia Ferri – PCoach"],
    [`./#/atleta/${ATHLETE_ID}/piano?settimana=2026-10-12&dialogo=sincronizza`, "Piano – Giulia Ferri – PCoach"],
    ["./#/atleta/nuovo", "Nuovo atleta – PCoach"]
  ];
  for (const [url, title, prep] of pages) {
    await page.goto(url);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(400);
    if (prep) { await prep(); await page.waitForTimeout(200); }
    expect(await headingSkips(page), url).toEqual([]);
    await expect(page, url).toHaveTitle(title);
  }
});

test("grafico del carico: nessuna tabella dei valori sotto la legenda (decisione del coach)", async ({ page }) => {
  const state = createState();
  (state.tables.athletes[0].data as { training_status: { load_metrics_log: unknown[] } }).training_status.load_metrics_log = [
    { date: "2026-10-09", ctl: 41, atl: 43, tsb: -2, workouts_count: 0 },
    { date: "2026-10-10", ctl: 42, atl: 40, tsb: 2, workouts_count: 1 }
  ];
  await installMockBackend(page, state);
  await page.goto(`./#/atleta/${ATHLETE_ID}/panoramica`);
  await expect(page.locator(".load-chart")).toBeVisible();
  await expect(page.locator(".chart-legend")).toBeVisible();
  await expect(page.getByText("Valori giorno per giorno")).toHaveCount(0);
  await expect(page.locator(".chart-wrap table")).toHaveCount(0);
});
