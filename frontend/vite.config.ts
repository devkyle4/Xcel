import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Override to run the frontend against another API instance.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Page tests drive whole user journeys through the router and forms.
    testTimeout: 15_000,
    // CSS is skipped in tests except the tokens, which the contrast test reads.
    css: { include: [/tokens\.css/] },
  },
});
