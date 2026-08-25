import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/payment': 'http://localhost:3000',
      '/templates': 'http://localhost:3000',
      '/cardcom-preview': 'http://localhost:3000',
      '/cardcom-production': 'http://localhost:3000',
      '/cardcom-hosted': 'http://localhost:3000',
    },
  },
})
