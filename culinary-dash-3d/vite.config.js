import { defineConfig } from 'vite';

// The game deploys as static assets. `base` is relative so it works whether
// it's served at the domain root or from a /3d/ subdirectory on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  // This project has no PostCSS/Tailwind setup of its own (its one <style>
  // block is plain CSS) — without this, Vite walks up to the parent repo's
  // postcss.config.js (Tailwind, for chez-samoa-3D) and fails since that
  // config's plugins aren't installed here. An inline empty config stops the
  // filesystem search.
  css: { postcss: {} },
});
