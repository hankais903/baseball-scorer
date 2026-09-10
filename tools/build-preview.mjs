// 產生「單檔預覽 HTML」：把樣式、字型、球場圖、所有腳本都塞進同一個檔案，
// 開啟即可用，不需要伺服器。用法：npm run build:preview
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { boot } from '../tests/harness.mjs';
import { DEVICE, safeAreaCss, buildFramePage } from './device-frame.mjs';
import { mockCss, mockJs, buildComparePage } from './layout-mockup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'preview');

const read = p => fs.readFileSync(path.join(DIST, p), 'utf8');
const b64 = p => fs.readFileSync(path.join(DIST, p)).toString('base64');
// 取代值一律包成函式：壓縮過的 JS 裡有 $& 這種字元，
// 直接當字串取代會被 JS 當成「整段比對到的內容」，把程式碼弄壞
const lit = text => () => text;

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('找不到 dist/index.html，請先跑 npm run build');
}

// 版本戳記：用建置時間，開新版本就等於開新比賽
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// 先在 jsdom 開一次全新的 APP，撈出「新比賽」的乾淨狀態當樣板。
// 有了樣板，版本更新時才能只把名單搬過來、不把上一場的比賽進度帶進來。
const { window: w } = await boot();
w.__scheduleAutoApply && w.__scheduleAutoApply();   // 逼它把預設狀態寫進儲存
await new Promise(r => setTimeout(r, 500));
const FRESH_STATE = w.localStorage.getItem('baseballGameState');
w.close();
if (!FRESH_STATE) throw new Error('抓不到新比賽的狀態樣板');

const bundleJs = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.endsWith('.js'));
const bundleCss = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.endsWith('.css'));

// 字型內嵌進樣式
const css = read(path.join('assets', bundleCss))
    .replace('url(./fonts/archivo-num-800.woff2)',
             `url(data:font/woff2;base64,${b64('fonts/archivo-num-800.woff2')})`);

const inlineScript = src => lit(`<script>\n${read(src)}\n</script>`);

// 版本戳記啟動器：版本一變就開新比賽，但把名單搬過來
const bootstrap = `<script>
(function () {
    var STAMP = ${JSON.stringify(STAMP)};
    var KEY = 'baseball_preview_stamp';
    try {
        if (localStorage.getItem(KEY) === STAMP) return;   // 同一版：照常接續上次比賽
        var fresh = ${FRESH_STATE};
        var old = null;
        try { old = JSON.parse(localStorage.getItem('baseballGameState')); } catch (e) {}
        if (old && old.teams) {
            ['a', 'b'].forEach(function (k) {
                var o = old.teams[k], f = fresh.teams[k];
                if (!o || !f) return;
                if (o.name) f.name = o.name;
                if (o.color) f.color = o.color;
                if (typeof o.useDH === 'boolean') f.useDH = o.useDH;
                (o.roster || []).forEach(function (p, i) {
                    if (!p || !f.roster[i]) return;
                    // 只搬名單欄位，成績一律留在新比賽的初始值
                    ['name', 'jersey', 'pos', 'photo'].forEach(function (key) {
                        if (p[key] !== undefined) f.roster[i][key] = p[key];
                    });
                });
            });
        }
        localStorage.setItem('baseballGameState', JSON.stringify(fresh));
        localStorage.removeItem('baseball_current_game_id');
        localStorage.setItem(KEY, STAMP);
    } catch (e) { console.log('預覽版本戳記處理失敗：', e); }
})();
</script>`;

let html = read('index.html')
    // 單檔預覽沒有外部檔案可以指，圖示直接內嵌
    .replace('<link rel="manifest" href="./manifest.json">', '<!-- 預覽版不掛 manifest -->')
    .replace(/<link rel="icon"[^>]*>/, lit(`<link rel="icon" type="image/png" href="data:image/png;base64,${b64('icon-192.png')}">`))
    .replace(/<link rel="apple-touch-icon"[^>]*>/, lit(`<link rel="apple-touch-icon" href="data:image/png;base64,${b64('icon-192.png')}">`))
    // 樣式與腳本全部內嵌
    .replace(`<link rel="stylesheet" crossorigin href="./assets/${bundleCss}">`, lit(`<style>\n${css}\n</style>`))
    .replace('<script src="./game-manager.js"></script>', inlineScript('game-manager.js'))
    .replace('<script src="./game-list-ui.js"></script>', inlineScript('game-list-ui.js'))
    .replace('<script src="./game-helpers.js"></script>', inlineScript('game-helpers.js'))
    .replace('<script src="./official-sheet.js"></script>', inlineScript('official-sheet.js'))
    .replace(`<script type="module" crossorigin src="./assets/${bundleJs}"></script>`,
             lit(`<script type="module">\n${read(path.join('assets', bundleJs))}\n</script>`))
    .replace('<script src="./game-integration.js"></script>', inlineScript('game-integration.js'))
    // 球場圖轉成內嵌圖檔
    .replaceAll('href="./img/field.png"', lit(`href="data:image/png;base64,${b64('img/field.png')}"`))
    // 單檔預覽沒有 service worker 可以註冊
    .replace(/if \('serviceWorker' in navigator\) \{[\s\S]*?\n        \}\n/, lit("// 預覽版不註冊 Service Worker\n"));

// 啟動器要排在所有 APP 腳本之前
html = html
    .replace('<!-- 遊戲管理模組 -->', lit(`<!-- 預覽版本戳記 -->\n    ${bootstrap}\n\n    <!-- 遊戲管理模組 -->`))
    .replace('<title>棒球比賽紀錄</title>', lit(`<title>棒球比賽紀錄（預覽 ${STAMP}）</title>`));

const leftovers = [...html.matchAll(/(?:src|href)="\.\/[^"]*"/g)].map(m => m[0]);
if (leftovers.length) throw new Error('還有沒內嵌的檔案：' + leftovers.join(', '));

fs.mkdirSync(OUT_DIR, { recursive: true });
const full = path.join(OUT_DIR, `baseball-preview-${STAMP}.html`);
fs.writeFileSync(full, html);

// 另外存一份「拆掉最外層骨架」的版本，給需要嵌進別的頁面時用。
// 只能從檔頭、檔尾、head/body 交界三個地方下刀：
// official-sheet.js 的列印樣板字串裡也有 <head>/<body>，全文取代會把它弄壞。
const HEAD = '<!DOCTYPE html>\n<html lang="zh-TW">\n<head>\n';
const BOUNDARY = '</head>\n<body>';
const TAIL = /<\/body>\s*<\/html>\s*$/;
let inner = html;
if (inner.startsWith(HEAD)) inner = inner.slice(HEAD.length); else throw new Error('檔頭不如預期');
const bi = inner.indexOf(BOUNDARY);
if (bi < 0) throw new Error('找不到 head／body 交界');
inner = inner.slice(0, bi) + inner.slice(bi + BOUNDARY.length);
if (!TAIL.test(inner)) throw new Error('檔尾不如預期');
inner = inner.replace(TAIL, '').replace('<meta charset="UTF-8">', '')
             .replace(/<title>[^<]*<\/title>/, lit('<title>棒球比賽紀錄</title>')).trim();
// 驗證沒有誤刪腳本內容
for (const f of ['official-sheet.js', 'game-manager.js', 'game-helpers.js']) {
    if (!inner.includes(read(f))) throw new Error(`${f} 被截斷了`);
}
const embed = path.join(OUT_DIR, `baseball-preview-${STAMP}-embed.html`);
fs.writeFileSync(embed, inner);

// 第三份：包進 iPhone 17 Pro 機身外框、標出動態島，方便在電腦上檢查版面。
// iframe 裡拿不到真機的安全區數值，所以先把模擬用的樣式塞進 APP 的 head。
const appForFrame = html.replace(BOUNDARY, `<style>${safeAreaCss()}</style>\n${BOUNDARY}`);
if (appForFrame === html) throw new Error('安全區樣式沒有塞進去');
const device = path.join(OUT_DIR, `baseball-preview-${STAMP}-device.html`);
fs.writeFileSync(device, buildFramePage(appForFrame));

// 第四份：版面試作比較頁（現況／乙案／丙案），試作的樣式只活在預覽裡
const appForMock = appForFrame.replace(BOUNDARY, `<style>${mockCss()}</style><script>${mockJs()}<\/script>\n${BOUNDARY}`);
if (appForMock === appForFrame) throw new Error('試作樣式沒有塞進去');
const compare = path.join(OUT_DIR, `baseball-preview-${STAMP}-compare.html`);
fs.writeFileSync(compare, buildComparePage(appForMock));

const kb = p => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
console.log(`版本戳記：${STAMP}`);
console.log(`完整單檔：${path.relative(ROOT, full)}（${kb(full)}）`);
console.log(`嵌入用版本：${path.relative(ROOT, embed)}（${kb(embed)}）`);
console.log(`機身外框版：${path.relative(ROOT, device)}（${kb(device)}）— ${DEVICE.name} ${DEVICE.width}×${DEVICE.height}`);
console.log(`版面比較頁：${path.relative(ROOT, compare)}（${kb(compare)}）— 現況／乙案／丙案`);
process.exit(0);
