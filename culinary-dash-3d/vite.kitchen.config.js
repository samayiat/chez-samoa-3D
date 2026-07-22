import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the 2.5D kitchen look-proof into ONE self-contained HTML.
export default defineConfig({
  plugins: [viteSingleFile()],
  // Pin an inline (empty) PostCSS config so Vite does NOT walk up the tree and
  // pick up the repo-root React app's postcss.config.js, which requires
  // tailwindcss/autoprefixer that this sub-build never installs. This preview
  // is self-contained Three.js with inline CSS -- it needs no PostCSS plugins.
  css: { postcss: {} },
  build: {
    target: 'es2022',
    outDir: 'dist-kitchen',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { input: 'kitchen.html' },
  },
});
