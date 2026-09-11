// 重播引擎壓力測試：用真的瀏覽器隨機打完一整場（安打、出局、盜壘、換局），
// 每一步都記成紙條，最後把整場重算一次，跟畫面上的實際狀態比對。
// 用法：npm run build:preview 之後
//       node tools/replay-stress.mjs preview/baseball-preview-XXXX.html
// 需要 playwright 與預先裝好的 chromium（路徑見下方 executablePath）。
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 402, height: 874 } });
const warns = [];
p.on('console', m => { if (/重播對帳/.test(m.text())) warns.push(m.text()); });
await p.goto('file://' + process.argv[2]);
await p.waitForTimeout(1500);
const out = await p.evaluate(async (N) => {
  let seed = 20260911;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const $ = s => document.querySelector(s);
  const clickEl = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  $('#play-ball-btn').click();
  const done = [];
  for (let i = 0; i < N; i++) {
    if (JSON.parse(localStorage.getItem('baseballGameState')).isGameOver) break;
    const r = rnd();
    if (r < 0.45) {
      clickEl([...document.querySelectorAll('#quick-plays button')].find(b => b.textContent.trim() === pick(['三振', '四壞', '觸身'])));
      done.push('quick');
    } else if (r < 0.92) {
      // 在球場上隨機點一個位置
      const svg = $('#main-field');
      const box = svg.getBoundingClientRect();
      const x = box.left + box.width * (0.2 + rnd() * 0.6);
      const y = box.top + box.height * (0.25 + rnd() * 0.55);
      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
      svg.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
      const opts = [...document.querySelectorAll('#field-result-panel .frp-options button')];
      if (!opts.length) { clickEl($('.frp-cancel')); continue; }
      clickEl(pick(opts));
      // 進階視窗：問失誤就說沒有，選野手就選第一個
      for (let k = 0; k < 6; k++) {
        const pos = $('#modal-advanced-options button[data-step="select-error"]');
        if (pos) { clickEl(pos); continue; }
        const no = [...document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'no');
        if (no) { clickEl(no); continue; }
        break;
      }
      const d = $('#modal-advanced-done');
      if (d && !d.classList.contains('modal-hidden')) {
        if (d.disabled) { clickEl($('#close-modal')); done.push('取消'); continue; }
        clickEl(d);
      }
      done.push('field');
    } else {
      // 壘間事件（沒人在壘上就跳過）
      const btn = $('#runner-action-btn');
      if (btn.disabled) continue;
      clickEl(btn);
      const byText = t => [...document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === t);
      clickEl(byText('盜壘')); clickEl(byText('否，繼續')); clickEl(byText('成功'));
      const fin = [...document.querySelectorAll('#runner-action-modal button')].find(x => /完成|確定/.test(x.textContent));
      clickEl(fin);
      done.push('runner');
    }
  }
  await new Promise(r => setTimeout(r, 50));
  const gs = JSON.parse(localStorage.getItem('baseballGameState'));
  const rebuilt = window.__replay.rebuild();
  return {
    動作數: done.length, 紙條數: window.__replay.log().length,
    局數: gs.inning + (gs.isTop ? '上' : '下'),
    比分: gs.teams.a.score.reduce((x, y) => x + (y || 0), 0) + ':' + gs.teams.b.score.reduce((x, y) => x + (y || 0), 0),
    事件數: gs.events.length,
    一致: window.__replay.digest(rebuilt) === window.__replay.digest(),
    自動對帳: window.__replay.lastCheck(),
  };
}, 150);
console.log(out);
console.log('對帳警告：', warns.length ? warns : '無');
await b.close();
