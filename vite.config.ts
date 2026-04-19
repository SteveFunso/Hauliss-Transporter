import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/users': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/drivers': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/bookings': {
        target: 'http://localhost:3006',
        changeOrigin: true,
      },
      '/api/admin/routes': {
        target: 'http://localhost:3006',
        changeOrigin: true,
      },
      '/api/admin/coverage-areas': {
        target: 'http://localhost:3006',
        changeOrigin: true,
      },
      '/api/admin/route-pricing': {
        target: 'http://localhost:3006',
        changeOrigin: true,
      },
      '/api/admin/trips': {
        target: 'http://localhost:3009',
        changeOrigin: true,
      },
      '/api/admin/payments': {
        target: 'http://localhost:3007',
        changeOrigin: true,
      },
      '/api/admin/fleet': {
        target: 'http://localhost:3008',
        changeOrigin: true,
      },
      '/api/admin/notifications': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
      '/api/admin/disputes': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
      '/api/admin': {
        target: 'http://localhost:3015',
        changeOrigin: true,
      },
      '/api/booking': {
        target: 'http://localhost:3013',
        changeOrigin: true,
      },
      '/api/driver/documents': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/notifications': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
});
