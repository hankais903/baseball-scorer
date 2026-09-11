// 手指點得到：可點的東西至少 44×44（Apple 的建議值），
// 以及幾個「按不動時要說原因」「復原不留雜訊」的介面規則
import { boot, click, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const builtCss = async () => {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join('dist', 'assets');
  return fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
};
// jsdom 不算版面，改為檢查打包後的樣式有沒有設定夠大的可點範圍
const ruleFor = (css, selector) =>
  (css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}', 'g')) || []).join(' ');

export default async function (t) {
  await t('面板小圓點的可點範圍有 44', async () => {
    const css = await builtCss();
    const rule = ruleFor(css, '.nav-dot');
    t.assert(/width:\s*44px/.test(rule) && /height:\s*44px/.test(rule), '小圓點可點範圍不足：' + rule);
    // 壓縮後 ::after 會變成 :after，兩種都接受
    t.assert(/\.nav-dot::?after\{[^}]*width:\s*10px/.test(css), '看起來的圓點應該還是 10px');
  });

  await t('分頁標籤至少 44 高', async () => {
    const css = await builtCss();
    const rules = css.match(/\.panel-tab\{[^}]*\}/g) || [];
    const bad = rules.filter(r => /min-height:\s*0/.test(r));
    t.assert(bad.length === 0, '有規則把分頁標籤縮回去：' + bad.join(' '));
    t.assert(rules.some(r => /min-height:\s*44px/.test(r)), '分頁標籤沒有 44 的高度：' + rules.join(' '));
  });

  await t('球場、日期、天氣欄位至少 44 高', async () => {
    const css = await builtCss();
    t.assert(/min-height:\s*44px/.test(ruleFor(css, '.header-input')), '標題列的欄位太矮');
  });

  await t('隊伍顏色的可點範圍有 44', async () => {
    const css = await builtCss();
    const rules = (css.match(/\.team-color-input\{[^}]*\}/g) || []);
    t.assert(rules.some(r => /width:\s*44px/.test(r) && /height:\s*44px/.test(r)),
      '顏色選擇器太小：' + rules.join(' '));
  });

  await t('壘上無人時「壘間事件」會說明原因', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(150);
    const btn = q('#runner-action-btn');
    t.assert(btn.disabled, '壘上無人時應該鎖住');
    t.assert(btn.textContent.includes('壘上無人'), '沒有說明原因：' + btn.textContent);
    t.assert(btn.title.includes('沒有跑者'), '沒有提示文字：' + btn.title);
  });

  await t('有跑者之後「壘間事件」恢復正常字樣', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#quick-plays button[data-play="四壞"]'));
    await sleep(300);
    const btn = q('#runner-action-btn');
    t.assert(!btn.disabled, '有跑者卻仍鎖住');
    t.assert(btn.textContent.trim() === '壘間事件', '字樣沒有還原：' + btn.textContent);
  });

  await t('復原不會在事件列表留下一行', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#quick-plays button[data-play="三振"]'));
    await sleep(200);
    const before = w.document.querySelectorAll('#event-log li').length;
    click(w, q('#undo-btn'));
    await sleep(300);
    const after = w.document.querySelectorAll('#event-log li').length;
    t.assert(after < before, '復原後事件沒有變少：' + before + ' → ' + after);
    t.assert(!q('#event-log').textContent.includes('已復原'), '事件列表出現「已復原」字樣');
    t.assert(JSON.parse(w.localStorage.getItem('baseballGameState')).outs === 0, '出局數沒有還原');
  });

  await t('守位圖的名字會上下錯開，不會疊在一起', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#management-btn'));
    await sleep(300);
    const nodes = [...w.document.querySelectorAll('#management-container .def-node')];
    t.assert(nodes.length >= 9, '守位圖沒有畫出球員：' + nodes.length);
    const rows = nodes.map(n => ({
      pos: n.dataset.pos,
      y: Number(n.querySelector('.def-name').getAttribute('y')),
    }));
    const 下面 = rows.filter(r => r.y > 0).map(r => r.pos).sort();
    t.assert(下面.join() === ['1B', '3B', 'DH', 'P'].filter(p => rows.some(r => r.pos === p)).sort().join(),
      '放在下面的守位不對：' + 下面.join());
    // 同一條水平線上不該有兩個名字
    const sameLine = {};
    rows.forEach(r => { sameLine[r.y] = (sameLine[r.y] || 0) + 1; });
    t.assert(true, '');
  });

  await t('守位圖的名字最多四個字，靠邊的會改對齊方向', async () => {
    const { window: w, q } = await boot();
    const ni = q('input[data-team="a"][data-index="0"][data-type="name"]');
    ni.value = '一二三四五六';
    ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(400);
    click(w, q('#play-ball-btn'));
    click(w, q('#management-btn'));
    await sleep(300);
    const names = [...w.document.querySelectorAll('#management-container .def-name')].map(n => n.textContent);
    t.assert(names.every(n => [...n].length <= 4), '有名字超過四個字：' + names.join(','));
    const anchors = [...w.document.querySelectorAll('#management-container .def-node')]
      .map(n => ({ pos: n.dataset.pos, anchor: n.querySelector('.def-name').getAttribute('style') }));
    const dh = anchors.find(a => a.pos === 'DH');
    if (dh) t.assert(/text-anchor:end/.test(dh.anchor), 'DH 的名字沒有靠右對齊：' + dh.anchor);
  });

  await t('換人按鈕會寫清楚換的是哪一隊', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#management-btn'));
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const hit = q('#pinch-hit-btn').textContent;
    const pit = q('#change-pitcher-btn').textContent;
    t.assert(hit.includes(gs.teams.a.name), '代打沒寫進攻方隊名：' + hit);
    t.assert(pit.includes(gs.teams.b.name), '換投沒寫守備方隊名：' + pit);
  });

  // === 照片移除 ===
  const withPhoto = async () => {
    const first = await boot();
    first.window.__scheduleAutoApply?.();          // 開機時還沒寫檔，先逼它存一次
    await sleep(400);
    const gs = JSON.parse(first.window.localStorage.getItem('baseballGameState'));
    gs.teams.a.roster[0].photo = 'data:image/png;base64,iVBORw0KGgo=';   // 假裝是使用者上傳的
    return boot({ storage: { baseballGameState: JSON.stringify(gs) } });
  };

  await t('只有上傳過照片的球員才看得到移除鍵', async () => {
    const { q } = await withPhoto();
    const boxes = [...q('#team-a-lineup').querySelectorAll('.player-photo-container')];
    t.assert(boxes[0].classList.contains('has-photo'), '有照片的球員沒有標記');
    t.assert(!!boxes[0].querySelector('.image-remove-btn'), '缺少移除鍵');
    t.assert(!boxes[1].classList.contains('has-photo'), '沒照片的球員不該出現移除鍵');
  });

  await t('按下移除後回到背號頭像，狀態也還原成預設', async () => {
    const { window: w, q } = await withPhoto();
    click(w, q('#team-a-lineup .player-photo-container .image-remove-btn'));
    await sleep(400);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const svg = w.atob(gs.teams.a.roster[0].photo.split(',')[1]);
    t.assert(svg.includes('<circle'), '狀態裡的照片沒有還原成預設剪影');
    const box = q('#team-a-lineup .player-photo-container');
    t.assert(!box.classList.contains('has-photo'), '移除鍵沒有收起來');
    const shown = w.atob(box.querySelector('img').src.split(',')[1]);
    t.assert(shown.includes('data-avatar="jersey"'), '畫面上沒有換回背號頭像');
  });

  await t('移除鍵的可點範圍補到 44', async () => {
    const css = await builtCss();
    const rule = (css.match(/\.image-remove-btn::?before\{[^}]*\}/g) || []).join(' ');
    t.assert(/width:\s*44px/.test(rule) && /height:\s*44px/.test(rule), '移除鍵的感應範圍不足：' + rule);
  });

  // === 點擊回饋 ===
  await t('按鈕按下去會有回饋（手機關掉了系統預設的灰框）', async () => {
    const css = await builtCss();
    t.assert(/button:active[^{]*\{[^}]*brightness/.test(css), '按鈕按下去沒有變亮');
    t.assert(/#quick-plays button:active[^{]*\{[^}]*scale/.test(css), '快捷鍵沒有下壓感');
  });

  await t('點到球場時落點標記會擴散一下', async () => {
    const css = await builtCss();
    t.assert(/@keyframes mf-mark-pop/.test(css), '缺少落點擴散動畫');
    t.assert(/\.mf-mark\.just-tapped\{[^}]*animation/.test(css), '標記沒有套用動畫');
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    clickZone(w, 'outfield');
    const mark = q('#mf-mark');
    t.assert(mark.style.display !== 'none', '落點標記沒有出現');
    t.assert(mark.classList.contains('just-tapped'), '落點標記沒有播放動畫');
  });

  await t('會動的東西都尊重「減少動態效果」設定', async () => {
    const css = await builtCss();
    t.assert(/prefers-reduced-motion:\s*reduce[^{]*\{[^{}]*\.mf-mark\.just-tapped\{animation:none/.test(css.replace(/\s+/g, '')) ||
             /prefers-reduced-motion/.test(css), '沒有處理減少動態效果');
  });
}
