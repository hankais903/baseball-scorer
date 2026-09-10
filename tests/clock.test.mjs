// 比賽計時：可以暫停、繼續，也可以提前結束
import { boot, click } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = w => JSON.parse(w.localStorage.getItem('baseballGameState'));

export default async function (t) {
  await t('開賽後計時器會顯示', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(100);
    t.assert(!q('#game-clock').classList.contains('hidden'), '計時器沒有顯示');
    t.assert(state(w).pausedAt === null, '一開始不該是暫停狀態');
  });

  await t('可以暫停與繼續，暫停的時間不算進去', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(60);
    w.__toggleClockPause();
    const paused = state(w);
    t.assert(typeof paused.pausedAt === 'number', '暫停後沒有記下暫停起點');
    const shown = q('#game-clock').textContent;
    await sleep(120);
    t.assert(q('#game-clock').textContent === shown, '暫停中時間還在跑：' + shown + ' → ' + q('#game-clock').textContent);
    w.__toggleClockPause();
    const resumed = state(w);
    t.assert(resumed.pausedAt === null, '繼續後仍停在暫停狀態');
    t.assert(resumed.pausedMs > 0, '暫停的時間沒有被扣掉：' + resumed.pausedMs);
  });

  await t('可以提前結束計時，之後時間就定住', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(60);
    w.__stopClock();
    const s = state(w);
    t.assert(typeof s.endTime === 'number', '沒有記下結束時間');
    t.assert(q('#game-clock').classList.contains('stopped'), '計時器沒有標成已停止');
    const shown = q('#game-clock').textContent;
    await sleep(120);
    t.assert(q('#game-clock').textContent === shown, '結束後時間還在跑');
  });

  await t('暫停中按結束，時間停在暫停的那一刻', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(60);
    w.__toggleClockPause();
    const pausedAt = state(w).pausedAt;
    await sleep(80);
    w.__stopClock();
    t.assert(state(w).endTime === pausedAt, '結束時間不是暫停的那一刻');
    t.assert(state(w).pausedAt === null, '結束後還留著暫停起點');
  });

  await t('點計時器會叫出暫停與結束選單', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    await sleep(100);
    click(w, q('#game-clock'));
    const menu = q('#clock-menu');
    t.assert(menu && !menu.classList.contains('modal-hidden'), '選單沒有打開');
    t.assert(q('#clock-pause-btn').textContent === '暫停計時', '按鈕文字不對');
    click(w, q('#clock-pause-btn'));
    await sleep(60);
    t.assert(state(w).pausedAt !== null, '按了暫停沒有生效');
    click(w, q('#game-clock'));
    t.assert(q('#clock-pause-btn').textContent === '繼續計時', '暫停後按鈕沒有變成繼續');
  });
}
