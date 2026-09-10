// 夾殺：壘間事件的守備鏈、三人以上寫成夾殺
import { boot, click, startGame, clickZone } from './harness.mjs';

async function runnerAction({ type, mid, choice, taps }) {
  const { window: w, q } = await boot();
  w.alert = () => {};
  startGame(w);
  click(w, q('#quick-plays button[data-play="四壞"]'));
  click(w, q('#runner-action-btn'));
  const pick = txt => {
    const b = [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === txt);
    if (b) click(w, b);
    return !!b;
  };
  pick(type);
  if (mid) pick(mid);
  pick(choice);
  const label = () => (q('#runner-action-details .fielder-label em') || {}).textContent || '';
  const before = label();
  const fb = d => [...q('#runner-action-details').querySelectorAll('button[data-step="ra-fielder"]')]
    .find(b => b.dataset.dir === d);
  for (const d of taps) click(w, fb(d));
  const after = label();
  click(w, [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成|確定/.test(b.textContent)));
  const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
  return { before, after, log: q('#event-log li').textContent, outs: gs.outs, bases: gs.bases.map(b => !!b) };
}

export default async function (t) {
  await t('盜壘失敗預設帶入捕手傳補位者（2-6）', async () => {
    const r = await runnerAction({ type: '盜壘', mid: '否，繼續', choice: '盜壘失敗（出局）', taps: [] });
    t.assert(r.before.includes('捕→游（2-6）'), '預設鏈不對：' + r.before);
    t.assert(r.log.includes('被捕手傳給游擊手觸殺出局'), '敘述不對：' + r.log);
    t.assert(r.outs === 1 && !r.bases[0], '跑者沒有出局');
  });

  await t('盜壘時單向接力傳球不是夾殺，寫成轉傳觸殺', async () => {
    const r = await runnerAction({ type: '盜壘', mid: '否，繼續', choice: '盜壘失敗（出局）', taps: ['捕', '游', '一', '二'] });
    t.assert(r.after.includes('（2-6-3-4）'), '鏈不對：' + r.after);
    t.assert(!r.log.includes('夾殺'), '單向傳球被寫成夾殺：' + r.log);
    t.assert(r.log.includes('被捕手經游擊手、一壘手轉傳給二壘手觸殺出局'), '敘述不對：' + r.log);
  });

  await t('盜壘時野手重複出現自動判為夾殺', async () => {
    const r = await runnerAction({ type: '盜壘', mid: '否，繼續', choice: '盜壘失敗（出局）', taps: ['捕', '游', '一', '游'] });
    t.assert(r.log.includes('在一壘與二壘之間被夾殺出局'), '敘述不對：' + r.log);
  });

  await t('牽制出局預設投手傳一壘手（1-3）', async () => {
    const r = await runnerAction({ type: '投手牽制', mid: '成功', choice: '牽制出局', taps: [] });
    t.assert(r.before.includes('投→一（1-3）'), '預設鏈不對：' + r.before);
    t.assert(r.log.includes('遭牽制，被投手傳給一壘手觸殺出局'), '敘述不對：' + r.log);
  });

  await t('牽制後夾殺可以記很長的鏈，同一人重複出現', async () => {
    const r = await runnerAction({ type: '投手牽制', mid: '成功', choice: '牽制出局', taps: ['投', '一', '游', '一', '二', '一'] });
    t.assert(r.after.includes('（1-3-6-3-4-3）'), '鏈不對：' + r.after);
    t.assert(r.log.includes('遭牽制後在一壘與二壘之間被夾殺出局'), '敘述不對：' + r.log);
  });

  await t('沒有跑者出局時不顯示處理野手', async () => {
    const r = await runnerAction({ type: '盜壘', mid: '否，繼續', choice: '二壘', taps: [] });
    t.assert(r.before === '', '盜壘成功卻要求選野手：' + r.before);
  });

  await t('打席中的夾殺（野手選擇 5-2-5-2）', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="三安"]'));
    click(w, q('#modal-advanced-done'));
    clickZone(w, 'infield');
    click(w, q('#field-result-panel button[data-play="野手選擇"]'));
    click(w, q('#modal-advanced-options button[data-step="select-fc-out"][data-out-runner-base="2"]'));
    for (const d of ['三', '捕', '三', '捕']) {
      click(w, [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')].find(b => b.dataset.dir === d));
    }
    click(w, q('#modal-advanced-options button[data-runner-id="batter"][data-dest="1"]'));
    click(w, q('#modal-advanced-done'));
    const log = q('#event-log li').textContent;
    t.assert(log.includes('在三壘與本壘之間被夾殺出局'), '敘述不對：' + log);
  });

  await t('外野接力 8-9-4-2 觸殺本壘跑者，不是夾殺；可手動改成夾殺', async () => {
    const setup = async () => {
      const { window: w, q } = await boot();
      w.alert = () => {};
      startGame(w);
      clickZone(w, 'outfield');
      click(w, q('#field-result-panel button[data-play="三安"]'));
      click(w, q('#modal-advanced-done'));
      clickZone(w, 'outfield');
      click(w, q('#field-result-panel button[data-play="一安"]'));
      const no = [...w.document.querySelectorAll('#modal-advanced-options button[data-step="ask-error"]')].find(x => x.dataset.choice === 'no');
      if (no) click(w, no);
      click(w, q('#modal-advanced-options button[data-runner-id="2"][data-dest="0"]'));
      for (const d of ['中', '右', '二', '捕']) {
        click(w, [...q('#modal-advanced-options').querySelectorAll('button[data-step="set-fielder"]')].find(b => b.dataset.dir === d));
      }
      return { w, q };
    };
    let { w, q } = await setup();
    const btn = q('#modal-advanced-options button[data-step="toggle-rundown"]');
    t.assert(btn && !btn.classList.contains('selected'), '單向接力卻預設勾了夾殺');
    click(w, q('#modal-advanced-done'));
    let log = q('#event-log li').textContent;
    t.assert(log.includes('中外野手經右外野手、二壘手轉傳給捕手觸殺出局'), '接力敘述不對：' + log);

    ({ w, q } = await setup());
    click(w, q('#modal-advanced-options button[data-step="toggle-rundown"]'));
    click(w, q('#modal-advanced-done'));
    log = q('#event-log li').textContent;
    t.assert(log.includes('在三壘與本壘之間被夾殺出局'), '手動夾殺沒生效：' + log);
  });

  await t('自動判定的夾殺可以手動取消', async () => {
    const { window: w, q } = await boot();
    w.alert = () => {};
    startGame(w);
    click(w, q('#quick-plays button[data-play="四壞"]'));
    click(w, q('#runner-action-btn'));
    const pick = txt => click(w, [...w.document.querySelectorAll('#runner-action-modal button')].find(x => x.textContent.trim() === txt));
    pick('投手牽制'); pick('成功'); pick('牽制出局');
    for (const d of ['投', '一', '游', '一']) {
      click(w, [...q('#runner-action-details').querySelectorAll('button[data-step="ra-fielder"]')].find(b => b.dataset.dir === d));
    }
    const btn = q('#runner-action-details button[data-step="ra-toggle-rundown"]');
    t.assert(btn.classList.contains('selected'), '1-3-6-3 應自動判為夾殺');
    click(w, btn);
    click(w, [...w.document.querySelectorAll('#runner-action-modal button')].find(b => /完成|確定/.test(b.textContent)));
    const log = q('#event-log li').textContent;
    t.assert(!log.includes('夾殺'), '取消後仍寫夾殺：' + log);
    // 敘述已不附守備代號，改確認整條鏈仍照順序寫成文字
    t.assert(log.includes('被投手經一壘手、游擊手轉傳給一壘手觸殺出局'), '轉傳敘述不對：' + log);
  });
}
