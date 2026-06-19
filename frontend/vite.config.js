import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
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
        proxy: {
            '/api': {
                target: 'http://localhost:53001',
                changeOrigin: true,
            },
        },
    },
});
