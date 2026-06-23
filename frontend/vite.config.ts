import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');

// Without this, Vite's SPA fallback answers a request for a missing
// `/assets/...` file with index.html (200 text/html). Phaser then downloads
// that HTML and hangs trying to decode it as an image, which stalls the boot
// loader forever. Returning a real 404 lets Phaser's FILE_LOAD_ERROR handler
// fire so missing strips fall back to static art as intended.
function missingAssets404(): Plugin {
  return {
    name: 'farmy-missing-assets-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/assets/')) {
          next();
          return;
        }
        const rel = normalize(decodeURIComponent(url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
        const filePath = join(publicDir, rel);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          next();
          return;
        }
        res.statusCode = 404;
        res.end('Not found');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), missingAssets404()],
  build: {
    // Phaser is a single ~1.5 MB vendor lib that can't be split below 500 kB;
    // raise the warning ceiling above it so the warning only fires on real
    // regressions in our own code.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser is large; split it into its own chunk so the app bundle stays
        // small and the chunk-size warning is not triggered for our own code.
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    // Bind to 0.0.0.0 so the dev server is reachable from other devices on
    // the local network (phones, other PCs). Vite prints the LAN URL on start.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:53001',
        changeOrigin: true,
      },
    },
  },
});
