// 離線快取。版本名字裡的戳記由建置時填入（見 vite.config.ts），
// 每次建置都不一樣，手機才知道「這是新的一版，舊的要丟掉」。
const BUILD_STAMP = '__BUILD_STAMP__';
const CACHE_NAME = `baseball-app-${BUILD_STAMP}`;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './img/field.png',
  './img/stadium-night.jpg',
  './img/batter-default.jpg'
];

// 安裝：先把外殼存起來，並要求立刻接手（不用等所有分頁關掉）
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

// 啟用：把舊版本的快取全部刪掉，再接管現有分頁
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n === CACHE_NAME ? null : caches.delete(n)))))
      .then(() => self.clients && self.clients.claim && self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 開啟頁面：先問伺服器，才不會一直卡在舊版；沒網路才用手機裡的備份
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 其他檔案（樣式、程式、圖片）：檔名本身就帶版本編號，內容不會變，先用快取比較快
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
