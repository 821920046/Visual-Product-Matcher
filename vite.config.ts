
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use a type-safe reference for process for the config environment
const nodeProcess = typeof process !== 'undefined' ? process : { env: { API_KEY: '' } };

export default defineConfig({
  plugins: [react()],
  define: {
    // Replace the literal string to avoid 'process' variable detection in the final bundle
    'process.env.API_KEY': JSON.stringify(nodeProcess.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          genai: ['@google/genai']
        }
      }
    }
  }
});
