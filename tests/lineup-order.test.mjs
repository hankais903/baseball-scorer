// 棒次拖曳、照片縮圖，以及「設定頁改了主頁要跟著變」的基本檢查
import { boot, click, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const setVal = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const nameInputs = (w, team) =>
  [...w.document.querySelectorAll(`#team-${team}-lineup .lineup-player input[data-type="name"]`)];
const lineupNames = (w, team) => nameInputs(w, team).map(i => i.value);

async function bootWithLineup() {
  const ctx = await boot();
  const { window: w } = ctx;
  w.alert = () => {}; w.confirm = () => true;
  for (let i = 0; i < 9; i++) {
    setVal(w, w.document.querySelector(`input[data-team="a"][data-index="${i}"][data-type="name"]`), '球員' + (i + 1));
  }
  click(w, ctx.q('#apply-lineup'));
  return ctx;
}

// 把打線第 from 列搬到第 to 列之前（模擬拖曳結果）
function moveRow(w, team, from, to) {
  const c = w.document.getElementById(`team-${team}-lineup`);
  const rows = [...c.querySelectorAll('.lineup-player')];
  c.insertBefore(rows[from], rows[to] || null);
}

export default async function (t) {
  await t('拖曳換棒次後套用，畫面順序保留', async () => {
    const { window: w, q } = await bootWithLineup();
    moveRow(w, 'a', 0, 3);
    const expected = lineupNames(w, 'a');
    click(w, q('#apply-lineup'));
    t.assert(lineupNames(w, 'a').join() === expected.join(),
      `套用後變成 ${lineupNames(w, 'a').join()}`);
  });

  await t('拖曳換棒次後套用，主頁打者跟著換', async () => {
    const { window: w, q } = await bootWithLineup();
    const name = () => q('#current-batter-display .batter-name').textContent.trim();
    t.assert(name() === '球員1', '一開始的打者不是球員1：' + name());
    moveRow(w, 'a', 0, 3);
    click(w, q('#apply-lineup'));
    t.assert(name() === '球員2', '主頁打者沒有跟著換：' + name());
  });

  await t('拖曳換棒次後，打序編號重新排好', async () => {
    const { window: w, q } = await bootWithLineup();
    moveRow(w, 'a', 0, 3);
    click(w, q('#apply-lineup'));
    const orders = [...w.document.querySelectorAll('#team-a-lineup .player-order-span')]
      .map(s => s.textContent);
    t.assert(orders.join(',') === '1,2,3,4,5,6,7,8,9', '打序編號亂了：' + orders.join(','));
  });

  await t('拖曳換棒次後，背號與守位跟著人一起搬', async () => {
    const { window: w, q } = await bootWithLineup();
    for (let i = 0; i < 9; i++) {
      setVal(w, w.document.querySelector(`input[data-team="a"][data-index="${i}"][data-type="jersey"]`), String(i + 1));
    }
    click(w, q('#apply-lineup'));
    moveRow(w, 'a', 0, 3);
    click(w, q('#apply-lineup'));
    const rows = [...w.document.querySelectorAll('#team-a-lineup .lineup-player')];
    const pairs = rows.map(r => [
      r.querySelector('input[data-type="name"]').value,
      r.querySelector('input[data-type="jersey"]').value
    ]);
    pairs.forEach(([name, jersey]) => {
      t.assert(name.replace('球員', '') === jersey, `${name} 的背號變成 ${jersey}`);
    });
  });

  await t('拖曳換棒次後儲存名單，存的是新順序', async () => {
    const { window: w, q } = await bootWithLineup();
    setVal(w, q('#team-a-name'), '順序隊');
    moveRow(w, 'a', 0, 3);
    const expected = lineupNames(w, 'a');
    click(w, q('.save-roster-btn[data-team="a"]'));
    const saved = JSON.parse(w.localStorage.getItem('savedBaseballRosters')).pop();
    const got = saved.roster.slice(0, 9).map(p => p.name);
    t.assert(got.join() === expected.join(), `存下的是 ${got.join()}，畫面是 ${expected.join()}`);
  });

  await t('沒有拖曳時，套用不會亂動順序', async () => {
    const { window: w, q } = await bootWithLineup();
    const before = lineupNames(w, 'a');
    click(w, q('#apply-lineup'));
    click(w, q('#apply-lineup'));
    t.assert(lineupNames(w, 'a').join() === before.join(), '沒拖曳卻被重排');
  });

  await t('縮圖：圖片載不起來時不會卡住，會回傳原圖', async () => {
    const { window: w } = await boot();
    const src = 'data:image/png;base64,' + 'A'.repeat(300000);
    const out = await Promise.race([
      w.__imageUtils.shrinkImage(src, 256),
      new Promise(r => setTimeout(() => r('__TIMEOUT__'), 5000))
    ]);
    t.assert(out !== '__TIMEOUT__', '縮圖卡住沒有回應');
    t.assert(out === src, '應原樣回傳，卻回傳了別的東西');
  });

  await t('縮圖：大圖會被縮到指定邊長並改存 JPEG', async () => {
    const { window: w } = await boot();
    let drawn = null;
    class FakeImage {
      set src(v) { this._src = v; this.width = 2000; this.height = 1000; setTimeout(() => this.onload && this.onload(), 0); }
      get src() { return this._src; }
    }
    w.Image = FakeImage;
    const origCreate = w.document.createElement.bind(w.document);
    w.document.createElement = tag => {
      if (tag !== 'canvas') return origCreate(tag);
      const c = origCreate('canvas');
      c.getContext = () => ({ fillStyle: '', fillRect() {}, drawImage() {} });
      c.toDataURL = () => { drawn = { w: c.width, h: c.height }; return 'data:image/jpeg;base64,SHORT'; };
      return c;
    };
    const out = await w.__imageUtils.shrinkImage('data:image/png;base64,' + 'A'.repeat(500000), 256);
    t.assert(drawn && drawn.w === 256 && drawn.h === 128, '縮放尺寸不對：' + JSON.stringify(drawn));
    t.assert(out === 'data:image/jpeg;base64,SHORT', '沒有改用縮小後的圖');
  });

  await t('縮圖：小圖不會被放大，也不會多做一次轉檔', async () => {
    const { window: w } = await boot();
    class FakeImage {
      set src(v) { this._src = v; this.width = 100; this.height = 80; setTimeout(() => this.onload && this.onload(), 0); }
      get src() { return this._src; }
    }
    w.Image = FakeImage;
    const small = 'data:image/png;base64,' + 'A'.repeat(200000);
    const out = await w.__imageUtils.shrinkImage(small, 256);
    t.assert(out === small, '小圖被動到了');
    const tiny = 'data:image/png;base64,' + 'A'.repeat(500);
    t.assert(await w.__imageUtils.shrinkImage(tiny, 256) === tiny, '已經很小的圖仍被處理');
  });

  await t('自動判定的野手不會跟點擊區域矛盾', async () => {
    const { window: w } = await boot();
    const { mainPointToMini, fielderInZone } = w.__fieldMath;
    const at = (deg, r) => {
      const rad = deg * Math.PI / 180;
      return mainPointToMini({ x: 202 + Math.sin(rad) * r, y: 341 - Math.cos(rad) * r });
    };
    // 內野深度的點但區域是外野（畫面比例造成）→ 仍要給外野手
    t.assert(['左', '中', '右'].includes(fielderInZone('二', at(0, 150), 'outfield')),
      '外野區卻判成內野手');
    // 外野深度的點但區域是內野 → 仍要給內野手
    t.assert(!['左', '中', '右'].includes(fielderInZone('中', at(0, 250), 'infield')),
      '內野區卻判成外野手');
    // 界外一律不判
    t.assert(fielderInZone('左', at(-30, 200), 'foul') === null, '界外仍判了野手');
    // 方向要對得起來
    t.assert(fielderInZone(null, at(35, 240), 'outfield') === '右', '右外野判錯');
    t.assert(fielderInZone(null, at(-35, 240), 'outfield') === '左', '左外野判錯');
    t.assert(fielderInZone(null, at(-35, 150), 'infield') === '三', '三壘方向判錯');
    t.assert(fielderInZone(null, at(35, 150), 'infield') === '一', '一壘方向判錯');
  });

  await t('外野的全壘打不會寫成內野方向', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="本打"]'));
    click(w, q('#modal-advanced-done'));
    const log = q('#event-log li').textContent;
    t.assert(/左外野|中外野|右外野/.test(log), '全壘打的方向不是外野：' + log);
    t.assert(!/一壘方向|二壘方向|三壘方向|游擊方向|投手前|本壘前/.test(log), '全壘打卻標成內野：' + log);
  });

  await t('滾地球不會寫成接殺，飛球才是接殺', async () => {
    const ground = await (async () => {
      const { window: w, q } = await boot();
      click(w, q('#play-ball-btn'));
      clickZone(w, 'infield');
      click(w, q('#field-result-panel button[data-play="滾地"]'));
      click(w, q('#modal-advanced-done'));
      return q('#event-log li').textContent;
    })();
    t.assert(/滾地球/.test(ground), '沒有寫出滾地球：' + ground);
    t.assert(!/接殺/.test(ground), '滾地球被寫成接殺：' + ground);
    t.assert(/傳給一壘手封殺出局|一壘手接球踩壘封殺出局/.test(ground), '滾地球沒有寫成傳一壘封殺：' + ground);

    const fly = await (async () => {
      const { window: w, q } = await boot();
      click(w, q('#play-ball-btn'));
      clickZone(w, 'outfield');
      click(w, q('#field-result-panel button[data-play="飛球"]'));
      click(w, q('#modal-advanced-done'));
      return q('#event-log li').textContent;
    })();
    t.assert(/接殺/.test(fly), '飛球出局沒有寫接殺：' + fly);
  });

  // === 打者卡旁的 NEXT：接下來兩位打者 ===
  const nextText = q => [...q('#next-batters .next-item')]
    .map(el => el.textContent.replace(/\s+/g, ' ').trim());

  await t('NEXT 顯示接下來兩位打者', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    const rows = nextText(s => w.document.querySelectorAll(s));
    t.assert(rows.join(' / ') === '2棒客隊球員02 / 3棒客隊球員03', rows.join(' / '));
    t.assert(q('#next-batters .next-label').textContent === 'NEXT', '缺少 NEXT 標籤');
  });

  await t('記完一個打席後 NEXT 會往下移一棒', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    click(w, q('#quick-plays button[data-play="三振"]'));
    const rows = nextText(s => w.document.querySelectorAll(s));
    t.assert(rows.join(' / ') === '3棒客隊球員03 / 4棒客隊球員04', rows.join(' / '));
  });

  await t('換半局後 NEXT 換成另一隊的打序', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    for (let i = 0; i < 3; i++) click(w, q('#quick-plays button[data-play="三振"]'));
    t.assert(q('#inning-display').textContent.includes('下'),
      '沒有換到下半局：' + q('#inning-display').textContent);
    const rows = nextText(s => w.document.querySelectorAll(s));
    t.assert(rows.every(r => r.includes('主隊球員')), '仍停在客隊打序：' + rows.join(' / '));
  });

  await t('打者卡照片尺寸與名單頁一致', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const css = fs.readFileSync(path.join(dir,
      fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
    const rule = (css.match(/\.batter-photo-main\{[^}]*\}/g) || []).join(' ');
    t.assert(/width:\s*38px/.test(rule), '照片寬度不是 38px：' + rule);
    t.assert(/aspect-ratio:\s*3\s*\/\s*4/.test(rule), '照片比例不是 3/4：' + rule);
  });

  await t('沒上傳照片的球員用背號當頭像', async () => {
    const { window: w, q } = await boot();
    const j = q('input[data-team="a"][data-index="0"][data-type="jersey"]');
    j.value = '27';
    j.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(400);
    click(w, q('#play-ball-btn'));
    await sleep(150);
    const src = q('#current-batter-display .batter-photo-main').getAttribute('src');
    t.assert(src.startsWith('data:image/svg+xml;base64,'), '頭像不是產生出來的圖：' + src.slice(0, 40));
    const svg = w.atob(src.split(',')[1]);
    t.assert(svg.includes('>27<'), '頭像上沒有背號：' + svg.slice(0, 200));
  });

  await t('連背號都沒有才用剪影', async () => {
    const { window: w, q } = await boot();
    const j = q('input[data-team="a"][data-index="0"][data-type="jersey"]');
    j.value = '';                       // 預設背號是 01，先清掉
    j.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(400);
    click(w, q('#play-ball-btn'));
    await sleep(150);
    const src = q('#current-batter-display .batter-photo-main').getAttribute('src');
    const svg = w.atob(src.split(',')[1]);
    t.assert(svg.includes('<circle'), '沒有背號時應該用剪影：' + svg.slice(0, 120));
  });

  await t('產生的頭像不會被當成上傳的照片存起來', async () => {
    const { window: w, q } = await boot();
    const j = q('input[data-team="a"][data-index="0"][data-type="jersey"]');
    j.value = '33';
    j.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(400);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const svg = w.atob(gs.teams.a.roster[0].photo.split(',')[1]);
    t.assert(!svg.includes('>33<'), '背號頭像被當成照片存進狀態了');
  });

  await t('NEXT 的棒次自己一格置中', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const css = fs.readFileSync(path.join(dir,
      fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
    const item = (css.match(/#next-batters \.next-item\{[^}]*\}/g) || []).join(' ');
    t.assert(/display:\s*grid/.test(item), 'NEXT 的每一列不是格線排版：' + item);
    t.assert(/grid-template-columns:/.test(item), '沒有把棒次獨立成一欄：' + item);
    const order = (css.match(/\.next-order\{[^}]*\}/g) || []).join(' ');
    t.assert(/text-align:\s*center/.test(order), '棒次沒有置中：' + order);
  });
}
