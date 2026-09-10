// 名單套用相關的回歸測試
// 這些情境都曾經真的壞掉過，每一項都對應一個修過的 bug
import { boot, type, applyLineup, nameInput, batterText, uploadPhoto, recordAtBat, click, startGame, clickZone }
  from './harness.mjs';

export default async function (t) {
  // --- bug #1：沙箱化 iframe 會阻擋 form submit，套用名單必須靠按鈕 click ---
  await t('套用名單不依賴表單送出', async () => {
    const { window: w, q } = await boot();
    let submitFired = false;
    q('#lineup-form').addEventListener('submit', e => { submitFired = true; e.preventDefault(); });
    type(w, nameInput(w, 'a', 0), '沙箱測試');
    applyLineup(w);
    t.assert(batterText(w).includes('沙箱測試'), '主畫面未更新：' + batterText(w));
    t.assert(!submitFired, '仍依賴原生 submit，沙箱環境會失效');
  });

  await t('套用按鈕的 type 為 button', async () => {
    const { q } = await boot();
    t.assert(q('#apply-lineup').type === 'button', '目前為 ' + q('#apply-lineup').type);
  });

  await t('欄位中按 Enter 也能套用', async () => {
    const { window: w, q } = await boot();
    type(w, nameInput(w, 'a', 0), 'Enter測試');
    q('#lineup-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    t.assert(batterText(w).includes('Enter測試'), batterText(w));
  });

  // --- bug #2：上傳照片觸發重繪，會把還沒套用的輸入洗掉 ---
  await t('改名後上傳照片，名字不被重繪覆蓋', async () => {
    const { window: w } = await boot();
    recordAtBat(w);
    const idx = Number(w.document.querySelector('.batter-order').textContent.replace(/\D/g, '')) - 1;
    type(w, nameInput(w, 'a', idx), '照片測試');
    await uploadPhoto(w, idx);
    t.assert(nameInput(w, 'a', idx).value === '照片測試',
      '輸入被覆蓋成：' + nameInput(w, 'a', idx).value);
    applyLineup(w);
    t.assert(batterText(w).includes('照片測試'), batterText(w));
  });

  await t('未編輯的欄位仍與資料保持同步', async () => {
    const { window: w } = await boot();
    const other = nameInput(w, 'a', 5);
    const original = other.value;
    await uploadPhoto(w, 0);
    t.assert(other.value === original, `${original} → ${other.value}`);
  });

  await t('套用後編輯標記已清除', async () => {
    const { window: w, q } = await boot();
    type(w, nameInput(w, 'a', 0), '標記測試');
    applyLineup(w);
    const left = q('#lineup-form').querySelectorAll('[data-dirty]').length;
    t.assert(left === 0, `殘留 ${left} 個標記`);
  });

  // --- 其他曾出問題或容易連帶壞掉的路徑 ---
  await t('一次修改九位打者', async () => {
    const { window: w } = await boot();
    for (let i = 0; i < 9; i++) type(w, nameInput(w, 'a', i), '選手' + i);
    applyLineup(w);
    const bad = [];
    for (let i = 0; i < 9; i++) if (nameInput(w, 'a', i).value !== '選手' + i) bad.push(i);
    t.assert(bad.length === 0, '失敗棒次 ' + bad.join(','));
  });

  await t('修改隊名會反映在主畫面', async () => {
    const { window: w, q } = await boot();
    type(w, q('#team-a-name'), '新隊名');
    applyLineup(w);
    // 大比分列已移除，隊名改看計分板左欄
    const shown = q('#scoreboard tbody tr:first-child .scoreboard-team-cell span').textContent;
    t.assert(shown === '新隊名', shown);
  });

  await t('修改背號不被覆蓋', async () => {
    const { window: w, q } = await boot();
    const j = q('input[data-team="a"][data-index="0"][data-type="jersey"]');
    type(w, j, '99');
    await uploadPhoto(w, 0);
    applyLineup(w);
    t.assert(q('input[data-team="a"][data-index="0"][data-type="jersey"]').value === '99',
      q('input[data-team="a"][data-index="0"][data-type="jersey"]').value);
  });

  await t('修改主隊與投手名字', async () => {
    const { window: w, q } = await boot();
    type(w, nameInput(w, 'b', 0), '主隊選手');
    const p = q('input[data-team="a"][data-type="pitcher-name"]');
    if (p) type(w, p, '投手X');
    applyLineup(w);
    t.assert(nameInput(w, 'b', 0).value === '主隊選手', nameInput(w, 'b', 0).value);
    if (p) t.assert(q('input[data-team="a"][data-type="pitcher-name"]').value === '投手X',
      q('input[data-team="a"][data-type="pitcher-name"]').value);
  });

  await t('比賽進行中修改名單不影響比分', async () => {
    const { window: w, q } = await boot();
    recordAtBat(w);
    const outsBefore = q('#event-log').children.length;
    type(w, nameInput(w, 'a', 0), '進行中改名');
    applyLineup(w);
    t.assert(q('#event-log').children.length >= outsBefore, '事件紀錄遺失');
    t.assert(nameInput(w, 'a', 0).value === '進行中改名', nameInput(w, 'a', 0).value);
  });

  // 平手時原本沒有結束條件，會無限延長下去
  await t('平手打滿延長局上限會判和局', async () => {
    const { window: w } = await boot();
    const q = s => w.document.querySelector(s);
    let guard = 0;
    while (guard++ < 120) {
      const btn = q('#play-ball-btn');
      if (!btn || btn.classList.contains('disabled')) break;
      recordAtBat(w);            // 全部三振，兩隊皆不得分
    }
    // 終場狀態改由局數標籤呈現
    t.assert(q('#inning-display').textContent.trim() === '終場',
      '未結束，停在 ' + q('#inning-display').textContent.trim());
    const log = q('#event-log').textContent;
    t.assert(log.includes('和局'), '結束訊息未標示和局');
  });

  // 位置優先流程：先點球場落點，再依區域挑結果
  await t('未開賽時球場不可點', async () => {
    const { window: w, q } = await boot();
    t.assert(!q('#play-ball-btn').classList.contains('hidden'), 'PLAY BALL 未顯示');
    t.assert(!q('#main-field').classList.contains('live'), '未開賽卻已可點');
    clickZone(w, 'infield');
    t.assert(q('#field-result-panel').classList.contains('hidden'), '未開賽卻跳出結果選單');
  });

  await t('按下 PLAY BALL 後開賽且字樣消失', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    t.assert(q('#play-ball-btn').classList.contains('hidden'), 'PLAY BALL 仍顯示');
    t.assert(q('#main-field').classList.contains('live'), '球場未進入可點狀態');
  });

  // 落點決定「先顯示哪些結果」：對得上的先列，其餘收在「其他結果」裡。
  // 任何結果都還是記得到，只是不用每次都從十幾顆按鈕裡找。
  await t('點不同區域先顯示的結果不一樣', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    const shownFor = zone => {
      clickZone(w, zone);
      const panel = q('#field-result-panel');
      return {
        先顯示: [...panel.querySelectorAll('button[data-play]')]
          .filter(b => !b.closest('.frp-rest')).map(b => b.dataset.play),
        全部: [...panel.querySelectorAll('button[data-play]')].map(b => b.dataset.play),
      };
    };
    const inf = shownFor('infield');
    const outf = shownFor('outfield');
    const foul = shownFor('foul');
    t.assert(inf.先顯示.join() !== outf.先顯示.join(), '內野與外野先顯示的結果不該一樣');
    t.assert(inf.先顯示.includes('滾地') && inf.先顯示.includes('內安') && inf.先顯示.includes('雙殺'),
      '內野少了常見結果：' + inf.先顯示.join());
    t.assert(!inf.先顯示.includes('三安') && !inf.先顯示.includes('犧飛'),
      '內野不該先列外野才有的結果：' + inf.先顯示.join());
    t.assert(outf.先顯示.includes('二安') && outf.先顯示.includes('本打') && outf.先顯示.includes('犧飛'),
      '外野少了常見結果：' + outf.先顯示.join());
    t.assert(!outf.先顯示.includes('滾地') && !outf.先顯示.includes('雙殺'),
      '外野不該先列內野才有的結果：' + outf.先顯示.join());
    t.assert(foul.先顯示.includes('界飛'), '界外少了界外飛球接殺：' + foul.先顯示.join());
    // 收起來的部分仍然按得到
    for (const z of [inf, outf, foul]) {
      for (const p of ['滾地', '飛球', '內安', '一安', '本打', '界飛', '雙殺', '失誤', '野手選擇']) {
        t.assert(z.全部.includes(p), '整體結果清單缺少 ' + p);
      }
    }
  });

  await t('「其他結果」按下去會展開剩下的選項', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    clickZone(w, 'outfield');
    const more = q('#field-result-panel .frp-more');
    t.assert(more, '外野沒有「其他結果」按鈕');
    t.assert(q('#field-result-panel .frp-rest').classList.contains('hidden'), '一開始就展開了');
    click(w, more);
    t.assert(!q('#field-result-panel .frp-rest').classList.contains('hidden'), '按了沒有展開');
    t.assert(!q('#field-result-panel .frp-more'), '展開後按鈕應該消失');
  });

  await t('未擊出的結果有常駐快捷按鈕', async () => {
    const { window: w, q } = await boot();
    click(w, q('#play-ball-btn'));
    for (const p of ['三振', '四壞', '觸身球']) {
      t.assert(!!q(`#quick-plays button[data-play="${p}"]`), '缺少快捷按鈕：' + p);
    }
    click(w, q('#quick-plays button[data-play="三振"]'));
    t.assert(q('#event-log').textContent.includes('三振'), '三振未記錄');
  });

  // 暴投是投手自身責任，因此造成的得分應計入責失（捕逸與失誤才是非自責）
  await t('暴投造成的得分計入投手責失', async () => {
    const { window: w, q } = await boot();
    const vis = sel => [...w.document.querySelectorAll(sel)].filter(b => !b.closest('.modal-hidden'));
    startGame(w);
    clickZone(w, 'outfield');
    click(w, q('#field-result-panel button[data-play="三安"]'));
    const done = q('#modal-advanced-done');
    if (done && !done.closest('.modal-hidden')) click(w, done);

    const stat = () => {
      const st = JSON.parse(w.localStorage.getItem('baseballGameState'));
      const d = st.isTop ? st.teams.b : st.teams.a;
      const p = d.pitchers.find(x => x._id === d.activePitcherId);
      return { r: p.r, er: p.er, wp: p.wp };
    };
    t.assert(stat().er === 0, '起始責失不為 0');

    click(w, q('#runner-action-btn'));
    click(w, vis('#runner-action-modal button').find(b => b.textContent.trim() === '暴投'));
    const home = vis('#runner-action-modal button').find(b => /本壘|得分/.test(b.textContent));
    if (home) click(w, home);
    const fin = vis('#runner-action-modal button').find(b => b.textContent.trim() === '完成');
    if (fin) click(w, fin);

    const after = stat();
    t.assert(after.wp === 1, '未記錄暴投');
    t.assert(after.r === 1, '未記錄失分');
    t.assert(after.er === 1, `暴投得分應為責失，目前責失 ${after.er}`);
  });

  await t('載入過程沒有錯誤訊息', async () => {
    const { errors } = await boot();
    t.assert(errors.length === 0, errors.join(' | '));
  });
}
