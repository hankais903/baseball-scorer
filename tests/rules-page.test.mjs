// 記分規則速查（設定 → 記分規則）：打包在 APP 裡、離線可查、搜尋得到
import { boot, click } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEAM = {
  id: 'team_1', fullName: '新莊社區棒球隊', shortName: '新莊',
  logo: '', color: '#4a90e2', foundedAt: '2026-01-05',
  players: Array.from({ length: 9 }, (_, i) => ({ _id: 'm' + i, jersey: String(i + 1), name: '選手' + i, pos: '' })),
  lineups: [],
};
const withTeam = () => boot({ storage: { baseball_my_team: JSON.stringify(TEAM) } });

const builtCss = async () => {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join('dist', 'assets');
  return fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.css'))), 'utf8');
};

// 走到「設定 → 記分規則速查」
async function openRules(w, q) {
  click(w, q('#shell-nav .shell-tab[data-page="settings"]'));
  const entry = q('#set-rules');
  if (!entry) throw new Error('設定分頁裡沒有「記分規則速查」');
  click(w, entry);
  await sleep(30);
}

const search = (w, q, text) => {
  const input = q('#rq-q');
  input.value = text;
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
};

export default async function (t) {
  await t('設定分頁進得去記分規則，標題是「記分規則」', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    const sub = q('#shell-sub');
    t.assert(!sub.classList.contains('hidden'), '子頁沒有打開');
    t.assert(sub.dataset.kind === 'rules', '打開的不是規則頁：' + sub.dataset.kind);
    t.assert(q('#sub-title').textContent === '記分規則', '標題不對：' + q('#sub-title').textContent);
    t.assert(!!q('#rq-q'), '沒有搜尋框');
  });

  await t('規則內容整包在 APP 裡，段落與條目都夠多', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    const secs = w.document.querySelectorAll('#sub-body .rq-sec');
    const items = w.document.querySelectorAll('#sub-body .rq-item');
    t.assert(secs.length >= 15, '規則段落太少，內容可能掉了：' + secs.length);
    t.assert(items.length >= 100, '規則條目太少，內容可能掉了：' + items.length);
    // 幾個一定要在的主題
    const all = q('#sub-body').textContent;
    for (const key of ['守備機會', '高飛犧牲打', '盜壘刺', '內野高飛必死球', '突破僵局', '打擊順序錯誤', '救援']) {
      t.assert(all.includes(key), '規則裡找不到「' + key + '」');
    }
  });

  await t('段落預設收起來，點標題才展開', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    const sec = q('#sub-body .rq-sec');
    t.assert(!sec.classList.contains('open'), '一進來就全部展開了，會很長');
    click(w, sec.querySelector('.rq-head'));
    t.assert(sec.classList.contains('open'), '點了標題沒有展開');
    click(w, sec.querySelector('.rq-head'));
    t.assert(!sec.classList.contains('open'), '再點一次沒有收起來');
  });

  await t('搜尋段落標題會把整段留下', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    search(w, q, '記分規則速查標題不存在');
    search(w, q, '打點');
    const sec = [...w.document.querySelectorAll('#sub-body .rq-sec')]
      .find(s => s.querySelector('.rq-head span').textContent === '打點');
    t.assert(sec && !sec.classList.contains('rq-hide'), '搜「打點」找不到那一段');
    const hidden = [...sec.querySelectorAll('.rq-item')].filter(x => x.classList.contains('rq-hide'));
    t.assert(hidden.length === 0, '段落標題命中時應該整段留下，卻藏了 ' + hidden.length + ' 條');
  });

  await t('搜尋會留下相符的條目，並自動展開那一段', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    // 用一個不會出現在段落標題裡的詞，才驗得到「逐條過濾」
    search(w, q, '捕逸');
    const shown = [...w.document.querySelectorAll('#sub-body .rq-item')].filter(x => !x.classList.contains('rq-hide'));
    t.assert(shown.length > 0, '搜尋「捕逸」什麼都沒留下');
    // 段落標題本身命中的話整段都會留下，這是刻意的；其餘要逐條相符
    const secTitleHit = (item) => (item.closest('.rq-sec').querySelector('.rq-head span').textContent || '').includes('捕逸');
    t.assert(shown.every(x => x.textContent.includes('捕逸') || secTitleHit(x)), '留下了不相符的條目');
    const openSecs = [...w.document.querySelectorAll('#sub-body .rq-sec')].filter(s => s.classList.contains('open'));
    t.assert(openSecs.length > 0, '有結果卻沒有自動展開');
    t.assert(q('#rq-empty').classList.contains('rq-hide'), '有結果卻顯示找不到');
    // 清空就全部回來
    search(w, q, '');
    const back = [...w.document.querySelectorAll('#sub-body .rq-item')].filter(x => x.classList.contains('rq-hide'));
    t.assert(back.length === 0, '清空搜尋後還有條目被藏著：' + back.length);
  });

  await t('搜不到的時候要說找不到', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    search(w, q, 'zzz不存在的詞zzz');
    t.assert(!q('#rq-empty').classList.contains('rq-hide'), '沒有顯示找不到的提示');
    const shown = [...w.document.querySelectorAll('#sub-body .rq-sec')].filter(s => !s.classList.contains('rq-hide'));
    t.assert(shown.length === 0, '沒有結果卻還留著段落：' + shown.length);
  });

  await t('返回鍵回得到設定分頁', async () => {
    const { window: w, q } = await withTeam();
    await openRules(w, q);
    click(w, q('#sub-back'));
    t.assert(q('#shell-sub').classList.contains('hidden'), '返回之後子頁沒有關掉');
    t.assert(!q('#page-settings').classList.contains('hidden'), '沒有回到設定分頁');
  });

  await t('這個專案沒有共用的 .hidden，規則頁要自己有一條藏起來的規則', async () => {
    const css = await builtCss();
    t.assert(/\.rq-hide\{[^}]*display:\s*none/.test(css), 'CSS 裡沒有 .rq-hide 的 display:none');
    t.assert(/\.rq-sec\.open\s+\.rq-body\{[^}]*display:\s*block/.test(css), '展開的段落沒有顯示內容的規則');
    // 標題是可以點的，高度要夠手指按
    const head = (css.match(/\.rq-head\{[^}]*\}/g) || []).join(' ');
    const h = Number((head.match(/min-height:\s*(\d+)px/) || [])[1] || 0);
    t.assert(h >= 44, '規則段落標題按起來太小：' + head);
  });

  await t('離線也查得到：內容進了打包後的 JS，不靠網路抓', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join('dist', 'assets');
    const js = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.js'))), 'utf8');
    t.assert(js.includes('守備機會'), '規則內容沒有打包進 JS');
    t.assert(js.includes('內野高飛必死球'), '規則內容沒有打包進 JS');
  });
}
