// 成績分頁（球隊勝敗、全隊與個人打擊／投球）、近期比賽紀錄卡的內容，
// 以及比賽主頁左上角改成「首頁／球隊」兩顆鍵
import { boot, click, startGame } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEAM = {
  id: 'team_1', fullName: '新莊社區棒球隊', shortName: '新莊',
  logo: '', color: '#4a90e2', foundedAt: '2026-01-05',
  players: Array.from({ length: 9 }, (_, i) => ({ _id: 'm' + i, jersey: String(i + 1), name: '選手' + i, pos: '' })),
  lineups: [],
};
const withTeam = (extra = {}) => boot({ storage: { baseball_my_team: JSON.stringify(TEAM), ...extra } });

// 一場已經結束的比賽：我們是客隊 a
const doneGame = (over = {}) => ({
  isGameOver: true, mySide: 'a', gameDate: '2026-03-08', stadium: '新莊球場', weather: 'sunny',
  teams: {
    a: {
      name: '新莊', score: [1, 0, 2],
      roster: [{ name: '王小明', jersey: '7', pa: 4, ab: 3, h: 2, tb: 3, '2b': 1, '3b': 0, hr: 0, rbi: 2, r: 1, bb: 1, hbp: 0, so: 1, sf: 0, sh: 0, sb: 1 }],
      pitchers: [{ name: '林投手', outsRecorded: 12, h: 3, r: 1, er: 1, bb: 2, k: 5, hbp: 0, hr: 0, bf: 16 }],
    },
    b: { name: '海盜', score: [0, 1, 0], roster: [], pitchers: [] },
  },
  ...over,
});

const waitGm = async w => { for (let i = 0; i < 40 && !w.baseballGameManager; i++) await sleep(50); return w.baseballGameManager; };

export default async function (t) {
  await t('近期比賽紀錄卡有完整日期、球場、天氣與比數', async () => {
    const { window: w, q } = await withTeam();
    const gm = await waitGm(w);
    gm.saveGame('g1', doneGame());
    click(w, q('#shell-nav .shell-tab[data-page="home"]'));
    const item = q('#home-game-list .gl-item');
    t.assert(!!item, '沒有列出比賽紀錄');
    const txt = item.textContent.replace(/\s+/g, ' ');
    t.assert(txt.includes('2026年3月8日'), '沒有完整日期：' + txt);
    t.assert(txt.includes('新莊球場'), '沒有球場：' + txt);
    t.assert(txt.includes('晴'), '沒有天氣：' + txt);
    // v2.35 起改成左右兩欄：左邊日期／球場，右邊兩隊各一行比數（數字放大）
    t.assert(/新莊\s*3/.test(txt) && /海盜\s*1/.test(txt), '比數不對：' + txt);
    t.assert(!!item.querySelector('.gl-when') && !!item.querySelector('.gl-score'), '不是左右兩欄的排法');
    t.assert(!!item.querySelector('.gl-res.gl-win'), '沒有標出這場是贏的');
  });

  await t('近期比賽紀錄新的排前面', async () => {
    const { window: w, q } = await withTeam();
    const gm = await waitGm(w);
    gm.saveGame('old', doneGame({ gameDate: '2026-03-01' }));
    gm.saveGame('new', doneGame({ gameDate: '2026-05-20' }));
    gm.saveGame('mid', doneGame({ gameDate: '2026-04-10' }));
    click(w, q('#shell-nav .shell-tab[data-page="home"]'));
    const ids = [...w.document.querySelectorAll('#home-game-list .gl-item')].map(b => b.dataset.game);
    t.assert(ids.join() === 'new,mid,old', '沒有照日期由新到舊排：' + ids.join());
  });

  await t('成績分頁：勝敗、全隊與個人成績都算出來', async () => {
    const { window: w, q } = await withTeam();
    const gm = await waitGm(w);
    gm.saveGame('g1', doneGame());
    gm.saveGame('g2', doneGame({ teams: { ...doneGame().teams, a: { ...doneGame().teams.a, score: [0] } } }));
    click(w, q('#shell-nav .shell-tab[data-page="stats"]'));
    const body = q('#stats-body');
    const txt = body.textContent.replace(/\s+/g, ' ');
    t.assert(txt.includes('1') && txt.includes('勝') && txt.includes('敗'), '沒有勝敗紀錄：' + txt.slice(0, 60));
    t.assert(!!body.querySelector('.st-record'), '沒有勝敗那一塊');
    t.assert(body.querySelectorAll('.st-cards').length === 2, '全隊打擊／投球的數字卡不見了');
    t.assert(txt.includes('打擊率') && txt.includes('防禦率'), '沒有全隊打擊率與防禦率：' + txt.slice(0, 120));
    const tables = body.querySelectorAll('.st-table');
    t.assert(tables.length === 3, '個人打擊、守備、投球三張表：' + tables.length);
    t.assert(tables[0].textContent.includes('王小明'), '個人打擊沒有列出球員');
    t.assert(tables[2].textContent.includes('林投手'), '個人投球沒有列出投手');
    // 兩場加起來：打數 6、安打 4
    const row = [...tables[0].querySelectorAll('tbody tr')][0];
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent);
    t.assert(cells[2] === '6' && cells[3] === '4', '兩場沒有累加起來：' + cells.join(','));
    const tot = tables[0].querySelector('tr.st-total');
    t.assert(tot && tot.textContent.includes('全隊'), '沒有全隊那一列');
  });

  // 一場都還沒打完也要看得到版面，第一次用的人才知道有這個功能
  await t('成績分頁：還沒比賽也先顯示版面與說明', async () => {
    const { window: w, q } = await withTeam();
    await waitGm(w);
    click(w, q('#shell-nav .shell-tab[data-page="stats"]'));
    const body = q('#stats-body');
    t.assert(!!body.querySelector('.st-note'), '沒有說明「還沒有打完的比賽」');
    t.assert(!!body.querySelector('.st-record'), '勝敗那一塊不見了');
    t.assert(body.querySelectorAll('.st-cards').length === 2, '全隊打擊／投球的數字卡不見了');
    t.assert(body.querySelectorAll('.st-table').length === 3, '個人成績表不見了');
    t.assert(body.textContent.includes('還沒有資料'), '空的成績表沒有寫「還沒有資料」');
  });

  await t('比賽主頁左上角是「首頁／球隊」兩顆鍵', async () => {
    const { window: w, q } = await withTeam();
    const home = q('#home-btn'), team = q('#team-btn');
    t.assert(home && home.textContent.trim() === '首頁', '左上角第一顆不是首頁');
    t.assert(team && team.textContent.trim() === '球隊', '左上角第二顆不是球隊');
    t.assert(!w.document.querySelector('.stadium-toolbar .brand-text'), '舊的「棒球比賽紀錄」字樣還在');
    t.assert(!!q('#app-version'), '版號不見了');
    click(w, team);
    t.assert(w.document.body.classList.contains('shell-open'), '按球隊沒有回到主畫面');
    t.assert(!q('#page-team').classList.contains('hidden'), '按球隊沒有停在球隊分頁');
  });

  // === v2.9 的其他調整（成績頁以外的也一起釘在這裡）===
  await t('球隊資訊沒有成立時間欄', async () => {
    const { q } = await withTeam();
    t.assert(!q('#team-founded-input'), '成立時間欄應該已經移除');
  });

  await t('建立比賽：日期時間一排、球場天氣一排，還能選對手代表色', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="game"]'));
    const duos = [...w.document.querySelectorAll('#page-game .gs-duo')];
    t.assert(duos.length >= 2, '沒有把欄位兩兩排在一起');
    t.assert(!!duos[0].querySelector('#gs-date') && !!duos[0].querySelector('#gs-time'), '日期與時間不同排');
    t.assert(!!duos[1].querySelector('#gs-stadium') && !!duos[1].querySelector('#gs-weather'), '球場與天氣不同排');
    t.assert(!!q('#gs-opp-color'), '沒有對手代表色');
    // 下一頁按鈕要排在這一步的最後面
    const step = q('#page-game .gs-step[data-gstep="1"]');
    t.assert(step.lastElementChild.id === 'gs-to-opp', '下一頁的按鈕不在最下面');
  });

  await t('對手名單：守位先隨機排好，而且不重複', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="game"]'));
    click(w, q('#gs-to-opp'));
    const rows = [...w.document.querySelectorAll('#gs-opp-list .mp-row')];
    t.assert(rows.length === 10, '對手預設應該十列：' + rows.length);
    t.assert(rows.every(r => r.classList.contains('op-row')), '對手列沒有用自己的欄寬');
    const pos = rows.map(r => r.querySelector('.mp-pos').value);
    t.assert(pos.every(Boolean), '有守位沒填：' + pos.join(','));
    t.assert(pos[9] === 'P', '第十列應該是投手：' + pos[9]);
    t.assert(new Set(pos).size === pos.length, '守位重複了：' + pos.join(','));
  });

  await t('先發名單：選過的球員與守位不會再出現在別棒', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="game"]'));
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    const first = q('#gs-spots select[data-gspot="0"]');
    const pid = first.options[1].value;
    first.value = pid;
    first.dispatchEvent(new w.Event('change', { bubbles: true }));
    const second = q('#gs-spots select[data-gspot="1"]');
    t.assert(![...second.options].some(o => o.value === pid), '第二棒還選得到已經排進第一棒的人');
    const p1 = q('#gs-spots select[data-gpos="0"]');
    p1.value = 'SS';
    p1.dispatchEvent(new w.Event('change', { bubbles: true }));
    const p2 = q('#gs-spots select[data-gpos="1"]');
    t.assert(![...p2.options].some(o => o.value === 'SS'), '別棒還選得到已經有人守的位置');
  });

  await t('關掉 DH：投手排進原本 DH 的那一棒，投手欄收起來', async () => {
    const { window: w, q } = await withTeam();
    click(w, q('#shell-nav .shell-tab[data-page="game"]'));
    click(w, q('#gs-to-opp'));
    click(w, q('#gs-to-lineup'));
    // 第五棒設成 DH，並指定一位先發投手
    const dhPos = q('#gs-spots select[data-gpos="4"]');
    dhPos.value = 'DH';
    dhPos.dispatchEvent(new w.Event('change', { bubbles: true }));
    const pit = q('#gs-pitcher');
    const pitId = pit.options[pit.options.length - 1].value;
    pit.value = pitId;
    pit.dispatchEvent(new w.Event('change', { bubbles: true }));
    click(w, q('#gs-dh .dh-btn[data-dh="0"]'));
    t.assert(q('#gs-pitcher-row').classList.contains('hidden'), '關掉 DH 後投手欄沒有收起來');
    t.assert(q('#gs-spots select[data-gspot="4"]').value === pitId, '投手沒有排進原本 DH 的那一棒');
    t.assert(q('#gs-spots select[data-gpos="4"]').value === 'P', '那一棒的守位不是 P');
    click(w, q('#gs-dh .dh-btn[data-dh="1"]'));
    t.assert(!q('#gs-pitcher-row').classList.contains('hidden'), '打開 DH 後投手欄沒有回來');
    t.assert(q('#gs-spots select[data-gpos="4"]').value === 'DH', '打開 DH 後那一棒沒有換回 DH');
  });

  await t('去背的 PNG 不會被填成白底', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const js = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(js.includes('image/png'), '沒有把透明的圖存成 PNG');
    t.assert(js.includes('png|webp|gif'), '沒有判斷哪些格式是可能透明的');
  });

  await t('比賽中的球場／日期／天氣是固定顯示', async () => {
    const fs = await import('fs');
    const dir = 'dist/assets';
    const css = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
    t.assert(/body\.playing #game-meta-row\s*\{\s*display:\s*none/.test(css), '比賽中沒有把可輸入的那一列收起來');
    const { window: w, q } = await withTeam();
    startGame(w);
    t.assert(q('#game-meta-static').textContent.trim().length > 0, '固定顯示列沒有內容');
  });
}
