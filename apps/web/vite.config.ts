import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Bound to 0.0.0.0 so the dev server is reachable from outside the container. `/api` is proxied
// rather than called by origin so the browser never needs a second origin, and the refresh cookie
// — HttpOnly, SameSite=Strict — is sent on a same-origin request the way production serves it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: { usePolling: false },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://api:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // FR-64 narrows the refresh cookie to Path=/auth, and behind this prefix the browser sees
        // /api/auth — so it would never send it back. Rewritten here rather than widened in the
        // API: the prefix is this proxy's invention, and production puts the API on its own port
        // where the path already matches.
        cookiePathRewrite: { '/auth': '/api/auth' },
      },
    },
  },
});
