import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: { cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'TripIsland',
        short_name: 'TripIsland',
        description: 'Vos voyages à deux',
        theme_color: '#F4F3EF',
        background_color: '#F4F3EF',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }
    })
  ]
});
