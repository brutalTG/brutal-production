import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // In dev mode, proxy /api and other server routes to the Hono server
  server: {
    proxy: {
      '/health': 'http://localhost:3000',
      '/gate': 'http://localhost:3000',
      '/active-drop': 'http://localhost:3000',
      '/drop': 'http://localhost:3000',
      '/sessions': 'http://localhost:3000',
      '/responses': 'http://localhost:3000',
      '/apply': 'http://localhost:3000',
      '/link-channel': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/leaderboard': 'http://localhost:3000',
      '/season': 'http://localhost:3000',
      '/claim-rewards': 'http://localhost:3000',
      '/claims': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/compass-config': 'http://localhost:3000',
      '/brand-config': 'http://localhost:3000',
      '/panel-auth': 'http://localhost:3000',
      '/bot': 'http://localhost:3000',
      '/node-status': 'http://localhost:3000',
      '/analysis': 'http://localhost:3000',
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
