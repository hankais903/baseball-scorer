// 測試執行器：任一項失敗就以非零狀態結束，GitHub Actions 會據此中止部署
import lineup from './lineup.test.mjs';
import header from './header.test.mjs';
import fieldPoint from './field-point.test.mjs';
import lineupOrder from './lineup-order.test.mjs';
import earnedRuns from './earned-runs.test.mjs';
import fielderChain from './fielder-chain.test.mjs';
import homePlays from './home-plays.test.mjs';
import rundown from './rundown.test.mjs';
import multiOut from './multi-out.test.mjs';
import lineupUx from './lineup-ux.test.mjs';
import situation from './situation.test.mjs';
import subUx from './substitution-ux.test.mjs';
import narration from './narration.test.mjs';
import serviceWorker from './service-worker.test.mjs';
import rosterSaveLoad from './roster-save-load.test.mjs';
import panels from './panels.test.mjs';
import clock from './clock.test.mjs';
import tapTargets from './tap-targets.test.mjs';
import replay from './replay.test.mjs';
import games from './games.test.mjs';
import home from './home.test.mjs';
import gameSetup from './game-setup.test.mjs';
import stats from './stats.test.mjs';
import scoringRules from './scoring-rules.test.mjs';
import gameRules from './game-rules.test.mjs';
import statsRules from './stats-rules.test.mjs';
import rulesPage from './rules-page.test.mjs';
import manualFixes from './manual-fixes.test.mjs';
import manualMore from './manual-more.test.mjs';
import { closeAllWindows } from './harness.mjs';

let pass = 0, fail = 0;
const failures = [];

function makeRunner(suite) {
  const t = async (name, fn) => {
    try {
      await fn();
      pass++; console.log(`  ✓ ${name}`);
    } catch (e) {
      fail++; failures.push(`[${suite}] ${name}：${e.message}`);
      console.log(`  ✗ ${name}\n      ${e.message}`);
    }
  };
  t.assert = (cond, msg) => { if (!cond) throw new Error(msg || '條件不成立'); };
  return t;
}

const suites = [['名單套用', lineup], ['標題列', header], ['擊球落點', fieldPoint], ['棒次與照片', lineupOrder], ['責失分', earnedRuns], ['守備鏈', fielderChain], ['本壘攻防', homePlays], ['夾殺', rundown], ['雙殺三殺', multiOut], ['名單頁 UX', lineupUx], ['戰況表', situation], ['比賽中換人', subUx], ['事件敘述', narration], ['離線快取', serviceWorker], ['名單存讀', rosterSaveLoad], ['事件頁面板', panels], ['計時', clock], ['好不好點', tapTargets], ['重播引擎', replay], ['多場比賽', games], ['球隊與主畫面', home], ['建立比賽', gameSetup], ['成績分頁', stats], ['記分規則', scoringRules], ['比賽規則', gameRules], ['成績規則', statsRules], ['規則速查頁', rulesPage], ['手冊對帳修正', manualFixes], ['手冊補齊', manualMore]];
for (const [name, run] of suites) {
  console.log(`\n${name}`);
  await run(makeRunner(name));
  // 每跑完一個套件就把 jsdom 視窗關掉。以前留到最後才關，套件一多
  // 幾百個視窗同時佔著記憶體，CI 上會直接 heap out of memory。
  closeAllWindows();
  if (global.gc) global.gc();
}

// 關掉所有 jsdom 視窗，否則 game-manager 的自動儲存計時器會讓 node 跑完測試也不結束
closeAllWindows();

console.log('\n' + '='.repeat(48));
console.log(`共 ${pass + fail} 項，通過 ${pass}，失敗 ${fail}`);
if (fail) {
  console.log('\n失敗項目：');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
