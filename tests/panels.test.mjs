// 事件頁的三個分頁：成績表要能左右滑、戰況表的球員列要跟打擊成績一樣、
// 「正式記錄表」暫時只在 APP 內顯示與「匯出紀錄」相同的內容
import { boot, click, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const builtCss = async () => {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join('dist', 'assets');
  return fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
};

// 打一個打席，讓成績表與戰況表有東西可看
async function bootWithOnePlay() {
  const ctx = await boot();
  const { window: w, q } = ctx;
  w.alert = () => {};
  click(w, q('#play-ball-btn'));
  clickZone(w, 'outfield');
  click(w, q('#field-result-panel button[data-play="二安"]'));
  click(w, q('#modal-advanced-done'));
  await sleep(150);
  return ctx;
}

export default async function (t) {
  await t('成績表寬度依內容撐開，塞不下才左右滑', async () => {
    const css = await builtCss();
    const rules = css.match(/\.panel-pane table\{[^}]*\}/g) || [];
    const last = rules[rules.length - 1] || '';
    t.assert(/min-width:\s*100%/.test(last), '表格沒有 min-width:100%：' + last);
    t.assert(/width:\s*auto/.test(last), '表格仍被鎖成固定寬度：' + last);
    t.assert(!/table-layout:\s*fixed/.test(last), '表格仍是 table-layout:fixed：' + last);
  });

  await t('成績表的欄位不會把內容截掉', async () => {
    const css = await builtCss();
    const rules = css.match(/\.panel-pane th,\.panel-pane td\{[^}]*\}/g) || [];
    const bad = rules.filter(r => /text-overflow:\s*ellipsis/.test(r));
    t.assert(bad.length === 0, '欄位仍會截字：' + bad.join(' '));
  });

  await t('成績表外層可以左右捲', async () => {
    const css = await builtCss();
    const rule = (css.match(/\.panel-pane\{[^}]*\}/g) || []).join(' ');
    t.assert(/overflow-x:\s*auto/.test(rule), '.panel-pane 沒有 overflow-x:auto：' + rule);
  });

  // 真正讓資訊「看不到又滑不到」的原因：手機版把好幾欄 display:none 藏起來
  await t('手機版不再把成績表的欄位藏起來', async () => {
    const css = await builtCss();
    const hidden = (css.match(/\.box-(batting|pitching)[^{]*nth-child[^{]*\{[^}]*display:\s*none[^}]*\}/g) || []);
    t.assert(hidden.length === 0, '仍有被藏起來的欄位：' + hidden.join(' '));
  });

  // 左右滑的時候要知道現在看的是誰，所以姓名欄鎖在左邊、寬度固定
  await t('成績表的姓名欄鎖在左邊且寬度固定', async () => {
    const css = await builtCss();
    const rules = css.match(/\.panel-pane th:first-child,\.panel-pane td:first-child\{[^}]*\}/g) || [];
    const rule = rules.find(r => /position:\s*sticky/.test(r)) || '';
    t.assert(rule, '姓名欄沒有鎖定（找不到 position:sticky）：' + rules.join(' '));
    t.assert(/left:\s*0/.test(rule), '鎖定沒有貼齊左邊：' + rule);
    t.assert(/background-color:/.test(rule), '鎖定的欄位沒有底色，捲動時會透出後面的字：' + rule);
    const w = rule.match(/--name-col:\s*([^;]+);/);
    t.assert(w, '沒有設定姓名欄寬度：' + rule);
    ['width', 'min-width', 'max-width'].forEach(k => {
      t.assert(new RegExp(k + ':\\s*var\\(--name-col\\)').test(rule), `${k} 沒有用同一個寬度：` + rule);
    });
  });

  await t('戰況表的球員列與打擊成績表同一種寫法', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('.panel-tab[data-tab="team-a"]'));
    await sleep(120);
    const batting = q('#pane-team-a .box-batting tbody td .box-score-player-cell span').textContent.trim();
    click(w, q('.panel-tab[data-tab="situation"]'));
    await sleep(120);
    const cell = q('#pane-situation tbody td.sit-name .box-score-player-cell span');
    t.assert(!!cell, '戰況表沒有沿用 .box-score-player-cell');
    const sit = cell.textContent.trim();
    t.assert(sit === batting, `戰況表顯示「${sit}」，打擊成績顯示「${batting}」`);
    t.assert(!q('#pane-situation .sit-order'), '戰況表仍在用舊的 .sit-order 寫法');
  });

  await t('戰況表的守位標記沿用 .box-pos', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('.panel-tab[data-tab="situation"]'));
    await sleep(120);
    t.assert(!!q('#pane-situation tbody td.sit-name .box-pos'), '守位沒有用 .box-pos');
  });

  await t('正式記錄表在 APP 內顯示，不會開新視窗', async () => {
    const { window: w, q } = await bootWithOnePlay();
    let opened = 0;
    w.open = () => { opened++; return null; };
    let sheetCalls = 0;
    w.openOfficialSheet = () => { sheetCalls++; return true; };
    click(w, q('#official-sheet-btn'));
    await sleep(120);
    t.assert(opened === 0, '仍然呼叫了 window.open');
    t.assert(sheetCalls === 0, '仍然呼叫了 openOfficialSheet');
    const modal = q('#log-view-modal');
    t.assert(modal && !modal.classList.contains('modal-hidden'), '沒有打開紀錄視窗');
  });

  await t('正式記錄表的內容與匯出紀錄相同', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('#official-sheet-btn'));
    await sleep(120);
    const shown = q('#log-view-text').textContent;
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const expected = gs.events.map(e => e.text).join('\n');
    t.assert(shown === expected, '內容不一致：\n' + shown + '\n---\n' + expected);
  });

  await t('紀錄視窗可以關掉回到 APP', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('#official-sheet-btn'));
    await sleep(120);
    click(w, q('#close-log-view-modal'));
    await sleep(120);
    t.assert(q('#log-view-modal').classList.contains('modal-hidden'), '視窗關不掉');
  });

  // === 使用者回報的欄位與分頁調整 ===
  await t('分頁改成兩隊各一頁，同一頁同時有打擊與投球', async () => {
    const { window: w, q } = await bootWithOnePlay();
    const tabs = [...w.document.querySelectorAll('#panel-tabs .panel-tab')].map(b => b.dataset.tab);
    t.assert(tabs.join(',') === 'log,situation,team-a,team-b', '分頁不對：' + tabs.join(','));
    click(w, q('.panel-tab[data-tab="team-a"]'));
    await sleep(120);
    t.assert(!!q('#pane-team-a .box-batting'), '客隊頁沒有打擊成績');
    t.assert(!!q('#pane-team-a .box-pitching'), '客隊頁沒有投球成績');
    t.assert(!q('#pane-team-a .box-batting ~ hr.team-separator'), '單隊頁不該有兩隊分隔線');
    click(w, q('.panel-tab[data-tab="team-b"]'));
    await sleep(120);
    t.assert(!!q('#pane-team-b .box-batting') && !!q('#pane-team-b .box-pitching'), '主隊頁缺表');
  });

  await t('分頁標籤用隊名', async () => {
    const { window: w, q } = await bootWithOnePlay();
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(q('.panel-tab[data-tab="team-a"]').textContent === gs.teams.a.name,
      '客隊標籤是「' + q('.panel-tab[data-tab="team-a"]').textContent + '」');
    t.assert(q('.panel-tab[data-tab="team-b"]').textContent === gs.teams.b.name, '主隊標籤不對');
  });

  await t('投手成績：面對打席緊接在局數後面', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('.panel-tab[data-tab="team-a"]'));
    await sleep(120);
    const ths = [...q('#pane-team-a .box-pitching thead').querySelectorAll('th')].map(x => x.textContent);
    t.assert(ths[1] === '局數' && ths[2] === '面對打席', '欄位順序：' + ths.join(','));
  });

  await t('打擊成績：高飛犧牲改叫犧飛，並多一欄犧短', async () => {
    const { window: w, q } = await bootWithOnePlay();
    click(w, q('.panel-tab[data-tab="team-a"]'));
    await sleep(120);
    const ths = [...q('#pane-team-a .box-batting thead').querySelectorAll('th')].map(x => x.textContent);
    t.assert(ths.includes('犧飛'), '沒有犧飛：' + ths.join(','));
    t.assert(!ths.includes('高飛犧牲'), '還留著高飛犧牲：' + ths.join(','));
    t.assert(ths[ths.indexOf('犧飛') + 1] === '犧短', '犧短沒有接在犧飛後面：' + ths.join(','));
    const tds = [...q('#pane-team-a .box-batting tbody tr').querySelectorAll('td')];
    t.assert(tds.length === ths.length, `欄數對不上：表頭 ${ths.length}、資料 ${tds.length}`);
  });

  await t('戰況表左右拖曳看不到捲軸', async () => {
    const css = await builtCss();
    t.assert(/\.table-scroll\b[^{]*\{[^}]*scrollbar-width:\s*none/.test(css) ||
             /scrollbar-width:\s*none/.test((css.match(/[^{}]*\.table-scroll[^{}]*\{[^}]*\}/g) || []).join(' ')),
      '.table-scroll 沒有隱藏捲軸');
    t.assert(/\.table-scroll::-webkit-scrollbar/.test(css), '.table-scroll 沒有隱藏 WebKit 捲軸');
  });

  await t('即時事件的局數與比賽開始放大加粗', async () => {
    const css = await builtCss();
    const rule = (css.match(/#event-log li\.ev-inning\{[^}]*\}/g) || []).join(' ');
    t.assert(/font-weight:\s*[78]00/.test(rule), '沒有加粗：' + rule);
    t.assert(/font-size:/.test(rule), '沒有放大：' + rule);
  });
}
