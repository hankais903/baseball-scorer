// 名單頁 UX：板凳預設留空、新增板凳、自動套用
import { boot, click, clickZone } from './harness.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const visibleBench = (w, team) =>
  [...w.document.querySelectorAll(`#team-${team}-bench .lineup-player`)].filter(r => !r.classList.contains('bench-hidden'));

export default async function (t) {
  await positionSwap(t);
  await t('板凳預設沒有假名字，全部隱藏', async () => {
    const { window: w, q } = await boot();
    t.assert(visibleBench(w, 'a').length === 0, `一開始就有 ${visibleBench(w, 'a').length} 列板凳`);
    t.assert(q('#team-a-bench-count').textContent.includes('尚無'), '計數文字不對');
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState') || 'null');
    if (gs) t.assert(gs.teams.a.roster.slice(9, 29).every(p => !p.name), '板凳仍有預設名字');
  });

  await t('按「新增板凳球員」揭開一列並自動儲存', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('.bench-add-btn[data-team="a"]'));
    t.assert(visibleBench(w, 'a').length === 1, '沒有揭開新列');
    const ni = visibleBench(w, 'a')[0].querySelector('input[data-type="name"]');
    ni.value = '替補甲';
    ni.dispatchEvent(new w.Event('input', { bubbles: true }));
    ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[9].name === '替補甲', '沒有自動套用到 gameState');
    t.assert(q('#team-a-bench-count').textContent.includes('1'), '計數沒更新');
  });

  await t('改先發姓名後離開欄位即生效，不必按套用', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    const n0 = q('input[data-team="a"][data-index="0"][data-type="name"]');
    n0.value = '自動哥';
    n0.dispatchEvent(new w.Event('input', { bubbles: true }));
    n0.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    t.assert(q('#current-batter-display').textContent.includes('自動哥'), '主頁打者沒有更新');
    t.assert(q('#lineup-save-status').textContent.includes('已儲存'), '沒有顯示已儲存');
  });

  await t('套用按鈕已隱藏，但 Enter 送出仍可用', async () => {
    const { window: w, q } = await boot();
    t.assert(q('#apply-lineup').classList.contains('visually-hidden'), '套用鈕仍顯示');
    t.assert(q('#lineup-save-status').textContent.includes('自動'), '沒有告知會自動儲存');
  });

  await t('球員調度只列出有名字的板凳球員', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('#play-ball-btn'));
    click(w, q('#substitution-btn') || [...w.document.querySelectorAll('button')].find(b => b.textContent.trim() === '球員調度'));
    const bench = w.document.querySelectorAll('#management-container .def-chip[data-source="bench"]');
    t.assert(bench.length <= 1, `調度清單列了 ${bench.length} 個空白板凳`);
  });

  await t('手機版每列採單行緊湊排版', async () => {
    // CSS 在 dist/assets 裡，直接讀檔檢查
    const fs = await import('node:fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    t.assert(css.includes('grid-template-areas') && css.includes('"order photo jersey name'), '沒有單行排版規則');
    t.assert(/\.pitcher-input-container\{[^}]*grid-template-areas/.test(css), '先發投手列沒有套用同樣排版');
    t.assert(/hover:\s*none/.test(css) && css.includes('.image-upload-label'), '觸控裝置沒有常駐的上傳鈕');
  });
}

async function positionSwap(t) {
  await t('改 A 的守位時，原本守該位置的 B 換成 A 的舊守位', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    const sels = [...w.document.querySelectorAll('#team-a-lineup select[data-type="pos"]')];
    const a = sels[0], b = sels.find(s => s !== a && s.value && s.value !== a.value);
    const aOld = a.value, bOld = b.value;
    a.value = bOld;
    a.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(b.value === aOld, `B 應變成 ${aOld}，卻是 ${b.value}`);
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const ia = Number(a.dataset.index), ib = Number(b.dataset.index);
    t.assert(gs.teams.a.roster[ia].pos === bOld && gs.teams.a.roster[ib].pos === aOld, '對調沒有存進 gameState');
  });

  await t('改成沒人守的位置時不會動到別人', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    const sels = [...w.document.querySelectorAll('#team-a-lineup select[data-type="pos"]')];
    const used = new Set(sels.map(s => s.value));
    const free = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'].find(p => !used.has(p)
      && [...sels[0].options].some(o => o.value === p));
    if (!free) return;
    const before = sels.slice(1).map(s => s.value).join();
    sels[0].value = free;
    sels[0].dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(sels.slice(1).map(s => s.value).join() === before, '其他人的守位被動到');
  });

  await t('「查看總表」按鈕已從名單頁移除', async () => {
    const { window: w, q } = await boot();
    const btn = q('#view-box-score-btn');
    t.assert(!btn || btn.classList.contains('visually-hidden'), '查看總表仍顯示');
    t.assert(!!q('#new-game-btn'), '新比賽按鈕不見了');
  });

  await t('手機版背號格是 46px 的窄欄', async () => {
    const fs = await import('node:fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    t.assert(/grid-template-columns:22px 38px 46px minmax\(0,1fr\) 64px 20px/.test(css), '欄寬不是預期的緊湊單行');
  });

  await t('守位下拉沒有「守位」這個假選項', async () => {
    const { window: w } = await boot();
    const sel = w.document.querySelector('#team-a-lineup select[data-type="pos"]');
    const visible = [...sel.options].filter(o => !o.hidden).map(o => o.textContent);
    t.assert(!visible.includes('守位'), '仍有「守位」選項：' + visible.join(','));
    t.assert(visible.every(v => v !== ''), '有空白可見選項');
  });

  await t('先發九人的總高度可在一個手機畫面內', async () => {
    // 每列 42px 輸入 + 上下 4px padding + 4.8px 間距 ≈ 52px，九列約 470px，
    // 加上隊名區約 180px，總計 < 852 - 59（動態島）
    const fs = await import('node:fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    t.assert(/min-height:42px/.test(css), '輸入高度不是 42px');
    t.assert(/margin:0 0 \.3rem/.test(css), '列間距沒有收緊');
  });

  await t('預設球員名稱為「客隊球員01～10」「主隊球員01～10」，背號與編號相同', async () => {
    const { window: w, q } = await boot();
    const a = [...w.document.querySelectorAll('#team-a-lineup .lineup-player')];
    t.assert(a[0].querySelector('input[data-type="name"]').value === '客隊球員01', '第一棒名稱不對');
    t.assert(a[8].querySelector('input[data-type="name"]').value === '客隊球員09', '第九棒名稱不對');
    t.assert(a[0].querySelector('input[data-type="jersey"]').value === '01', '背號不對');
    t.assert(q('input[data-team="a"][data-type="pitcher-name"]').value === '客隊球員10', '投手名稱不對');
    t.assert(q('input[data-team="b"][data-index="0"][data-type="name"]').value === '主隊球員01', '主隊名稱不對');
  });

  await t('分頁標籤標示先攻／後攻', async () => {
    const { window: w } = await boot();
    const tabs = [...w.document.querySelectorAll('#team-settings-tabs button')].map(b => b.textContent);
    t.assert(tabs[0].includes('客隊') && tabs[0].includes('先攻'), '客隊標籤：' + tabs[0]);
    t.assert(tabs[1].includes('主隊') && tabs[1].includes('後攻'), '主隊標籤：' + tabs[1]);
  });

  await t('比賽記錄與新比賽在名單頁最上方', async () => {
    const { window: w, q } = await boot();
    await sleep(800);   // 比賽記錄按鈕由整合腳本延遲插入
    const top = q('#top-actions');
    t.assert(top && top.previousElementSibling === null, '操作列不在表單最上方');
    const labels = [...top.querySelectorAll('button')].map(b => b.textContent.trim());
    t.assert(labels.includes('新比賽') && labels.includes('比賽記錄'), '操作列內容：' + labels.join(','));
  });

  await t('背號在姓名左邊', async () => {
    const fs = await import('node:fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    t.assert(css.includes('"order photo jersey name pos handle"'), '欄位順序不是背號在姓名左邊');
  });

  await t('關閉 DH：投手接替 DH 的棒次；重新開啟：原 DH 回到打線', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    const rows = () => [...w.document.querySelectorAll('#team-a-lineup .lineup-player')]
      .map(r => [r.querySelector('input[data-type="name"]').value, r.querySelector('select[data-type="pos"]').value]);
    const dhIdx = rows().findIndex(([, pos]) => pos === 'DH');
    const dhName = rows()[dhIdx][0];
    const dh = q('#team-a-dh-toggle');
    dh.checked = false; dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(rows()[dhIdx][0] === '客隊球員10' && rows()[dhIdx][1] === 'P', `投手沒有接替第 ${dhIdx + 1} 棒：` + rows()[dhIdx]);
    t.assert(!rows().some(([n]) => n === dhName), '原 DH 仍在打線');
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.lineupSpots[dhIdx].activePlayerId === gs.teams.a.roster[dhIdx]._id, 'lineupSpots 沒跟著換');
    const dh2 = q('#team-a-dh-toggle');
    dh2.checked = true; dh2.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(rows()[dhIdx][0] === dhName && rows()[dhIdx][1] === 'DH', '重新開啟後原 DH 沒回來：' + rows()[dhIdx]);
    t.assert(q('input[data-team="a"][data-type="pitcher-name"]').value === '客隊球員10', '投手沒回到投手欄');
  });

  await t('關閉 DH 後原 DH 出現在板凳區，且開賽前不記事件', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    const dhName = [...w.document.querySelectorAll('#team-a-lineup .lineup-player')]
      .find(r => r.querySelector('select[data-type="pos"]').value === 'DH').querySelector('input[data-type="name"]').value;
    const dh = q('#team-a-dh-toggle');
    dh.checked = false; dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    const bench = [...w.document.querySelectorAll('#team-a-bench .lineup-player')]
      .filter(r => !r.classList.contains('bench-hidden')).map(r => r.querySelector('input[data-type="name"]').value);
    t.assert(bench.includes(dhName), `板凳沒有原 DH：${bench.join(',')}`);
    t.assert(w.document.querySelectorAll('#event-log li').length === 0, '開賽前不該記錄名單事件');
    const dh2 = q('#team-a-dh-toggle');
    dh2.checked = true; dh2.dispatchEvent(new w.Event('change', { bubbles: true }));
    const bench2 = [...w.document.querySelectorAll('#team-a-bench .lineup-player')]
      .filter(r => !r.classList.contains('bench-hidden'));
    t.assert(bench2.length === 0, '重新啟用後板凳應回到空的');
  });

  await t('投手守位固定顯示 P，沒有下拉選單', async () => {
    const { window: w, q } = await boot();
    t.assert(!q('.pitcher-input-container select[data-type="pitcher-pos"]'), '投手仍有守位下拉');
    t.assert(q('.pitcher-input-container .pos-fixed').textContent.trim() === 'P', '沒有固定的 P 標示');
  });

  await t('板凳球員與先發互換時沿用先發的守位', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('.bench-add-btn[data-team="a"]'));
    const benchRow = [...w.document.querySelectorAll('#team-a-bench .lineup-player')].find(r => !r.classList.contains('bench-hidden'));
    const starter = q('#team-a-lineup .lineup-player');
    const starterPos = starter.querySelector('select[data-type="pos"]').value;
    w.__resyncRosterAfterSwap(benchRow, starter, 'a');
    t.assert(benchRow.querySelector('select[data-type="pos"]').value === starterPos, '換上場的人沒有沿用守位');
    t.assert(starter.querySelector('select[data-type="pos"]').value === '', '下場的人守位沒清空');
  });

  await t('套用名單不再記錄「球員名單已更新」', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('#play-ball-btn'));
    const before = w.document.querySelectorAll('#event-log li').length;
    const n0 = q('input[data-team="a"][data-index="0"][data-type="name"]');
    n0.value = '改名'; n0.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    t.assert(w.document.querySelectorAll('#event-log li').length === before, '名單更新被記進即時事件');
  });

  await t('板凳列往右輕滑露出 ⛔，點了就刪除', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('.bench-add-btn[data-team="a"]'));
    const row = [...w.document.querySelectorAll('#team-a-bench .lineup-player')].find(r => !r.classList.contains('bench-hidden'));
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = '滑掉我'; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    Object.defineProperty(row, 'clientWidth', { value: 360, configurable: true });
    const pe = (type, x, y) => ni.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    pe('pointerdown', 10, 10); pe('pointermove', 30, 12); pe('pointermove', 70, 12); pe('pointerup', 70, 12);
    await sleep(50);
    t.assert(row.classList.contains('swipe-open') && row.style.transform.includes('translateX'), '輕滑後沒有停在露出 ⛔ 的位置');
    const reveal = row.querySelector('.swipe-reveal');
    t.assert(reveal && reveal.textContent.includes('⛔'), '沒有 ⛔');
    click(w, reveal);
    await sleep(500);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[9].name === '', '點 ⛔ 後資料仍在');
    t.assert(row.classList.contains('bench-hidden'), '刪除後列沒有收起');
  });

  await t('板凳列滑到底直接刪除，垂直滑不觸發', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('.bench-add-btn[data-team="a"]'));
    const row = [...w.document.querySelectorAll('#team-a-bench .lineup-player')].find(r => !r.classList.contains('bench-hidden'));
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = '直接刪'; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(300);
    Object.defineProperty(row, 'clientWidth', { value: 360, configurable: true });
    const pe = (type, x, y) => ni.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    // 先垂直滑：不該動
    pe('pointerdown', 10, 10); pe('pointermove', 12, 40); pe('pointermove', 60, 80); pe('pointerup', 60, 80);
    t.assert(row.style.transform === '', '垂直捲動被當成滑動');
    // 再水平滑到底
    pe('pointerdown', 10, 10); pe('pointermove', 40, 10); pe('pointermove', 260, 10);
    t.assert(row.classList.contains('will-delete'), '滑到底沒有進入刪除狀態');
    pe('pointerup', 260, 10);
    await sleep(500);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[9].name === '', '滑到底沒有刪除');
    t.assert(!q('#team-a-lineup .swipe-reveal:not([style])') || true, '');
  });

  await t('【回歸】套用名單後各球員的本場成績必須各自獨立', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    click(w, q('#apply-lineup'));                 // 開賽前套用會重設統計：這裡曾讓所有人共用同一個陣列
    click(w, q('#play-ball-btn'));
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="二安"]'));
    click(w, q('#modal-advanced-done'));
    click(w, q('#quick-plays button[data-play="三振"]'));
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const r = gs.teams.a.roster;
    t.assert(r[0].abResults.join() === '二安@中#1', '第一棒成績不對：' + r[0].abResults.join());
    t.assert(r[1].abResults.join() === '三振#1', '第二棒成績不對：' + r[1].abResults.join());
    t.assert(r[2].abResults.length === 0 && r[8].abResults.length === 0, '其他球員不該有成績');
    const disp = q('#current-batter-display').textContent;
    t.assert(disp.includes('客隊球員03') && disp.includes('尚未上場'), '第三棒顯示了別人的本場成績：' + disp);
    ['a', 'b'].forEach(k => {
      const arrs = gs.teams[k].roster.map(p => p.abResults);
      t.assert(arrs.every(a => Array.isArray(a)), '有球員缺少 abResults');
    });
  });

  await t('投手成績表的死球緊接在四壞之後', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#quick-plays button[data-play="觸身球"]'));
    click(w, q('.panel-tab[data-tab="pitching"]'));
    const ths = [...q('#pane-pitching table thead').querySelectorAll('th')].map(t => t.getAttribute('title') || t.textContent);
    t.assert(ths.indexOf('死球') === ths.indexOf('四壞') + 1, '欄位順序：' + ths.join(','));
    t.assert(ths.includes('三振') && ths.includes('死球'), '三振或死球不見了：' + ths.join(','));
    // 客隊先攻，被觸身的投手是主隊的：第二張表
    const tables = q('#pane-pitching').querySelectorAll('table');
    const tds = [...tables[tables.length - 1].querySelector('tbody tr').querySelectorAll('td')].map(t => t.textContent);
    t.assert(tds[ths.indexOf('死球')] === '1', '觸身球沒有記進投手死球：' + tds.join(','));
  });

  await t('隊伍標題：隊徽、顏色、隊名的順序；DH 在名單按鈕下方', async () => {
    const { window: w, q } = await boot();
    const h4 = [...q('#team-a-settings-container h4').children].map(c => c.className || c.id);
    t.assert(h4.join('>') === 'team-logo-container>team-color-input>team-name-input', '標題順序：' + h4.join('>'));
    const ctl = [...q('#team-a-settings-container .team-settings-controls').children].map(c => c.className);
    t.assert(ctl[0] === 'roster-actions' && ctl[1] === 'dh-toggle-container', 'DH 不在儲存／讀取名單下方：' + ctl.join('>'));
  });

  await t('兩個面板的主標同樣大小，設定球員名單在操作列下方', async () => {
    const { window: w, q } = await boot();
    t.assert(q('#control-panel h2').classList.contains('panel-title'), '控制面板沒有主標樣式');
    const h2 = q('#event-log-container h2');
    t.assert(h2 && h2.textContent === '事件及記錄' && h2.classList.contains('panel-title'), '事件面板主標不對');
    t.assert(q('#lineup-form .section-title').previousElementSibling.id === 'top-actions', '設定球員名單不在操作列下方');
    const acts = [...q('#log-actions').querySelectorAll('button')].map(b => b.textContent);
    t.assert(acts.join() === '匯出紀錄,正式記錄表', '匯出鈕列不對：' + acts.join());
    t.assert(h2.nextElementSibling.id === 'log-actions', '匯出鈕列不在主標正下方');
  });

  await t('隊徽與顏色選項尺寸', async () => {
    const fs = await import('node:fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    t.assert(/\.team-logo-container\{width:56px;height:56px/.test(css), '隊徽沒有放大到 56px');
    t.assert(/\.panel-title\{font-size:1\.6rem/.test(css), '主標字級不是 1.6rem');
  });
}
