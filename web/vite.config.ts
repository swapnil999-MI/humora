import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        // Override with VITE_API_PROXY_TARGET=http://localhost:8090 when the backend is elsewhere.
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8090',
        changeOrigin: true,
        // Pulse's realtime gateway is a WebSocket under /api.
        ws: true,
      },
    },
  },
})
