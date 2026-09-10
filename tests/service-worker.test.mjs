// 離線快取：確保更新後手機不會一直卡在舊版
// （曾發生過：快取版本名寫死成 baseball-app-v2，首頁又是「先看快取」，
//   於是已經開過的手機永遠拿不到新版）
import fs from 'fs';
import path from 'path';

const SW_PATH = path.join('dist', 'service-worker.js');
const src = fs.readFileSync(SW_PATH, 'utf8');

const res = (body) => ({ body, status: 200, type: 'basic', clone() { return this; } });
const keyOf = (req) => (typeof req === 'string' ? req : req.url);

class FakeCache {
  constructor() { this.map = new Map(); }
  async addAll(urls) { urls.forEach(u => this.map.set(u, res('外殼'))); }
  async put(req, r) { this.map.set(keyOf(req), r); }
  async match(req) { return this.map.get(keyOf(req)); }
}

// 用假的 self／caches／fetch 把 service worker 跑起來，記下它註冊了哪些處理程序
function loadSW(fetchImpl) {
  const store = new Map();
  const caches = {
    async open(name) { if (!store.has(name)) store.set(name, new FakeCache()); return store.get(name); },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
    async match(req) {
      for (const c of store.values()) { const hit = await c.match(req); if (hit) return hit; }
      return undefined;
    },
  };
  const listeners = {};
  const calls = { fetch: 0, claimed: false, skipped: false };
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { calls.skipped = true; },
    clients: { claim: () => { calls.claimed = true; } },
  };
  const fetch = async (req) => { calls.fetch++; return fetchImpl(req); };
  new Function('self', 'caches', 'fetch', src)(self, caches, fetch);
  return { listeners, caches, store, calls };
}

const fire = (fn, request) => {
  const e = { request, respondWith(p) { e.response = p; }, waitUntil(p) { e.waited = p; } };
  fn(e);
  return e;
};

export default async function (t) {
  await t('建置時有填入版本戳記，不是佔位字串', async () => {
    t.assert(!src.includes('__BUILD_STAMP__'), 'dist 裡還留著 __BUILD_STAMP__，建置沒有填入戳記');
    const m = src.match(/const BUILD_STAMP = '([^']+)'/);
    t.assert(m, '找不到 BUILD_STAMP');
    t.assert(/^\d{4}-\d{2}-\d{2}T/.test(m[1]), '戳記格式不對：' + m[1]);
  });

  await t('開啟頁面時先問伺服器，拿得到新版', async () => {
    const sw = loadSW(async () => res('新版'));
    const old = await sw.caches.open('baseball-app-舊版本');
    await old.put({ url: 'https://x/' }, res('舊版'));
    const e = fire(sw.listeners.fetch, { url: 'https://x/', method: 'GET', mode: 'navigate' });
    const got = await e.response;
    t.assert(got.body === '新版', '開頁面時拿到的是「' + got.body + '」，應該要是新版');
    t.assert(sw.calls.fetch === 1, '沒有去問伺服器');
  });

  await t('沒網路時改用手機裡的備份', async () => {
    const sw = loadSW(async () => { throw new Error('斷線'); });
    const old = await sw.caches.open('baseball-app-舊版本');
    await old.put({ url: 'https://x/' }, res('備份'));
    const e = fire(sw.listeners.fetch, { url: 'https://x/', method: 'GET', mode: 'navigate' });
    const got = await e.response;
    t.assert(got && got.body === '備份', '斷線時沒有拿出備份');
  });

  await t('換版本後舊的快取會被刪掉', async () => {
    const sw = loadSW(async () => res('新版'));
    await sw.caches.open('baseball-app-舊版本');
    await sw.caches.open('baseball-app-更舊版本');
    const e = fire(sw.listeners.activate, undefined);
    await e.waited;
    const left = await sw.caches.keys();
    t.assert(!left.includes('baseball-app-舊版本') && !left.includes('baseball-app-更舊版本'),
             '舊快取沒有被刪掉：' + left.join('、'));
    t.assert(sw.calls.claimed, '沒有接管現有分頁');
  });

  await t('安裝時要求立刻接手，不用等分頁關掉', async () => {
    const sw = loadSW(async () => res('新版'));
    const e = fire(sw.listeners.install, undefined);
    await e.waited;
    t.assert(sw.calls.skipped, '沒有呼叫 skipWaiting，新版會等到所有分頁關掉才生效');
  });

  await t('程式與樣式檔照樣優先用快取', async () => {
    const sw = loadSW(async () => res('從伺服器來的'));
    const c = await sw.caches.open('baseball-app-舊版本');
    await c.put({ url: 'https://x/assets/index-abc123.js' }, res('快取裡的'));
    const e = fire(sw.listeners.fetch, { url: 'https://x/assets/index-abc123.js', method: 'GET', mode: 'no-cors' });
    const got = await e.response;
    t.assert(got.body === '快取裡的', '沒有優先用快取');
    t.assert(sw.calls.fetch === 0, '快取有東西還去問伺服器');
  });
}
