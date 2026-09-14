// 多場比賽的保存規則：最多留 10 場、正在記錄的那一場不能刪
// （曾經刪掉正在記的比賽，畫面整個空掉）
import { boot } from './harness.mjs';

const gm = async () => {
  const { window: w } = await boot();
  const m = new w.GameManager();
  m.silent = true;
  m.showNotification = () => {};
  return { w, m };
};
const fakeGame = n => ({ inning: n, teams: { a: { score: [n] }, b: { score: [0] } } });

export default async function (t) {
  await t('最多只留 10 場比賽，最舊的先丟', async () => {
    const { m } = await gm();
    for (let i = 1; i <= 13; i++) {
      m.currentGameId = null;
      const id = m.createNewGame();
      m.saveGame(id, { ...fakeGame(i), lastModified: new Date(2026, 0, i).toISOString() });
    }
    const list = m.getGamesList();
    t.assert(list.length === 10, '應該只留 10 場，目前 ' + list.length);
    t.assert(list.every(g => g.inning >= 4), '丟掉的不是最舊的：' + list.map(g => g.inning).join(','));
  });

  await t('正在記錄的那一場不會被上限擠掉', async () => {
    const { m } = await gm();
    m.currentGameId = null;
    const keep = m.createNewGame();
    m.saveGame(keep, fakeGame(0));                       // 最早存的那一場
    for (let i = 1; i <= 12; i++) m.saveGame('old_' + i, fakeGame(i));
    m.saveGame(keep, fakeGame(0));
    t.assert(m.getGamesList().some(g => g.id === keep), '正在記的比賽被丟掉了');
  });

  await t('正在記錄的比賽刪不掉', async () => {
    const { m } = await gm();
    m.currentGameId = null;
    const id = m.createNewGame();
    m.saveGame(id, fakeGame(1));
    t.assert(m.deleteGame(id) === false, '竟然刪得掉');
    t.assert(!!m.loadGame(id), '比賽被刪掉了');
    t.assert(m.currentGameId === id, '目前比賽的編號被清掉了（畫面會整個空掉）');
  });

  await t('其他比賽照樣刪得掉', async () => {
    const { m } = await gm();
    m.currentGameId = null;
    m.createNewGame();
    m.saveGame('other_1', fakeGame(2));
    t.assert(m.deleteGame('other_1') === true, '刪不掉別場比賽');
    t.assert(!m.loadGame('other_1'), '沒有真的刪掉');
  });

  await t('比賽列表上，使用中那張卡的刪除鍵是鎖住的', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('dist/game-list-ui.js', 'utf8');
    t.assert(/isCurrent \? ' disabled/.test(src), '使用中的刪除鍵沒有鎖住');
    t.assert(/這是正在記錄的比賽，不能刪除/.test(src), '沒有寫出不能刪的原因');
  });
}
