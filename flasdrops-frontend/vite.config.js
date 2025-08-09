import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: false,                 // фронт в dev по HTTP
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // бек по HTTP на 5000
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
