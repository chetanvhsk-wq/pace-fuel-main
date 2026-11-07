import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }

            if (id.includes('@google/genai')) {
              return 'ai-vendor';
            }

            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }

            if (id.includes('recharts')) {
              return 'charts-vendor';
            }

            if (
              id.includes('react-router') ||
              id.includes('react-dom') ||
              id.includes('/react/')
            ) {
              return 'react-vendor';
            }

            if (id.includes('motion') || id.includes('lucide-react')) {
              return 'ui-vendor';
            }

            if (id.includes('date-fns')) {
              return 'date-vendor';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
