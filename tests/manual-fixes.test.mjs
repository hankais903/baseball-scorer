// 照 WBSC 記錄員手冊 2016 對帳後修正的八件事：
// 1 妨礙打擊不算守備機會　2 靠失誤才發生的得分不給打點　3 兩出局＋打者靠失誤上壘永遠不給打點
// 4 敗投＝讓致勝分跑者上壘的投手　5 防禦率乘規定局數　6 突破僵局的分不算投手失分
// 7 突破僵局預設一二壘　8 先發不夠局數時勝投給最有效的後援
import { boot, click, startGame, quickPlay, clickZone, openAtBatMenu } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = w => JSON.parse(w.localStorage.getItem('baseballGameState'));
const runsOf = (w, k = 'a') => (state(w).teams[k].score || []).reduce((x, y) => x + (y || 0), 0);

// 走完「標落點 → 選結果 → 處理野手 → 失誤問答 → 調整跑者 → 完成」
// err：'no'（預設，沒有失誤）或野手代號（例如 '投'）代表那位野手失誤
function play(w, q, zone, playName, opts = {}) {
  const { tweak, ball = 'all', err = 'no' } = opts;
  clickZone(w, zone, ball);
  const b = q(`#field-result-panel button[data-play="${playName}"]`)
    || [...w.document.querySelectorAll('#field-result-panel button')].find(x => x.textContent.trim() === playName);
  if (!b) throw new Error('球場選項沒有 ' + playName);
  click(w, b);
  // 有些結果會先問「這個 play 有沒有失誤」，有些要自己按「加上失誤」
  const ask = (choice) => [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')]
    .find(x => x.dataset.choice === choice);
  const pickFielder = (code) => {
    const b = [...w.document.querySelectorAll('#modal-advanced-options .dir-btn')]
      .find(x => x.textContent.trim().startsWith(code));
    if (!b) throw new Error('沒有野手鈕：' + code);
    click(w, b);
  };
  if (err === 'no') {
    const pos = q('#modal-advanced-options button[data-step="select-error"]');
    if (pos) click(w, pos);
    const no = ask('no');
    if (no) click(w, no);
  }
  else {
    const yes = ask('yes');
    if (yes) click(w, yes);
    else {
      let add = q('#modal-advanced-options button[data-step="add-error"]');
      // 有些結果（例如犧牲觸擊）要先點出處理球的野手，「加上失誤」才會出現
      if (!add) { pickFielder(err); add = q('#modal-advanced-options button[data-step="add-error"]'); }
      if (!add) throw new Error('這個結果沒有「加上失誤」可以按');
      click(w, add);
    }
    pickFielder(err);
  }
  if (tweak) tweak();
  const done = q('#modal-advanced-done');
  if (!done || done.disabled) throw new Error('完成被鎖住：' + (q('#modal-advanced-summary') || {}).textContent);
  click(w, done);
}
const setDest = (w, q, baseIndex, dest) => {
  const b = q(`#modal-advanced-options button[data-step="set-runners"][data-runner-id="${baseIndex}"][data-dest="${dest}"]`);
  if (!b) throw new Error(`找不到${baseIndex + 1}壘跑者的去向按鈕（${dest}）`);
  click(w, b);
};

// 從「其他」進去挑一個結果
function otherPlay(w, group, label) {
  openAtBatMenu(w);
  click(w, w.document.querySelector('#field-result-panel button[data-play="__more"]'));
  click(w, [...w.document.querySelectorAll('#modal-step-1 button')].find(b => b.textContent.trim() === group));
  const btn = [...w.document.querySelectorAll('#modal-options-step-2 button')]
    .find(b => b.textContent.trim() === label);
  if (!btn) throw new Error('清單裡沒有「' + label + '」');
  click(w, btn);
}

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
  // === 1. 妨礙打擊不算守備機會（規則 9.16(a) 註解）===
  await t('妨礙打擊不佔守備機會，後面的分照樣算責失', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');
    quickPlay(w, '三振');
    otherPlay(w, '上壘', '妨礙打擊');           // 兩出局、打者靠妨礙打擊上壘
    click(w, q('#modal-advanced-done'));        // 妨礙打擊也走進階視窗，要按完成
    const mid = state(w);
    t.assert(mid.inningPotentialOuts === 2,
      '妨礙打擊不該多算一次守備機會，目前 ' + mid.inningPotentialOuts);
    play(w, q, 'outfield', '本打');              // 兩分全壘打
    const gs = state(w);
    const p = gs.teams.b.pitchers.find(x => x._id === gs.teams.b.activePitcherId);
    t.assert(p.r === 2, '應該記兩分失分：' + p.r);
    // 妨礙打擊上壘的那位永遠不是責失，但打者自己那一分是
    t.assert(p.er === 1, '打者自己的那一分要算責失，實際責失 ' + p.er);
  });

  // === 2. 靠失誤才發生的得分不給打點 ===
  await t('靠失誤多跑的壘送回來的分不給打點', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '二安');                        // 一棒上二壘
    const before = state(w).teams.a.roster[1].rbi;
    // 打者靠失誤上壘（本身只值一個壘），二壘跑者卻一路跑回本壘＝多跑的是失誤送的
    play(w, q, 'infield', '失誤', { ball: 'G', tweak: () => setDest(w, q, 1, 4) });
    const gs = state(w);
    t.assert(runsOf(w) === 1, '跑者應該得分：' + runsOf(w));
    t.assert(gs.teams.a.roster[1].rbi === before,
      '多跑的壘是失誤送的，不該給打點（多給了 ' + (gs.teams.a.roster[1].rbi - before) + '）');
  });

  await t('兩出局前三壘跑者靠失誤回來，打點照給', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '三安');                        // 一棒上三壘、無人出局
    const before = state(w).teams.a.roster[1].rbi;
    play(w, q, 'infield', '失誤', { ball: 'G', tweak: () => setDest(w, q, 2, 4) });
    const gs = state(w);
    t.assert(runsOf(w) === 1, '三壘跑者應該回來得分');
    t.assert(gs.teams.a.roster[1].rbi === before + 1,
      '兩出局前三壘跑者本來就會回來，要給打點（規則 9.04(a)）：' + gs.teams.a.roster[1].rbi);
  });

  // === 3. 兩出局＋打者靠失誤上壘，永遠不給打點 ===
  await t('兩出局後打者靠失誤上壘，跑回來的分不給打點', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');
    quickPlay(w, '三振');
    play(w, q, 'outfield', '三安');                        // 兩出局、三壘有人
    const before = state(w).teams.a.roster[3].rbi;
    play(w, q, 'infield', '失誤', { ball: 'G', tweak: () => setDest(w, q, 2, 4) });
    const gs = state(w);
    t.assert(runsOf(w) === 1, '分數還是要算：' + runsOf(w));
    t.assert(gs.teams.a.roster[3].rbi === before,
      '兩出局＋失誤上壘，沒有那個失誤半局就結束了，不該給打點（多給了 '
      + (gs.teams.a.roster[3].rbi - before) + '）');
  });

  // === 5. 防禦率要乘規定局數 ===
  await t('七局制的防禦率乘 7，不是乘 9', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    startGame(w);
    const gs = state(w);
    gs.rules = { innings: 7, maxInnings: 9, mercy: [], tiebreakFrom: 0, tiebreakBases: '12' };
    w.localStorage.setItem('baseballGameState', JSON.stringify(gs));
    w.__adoptSavedGame(gs);
    // 一責失、投三個出局數（1 局）→ 七局制的防禦率是 7.00
    const era = w.__eraText ? w.__eraText(1, 3) : null;
    t.assert(era === '7.00', '七局制防禦率算錯：' + era);
    t.assert(w.__eraText(2, 6) === '7.00', '兩責失兩局也該是 7.00：' + w.__eraText(2, 6));
  });

  // === 4. 敗投＝讓致勝分那位跑者上壘的投手（規則 9.17(d)）===
  await t('敗投算給讓致勝分跑者上壘的投手，不是當下在投的那位', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    await addBenchPitcher(w, q, '接手的');
    startGame(w);
    const threeOuts = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    // 一上：主隊先發讓一棒上壘後被換下，接手的投手讓那位跑者回來得分（＝致勝分）
    play(w, q, 'outfield', '一安');
    await changePitcher(w, q, '接手的');
    play(w, q, 'outfield', '三安', { tweak: () => setDest(w, q, 0, 4) });
    t.assert(runsOf(w) === 1, '客隊應該先得一分：' + runsOf(w));
    // 之後兩邊都三上三下到比賽結束，客隊 1:0 獲勝
    for (let i = 0; i < 24 && !state(w).isGameOver; i++) threeOuts();
    const gs = state(w);
    t.assert(gs.isGameOver, '比賽沒有結束（第 ' + gs.inning + ' 局）');
    const ps = gs.teams.b.pitchers;
    const first = ps[0], relief = ps.find(p => p.name === '接手的');
    t.assert(!!relief, '換投沒有成功：' + ps.map(p => p.name).join());
    t.assert(first.l === 1,
      '致勝分那位跑者是先發放上壘的，敗投該記先發；實際 先發 L=' + first.l + '／接手的 L=' + relief.l);
    t.assert(relief.l !== 1, '接手的投手不該記敗投');
  });

  // === 6 + 7. 突破僵局 ===
  await t('突破僵局預設是一二壘各一位（WBSC）', async () => {
    const { window: w } = await boot();
    w.alert = () => {};
    startGame(w);
    const gs = state(w);
    gs.rules = { innings: 3, maxInnings: 0, mercy: [], tiebreakFrom: 4 };  // 不指定壘包，看預設
    w.localStorage.setItem('baseballGameState', JSON.stringify(gs));
    w.__adoptSavedGame(gs);
    const threeOuts = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    for (let i = 0; i < 10 && state(w).inning < 4; i++) threeOuts();
    const after = state(w);
    t.assert(after.inning === 4, '沒有打到第四局：' + after.inning);
    t.assert(!!after.bases[0] && !!after.bases[1],
      '預設應該是一二壘各一位：' + JSON.stringify(after.bases.map(b => !!b)));
  });

  // === 8. 先發不夠局數時，勝投給最有效的後援 ===
  await t('先發沒投滿五局，勝投給失分比較少的那位後援', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    await addBenchPitcher(w, q, '後援甲');
    await addBenchPitcher(w, q, '後援乙');
    startGame(w);
    const threeOuts = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    threeOuts();                                   // 一上：客隊三上三下（主隊先發投 1 局）
    play(w, q, 'outfield', '本打');                 // 一下：主隊先馳得點 0:1
    threeOuts();                                   // 打完一下
    await changePitcher(w, q, '後援甲');            // 二上開始換投（先發只投一局）
    threeOuts();                                   // 二上
    threeOuts();                                   // 二下
    await changePitcher(w, q, '後援乙');            // 三上再換
    for (let i = 0; i < 20 && !state(w).isGameOver; i++) threeOuts();
    const gs = state(w);
    t.assert(gs.isGameOver, '比賽沒有結束（第 ' + gs.inning + ' 局）');
    const ps = gs.teams.b.pitchers;
    const starter = ps[0];
    t.assert(starter.w !== 1, '先發只投一局，不該拿勝投');
    const winner = ps.find(p => p.w === 1);
    t.assert(!!winner, '沒有人拿到勝投：' + ps.map(p => p.name + '(' + p.outsRecorded + ')').join());
    t.assert(winner.name === '後援甲' || winner.name === '後援乙',
      '勝投應該給後援：' + winner.name);
    t.assert(gs.teams.a.pitchers[0].l === 1, '客隊先發應該記敗投');
  });
}
