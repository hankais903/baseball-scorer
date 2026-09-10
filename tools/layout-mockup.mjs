// 版面試作：在不動 index.tsx 的前提下，用注入的樣式和一小段搬家腳本，
// 做出「乙案」「丙案」兩種主頁排法，放進 iPhone 外框裡讓人實際點來比較。
import { DEVICE, safeAreaCss } from './device-frame.mjs';

// 兩案共用：打者卡瘦身（照片是把卡片撐到 143 高的元凶）
const SLIM_BATTER = `
[data-mock] #current-batter-display {
  padding: 3px 8px;
  gap: 8px;
  align-items: center;
}
[data-mock] #current-batter-display .player-photo-container,
[data-mock] #current-batter-display img {
  width: 38px;
  height: 38px;
  min-width: 38px;
  flex: 0 0 38px;
}
[data-mock] #batter-info-text { gap: 2px; min-width: 0; }
[data-mock] .batter-team-name { display: none; }          /* 隊名在計分板已經有了 */
[data-mock] .batter-name-row { gap: 6px; align-items: baseline; }
[data-mock] .batter-name { font-size: 1rem; line-height: 1.2; }
[data-mock] .batter-order { font-size: 0.7rem; padding: 1px 5px; }
[data-mock] .batter-stats { gap: 8px; margin-top: 1px; }
[data-mock] .batter-stats .stat b { font-size: 0.78rem; line-height: 1.15; }
[data-mock] .batter-stats .stat i { font-size: 0.54rem; line-height: 1.1; }
[data-mock] #batter-last-ab { margin-top: 0; font-size: 0.56rem; line-height: 1.3; }
[data-mock] #batter-last-ab .ab-chip { padding: 0 4px; }
`;

// 乙案改：左邊放打者卡，右邊放「NEXT 下兩棒」；大比分列收掉，比分回到計分板
const PLAN_B = `
[data-mock="b"] #game-info-center { display: none; }
[data-mock="b"] #mock-row { display: flex; gap: 8px; align-items: stretch; }
[data-mock="b"] #mock-row > #current-batter-display { flex: 1 1 auto; min-width: 0; order: 1; }
[data-mock="b"] #mock-next {
  flex: 0 0 36%;
  order: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 2px;
  padding: 4px 8px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  min-width: 0;
}
[data-mock="b"] .next-label {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #7dd3fc;
  line-height: 1;
}
[data-mock="b"] .next-item {
  display: flex; align-items: baseline; justify-content: center; gap: 5px;
  max-width: 100%; line-height: 1.25;
}
[data-mock="b"] .next-order {
  font-size: 0.6rem; font-weight: 700; opacity: 0.7; flex: none;
  font-variant-numeric: tabular-nums;
}
[data-mock="b"] .next-name {
  font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
[data-mock="b"] .next-item.on-deck .next-name { font-weight: 700; }
[data-mock="b"] .next-item.in-hole { opacity: 0.62; }
/* 大比分收掉了，比分改由計分板的 R 欄撐起來 */
[data-mock="b"] #scoreboard .total-col { font-size: 1.15rem; font-weight: 800; color: #fff; }
[data-mock="b"] #scoreboard .scoreboard-team-cell span { font-size: 0.9rem; font-weight: 700; }
[data-mock="b"] #scoreboard th.rhe-first,
[data-mock="b"] #scoreboard td.rhe-first { border-left: 1px solid rgba(255,255,255,0.25); }

/* 兩案共用：面板小圓點改成貼在球場下緣，才不會壓到下面的按鈕 */
[data-mock] #game-state-container { position: relative; }
[data-mock] #mobile-nav {
  position: absolute;
  bottom: 6px;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  width: auto;
}
`;

// 丙案：大比分列整個收掉，比分回到計分板（R 欄放大），打者卡專心放打者
const PLAN_C = `
[data-mock="c"] #game-info-center { display: none; }
[data-mock="c"] #scoreboard .total-col {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
}
[data-mock="c"] #scoreboard .scoreboard-team-cell span { font-size: 0.9rem; font-weight: 700; }
[data-mock="c"] #scoreboard th.rhe-first,
[data-mock="c"] #scoreboard td.rhe-first { border-left: 1px solid rgba(255,255,255,0.25); }
[data-mock="c"] #scoreboard td, [data-mock="c"] #scoreboard th { padding-top: 2px; padding-bottom: 2px; }
`;

export function mockCss() {
    return `\n/* === 版面試作（僅預覽用，未進 index.css） === */\n${SLIM_BATTER}${PLAN_B}${PLAN_C}`;
}

// 乙案需要把「大比分列」搬到打者卡旁邊，純 CSS 做不到，所以搬一次 DOM
export function mockJs() {
    return `
(function () {
    var LINEUP = 9;

    function readState() {
        try { return JSON.parse(localStorage.getItem('baseballGameState')); } catch (e) { return null; }
    }

    // 進攻方：上半局是客隊(a)，下半局是主隊(b)
    function nextTwo() {
        var gs = readState();
        if (!gs || !gs.teams) return [];
        var key = gs.isTop === false ? 'b' : 'a';
        var team = gs.teams[key];
        if (!team) return [];
        var idx = (gs.currentBatterIndex && gs.currentBatterIndex[key]) || 0;
        var out = [];
        for (var n = 1; n <= 2; n++) {
            var i = (idx + n) % LINEUP;
            var spot = (team.lineupSpots || [])[i];
            var pid = spot && spot.activePlayerId;
            var player = (team.roster || []).filter(function (p) { return p && p.id === pid; })[0];
            if (!player) player = (team.roster || [])[i];
            out.push({ order: i + 1, name: (player && player.name) || '—' });
        }
        return out;
    }

    function renderNext() {
        if (document.documentElement.dataset.mock !== 'b') return;
        var card = document.getElementById('mock-next');
        if (!card) return;
        var list = nextTwo();
        if (!list.length) return;
        card.innerHTML = '<div class="next-label">NEXT</div>' + list.map(function (p, i) {
            return '<div class="next-item ' + (i === 0 ? 'on-deck' : 'in-hole') + '">' +
                   '<span class="next-order">' + p.order + '棒</span>' +
                   '<span class="next-name">' + p.name + '</span></div>';
        }).join('');
    }

    function apply() {
        var mock = document.documentElement.dataset.mock;

        // 小圓點改掛在球場容器裡（兩案共用）
        var field = document.getElementById('game-state-container');
        var nav = document.getElementById('mobile-nav');
        if (mock && field && nav && nav.parentNode !== field) field.appendChild(nav);

        if (mock !== 'b') return;
        var batter = document.getElementById('current-batter-display');
        if (!batter) return;
        if (!document.getElementById('mock-row')) {
            var row = document.createElement('div');
            row.id = 'mock-row';
            batter.parentNode.insertBefore(row, batter);
            var next = document.createElement('div');
            next.id = 'mock-next';
            row.appendChild(next);
            row.appendChild(batter);
            // 打者換人時 APP 會重畫打者卡，順手跟著更新 NEXT
            new MutationObserver(renderNext).observe(batter, { childList: true, subtree: true });
        }
        renderNext();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    setTimeout(apply, 300);
    setInterval(renderNext, 1000);
})();`;
}

const VARIANTS = [
    { key: '', name: '現況', note: '目前線上的排法' },
    { key: 'b', name: '乙案改', note: '左邊打者卡、右邊 NEXT 下兩棒；比分回到計分板' },
    { key: 'c', name: '丙案', note: '大比分收進計分板，打者卡瘦身' },
];

export function buildComparePage(appHtml, d = DEVICE) {
    const b64 = Buffer.from(appHtml, 'utf8').toString('base64');
    const safeBottomY = d.height - d.safeBottom;
    return `<title>棒球比賽紀錄</title>
<style>
  :root { --stage:#14161a; --bezel:#2b2f36; --edge:#3d434c; --ink:#e8ebef; --muted:#9aa3ad; --mark:#ff4d5e; --ok:#4ade80; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--stage); color:var(--ink);
         font:14px/1.5 -apple-system,"Segoe UI","Noto Sans TC",sans-serif; min-height:100vh; }
  #stage { min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:14px; padding:16px 16px 24px; }
  #tabs { display:flex; gap:6px; background:#1c2027; padding:4px; border-radius:999px; border:1px solid var(--edge); }
  #tabs button { font:inherit; font-size:13px; color:var(--muted); background:none; border:0;
                 border-radius:999px; padding:6px 16px; cursor:pointer; }
  #tabs button[aria-selected="true"] { background:#323945; color:var(--ink); font-weight:600; }
  #tabs button:focus-visible { outline:2px solid var(--mark); outline-offset:2px; }
  #note { color:var(--muted); font-size:12.5px; text-align:center; min-height:1.5em; }
  #shell { position:relative; border:10px solid var(--bezel); border-radius:46px; background:#000;
           box-shadow:0 0 0 1px var(--edge), 0 24px 60px rgba(0,0,0,0.6); transform-origin:top center; flex:none; }
  .screen { display:block; width:${d.width}px; height:${d.height}px; border:0; border-radius:36px; background:#000; }
  .screen[hidden] { display:none !important; }
  #guides { position:absolute; inset:0; pointer-events:none; border-radius:36px; overflow:hidden; }
  #guides[hidden] { display:none !important; }
  .band { position:absolute; left:0; right:0; background:rgba(255,77,94,0.10); }
  .band.top { top:0; height:${d.safeTop}px; border-bottom:1px dashed rgba(255,77,94,0.55); }
  .band.bottom { bottom:0; height:${d.safeBottom}px; border-top:1px dashed rgba(255,77,94,0.55); }
  #island { position:absolute; top:${d.island.top}px; left:50%; transform:translateX(-50%);
            width:${d.island.width}px; height:${d.island.height}px; border-radius:${d.island.height / 2}px;
            background:#000; outline:2px solid var(--mark); outline-offset:1px; }
  .band-label { position:absolute; left:10px; color:var(--mark); font-size:10.5px; letter-spacing:.06em;
                white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.95); }
  .band-label.top { top:${Math.round(d.safeTop / 2 - 7)}px; }
  .band-label.bottom { bottom:${Math.round(d.safeBottom / 2 - 7)}px; }
  #hud { display:flex; align-items:center; gap:14px; flex-wrap:wrap; justify-content:center;
         color:var(--muted); font-size:12.5px; }
  #hud b { color:var(--ink); font-weight:600; }
  .nums { font-variant-numeric: tabular-nums; }
  #verdict { padding:3px 10px; border-radius:999px; border:1px solid var(--edge); }
  #verdict.fit { color:var(--ok); border-color:rgba(74,222,128,.5); }
  #verdict.over { color:var(--mark); border-color:rgba(255,77,94,.5); }
  #toggle { font:inherit; color:var(--ink); background:#232830; border:1px solid var(--edge);
            border-radius:999px; padding:6px 14px; cursor:pointer; }
  #toggle:hover { background:#2b313a; }
  #toggle:focus-visible { outline:2px solid var(--mark); outline-offset:2px; }
</style>

<div id="stage">
  <div id="tabs" role="tablist">
${VARIANTS.map((v, i) => `    <button type="button" role="tab" data-key="${v.key}" data-note="${v.note}" aria-selected="${i === 0}">${v.name}</button>`).join('\n')}
  </div>
  <div id="note">${VARIANTS[0].note}</div>
  <div id="shell">
    <div id="guides">
      <div class="band top"></div>
      <div class="band bottom"></div>
      <div id="island"></div>
      <div class="band-label top">動態島 ${d.island.width}×${d.island.height}　安全區上緣 ${d.safeTop}</div>
      <div class="band-label bottom">Home 指示條 ${d.safeBottom}</div>
    </div>
  </div>
  <div id="hud">
    <span><b>${d.name}</b> <span class="nums">${d.width} × ${d.height}</span></span>
    <span id="verdict">量測中…</span>
    <button id="toggle" type="button">隱藏標示</button>
  </div>
</div>

<script id="app-src" type="application/octet-stream">${b64}</script>
<script>
(function () {
    var W = ${d.width}, H = ${d.height}, SAFE_BOTTOM_Y = ${safeBottomY};
    var shell = document.getElementById('shell');
    var guides = document.getElementById('guides');
    var toggle = document.getElementById('toggle');
    var tabs = document.getElementById('tabs');
    var note = document.getElementById('note');
    var verdict = document.getElementById('verdict');

    var bytes = Uint8Array.from(atob(document.getElementById('app-src').textContent), function (c) { return c.charCodeAt(0); });
    var appHtml = new TextDecoder('utf-8').decode(bytes);
    var frames = {};

    function fit() {
        var s = Math.min(1, (window.innerWidth - 32) / (W + 20), (window.innerHeight - 210) / (H + 20));
        s = Math.max(s, 0.3);
        shell.style.transform = 'scale(' + s + ')';
        shell.style.marginBottom = ((s - 1) * (H + 20)) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();

    toggle.addEventListener('click', function () {
        var showing = !guides.hidden;
        guides.hidden = showing;
        toggle.textContent = showing ? '顯示標示' : '隱藏標示';
    });

    // 量最下面那個東西的底端，判斷有沒有被 Home 指示條吃掉
    function measure(frame) {
        try {
            var doc = frame.contentDocument;
            var lowest = 0, name = '';
            [['#quick-plays', '快捷列'], ['.main-actions-container', '三顆按鈕']].forEach(function (pair) {
                var el = doc.querySelector(pair[0]);
                if (!el) return;
                var b = el.getBoundingClientRect();
                if (b.height && b.bottom > lowest) { lowest = b.bottom; name = pair[1]; }
            });
            if (!lowest) { verdict.textContent = '量測中…'; verdict.className = ''; return; }
            var y = Math.round(lowest);
            var fits = y <= SAFE_BOTTOM_Y;
            verdict.textContent = (fits ? '放得下' : '超出') + '：最低的「' + name + '」底端 y=' + y +
                                  '（安全線 ' + SAFE_BOTTOM_Y + '）';
            verdict.className = fits ? 'fit' : 'over';
        } catch (e) { verdict.textContent = '量不到'; verdict.className = ''; }
    }

    function show(key) {
        Object.keys(frames).forEach(function (k) { frames[k].hidden = true; });
        if (!frames[key]) {
            var f = document.createElement('iframe');
            f.className = 'screen';
            f.title = '${d.name} 螢幕預覽';
            shell.insertBefore(f, guides);
            frames[key] = f;
            var html = appHtml.replace('<html lang="zh-TW">', '<html lang="zh-TW"' + (key ? ' data-mock="' + key + '"' : '') + '>');
            try {
                var doc = f.contentDocument;
                doc.open(); doc.write(html); doc.close();
            } catch (e) { f.srcdoc = html; }
            [400, 900, 1600, 2600].forEach(function (ms) { setTimeout(function () { measure(f); }, ms); });
            setInterval(function () { if (!f.hidden) measure(f); }, 800);
        } else {
            measure(frames[key]);
        }
        frames[key].hidden = false;
    }

    tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[role="tab"]');
        if (!btn) return;
        [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        note.textContent = btn.dataset.note;
        show(btn.dataset.key);
    });

    show('');
})();
</script>`;
}

export { safeAreaCss };
