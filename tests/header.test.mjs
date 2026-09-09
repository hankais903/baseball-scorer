// 上方標題列（球場 / 日期 / 天氣 / 比數）的回歸測試
import { boot, type, click } from './harness.mjs';

export default async function (t) {
  await t('標題列結構為兩層', async () => {
    const { q } = await boot();
    const rows = [...q('#game-info').children].map(c => c.id || c.tagName);
    t.assert(rows.join(',') === 'game-meta-row,game-info-center', rows.join(' → '));
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

  await t('隊名 1–4 字都完整顯示', async () => {
    const { window: w, q } = await boot();
    for (const [name, expect] of [['獅', '1'], ['飛鷹', '2'], ['中信兄', '3'],
                                  ['統一獅隊', '4']]) {
      type(w, q('#team-a-name'), name);
      w.document.getElementById('apply-lineup')
        .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      const el = q('#info-team-a');
      t.assert(el.textContent === name, `顯示為 ${el.textContent}，應為 ${name}`);
      t.assert(el.dataset.len === expect, `${name} 標記為 ${el.dataset.len}，應為 ${expect}`);
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
    const rules = css.match(/#game-info-center #info-team-[ab][^{]*\{[^}]*\}/g) || [];
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
    const shown = q('#info-team-a').textContent;
    t.assert([...shown].length <= 4, `顯示 ${[...shown].length} 字：${shown}`);
  });

  // 中間的比數與局數必須永遠置中，不能因隊名長短而左右偏移。
  // 做法是三欄格線（1fr auto 1fr），兩側等寬、中間自動置中。
  await t('比數與局數固定置中', async () => {
    const { q } = await boot();
    const group = q('#info-score-group');
    t.assert(!!group, '缺少中間的比數群組');
    const ids = [...group.children].map(c => c.id);
    t.assert(ids.join(',') === 'info-score-a,info-status,info-score-b', ids.join(' → '));
    const cols = [...q('#game-info-center').children].map(c => c.id);
    t.assert(cols.join(',') === 'info-team-a,info-score-group,info-team-b', cols.join(' → '));

    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const css = fs.readFileSync(path.join(dir,
      fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
    const rule = (css.match(/#game-info-center\{[^}]*\}/g) || []).join(' ');
    t.assert(/grid-template-columns:\s*1fr auto 1fr/.test(rule),
      '不是 1fr auto 1fr 的三欄格線：' + rule);
  });

  await t('隊名長度不同時中間組仍置中', async () => {
    const { window: w, q } = await boot();
    for (const [a, b] of [['獅', '統一獅隊'], ['統一獅隊', '獅'], ['飛鷹', '中信兄']]) {
      type(w, q('#team-a-name'), a);
      type(w, q('#team-b-name'), b);
      w.document.getElementById('apply-lineup')
        .dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      // 兩側都是 1fr，寬度必定相等，中間組因此保持置中
      t.assert(q('#info-team-a').textContent === a, q('#info-team-a').textContent);
      t.assert(q('#info-team-b').textContent === b, q('#info-team-b').textContent);
      t.assert(!!q('#info-score-group'), '比數群組消失');
    }
  });

  // 使用者要求：4 字要和 2 字一樣大，所以不能再有依字數縮小的規則
  await t('隊名字級不因字數而縮小', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const css = fs.readFileSync(path.join(dir,
      fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
    const shrink = (css.match(/#info-team-[ab]\[data-len[^{]*\{[^}]*font-size[^}]*\}/g) || []);
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
    t.assert(/#main-content>#quick-plays\{order:3\}/.test(css) && /#main-content>\.main-actions-container\{order:4\}/.test(css), '底部順序不對');
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
    t.assert(q('#game-clock').classList.contains('hidden'), '開賽前不該顯示計時');
    click(w, q('#play-ball-btn'));
    t.assert(!q('#game-clock').classList.contains('hidden'), '開賽後計時沒出現');
    t.assert(/^\d\d:\d\d$/.test(q('#game-clock').textContent), '計時格式不對：' + q('#game-clock').textContent);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(typeof gs.startTime === 'number', '開賽時間沒存檔');
    t.assert(w.__formatElapsed(65000) === '01:05' && w.__formatElapsed(3725000) === '1:02:05', '時間格式化錯');
    const fs = await import('node:fs');
    const css = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
    t.assert(/#game-clock\{[^}]*right:20px/.test(css), '計時沒放在右上角');
    t.assert(/#inning-display\{[^}]*left:50%/.test(css), '局數標籤沒有置中');
    t.assert(/\.pb-main\{[^}]*white-space:nowrap/.test(css), 'PLAY BALL 沒有禁止換行');
  });
}
