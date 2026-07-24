import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Predictive Rebalancing Engine',
          short_name: 'Rebalance',
          description: 'A minimalist Buy & Hold dividend strategy tool',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: 'icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
