// 三壘有人時的本壘攻防：高飛觸殺、傳本壘的野手選擇、6-2-3
import { boot, click, startGame, clickZone } from './harness.mjs';

async function run({ zone, play, taps, runnerDest, batterDest, fcChoice }) {
  const { window: w, q } = await boot();
  w.alert = () => {};
  startGame(w);
  clickZone(w, 'outfield');
  click(w, q('#field-result-panel button[data-play="三安"]'));
  click(w, q('#modal-advanced-done'));
  clickZone(w, zone);
  click(w, q(`#field-result-panel button[data-play="${play}"]`));
  if (fcChoice !== undefined) {
    click(w, q(`#modal-advanced-options button[data-step="select-fc-out"][data-out-runner-base="${fcChoice}"]`));
  }
  const fb = d => [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')]
    .find(b => b.dataset.dir === d);
  for (const d of taps) click(w, fb(d));
  if (runnerDest !== undefined) click(w, q(`#modal-advanced-options button[data-runner-id="2"][data-dest="${runnerDest}"]`));
  if (batterDest !== undefined) click(w, q(`#modal-advanced-options button[data-runner-id="batter"][data-dest="${batterDest}"]`));
  const summary = q('#modal-advanced-summary').textContent;
  const locked = q('#modal-advanced-done').disabled;
  if (!locked) click(w, q('#modal-advanced-done'));
  const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
  const batter = gs.teams.a.roster.find(p => (p.abResults || []).some(r => r.startsWith(play)));
  return {
    summary, locked, log: locked ? '' : q('#event-log li').textContent,
    outs: gs.outs, runs: gs.teams.b.pitchers[0].r, bases: gs.bases.map(b => !!b),
    batter
  };
}

export default async function (t) {
  await t('外野飛球接殺後三壘跑者回本壘被觸殺（8-2），記兩個出局', async () => {
    const r = await run({ zone: 'outfield', play: '飛球', taps: ['中', '捕'], runnerDest: 0 });
    t.assert(r.outs === 2, `出局數 ${r.outs}`);
    t.assert(r.runs === 0, '不該有得分');
    t.assert(r.log.includes('接殺出局'), '打者句不對：' + r.log);
    t.assert(r.log.includes('回本壘，被中外野手傳給捕手觸殺出局'), '跑者句不對：' + r.log);
    t.assert(r.batter.ab === 1 && r.batter.sf === 0, '應計打數、不計犧飛');
  });

  await t('犧牲飛球但沒有人得分會被擋下', async () => {
    const r = await run({ zone: 'outfield', play: '犧飛', taps: ['中', '捕'], runnerDest: 0 });
    t.assert(r.locked, '犧飛沒人得分卻能完成');
    t.assert(r.summary.includes('犧牲飛球必須有跑者回本壘'), '沒有說明原因：' + r.summary);
  });

  await t('飛球有人得分時提示應記犧飛', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="三安"]'));
    click(w, q('#modal-advanced-done'));
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="飛球"]'));
    click(w, q('#modal-advanced-options button[data-runner-id="2"][data-dest="4"]'));
    t.assert(q('#modal-advanced-summary').textContent.includes('犧牲飛球'), '沒有提示改記犧飛');
    t.assert(!q('#modal-advanced-done').disabled, '提示不該鎖住完成');
  });

  await t('內野滾地傳本壘觸殺跑者、打者上一壘（野選 6-2）', async () => {
    const r = await run({ zone: 'infield', play: '野手選擇', fcChoice: '2', taps: ['游', '捕'], batterDest: 1 });
    t.assert(r.outs === 1 && r.runs === 0, `出局 ${r.outs} 得分 ${r.runs}`);
    t.assert(r.bases[0] && !r.bases[2], '壘包狀態不對：' + r.bases.join());
    t.assert(r.log.includes('選擇傳向本壘處理跑者'), '打者句不對：' + r.log);
    t.assert(r.log.includes('衝本壘時被游擊手傳給捕手觸殺出局'), '跑者句不對：' + r.log);
    t.assert(r.batter.ab === 1 && r.batter.h === 0, '野手選擇應計打數、不計安打');
  });

  await t('內野滾地傳本壘未及、跑者得分、打者上一壘（野選無人出局）', async () => {
    const r = await run({ zone: 'infield', play: '野手選擇', fcChoice: 'none', taps: ['游', '捕'], runnerDest: 4, batterDest: 1 });
    t.assert(r.outs === 0 && r.runs === 1, `出局 ${r.outs} 得分 ${r.runs}`);
    t.assert(r.bases[0] && !r.bases[2], '壘包狀態不對');
    t.assert(r.log.includes('回到本壘得分'), '跑者句不對：' + r.log);
    t.assert(r.batter.rbi === 1, '野手選擇得分應給打點');
    t.assert(r.batter.h === 0, '不該算安打');
  });

  await t('傳本壘刺殺跑者再傳一壘，記雙殺 6-2-3', async () => {
    const r = await run({ zone: 'infield', play: '雙殺', taps: ['游', '捕', '一'], runnerDest: 0 });
    t.assert(r.outs === 2, `出局數 ${r.outs}`);
    t.assert(r.log.includes('形成雙殺'), '敘述不對：' + r.log);
  });

  await t('傳本壘跑者安全、再傳一壘刺殺打者，記 6-2-3 滾地出局並得分', async () => {
    const r = await run({ zone: 'infield', play: '滾地', taps: ['游', '捕', '一'], runnerDest: 4 });
    t.assert(r.outs === 1 && r.runs === 1, `出局 ${r.outs} 得分 ${r.runs}`);
    t.assert(r.log.includes('封殺出局'), '敘述不對：' + r.log);
    t.assert(r.batter.rbi === 1, '應有打點');
  });
}
