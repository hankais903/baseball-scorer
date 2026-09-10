// 把單檔預覽包進「iPhone 17 Pro 螢幕」的外框裡，並標出動態島的位置，
// 方便在電腦上檢查有沒有東西被動態島擋到。
// 用 iframe 是必要的：APP 的版面靠 100vw／100vh 和「窄螢幕才生效」的規則，
// 只有讓它待在自己的視窗裡，這些才會照手機的樣子算。

// iPhone 17 Pro：6.3 吋、2622×1206 實體像素，換算成網頁座標是 402×874。
// 安全區上緣 62、下緣 34；動態島約 125×37，置中、離上緣約 14（近似值）。
export const DEVICE = {
    name: 'iPhone 17 Pro',
    width: 402,
    height: 874,
    safeTop: 62,
    safeBottom: 34,
    island: { width: 125, height: 37, top: 14 },
};

// APP 在 iframe 裡拿不到真機的安全區數值（env() 會回傳 0），
// 這段樣式把 mobile.css 那組規則換成 iPhone 17 Pro 的實際數字。
export function safeAreaCss(d = DEVICE) {
    return `
/* 預覽外框：模擬 ${d.name} 的安全區 */
@media (max-width: 768px), (orientation: portrait) {
  #control-panel, #main-content, #event-log-container {
    padding-top: max(0.75rem, ${d.safeTop}px);
    padding-bottom: max(60px, calc(${d.safeBottom}px + 52px));
  }
  /* 與 mobile.css 同一組規則，只是把 env() 換成真機數值 */
  #mobile-nav { bottom: max(1rem, calc(${d.safeBottom}px + 0.5rem)); }
  #mobile-nav:has(.nav-dot[data-index="1"].active) { bottom: max(7rem, calc(${d.safeBottom}px + 6.5rem)); }
}`;
}

export function buildFramePage(appHtml, d = DEVICE) {
    const b64 = Buffer.from(appHtml, 'utf8').toString('base64');
    return `<title>棒球比賽紀錄</title>
<style>
  :root {
    --stage: #14161a;
    --bezel: #2b2f36;
    --bezel-edge: #3d434c;
    --ink: #e8ebef;
    --muted: #9aa3ad;
    --mark: #ff4d5e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--stage);
    color: var(--ink);
    font: 14px/1.5 -apple-system, "Segoe UI", "Noto Sans TC", sans-serif;
    min-height: 100vh;
  }
  #stage {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 20px 16px 28px;
  }
  #shell {
    position: relative;
    border: 10px solid var(--bezel);
    border-radius: 46px;
    background: #000;
    box-shadow: 0 0 0 1px var(--bezel-edge), 0 24px 60px rgba(0,0,0,0.6);
    transform-origin: top center;
    flex: none;
  }
  #screen {
    display: block;
    width: ${d.width}px;
    height: ${d.height}px;
    border: 0;
    border-radius: 36px;
    background: #000;
  }
  /* 標示層蓋在畫面上，不吃點擊 */
  #guides { position: absolute; inset: 0; pointer-events: none; border-radius: 36px; overflow: hidden; }
  #guides[hidden] { display: none !important; }
  .band {
    position: absolute; left: 0; right: 0;
    background: rgba(255, 77, 94, 0.10);
    border-bottom: 1px dashed rgba(255, 77, 94, 0.55);
  }
  .band.top { top: 0; height: ${d.safeTop}px; }
  .band.bottom {
    bottom: 0; height: ${d.safeBottom}px;
    border-bottom: 0; border-top: 1px dashed rgba(255, 77, 94, 0.55);
  }
  #island {
    position: absolute;
    top: ${d.island.top}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${d.island.width}px;
    height: ${d.island.height}px;
    border-radius: ${d.island.height / 2}px;
    background: #000;
    outline: 2px solid var(--mark);
    outline-offset: 1px;
  }
  /* 標示文字擺在紅色區塊內、避開畫面內容 */
  .band-label {
    position: absolute;
    left: 10px;
    color: var(--mark);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    white-space: nowrap;
    text-shadow: 0 1px 3px rgba(0,0,0,0.95);
  }
  .band-label.top { top: ${Math.round(d.safeTop / 2 - 7)}px; }
  .band-label.bottom { bottom: ${Math.round(d.safeBottom / 2 - 7)}px; }
  #hud {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center;
    color: var(--muted); font-size: 12.5px;
  }
  #hud b { color: var(--ink); font-weight: 600; }
  #hud .nums { font-variant-numeric: tabular-nums; }
  #toggle {
    font: inherit; color: var(--ink);
    background: #232830; border: 1px solid var(--bezel-edge);
    border-radius: 999px; padding: 6px 14px; cursor: pointer;
  }
  #toggle:hover { background: #2b313a; }
  #toggle:focus-visible { outline: 2px solid var(--mark); outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) { #shell { transition: transform 0.15s ease-out; } }
</style>

<div id="stage">
  <div id="shell">
    <iframe id="screen" title="${d.name} 螢幕預覽"></iframe>
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
    <span>安全區 上 <span class="nums">${d.safeTop}</span>／下 <span class="nums">${d.safeBottom}</span></span>
    <button id="toggle" type="button">隱藏標示</button>
  </div>
</div>

<script id="app-src" type="application/octet-stream">${b64}</script>
<script>
(function () {
    var W = ${d.width}, H = ${d.height};
    var shell = document.getElementById('shell');
    var frame = document.getElementById('screen');
    var guides = document.getElementById('guides');
    var toggle = document.getElementById('toggle');

    // 依視窗大小縮放，但 iframe 本身維持 402×874，
    // 裡面的 APP 才會照真機尺寸排版
    function fit() {
        var availW = window.innerWidth - 32;
        var availH = window.innerHeight - 130;
        var s = Math.min(1, availW / (W + 20), availH / (H + 20));
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

    var bytes = Uint8Array.from(atob(document.getElementById('app-src').textContent), function (c) {
        return c.charCodeAt(0);
    });
    var html = new TextDecoder('utf-8').decode(bytes);

    // 先試著直接寫進 iframe；不成再退回 srcdoc
    var wrote = false;
    try {
        var doc = frame.contentDocument;
        doc.open(); doc.write(html); doc.close();
        wrote = !!(doc.getElementById('app-container'));
    } catch (e) { wrote = false; }
    if (!wrote) frame.srcdoc = html;
})();
</script>`;
}
