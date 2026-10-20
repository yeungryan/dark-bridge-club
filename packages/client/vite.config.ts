import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'es2022',
    rollupOptions: {
      // dev.html: seats with practice bots (S22). admin.html: reset a forgotten PIN (S07).
      // practice.html: you vs three bots in your browser, nothing recorded. lab.html: sound check.
      input: {
        main: resolve(__dirname, 'index.html'),
        dev: resolve(__dirname, 'dev.html'),
        admin: resolve(__dirname, 'admin.html'),
        practice: resolve(__dirname, 'practice.html'),
        lab: resolve(__dirname, 'lab.html'),
      },
    },
  },
});
