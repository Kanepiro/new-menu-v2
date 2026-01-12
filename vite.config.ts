import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '新メニュー表',
        short_name: '新メニュー',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eaffea',
        theme_color: '#0f5132',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: ({request}) => request.destination === 'document', handler: 'NetworkFirst' },
          { urlPattern: ({request}) => ['style','script','worker'].includes(request.destination), handler: 'StaleWhileRevalidate' },
          { urlPattern: ({request}) => request.destination === 'image', handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 60*60*24*30 } } }
        ]
      }
    })
  ]
})
