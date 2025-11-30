import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const allowPaths = [
  // Allow serving the shared transport worker from the workspace package
  resolve(__dirname, '../moqtail-core'),
  resolve(__dirname, '../moqtail-core/dist'),
];

export default defineConfig({
  plugins: [sveltekit()],
  // server: {
  //   fs: {
  //     allow: allowPaths,
  //   },
  // },
});
