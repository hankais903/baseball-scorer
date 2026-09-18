// 建立球隊（第一次使用）與五分頁主畫面
import { boot, click, startGame, quickPlay } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEAM = {
  id: 'team_1', fullName: '新莊社區棒球隊', shortName: '新莊',
  logo: '', color: '#4a90e2', foundedAt: '2026-01-05',
  players: Array.from({ length: 9 }, (_, i) => ({ _id: 'm' + i, jersey: String(i + 1), name: i < 3 ? '選手' + i : '', pos: '' })),
  lineups: [],
};
// 已經建過球隊的狀態（大部分測試從這裡開始）。
// v2.22 起開機一律停在啟動畫面，所以這裡幫忙按一下「進入」到主畫面。
// 要驗啟動畫面本身的測試改用 launch()。
const launch = (extra = {}) => boot({ storage: { baseball_my_team: JSON.stringify(TEAM), ...extra } });
const withTeam = async (extra = {}) => {
  const ctx = await launch(extra);
  const enter = ctx.q('#ob-enter');
  if (enter && !enter.classList.contains('hidden')) click(ctx.window, enter);
  return ctx;
};
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

  await t('已經有球隊：啟動畫面換成進入／我的球隊，不再叫你建立球隊', async () => {
    const { window: w, q } = await launch();
    t.assert(!q('#onboard-screen').classList.contains('hidden'), '啟動畫面沒有出現');
    t.assert(q('#ob-start').classList.contains('hidden'), '已經有球隊還叫人創建球隊');
    t.assert(!q('#ob-enter').classList.contains('hidden'), '沒有「進入」');
    t.assert(!q('#ob-team').classList.contains('hidden'), '沒有「我的球隊」');
    t.assert(q('#ob-resume').classList.contains('hidden'), '沒有比賽卻顯示繼續比賽');
    click(w, q('#ob-enter'));
    t.assert(!q('#main-shell').classList.contains('hidden'), '按了進入沒有到主畫面');
    t.assert(q('#onboard-screen').classList.contains('hidden'), '啟動畫面沒有收起來');
  });

  await t('已經有球隊：按「我的球隊」直接到球隊分頁', async () => {
    const { window: w, q } = await launch();
    click(w, q('#ob-team'));
    t.assert(!q('#main-shell').classList.contains('hidden'), '沒有到主畫面');
    t.assert(!q('#page-team').classList.contains('hidden'), '停的不是球隊分頁');
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
    t.assert(!q('#team-founded-input'), '成立時間欄應該已經移除');
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
    // 沒填名字的用「簡稱＋背號」（第 6 列的背號是 6）
    t.assert(w.document.querySelectorAll('#sub-body .mp-row')[5].querySelector('.mp-name').placeholder === '新莊6',
      '沒填名字的提示不是簡稱＋背號：' + w.document.querySelectorAll('#sub-body .mp-row')[5].querySelector('.mp-name').placeholder);
    t.assert(!!w.document.querySelector('#sub-body .mp-photo input[type="file"]'), '球員列少了頭像上傳');
    t.assert(!w.document.querySelector('#sub-body .mp-pos'), '球員名單不該顯示守位');
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

  // 這個專案沒有共用的 .hidden 規則，每個要收起來的東西都得自己寫一條。
  // v2.0 改版時 .home-card 那一組被刪掉，卡片因此收不起來、也沒有排版（踩過一次）
  await t('沒有比賽時，繼續比賽的卡片真的收得起來', async () => {
    const { window: w, q } = await withTeam();
    const card = q('#home-continue');
    t.assert(card.classList.contains('hidden'), '沒有加上收起來的標記');
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/\.home-card\.hidden\{[^}]*display:\s*none/.test(css), '.home-card.hidden 沒有真的收起來');
    t.assert(/\.home-card\{[^}]*display:\s*flex/.test(css), '.home-card 的排版樣式不見了');
    t.assert(/\.home-card::?after\{/.test(css), '卡片右邊的箭頭不見了');
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
    click(w, q('#home-game-list .gl-del'));
    t.assert(!q('#ask-modal').classList.contains('hidden'), '刪除前沒有先問');
    click(w, q('#ask-yes'));
    t.assert(!w.document.querySelector('#home-game-list .gl-item'), '刪除後列表沒有更新');
    t.assert(!gm.loadGame('g_done'), '比賽沒有真的被刪掉');
  });

  // DH 原本是小勾選框，按了看不出有沒有切換到。改成兩顆按鈕
  await t('常用陣容：DH 是兩顆按鈕，切換看得出來', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="lineups"]'));
    click(w, q('#lu-add'));
    t.assert(w.document.querySelectorAll('#lu-dh .dh-btn').length === 2, 'DH 不是兩顆按鈕');
    t.assert(q('#lu-dh .dh-btn[data-dh="1"]').classList.contains('active'), '預設應該是 DH 制');
    t.assert(!q('#lu-pitcher-row').classList.contains('hidden'), 'DH 制時應該有投手欄位');
    click(w, q('#lu-dh .dh-btn[data-dh="0"]'));
    t.assert(q('#lu-dh .dh-btn[data-dh="0"]').classList.contains('active'), '切到投手打擊沒有變色');
    t.assert(q('#lu-pitcher-row').classList.contains('hidden'), '投手打擊時應該收起投手欄位');
    t.assert(q('#lu-dh-hint').textContent.includes('投手自己打擊'), '沒有說明投手打擊的意思');
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0].useDH === false, 'DH 設定沒有存起來');
    click(w, q('#lu-dh .dh-btn[data-dh="1"]'));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0].useDH === true, '切回 DH 制沒有存起來');
  });

  await t('常用陣容：每一棒可以排守位', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="lineups"]'));
    click(w, q('#lu-add'));
    const pos = [...w.document.querySelectorAll('#sub-body .lu-pos')];
    t.assert(pos.length === 9, '不是九個守位欄位：' + pos.length);
    pos[0].value = 'SS';
    pos[0].dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups[0].positions[0] === 'SS', '守位沒有存起來');
  });

  await t('刪除常用陣容會先問，確定後真的刪掉', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    click(w, q('#page-team .team-row-link[data-sub="lineups"]'));
    click(w, q('#lu-add'));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups.length === 1, '沒有新增成功');
    click(w, q('#lu-delete'));
    t.assert(!q('#ask-modal').classList.contains('hidden'), '刪除前沒有先問');
    click(w, q('#ask-yes'));
    t.assert(JSON.parse(w.localStorage.getItem('baseball_my_team')).lineups.length === 0, '沒有真的刪掉');
    t.assert(!!q('#lu-add'), '刪完沒有回到陣容列表');
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

  await t('一開機停在啟動畫面，有未完成的比賽就多一顆「繼續比賽」', async () => {
    const first = await withTeam();
    startGame(first.window);
    quickPlay(first.window, '四壞');
    await sleep(300);
    const saved = first.window.localStorage.getItem('baseballGameState');
    const { window: w, q } = await launch({ baseballGameState: saved });
    t.assert(!q('#onboard-screen').classList.contains('hidden'), '開機沒有停在啟動畫面');
    t.assert(q('#main-shell').classList.contains('hidden'), '不該直接進主畫面');
    t.assert(!q('#ob-resume').classList.contains('hidden'), '沒有顯示「繼續比賽」');
    t.assert(/局[上下]/.test(q('#ob-resume-sub').textContent), '沒有寫出比分與局數：'
      + q('#ob-resume-sub').textContent);
    // 按了才進比賽畫面
    click(w, q('#ob-resume'));
    t.assert(q('#main-shell').classList.contains('hidden') && q('#onboard-screen').classList.contains('hidden'),
      '按了繼續比賽卻沒進到比賽畫面');
  });

  await t('設定裡「清除全部資料」要回到歡迎頁，不能跟主畫面疊在一起', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="settings"]'));
    click(w, q('#set-reset'));
    click(w, q('#ask-yes'));          // 確認清除
    await sleep(50);
    t.assert(q('#main-shell').classList.contains('hidden'), '主畫面沒有收起來，會跟歡迎頁疊在一起');
    t.assert(!q('#onboard-screen').classList.contains('hidden'), '沒有回到歡迎頁');
    // 資料真的清掉了，所以只剩「創建球隊」
    t.assert(!q('#ob-start').classList.contains('hidden'), '清除後沒有回到「創建球隊」');
    t.assert(q('#ob-enter').classList.contains('hidden'), '資料都清了還顯示「進入」');
    t.assert(!w.localStorage.getItem('baseball_my_team'), '球隊資料沒有清掉');
  });

  await t('歡迎頁的 LOGO 往上靠，建立球隊那幾步不受影響', async () => {
    const { window: w, q } = await launch();
    const scr = q('#onboard-screen');
    t.assert(scr.classList.contains('launch'), '歡迎頁沒有加上往上靠的記號');
    click(w, q('#ob-enter'));
    click(w, q('#shell-nav .shell-tab[data-page="team"]'));
    // 從主畫面回歡迎頁以外的步驟（建立球隊）時要拿掉記號
    const first = await boot({});
    click(first.window, first.q('#ob-start'));
    t.assert(!first.q('#onboard-screen').classList.contains('launch'),
      '建立球隊那一步還留著往上靠的記號，長表單會被推下去');
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/#onboard-screen\.launch\s+\.ob-inner\{[^}]*margin:\s*0 auto/.test(css),
      'CSS 裡沒有把歡迎頁改成不垂直置中的規則');
  });

  await t('出現與消失一律淡出淡入，不做放大縮小', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(css.includes('@keyframes dl-fade-in'), '少了淡入');
    t.assert(css.includes('@keyframes dl-fade-out'), '少了淡出');
    // 放大縮小的動畫要全部拿掉
    t.assert(!/dl-pop-in/.test(css), 'CSS 裡還留著放大出現的動畫');
    t.assert(!/@keyframes dl-rise-in/.test(css), 'CSS 裡還留著上移的動畫');
    // 幾個一定要淡入的地方
    for (const sel of ['#main-shell:not\\(\\.hidden\\)', '\\.shell-page:not\\(\\.hidden\\)',
                       '\\.ob-step:not\\(\\.hidden\\)', '#play-modal:not\\(\\.modal-hidden\\)']) {
      t.assert(new RegExp(sel).test(css), '這裡沒有接上淡入：' + sel);
    }
    // 消失時的淡出：靠 dl-leaving 多留一下下
    t.assert(/\.dl-leaving[^{]*\{[^}]*animation:\s*dl-fade-out/.test(css), '消失時沒有淡出');
    t.assert(/prefers-reduced-motion:\s*reduce/.test(css), '沒有尊重「減少動態效果」');
  });

  await t('從歡迎頁點下去：離開時淡出、下一步淡入', async () => {
    const { window: w, q } = await launch();
    const scr = q('#onboard-screen');
    // 「創建球隊」→ 換到第 1 步，那一步要能淡入（沒有 hidden 就會播）
    const first = await boot({});
    click(first.window, first.q('#ob-start'));
    const step1 = first.q('#onboard-screen .ob-step[data-step="1"]');
    t.assert(step1 && !step1.classList.contains('hidden'), '沒有換到建立球隊第一步');
    // 「進入」→ 歡迎頁立刻算關閉（其他邏輯與測試看到的都是關閉），但先留著播淡出
    click(w, q('#ob-enter'));
    t.assert(scr.classList.contains('hidden'), '按了進入，歡迎頁沒有標成關閉');
    t.assert(scr.classList.contains('dl-leaving'), '歡迎頁沒有播淡出就直接不見');
    t.assert(!q('#main-shell').classList.contains('hidden'), '主畫面沒有出來');
    await sleep(300);
    t.assert(!scr.classList.contains('dl-leaving'), '淡出播完沒有把記號拿掉');
  });

  await t('建立球隊：有上傳球隊 LOGO，下一頁就換成球隊的；沒上傳就繼續用 APP 的', async () => {
    const { window: w, q } = await boot({});
    const top = () => q('#onboard-screen .ob-logo');
    const appLogo = top().getAttribute('src');
    click(w, q('#ob-start'));
    t.assert(top().getAttribute('src') === appLogo, '第一步不該換圖');
    // 沒上傳 → 下一頁還是 APP 的 LOGO（要先填隊名才走得到下一頁）
    q('#ob-shortname').value = '新莊';
    click(w, q('#ob-to-players'));
    t.assert(top().getAttribute('src') === appLogo, '沒上傳球隊 LOGO，卻換掉了');
    t.assert(!top().classList.contains('is-team'), '沒上傳卻標成球隊 LOGO');

    // 上傳一張 → 下一頁換成球隊的
    const { window: w2, q: q2 } = await boot({});
    const fake = 'data:image/png;base64,iVBORw0KGgo=';
    const app2 = q2('#onboard-screen .ob-logo').getAttribute('src');
    click(w2, q2('#ob-start'));
    q2('#ob-shortname').value = '新莊';
    q2('#ob-logo-preview').setAttribute('src', fake);
    q2('#ob-logo-pick').classList.add('has-logo');
    click(w2, q2('#ob-to-players'));
    const top2 = q2('#onboard-screen .ob-logo');
    t.assert(top2.getAttribute('src') === fake, '沒有換成球隊的 LOGO：' + top2.getAttribute('src'));
    t.assert(top2.classList.contains('is-team'), '沒有標成球隊 LOGO');
    // 退回上一步就換回 APP 的
    click(w2, q2('#onboard-screen .ob-back[data-goto="1"]'));
    t.assert(q2('#onboard-screen .ob-logo').getAttribute('src') === app2, '退回上一步沒有換回 APP 的 LOGO');

    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/\.ob-logo\.is-team\{[^}]*object-fit:\s*contain/.test(css), '球隊 LOGO 沒有框成不裁切');
  });

  await t('創建球隊最後一顆鍵寫「完成，進入球隊頁面」，按了就到球隊分頁', async () => {
    const { window: w, q } = await boot({});
    click(w, q('#ob-start'));
    const finish = q('#ob-finish');
    t.assert(finish.textContent.trim() === '完成，進入球隊頁面',
      '按鈕文字不對：' + finish.textContent);
    // 填最少的資料再按完成
    const set = (id, v) => { const e = q('#' + id); e.value = v;
      ['input', 'change'].forEach(t2 => e.dispatchEvent(new w.Event(t2, { bubbles: true }))); };
    set('ob-fullname', '新莊社區棒球隊');
    set('ob-shortname', '新莊');
    click(w, q('#ob-to-players'));
    click(w, q('#ob-finish'));
    await sleep(50);
    t.assert(q('#onboard-screen').classList.contains('hidden'), '建立球隊的畫面沒有收起來');
    t.assert(!q('#page-team').classList.contains('hidden'), '沒有停在球隊分頁');
    t.assert(q('#page-home').classList.contains('hidden'), '不該停在首頁');
  });

  await t('記錄比賽的視窗：說明文字要夠大（場邊看得清楚）', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    // 同一個選擇器可能被設定好幾次，最後一次才是實際生效的
    const rem = (re, name) => {
      const all = css.match(new RegExp(re.source, 'g'));
      t.assert(all && all.length, '找不到' + name + '的字級設定');
      return Number(all[all.length - 1].match(re)[1]);
    };
    t.assert(rem(/#field-result-panel \.frp-title span\{font-size:([\d.]+)rem/, '落點選單標題') >= 0.82,
      '落點選單標題太小');
    t.assert(rem(/#field-result-panel \.frp-group-label\{font-size:([\d.]+)rem/, '落點選單分組') >= 0.8,
      '落點選單分組標籤太小');
    t.assert(/font-size:\s*\.82rem/.test(css) || /font-size:0\.82rem/.test(css), '視窗裡的說明文字沒有放大');
  });

  await t('首頁的版號放在最下面，不是 LOGO 旁邊', async () => {
    const { q } = await withTeam();
    const ver = q('#shell-version');
    t.assert(!!ver, '首頁沒有版號');
    t.assert(!q('.shell-head .shell-ver'), '版號還留在 LOGO 旁邊');
    const home = q('#page-home');
    t.assert(home.lastElementChild === ver, '版號不是首頁的最後一個元素');
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/#page-home\{[^}]*min-height:\s*100%/.test(css), '首頁沒有撐滿高度，版號會黏在內容下面');
    t.assert(/\.shell-ver\{[^}]*margin:\s*auto 0 0/.test(css), '版號沒有被推到最下面');
  });

  await t('歡迎頁最下面要寫版號', async () => {
    const { window: w, q } = await launch();
    const ver = q('#ob-version');
    t.assert(!!ver, '歡迎頁沒有版號那一行');
    t.assert(/^v\d+\.\d+/.test(ver.textContent.trim()), '版號格式不對：' + ver.textContent);
    // 跟主畫面首頁顯示的是同一個版號
    click(w, q('#ob-enter'));
    t.assert(q('#shell-version').textContent.trim() === ver.textContent.trim(),
      '歡迎頁與首頁的版號不一樣');
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/#onboard-screen\.launch\s+\.ob-ver\{[^}]*position:\s*fixed/.test(css), '版號沒有釘在畫面底部');
    // 建立球隊那兩步是會捲動的長表單，版號浮在上面會蓋住名單與按鈕
    t.assert(/\.ob-ver\{[^}]*display:\s*none/.test(css), '建立球隊那幾步沒有把版號收起來');
  });

  await t('啟動畫面的「比賽進行中」標記要待在按鈕裡，不能飄到畫面左上角', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    // .live-badge 本來是 position:absolute（首頁那張卡用的），
    // 按鈕沒有定位基準的話標記會飄到整個畫面的左上角。
    t.assert(/\.ob-resume\{[^}]*position:\s*relative/.test(css), '.ob-resume 沒有當定位基準');
    t.assert(/\.ob-resume\s+\.live-badge\{[^}]*position:\s*static/.test(css),
      '「比賽進行中」標記沒有改成照順序排在按鈕裡');
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

  await t('成績頁不是空白一片（還沒比賽時給說明）', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="stats"]'));
    t.assert(!!q('#stats-body'), '成績頁沒有內容區');
    t.assert(q('#page-stats').textContent.includes('比賽'), '成績頁沒有任何說明');
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
