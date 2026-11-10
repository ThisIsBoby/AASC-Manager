import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// base relative : fonctionne quel que soit le nom du dépôt GitHub Pages (routes en HashRouter)
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-aasc.png'],
      manifest: {
        name: 'AASC Manager',
        short_name: 'AASC',
        description: 'Gestion du club AASC Cléry St-André Badminton',
        theme_color: '#0B0F1A',
        background_color: '#0B0F1A',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
} as any)
