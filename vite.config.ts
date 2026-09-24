import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev-server only: where `/api` is proxied. Production uses nginx (see nginx.conf).
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8090'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'favicon-16.png',
          'favicon-32.png',
          'favicon-48.png',
          'favicon-180.png',
        ],
        manifest: {
          name: 'WorkHub - Gestione Piazzale',
          short_name: 'WorkHub',
          description: 'Gestione in tempo reale dei container sui piazzali',
          lang: 'it',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'landscape',
          start_url: '/',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        },
        workbox: {
          // App shell only: never cache API calls or the runtime config
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          globIgnores: ['**/config.js'],
          navigateFallbackDenylist: [/^\/api\//, /^\/config\.js$/],
          runtimeCaching: [],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5173,
      host: true, // reachable from tablets on the LAN
      // Il repo vive su /mnt/c/... (drive Windows montato in WSL): inotify non vede i salvataggi
      // fatti dal lato Windows, quindi senza polling l'HMR resta silenzioso finche' non si riavvia
      // il dev server a mano.
      watch: { usePolling: true, interval: 300 },
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          // Il browser invia `Origin: http://localhost:5173` anche sulle richieste same-origin non-GET;
          // il backend la confronterebbe con il proprio host e rifiuterebbe la chiamata come CORS
          // ("Invalid CORS request"). Dietro il proxy la richiesta e' same-origin: togliamo l'header.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  }
})
