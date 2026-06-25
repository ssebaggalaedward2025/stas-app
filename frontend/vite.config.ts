import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Smart Traffic Alert System',
        short_name: 'STAS',
        description:
          'Real-time traffic monitoring, congestion prediction, and route optimisation for Kampala.',
        theme_color: '#0D1626',
        background_color: '#0D1626',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['navigation', 'utilities', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png',          sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',          sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png',        sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png',        sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png',        sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png',        sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-384x384.png',        sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png',        sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'STAS Dashboard',
          },
        ],
      },
      workbox: {
        // No pre-caching to keep build memory low;
        // runtime caching handles map tiles.
        globPatterns: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
