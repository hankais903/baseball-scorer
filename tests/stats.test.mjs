// 成績分頁（球隊勝敗、全隊與個人打擊／投球）、近期比賽紀錄卡的內容，
// 以及比賽主頁左上角改成「首頁／球隊」兩顆鍵
import { boot, click } from './harness.mjs';

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
    t.assert(txt.includes('3 : 1'), '比數不對：' + txt);
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
    t.assert(tables.length === 2, '個人打擊與個人投球表應該各一張：' + tables.length);
    t.assert(tables[0].textContent.includes('王小明'), '個人打擊沒有列出球員');
    t.assert(tables[1].textContent.includes('林投手'), '個人投球沒有列出投手');
    // 兩場加起來：打數 6、安打 4
    const row = [...tables[0].querySelectorAll('tbody tr')][0];
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent);
    t.assert(cells[2] === '6' && cells[3] === '4', '兩場沒有累加起來：' + cells.join(','));
    const tot = tables[0].querySelector('tr.st-total');
    t.assert(tot && tot.textContent.includes('全隊'), '沒有全隊那一列');
  });

  await t('成績分頁：一場都還沒打完時給說明，不是空白', async () => {
    const { window: w, q } = await withTeam();
    await waitGm(w);
    click(w, q('#shell-nav .shell-tab[data-page="stats"]'));
    t.assert(!!q('#stats-body .shell-empty'), '沒有給「還沒有打完的比賽」的說明');
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
}
