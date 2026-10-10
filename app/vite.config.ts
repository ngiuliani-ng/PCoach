/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/PCoach/',
  // Moduli puri condivisi con le Edge Function (supabase/functions/_shared): stesso codice
  // per l'anteprima nell'app e per l'invio a Intervals.icu.
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../supabase/functions/_shared', import.meta.url)) },
  },
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../supabase/functions/_shared'] },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    vue(),
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
        orientation: 'portrait',
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
