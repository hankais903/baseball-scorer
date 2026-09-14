// 首頁（啟動畫面）：一進 APP 先看到這裡，有比賽進行中就直接跳過
import { boot, click, startGame, quickPlay } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function (t) {
  await t('沒有比賽在進行時，一開機會停在首頁', async () => {
    const { window: w, q } = await boot();
    t.assert(!q('#home-screen').classList.contains('hidden'), '沒有停在首頁');
    t.assert(w.document.body.classList.contains('home-open'), '沒有標記首頁開著');
    t.assert(!!q('#home-logo'), '首頁沒有 LOGO');
    t.assert(q('#home-logo').getAttribute('src').includes('logo'), 'LOGO 的圖不對：' + q('#home-logo').getAttribute('src'));
  });

  await t('首頁有四塊：繼續／新比賽／比賽紀錄／我的球隊', async () => {
    const { q } = await boot();
    for (const id of ['home-continue', 'home-new', 'home-games', 'home-teams']) {
      t.assert(!!q('#' + id), '首頁少了 ' + id);
    }
  });

  await t('沒有比賽時，最大那顆直接是「開始新比賽」，小的那顆收起來', async () => {
    const { q } = await boot();
    t.assert(q('#home-continue .home-card-label').textContent === '開始新比賽',
      '字樣不對：' + q('#home-continue .home-card-label').textContent);
    t.assert(q('#home-new').classList.contains('hidden'), '重複的「開始新比賽」沒有收起來');
  });

  await t('有比賽在進行時，一開機直接進比賽，不擋首頁', async () => {
    const first = await boot();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await boot({ storage: { baseballGameState: saved } });
    t.assert(q('#home-screen').classList.contains('hidden'), '有比賽在進行卻停在首頁');
    t.assert(!w.document.body.classList.contains('home-open'), '首頁沒有真的關掉');
  });

  await t('回到首頁時，最大那顆會寫出比分與局數', async () => {
    const first = await boot();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await boot({ storage: { baseballGameState: saved } });
    click(w, q('#home-btn'));
    t.assert(!q('#home-screen').classList.contains('hidden'), '點標題沒有回到首頁');
    t.assert(q('#home-continue .home-card-label').textContent === '繼續比賽',
      '字樣不對：' + q('#home-continue .home-card-label').textContent);
    const sub = q('#home-continue-sub').textContent;
    t.assert(/\d+\s*:\s*\d+/.test(sub) && /局[上下]/.test(sub), '沒有寫出比分與局數：' + sub);
    t.assert(!q('#home-new').classList.contains('hidden'), '有比賽在進行時要另外給「開始新比賽」');
  });

  await t('按「繼續比賽」會回到比賽頁', async () => {
    const first = await boot();
    startGame(first.window);
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await boot({ storage: { baseballGameState: saved } });
    click(w, q('#home-btn'));
    click(w, q('#home-continue'));
    t.assert(q('#home-screen').classList.contains('hidden'), '沒有離開首頁');
    t.assert(q('#mobile-nav .nav-dot[data-index="1"]').classList.contains('active'), '沒有停在比賽頁');
  });

  await t('沒打過的新比賽，按最大那顆直接進名單頁', async () => {
    const { window: w, q } = await boot();
    click(w, q('#home-continue'));
    t.assert(q('#home-screen').classList.contains('hidden'), '沒有離開首頁');
    t.assert(q('#mobile-nav .nav-dot[data-index="0"]').classList.contains('active'), '沒有停在名單頁');
  });

  await t('開新比賽會先問一次，確定後清空並到名單頁', async () => {
    const first = await boot();
    startGame(first.window);
    quickPlay(first.window, '三振');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await boot({ storage: { baseballGameState: saved } });
    click(w, q('#home-btn'));
    click(w, q('#home-new'));
    t.assert(!q('#confirm-modal').classList.contains('modal-hidden'), '沒有先問一次');
    click(w, q('#confirm-reset-btn'));
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.started === false && gs.outs === 0, '比賽沒有清乾淨');
    t.assert(q('#home-screen').classList.contains('hidden'), '沒有離開首頁');
    t.assert(q('#mobile-nav .nav-dot[data-index="0"]').classList.contains('active'), '沒有停在名單頁');
  });

  await t('「我的球隊」可以選要載入客隊還是主隊', async () => {
    const roster = [{
      id: 'r1', name: '測試隊', useDH: true,
      roster: Array.from({ length: 30 }, (_, i) => ({ name: i < 9 ? '測試員' + i : '', jersey: String(i), pos: '', photo: '' })),
    }];
    const { window: w, q } = await boot({ storage: { savedBaseballRosters: JSON.stringify(roster) } });
    click(w, q('#home-teams'));
    const btns = [...w.document.querySelectorAll('#saved-rosters-list .load-roster-item-btn')];
    t.assert(btns.map(b => b.textContent).join() === '載入客隊,載入主隊',
      '沒有給兩隊的選項：' + btns.map(b => b.textContent).join());
    t.assert(btns.map(b => b.dataset.team).join() === 'a,b', '按鈕沒有標明是哪一隊');
  });

  await t('名單頁進來的「載入名單」仍然只有一顆', async () => {
    const roster = [{ id: 'r1', name: '測試隊', useDH: true, roster: [] }];
    const { window: w, q } = await boot({ storage: { savedBaseballRosters: JSON.stringify(roster) } });
    click(w, q('#home-continue'));                  // 先離開首頁
    click(w, q('.load-roster-btn[data-team="a"]'));
    const btns = [...w.document.querySelectorAll('#saved-rosters-list .load-roster-item-btn')];
    t.assert(btns.length === 1 && btns[0].textContent === '載入', '名單頁的載入鍵不該變成兩顆：' + btns.map(b => b.textContent).join());
  });

  // 首頁疊在整個 APP 上面，但一定要低於視窗，否則從首頁叫出來的
  // 「我的球隊」「開新比賽」會被首頁整片蓋住看不到（踩過一次）
  await t('從首頁叫出來的視窗不會被首頁蓋住', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    const home = Number(((css.match(/#home-screen\{[^}]*\}/g) || []).join(' ').match(/z-index:\s*(\d+)/) || [])[1] || 0);
    t.assert(home > 50, '首頁要蓋過換頁列（z-index 50），目前 ' + home);
    t.assert(home < 100, '首頁不能蓋過視窗（遮罩 z-index 100），目前 ' + home);
    const { window: w, q } = await boot();
    click(w, q('#home-teams'));
    t.assert(!q('#load-roster-modal').classList.contains('modal-hidden'), '我的球隊沒有跳出來');
    t.assert(q('#load-roster-title').textContent === '我的球隊', '視窗標題不對：' + q('#load-roster-title').textContent);
  });

  await t('LOGO 有進離線清單，預覽檔也會內嵌', async () => {
    const fs = await import('fs');
    t.assert(fs.readFileSync('dist/service-worker.js', 'utf8').includes('./img/logo.webp'), 'LOGO 沒有進離線清單');
    t.assert(fs.readFileSync('tools/build-preview.mjs', 'utf8').includes("src=\"./img/logo.webp\""), '預覽檔沒有內嵌 LOGO');
    t.assert(fs.existsSync('dist/img/logo.webp'), 'LOGO 沒有被打包進 dist');
  });
}
