import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  const backendTarget =
    process.env.VITE_KX_BACKEND_TARGET ?? 'http://localhost:8883';
  const source = (path: string) =>
    fileURLToPath(new URL(path, import.meta.url));

  return {
    application: {},
    vite: {
      build: {
        emptyOutDir: true,
        manifest: true,
        outDir: 'dist/kx-adm',
      },
      resolve: {
        alias: [
          {
            find: /^#\/api$/,
            replacement: source('./src/api.ts'),
          },
          {
            find: /^#\/products\/pages$/,
            replacement: source('./src/products/pages.ts'),
          },
          {
            find: /^#\/products\/components$/,
            replacement: source('./src/products/components.ts'),
          },
          {
            find: /^#\//,
            replacement: `${source('./src')}/`,
          },
        ],
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: backendTarget,
            ws: true,
          },
        },
      },
    },
  };
});
