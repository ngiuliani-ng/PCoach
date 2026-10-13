// Controllo automatico di accessibilità con axe-core (decisione D-03): regole WCAG 2.0, 2.1 e 2.2 di
// livello A e AA sulle schermate principali, nei due temi. Non è una prova di conformità WCAG: axe trova
// una parte dei problemi (nomi, ruoli, contrasti calcolabili, struttura); tastiera, focus, lettori di
// schermo e comprensibilità restano verifiche manuali (docs/audit/2026-10-ux-ui-1-2-0).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ATHLETE_ID, createState, installMockBackend, type MockState } from "./mockBackend";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Screen = { name: string; url: (s: MockState) => string; prep?: (page: Page) => Promise<void>; state?: (s: MockState) => void; noSession?: boolean };

const openAllSections = async (page: Page) => {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLButtonElement>(".section-toggle[aria-expanded=false]").forEach((b) => b.click());
    document.querySelectorAll("details").forEach((d) => (d.open = true));
  });
};
const A = `./#/atleta/${ATHLETE_ID}`;
const idOf = (s: MockState, title: string) => String(s.tables.workouts.find((w) => w.title === title)!.id);

const SCREENS: Screen[] = [
  { name: "Da fare", url: () => "./#/" },
  { name: "Impostazioni, tutto aperto", url: () => "./#/impostazioni", prep: openAllSections },
  { name: "Nuovo atleta", url: () => "./#/atleta/nuovo", prep: openAllSections },
  { name: "Panoramica con feedback da approvare", url: () => `${A}/panoramica`, prep: openAllSections },
  { name: "Piano, settimana con sedute", url: () => `${A}/piano?settimana=2026-10-12` },
  { name: "Piano, storico", url: () => `${A}/piano?settimana=2026-10-12`, prep: async (p) => { await p.getByRole("button", { name: "Storico" }).click(); } },
  { name: "Profilo, tutto aperto", url: () => `${A}/profilo`, prep: openAllSections },
  {
    name: "Anomalie", url: () => `${A}/anomalie`,
    state: (s) => { (s.tables.athletes[0].data as { physiological_thresholds: { running: { zone_system: string } } }).physiological_thresholds.running.zone_system = "5-zone"; }
  },
  { name: "Pannello della seduta", url: (s) => `${A}/piano?seduta=${idOf(s, "VO2max 5 × 4'")}` },
  { name: "Ripianifica", url: () => `${A}/piano?dialogo=ripianifica` },
  { name: "Sincronizza settimana", url: () => `${A}/piano?settimana=2026-10-12&dialogo=sincronizza` },
  { name: "Guida", url: () => `${A}/profilo?guida=profilo-soglie` },
  { name: "Conferma di eliminazione", url: () => `${A}/profilo?sezione=sec-gestione`, prep: async (p) => { await p.getByRole("button", { name: "Elimina scheda" }).click(); } },
  { name: "Accesso", url: () => "./", noSession: true }
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, tema ${scheme === "light" ? "chiaro" : "scuro"}`, () => {
    test.use({ colorScheme: scheme });
    for (const screen of SCREENS) {
      test(screen.name, async ({ page }) => {
        const state = createState();
        screen.state?.(state);
        await installMockBackend(page, state);
        if (screen.noSession) await page.addInitScript(() => localStorage.clear());
        await page.goto(screen.url(state));
        await expect(page.locator("h1").first()).toBeVisible();
        await page.waitForTimeout(400);
        if (screen.prep) { await screen.prep(page); await page.waitForTimeout(300); }
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        const found = results.violations.map((v) => ({
          rule: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(1, 3).join(" ")}`)
        }));
        expect(found, JSON.stringify(found, null, 1)).toEqual([]);
      });
    }
  });
}

// Sensibilità: se axe non girasse (configurazione, versione), tutte le schermate risulterebbero «pulite».
test("axe è attivo: un pulsante senza nome viene segnalato", async ({ page }) => {
  await installMockBackend(page, createState());
  await page.goto("./#/");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.evaluate(() => document.querySelector("main")!.appendChild(document.createElement("button")));
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toContain("button-name");
});
