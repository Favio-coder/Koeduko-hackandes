import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const MATCHING_DEMO_HTML = '/src/features/matching/demo.html'
const MATCHING_DEMO_URL = '/demo/matching'

function rewriteMatchingDemoUrl(req) {
  if (req.url === MATCHING_DEMO_URL || req.url === `${MATCHING_DEMO_URL}/`) {
    req.url = MATCHING_DEMO_HTML
  }
}

/**
 * URL limpia para la demo de emparejamiento: /demo/matching en lugar de
 * /src/features/matching/demo.html. El archivo sigue dentro del módulo.
 * El hash (#/matching, #/matching/results) lo conserva el HashRouter.
 */
const matchingDemoUrl = {
  name: 'matching-demo-url',
  configureServer(server) {
    server.middlewares.use((req, res, next) => { rewriteMatchingDemoUrl(req); next() })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => { rewriteMatchingDemoUrl(req); next() })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), matchingDemoUrl],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        matchingDemo: fileURLToPath(new URL('./src/features/matching/demo.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
