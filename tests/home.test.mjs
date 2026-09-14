// 建立球隊（第一次使用）與五分頁主畫面
import { boot, click, startGame, quickPlay } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEAM = {
  id: 'team_1', fullName: '新莊社區棒球隊', shortName: '新莊',
  logo: '', color: '#4a90e2', foundedAt: '2026-01-05',
  players: Array.from({ length: 9 }, (_, i) => ({ _id: 'm' + i, jersey: String(i + 1), name: i < 3 ? '選手' + i : '', pos: '' })),
  lineups: [],
};
// 已經建過球隊的狀態（大部分測試從這裡開始）
const withTeam = (extra = {}) => boot({ storage: { baseball_my_team: JSON.stringify(TEAM), ...extra } });
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };

export default async function (t) {
  // === 第一次使用 ===
  await t('第一次使用只出現「創建球隊」', async () => {
    const { window: w, q } = await boot();
    t.assert(!q('#onboard-screen').classList.contains('hidden'), '沒有停在建立球隊');
    t.assert(q('#main-shell').classList.contains('hidden'), '第一次使用不該看到主畫面');
    const shown = [...w.document.querySelectorAll('#onboard-screen .ob-step')].filter(s => !s.classList.contains('hidden'));
    t.assert(shown.length === 1 && shown[0].dataset.step === '0', '不是停在第一步：' + shown.map(s => s.dataset.step).join());
    t.assert(!!q('#ob-start'), '沒有創建球隊的按鈕');
  });

  await t('建立球隊三步：簡介 → 球員 → 主畫面', async () => {
    const { window: w, q } = await boot();
    click(w, q('#ob-start'));
    const step = () => [...w.document.querySelectorAll('#onboard-screen .ob-step')].find(s => !s.classList.contains('hidden')).dataset.step;
    t.assert(step() === '1', '沒有進到球隊簡介');
    t.assert(q('#ob-fullname').maxLength === 15, '全名沒有限制 15 字');
    t.assert(q('#ob-shortname').maxLength === 5, '簡稱沒有限制 5 字');
    type(w, q('#ob-fullname'), '新莊社區棒球隊');
    type(w, q('#ob-shortname'), '新莊');
    click(w, q('#ob-to-players'));
    t.assert(step() === '2', '沒有進到球員名單');
    const rows = w.document.querySelectorAll('#ob-players .ob-player');
    t.assert(rows.length === 9, '預設應該給九列：' + rows.length);
    t.assert(rows[3].querySelector('.ob-name').placeholder === '新莊04', '沒填名字的提示不是簡稱＋號碼：'
      + rows[3].querySelector('.ob-name').placeholder);
    click(w, q('#ob-finish'));
    await sleep(200);
    t.assert(q('#onboard-screen').classList.contains('hidden'), '沒有離開建立流程');
    t.assert(!q('#main-shell').classList.contains('hidden'), '沒有進到主畫面');
    const saved = JSON.parse(w.localStorage.getItem('baseball_my_team'));
    t.assert(saved.fullName === '新莊社區棒球隊' && saved.shortName === '新莊', '球隊沒有存好：' + JSON.stringify(saved).slice(0, 80));
    t.assert(saved.players.length === 9, '球員沒有存好：' + saved.players.length);
    t.assert(/^\d{4}-\d{2}-\d{2}$/.test(saved.foundedAt), '沒有記成立時間：' + saved.foundedAt);
  });

  await t('沒填名字與簡稱擋下來，只填一個就放行', async () => {
    const { window: w, q } = await boot();
    click(w, q('#ob-start'));
    click(w, q('#ob-to-players'));
    const step = () => [...w.document.querySelectorAll('#onboard-screen .ob-step')].find(s => !s.classList.contains('hidden')).dataset.step;
    t.assert(step() === '1', '兩個都沒填卻放行了');
    type(w, q('#ob-fullname'), '只有全名的隊');
    click(w, q('#ob-to-players'));
    t.assert(step() === '2', '只填全名應該要能過');
    t.assert(q('#ob-shortname').value === '只有全名的隊'.slice(0, 5), '沒有自動用全名前五字當簡稱：' + q('#ob-shortname').value);
  });

  await t('已經有球隊就不再出現建立流程', async () => {
    const { q } = await withTeam();
    t.assert(q('#onboard-screen').classList.contains('hidden'), '又跳出建立球隊');
    t.assert(!q('#main-shell').classList.contains('hidden'), '沒有進到主畫面');
  });

  // === 五個分頁 ===
  await t('底部有五個分頁，順序是首頁／球隊／比賽／成績／設定', async () => {
    const { window: w } = await withTeam();
    const tabs = [...w.document.querySelectorAll('#shell-nav .shell-tab')];
    t.assert(tabs.map(b => b.textContent.trim()).join() === '首頁,球隊,比賽,成績,設定',
      '分頁不對：' + tabs.map(b => b.textContent.trim()).join());
    t.assert(tabs.map(b => b.dataset.page).join() === 'home,team,game,stats,settings', '分頁代號不對');
  });

  await t('點分頁會換頁，一次只顯示一頁', async () => {
    const { window: w, q } = await withTeam();
    for (const page of ['team', 'game', 'stats', 'settings', 'home']) {
      click(w, q(`#shell-nav .shell-tab[data-page="${page}"]`));
      const shown = [...w.document.querySelectorAll('#main-shell .shell-page')].filter(s => !s.classList.contains('hidden'));
      t.assert(shown.length === 1 && shown[0].id === 'page-' + page, page + ' 沒有正確顯示：' + shown.map(s => s.id).join());
      t.assert(q(`#shell-nav .shell-tab[data-page="${page}"]`).classList.contains('active'), page + ' 的分頁沒有標示為目前頁');
    }
  });

  // === 球隊分頁 ===
  await t('球隊分頁顯示球隊資料，簡稱改得動', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    t.assert(q('#team-hero-name').textContent === '新莊社區棒球隊', '沒有顯示球隊名：' + q('#team-hero-name').textContent);
    t.assert(q('#team-short-input').value === '新莊', '簡稱沒帶出來');
    t.assert(q('#team-founded-input').value === '2026-01-05', '成立時間沒帶出來');
    t.assert(q('#team-players-count').textContent === '9 人', '球員人數不對：' + q('#team-players-count').textContent);
    type(w, q('#team-short-input'), '新北');
    await sleep(100);
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).shortName === '新北', '改了簡稱沒有存起來');
  });

  await t('球員子頁：列出全部球員，可以新增與刪除', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="players"]'));
    t.assert(!q('#shell-sub').classList.contains('hidden'), '沒有進到子頁');
    t.assert(q('#sub-title').textContent === '球員', '子頁標題不對：' + q('#sub-title').textContent);
    t.assert(w.document.querySelectorAll('#sub-body .mp-row').length === 9, '球員列數不對');
    t.assert(w.document.querySelectorAll('#sub-body .mp-row')[5].querySelector('.mp-name').placeholder === '新莊06',
      '沒填名字的提示不是簡稱＋號碼');
    click(w, q('#mp-add'));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).players.length === 10, '新增球員沒有存起來');
    click(w, w.document.querySelector('#sub-body .mp-row .mp-del'));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).players.length === 9, '刪除球員沒有存起來');
    click(w, q('#sub-back'));
    t.assert(q('#shell-sub').classList.contains('hidden'), '返回沒有離開子頁');
  });

  await t('常用陣容：新增一套、排打序、刪球員時會一起清掉', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="lineups"]'));
    click(w, q('#lu-add'));
    t.assert(w.document.querySelectorAll('#sub-body .lu-spot').length === 9, '沒有九個棒次');
    const first = q('#sub-body select[data-spot="0"]');
    first.value = 'm0';
    first.dispatchEvent(new w.Event('change', { bubbles: true }));
    let lu = JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0];
    t.assert(lu.spots[0] === 'm0', '打序沒有存起來：' + JSON.stringify(lu.spots));
    click(w, q('#lu-done'));
    t.assert(!!q('#sub-body .lu-item'), '回到列表沒有看到那一套');
    // 把 m0 刪掉，陣容裡那一格要跟著清空，不能指向不存在的球員
    click(w, q('#sub-back'));
    click(w, q('#page-team .team-row-link[data-sub="players"]'));
    click(w, w.document.querySelector('#sub-body .mp-row .mp-del'));
    lu = JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0];
    t.assert(lu.spots[0] === '', '球員刪掉了，陣容裡還留著他：' + JSON.stringify(lu.spots));
  });

  // === 首頁 ===
  await t('首頁：沒有比賽時不顯示「繼續比賽」，也沒有紀錄', async () => {
    const { q } = await withTeam();
    t.assert(q('#home-continue').classList.contains('hidden'), '沒有比賽卻顯示繼續比賽');
    t.assert(q('#home-game-list').textContent.includes('還沒有比賽紀錄'), '沒有說明還沒有紀錄');
  });

  await t('首頁：繼續比賽要看得出來是「進行中」', async () => {
    const first = await withTeam();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await withTeam({ baseballGameState: saved });
    click(w, q('#home-btn'));
    const card = q('#home-continue');
    t.assert(card.classList.contains('home-live'), '繼續比賽沒有用進行中的樣式');
    t.assert(card.textContent.includes('比賽進行中'), '沒有寫出比賽進行中：' + card.textContent.replace(/\s+/g, ' '));
    t.assert(!!card.querySelector('.live-badge i'), '沒有進行中的指示燈');
  });

  await t('首頁：比賽紀錄只列已結束的，而且可以刪除', async () => {
    const { window: w, q } = await withTeam();
    for (let i = 0; i < 40 && !w.baseballGameManager; i++) await sleep(50);
    const gm = w.baseballGameManager;
    const mk = (id, over) => gm.saveGame(id, {
      isGameOver: over, inning: 3, isTop: true, stadium: '新莊',
      teams: { a: { name: '新莊', score: [1] }, b: { name: '海盜', score: [0] } },
    });
    mk('g_done', true);
    mk('g_open', false);
    click(w, q('#shell-nav .shell-tab[data-page="home"]'));
    const items = [...w.document.querySelectorAll('#home-game-list .gl-item')];
    t.assert(items.length === 1 && items[0].dataset.game === 'g_done',
      '只該列出已結束的比賽：' + items.map(b => b.dataset.game).join());
    t.assert(!!q('#home-game-list .gl-del'), '沒有刪除鍵');
    w.confirm = () => true;
    click(w, q('#home-game-list .gl-del'));
    t.assert(!w.document.querySelector('#home-game-list .gl-item'), '刪除後列表沒有更新');
    t.assert(!gm.loadGame('g_done'), '比賽沒有真的被刪掉');
  });

  await t('常用陣容：關掉 DH 會收起先發投手欄位', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="lineups"]'));
    click(w, q('#lu-add'));
    t.assert(!q('#lu-pitcher-row').classList.contains('hidden'), '預設 DH 開著時應該有投手欄位');
    const dh = q('#lu-dh');
    dh.checked = false;
    dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(q('#lu-pitcher-row').classList.contains('hidden'), '關掉 DH 沒有收起投手欄位（看起來像沒反應）');
    t.assert(q('#lu-dh-hint').textContent.includes('投手自己打擊'), '沒有說明關掉 DH 的意思');
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0].useDH === false, 'DH 設定沒有存起來');
  });

  await t('新增球員後回球隊分頁，人數馬上更新', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    t.assert(q('#team-players-count').textContent === '9 人', '一開始人數不對');
    click(w, q('#page-team .team-row-link[data-sub="players"]'));
    click(w, q('#mp-add'));
    click(w, q('#sub-back'));
    t.assert(q('#team-players-count').textContent === '10 人',
      '返回後人數沒有更新：' + q('#team-players-count').textContent);
  });

  await t('首頁：有比賽在進行時，一開機直接進比賽', async () => {
    const first = await withTeam();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await withTeam({ baseballGameState: saved });
    t.assert(q('#main-shell').classList.contains('hidden'), '有比賽在進行卻停在主畫面');
    t.assert(!w.document.body.classList.contains('shell-open'), '主畫面沒有真的關掉');
  });

  await t('首頁：回到主畫面時，「繼續比賽」會寫出比分與局數', async () => {
    const first = await withTeam();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await withTeam({ baseballGameState: saved });
    click(w, q('#home-btn'));
    t.assert(!q('#main-shell').classList.contains('hidden'), '點標題沒有回到主畫面');
    t.assert(!q('#home-continue').classList.contains('hidden'), '沒有顯示繼續比賽');
    const sub = q('#home-continue-sub').textContent;
    t.assert(/\d+\s*:\s*\d+/.test(sub) && /局[上下]/.test(sub), '沒有寫出比分與局數：' + sub);
    click(w, q('#home-continue'));
    t.assert(q('#main-shell').classList.contains('hidden'), '按了繼續比賽沒有離開主畫面');
  });

  // === 設定 ===
  await t('設定頁的選項會存起來', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="settings"]'));
    for (const id of ['set-lang', 'set-innings', 'set-max-innings', 'set-dh', 'set-haptic', 'set-backup', 'set-restore', 'set-reset']) {
      t.assert(!!q('#' + id), '設定頁少了 ' + id);
    }
    const inn = q('#set-innings');
    inn.value = '7';
    inn.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_settings')).innings === 7, '局數設定沒有存起來');
    const dh = q('#set-dh');
    dh.checked = false;
    dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_settings')).dh === false, 'DH 設定沒有存起來');
  });

  await t('成績頁先預留，不是空白一片', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="stats"]'));
    t.assert(q('#page-stats').textContent.includes('累計成績'), '成績頁沒有說明之後會放什麼');
  });

  // === 疊層規則（踩過兩次的坑）===
  await t('主畫面蓋過換頁列，但低於視窗', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    const rule = (css.match(/#onboard-screen,#main-shell\{[^}]*\}|#main-shell\{[^}]*\}/g) || []).join(' ');
    const z = Number((rule.match(/z-index:\s*(\d+)/) || [])[1] || 0);
    t.assert(z > 50, '主畫面要蓋過換頁列（z-index 50），目前 ' + z);
    t.assert(z < 100, '主畫面不能蓋過視窗（遮罩 z-index 100），目前 ' + z);
    t.assert(/\.shell-open\s+#app-container\s*\{[^}]*visibility:\s*hidden/.test(css),
      '主畫面打開時沒有把比賽畫面藏起來，會透出來');
    const solid = (rule.match(/background:([^;}]*)/) || ['', ''])[1].match(/#[0-9a-f]{6}(?![0-9a-f])/gi) || [];
    t.assert(solid.length === 0, '薄紗裡有不透明的顏色，會蓋掉球場照：' + solid.join(','));
  });

  await t('LOGO 有進離線清單，預覽檔也會內嵌', async () => {
    const fs = await import('fs');
    t.assert(fs.readFileSync('dist/service-worker.js', 'utf8').includes('./img/logo.webp'), 'LOGO 沒有進離線清單');
    t.assert(fs.readFileSync('tools/build-preview.mjs', 'utf8').includes('src="./img/logo.webp"'), '預覽檔沒有內嵌 LOGO');
    t.assert(fs.existsSync('dist/img/logo.webp'), 'LOGO 沒有被打包進 dist');
  });
}
