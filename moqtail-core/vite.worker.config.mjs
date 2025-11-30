import { defineConfig } from 'vite';

// Build the transport worker as a single-file ES module that can be loaded
// reliably from external apps without depending on node_modules resolution.
export default defineConfig({
  build: {
    outDir: 'dist/transport',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/transport/worker.ts',
      formats: ['es'],
      fileName: () => 'worker.bundle.js',
    },
    rollupOptions: {
      treeshake: false,
    },
    target: 'es2020',
    // Keep it readable for debugging in consuming apps
    minify: false,
  },
});

