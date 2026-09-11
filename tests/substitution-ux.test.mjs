// 比賽中換人：主頁代打／代跑／換投、守位圖調度、名單頁鎖定
import { boot, click, startGame } from './harness.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function setup() {
  const { window: w, q } = await boot();
  w.alert = () => {}; w.confirm = () => true;
  for (const [team, name] of [['a', '客板一'], ['a', '客板二'], ['b', '主板一']]) {
    click(w, q(`.bench-add-btn[data-team="${team}"]`));
    const row = [...w.document.querySelectorAll(`#team-${team}-bench .lineup-player`)]
      .find(r => !r.classList.contains('bench-hidden') && !r.querySelector('input[data-type="name"]').value);
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = name; ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(250);
  }
  const state = () => JSON.parse(w.localStorage.getItem('baseballGameState'));
  const pick = name => click(w, [...q('#picker-list').querySelectorAll('.picker-item')].find(b => b.textContent.includes(name)));
  return { w, q, state, pick };
}

export default async function (t) {
  await t('開賽前調度視窗沒有代打／換投鈕、拖曳可用；開賽後出現並鎖住拖曳', async () => {
    const { w, q } = await setup();
    click(w, q('#management-btn'));
    t.assert(!q('#pinch-hit-btn') && !q('#change-pitcher-btn'), '開賽前不該有代打／換投鈕');
    click(w, q('#close-management-modal'));
    t.assert(!q('#lineup-form').classList.contains('game-started'), '開賽前拖曳被鎖');
    startGame(w);
    click(w, q('#management-btn'));
    t.assert(!!q('#pinch-hit-btn') && !!q('#change-pitcher-btn'), '開賽後缺代打或換投鈕');
    t.assert(q('#change-pitcher-btn').textContent.includes('主隊球員10'), '換投鈕沒顯示現任投手');
    click(w, q('#close-management-modal'));
    t.assert(q('#lineup-form').classList.contains('game-started'), '開賽後名單頁沒鎖拖曳');
    t.assert(!q('#lineup-lock-hint').classList.contains('hidden'), '沒有顯示鎖定提示');
    // 打者卡片維持原本資訊：沒有投手、沒有代打鈕、數據直接顯示
    t.assert(!q('#current-batter-display .pitcher-now') && !q('#current-batter-display #pinch-hit-btn'), '打者卡片不該有投手或代打');
    t.assert(!!q('#current-batter-display .batter-stats'), '打者卡片數據不見了');
  });

  await t('代打：一鍵列出板凳、點一下就換完並標 PH', async () => {
    const { w, q, state, pick } = await setup();
    startGame(w);
    click(w, q('#management-btn')); click(w, q('#pinch-hit-btn'));
    t.assert(q('#management-modal').classList.contains('modal-hidden'), '按代打後調度視窗應關閉');
    const names = [...q('#picker-list').querySelectorAll('.picker-name')].map(x => x.textContent);
    t.assert(names.join() === '客板一,客板二', '候選不對：' + names.join());
    pick('客板一');
    t.assert(q('#current-batter-display').textContent.includes('客板一'), '打者沒換成代打');
    const gs = state();
    t.assert(gs.teams.a.lineupSpots[0].subInfo && Object.values(gs.teams.a.lineupSpots[0].subInfo).includes('PH'), '沒有標 PH');
    t.assert(q('#event-log li').textContent.includes('代打'), '事件沒記代打');
  });

  // 代跑改到「球員調度」裡：主頁的人像不再吃點擊（標落點時很容易誤觸）
  await t('代跑：從球員調度進入，離場球員不再列入候選', async () => {
    const { w, q, state, pick } = await setup();
    startGame(w);
    click(w, q('#management-btn')); click(w, q('#pinch-hit-btn')); pick('客板一');
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#management-btn'));
    t.assert(!!q('#pinch-run-btn') && !q('#pinch-run-btn').disabled, '壘上有人卻按不到代跑');
    click(w, q('#pinch-run-btn'));
    t.assert(q('#picker-title').textContent.includes('代跑'), '沒有開啟代跑視窗');
    const names = [...q('#picker-list').querySelectorAll('.picker-name')].map(x => x.textContent);
    t.assert(!names.includes('客隊球員01'), '被換下的球員不該再上場：' + names.join());
    pick('客板二');
    const gs = state();
    t.assert(gs.teams.a.roster.find(p => p._id === gs.bases[0].runnerId).name === '客板二', '一壘跑者沒換');
    t.assert(Object.values(gs.teams.a.lineupSpots[0].subInfo).includes('PR'), '沒有標 PR');
  });

  await t('壘上無人時代跑按不下去', async () => {
    const { w, q } = await setup();
    startGame(w);
    click(w, q('#management-btn'));
    t.assert(q('#pinch-run-btn').disabled, '壘上無人卻按得下代跑');
  });

  await t('點跑者人像會被當成擊球落點（人像不再吃點擊）', async () => {
    const { w, q } = await setup();
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    q('#mf-first').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    t.assert(!q('#field-result-panel').classList.contains('hidden'), '點在跑者身上沒有標落點');
    t.assert(q('#picker-title') === null || !q('#picker-modal') || q('#picker-modal').classList.contains('modal-hidden'), '還是跳出了代跑視窗');
  });

  await t('換投：從主頁換上板凳投手，投手統計另起一列', async () => {
    const { w, q, state, pick } = await setup();
    startGame(w);
    click(w, q('#management-btn')); click(w, q('#change-pitcher-btn'));
    t.assert(q('#picker-title').textContent.includes('主隊球員10'), '換投視窗標題不對');
    pick('主板一');
    const gs = state();
    t.assert(gs.teams.b.roster.find(p => p._id === gs.teams.b.activePitcherId).name === '主板一', '活動投手沒換');
    t.assert(gs.teams.b.pitchers.map(p => p.name).join() === '主隊球員10,主板一', '投手清單不對');
    click(w, q('#management-btn'));
    t.assert(q('#change-pitcher-btn').textContent.includes('主板一'), '調度視窗的換投鈕沒更新現任投手');
  });

  await t('守位圖：點兩個守位互換', async () => {
    const { w, q } = await setup();
    startGame(w);
    click(w, q('#management-btn'));
    click(w, [...w.document.querySelectorAll('#management-team-tabs .tab-btn')].find(b => b.dataset.teamKey === 'b'));
    const nodeOf = pos => w.document.querySelector(`#management-container .def-node[data-pos="${pos}"]`);
    t.assert(w.document.querySelectorAll('#management-container .def-node').length >= 9, '守位圖節點不足');
    const ssName = nodeOf('SS').querySelector('.def-name').textContent;
    const b2Name = nodeOf('2B').querySelector('.def-name').textContent;
    click(w, nodeOf('SS'));
    t.assert(q('.def-hint').textContent.includes('互換'), '沒有互換提示');
    click(w, nodeOf('2B'));
    t.assert(nodeOf('SS').querySelector('.def-name').textContent === b2Name && nodeOf('2B').querySelector('.def-name').textContent === ssName, '守位沒有互換');
    t.assert(q('#event-log li').textContent.includes('守備調度'), '事件沒記');
  });

  await t('守位圖：板凳球員接替某個守位，守位沿用', async () => {
    const { w, q, state } = await setup();
    startGame(w);
    click(w, q('#management-btn'));
    click(w, [...w.document.querySelectorAll('#management-team-tabs .tab-btn')].find(b => b.dataset.teamKey === 'b'));
    click(w, [...w.document.querySelectorAll('#management-container .def-chip[data-source="bench"]')].find(c => c.textContent.includes('主板一')));
    const cf = w.document.querySelector('#management-container .def-node[data-pos="CF"]');
    click(w, cf);
    const gs = state();
    const sub = gs.teams.b.roster.find(p => p.name === '主板一');
    t.assert(sub.pos === 'CF', `替補守位應沿用 CF，得到 ${sub.pos}`);
    t.assert(gs.teams.b.lineupSpots.some(s => s.activePlayerId === sub._id), '替補沒進打序格');
    t.assert(w.document.querySelector('#management-container .def-node[data-pos="CF"] .def-name').textContent.includes('主板一'), '守位圖沒更新');
  });

  await t('比賽中名單頁的拖曳被擋下', async () => {
    const { w, q } = await setup();
    startGame(w);
    const handle = q('#team-a-lineup .drag-handle');
    handle.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    t.assert(!w.document.querySelector('.lineup-player.ghost') && !w.document.querySelector('.lineup-player.dragging'), '比賽中仍能拖曳');
  });
}
