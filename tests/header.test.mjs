// 上方標題列（球場 / 日期 / 天氣）與計分板上隊名比分的回歸測試
import { boot, type, click, quickPlay } from './harness.mjs';

export default async function (t) {
  // 大比分列已移除（資訊與計分板重複），標題列只剩球場那一列
  await t('標題列只有球場列', async () => {
    const { q } = await boot();
    const rows = [...q('#game-info').children].map(c => c.id || c.tagName);
    t.assert(rows.join(',') === 'game-meta-row', rows.join(' → '));
    t.assert(!q('#game-info-center'), '大比分列應已移除');
  });

  await t('球場、日期、天氣在同一列', async () => {
    const { q } = await boot();
    t.assert(!!q('#game-meta-row #stadium-input'), '缺少球場');
    t.assert(!!q('#game-meta-row #game-date-input'), '缺少日期');
    t.assert(!!q('#game-meta-row #weather-input'), '缺少天氣');
  });

  await t('天氣有晴陰雨三個選項', async () => {
    const { q } = await boot();
    const opts = [...q('#weather-input').options].map(o => o.value);
    t.assert(opts.join(',') === 'sunny,cloudy,rainy', opts.join(','));
  });

  await t('天氣選擇會寫入存檔並還原', async () => {
    const { window: w, q } = await boot();
    const el = q('#weather-input');
    el.value = 'rainy';
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
    const saved = w.localStorage.getItem('baseballGameState');
    t.assert(saved && JSON.parse(saved).weather === 'rainy', '未寫入存檔');
    const again = await boot({ storage: { baseballGameState: saved } });
    t.assert(again.q('#weather-input').value === 'rainy', again.q('#weather-input').value);
  });

  await t('舊存檔缺天氣欄位仍可開啟', async () => {
    const { window: w, q } = await boot();
    type(w, q('#stadium-input'), '洲際棒球場');
    const st = JSON.parse(w.localStorage.getItem('baseballGameState'));
    delete st.weather;
    const r = await boot({ storage: { baseballGameState: JSON.stringify(st) } });
    t.assert(r.errors.length === 0, r.errors.join(' | '));
    t.assert(r.q('#weather-input').value === 'sunny', r.q('#weather-input').value);
    t.assert(r.q('#stadium-input').value === '洲際棒球場', r.q('#stadium-input').value);
  });

  // 隊名長度處理：曾因超過 2 字就擠壞版面
  await t('隊名輸入限制最多 4 字', async () => {
    const { q } = await boot();
    t.assert(q('#team-a-name').maxLength === 4, '目前上限 ' + q('#team-a-name').maxLength);
    t.assert(q('#team-b-name').maxLength === 4, '目前上限 ' + q('#team-b-name').maxLength);
  });

  await t('隊名 1–4 字都完整顯示在計分板', async () => {
    const { window: w, q } = await boot();
    for (const name of ['獅', '飛鷹', '中信兄', '統一獅隊']) {
      type(w, q('#team-a-name'), name);
      w.document.getElementById('apply-lineup')
        .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      const shown = q('#scoreboard tbody tr:first-child .scoreboard-team-cell span').textContent;
      t.assert(shown === name, `顯示為 ${shown}，應為 ${name}`);
    }
  });

  // 這項是為了抓「文字有設對、卻被 CSS 的 max-width 截成 ...」的情況。
  // em 單位的寬度上限會隨字級一起縮小，等於永遠放不下設定的字數。
  await t('隊名沒有會限制字數的寬度上限', async () => {
    const { window: w, q } = await boot();
    type(w, q('#team-a-name'), '最多四個');
    w.document.getElementById('apply-lineup')
      .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    // jsdom 不會計算 clamp()，改為直接檢查打包後的 CSS 是否含有寬度上限規則
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const cssFile = fs.readdirSync(dir).find(f => f.endsWith('.css'));
    const css = fs.readFileSync(path.join(dir, cssFile), 'utf8');
    const rules = css.match(/\.scoreboard-team-cell span[^{]*\{[^}]*\}/g) || [];
    const withMax = rules.filter(r => /max-width\s*:/.test(r));
    t.assert(withMax.length === 0,
      '隊名仍有寬度上限規則（會把字截斷）：' + withMax.join(' '));
  });

  await t('超過 4 字會被截斷而非撐破版面', async () => {
    const { window: w, q } = await boot();
    const input = q('#team-a-name');
    input.removeAttribute('maxlength');          // 模擬貼上或舊資料
    type(w, input, '一二三四五六七八');
    w.document.getElementById('apply-lineup')
      .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const shown = q('#scoreboard tbody tr:first-child .scoreboard-team-cell span').textContent;
    t.assert([...shown].length <= 4, `顯示 ${[...shown].length} 字：${shown}`);
  });

  // 大比分列拿掉之後，比分只剩計分板的 R 欄，必須看得出來誰領先
  await t('比分顯示在計分板的 R 欄', async () => {
    const { q } = await boot();
    const head = [...q('#scoreboard thead tr').children].map(c => c.textContent);
    t.assert(head.slice(-3).join(',') === 'R,H,E', head.join(','));
    const totals = [...q('#scoreboard tbody').querySelectorAll('td.total-col')];
    t.assert(totals.length === 2, '應有兩隊的 R 欄，實得 ' + totals.length);
    t.assert(totals.every(td => td.textContent === '0'), '開賽前比分應為 0');
  });

  await t('兩隊隊名長短不同都各自顯示正確', async () => {
    const { window: w, q } = await boot();
    const cell = i => q(`#scoreboard tbody tr:nth-child(${i}) .scoreboard-team-cell span`).textContent;
    for (const [a, b] of [['獅', '統一獅隊'], ['統一獅隊', '獅'], ['飛鷹', '中信兄']]) {
      type(w, q('#team-a-name'), a);
      type(w, q('#team-b-name'), b);
      w.document.getElementById('apply-lineup')
        .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      t.assert(cell(1) === a, cell(1));
      t.assert(cell(2) === b, cell(2));
    }
  });

  // 使用者要求：4 字要和 2 字一樣大，所以不能有依字數縮小的規則
  // （舊版靠 #info-team-x[data-len] 縮字級，隨大比分列一起移除）
  await t('隊名字級不因字數而縮小', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const css = fs.readFileSync(path.join(dir,
      fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
    const shrink = (css.match(/\[data-len[^{]*\{[^}]*font-size[^}]*\}/g) || []);
    t.assert(shrink.length === 0, '仍有依字數縮小的規則：' + shrink.join(' '));
  });

  await t('已啟用全版面與安全區設定', async () => {
    const { window: w } = await boot();
    const vp = w.document.querySelector('meta[name="viewport"]').content;
    t.assert(vp.includes('viewport-fit=cover'), vp);
  });

  await t('主頁滿版球場：計分板全顯示、打者卡片維持原樣、順序為球場→快捷→功能鈕', async () => {
    const { window: w, q } = await boot();
    t.assert(!q('#scoreboard').classList.contains('collapsed'), '計分板不該收合');
    t.assert(q('#scoreboard-header-row').querySelectorAll('th').length >= 13, '計分板沒有顯示全部局數');
    click(w, q('#play-ball-btn'));
    t.assert(!!q('#current-batter-display .batter-stats'), '打者卡片數據應直接顯示');
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/#game-state-display\{[^}]*aspect-ratio:370 ?\/ ?425/.test(css), '球場沒有改成滿版');
    t.assert(/#main-content>#game-state-container\{order:3\}/.test(css) && /#main-content>\.main-actions-container\{order:5\}/.test(css), '底部順序不對');
  });

  await t('PLAY BALL：開賽前球場壓暗、按鈕為黃色膠囊；開賽後恢復', async () => {
    const { window: w, q } = await boot();
    t.assert(q('#game-state-display').classList.contains('pregame'), '開賽前球場沒有壓暗標記');
    t.assert(q('#play-ball-btn .pb-main').textContent === 'PLAY BALL' && q('#play-ball-btn .pb-sub').textContent.includes('開始'), '按鈕文字不對');
    click(w, q('#play-ball-btn'));
    t.assert(!q('#game-state-display').classList.contains('pregame'), '開賽後壓暗沒有解除');
    t.assert(q('#play-ball-btn').classList.contains('hidden'), '開賽後 PLAY BALL 沒有消失');
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/#play-ball-btn\{[^}]*background:#fbbf24/.test(css), 'PLAY BALL 不是黃色膠囊');
    t.assert(/#game-state-display\.pregame:after\{[^}]*background:(?:rgba\(0,0,0,\.55\)|#0000008c)/.test(css), '沒有壓暗層');
  });

  await t('PLAY BALL 單行、副標含「並開始計時」；開賽後計時出現在右上，局數標籤置中', async () => {
    const { window: w, q } = await boot();
    t.assert(q('#play-ball-btn .pb-sub').textContent === '點此開始比賽並開始計時', '副標不對');
    t.assert(!q('#game-clock').classList.contains('hidden'), '開賽前計時器就要看得到');
    t.assert(q('#game-clock').textContent === '00:00', '開賽前應停在 00:00：' + q('#game-clock').textContent);
    click(w, q('#play-ball-btn'));
    t.assert(!q('#game-clock').classList.contains('hidden'), '開賽後計時沒出現');
    t.assert(/^\d\d:\d\d$/.test(q('#game-clock').textContent), '計時格式不對：' + q('#game-clock').textContent);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(typeof gs.startTime === 'number', '開賽時間沒存檔');
    t.assert(w.__formatElapsed(65000) === '01:05' && w.__formatElapsed(3725000) === '1:02:05', '時間格式化錯');
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/\.pb-main\{[^}]*white-space:nowrap/.test(css), 'PLAY BALL 沒有禁止換行');
  });

  // 版號顯示在主頁標題右邊，每次交付都要往上加
  await t('標題右邊有版號', async () => {
    const { q } = await boot();
    const el = q('#app-version');
    t.assert(!!el, '標題旁沒有版號');
    t.assert(/^v\d+(\.\d+)+$/.test(el.textContent.trim()), '版號格式不對：' + el.textContent);
    t.assert(el.closest('.brand-text .brand-version, .brand-text') || el.closest('.stadium-toolbar'),
      '版號沒有放在標題列裡');
  });

  // 反白的是「正在進行的那個半局」那一格，不是隊名、也不是 R 欄
  await t('反白的是正在進行的那個半局的格子', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await new Promise(r => setTimeout(r, 150));
    const lit = () => [...w.document.querySelectorAll('#scoreboard tbody tr')].map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      return cells.findIndex(td => td.classList.contains('team-batting'));
    });
    // 1 局上：客隊（第一列）第 1 局那一格（第 0 欄是隊名，所以索引 1）
    t.assert(lit().join() === '1,-1', '1局上反白的位置不對：' + lit().join());
    t.assert(!q('#scoreboard td.team-col.team-batting'), '隊名欄不該反白');
    t.assert(!q('#scoreboard td.total-col.team-batting'), 'R 欄不該反白');
    // 換到 1 局下，反白要跟著換到主隊那一列
    for (let i = 0; i < 3; i++) quickPlay(w, '三振');
    await new Promise(r => setTimeout(r, 200));
    t.assert(lit().join() === '-1,1', '換半局後反白沒有跟著走：' + lit().join());
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/td\.inning-now\.team-batting\{/.test(css), '樣式沒有跟著搬到半局那一格');
  });

  // OUT／局數／計時搬到打者卡旁邊（原本 NEXT 的位置）：上排局數、下排 OUT 與計時
  await t('OUT、局數、計時在打者卡旁邊那一格', async () => {
    const { q } = await boot();
    const bar = q('#status-bar');
    t.assert(!!bar, '找不到 OUT／局數／計時那一格');
    t.assert(bar.parentElement.id === 'batter-row', '沒有放在打者卡旁邊：' + bar.parentElement.id);
    t.assert(!q('#next-batters'), 'NEXT 應該已經移除');
    for (const id of ['sbo-display', 'inning-display', 'game-clock']) {
      t.assert(!!bar.querySelector('#' + id), id + ' 不在那一格裡');
    }
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    const rule = (css.match(/#status-bar\{[^}]*\}/g) || []).join(' ');
    t.assert(/grid-template-rows:\s*auto auto/.test(rule), '不是上下兩排：' + rule);
    const inn = (css.match(/#status-bar #inning-display\{[^}]*\}/g) || []).join(' ');
    t.assert(/grid-row:\s*1/.test(inn) && /grid-column:\s*1\s*\/\s*-1/.test(inn), '局數沒有自己一排：' + inn);
  });

  await t('上半局標▲、下半局標▼', async () => {
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    // 壓縮後屬性值的引號會被拿掉、::before 會變成 :before
    t.assert(/data-half=.?top.?\]:?:?before\{content:"▲ /.test(css), '上半局沒有三角形');
    t.assert(/data-half=.?bottom.?\]:?:?before\{content:"▼ /.test(css), '下半局沒有倒三角形');
    const { q } = await boot();
    t.assert(q('#inning-display').dataset.half === 'top', '開賽是上半局，記號卻是 ' + q('#inning-display').dataset.half);
  });

  // 日期改成中文字樣＋左右箭頭前後一天
  await t('日期顯示成中文，左右箭頭可前後一天', async () => {
    const { window: w, q } = await boot();
    q('#game-date-input').value = '2026-09-11';
    q('#game-date-input').dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(q('#date-text').textContent === '2026年9月11日 (五)', '日期字樣不對：' + q('#date-text').textContent);
    click(w, q('#date-next'));
    t.assert(q('#game-date-input').value === '2026-09-12', '往後一天失敗：' + q('#game-date-input').value);
    t.assert(q('#date-text').textContent === '2026年9月12日 (六)', '日期字樣沒跟著換：' + q('#date-text').textContent);
    click(w, q('#date-prev'));
    click(w, q('#date-prev'));
    t.assert(q('#game-date-input').value === '2026-09-10', '往前一天失敗：' + q('#game-date-input').value);
    t.assert(JSON.parse(w.localStorage.getItem('baseballGameState')).gameDate === '2026-09-10', '日期沒寫進存檔');
  });

  // 球場右邊的箭頭：列出用過的球場，選了就填回去
  await t('球場會記住用過的名字，可以從箭頭選回來', async () => {
    const { window: w, q } = await boot();
    const input = q('#stadium-input');
    type(w, input, '洲際棒球場');
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    click(w, q('#stadium-history-btn'));
    const items = [...w.document.querySelectorAll('.stadium-history-item')].map(b => b.textContent);
    t.assert(items.includes('洲際棒球場'), '沒記住用過的球場：' + items.join(','));
    type(w, input, '天母');
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    click(w, q('#stadium-history-btn'));   // 先收起來
    click(w, q('#stadium-history-btn'));   // 再打開才會重新列一次
    const again = [...w.document.querySelectorAll('.stadium-history-item')].map(b => b.textContent);
    t.assert(again[0] === '天母' && again.includes('洲際棒球場'), '順序或內容不對：' + again.join(','));
    click(w, w.document.querySelectorAll('.stadium-history-item')[1]);
    t.assert(input.value === '洲際棒球場', '選了沒填回去：' + input.value);
    t.assert(q('#stadium-history').classList.contains('modal-hidden'), '選完沒收起來');
  });
}
