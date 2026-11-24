import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    global: 'window',
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
});

