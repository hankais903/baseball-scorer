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

const suites = [['名單套用', lineup], ['標題列', header], ['擊球落點', fieldPoint], ['棒次與照片', lineupOrder], ['責失分', earnedRuns], ['守備鏈', fielderChain], ['本壘攻防', homePlays], ['夾殺', rundown], ['雙殺三殺', multiOut], ['名單頁 UX', lineupUx], ['戰況表', situation], ['比賽中換人', subUx]];
for (const [name, run] of suites) {
  console.log(`\n${name}`);
  await run(makeRunner(name));
}

console.log('\n' + '='.repeat(48));
console.log(`共 ${pass + fail} 項，通過 ${pass}，失敗 ${fail}`);
if (fail) {
  console.log('\n失敗項目：');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
