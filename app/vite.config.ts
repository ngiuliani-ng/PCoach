/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Versione dell'app (ADR 0036): una sola fonte, package.json. Commit e data vengono dalla build:
// in CI da GITHUB_SHA, in locale da git (con «-modificato» se ci sono modifiche non committate).
const APP_VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    let dirty = false
    try {
      execSync('git diff --quiet HEAD', { stdio: 'ignore' })
    } catch {
      dirty = true
    }
    return dirty ? `${sha}-modificato` : sha
  } catch {
    return 'locale'
  }
}
const APP_COMMIT = buildCommit()
const APP_BUILD_DATE = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT),
    __APP_BUILD_DATE__: JSON.stringify(APP_BUILD_DATE),
  },
  base: '/PCoach/',
  // Moduli puri condivisi con le Edge Function (supabase/functions/_shared): stesso codice
  // per l'anteprima nell'app e per l'invio a Intervals.icu.
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../supabase/functions/_shared', import.meta.url)) },
  },
  server: {
    // Il CHANGELOG alla radice serve al test di coerenza della versione (version.test.ts).
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../supabase/functions/_shared', '../CHANGELOG.md'] },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    vue(),
    // version.json accanto all'app pubblicata: dopo il deploy si controlla che sia in linea la versione del tag.
    {
      name: 'pcoach-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION, commit: APP_COMMIT, builtAt: APP_BUILD_DATE }) })
      },
    },
    VitePWA({
      // Nessun Service Worker attivo: l'app è solo installabile (manifest + icone).
      // Per aggiungere offline support in futuro, rimuovere selfDestroying e configurare workbox.
      selfDestroying: true,
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'PCoach',
        short_name: 'PCoach',
        description: 'Strumento di lavoro per il coach: schede atleti, piani di allenamento e feedback settimanali.',
        theme_color: '#1C2025',
        background_color: '#1C2025',
        display: 'standalone',
        // Desktop Chromium (Edge/Chrome): barra del titolo disegnata dall'app, senza nome/icona di sistema.
        // `standalone` resta il fallback per i browser che non supportano la modalità.
        display_override: ['window-controls-overlay'],
        // Nessun blocco dell'orientamento: su telefono e tablet l'app ruota (decisione del coach D-UX-6).
        start_url: '/PCoach/',
        scope: '/PCoach/',
        lang: 'it',
        icons: [
          {
            src: '/PCoach/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/PCoach/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/PCoach/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
