// 第二批照手冊補的東西：守備冷漠、申訴出局、滑過頭 vs 跑過頭、
// 界外高飛犧牲打、場內全壘打、沒收比賽、再見安打壘數縮減、記錄表結算檢查
import { boot, click, startGame, quickPlay, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = w => JSON.parse(w.localStorage.getItem('baseballGameState'));
const runsOf = (w, k = 'a') => (state(w).teams[k].score || []).reduce((x, y) => x + (y || 0), 0);

// 標落點 → 選結果 →（沒有失誤）→ 調整 → 完成
function play(w, q, zone, label, opts = {}) {
  const { tweak, ball = 'all' } = opts;
  clickZone(w, zone, ball);
  const b = [...w.document.querySelectorAll('#field-result-panel button')]
    .find(x => x.textContent.trim() === label);
  if (!b) throw new Error('球場選項沒有「' + label + '」');
  click(w, b);
  const pos = q('#modal-advanced-options button[data-step="select-error"]');
  if (pos) click(w, pos);
  const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')]
    .find(x => x.dataset.choice === 'no');
  if (no) click(w, no);
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
// 壘間事件：選一個類型
const runnerEvent = (w, q, name) => {
  click(w, q('#runner-action-btn'));
  const b = [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === name);
  if (!b) throw new Error('壘間事件裡沒有「' + name + '」');
  click(w, b);
};
const finishRunnerEvent = (w) => {
  const done = [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成/.test(b.textContent));
  click(w, done);
};
// 打到九局下半（兩邊都三上三下）
const toNinthBottom = (w) => {
  const three = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
  for (let i = 0; i < 40 && !(state(w).inning === 9 && !state(w).isTop); i++) three();
};

export default async function (t) {
  // === 守備冷漠（規則 9.07(g)）===
  await t('守方未防守：推進照算，但不記盜壘', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');
    runnerEvent(w, q, '守方未防守');
    click(w, q('button[data-step="set-dest"][data-runner-id="0"][data-dest="2"]'));
    finishRunnerEvent(w);
    const gs = state(w);
    t.assert(!gs.bases[0] && !!gs.bases[1], '跑者應該推進到二壘：' + JSON.stringify(gs.bases.map(b => !!b)));
    t.assert((gs.teams.a.roster[0].sb || 0) === 0, '守備冷漠不該記盜壘：' + gs.teams.a.roster[0].sb);
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('守方未做防守'), '敘述沒有說明是守方未防守：' + ev);
  });

  // === 申訴出局（規則 5.09(c)）===
  await t('申訴出局：跑者出局，但不記盜壘刺', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');
    quickPlay(w, '四壞');
    runnerEvent(w, q, '申訴出局');
    const reasons = [...w.document.querySelectorAll('#runner-action-modal button[data-step="set-appeal"]')];
    t.assert(reasons.length === 2, '應該有兩個申訴理由：' + reasons.length);
    click(w, reasons.find(b => b.dataset.reason === 'left-early'));
    const outs = [...w.document.querySelectorAll('#runner-action-modal button[data-step="set-dest"]')];
    click(w, outs[1]);                       // 二壘跑者被申訴
    finishRunnerEvent(w);
    const gs = state(w);
    t.assert(gs.outs === 1, '應該多一個出局：' + gs.outs);
    t.assert(!gs.bases[1], '被申訴的跑者要離開壘包：' + JSON.stringify(gs.bases.map(b => !!b)));
    t.assert((gs.teams.a.roster[0].cs || 0) === 0, '申訴出局不是盜壘刺');
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('申訴') && ev.includes('離壘'), '敘述不完整：' + ev);
  });

  // === 滑過頭 vs 跑過頭（規則 9.06(c)）===
  await t('滑過頭被觸殺：二壘安打降成一壘安打', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '二壘安打', {
      tweak: () => {
        const b = q('#modal-advanced-options button[data-step="set-runners"][data-overslide="1"]');
        if (!b) throw new Error('沒有「滑過頭被觸殺」這顆按鈕');
        click(w, b);
      },
    });
    const p = state(w).teams.a.roster[0];
    t.assert(p.h === 1, '安打還是要算一支：' + p.h);
    t.assert(p['2b'] === 0, '滑過頭就不是二壘安打了：' + p['2b']);
    t.assert(p.tb === 1, '壘打數要降成 1：' + p.tb);
    t.assert(String(p.abResults[0]).startsWith('二安'), '打席結果仍記在二安那一格（之後細修）：' + p.abResults[0]);
    t.assert(state(w).outs === 1, '打者要出局：' + state(w).outs);
  });

  await t('跑過頭被觸殺：安打壘數照算', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '二壘安打', {
      tweak: () => {
        const b = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="set-runners"]')]
          .find(x => x.dataset.outAdvancing === '1' && x.dataset.overslide !== '1');
        if (!b) throw new Error('沒有「跑過頭被觸殺」這顆按鈕');
        click(w, b);
      },
    });
    const p = state(w).teams.a.roster[0];
    t.assert(p['2b'] === 1, '跑過頭代表已經安全到二壘，二壘安打照算：' + p['2b']);
    t.assert(p.tb === 2, '壘打數應該是 2：' + p.tb);
  });

  // === 界外高飛犧牲打 FSF ===
  await t('界外接殺的高飛犧牲打會另外標記', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '三壘安打');                 // 三壘有人
    play(w, q, 'outfield', '高飛犧牲', {
      ball: 'F',
      tweak: () => {
        const fsf = q('#modal-advanced-options button[data-step="toggle-fsf"]');
        if (!fsf) throw new Error('沒有「界外接殺（FSF）」這顆按鈕');
        click(w, fsf);
        setDest(w, q, 2, 4);
      },
    });
    const p = state(w).teams.a.roster[1];
    t.assert(p.sf === 1, '高飛犧牲打要照記：' + p.sf);
    t.assert(String(p.abResults[0]).startsWith('界犧飛'), '沒有標成界外犧飛：' + p.abResults[0]);
    t.assert(runsOf(w) === 1, '應該有人得分');
    const ev = state(w).events[state(w).events.length - 1].text;
    t.assert(ev.includes('界外高飛犧牲打'), '敘述沒有寫界外：' + ev);
  });

  // === 場內全壘打 IHR ===
  await t('場內全壘打會另外標記，統計還是算全壘打', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '全壘打', {
      tweak: () => {
        const ihr = q('#modal-advanced-options button[data-step="toggle-ihr"]');
        if (!ihr) throw new Error('沒有「場內全壘打（IHR）」這顆按鈕');
        click(w, ihr);
      },
    });
    const p = state(w).teams.a.roster[0];
    t.assert(p.hr === 1, '全壘打照算：' + p.hr);
    t.assert(p.tb === 4, '壘打數要有 4：' + p.tb);
    t.assert(String(p.abResults[0]).startsWith('場內全打'), '沒有標成場內全壘打：' + p.abResults[0]);
    const ev = state(w).events[state(w).events.length - 1].text;
    t.assert(ev.includes('場內全壘打'), '敘述沒有寫場內：' + ev);
  });

  // === 再見安打壘數縮減（規則 9.06(f)）===
  await t('再見安打只算到致勝跑者推進的壘數', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    toNinthBottom(w);
    t.assert(state(w).inning === 9 && !state(w).isTop, '沒有走到九局下半');
    play(w, q, 'outfield', '三壘安打');                       // 三壘有人
    play(w, q, 'outfield', '二壘安打', { tweak: () => setDest(w, q, 2, 4) });
    const gs = state(w);
    t.assert(gs.isGameOver, '再見安打之後比賽要結束');
    const hitter = gs.teams.b.roster.find(p => (p.abResults || []).some(r => String(r).startsWith('一安')));
    t.assert(!!hitter, '二壘安打沒有被縮成一壘安打：'
      + gs.teams.b.roster.filter(p => p.h).map(p => (p.abResults || []).join()).join(' / '));
    t.assert(hitter['2b'] === 0 && hitter.tb === 1, '二安欄位與壘打數沒有跟著降：2B=' + hitter['2b'] + ' TB=' + hitter.tb);
    const ev = gs.events.map(e => e.text).join(' ');
    t.assert(ev.includes('再見安打只算到'), '沒有說明為什麼縮壘數');
  });

  // === 沒收比賽（規則 7.03、9.03(e)(2)）===
  await t('沒收比賽：比數記 9：0，當時沒領先就沒有勝敗投', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '三振');
    q('#clock-stop-btn').click();
    const btn = q('#end-reason-modal .end-reason[data-reason="forfeit"]');
    t.assert(!!btn, '結束原因裡沒有「沒收比賽」');
    click(w, btn);
    const items = [...q('#picker-list').querySelectorAll('.picker-item')];
    t.assert(items.length === 2, '應該讓你選哪一隊獲勝：' + items.length);
    click(w, items[1]);                                     // 主隊獲勝
    const gs = state(w);
    t.assert(gs.isGameOver && gs.endReason === 'forfeit', '沒有記成沒收比賽：' + gs.endReason);
    t.assert(runsOf(w, 'a') === 0 && runsOf(w, 'b') === 9, '比數不是 0：9，實際 '
      + runsOf(w, 'a') + '：' + runsOf(w, 'b'));
    const anyW = [...gs.teams.a.pitchers, ...gs.teams.b.pitchers].some(p => p.w === 1 || p.l === 1);
    t.assert(!anyW, '獲勝那一隊當時沒領先，不該有勝敗投');
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('沒收比賽'), '敘述沒有寫沒收比賽：' + ev);
  });

  // === 記錄表結算檢查（手冊附錄 3）===
  await t('結算檢查：打席＋突破僵局 ＝ 得分＋殘壘＋對手刺殺', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const three = () => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };
    quickPlay(w, '四壞'); quickPlay(w, '四壞'); three();     // 一上：兩人殘壘
    three(); three(); three();
    t.assert(state(w).teams.a.lob === 2, '殘壘沒有累計：' + state(w).teams.a.lob);
    for (const k of ['a', 'b']) {
      const b = w.__balance(k);
      t.assert(b.ok, k + ' 的結算對不起來：' + JSON.stringify(b));
    }
  });

  await t('有安打與得分的半局也要對得起來', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '二壘安打');
    play(w, q, 'outfield', '全壘打');
    quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振');
    const b = w.__balance('a');
    t.assert(b.r === 2, '應該得兩分：' + b.r);
    t.assert(b.ok, '結算對不起來：' + JSON.stringify(b));
  });

  // === 使用者實測回報的複雜情境（v2.19 修）===
  // 三壘有人，打者擊出平飛球被二壘手接殺；三壘跑者離壘過遠，
  // 二壘手傳三壘想封殺卻傳失誤，跑者安全回到三壘。
  await t('平飛球接殺要寫成平飛球，不是高飛球', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'infield', '飛球出局', { ball: 'L' });
    const ev = state(w).events[state(w).events.length - 1].text;
    t.assert(ev.includes('平飛球'), '沒有寫成平飛球：' + ev);
    t.assert(!ev.includes('高飛球'), '還是寫成高飛球：' + ev);
  });

  await t('接殺後傳壘失誤：跑者的過程要寫出來，刺殺記給接球的人', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '三壘安打');                    // 三壘有人
    // 平飛球被二壘手接殺，二壘手傳三壘失誤（決定性），跑者安全回三壘
    clickZone(w, 'infield', 'L');
    click(w, [...w.document.querySelectorAll('#field-result-panel button')]
      .find(x => x.textContent.trim() === '飛球出局'));
    const dir = c => [...w.document.querySelectorAll('#modal-advanced-options .dir-btn')]
      .find(b => b.textContent.trim().startsWith(c));
    click(w, dir('二')); click(w, dir('三'));              // 守備鏈：接球後傳三壘
    click(w, q('#modal-advanced-options button[data-step="add-error"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="select-error"]')]
      .find(x => x.textContent.trim().startsWith('二')));
    const kind = q('#modal-advanced-options button[data-step="toggle-error-kind"]');
    t.assert(kind.textContent.includes('多餘壘'), '出局類的失誤預設應該是多餘壘：' + kind.textContent);
    click(w, kind);                                        // 改成決定性（本來封殺得掉）
    click(w, q('#modal-advanced-done'));

    const gs = state(w);
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('平飛球'), '球種沒寫對：' + ev);
    t.assert(ev.includes('二壘手接殺出局'), '沒寫出被誰接殺：' + ev);
    t.assert(ev.includes('離壘過遠'), '跑者的過程沒有寫出來：' + ev);
    // 守備鏈有第二個人，敘述要寫出那一傳；失誤是傳球的人犯的就寫「但傳球失誤」
    t.assert(ev.includes('二壘手傳給三壘手想封殺'), '沒有寫出傳三壘想封殺：' + ev);
    t.assert(ev.includes('但傳球失誤，安全回到三壘'), '沒有寫出傳球失誤與安全回壘：' + ev);
    t.assert(gs.outs === 1, '只該有一個出局：' + gs.outs);
    t.assert(!!gs.bases[2], '跑者要安全回到三壘：' + JSON.stringify(gs.bases.map(b => !!b)));
    // 決定性失誤＝守方本來抓得到那個出局，所以守備機會是 2（接殺 1 ＋ 失誤 1）
    t.assert(gs.inningPotentialOuts === 2, '決定性失誤沒有算進守備機會：' + gs.inningPotentialOuts);
    const at = pos => {
      const b = gs.teams.b;
      return b.lineupSpots.map(sp => b.roster.find(p => p._id === sp.activePlayerId))
        .find(p => p && p.pos === pos) || {};
    };
    t.assert((at('2B').po || 0) === 1, '接到球的二壘手才該記刺殺：' + at('2B').po);
    t.assert((at('3B').po || 0) === 0, '沒抓到人的三壘手不該記刺殺：' + at('3B').po);
    t.assert((at('2B').e || 0) === 1, '二壘手要記一次失誤：' + at('2B').e);
    t.assert((at('2B').a || 0) === 0, '那一傳沒抓到人，不該算助殺：' + at('2B').a);
  });

  await t('多餘壘失誤不算守備機會', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '三壘安打');
    clickZone(w, 'infield', 'L');
    click(w, [...w.document.querySelectorAll('#field-result-panel button')]
      .find(x => x.textContent.trim() === '飛球出局'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options .dir-btn')]
      .find(b => b.textContent.trim().startsWith('二')));
    click(w, q('#modal-advanced-options button[data-step="add-error"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="select-error"]')]
      .find(x => x.textContent.trim().startsWith('二')));
    click(w, q('#modal-advanced-done'));                   // 維持預設的多餘壘失誤
    const gs = state(w);
    t.assert(gs.inningPotentialOuts === 1, '多餘壘失誤不該算守備機會：' + gs.inningPotentialOuts);
    t.assert(gs.teams.b.errors === 1, '失誤還是要記：' + gs.teams.b.errors);
  });

  await t('接殺後傳壘，漏接的是接球的人：敘述要寫「靠三壘手失誤」', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    play(w, q, 'outfield', '三壘安打');
    clickZone(w, 'infield', 'L');
    click(w, [...w.document.querySelectorAll('#field-result-panel button')]
      .find(x => x.textContent.trim() === '飛球出局'));
    const dir = c => [...w.document.querySelectorAll('#modal-advanced-options .dir-btn')]
      .find(b => b.textContent.trim().startsWith(c));
    click(w, dir('二')); click(w, dir('三'));
    click(w, q('#modal-advanced-options button[data-step="add-error"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="select-error"]')]
      .find(x => x.textContent.trim().startsWith('三')));       // 三壘手漏接
    click(w, q('#modal-advanced-options button[data-step="toggle-error-kind"]'));
    click(w, q('#modal-advanced-done'));
    const ev = state(w).events[state(w).events.length - 1].text;
    t.assert(ev.includes('二壘手傳給三壘手想封殺'), '沒有寫出那一傳：' + ev);
    t.assert(ev.includes('靠三壘手失誤安全回到三壘'), '失誤沒有算在漏接的人身上：' + ev);
  });
}
