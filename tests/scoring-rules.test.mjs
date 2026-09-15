// 三條會把分數算錯的記錄規則：
// 1. 第三個出局是封殺時，同時衝回本壘的分數不算（規則 5.08(a)）
// 2. 雙殺、三殺造成的得分不記打點（規則 9.04(b)）
// 3. 換投之後，繼承跑者的失分算在「讓他上壘的那位投手」頭上
import { boot, click, startGame, quickPlay, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeCtx(w, q) {
  // 走完一次「標落點 → 選結果 →（失誤問答）→ 調整跑者 → 完成」
  const play = (zone, playName, tweak, ball = 'all') => {
    clickZone(w, zone, ball);
    const b = q(`#field-result-panel button[data-play="${playName}"]`);
    if (!b) throw new Error('球場選項沒有 ' + playName);
    click(w, b);
    const pos = q('#modal-advanced-options button[data-step="select-error"]');
    if (pos) click(w, pos);
    const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')]
      .find(x => x.dataset.choice === 'no');
    if (no) click(w, no);
    if (tweak) tweak();
    const done = q('#modal-advanced-done');
    if (done.disabled) throw new Error('完成被鎖住：' + q('#modal-advanced-summary').textContent);
    click(w, done);
  };
  // 指定某位跑者的去向（0＝出局、4＝得分）
  const setDest = (baseIndex, dest) => {
    const b = q(`#modal-advanced-options button[data-step="set-runners"][data-runner-id="${baseIndex}"][data-dest="${dest}"]`);
    if (!b) throw new Error(`找不到${baseIndex + 1}壘跑者的「${dest === 0 ? '出局' : dest === 4 ? '得分' : dest + '壘'}」`);
    click(w, b);
  };
  const state = () => JSON.parse(w.localStorage.getItem('baseballGameState'));
  const runs = () => (state().teams.a.score || []).reduce((x, y) => x + (y || 0), 0);
  const lastEvent = () => {
    const evs = state().events || [];
    return evs.length ? evs[evs.length - 1].text : '';
  };
  return { play, setDest, state, runs, lastEvent };
}

export default async function (t) {
  // === 1. 第三個出局是封殺 ===
  await t('兩出局後打者被封殺在一壘，三壘跑者跑回來也不算分', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const { play, setDest, runs, lastEvent, state } = makeCtx(w, q);
    quickPlay(w, '三振');
    quickPlay(w, '三振');
    play('outfield', '三安');                       // 兩出局、三壘有人
    t.assert(runs() === 0, '三壘安打不該得分');
    play('infield', '滾地', () => setDest(2, 4), 'G');   // 打者被封殺在一壘，三壘跑者衝本壘
    t.assert(runs() === 0, '第三個出局是封殺，這一分不該算，卻算了 ' + runs() + ' 分');
    t.assert(lastEvent().includes('第三個出局是封殺'), '沒有說明為什麼這一分不算：' + lastEvent());
    const p = state().teams.b.pitchers.find(x => x._id === state().teams.b.activePitcherId);
    t.assert(p.r === 0 && p.er === 0, `投手也不該被記失分：R=${p.r} ER=${p.er}`);
  });

  await t('只有一出局時，同樣的滾地球該算分就要算分', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const { play, setDest, runs } = makeCtx(w, q);
    quickPlay(w, '三振');
    play('outfield', '三安');                       // 一出局、三壘有人
    play('infield', '滾地', () => setDest(2, 4), 'G');
    t.assert(runs() === 1, '還沒滿三出局，這一分要算：目前 ' + runs() + ' 分');
  });

  await t('高飛犧牲打的第三個出局不算封殺，分數照算', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const { play, setDest, runs } = makeCtx(w, q);
    quickPlay(w, '三振');
    quickPlay(w, '三振');
    play('outfield', '三安');
    play('outfield', '犧飛', () => setDest(2, 4), 'F');
    t.assert(runs() === 1, '飛球接殺不是封殺，這一分要算：目前 ' + runs() + ' 分');
  });

  // === 2. 雙殺不給打點 ===
  await t('雙殺送回來的分數不記打點', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const { play, setDest, runs, state } = makeCtx(w, q);
    play('outfield', '三安');            // 三壘有人
    quickPlay(w, '四壞');                 // 一壘也有人，無人出局
    const before = state().teams.a.roster[2].rbi;
    play('infield', '雙殺', () => { setDest(0, 0); setDest(2, 4); }, 'G');
    const after = JSON.parse(w.localStorage.getItem('baseballGameState')).teams.a.roster[2];
    t.assert(runs() === 1, '雙殺期間三壘跑者回來得分，分數要算：目前 ' + runs() + ' 分');
    t.assert(after.rbi === before, '雙殺造成的得分不該給打點（規則 9.04(b)），卻給了 ' + (after.rbi - before));
    t.assert(after.gidp === 1, '沒有記雙殺打');
  });

  await t('一般滾地球送回來的分數照樣記打點', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const { play, setDest, state } = makeCtx(w, q);
    play('outfield', '三安');
    play('infield', '滾地', () => setDest(2, 4), 'G');
    const batter = JSON.parse(w.localStorage.getItem('baseballGameState')).teams.a.roster[1];
    t.assert(batter.rbi === 1, '一般滾地球的得分要記打點：目前 ' + batter.rbi);
  });

  // === 3. 繼承跑者的責失 ===
  await t('換投後，前一位投手放上壘的跑者得分算前一位的責失', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    // 守備方（主隊）補一位板凳投手才能換投
    click(w, q('.bench-add-btn[data-team="b"]'));
    const row = [...w.document.querySelectorAll('#team-b-bench .lineup-player')]
      .find(r => !r.classList.contains('bench-hidden') && !r.querySelector('input[data-type="name"]').value);
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = '救援投手'; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(250);

    startGame(w);
    const { play, state } = makeCtx(w, q);
    play('outfield', '一安');             // 第一位投手讓人上壘

    click(w, q('#management-btn'));
    click(w, q('#change-pitcher-btn'));
    const item = [...q('#picker-list').querySelectorAll('.picker-item')].find(b => b.textContent.includes('救援投手'));
    t.assert(!!item, '板凳裡找不到救援投手');
    click(w, item);
    await sleep(100);

    play('outfield', '本打');             // 接手的投手被打兩分全壘打

    const gs = state();
    const ps = gs.teams.b.pitchers;
    const first = ps[0];
    const relief = ps.find(p => p.name === '救援投手');
    t.assert(!!relief, '換投沒有成功：' + ps.map(p => p.name).join());
    t.assert(first.r === 1 && first.er === 1,
      `前一位投手該記 1 失 1 責失（他放上壘的那個人回來得分），實際 R=${first.r} ER=${first.er}`);
    t.assert(relief.r === 1 && relief.er === 1,
      `接手的投手只該記自己被打的那一分，實際 R=${relief.r} ER=${relief.er}`);
  });
}
