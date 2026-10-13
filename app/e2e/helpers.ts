// Aiuti comuni dei test end-to-end.
import type { Page } from "@playwright/test";

/** Apre una sezione comprimibile (Profilo, Impostazioni) se e' chiusa: il pulsante inizia con il titolo. */
export async function openSection(page: Page, title: string) {
  const toggle = page.locator(".section-toggle", { has: page.locator(".section-name", { hasText: new RegExp(`^${title}$`) }) });
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
}
