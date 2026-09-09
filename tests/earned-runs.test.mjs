// 責失分（ER）判定
import { boot, click, startGame, clickZone } from './harness.mjs';

function makeCtx(w, q) {
  const field = (zone, play) => {
    clickZone(w, zone);
    const b = q(`#field-result-panel button[data-play="${play}"]`);
    if (!b) throw new Error('球場選項沒有 ' + play);
    click(w, b);
    const pos = q('#modal-advanced-options button[data-step="select-error"]');
    if (pos) click(w, pos);
    const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')]
      .find(x => x.dataset.choice === 'no');
    if (no) click(w, no);
    const done = q('#modal-advanced-done');
    if (done.disabled) throw new Error('完成被鎖住：' + q('#modal-advanced-summary').textContent);
    click(w, done);
  };
  const runnerEvent = (type, choice) => {
    click(w, q('#runner-action-btn'));
    const pick = txt => {
      const b = [...w.document.querySelectorAll('#runner-action-modal button')]
        .find(x => x.textContent.trim() === txt);
      if (b) click(w, b);
      return !!b;
    };
    pick(type); pick('否，繼續'); pick(choice);
    const done = [...w.document.querySelectorAll('#runner-action-modal button')]
      .find(b => /完成|確定/.test(b.textContent));
    if (done) click(w, done);
  };
  const stats = () => {
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    const t = gs.teams.b;
    const p = t.pitchers.find(x => x._id === t.activePitcherId);
    return { r: p.r, er: p.er, potentialOuts: gs.inningPotentialOuts };
  };
  return { field, runnerEvent, stats };
}

async function scene(t, name, body, expect) {
  await t(name, async () => {
    const { window: w, q } = await boot();
    w.alert = () => {}; w.confirm = () => true;
    startGame(w);
    const ctx = makeCtx(w, q);
    await body({ w, q, ...ctx });
    const s = ctx.stats();
    t.assert(s.r === expect.r && s.er === expect.er,
      `得到 R=${s.r} ER=${s.er}，應為 R=${expect.r} ER=${expect.er}`);
  });
}

export default async function (t) {
  await scene(t, '純安打得分全部算責失',
    async ({ field }) => { field('outfield', '一安'); field('outfield', '一安'); field('outfield', '本打'); },
    { r: 3, er: 3 });

  await scene(t, '四壞後全壘打，兩分都是責失',
    async ({ w, q, field }) => { click(w, q('#quick-plays button[data-play="四壞"]')); field('outfield', '本打'); },
    { r: 2, er: 2 });

  await scene(t, '靠失誤上壘者得分不算責失',
    async ({ field }) => { field('infield', '失誤'); field('outfield', '本打'); },
    { r: 2, er: 1 });

  await scene(t, '兩出局後的失誤，之後的得分都不算責失',
    async ({ w, q, field }) => {
      click(w, q('#quick-plays button[data-play="三振"]'));
      click(w, q('#quick-plays button[data-play="三振"]'));
      field('infield', '失誤');
      field('outfield', '本打');
    },
    { r: 2, er: 0 });

  await scene(t, '失誤與安打混合時只有失誤上壘者不算責失',
    async ({ field }) => { field('infield', '失誤'); field('outfield', '三安'); field('outfield', '本打'); },
    { r: 3, er: 2 });

  await scene(t, '暴投失分算投手責失',
    async ({ field, runnerEvent }) => { field('outfield', '三安'); runnerEvent('暴投', '得分'); },
    { r: 1, er: 1 });

  await scene(t, '捕逸失分不算投手責失',
    async ({ field, runnerEvent }) => { field('outfield', '三安'); runnerEvent('捕逸', '得分'); },
    { r: 1, er: 0 });

  await scene(t, '盜本壘得分算責失',
    async ({ field, runnerEvent }) => { field('outfield', '三安'); runnerEvent('盜壘', '得分'); },
    { r: 1, er: 1 });

  await t('靠失誤上壘的打者預設站上一壘，不會憑空消失', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="失誤"]'));
    click(w, q('#modal-advanced-options button[data-step="select-error"]'));
    const sel = q('#modal-advanced-options button[data-runner-id]') ||
                q('#modal-advanced-options button.selected');
    t.assert(!!q('#modal-advanced-options .selected'), '打者的去向沒有預設值');
    click(w, q('#modal-advanced-done'));
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(!!gs.bases[0], '打者沒有站上一壘');
    t.assert(gs.bases[0].isUnearned === true, '靠失誤上壘卻標成責失');
    t.assert(gs.outs === 0, '不該記出局');
  });

  await t('選擇失誤位置的步驟不能直接按完成', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="失誤"]'));
    t.assert(q('#modal-advanced-done').disabled, '還沒選失誤位置就能按完成');
    click(w, q('#modal-advanced-options button[data-step="select-error"]'));
    t.assert(!q('#modal-advanced-done').disabled, '選完位置後仍按不下完成');
  });

  await t('打者沒指定去向時擋下完成', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="失誤"]'));
    click(w, q('#modal-advanced-options button[data-step="select-error"]'));
    // 再點一次已選的一壘＝取消，打者就沒有去向了
    const first = q('#modal-advanced-options button.selected');
    click(w, first);
    if (q('#modal-advanced-done').disabled) {
      t.assert(q('#modal-advanced-summary').textContent.includes('打者'), '沒有說明原因');
    }
    else {
      t.assert(!!q('#modal-advanced-options button.selected'), '沒有選取卻仍可完成');
    }
  });
}
