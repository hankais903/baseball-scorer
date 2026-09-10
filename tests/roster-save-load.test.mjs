// 名單存讀：儲存／讀取名單時，板凳球員、守備位置與 DH 設定都要跟著回來
// （曾發生過：讀取名單後板凳列還是隱藏的，看起來像球員不見了；
//   儲存時沒有存守位，讀回來的守備位置會是畫面上的舊值）
import { boot, click } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const mousedown = (w, el) =>
  el && el.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
const benchNames = w => [...w.document.querySelectorAll('#team-a-bench .lineup-player')]
  .filter(r => !r.classList.contains('bench-hidden'))
  .map(r => r.querySelector('input[data-type="name"]').value);
const positions = w => [...w.document.querySelectorAll('#team-a-lineup select[data-type="pos"]')].map(s => s.value);

// 建一份「守位換過、加了兩個板凳」的名單並存檔，回傳存下來的字串
async function makeSavedRoster() {
  const { window: w, q } = await boot();
  w.alert = () => {}; w.confirm = () => true;
  const sel = w.document.querySelector('#team-a-lineup select[data-type="pos"]');
  sel.value = 'SS';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(200);
  for (const name of ['板凳一', '板凳二']) {
    click(w, q('.bench-add-btn[data-team="a"]'));
    const row = [...w.document.querySelectorAll('#team-a-bench .lineup-player')]
      .find(r => !r.classList.contains('bench-hidden') && !r.querySelector('input[data-type="name"]').value);
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = name;
    ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(200);
  }
  click(w, q('.save-roster-btn[data-team="a"]'));
  await sleep(250);
  return { saved: w.localStorage.getItem('savedBaseballRosters'), pos: positions(w) };
}

// 開一個乾淨的 APP，把那份名單讀進來
async function loadInto(saved) {
  const ctx = await boot({ storage: { savedBaseballRosters: saved } });
  ctx.window.alert = () => {}; ctx.window.confirm = () => true;
  click(ctx.window, ctx.q('.load-roster-btn[data-team="a"]'));
  await sleep(150);
  mousedown(ctx.window, ctx.window.document.querySelector('.load-roster-item-btn'));
  await sleep(350);
  return ctx;
}

export default async function (t) {
  await t('儲存名單會連守備位置一起存', async () => {
    const { saved } = await makeSavedRoster();
    const roster = JSON.parse(saved)[0].roster;
    t.assert(typeof roster[0].pos === 'string' && roster[0].pos, '第一棒沒有存守位：' + JSON.stringify(roster[0]));
    t.assert(roster[0].pos === 'SS', '守位存成 ' + roster[0].pos + '，應為 SS');
  });

  await t('讀取名單後板凳球員看得到', async () => {
    const { saved } = await makeSavedRoster();
    const ctx = await loadInto(saved);
    const shown = benchNames(ctx.window);
    t.assert(shown.join(',') === '板凳一,板凳二', '看得到的板凳為：' + (shown.join(',') || '(空)'));
  });

  await t('讀取名單後守備位置與存檔一致', async () => {
    const { saved, pos } = await makeSavedRoster();
    const ctx = await loadInto(saved);
    t.assert(positions(ctx.window).join(',') === pos.join(','),
      '讀回來是 ' + positions(ctx.window).join(',') + '，應為 ' + pos.join(','));
  });

  await t('讀取名單後不用再按套用就會寫進比賽狀態', async () => {
    const { saved } = await makeSavedRoster();
    const ctx = await loadInto(saved);
    await sleep(300);
    const gs = JSON.parse(ctx.window.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[9].name === '板凳一',
      '狀態裡的第 10 位是 ' + gs.teams.a.roster[9].name);
  });

  await t('讀取名單會還原 DH 設定', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    const dh = q('#team-a-dh-toggle');
    dh.checked = false;
    dh.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(250);
    click(w, q('.save-roster-btn[data-team="a"]'));
    await sleep(250);
    const saved = w.localStorage.getItem('savedBaseballRosters');
    t.assert(JSON.parse(saved)[0].useDH === false, '存檔沒有記下 DH 已關閉');
    const ctx = await loadInto(saved);
    t.assert(ctx.q('#team-a-dh-toggle').checked === false, '讀取後 DH 沒有跟著關閉');
  });
}
