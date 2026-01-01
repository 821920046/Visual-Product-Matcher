
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 显式加载当前环境的环境变量
  // Use '.' instead of process.cwd() to avoid property access error on the global Process type.
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // 这里的替换非常关键，Vite 会在构建时将代码中所有的 process.env.API_KEY 替换为字符串常量
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.API_BASE': JSON.stringify(env.API_BASE || '/api')
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
  };
});
