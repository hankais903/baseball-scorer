// 守備鏈：依序點野手、自動預設、敘述與記錄表代碼
import { boot, click, startGame, clickZone } from './harness.mjs';

async function play(opts) {
  const { window: w, q } = await boot();
  w.alert = () => {};
  startGame(w);
  if (opts.walk) click(w, q('#quick-plays button[data-play="四壞"]'));
  clickZone(w, opts.zone);
  click(w, q(`#field-result-panel button[data-play="${opts.play}"]`));
  const btn = d => [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')]
    .find(b => b.dataset.dir === d);
  const label = () => q('#modal-advanced-options .fielder-label em').textContent;
  const before = label();
  for (const d of (opts.taps || [])) click(w, btn(d));
  if (opts.clear) click(w, q('#modal-advanced-options button[data-step="clear-fielders"]'));
  const after = label();
  click(w, q('#modal-advanced-done'));
  const log = q('#event-log li').textContent;
  const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
  const batter = gs.teams.a.roster.find(p => (p.abResults || []).some(r => !r.startsWith('四壞')));
  const ab = batter ? batter.abResults.find(r => !r.startsWith('四壞')) : '';
  return { w, before, after, log, ab };
}

export default async function (t) {
  await t('滾地出局預設帶入「落點野手→一壘手」', async () => {
    const r = await play({ zone: 'infield', play: '滾地' });
    t.assert(/已選：.→一（\d-3）/.test(r.before), '預設鏈不對：' + r.before);
    t.assert(/傳給一壘手封殺出局。/.test(r.log), '敘述不對：' + r.log);
  });

  await t('雙殺預設帶入三人鏈並產生 x-y-3 代碼', async () => {
    const r = await play({ zone: 'infield', play: '雙殺', walk: true });
    t.assert(/（\d-\d-3）/.test(r.before), '預設鏈不是三人：' + r.before);
    t.assert(/再傳給一壘手，形成雙殺/.test(r.log), '敘述不對：' + r.log);
  });

  await t('飛球只有接球者一人', async () => {
    const r = await play({ zone: 'outfield', play: '飛球' });
    t.assert(/已選：[左中右]（[789]）/.test(r.before), '飛球預設不是單人：' + r.before);
    t.assert(/被(中|左|右)外野手接殺出局/.test(r.log), '敘述不對：' + r.log);
  });

  await t('自動帶入後手動點野手會從頭重建', async () => {
    const r = await play({ zone: 'infield', play: '滾地', taps: ['游', '一'] });
    t.assert(r.after.includes('游→一（6-3）'), '沒有重建成 6-3：' + r.after);
    t.assert(r.log.includes('游擊手傳給一壘手封殺出局'), '敘述不對：' + r.log);
  });

  await t('手動鏈：點最後一個可退回一步', async () => {
    const r = await play({ zone: 'infield', play: '滾地', taps: ['游', '一', '一', '捕'] });
    t.assert(r.after.includes('游→捕（6-2）'), '退回後再接不對：' + r.after);
  });

  await t('同一野手可以出現兩次（3-6-3）', async () => {
    const r = await play({ zone: 'infield', play: '雙殺', walk: true, taps: ['一', '游', '一'] });
    t.assert(r.after.includes('一→游→一（3-6-3）'), '3-6-3 沒建起來：' + r.after);
    t.assert(r.log.includes('一壘手傳給游擊手再傳給一壘手，形成雙殺'), '敘述不對：' + r.log);
  });

  await t('清除按鈕會清空守備鏈', async () => {
    const r = await play({ zone: 'infield', play: '滾地', clear: true });
    t.assert(!r.after.includes('已選'), '清除後仍有選取：' + r.after);
    t.assert(!/（\d/.test(r.log), '清除後敘述仍帶代碼：' + r.log);
  });

  await t('打席結果記錄整條守備鏈', async () => {
    const r = await play({ zone: 'infield', play: '滾地', taps: ['游', '一'] });
    t.assert(r.ab.startsWith('滾地@游一#'), 'abResults 不對：' + r.ab);
  });

  await t('正式記錄表把守備鏈轉成 6-3 / 6-4-3 GDP / F.8', async () => {
    const { window: w } = await boot();
    startGame(w);   // 開賽後才會有存檔
    const state = JSON.parse(w.localStorage.getItem('baseballGameState'));
    state.teams.a.roster[0].abResults = ['滾地@游一#1', '雙殺@游二一#2', '飛球@中#3', '一安@左#4'];
    const html = w.buildOfficialSheet(state);
    t.assert(html.includes('6-3'), '沒有 6-3');
    t.assert(html.includes('6-4-3 GDP'), '沒有 6-4-3 GDP');
    t.assert(html.includes('F.8'), '沒有 F.8');
    t.assert(html.includes('1B7'), '安打方向沒有保留');
  });
}
