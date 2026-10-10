// Test end-to-end (Playwright): l'app gira con Vite e un backend finto in memoria
// (e2e/mockBackend.ts) che intercetta Supabase, Edge Function comprese. Nessuna chiamata
// reale a Supabase, Claude o Intervals.icu.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5181;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/PCoach/`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/PCoach/`,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "http://e2e.supabase.test", VITE_SUPABASE_ANON_KEY: "e2e-anon-key" }
  }
});
