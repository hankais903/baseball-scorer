// 用真實 APP 邏輯模擬一整場九局比賽，驗證記分引擎
import { boot, click } from './harness.mjs';

const OUTS = ['三振','三振','三振','滾地','滾地','滾地','滾地','飛球','飛球','飛球','界飛','雙殺'];
const ONBASE = ['一安','一安','一安','一安','二安','三安','本打','四壞','四壞','失誤','內安'];
let seed = 20260819;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pickFrom = a => a[Math.floor(rnd() * a.length)];

const { window: w, errors } = await boot();
const q = s => w.document.querySelector(s);
const visible = () => [...w.document.querySelectorAll('#play-modal button')]
  .filter(b => !b.closest('.modal-hidden'));
const byText = t => visible().find(b => b.textContent.trim() === t);
const tap = t => { const b = byText(t); if (b) { click(w, b); return true; } return false; };

function score() {
  const a = q('#info-score-a').textContent, b = q('#info-score-b').textContent;
  return `${a}:${b}`;
}
function inningLabel() { return q('#inning-display').textContent.trim(); }

let plays = 0, guard = 0;
const log = [];
while (guard++ < parseInt(process.env.N||"20")) {
  const btn = q('#play-ball-btn');
  if (!btn || btn.classList.contains('disabled')) break;

  const before = inningLabel();
  click(w, btn);
  // 三成機率上壘，七成出局（大致接近真實比賽節奏）
  const onBase = rnd() < 0.33;
  if (!tap(onBase ? '上壘' : '出局')) break;
  const play = pickFrom(onBase ? ONBASE : OUTS);
  if (!tap(play)) { tap('×'); continue; }

  // 若進入確認畫面，補齊必要選擇後完成
  if (!q('#play-modal').classList.contains('modal-hidden')) {
    const askNo = byText('否，繼續');
    if (askNo) click(w, askNo);
    const done = q('#modal-advanced-done');
    if (done && !done.closest('.modal-hidden')) {
      if (done.disabled) {              // 有壘包衝突時隨便挑一個合法去向
        const opt = visible().find(b => /壘|得分/.test(b.textContent));
        if (opt) click(w, opt);
      }
      click(w, done);
    }
  }
  if (!q('#play-modal').classList.contains('modal-hidden')) { tap('×'); }
  plays++;
  if (plays % 25 === 0) process.stderr.write(`.`);
  const after = inningLabel();
  if (before !== after) log.push(`${before} 結束 → ${score()}`);
}

console.log('=== 模擬結果 ===');
console.log('總打席數:', plays);
console.log('最終局數:', inningLabel());
console.log('最終比分:', score());
console.log('錯誤訊息:', errors.length ? errors.slice(0,3).join(' | ') : '(無)');

console.log('\n=== 計分板 ===');
const rows = [...w.document.querySelectorAll('#scoreboard tr')];
rows.forEach(r => console.log('  ' + [...r.children].map(c => c.textContent.trim().padStart(4)).join('')));

console.log('\n=== 局數推進 ===');
log.slice(0, 20).forEach(l => console.log('  ' + l));

console.log('\n=== 事件日誌（最後 8 筆）===');
[...w.document.querySelectorAll('#event-log li')].slice(0, 8)
  .forEach(li => console.log('  ' + li.textContent.replace(/\s+/g,' ').trim().slice(0, 70)));

// 驗證資料一致性
console.log('\n=== 成績表（客隊打擊）===');
const setTab = t => { const b=[...w.document.querySelectorAll('#panel-tabs .panel-tab')]
  .find(x=>x.dataset.tab===t); if(b) click(w,b); };
setTab('team-a');
const bt = w.document.querySelector('#pane-team-a .box-batting');
if (bt) [...bt.querySelectorAll('tr')].slice(0,12).forEach(r =>
  console.log('  ' + [...r.children].map(c=>c.textContent.trim().padStart(5)).join('')));

console.log('\n=== 一致性檢查 ===');
const cells = [...w.document.querySelectorAll('#scoreboard-body tr')].map(r =>
  [...r.children].map(c=>c.textContent.trim()));
cells.forEach(row => {
  const innings = row.slice(1, -3).map(v => Number(v||0));
  const sum = innings.reduce((a,b)=>a+b,0);
  const R = Number(row[row.length-3]);
  console.log(`  ${row[0]}：各局合計 ${sum} vs R 欄 ${R} → ${sum===R?'一致':'不符'}`);
});

console.log('\n=== 投手成績 ===');
setTab('team-a');
const pt = w.document.querySelector('#pane-team-a .box-pitching');
console.log('（僅列客隊投手；兩隊分開統計）');
if (pt) [...pt.querySelectorAll('tr')].forEach(r =>
  console.log('  ' + [...r.children].map(c=>c.textContent.trim().padStart(6)).join('')));

console.log('\n=== 逐局經過 ===');
const evs = [...w.document.querySelectorAll('#event-log li')]
  .map(li => li.textContent.replace(/\s+/g,' ').trim()).reverse();
evs.forEach(e => console.log('  ' + e.slice(0, 76)));
