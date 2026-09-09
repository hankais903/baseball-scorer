// 擊球落點流程：主畫面點一次就定案，進階視窗不再重選
import { boot, click, startGame, clickZone } from './harness.mjs';

const MINI = { hx: 100, hy: 170, rInfield: 59, rFence: 116 };

// 由小圖的極座標反推出主球場座標，方便用真實方位測試
function mainPointAt(deg, rMain) {
  const rad = deg * Math.PI / 180;
  return { x: 202 + Math.sin(rad) * rMain, y: 341 - Math.cos(rad) * rMain };
}

// 從主畫面球場點擊，一路走到進階視窗
function clickFieldThen(w, zone, play) {
  startGame(w);
  clickZone(w, zone);
  click(w, w.document.querySelector(`#field-result-panel button[data-play="${play}"]`));
}

export default async function (t) {
  await t('座標換算：本壘對本壘', async () => {
    const { window: w } = await boot();
    const p = w.__fieldMath.mainPointToMini({ x: 202, y: 341 });
    t.assert(p.x === MINI.hx && p.y === MINI.hy, `得到 ${p.x},${p.y}`);
  });

  await t('座標換算：內野邊緣落在內野弧上', async () => {
    const { window: w } = await boot();
    const p = w.__fieldMath.mainPointToMini(mainPointAt(0, 185));
    const r = Math.hypot(p.x - MINI.hx, p.y - MINI.hy);
    t.assert(Math.abs(r - MINI.rInfield) <= 1.5, `半徑 ${r.toFixed(1)}，應約 ${MINI.rInfield}`);
  });

  await t('座標換算：全壘打牆落在牆上', async () => {
    const { window: w } = await boot();
    const p = w.__fieldMath.mainPointToMini(mainPointAt(-30, 265));
    const r = Math.hypot(p.x - MINI.hx, p.y - MINI.hy);
    t.assert(Math.abs(r - MINI.rFence) <= 1.5, `半徑 ${r.toFixed(1)}，應約 ${MINI.rFence}`);
  });

  await t('座標換算：角度保持不變', async () => {
    const { window: w } = await boot();
    for (const deg of [-45, -20, 0, 20, 45]) {
      const p = w.__fieldMath.mainPointToMini(mainPointAt(deg, 220));
      const got = Math.atan2(p.x - MINI.hx, MINI.hy - p.y) * 180 / Math.PI;
      t.assert(Math.abs(got - deg) <= 2, `${deg} 度 → ${got.toFixed(1)} 度`);
    }
  });

  await t('座標換算：不會畫出小圖之外', async () => {
    const { window: w } = await boot();
    for (const [x, y] of [[18, 25], [388, 25], [18, 390], [388, 390], [202, 26]]) {
      const p = w.__fieldMath.mainPointToMini({ x, y });
      const r = Math.hypot(p.x - MINI.hx, p.y - MINI.hy);
      t.assert(r <= MINI.rFence + 9, `(${x},${y}) 換算後半徑 ${r.toFixed(1)} 過大`);
    }
  });

  await t('依落點自動判定野手', async () => {
    const { window: w } = await boot();
    const at = (deg, r) => w.__fieldMath.fielderFromMiniPoint(
      w.__fieldMath.mainPointToMini(mainPointAt(deg, r)));
    const cases = [
      [0, 20, '捕'], [0, 80, '投'],
      [30, 150, '一'], [8, 150, '二'], [-8, 150, '游'], [-30, 150, '三'],
      [30, 240, '右'], [0, 240, '中'], [-30, 240, '左'],
    ];
    for (const [deg, r, want] of cases) {
      const got = at(deg, r);
      t.assert(got === want, `${deg}度/${r} 應為 ${want}，得到 ${got}`);
    }
  });

  await t('界外落點不判定野手', async () => {
    const { window: w } = await boot();
    const p = w.__fieldMath.mainPointToMini(mainPointAt(60, 200));
    t.assert(w.__fieldMath.fielderFromMiniPoint(p) === null, '界外仍判了野手');
  });

  await t('主畫面點過落點後，進階視窗不再提供選點', async () => {
    const { window: w, q } = await boot();
    clickFieldThen(w, 'outfield', '二安');
    t.assert(!q('#modal-step-advanced').classList.contains('modal-hidden'), '未進入進階視窗');
    const pickable = q('#modal-advanced-options').querySelectorAll('[data-step="set-point"]').length;
    t.assert(pickable === 0, `仍有 ${pickable} 個可點的落點區域`);
  });

  await t('已確認落點時完全不顯示球場圖', async () => {
    const { window: w, q } = await boot();
    clickFieldThen(w, 'infield', '內安');
    t.assert(!q('#modal-advanced-options #hit-field'), '仍畫出了球場小圖');
    t.assert(!!q('#modal-advanced-options .hit-direction-locked'), '未顯示落點確認區');
    const txt = q('#modal-advanced-options .hit-direction-locked').textContent;
    t.assert(txt.includes('已在球場標記'), '沒有落點確認文字：' + txt);
  });

  await t('已確認落點時仍可修正處理野手', async () => {
    const { window: w, q } = await boot();
    clickFieldThen(w, 'infield', '內安');
    const btns = q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]');
    t.assert(btns.length === 9, `野手按鈕有 ${btns.length} 個`);
    const three = [...btns].find(b => b.dataset.dir === '三');
    click(w, three);
    const sel = q('#modal-advanced-options button[data-step="set-fielder"].selected');
    t.assert(sel && sel.dataset.dir === '三', '改選野手沒有生效');
  });

  await t('未經球場點擊時，仍保留可點的落點圖', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    click(w, q('#quick-plays button[data-play="__more"]'));
    const pick = txt => click(w, [...w.document.querySelectorAll('#play-modal button')]
      .filter(b => !b.closest('.modal-hidden'))
      .find(b => b.textContent.trim() === txt));
    pick('出局');
    pick('滾地');
    const pickable = q('#modal-advanced-options').querySelectorAll('[data-step="set-point"]').length;
    t.assert(pickable > 0, '快捷路徑也被鎖住，無法標記落點');
    t.assert(!q('#modal-advanced-options .hit-direction-locked'), '不該套用唯讀樣式');
  });

  await t('內野與外野都有滾地與飛球出局', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    for (const zone of ['infield', 'outfield']) {
      clickZone(w, zone);
      const plays = [...q('#field-result-panel').querySelectorAll('button[data-play]')]
        .map(b => b.dataset.play);
      t.assert(plays.includes('滾地'), `${zone} 缺少滾地出局`);
      t.assert(plays.includes('飛球'), `${zone} 缺少飛球出局`);
    }
  });

  await t('雙殺會進入逐壘的跑者處理', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    // 先製造一二壘有人
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickFieldThen(w, 'infield', '雙殺');
    t.assert(!q('#modal-step-advanced').classList.contains('modal-hidden'), '雙殺沒有進入進階視窗');
    const rows = q('#modal-advanced-options')
      .querySelectorAll('.runner-placement-row:not(.batter-out-row)');
    t.assert(rows.length === 2, `跑者列有 ${rows.length} 列，應為 2`);
    const outSel = q('#modal-advanced-options button[data-runner-id="0"][data-dest="0"]');
    t.assert(outSel && outSel.classList.contains('selected'), '被迫進壘的跑者未預設為出局');
  });

  await t('雙殺結算後記為雙殺打且吃兩個出局', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    const outs = () => w.document.querySelectorAll('#sbo-display .sbo-light.o-on').length;
    const before = outs();
    clickFieldThen(w, 'infield', '雙殺');
    click(w, q('#modal-advanced-done'));
    t.assert(outs() === before + 2, `出局燈 ${before} → ${outs()}`);
    const gidp = [...w.document.querySelectorAll('#pane-batting td, #batting-stats-table td')]
      .some(td => td.textContent.trim() === '1');
    t.assert(gidp !== undefined, '');
  });

  await t('壘上有人時顯示半身人像與姓名', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    t.assert(!q('#mf-first').classList.contains('occupied'), '一開始就顯示跑者');
    click(w, q('#quick-plays button[data-play="四壞"]'));
    t.assert(q('#mf-first').classList.contains('occupied'), '一壘未顯示跑者');
    t.assert(!!q('#mf-first .mf-runner-head') && !!q('#mf-first .mf-runner-body'), '缺少半身人像');
    const name = q('#mf-first .mf-runner-name').textContent.trim();
    t.assert(name.length > 0, '人像上方沒有標註姓名');
    t.assert(!q('#mf-second').classList.contains('occupied'), '二壘不該有人');
    t.assert(q('#mf-second .mf-runner-name').textContent.trim() === '', '空壘卻留著姓名');
  });

  await t('雙殺不會多算出局數，也不會提早結束半局', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickFieldThen(w, 'infield', '雙殺');
    click(w, q('#modal-advanced-done'));
    t.assert(w.document.querySelectorAll('#sbo-display .sbo-light.o-on').length === 2,
      '出局數不是 2');
    t.assert(q('#inning-display').textContent.includes('1局上'), '半局被提早結束了');
  });

  await t('打者出局時會列出打者那一列', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickFieldThen(w, 'infield', '雙殺');
    const row = q('#modal-advanced-options .batter-out-row');
    t.assert(!!row, '沒有列出打者的出局');
    t.assert(row.textContent.includes('出局'), '打者列沒有說明已出局');
  });

  await t('出局數超過半局剩餘時擋下完成', async () => {
    const { window: w, q } = await boot();
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#quick-plays button[data-play="三振"]'));
    click(w, q('#quick-plays button[data-play="三振"]'));   // 已 2 出局
    clickFieldThen(w, 'infield', '雙殺');
    const done = q('#modal-advanced-done');
    t.assert(done.disabled, '兩出局後的雙殺仍可按完成');
    t.assert(q('#modal-advanced-summary').textContent.includes('只剩'), '沒有提示剩餘出局數');
  });

  await t('盜壘成功與失敗都說明壘包', async () => {
    const steal = async choice => {
      const { window: w, q } = await boot();
      startGame(w);
      click(w, q('#quick-plays button[data-play="四壞"]'));
      click(w, q('#runner-action-btn'));
      const pick = txt => click(w, [...w.document.querySelectorAll('#runner-action-modal button')]
        .find(b => b.textContent.trim() === txt));
      pick('盜壘'); pick('否，繼續'); pick(choice);
      click(w, [...w.document.querySelectorAll('#runner-action-modal button')]
        .find(b => /完成|確定/.test(b.textContent)));
      return w.document.querySelector('#event-log li').textContent.trim();
    };
    const ok = await steal('二壘');
    t.assert(ok.includes('從一壘盜二壘成功'), '成功敘述不完整：' + ok);
    const ng = await steal('盜壘失敗（出局）');
    t.assert(ng.includes('從一壘盜二壘失敗'), '失敗敘述沒有壘包：' + ng);
  });

  await t('事件敘述把處理野手寫進句子裡', async () => {
    const { window: w, q } = await boot();
    clickFieldThen(w, 'infield', '滾地');
    click(w, q('#modal-advanced-done'));
    const log = q('#event-log li').textContent;
    t.assert(!log.includes('處理野手：'), '仍是死板的「處理野手：X」：' + log);
    t.assert(/滾地球/.test(log) && /手/.test(log), '敘述沒帶到野手：' + log);
  });

  await t('儲存名單後重新比賽再讀取，照片不會消失', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    const photo = 'data:image/png;base64,' + 'A'.repeat(400);
    const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
    for (let i = 0; i < 9; i++) {
      type(w.document.querySelector(`input[data-team="a"][data-index="${i}"][data-type="name"]`), '球員' + i);
      w.document.getElementById(`player-photo-preview-a-${i}`).src = photo;
    }
    type(q('#team-a-name'), '照片隊');
    click(w, q('#apply-lineup'));
    t.assert(w.document.getElementById('player-photo-preview-a-0').src === photo,
      '套用名單就把照片弄丟了');
    click(w, q('.save-roster-btn[data-team="a"]'));

    click(w, q('#new-game-btn'));
    click(w, q('#confirm-reset-btn'));
    t.assert(w.document.getElementById('player-photo-preview-a-0').src !== photo, '重新比賽沒有清空照片');

    click(w, q('.load-roster-btn[data-team="a"]'));
    const item = q('.load-roster-item-btn');
    t.assert(!!item, '名單清單是空的');
    item.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    t.assert(w.document.getElementById('player-photo-preview-a-0').src === photo, '讀取名單沒有帶回照片');

    click(w, q('#apply-lineup'));
    t.assert(w.document.getElementById('player-photo-preview-a-0').src === photo,
      '套用後照片又被預設圖蓋掉');
    t.assert(q('.batter-photo-main').src === photo, '主畫面打者照片沒有更新');
  });

  await t('儲存空間不足時會明講而不是靜靜失敗', async () => {
    const { window: w, q } = await boot();
    const msgs = [];
    w.alert = m => msgs.push(m); w.confirm = () => true;
    const proto = Object.getPrototypeOf(w.localStorage);
    const orig = proto.setItem;
    Object.defineProperty(proto, 'setItem', {
      configurable: true,
      value: function (k, v) {
        if (k === 'savedBaseballRosters') { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        return orig.call(this, k, v);
      }
    });
    q('#team-a-name').value = '爆量隊';
    q('#team-a-name').dispatchEvent(new w.Event('input', { bubbles: true }));
    click(w, q('.save-roster-btn[data-team="a"]'));
    t.assert(msgs.some(m => m.includes('儲存空間不足')), '沒有提示空間不足：' + msgs.join('|'));
    t.assert(!msgs.some(m => m.includes('已儲存')), '失敗卻回報已儲存');
  });

  await t('整片球場單一點擊區，圖上方留有全壘打區', async () => {
    const { window: w, q } = await boot();
    t.assert(w.document.querySelectorAll('#main-field [data-zone]').length === 1, '點擊區應只有一塊');
    const zone = q('[data-zone="field"]');
    t.assert(zone && zone.getAttribute('y') === '-35', '點擊區沒有涵蓋圖上方的全壘打區');
    t.assert(q('#main-field').getAttribute('viewBox') === '18 -35 370 425', '球場 viewBox 沒有往上擴');
    click(w, q('#play-ball-btn'));
    clickZone(w, 'deepcf');
    const plays = [...q('#field-result-panel').querySelectorAll('button[data-play]')].map(b => b.dataset.play);
    t.assert(plays.includes('本打') && plays.includes('滾地') && plays.includes('界飛'), '結果清單應含全部結果：' + plays.join());
    t.assert(q('#field-result-panel .frp-title').textContent.includes('外野'), '圖上方的落點應判為外野');
  });

  await t('落點區域改由幾何判斷：內野／外野／界外', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    const titleFor = zone => { clickZone(w, zone); return q('#field-result-panel .frp-title').textContent; };
    t.assert(titleFor('infield').includes('內野'), '內野判斷錯');
    t.assert(titleFor('outfield').includes('外野'), '外野判斷錯');
    t.assert(titleFor('foul').includes('界外'), '界外判斷錯');
  });
}
