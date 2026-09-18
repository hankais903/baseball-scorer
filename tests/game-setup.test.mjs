// 建立比賽的三步流程，以及比賽中的獨立畫面與滑出式紀錄面板
import { boot, click } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEAM = {
  id: 'team_1', fullName: '新莊社區棒球隊', shortName: '新莊',
  logo: '', color: '#4a90e2', foundedAt: '2026-01-05',
  players: Array.from({ length: 12 }, (_, i) => ({ _id: 'm' + i, jersey: String(i + 1), name: '選手' + i, pos: '' })),
  lineups: [{ id: 'lu1', name: '主力', useDH: true, spots: Array.from({ length: 9 }, (_, i) => 'm' + i), pitcherId: 'm9' }],
};
const withTeam = (extra = {}) => boot({ storage: { baseball_my_team: JSON.stringify(TEAM), ...extra } });
const openGame = (w, q) => click(w, q('#shell-nav .shell-tab[data-page="game"]'));
const setVal = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };

// 走完三步，回傳 window
async function createGame(w, q, { side = 'top', opp = '海盜' } = {}) {
  openGame(w, q);
  setVal(w, q('#gs-stadium'), '新莊球場');
  setVal(w, q('#gs-opp-name'), opp);
  if (side === 'bottom') click(w, q('.gs-side-btn[data-side="bottom"]'));
  click(w, q('#gs-to-opp'));
  click(w, q('#gs-to-lineup'));
  click(w, q('#gs-create'));
  await sleep(300);
}

// 沒填名字的球員（建立球隊時直接按下一步就是這樣）
const TEAM_NO_NAMES = {
  ...TEAM,
  players: Array.from({ length: 11 }, (_, i) => ({ _id: 'n' + i, jersey: String(i + 1), name: '', pos: '' })),
  lineups: [{ id: 'lu1', name: '主力', useDH: true, spots: Array.from({ length: 9 }, (_, i) => 'n' + i), pitcherId: 'n9' }],
};

export default async function (t) {
  // 以前板凳是 fill(slot, src, '', '')，沒填名字的人會變成 name === ''（＝沒這個人），
  // 板凳整排被當成空的，比賽中代打／代跑／換投一個人都選不到。
  await t('沒填名字的球員進板凳也要有名字，換人時選得到', async () => {
    const { window: w, q } = await boot({ storage: { baseball_my_team: JSON.stringify(TEAM_NO_NAMES) } });
    click(w, q('#ob-enter'));
    await createGame(w, q);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const me = gs.teams[gs.mySide || 'a'];
    const bench = me.roster.filter((r, i) => i >= 9 && i !== 24 && (r.name || '').trim());
    // 11 人 － 先發 9 － 投手 1 ＝ 板凳 1
    t.assert(bench.length === 1, '板凳人數不對：' + bench.length + '（應該是 1）');
    t.assert(bench[0].name === '新莊11', '板凳沒有自動取名：「' + bench[0].name + '」');
    t.assert(bench[0].jersey === '11', '板凳背號沒帶進來：「' + bench[0].jersey + '」');
    // 代打真的選得到
    click(w, q('#play-ball-btn'));
    click(w, q('#management-btn'));
    click(w, q('#pinch-hit-btn'));
    const names = [...w.document.querySelectorAll('#picker-list .picker-item .picker-name')].map(x => x.textContent);
    t.assert(names.includes('新莊11'), '代打名單裡沒有板凳球員：' + (names.join('、') || '（空的）'));
  });

  await t('比賽分頁是三步流程，第一步不給返回', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    t.assert(q('#gs-count').textContent === '1 / 3', '步驟不對：' + q('#gs-count').textContent);
    t.assert(q('#gs-back').classList.contains('hidden'), '第一步不該有返回');
    for (const id of ['gs-date', 'gs-time', 'gs-stadium', 'gs-weather', 'gs-opp-name']) {
      t.assert(!!q('#' + id), '比賽資訊少了 ' + id);
    }
    t.assert(w.document.querySelectorAll('.gs-side-btn').length === 2, '沒有先攻／後攻的選擇');
    t.assert(q('.gs-side-btn[data-side="top"]').classList.contains('active'), '預設不是先攻');
  });

  await t('第二步是對手名單，第三步是我方先發', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    t.assert(q('#gs-count').textContent === '2 / 3', '沒有進到第二步');
    t.assert(!q('#gs-back').classList.contains('hidden'), '第二步應該可以返回');
    const rows = w.document.querySelectorAll('#gs-opp-list .mp-row');
    t.assert(rows.length === 10, '對手應該預設十列（九棒＋投手）：' + rows.length);
    t.assert(rows[2].querySelector('.mp-name').placeholder === '對手03', '沒填名字的提示不對：'
      + rows[2].querySelector('.mp-name').placeholder);
    click(w, q('#gs-to-lineup'));
    t.assert(q('#gs-count').textContent === '3 / 3', '沒有進到第三步');
    t.assert(w.document.querySelectorAll('#gs-spots .lu-spot').length === 9, '沒有九個棒次');
  });

  await t('先發名單會帶入常用陣容', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    const picked = [...w.document.querySelectorAll('#gs-spots select[data-gspot]')].map(s => s.value);
    t.assert(picked.join() === Array.from({ length: 9 }, (_, i) => 'm' + i).join(), '沒有帶入常用陣容：' + picked.join());
    t.assert(q('#gs-pitcher').value === 'm9', '投手沒有帶入：' + q('#gs-pitcher').value);
    t.assert(q('#gs-dh .dh-btn[data-dh="1"]').classList.contains('active'), 'DH 沒有跟著陣容');
  });

  await t('切到投手打擊時投手欄位收起來（第九棒就是投手）', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    t.assert(w.document.querySelectorAll('#gs-dh .dh-btn').length === 2, 'DH 不是兩顆按鈕');
    click(w, q('#gs-dh .dh-btn[data-dh="0"]'));
    t.assert(q('#gs-pitcher-row').classList.contains('hidden'), '切到投手打擊還留著投手欄位');
    t.assert(q('#gs-dh .dh-btn[data-dh="0"]').classList.contains('active'), '按鈕沒有變色');
  });

  await t('先發名單可以排守位，守位會跟著進比賽', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    setVal(w, q('#gs-opp-name'), '海盜');
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    const pos = [...w.document.querySelectorAll('#gs-spots .lu-pos')];
    t.assert(pos.length === 9, '先發名單沒有守位欄位：' + pos.length);
    setVal(w, pos[0], 'SS');
    click(w, q('#gs-create'));
    await sleep(300);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[0].pos === 'SS', '守位沒有帶進比賽：' + gs.teams.a.roster[0].pos);
  });

  await t('建立比賽：我方先攻時是客隊，資料都帶進去', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.name === '新莊', '我方先攻應該在客隊：' + gs.teams.a.name);
    t.assert(gs.teams.b.name === '海盜', '對手應該在主隊：' + gs.teams.b.name);
    t.assert(gs.stadium === '新莊球場', '球場沒帶進去：' + gs.stadium);
    t.assert(gs.teams.a.roster[0].name === '選手0', '先發第一棒不對：' + gs.teams.a.roster[0].name);
    t.assert(gs.teams.b.roster[0].name === '對手01', '對手沒填名字時應該用對手＋號碼：' + gs.teams.b.roster[0].name);
    t.assert(gs.teams.a.roster[9].name === '選手10' && gs.teams.a.roster[10].name === '選手11',
      '沒排進先發的球員應該依序進板凳：' + gs.teams.a.roster.slice(9, 11).map(p => p.name).join());
    t.assert(gs.started === false, '建立比賽時不該直接開賽（要按 PLAY BALL）');
  });

  await t('建立比賽：我方後攻時換到主隊', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q, { side: 'bottom', opp: '飛龍' });
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.b.name === '新莊', '我方後攻應該在主隊：' + gs.teams.b.name);
    t.assert(gs.teams.a.name === '飛龍', '對手應該在客隊：' + gs.teams.a.name);
  });

  // 擋下來的原因要寫在畫面上：系統的 alert 在內嵌（iframe）環境會被擋掉，按了完全沒反應
  await t('先發沒排完會擋下來，而且說得出原因', async () => {
    const team = JSON.parse(JSON.stringify(TEAM));
    team.lineups = [];
    const { window: w, q } = await boot({ storage: { baseball_my_team: JSON.stringify(team) } });
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    click(w, q('#gs-create'));
    const warn = q('#gs-warn');
    t.assert(warn && !warn.classList.contains('hidden'), '沒有把原因寫在畫面上');
    t.assert(warn.textContent.includes('先發九棒'), '訊息不對：' + warn.textContent);
    t.assert(!w.localStorage.getItem('baseball_current_game_id'), '沒排完卻把比賽建起來了');
  });

  await t('對手會存成常用對手，下次帶得回來', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q, { opp: '海盜' });
    const saved = JSON.parse(w.localStorage.getItem('baseball_opponents'));
    t.assert(saved.length === 1 && saved[0].name === '海盜', '沒有存成常用對手：' + JSON.stringify(saved));
  });

  // === 比賽中的畫面 ===
  await t('建立完直接進比賽畫面，底部分頁藏起來', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    t.assert(w.document.body.classList.contains('playing'), '沒有進入比賽畫面');
    t.assert(q('#main-shell').classList.contains('hidden'), '主畫面沒有收起來');
    t.assert(!q('#game-log-btn').classList.contains('hidden'), '沒有出現紀錄按鈕');
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/body\.playing\s+#mobile-nav\s*\{[^}]*display:\s*none/.test(css), '比賽中沒有把原本的分頁藏起來');
  });

  await t('紀錄面板：點「紀錄」滑出來，點把手收回去', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    t.assert(!w.document.body.classList.contains('sheet-open'), '一開始不該是打開的');
    click(w, q('#game-log-btn'));
    t.assert(w.document.body.classList.contains('sheet-open'), '沒有滑出來');
    click(w, q('#log-sheet-close'));
    t.assert(!w.document.body.classList.contains('sheet-open'), '沒有收回去');
  });

  await t('紀錄面板是原本那一頁，內容照舊', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    click(w, q('#game-log-btn'));
    const sheet = q('#event-log-container');
    t.assert(!!sheet.querySelector('#panel-tabs'), '面板裡沒有分頁（即時事件／戰況表／兩隊）');
    t.assert(!!sheet.querySelector('#event-log'), '面板裡沒有事件列表');
    const tabs = [...sheet.querySelectorAll('.panel-tab')].map(b => b.textContent.trim());
    t.assert(tabs[0] === '即時事件' && tabs[1] === '戰況表', '面板分頁不對：' + tabs.join());
    t.assert(tabs.includes('新莊') && tabs.includes('海盜'), '面板沒有兩隊的成績頁：' + tabs.join());
  });

  await t('比賽中的紀錄面板不會被換頁位移綁住', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    // #app-container 有 transform 的話，裡面 position:fixed 的面板會以它為基準，滑出來的位置會跑掉
    t.assert(/body\.playing\s+#app-container\s*\{[^}]*transform:\s*none\s*!important/.test(css),
      '比賽中沒有把換頁位移關掉，紀錄面板會定位錯誤');
    t.assert(/body\.playing\s+#event-log-container\s*\{[^}]*position:\s*fixed/.test(css), '紀錄面板不是固定在畫面下方');
  });

  // 預覽檔把 APP 放在 iframe 裡，location.reload() 會把它洗成空白頁，
  // 所以讀取比賽、還原備份、清除資料都不能重新整理（踩過一次：點比賽紀錄整片變白）
  await t('讀取比賽不會重新整理整頁，直接讀進來', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q, { opp: '海盜' });
    click(w, q('#play-ball-btn'));
    await sleep(400);
    const gm = w.baseballGameManager;
    // 比賽紀錄只收已經結束的比賽，所以先讓這一場結束
    const st = JSON.parse(w.localStorage.getItem('baseballGameState'));
    st.isGameOver = true;
    w.localStorage.setItem('baseballGameState', JSON.stringify(st));
    gm.saveCurrentGame(st);
    const id = gm.currentGameId;
    // 回主畫面，再從比賽紀錄點回這一場
    click(w, q('#home-btn'));
    let reloaded = false;
    try { w.location.reload = () => { reloaded = true; }; } catch { /* 改不了就算了 */ }
    const item = q(`#home-game-list .gl-item[data-game="${id}"]`);
    t.assert(!!item, '比賽紀錄裡找不到剛才那一場');
    click(w, item);
    t.assert(!reloaded, '讀取比賽時重新整理了整頁（預覽檔會變成空白）');
    t.assert(w.document.body.classList.contains('playing'), '沒有進到比賽畫面');
    t.assert(q('#main-shell').classList.contains('hidden'), '主畫面沒有收起來');
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.name === '新莊' && gs.started === true, '讀進來的比賽不對：' + gs.teams.a.name);
  });

  await t('程式碼裡不再用重新整理來載入比賽', async () => {
    const fs = await import('fs');
    const js = fs.readFileSync('dist/game-helpers.js', 'utf8');
    t.assert(js.includes('__adoptSavedGame'), '舊的載入流程沒有接到就地載入');
    const dir = 'dist/assets';
    const main = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(!/location\.reload/.test(main), '主程式裡還留著 location.reload()');
  });

  await t('點標題列回主畫面，比賽畫面的狀態會收乾淨', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    click(w, q('#game-log-btn'));
    click(w, q('#home-btn'));
    t.assert(!w.document.body.classList.contains('playing'), '沒有離開比賽畫面');
    t.assert(!w.document.body.classList.contains('sheet-open'), '紀錄面板沒有一起收起來');
    t.assert(q('#game-log-btn').classList.contains('hidden'), '紀錄按鈕沒有收起來');
    t.assert(!q('#main-shell').classList.contains('hidden'), '沒有回到主畫面');
    // 停在「比賽」分頁會看到已經用過的建立流程，而且首頁的比賽紀錄會被藏住
    const shown = [...w.document.querySelectorAll('#main-shell .shell-page')].filter(s => !s.classList.contains('hidden'));
    t.assert(shown.length === 1 && shown[0].id === 'page-home', '回主畫面應該停在首頁：' + shown.map(s => s.id).join());
  });

  await t('建立比賽後立刻寫進存檔，不用等自動儲存那 10 秒', async () => {
    const { window: w, q } = await withTeam();
    for (let i = 0; i < 40 && !w.baseballGameManager; i++) await sleep(50);   // 等多場比賽的模組起來
    t.assert(!!w.baseballGameManager, '比賽管理模組沒有啟動');
    await createGame(w, q, { opp: '海盜' });
    const saved = w.baseballGameManager.getGamesList();
    t.assert(saved.length === 1, '建立的比賽沒有立刻存起來：' + saved.length);
    t.assert(saved[0].teams.a.name === '新莊' && saved[0].teams.b.name === '海盜', '存起來的兩隊不對');
  });

  // === 比賽進行中的保護（同時只能有一場）===
  await t('比賽進行中時，比賽分頁整個鎖住並說明原因', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q, { opp: '海盜' });
    click(w, q('#play-ball-btn'));
    await sleep(300);
    click(w, q('#home-btn'));
    click(w, q('#shell-nav .shell-tab[data-page="game"]'));
    t.assert(!q('#gs-busy').classList.contains('hidden'), '沒有顯示比賽進行中的提醒');
    t.assert(q('#page-game').classList.contains('is-busy'), '建立流程沒有被鎖住');
    t.assert(q('#gs-busy').textContent.includes('比賽進行中'), '沒有寫出比賽進行中');
    t.assert(/結束計時/.test(q('#gs-busy').textContent), '沒有說明要怎麼結束目前的比賽');
    t.assert(q('#gs-busy-text').textContent.includes('新莊'), '沒有寫出目前是哪一場：' + q('#gs-busy-text').textContent);
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/#page-game\.is-busy[^{]*\{[^}]*pointer-events:\s*none/.test(css), '鎖住的部分還按得動');
    click(w, q('#gs-busy-back'));
    t.assert(w.document.body.classList.contains('playing'), '「回到目前的比賽」沒有作用');
  });

  await t('比賽結束後，比賽分頁就解開了', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q, { opp: '海盜' });
    click(w, q('#play-ball-btn'));
    await sleep(300);
    const st = JSON.parse(w.localStorage.getItem('baseballGameState'));
    st.isGameOver = true;
    const { window: w2, q: q2 } = await withTeam({ baseballGameState: JSON.stringify(st) });
    click(w2, q2('#shell-nav .shell-tab[data-page="game"]'));
    t.assert(q2('#gs-busy').classList.contains('hidden'), '比賽已結束卻還鎖著');
    t.assert(!q2('#page-game').classList.contains('is-busy'), '比賽已結束卻還壓暗');
  });
}
