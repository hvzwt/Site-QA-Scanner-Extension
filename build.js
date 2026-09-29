import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

async function buildAll() {
  console.log('--- Step 1: Building Side Panel UI ---');
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve('sidepanel.html'),
        },
      },
    },
  });

  console.log('--- Step 2: Building Content Script (Self-contained IIFE) ---');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: resolve('src/content/index.ts'),
        output: {
          format: 'iife',
          entryFileNames: 'content.js',
          extend: true,
        },
      },
    },
  });

  console.log('--- Step 3: Building Background Service Worker ---');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: resolve('src/background/index.ts'),
        output: {
          format: 'es',
          entryFileNames: 'background.js',
        },
      },
    },
  });

  console.log('--- Step 4: Ensuring Manifest and Icons in dist ---');
  if (fs.existsSync('public/manifest.json')) {
    fs.copyFileSync('public/manifest.json', 'dist/manifest.json');
  }
  if (fs.existsSync('public/icons')) {
    fs.cpSync('public/icons', 'dist/icons', { recursive: true });
  }

  console.log('✅ Chrome Extension build completed successfully in ./dist');
}

buildAll().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
