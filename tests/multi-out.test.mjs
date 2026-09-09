// 雙殺／三殺的球種：滾地、平飛、高飛
import { boot, click, startGame, clickZone } from './harness.mjs';

async function run({ play, ball, taps = [], extraOut = [] }) {
  const { window: w, q } = await boot();
  w.alert = () => {};
  startGame(w);
  click(w, q('#quick-plays button[data-play="四壞"]'));
  click(w, q('#quick-plays button[data-play="四壞"]'));
  clickZone(w, 'infield');
  click(w, q(`#field-result-panel button[data-play="${play}"]`));
  if (ball) click(w, q(`#modal-advanced-options button[data-step="set-ball-type"][data-ball="${ball}"]`));
  const label = q('#modal-advanced-options .fielder-label em').textContent;
  for (const d of taps) {
    click(w, [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')].find(b => b.dataset.dir === d));
  }
  for (const r of extraOut) click(w, q(`#modal-advanced-options button[data-runner-id="${r}"][data-dest="0"]`));
  click(w, q('#modal-advanced-done'));
  const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
  const batter = gs.teams.a.roster.find(p => (p.abResults || []).some(r => r.startsWith(play)));
  return { w, label, log: q('#event-log li').textContent, outs: gs.outs, inning: q('#inning-display').textContent, batter };
}

export default async function (t) {
  await t('雙殺三殺才有球種選項，預設滾地球', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="雙殺"]'));
    const sel = q('#modal-advanced-options button[data-step="set-ball-type"].selected');
    t.assert(sel && sel.dataset.ball === 'G', '預設不是滾地球');
    click(w, q('.back-button-advanced'));
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="滾地"]'));
    t.assert(!q('#modal-advanced-options button[data-step="set-ball-type"]'), '一般滾地不該出現球種選項');
  });

  await t('滾地三殺：一二壘跑者預設出局，寫成傳殺鏈，半局結束', async () => {
    const r = await run({ play: '三殺' });
    t.assert(/滾地球，.*傳給.*，形成三殺（\d-\d-3）/.test(r.log), '敘述不對：' + r.log);
    t.assert(r.inning.includes('1局下'), '三殺後半局應結束：' + r.inning);
  });

  await t('平飛三殺：接殺後傳殺離壘跑者（4-6-3）', async () => {
    const r = await run({ play: '三殺', ball: 'L', taps: ['二', '游', '一'] });
    t.assert(r.log.includes('平飛球，二壘手接殺後傳給游擊手再傳給一壘手，形成三殺（4-6-3）'), '打者句不對：' + r.log);
    t.assert(r.log.includes('離壘過遠回壘不及，被傳殺出局'), '跑者句不對：' + r.log);
    t.assert(!r.log.includes('滾地球'), '平飛卻寫成滾地：' + r.log);
    t.assert(r.batter.abResults[0].startsWith('三殺@二游一~L'), 'abResults 沒帶球種：' + r.batter.abResults[0]);
  });

  await t('平飛三殺：一人獨力完成（4）', async () => {
    const r = await run({ play: '三殺', ball: 'L' });
    t.assert(r.label.includes('（4）') || r.label.includes('（6）') || r.label.includes('（5）') || r.label.includes('（1）'), '平飛預設鏈應只有接球者：' + r.label);
    t.assert(/接殺後獨力完成三殺（\d）/.test(r.log), '敘述不對：' + r.log);
  });

  await t('高飛雙殺：接殺後傳殺起跑的跑者，不算 GIDP', async () => {
    const r = await run({ play: '雙殺', ball: 'F', taps: ['中', '游'] });
    t.assert(r.log.includes('高飛球，中外野手接殺後傳給游擊手，形成雙殺（8-6）'), '打者句不對：' + r.log);
    t.assert(r.log.includes('接殺後起跑進壘，被傳殺出局'), '跑者句不對：' + r.log);
    t.assert(r.outs === 2, `出局數 ${r.outs}`);
    t.assert(r.batter.gidp === 0, '高飛雙殺不該算 GIDP');
  });

  await t('滾地雙殺仍算 GIDP', async () => {
    const r = await run({ play: '雙殺', taps: ['游', '二', '一'] });
    t.assert(r.log.includes('形成雙殺（6-4-3）'), '敘述不對：' + r.log);
    t.assert(r.batter.gidp === 1, '滾地雙殺應算 GIDP');
  });

  await t('正式記錄表：滾地雙殺 GDP、平飛雙殺 L…DP、三殺 TP', async () => {
    const { window: w } = await boot();
    startGame(w);
    const state = JSON.parse(w.localStorage.getItem('baseballGameState'));
    state.teams.a.roster[0].abResults = ['雙殺@游二一#1', '雙殺@中游~F#2', '三殺@二游一~L#3', '三殺@二~L#4'];
    const html = w.buildOfficialSheet(state);
    t.assert(html.includes('6-4-3 GDP'), '沒有 6-4-3 GDP');
    t.assert(html.includes('F8-6 DP'), '沒有 F8-6 DP');
    t.assert(html.includes('L4-6-3 TP'), '沒有 L4-6-3 TP');
    t.assert(html.includes('L4 TP'), '沒有 L4 TP');
  });
}
