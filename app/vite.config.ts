import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/PCoach/',
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
        short_name: '',
        description: 'Strumento di lavoro per il coach: schede atleti, piani di allenamento e feedback settimanali.',
        theme_color: '#1C2025',
        background_color: '#1C2025',
        display: 'standalone',
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
