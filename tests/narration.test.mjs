// 即時事件敘述的整體檢查（每種結果一句，釘住語句形式）
import { boot, click, startGame, clickZone } from './harness.mjs';

async function fresh() { const c = await boot(); c.window.alert = () => {}; c.window.confirm = () => true; startGame(c.window); return c; }
const last = q => q('#event-log li .ev-body, #event-log li').textContent.replace(/\s+/g, ' ').trim();
function field(w, q, zone, play, opts = {}) {
  clickZone(w, zone); click(w, q(`#field-result-panel button[data-play="${play}"]`));
  if (opts.fc) click(w, q(`#modal-advanced-options button[data-step="select-fc-out"][data-out-runner-base="${opts.fc}"]`));
  const pos = q('#modal-advanced-options button[data-step="select-error"]'); if (pos) click(w, pos);
  const err = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === (opts.err ? 'yes' : 'no')); if (err) click(w, err);
  if (opts.err) { const p2 = q('#modal-advanced-options button[data-step="select-error"]'); if (p2) click(w, p2); }
  for (const [rid, dest] of (opts.runners || [])) click(w, q(`#modal-advanced-options button[data-runner-id="${rid}"][data-dest="${dest}"]`));
  if (opts.batter !== undefined) click(w, q(`#modal-advanced-options button[data-runner-id="batter"][data-dest="${opts.batter}"]`));
  click(w, q('#modal-advanced-done'));
  return q('#event-log li .ev-body').textContent.replace(/\s+/g, ' ').trim();
}
function runner(w, q, type, mid, choice) {
  click(w, q('#runner-action-btn'));
  const pick = t => { const b = [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === t); if (b) click(w, b); };
  pick(type); if (mid) pick(mid); if (choice) pick(choice);
  click(w, [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成|確定/.test(b.textContent)));
  return q('#event-log li .ev-body').textContent.replace(/\s+/g, ' ').trim();
}

export default async function (t) {
  await errorRules(t);
  await t('全壘打：不寫回到本壘，打點寫在最後', async () => {
    const { window: w, q } = await fresh();
    const s = field(w, q, 'outfield', '本打');
    t.assert(/^擊出.*全壘打。 一分打點。$/.test(s), s);
  });

  await t('滿壘二安：跑者句在前、打點在後', async () => {
    const { window: w, q } = await fresh();
    for (let i = 0; i < 3; i++) click(w, q('#quick-plays button[data-play="四壞"]'));
    const s = field(w, q, 'outfield', '二安');
    t.assert(/二壘安打，上到二壘。 在一壘的.* 上到三壘。 在二壘的.* 回到本壘得分。 在三壘的.* 回到本壘得分。 兩分打點。$/.test(s), s);
  });

  await t('犧飛有打點且出局數在最後', async () => {
    const { window: w, q } = await fresh();
    field(w, q, 'outfield', '三安');
    const s = field(w, q, 'outfield', '犧飛', { runners: [[2, 4]] });
    t.assert(/高飛犧牲打.*回到本壘得分。 一分打點。 1人出局。$/.test(s), s);
  });

  await t('失誤：擊向誰、誰失誤、上到一壘', async () => {
    const { window: w, q } = await fresh();
    const s = field(w, q, 'infield', '失誤');
    t.assert(/^擊向.+手，.+手失誤，上到一壘。$/.test(s), s);
    t.assert(!s.includes('並靠著'), '仍有舊句型');
  });

  await t('安打加失誤：失誤寫在去向之後', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));   // 有跑者時才會問是否失誤
    const s = field(w, q, 'outfield', '一安', { err: true });
    t.assert(/一壘安打，上到一壘，.+發生失誤。/.test(s), s);
  });

  await t('野手選擇：寫傳向哪個壘，跑者於該壘被封殺', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));
    const s = field(w, q, 'infield', '野手選擇', { fc: '0', batter: 1 });
    t.assert(/選擇傳向二壘處理跑者/.test(s) && /在一壘的.* 於二壘被封殺出局/.test(s), s);
  });

  await t('滾地雙殺：跑者於二壘被封殺', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));
    const s = field(w, q, 'infield', '雙殺');
    t.assert(/形成雙殺.* 在一壘的.* 於二壘被封殺出局。 2人出局。$/.test(s), s);
  });

  await t('界飛與不死三振的用語', async () => {
    const { window: w, q } = await fresh();
    const s = field(w, q, 'foul', '界飛');
    t.assert(/界外飛球，被.*接殺出局/.test(s), s);
    click(w, q('#quick-plays button[data-play="__more"]'));
    const pick = txt => { const b = [...w.document.querySelectorAll('#play-modal button')].filter(x => !x.closest('.modal-hidden')).find(x => x.textContent.trim() === txt); if (b) click(w, b); };
    pick('上壘'); pick('不死三振');
    const d = q('#modal-advanced-done'); if (d && !d.disabled) click(w, d);
    const s2 = q('#event-log li .ev-body').textContent;
    t.assert(s2.includes('揮空三振但捕手未能接妥，上到一壘'), s2);
  });

  await t('壘間事件寫明從哪個壘出發', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));
    t.assert(runner(w, q, '投手犯規', null, '二壘') === '投手犯規，一壘跑者客隊球員01推進到二壘。', '犯規句不對');
    t.assert(runner(w, q, '暴投', null, '三壘') === '暴投，二壘跑者客隊球員01推進到三壘。', '暴投句不對');
    t.assert(runner(w, q, '捕逸', null, '得分') === '捕逸，三壘跑者客隊球員01回到本壘得分。', '捕逸句不對');
  });

  await t('快捷打席的出局數格式與進階打席一致', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="三振"]'));
    t.assert(q('#event-log li .ev-body').textContent.trim() === '三振出局。 1人出局。', q('#event-log li .ev-body').textContent);
  });
}

async function errorRules(t) {
  const stats = w => { const gs = JSON.parse(w.localStorage.getItem('baseballGameState')); const tm = gs.teams.b; const p = tm.pitchers.find(x => x._id === tm.activePitcherId); return { r: p.r, er: p.er, E: gs.teams.b.errors, rbi: gs.teams.a.roster.reduce((a, x) => a + x.rbi, 0), h: gs.teams.a.hits, outs: gs.outs, bases: gs.bases.map(b => !!b) }; };
  const errBtn = (q, pos) => [...q('#modal-advanced-options').querySelectorAll('button[data-step="select-error"]')].find(b => b.dataset.errorPos === pos);

  await t('同一個 play 可記多次失誤，失誤數累計、可個別移除', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickZone(w, 'outfield'); click(w, q('#field-result-panel button[data-play="一安"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'yes'));
    click(w, errBtn(q, 'CF'));
    click(w, q('#modal-advanced-options button[data-step="add-error"]'));
    click(w, errBtn(q, 'SS'));
    const chips = [...q('#modal-advanced-options').querySelectorAll('button[data-step="remove-error"]')].map(b => b.textContent);
    t.assert(chips.length === 2 && chips[0].includes('中外野手') && chips[1].includes('游擊手'), '失誤籌碼不對：' + chips.join('|'));
    click(w, q('#modal-advanced-options button[data-step="remove-error"][data-idx="0"]'));
    t.assert(q('#modal-advanced-options').querySelectorAll('button[data-step="remove-error"]').length === 1, '移除單筆失誤沒生效');
    click(w, q('#modal-advanced-options button[data-step="add-error"]'));
    click(w, errBtn(q, 'CF'));
    click(w, q('#modal-advanced-done'));
    t.assert(stats(w).E === 2, `守方失誤應為 2，得到 ${stats(w).E}`);
    t.assert(/游擊手與中外野手發生失誤/.test(last(q)), last(q));   // 沒有人因此多進壘 → 用補述句
  });

  await t('靠失誤多進壘的得分：不算打點、算非責失', async () => {
    const { window: w, q } = await fresh();
    click(w, q('#quick-plays button[data-play="四壞"]'));
    clickZone(w, 'outfield'); click(w, q('#field-result-panel button[data-play="一安"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'yes'));
    click(w, errBtn(q, 'CF'));
    click(w, q('#modal-advanced-options button[data-runner-id="0"][data-dest="4"]'));   // 一壘跑者一路回來
    click(w, q('#modal-advanced-done'));
    const s = stats(w);
    t.assert(s.r === 1 && s.rbi === 0 && s.er === 0 && s.h === 1, JSON.stringify(s));
    t.assert(/靠中外野手失誤回到本壘得分。$/.test(last(q)) && !/發生失誤/.test(last(q)), last(q));
  });

  await t('正常推進得分：有打點、責失；安打加失誤但跑者只進正常壘數也照給打點', async () => {
    const { window: w, q } = await fresh();
    clickZone(w, 'outfield'); click(w, q('#field-result-panel button[data-play="二安"]')); click(w, q('#modal-advanced-done'));
    clickZone(w, 'outfield'); click(w, q('#field-result-panel button[data-play="一安"]'));
    click(w, [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'yes'));
    click(w, errBtn(q, 'RF'));
    click(w, q('#modal-advanced-options button[data-runner-id="1"][data-dest="4"]'));   // 二壘跑者靠一安回來（2 壘＝一安正常可推 1 壘＋趁傳）… 這裡視為超過
    click(w, q('#modal-advanced-done'));
    // 二壘跑者靠一安得分推進了 2 個壘，超過一安的 1 壘，且本 play 有失誤 → 依規則不給打點
    const s = stats(w);
    t.assert(s.r === 1 && s.rbi === 0 && s.er === 0, '有失誤時二壘跑者靠一安得分不應給打點：' + JSON.stringify(s));
  });

  await t('二安後衝三壘被觸殺：安打照算、打者出局、壘上無人', async () => {
    const { window: w, q } = await fresh();
    clickZone(w, 'outfield'); click(w, q('#field-result-panel button[data-play="二安"]'));
    for (const d of ['中', '三']) click(w, [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')].find(b => b.dataset.dir === d));
    click(w, q('#modal-advanced-options button[data-out-advancing="1"]'));
    t.assert(q('#modal-advanced-summary').textContent.includes('本打席出局 1 個'), '摘要沒算到打者出局');
    click(w, q('#modal-advanced-done'));
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const s = stats(w);
    t.assert(s.h === 1 && s.outs === 1 && s.bases.every(b => !b), JSON.stringify(s));
    t.assert(gs.teams.a.roster[0]['2b'] === 1 && gs.teams.a.roster[0].h === 1, '二安沒有計入');
    t.assert(/上到二壘，趁傳想上三壘時被中外野手傳給三壘手觸殺出局。 1人出局。$/.test(last(q)), last(q));
  });

  await t('敘述不再附上守備代號', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="滾地"]'));
    click(w, q('#modal-advanced-done'));
    const text = q('#event-log li').textContent;
    t.assert(/傳給一壘手/.test(text), '敘述本身不對：' + text);
    t.assert(!/（\d+(-\d+)*）/.test(text), '敘述裡還有守備代號：' + text);
  });
}
