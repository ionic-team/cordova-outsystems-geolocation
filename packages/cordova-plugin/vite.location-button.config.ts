import { defineConfig } from 'vite';

// `plugin.xml` runs this script in every app at startup, so it ships minified.
export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: true,
    outDir: 'dist',
    target: 'es2020',
    lib: {
      entry: './src/location-button.ts',
      name: 'OSGeolocationLocationButton',
      fileName: () => 'location-button.js',
      formats: ['iife'],
    },
  },
});
