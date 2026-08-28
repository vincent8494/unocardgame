import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',       // the server serves client/build in production
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 3000,
    proxy: {               // dev client talks to the local server, not production
      '/socket.io': { target: 'http://localhost:5000', ws: true },
      '/healthz': 'http://localhost:5000'
    }
  }
})
