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
        includeAssets: ['icon.svg'],
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
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
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
