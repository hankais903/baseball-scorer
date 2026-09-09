// 戰況表分頁、替補列標示、表頭中文與橫向滑動
import { boot, click, startGame, clickZone } from './harness.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function playGame() {
  const { window: w, q } = await boot();
  w.alert = () => {}; w.confirm = () => true;
  click(w, q('.bench-add-btn[data-team="a"]'));
  const row = [...w.document.querySelectorAll('#team-a-bench .lineup-player')].find(r => !r.classList.contains('bench-hidden'));
  const ni = row.querySelector('input[data-type="name"]');
  ni.value = '代打王'; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(300);
  startGame(w);
  const field = (zone, play, taps = []) => {
    clickZone(w, zone);
    click(w, q(`#field-result-panel button[data-play="${play}"]`));
    const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'no');
    if (no) click(w, no);
    for (const d of taps) click(w, [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')].find(b => b.dataset.dir === d));
    click(w, q('#modal-advanced-done'));
  };
  field('outfield', '一安');
  field('outfield', '飛球', ['左']);
  field('infield', '滾地', ['捕', '一']);
  click(w, q('#quick-plays button[data-play="三振"]'));         // 1局上結束（4棒）
  click(w, q('#quick-plays button[data-play="三振"]'));         // 1局下 主隊
  click(w, q('#quick-plays button[data-play="三振"]'));
  click(w, q('#quick-plays button[data-play="三振"]'));
  click(w, q('#quick-plays button[data-play="三振"]'));         // 2局上 5棒 K
  // 6棒代打
  click(w, q('#management-btn'));
  // 守位圖：先點板凳籌碼，再點第 6 棒的守位節點，立即完成換人
  click(w, [...w.document.querySelectorAll('#management-container .def-chip[data-source="bench"]')].find(el => el.textContent.includes('代打王')));
  const gs0 = JSON.parse(w.localStorage.getItem('baseballGameState'));
  const id06 = gs0.teams.a.roster.find(p => p.name === '客隊球員06')._id;
  click(w, w.document.querySelector(`#management-container [data-player-id="${id06}"][data-source="field"]`));
  field('outfield', '二安');
  return { w, q };
}

export default async function (t) {
  await t('戰況表：每局一格、縮寫正確、合計列', async () => {
    const { w, q } = await playGame();
    click(w, q('.panel-tab[data-tab="situation"]'));
    const table = q('#pane-situation table');
    const heads = [...table.querySelectorAll('thead th')].map(x => x.textContent);
    t.assert(heads.slice(1, 10).join() === '1,2,3,4,5,6,7,8,9', '局數欄不對：' + heads.join());
    t.assert(heads.slice(10).join() === '打數,安打,全壘打,打點,得分,打擊率', '統計欄不對：' + heads.join());
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(x => x.textContent.trim()));
    t.assert(rows[0][1] === '一安' && rows[1][1] === '左飛' && rows[2][1] === '捕滾' && rows[3][1] === '三振', '第一局縮寫不對：' + rows.slice(0, 4).map(r => r[1]).join());
    t.assert(rows[4][2] === '三振', '第二局的三振沒有落在第 2 欄：' + rows[4].join('|'));
    const total = [...table.querySelectorAll('tfoot td')].map(x => x.textContent);
    t.assert(total[0] === 'Total' && total[10] === '6' && total[11] === '2', '合計不對：' + total.join('|'));
  });

  await t('戰況表：替補接在原球員下方，標示 (PH)，原球員紀錄保留', async () => {
    const { w, q } = await playGame();
    click(w, q('.panel-tab[data-tab="situation"]'));
    const rows = [...q('#pane-situation table').querySelectorAll('tbody tr')];
    const names = rows.map(r => r.querySelector('td').textContent.trim());
    const i6 = names.findIndex(n => n.startsWith('6'));
    t.assert(names[i6].includes('客隊球員06'), '第 6 棒不在：' + names[i6]);
    t.assert(names[i6 + 1].includes('代打王') && names[i6 + 1].includes('(PH)'), '代打沒有接在第 6 棒下方並標 (PH)：' + names[i6 + 1]);
    t.assert(rows[i6 + 1].classList.contains('substitute-row'), '替補列沒有縮排樣式');
    const subCells = [...rows[i6 + 1].querySelectorAll('td')].map(x => x.textContent.trim());
    t.assert(subCells[2] === '二安', '代打的二安沒有記在第 2 局：' + subCells.join('|'));
    t.assert(names.length === 10, `應有 9 位先發 + 1 位替補，共 ${names.length} 列`);
  });

  await t('打擊成績表：替補列標示 (PH)', async () => {
    const { w, q } = await playGame();
    click(w, q('.panel-tab[data-tab="batting"]'));
    const sub = q('#pane-batting tr.substitute-row td');
    t.assert(sub && sub.textContent.includes('代打王') && sub.textContent.includes('(PH)'), '打擊表替補列不對：' + (sub && sub.textContent));
  });

  await t('比賽中改名單不會洗掉替補歷史', async () => {
    const { w, q } = await playGame();
    const n8 = q('input[data-team="a"][data-index="8"][data-type="name"]');
    n8.value = '改九'; n8.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.lineupSpots[5].history.length === 2, '替補歷史被重建了');
    t.assert(gs.teams.a.roster.find(p => p._id === gs.teams.a.lineupSpots[5].activePlayerId).name === '代打王', '第 6 棒現任打者被換回原球員');
  });

  await t('表頭維持中文，手機以左右滑動看完整表格', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('.panel-tab[data-tab="pitching"]'));
    const heads = [...q('#pane-pitching table thead').querySelectorAll('th')].map(x => x.textContent);
    t.assert(heads.includes('三振') && heads.includes('死球') && heads.includes('四壞'), '表頭不是中文：' + heads.join());
    t.assert(!q('#pane-pitching .th-short'), '仍殘留縮寫表頭');
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/#pane-batting,#pane-pitching,#pane-situation\{overflow-x:auto/.test(css), '分頁沒有橫向滑動');
  });

  await t('戰況表縮寫：滾地／飛球依守位、平飛雙殺', async () => {
    const { window: w } = await boot();
    const L = w.__situationLabel;
    t.assert(L('滾地@游一#1') === '游滾', L('滾地@游一#1'));
    t.assert(L('飛球@中#3') === '中飛', L('飛球@中#3'));
    t.assert(L('雙殺@二游一~L#2') === '二平雙殺', L('雙殺@二游一~L#2'));
    t.assert(L('失誤@游#1') === '游失', L('失誤@游#1'));
    t.assert(L('觸身球#1') === '觸身' && L('野手選擇@游捕#4') === '野選', '其他縮寫不對');
  });

  await t('手指放在成績表上左右滑，是捲表格而不是切換面板', async () => {
    const { window: w, q } = await boot();
    w.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
    click(w, q('#play-ball-btn'));
    click(w, q('.panel-tab[data-tab="batting"]'));
    const pane = q('#pane-batting');
    Object.defineProperty(pane, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(pane, 'clientWidth', { value: 360, configurable: true });
    const td = pane.querySelector('td');
    const app = q('#app-container');
    app.style.transition = '';
    const touch = { clientX: 100, clientY: 100 };
    const ev = new w.Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'touches', { value: [touch] });
    td.dispatchEvent(ev);
    t.assert(app.style.transition !== 'none', '表格上的觸控被當成面板切換');
    // 對照組：在事件列表上滑動仍可切換面板
    click(w, q('.panel-tab[data-tab="log"]'));
    const ev2 = new w.Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ev2, 'touches', { value: [touch] });
    q('#event-log').dispatchEvent(ev2);
    t.assert(app.style.transition === 'none', '事件列表上的滑動應該切換面板');
  });

  await t('即時事件：左側壘況圖示（有人黃色）＋出局燈，敘述分兩行', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('#play-ball-btn'));
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="滾地"]'));
    click(w, q('#modal-advanced-done'));
    const li = q('#event-log li');
    const rects = [...li.querySelectorAll('.ev-sit svg rect')];
    t.assert(rects.length === 3, '壘包圖示應有三個方塊');
    t.assert(rects[2].classList.contains('on') && !rects[0].classList.contains('on') && !rects[1].classList.contains('on'), '一壘有人應只亮右下角');
    // 圖示是「打者上場打擊時」的狀況：一壘有人、0 出局（出局是這個打席才造成的）
    const outs = [...li.querySelectorAll('.ev-outs i')].filter(i => i.classList.contains('on')).length;
    t.assert(outs === 0, `出局燈應為 0 顆（打席前），亮了 ${outs}`);
    // 再打一個：這次圖示應顯示 1 出局
    click(w, q('#quick-plays button[data-play="三振"]'));
    const li2 = q('#event-log li');
    const outs2 = [...li2.querySelectorAll('.ev-outs i')].filter(i => i.classList.contains('on')).length;
    t.assert(outs2 === 1, `第二個打席前應為 1 出局，亮了 ${outs2}`);
    t.assert(li2.querySelector('.ev-body').textContent.endsWith('2人出局。'), '敘述應寫 2人出局：' + li2.querySelector('.ev-body').textContent);
    t.assert(/^第2棒 \S+ 客隊球員02$/.test(li.querySelector('.ev-title').textContent), '標題行不對：' + li.querySelector('.ev-title').textContent);
    t.assert(/滾地球.*封殺出局.*1人出局。$/.test(li.querySelector('.ev-body').textContent), '敘述行不對：' + li.querySelector('.ev-body').textContent);
    // 局數標題列不帶圖示
    const inningLi = [...w.document.querySelectorAll('#event-log li')].find(x => x.classList.contains('ev-inning'));
    t.assert(inningLi && !inningLi.querySelector('.ev-sit'), '局數列不該有圖示');
    // 事件快照有存進狀態
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const ev = gs.events[gs.events.length - 1];
    t.assert(Array.isArray(ev.bases) && ev.bases[0] === true && ev.outs === 1, '事件沒有存打席前的壘況與出局數：' + JSON.stringify(ev));
  });
}
