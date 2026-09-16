// 第三波：勝敗投與救援、盜壘刺、故意四壞、個人守備成績、
// 場地二壘打與傳球出界、比賽中止原因、打擊順序錯誤
import { boot, click, startGame, quickPlay, clickZone, openAtBatMenu } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = w => JSON.parse(w.localStorage.getItem('baseballGameState'));

// 走完「標落點 → 選結果 →（調整）→ 完成」
function field(w, zone, label, tweak, ball = 'all') {
  clickZone(w, zone, ball);
  const b = [...w.document.querySelectorAll('#field-result-panel button')]
    .find(x => x.textContent.trim() === label);
  if (!b) throw new Error('結果選單裡沒有「' + label + '」');
  click(w, b);
  const pos = w.document.querySelector('#modal-advanced-options button[data-step="select-error"]');
  if (pos) click(w, pos);
  const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')]
    .find(x => x.dataset.choice === 'no');
  if (no) click(w, no);
  if (tweak) tweak();
  const done = w.document.getElementById('modal-advanced-done');
  if (done && !done.disabled) click(w, done);
}

// 從「其他」進去選一個結果
function otherPlay(w, group, label) {
  openAtBatMenu(w);
  click(w, w.document.querySelector('#field-result-panel button[data-play="__more"]'));
  click(w, [...w.document.querySelectorAll('#modal-step-1 button')].find(b => b.textContent.trim() === group));
  const btn = [...w.document.querySelectorAll('#modal-options-step-2 button')]
    .find(b => b.textContent.trim() === label);
  if (!btn) throw new Error('清單裡沒有「' + label + '」：'
    + [...w.document.querySelectorAll('#modal-options-step-2 button')].map(b => b.textContent.trim()).join());
  click(w, btn);
}

// 換投：從板凳叫一位上來
async function addBenchPitcher(w, q, name) {
  click(w, q('.bench-add-btn[data-team="b"]'));
  const row = [...w.document.querySelectorAll('#team-b-bench .lineup-player')]
    .find(r => !r.classList.contains('bench-hidden') && !r.querySelector('input[data-type="name"]').value);
  const ni = row.querySelector('input[data-type="name"]');
  ni.value = name; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(250);
}
async function changePitcher(w, q, name) {
  click(w, q('#management-btn'));
  click(w, q('#change-pitcher-btn'));
  click(w, [...q('#picker-list').querySelectorAll('.picker-item')].find(b => b.textContent.includes(name)));
  await sleep(100);
}

export default async function (t) {
  // === 盜壘刺 ===
  await t('盜壘失敗記一次盜壘刺', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');
    click(w, q('#runner-action-btn'));
    const pick = txt => {
      const b = [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === txt);
      if (b) click(w, b);
      return !!b;
    };
    pick('盜壘'); pick('否，繼續'); pick('盜壘失敗（出局）');
    const done = [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成/.test(b.textContent));
    click(w, done);
    const gs = state(w);
    t.assert(gs.teams.a.roster[0].cs === 1, '沒有記到盜壘刺：' + gs.teams.a.roster[0].cs);
    t.assert((gs.teams.a.roster[0].sb || 0) === 0, '盜壘失敗不該記成盜壘成功');
  });

  // === 故意四壞 ===
  await t('故意四壞：打者記四壞，投手另外記一次故四', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    startGame(w);
    otherPlay(w, '上壘', '故四');
    const gs = state(w);
    const p = gs.teams.b.pitchers.find(x => x._id === gs.teams.b.activePitcherId);
    t.assert(gs.teams.a.roster[0].bb === 1, '打者沒有記到四壞');
    t.assert(p.bb === 1, '投手沒有記到四壞');
    t.assert(p.ibb === 1, '投手沒有記到故意四壞：' + p.ibb);
    t.assert(!!gs.bases[0], '打者沒有上一壘');
  });

  // === 個人守備成績 ===
  await t('守備鏈換算成刺殺與助殺（6-3 是游擊助殺、一壘刺殺）', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    field(w, 'infield', '滾地出局', () => {
      // 手動點守備鏈：游擊 → 一壘
      const btn = code => [...w.document.querySelectorAll('#modal-advanced-options .dir-btn')]
        .find(b => b.textContent.trim().startsWith(code));
      const clear = w.document.querySelector('#modal-advanced-options .dir-clear');
      if (clear) click(w, clear);
      click(w, btn('游'));
      click(w, btn('一'));
    }, 'G');
    const gs = state(w);
    const b = gs.teams.b;
    const at = pos => (b.lineupSpots.map(sp => b.roster.find(p => p._id === sp.activePlayerId))
      .find(p => p && p.pos === pos)) || b.roster.find(p => p && p.pos === pos);
    const ss = at('SS'), first = at('1B');
    t.assert(ss && ss.a === 1, '游擊手沒有記到助殺：' + (ss && ss.a));
    t.assert(first && first.po === 1, '一壘手沒有記到刺殺：' + (first && first.po));
    t.assert(!ss.po, '游擊手不該記刺殺');
  });

  await t('三振的刺殺記給捕手', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');
    const b = state(w).teams.b;
    const c = b.roster.find(p => p && p.pos === 'C');
    t.assert(c && c.po === 1, '捕手沒有記到刺殺：' + (c && c.po));
  });

  // === 場地二壘打 ===
  await t('場地二壘打：打者上二壘，跑者剛好各進兩個壘', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');                  // 一壘有人
    field(w, 'outfield', '場地二壘打');
    const gs = state(w);
    t.assert(!!gs.bases[1] && !!gs.bases[2], '打者該在二壘、跑者該到三壘：'
      + JSON.stringify(gs.bases.map(b => !!b)));
    t.assert((gs.teams.a.score || []).reduce((x, y) => x + (y || 0), 0) === 0,
      '一壘的跑者只能進兩個壘（到三壘），不該得分');
    t.assert(gs.teams.a.roster[1]['2b'] === 1, '沒有記成二壘安打');
  });

  // === 比賽結束的原因 ===
  await t('結束比賽要先問原因，因故中止會寫進紀錄', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');
    q('#clock-stop-btn').click();
    t.assert(!q('#end-reason-modal').classList.contains('hidden'), '沒有跳出詢問結束原因的視窗');
    t.assert(w.document.querySelectorAll('#end-reason-modal .end-reason').length === 4, '四個原因沒有都列出來（正常／因故中止／保留／沒收）');
    click(w, q('#end-reason-modal .end-reason[data-reason="called"]'));
    const gs = state(w);
    t.assert(gs.isGameOver, '選了原因卻沒有結束比賽');
    t.assert(gs.endReason === 'called', '沒有記下結束原因：' + gs.endReason);
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('因故中止'), '結束的敘述沒有寫原因：' + ev);
  });

  // === 打擊順序錯誤 ===
  await t('打序錯誤：應該打擊的那一棒出局，下一棒接著打', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');                  // 現在輪到第二棒
    w.__orderFix();
    const items = [...q('#picker-list').querySelectorAll('.picker-item')];
    t.assert(items.length === 9, '沒有列出九個棒次：' + items.length);
    click(w, items[3]);                    // 說第四棒才是應該打擊的人
    const gs = state(w);
    t.assert(gs.outs === 2, '應該多一個出局：' + gs.outs);
    t.assert(gs.currentBatterIndex.a === 4, '下一棒應該是第五棒：' + (gs.currentBatterIndex.a + 1));
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('打擊順序錯誤'), '敘述沒有寫出打擊順序錯誤：' + ev);
  });

  // === 勝投／敗投／救援 ===
  await t('勝敗投：先發投滿五局帶著領先下場就是勝投', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const threeOuts = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    // 客隊第一局先得一分，之後兩邊都三上三下到第九局
    field(w, 'outfield', '全壘打');
    for (let i = 0; i < 20 && !state(w).isGameOver; i++) threeOuts();
    const gs = state(w);
    t.assert(gs.isGameOver, '比賽沒有結束');
    const winner = gs.teams.a.pitchers[0];   // 客隊贏，客隊的投手是勝投
    const loser = gs.teams.b.pitchers[0];
    t.assert(winner.w === 1, '客隊先發沒有拿到勝投');
    t.assert(loser.l === 1, '主隊先發沒有記敗投');
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('勝投') && ev.includes('敗投'), '結束的敘述沒有寫勝敗投：' + ev);
  });

  await t('救援：最後上場守住三分以內的領先算救援成功', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    await addBenchPitcher(w, q, '終結者');      // 主隊的板凳投手
    startGame(w);
    const threeOuts = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    threeOuts();                                // 一上：客隊三上三下
    field(w, 'outfield', '全壘打');              // 一下：主隊先馳得點 0:1
    threeOuts();
    // 打到第九局上半之前
    for (let i = 0; i < 20 && !(state(w).inning === 9 && state(w).isTop); i++) threeOuts();
    t.assert(state(w).inning === 9 && state(w).isTop, '沒有走到第九局上半：'
      + state(w).inning + (state(w).isTop ? '上' : '下'));
    await changePitcher(w, q, '終結者');          // 第九局上換終結者關門
    for (let i = 0; i < 3 && !state(w).isGameOver; i++) threeOuts();
    const gs = state(w);
    t.assert(gs.isGameOver, '比賽沒有結束（第 ' + gs.inning + ' 局）');
    const ps = gs.teams.b.pitchers;
    const starter = ps[0];
    const closer = ps.find(p => p.name === '終結者');
    t.assert(!!closer, '換投沒有成功：' + ps.map(p => p.name).join());
    t.assert(starter.w === 1, '主隊先發投滿八局帶著領先，應該是勝投');
    t.assert(closer.sv === 1, '終結者守住一分領先，應該記救援成功：sv=' + closer.sv);
    t.assert(closer.w !== 1, '救援投手不該同時拿勝投');
    t.assert(gs.teams.a.pitchers[0].l === 1, '客隊先發應該記敗投');
  });
}
