import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the dev server is reachable on the LAN
    host: '0.0.0.0',
  },
  preview: {
    // Also expose the preview server on the LAN
    host: '0.0.0.0',
  },
})
