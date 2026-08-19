import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // 用相對路徑，這樣不管放在 GitHub Pages 的哪個子目錄都能正常運作
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  publicDir: 'public',
});
