import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: the SPA runs on :5173 and proxies API calls to FastAPI on :8000.
// Production: FastAPI serves the built assets from frontend/dist.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
