import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Under WSL, edits made from Windows to /mnt/... don't fire inotify events,
// so files have to be watched by polling.
const wslOnWindowsDrive = !!process.env.WSL_DISTRO_NAME && process.cwd().startsWith('/mnt/');

export default defineConfig({
  server: {
    watch: wslOnWindowsDrive ? { usePolling: true, interval: 300 } : undefined,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Casa',
        short_name: 'Casa',
        description: 'Calendario familiar y cosas de casa · Family calendar and household organizer',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F4EEE5',
        theme_color: '#F4EEE5',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
