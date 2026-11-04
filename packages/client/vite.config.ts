import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Which build this is (the commit and the day), shown on the practice table so an old tab that
// was never reloaded is easy to spot: it keeps running the code it first loaded.
function buildId(): string {
  let sha = process.env.GITHUB_SHA?.slice(0, 7) ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      sha = 'dev';
    }
  }
  return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

const BUILD = buildId();

/** version.json: open tabs fetch it to notice a newer build and offer a refresh (lib/update). */
const versionFile = (): Plugin => ({
  name: 'dark-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
  },
});

export default defineConfig({
  plugins: [svelte(), versionFile()],
  define: { __BUILD__: JSON.stringify(BUILD) },
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
