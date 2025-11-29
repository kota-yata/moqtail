import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  root: __dirname,
  server: { host: '0.0.0.0', port: 5193 },
  resolve: {
    alias: {
      moqtail: resolve(__dirname, '../dist/index.js'),
      bytes: resolve(__dirname, '../../bytes/dist/index.js')
    }
  }
};

