// 共用測試工具：把建置後的 dist 載入 jsdom，模擬真實瀏覽器環境
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const DIST = 'dist';

// jsdom 視窗不會自己關閉，裡面的計時器（game-manager 每 10 秒自動儲存）會一直排隊：
// 跑到後面的套件時上百個視窗同時在計時，會排擠測試自己的 setTimeout，
// 整套跑完後也讓 node 停不下來。跑完統一關掉。
const openWindows = new Set();
export function closeAllWindows() {
  for (const w of openWindows) { try { w.close(); } catch {} }
  openWindows.clear();
}

// 等條件成立再往下走，取代寫死秒數的 sleep：
// 固定等待會因為計時器被排擠而偶發失敗（板凳滑動刪除就踩過）。
export async function waitFor(fn, { timeout = 5000, interval = 20, message = '等待條件逾時' } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise(r => setTimeout(r, interval));
  }
}

export async function boot(opts = {}) {
  let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  html = html.replace(/<script src="https:\/\/[^"]*"><\/script>/g, '');

  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  openWindows.add(window);
  window.XLSX = {};
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.alert = () => {};
  window.confirm = () => true;
  if (opts.storage) {
    for (const [k, v] of Object.entries(opts.storage)) window.localStorage.setItem(k, v);
  }

  const errors = [];
  window.addEventListener('error', e => errors.push('onerror: ' + e.message));
  window.console.error = (...a) => errors.push('console.error: ' + a.join(' '));

  for (const f of ['game-manager.js', 'game-list-ui.js', 'game-helpers.js', 'official-sheet.js']) {
    try { window.eval(fs.readFileSync(path.join(DIST, f), 'utf8')); }
    catch (e) { errors.push(`${f}: ${e.message}`); }
  }
  const bundle = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.endsWith('.js'));
  try { window.eval(fs.readFileSync(path.join(DIST, 'assets', bundle), 'utf8')); }
  catch (e) { errors.push(`bundle: ${e.message}`); }

  // jsdom 會自行觸發 DOMContentLoaded；重複 dispatch 會讓 init() 跑兩次
  if (window.document.readyState === 'loading') {
    await new Promise(r => window.document.addEventListener('DOMContentLoaded', r, { once: true }));
  } else {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  try { window.eval(fs.readFileSync(path.join(DIST, 'game-integration.js'), 'utf8')); }
  catch (e) { errors.push(`game-integration.js: ${e.message}`); }

  return { window, errors, q: s => window.document.querySelector(s) };
}

export function type(w, el, v) {
  el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
}

export function click(w, el) {
  el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
}

// 按下「套用名單」——刻意不使用 form submit，
// 因為沙箱化的 iframe 會阻擋原生送出，這正是要防止復發的情境
export function applyLineup(w) {
  click(w, w.document.getElementById('apply-lineup'));
}

export function nameInput(w, team, i) {
  return w.document.querySelector(
    `input[data-team="${team}"][data-index="${i}"][data-type="name"]`);
}

export function batterText(w) {
  const el = w.document.querySelector('#batter-main-info');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

export async function uploadPhoto(w, idx, team = 'a') {
  const inp = w.document.querySelector(
    `input[data-team="${team}"][data-index="${idx}"][data-type="photo"]`);
  if (!inp) return false;
  const preview = w.document.getElementById(`player-photo-preview-${team}-${idx}`);
  const before = preview ? preview.src : '';
  const f = new w.File(['x'], 'p.png', { type: 'image/png' });
  Object.defineProperty(inp, 'files', { value: [f], configurable: true });
  inp.dispatchEvent(new w.Event('change', { bubbles: true }));
  // 等到照片真的套用完成（會觸發重繪），否則斷言會在重繪前執行而失去意義
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 20));
    if (preview && preview.src !== before && preview.src.startsWith('data:image/png')) return true;
  }
  throw new Error('照片上傳未在時限內完成，測試無法驗證重繪行為');
}

// 新流程：PLAY BALL 只負責開賽，之後改用快捷鍵或球場點擊記錄
export function startGame(w) {
  if (!w.document.getElementById('play-ball-btn').classList.contains('hidden')) {
    click(w, w.document.querySelector('#play-ball-btn'));
  }
}

export function recordAtBat(w, label = '三振') {
  startGame(w);
  // 三振等未擊出的結果走常駐快捷按鈕
  const quick = w.document.querySelector(`#quick-plays button[data-play="${label}"]`);
  if (quick) { click(w, quick); return true; }
  click(w, w.document.querySelector('#play-ball-btn'));
  const pick = t => {
    const b = [...w.document.querySelectorAll('#play-modal button')]
      .filter(x => !x.closest('.modal-hidden'))
      .find(x => x.textContent.trim() === t);
    click(w, b);
    return !!b;
  };
  pick('出局');
  return pick(label);
}

// 整片球場單一點擊區：用座標表達內野／外野／界外（測試環境把 clientX/Y 當 viewBox 座標）
const ZONE_XY = { infield: [202, 250], outfield: [202, 90], foul: [60, 330], field: [202, 250], deepcf: [202, -20] };
export function clickZone(w, zone) {
  const [x, y] = ZONE_XY[zone] || ZONE_XY.field;
  w.document.querySelector('[data-zone="field"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}
