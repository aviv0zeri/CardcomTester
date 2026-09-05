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
      // spectra-payments is reached exactly as in production: through the
      // same-origin proxy (server/spectraProxy.js), which the Express dev
      // server mounts at /spectra-api/* and which adds the Bearer credential
      // server-side from server/.env (SPECTRA_PAYMENTS_API_URL / _TOKEN). The
      // browser never talks to payments.avivozeri.com or a bare :8099.
      '/spectra-api': 'http://localhost:3000',
    },
  },
})
