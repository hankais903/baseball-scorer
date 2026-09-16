// 第二波規則：局數／延長設定、提前結束（扣倒）、突破僵局制、
// 內野高飛必死球、不死三振被刺殺、雙盜壘
import { boot, click, startGame, quickPlay, clickZone, markPoint, openAtBatMenu } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 直接把規則塞進比賽狀態再重新載入，比走完建立比賽流程快
async function bootWithRules(rules) {
  const { window: w, q } = await boot();
  w.alert = () => {};
  startGame(w);
  const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
  gs.rules = Object.assign({ innings: 9, maxInnings: 12, mercy: [], tiebreakFrom: 0, tiebreakBases: '2' }, rules);
  w.localStorage.setItem('baseballGameState', JSON.stringify(gs));
  w.__adoptSavedGame(gs);
  return { w, q, state: () => JSON.parse(w.localStorage.getItem('baseballGameState')) };
}

// 打完一個半局（三個三振）
const threeOuts = w => { quickPlay(w, '三振'); quickPlay(w, '三振'); quickPlay(w, '三振'); };

// 打一支全壘打（全壘打要走「標落點 → 選結果 → 完成」那條路）
function homer(w) {
  clickZone(w, 'outfield');
  const b = [...w.document.querySelectorAll('#field-result-panel button')]
    .find(x => x.textContent.trim() === '全壘打');
  if (!b) throw new Error('結果選單裡沒有全壘打');
  click(w, b);
  const done = w.document.getElementById('modal-advanced-done');
  if (done) click(w, done);
}

export default async function (t) {
  // === 局數設定 ===
  await t('七局制：打完七局就結束，不會硬要打到九局', async () => {
    const { w, state } = await bootWithRules({ innings: 7 });
    // 客隊先得一分，之後兩邊都三上三下
    homer(w);
    for (let i = 0; i < 14 && !state().isGameOver; i++) threeOuts(w);
    const gs = state();
    t.assert(gs.isGameOver, '七局制沒有結束，現在是 ' + gs.inning + '局');
    t.assert(gs.inning === 7, '應該停在第七局，實際第 ' + gs.inning + ' 局');
  });

  await t('九局制不會在第七局就結束', async () => {
    const { w, state } = await bootWithRules({ innings: 9 });
    homer(w);
    for (let i = 0; i < 14 && state().inning < 8; i++) threeOuts(w);
    t.assert(!state().isGameOver, '九局制卻提早結束了');
  });

  await t('延長上限設成不限就一直打下去', async () => {
    // 三局制＋不限延長：打到第 13 局都不該自己結束（預設上限是 12）
    const { w, state } = await bootWithRules({ innings: 3, maxInnings: 0 });
    for (let i = 0; i < 30 && state().inning < 13; i++) threeOuts(w);
    t.assert(!state().isGameOver, '設成不限延長卻自己結束了（第 ' + state().inning + ' 局）');
    t.assert(state().inning >= 13, '沒有打到第 13 局：' + state().inning);
  });

  // === 提前結束（扣倒）===
  await t('五局後領先十分就提前結束', async () => {
    const { w, state } = await bootWithRules({ innings: 9, mercy: [{ inn: 5, diff: 10 }] });
    // 客隊第一局先灌 10 分
    for (let i = 0; i < 10; i++) homer(w);
    threeOuts(w);
    t.assert(!state().isGameOver, '第一局就結束了，扣倒不該這麼早生效');
    // 打到第五局
    for (let i = 0; i < 12 && state().inning < 5; i++) threeOuts(w);
    for (let i = 0; i < 4 && !state().isGameOver; i++) threeOuts(w);
    const gs = state();
    t.assert(gs.isGameOver, '五局後領先十分卻沒有提前結束（第 ' + gs.inning + ' 局）');
    t.assert(gs.inning <= 6, '拖太久才結束：第 ' + gs.inning + ' 局');
  });

  await t('沒設定扣倒就要照常打完', async () => {
    const { w, state } = await bootWithRules({ innings: 9, mercy: [] });
    for (let i = 0; i < 10; i++) homer(w);
    for (let i = 0; i < 12 && state().inning < 6; i++) threeOuts(w);
    t.assert(!state().isGameOver, '沒設定扣倒卻提前結束了');
  });

  // === 突破僵局制 ===
  await t('第十局起二壘有人開始，而且那一分不算責失', async () => {
    // 用三局制，第四局就是延長賽，不必空打十局
    const { w, state } = await bootWithRules({ innings: 3, maxInnings: 0, tiebreakFrom: 4, tiebreakBases: '2' });
    for (let i = 0; i < 10 && state().inning < 4; i++) threeOuts(w);
    const gs = state();
    t.assert(gs.inning === 4, '沒有打到第四局：' + gs.inning);
    t.assert(!!gs.bases[1] && !gs.bases[0] && !gs.bases[2], '第十局開始時二壘沒有人：' + JSON.stringify(gs.bases.map(b => !!b)));
    t.assert(gs.bases[1].isUnearned === true, '突破僵局的跑者得分應該不算責失');
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('突破僵局制'), '沒有說明是突破僵局制：' + ev);
    // 這位跑者回來得分：算球隊失分，不算投手的（WBSC 附錄 2），所以投手只記全壘打那一分
    homer(w);
    const after = state();
    const p = after.teams.b.pitchers.find(x => x._id === after.teams.b.activePitcherId);
    t.assert(p.r === 1, '突破僵局放上壘的那一分不該算投手失分，實際 ' + p.r);
    t.assert(p.er === 1, '打者自己的全壘打那一分要算責失，實際責失 ' + p.er);
    t.assert((after.teams.a.score || []).reduce((x, y) => x + (y || 0), 0) === 2,
      '計分板上還是要有兩分');
  });

  await t('一二壘版本：前一棒在一壘、前兩棒在二壘', async () => {
    const { w, state } = await bootWithRules({ innings: 3, maxInnings: 0, tiebreakFrom: 4, tiebreakBases: '12' });
    for (let i = 0; i < 10 && state().inning < 4; i++) threeOuts(w);
    const gs = state();
    t.assert(!!gs.bases[0] && !!gs.bases[1] && !gs.bases[2], '一二壘沒有各放一位：' + JSON.stringify(gs.bases.map(b => !!b)));
  });

  await t('沒開突破僵局制，延長賽照樣從無人在壘開始', async () => {
    const { w, state } = await bootWithRules({ innings: 3, maxInnings: 0, tiebreakFrom: 0 });
    for (let i = 0; i < 10 && state().inning < 4; i++) threeOuts(w);
    t.assert(state().bases.every(b => !b), '沒開卻自己放了跑者');
  });

  // === 內野高飛必死球 ===
  await t('一二壘有人、不到兩出局才列出內野高飛必死球', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    const option = () => {
      clickZone(w, 'infield', 'F');
      const all = [...w.document.querySelectorAll('#field-result-panel button')].map(b => b.textContent.trim());
      const found = all.includes('內野高飛必死球');
      click(w, q('#field-result-panel button[data-cancel="1"]'));
      return found;
    };
    t.assert(!option(), '壘上無人時不該出現內野高飛必死球');
    quickPlay(w, '四壞');
    t.assert(!option(), '只有一壘有人時不該出現');
    quickPlay(w, '四壞');
    t.assert(option(), '一二壘有人時應該出現內野高飛必死球');
  });

  await t('內野高飛必死球：打者出局，壘上的人留在原地', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');
    quickPlay(w, '四壞');
    quickPlay(w, '三振');   // 一出局、一二壘有人
    clickZone(w, 'infield', 'F');
    const btn = [...w.document.querySelectorAll('#field-result-panel button')]
      .find(b => b.textContent.trim() === '內野高飛必死球');
    t.assert(!!btn, '一出局、一二壘有人時應該選得到內野高飛必死球');
    click(w, btn);
    const done = q('#modal-advanced-done');
    t.assert(done && !done.disabled, '完成被鎖住：' + (q('#modal-advanced-summary') || {}).textContent);
    click(w, done);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.outs === 2, '打者沒有出局，出局數是 ' + gs.outs);
    t.assert(!!gs.bases[0] && !!gs.bases[1], '跑者不該被封殺，壘包：' + JSON.stringify(gs.bases.map(b => !!b)));
    const ev = gs.events.map(e => e.text).join(' ');
    t.assert(ev.includes('內野高飛必死球'), '敘述沒有寫出內野高飛必死球：' + ev.slice(-80));
  });

  // === 不死三振被刺殺 ===
  await t('不死三振被刺殺：打者出局，投手照樣記一次三振', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    openAtBatMenu(w);
    click(w, q('#field-result-panel button[data-play="__more"]'));
    click(w, [...w.document.querySelectorAll('#modal-step-1 button')].find(b => b.textContent.trim() === '出局'));
    const btn = [...w.document.querySelectorAll('#modal-options-step-2 button')]
      .find(b => b.textContent.includes('不死三振'));
    t.assert(!!btn, '出局清單裡沒有不死三振：'
      + [...w.document.querySelectorAll('#modal-options-step-2 button')].map(b => b.textContent.trim()).join());
    click(w, btn);
    const done = q('#modal-advanced-done');
    if (done && !done.disabled) click(w, done);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.outs === 1, '打者沒有出局：' + gs.outs);
    const p = gs.teams.b.pitchers.find(x => x._id === gs.teams.b.activePitcherId);
    t.assert(p.k === 1, '投手沒有記到三振：' + p.k);
    t.assert(gs.teams.a.roster[0].so === 1, '打者沒有記到三振');
  });

  // === 雙盜壘 ===
  await t('兩位跑者同時盜壘可以一次記完，敘述寫成雙盜壘', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    quickPlay(w, '四壞');
    quickPlay(w, '四壞');
    click(w, q('#runner-action-btn'));
    const pick = txt => {
      const b = [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === txt);
      if (b) click(w, b);
      return !!b;
    };
    pick('盜壘'); pick('否，繼續');
    const rows = w.document.querySelectorAll('#runner-action-details .runner-placement-row');
    t.assert(rows.length === 2, '兩位跑者應該各有一列可以指定：' + rows.length);
    click(w, q('button[data-step="set-dest"][data-runner-id="1"][data-dest="3"]'));
    click(w, q('button[data-step="set-dest"][data-runner-id="0"][data-dest="2"]'));
    const done = [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成/.test(b.textContent));
    click(w, done);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(!gs.bases[0] && !!gs.bases[1] && !!gs.bases[2], '兩位跑者沒有各推進一個壘：'
      + JSON.stringify(gs.bases.map(b => !!b)));
    const ev = gs.events[gs.events.length - 1].text;
    t.assert(ev.includes('雙盜壘'), '敘述沒有寫成雙盜壘：' + ev);
  });
}
