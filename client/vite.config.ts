import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': apiProxyTarget,
      '/builds': apiProxyTarget,
      '/download': apiProxyTarget,
      '/generate': apiProxyTarget,
      '/health': apiProxyTarget,
    },
  },
})
