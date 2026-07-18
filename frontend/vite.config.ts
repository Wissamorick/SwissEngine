import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During dev, calls to /api/* are forwarded to the FastAPI backend.
// This keeps the frontend free of hard-coded backend URLs and avoids CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
