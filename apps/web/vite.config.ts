import { defineConfig } from 'vite';

// Bound to 0.0.0.0 so the dev server is reachable from outside the container.
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: { usePolling: false },
  },
});
