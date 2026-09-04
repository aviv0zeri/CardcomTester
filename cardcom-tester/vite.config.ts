import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    proxy: {
      '/payment': 'http://localhost:3000',
      '/lab': 'http://localhost:3000',
      '/templates': 'http://localhost:3000',
      '/cardcom-preview': 'http://localhost:3000',
      '/cardcom-production': 'http://localhost:3000',
      '/cardcom-hosted': 'http://localhost:3000',
      '/competition-template': 'http://localhost:3000',
      // Separate process, separate backend: spectra-payments (its own FastAPI
      // server, its own Postgres, its own Cardcom credentials) -- not proxied
      // through the Express raw-Cardcom lab above. The prefix is stripped so
      // spectraClient.ts can call spectra-payments' own paths (e.g. /health)
      // unchanged.
      '/spectra-api': {
        target: 'http://localhost:8099',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/spectra-api/, ''),
      },
    },
  },
})
