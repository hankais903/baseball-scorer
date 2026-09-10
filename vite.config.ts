import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// 每次建置給 service-worker.js 一個新的戳記，手機才會知道要換掉舊的離線快取。
// public/ 的檔案是原封不動複製過去的，所以要在建置完成後才改。
function stampServiceWorker() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    name: 'stamp-service-worker',
    closeBundle() {
      const file = path.resolve(__dirname, 'dist/service-worker.js');
      if (!fs.existsSync(file)) return;
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('__BUILD_STAMP__')) {
        throw new Error('service-worker.js 少了 __BUILD_STAMP__，離線快取不會更新');
      }
      fs.writeFileSync(file, src.replaceAll('__BUILD_STAMP__', stamp));
    },
  };
}

export default defineConfig({
  plugins: [stampServiceWorker()],
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
