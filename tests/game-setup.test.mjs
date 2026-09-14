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

export default async function (t) {
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
    const picked = [...w.document.querySelectorAll('#gs-spots select')].map(s => s.value);
    t.assert(picked.join() === Array.from({ length: 9 }, (_, i) => 'm' + i).join(), '沒有帶入常用陣容：' + picked.join());
    t.assert(q('#gs-pitcher').value === 'm9', '投手沒有帶入：' + q('#gs-pitcher').value);
    t.assert(q('#gs-dh').checked, 'DH 沒有跟著陣容');
  });

  await t('關掉 DH 時投手欄位收起來（第九棒就是投手）', async () => {
    const { window: w, q } = await withTeam();
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    const dh = q('#gs-dh');
    dh.checked = false;
    dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    t.assert(q('#gs-pitcher-row').classList.contains('hidden'), '關掉 DH 還留著投手欄位');
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

  await t('先發沒排完會擋下來', async () => {
    const team = JSON.parse(JSON.stringify(TEAM));
    team.lineups = [];
    const { window: w, q } = await boot({ storage: { baseball_my_team: JSON.stringify(team) } });
    let alerted = '';
    w.alert = (m) => { alerted = m; };
    openGame(w, q);
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    click(w, q('#gs-create'));
    t.assert(alerted.includes('先發九棒'), '沒有擋下來：' + alerted);
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

  await t('點標題列回主畫面，比賽畫面的狀態會收乾淨', async () => {
    const { window: w, q } = await withTeam();
    await createGame(w, q);
    click(w, q('#game-log-btn'));
    click(w, q('#home-btn'));
    t.assert(!w.document.body.classList.contains('playing'), '沒有離開比賽畫面');
    t.assert(!w.document.body.classList.contains('sheet-open'), '紀錄面板沒有一起收起來');
    t.assert(q('#game-log-btn').classList.contains('hidden'), '紀錄按鈕沒有收起來');
    t.assert(!q('#main-shell').classList.contains('hidden'), '沒有回到主畫面');
  });
}
