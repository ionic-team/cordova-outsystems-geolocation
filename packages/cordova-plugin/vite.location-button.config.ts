import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
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
