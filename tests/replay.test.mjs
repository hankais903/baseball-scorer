// 重播引擎（第一步）：每個動作都記成紙條，整場可以照紙條重算出一模一樣的結果。
// 這是「修改前面某一筆打席」的基礎——引擎算得跟實際一致，之後才敢開放修改。
import { boot, click, startGame, clickZone } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeCtx(w, q) {
  // 從球場點落點 → 選結果 → 走完進階視窗
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
  const quick = play => click(w, q(`#quick-plays button[data-play="${play}"]`));
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
  // 重算一次，跟現況比對
  const sameAsLive = () => {
    const rebuilt = w.__replay.rebuild();
    if (!rebuilt) return '沒有重算起點';
    const a = w.__replay.digest(rebuilt), b = w.__replay.digest();
    if (a === b) return '';
    // 找出第一個不一樣的地方，方便看出是哪個欄位沒重算對
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return '重算結果不同，從第 ' + i + ' 字起：\n重算 ' + a.slice(Math.max(0, i - 60), i + 90)
      + '\n現況 ' + b.slice(Math.max(0, i - 60), i + 90);
  };
  return { field, quick, runnerEvent, sameAsLive };
}

export default async function (t) {
  await t('開賽前沒有重算起點，開賽後就有', async () => {
    const { window: w, q } = await boot();
    t.assert(w.__replay.hasStart() === false, '還沒開賽就有起點了');
    startGame(w);
    t.assert(w.__replay.hasStart() === true, '開賽後沒有拍下起點');
    t.assert(w.__replay.log().length === 0, '開賽當下不該有紙條');
  });

  await t('一整局打完，照紙條重算的結果跟實際一樣', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('四壞');                 // 1棒保送
    c.field('outfield', '一安');      // 2棒一安
    c.quick('三振');                 // 3棒三振
    c.field('infield', '滾地');       // 4棒滾地
    c.field('outfield', '飛球');      // 5棒飛球，三出局換局
    t.assert(w.__replay.log().length === 5, '紙條數不對：' + w.__replay.log().length);
    t.assert(c.sameAsLive() === '', c.sameAsLive());
  });

  await t('得分、失誤、跑者事件也都重算得回來', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.field('outfield', '二安');
    c.runnerEvent('盜壘', '成功');
    c.field('outfield', '本打');       // 全壘打，把跑者帶回來得分
    c.quick('觸身球');
    c.field('infield', '雙殺');
    t.assert(c.sameAsLive() === '', c.sameAsLive());
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.score.reduce((x, y) => x + (y || 0), 0) > 0, '這段應該有得分才有比對價值');
  });

  await t('換人（代打）之後重算仍然一致', async () => {
    const { window: w, q } = await boot();
    // 先加一個板凳球員
    click(w, q('.bench-add-btn[data-team="a"]'));
    const row = [...w.document.querySelectorAll('#team-a-bench .lineup-player')]
      .find(r => !r.classList.contains('bench-hidden') && !r.querySelector('input[data-type="name"]').value);
    const ni = row.querySelector('input[data-type="name"]');
    ni.value = '客板一';
    ni.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(250);
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    click(w, q('#management-btn'));
    click(w, q('#pinch-hit-btn'));
    click(w, [...q('#picker-list').querySelectorAll('.picker-item')].find(b => b.textContent.includes('客板一')));
    t.assert(w.__replay.log().some(e => e.t === 'sub'), '換人沒有記成紙條');
    c.quick('四壞');
    t.assert(c.sameAsLive() === '', c.sameAsLive());
  });

  await t('按了復原，紙條也跟著退一張', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    c.quick('四壞');
    t.assert(w.__replay.log().length === 2, '紙條數不對：' + w.__replay.log().length);
    click(w, q('#undo-btn'));
    t.assert(w.__replay.log().length === 1, '復原後紙條沒有跟著退：' + w.__replay.log().length);
    t.assert(c.sameAsLive() === '', c.sameAsLive());
  });

  await t('自動對帳：每記一筆就會重算比對一次', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    await sleep(30);                       // 對帳排在動作做完之後
    const chk = w.__replay.lastCheck();
    t.assert(chk.ok === true, '自動對帳發現不一致：' + JSON.stringify(chk));
    t.assert(chk.where === 'play', '對帳沒有記下是哪種動作：' + JSON.stringify(chk));
  });

  // === 第二步：修改／刪除前面某一筆 ===
  await t('刪除中間那一筆，後面的自動重算', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    c.quick('四壞');      // 1 人在一壘
    c.quick('三振');
    let gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.outs === 2 && !!gs.bases[0], '前置狀況不對');
    w.__editEntry.del(1);                       // 把中間的四壞刪掉
    gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(w.__replay.log().length === 2, '紙條沒刪掉：' + w.__replay.log().length);
    t.assert(gs.outs === 2, '出局數沒重算：' + gs.outs);
    t.assert(!gs.bases[0], '一壘的跑者沒有跟著消失');
    t.assert(gs.teams.a.roster[1].bb === 0, '被刪掉的四壞還留在成績裡');
    t.assert(gs.events.filter(e => /四壞|保送/.test(e.text)).length === 0, '事件列表還留著那一筆');
    t.assert(c.sameAsLive() === '', c.sameAsLive());
  });

  await t('重記某一筆：記完會自動接回後面的紀錄', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');      // 第 0 筆：要改成四壞
    c.quick('三振');
    c.quick('四壞');
    w.__editEntry.start(0);
    t.assert(!!w.__editEntry.current(), '沒有進入修改模式');
    t.assert(w.__replay.log().length === 0, '沒有退回那一筆之前：' + w.__replay.log().length);
    t.assert(!q('#edit-mode-bar').classList.contains('hidden'), '沒有顯示修改中的提示條');
    c.quick('四壞');       // 重新記成四壞
    await sleep(30);       // 接回後面的紀錄排在動作之後
    t.assert(!w.__editEntry.current(), '沒有離開修改模式');
    t.assert(q('#edit-mode-bar').classList.contains('hidden'), '提示條沒有收起來');
    t.assert(w.__replay.log().length === 3, '後面的紀錄沒接回來：' + w.__replay.log().length);
    const gs = JSON.parse(w.localStorage.getItem('baseballGameState'));
    t.assert(gs.teams.a.roster[0].bb === 1 && gs.teams.a.roster[0].so === 0, '第 1 棒沒有改成四壞');
    t.assert(gs.outs === 1, '後面那個三振沒接回來：出局數 ' + gs.outs);
    t.assert(c.sameAsLive() === '', c.sameAsLive());
  });

  await t('修改到一半可以取消，整場回到原樣', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    c.quick('四壞');
    const before = w.__replay.digest();
    w.__editEntry.start(0);
    t.assert(w.__replay.log().length === 0, '沒有退回去');
    w.__editEntry.cancel();
    t.assert(w.__replay.log().length === 2, '取消後紙條沒回來：' + w.__replay.log().length);
    t.assert(w.__replay.digest() === before, '取消後狀態跟原本不一樣');
    t.assert(q('#edit-mode-bar').classList.contains('hidden'), '提示條沒收起來');
  });

  await t('事件列表：可改的行才有記號，局數列與比賽開始沒有', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    const rows = [...w.document.querySelectorAll('#event-log li')];
    const inning = rows.find(li => li.classList.contains('ev-inning'));
    t.assert(inning && !inning.querySelector('.ev-edit'), '局數列不該有修改記號');
    const play = rows.find(li => li.textContent.includes('三振'));
    t.assert(!!play.querySelector('.ev-edit'), '打席那一行沒有修改記號');
    t.assert(play.querySelector('.ev-edit').dataset.entry === '0', '記號指到的紙條不對');
    // 記號不進文字，事件敘述的比對不受影響
    t.assert(!play.textContent.includes('✎'), '修改記號跑進事件文字裡了');
    // 點下去會跳出選單
    click(w, play.querySelector('.ev-edit'));
    t.assert(!q('#event-edit-modal').classList.contains('modal-hidden'), '沒有跳出「這一筆要怎麼處理」');
    click(w, q('#event-edit-cancel'));
    t.assert(q('#event-edit-modal').classList.contains('modal-hidden'), '取消後視窗沒關');
  });

  await t('刪除後按復原，整場回到刪除前', async () => {
    const { window: w, q } = await boot();
    const c = makeCtx(w, q);
    startGame(w);
    c.quick('三振');
    c.quick('四壞');
    const before = w.__replay.digest();
    w.__editEntry.del(0);
    t.assert(w.__replay.digest() !== before, '刪了卻沒有變化');
    click(w, q('#undo-btn'));
    t.assert(w.__replay.log().length === 2, '復原後紙條沒回來：' + w.__replay.log().length);
    t.assert(w.__replay.digest() === before, '復原後狀態跟刪除前不一樣');
  });
}
