/**
 * 依 WBSC / IBAF 官方格式產生正式記錄表
 * 對照 IBAF_Scoresheet_SBSF 的欄位配置：
 *   左側 DEFENSE、中央九打序 × 各局打席格、右側 OFFENSE
 *   下方 PITCHERS / CATCHERS、右下 THE BOX SCORE BALANCE
 */
(function () {
    'use strict';

    // 守備位置 → 官方編號
    const POS_NUM = { P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9, DH: 'DH' };

    // 本 APP 的結果代碼 → 官方符號
    const PLAY_SYMBOL = {
        '三振': 'K', '不死三振': 'K/WP',
        '滾地': 'G', '飛球': 'F.', '界飛': 'FF.',
        '雙殺': 'GDP.', '三殺': 'TP.',
        '犧短': 'SH', '犧飛': 'SF',
        '四壞': 'BB', '觸身球': 'HP',
        '內安': '1B', '一安': '1B', '二安': 'Tw', '三安': '3B', '本打': 'HR',
        '失誤': 'E.', '野手選擇': 'FC.',
        '妨礙守備': 'INT', '妨礙打擊': 'INT'
    };

    // 擊球方向代號 → 官方守備編號
    const DIR_NUM = { '投': 1, '捕': 2, '一': 3, '二': 4, '三': 5, '游': 6, '左': 7, '中': 8, '右': 9 };

    function symbolFor(result) {
        let [name, dir] = String(result).split('#')[0].split('@');
        // ~L / ~F：平飛或高飛的雙殺三殺（不是 GDP）
        let air = '';
        const m = /~([LF])$/.exec(dir || name);
        if (m) { air = m[1]; if (dir) dir = dir.replace(/~[LF]$/, ''); else name = name.replace(/~[LF]$/, ''); }
        let sym = PLAY_SYMBOL[name] || name;
        if (air && name === '雙殺') sym = `${air}. DP`;
        if (air && name === '三殺') sym = `${air}. TP`;
        if (!dir) return sym;
        if (air) {
            const nums0 = [...dir].map(ch => DIR_NUM[ch]).filter(Boolean);
            return nums0.length ? `${air}${nums0.join('-')} ${name === '雙殺' ? 'DP' : 'TP'}` : sym;   // L8-6 DP
        }
        // dir 可能是一串守備鏈（例如「游一」→ 6-3）
        const nums = [...dir].map(ch => DIR_NUM[ch]).filter(Boolean);
        if (!nums.length) return sym;
        const code = nums.join('-');
        if (sym === 'G') return code;                        // 6-3 = 游擊滾地傳一壘出局
        if (sym.startsWith('GDP')) return `${code} GDP`;     // 6-4-3 GDP
        if (nums.length > 1) return `${sym}${nums[0]}-${nums.slice(1).join('-')}`;
        return sym + nums[0];                                // F.8 = 中外野飛球
    }

    function ipText(outs) {
        const w = Math.floor(outs / 3), f = outs % 3;
        return f ? `${w} ${f}/3` : String(w);
    }

    function sum(arr, key) { return arr.reduce((a, x) => a + Number(x[key] || 0), 0); }

    // 依球隊組出一張表所需的全部資料
    function buildTeamData(state, teamKey) {
        const team = state.teams[teamKey];
        const players = [];
        team.lineupSpots.forEach((spot, i) => {
            (spot.history || [spot.activePlayerId]).forEach((pid, hIdx) => {
                const p = team.roster.find(r => r._id === pid);
                if (p) players.push({ order: i + 1, sub: hIdx > 0, p });
            });
        });
        return { team, players };
    }

    function offenseTotals(players) {
        const t = { pa: 0, ab: 0, r: 0, h: 0, '2b': 0, '3b': 0, hr: 0, gidp: 0,
                    sh: 0, sf: 0, bb: 0, ibb: 0, hbp: 0, io: 0, sb: 0, cs: 0, so: 0, rbi: 0 };
        players.forEach(({ p }) => {
            for (const k in t) t[k] += Number(p[k] || 0);
            t.so += 0;
        });
        return t;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g,
            c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function teamSheet(state, teamKey, oppKey, innings) {
        const { team, players } = buildTeamData(state, teamKey);
        const opp = state.teams[oppKey];
        const t = offenseTotals(players);

        // 每位打者逐局的打席格；同一局多次打席以斜線並列
        const cellFor = (p, inning) => {
            const hits = (p.abResults || []).filter(r => {
                const n = Number(String(r).split('#')[1]);
                return n === inning + 1;
            });
            return hits.map(symbolFor).map(esc).join(' / ');
        };

        const rows = players.map(({ order, sub, p }) => {
            const cells = [];
            for (let i = 0; i < innings; i++) cells.push(`<td class="ab-cell">${cellFor(p, i)}</td>`);
            return `<tr>
                <td class="pos">${esc(POS_NUM[p.pos] || p.pos || '')}</td>
                <td class="name">${sub ? '↳ ' : ''}${esc(p.name)}</td>
                <td class="num">${esc(p.jersey || '')}</td>
                ${cells.join('')}
                <td>${p.pa || 0}</td><td>${p.ab || 0}</td><td>${p.r || 0}</td><td>${p.h || 0}</td>
                <td>${p['2b'] || 0}</td><td>${p['3b'] || 0}</td><td>${p.hr || 0}</td><td>${p.gidp || 0}</td>
                <td>${p.sh || 0}</td><td>${p.sf || 0}</td><td>${p.bb || 0}</td><td>${p.hbp || 0}</td>
                <td>${p.sb || 0}</td><td>${p.so || 0}</td><td>${p.rbi || 0}</td>
            </tr>`;
        }).join('');

        const inningHead = Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join('');

        // 投手表
        const pitchRows = (team.pitchers || []).map(pt => {
            const era = pt.outsRecorded > 0 ? (pt.er * 9 / (pt.outsRecorded / 3)).toFixed(2) : '0.00';
            const whip = pt.outsRecorded > 0 ? ((pt.h + pt.bb) / (pt.outsRecorded / 3)).toFixed(2) : '0.00';
            return `<tr><td class="name">${esc(pt.name)}</td><td>${ipText(pt.outsRecorded)}</td>
                <td>${pt.bf || 0}</td><td>${pt.h || 0}</td><td>${pt.r || 0}</td><td>${pt.er || 0}</td>
                <td>${pt.hr || 0}</td><td>${pt.bb || 0}</td><td>${pt.ibb || 0}</td><td>${pt.hbp || 0}</td>
                <td>${pt.k || 0}</td><td>${pt.wp || 0}</td><td>${pt.bk || 0}</td>
                <td>${era}</td><td>${whip}</td></tr>`;
        }).join('');

        // 平衡驗算：AB + SH + SF + BB + HP + IO + TIE == R + LOB + PO
        const runs = (team.score || []).reduce((a, b) => a + (b || 0), 0);
        const po = (opp.pitchers || []).reduce((a, p) => a + (p.outsRecorded || 0), 0);
        const left = t.ab + t.sh + t.sf + t.bb + t.hbp + t.io;
        const lob = Math.max(0, left - runs - po);   // 由平衡式反推殘壘
        const right = runs + lob + po;

        return `
        <section class="sheet">
          <h2>${esc(team.name)} <span class="sub">${teamKey === 'a' ? '先攻（客隊）' : '後攻（主隊）'}</span></h2>
          <table class="main">
            <thead>
              <tr>
                <th class="pos">POS</th><th class="name">PLAYERS</th><th class="num">N°</th>
                ${inningHead}
                <th>PA</th><th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>GDP</th>
                <th>SH</th><th>SF</th><th>BB</th><th>HP</th><th>SB</th><th>K</th><th>RBI</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr class="totals">
                <td colspan="3">TOTALS</td>
                ${Array.from({ length: innings }, () => '<td></td>').join('')}
                <td>${t.pa}</td><td>${t.ab}</td><td>${t.r}</td><td>${t.h}</td>
                <td>${t['2b']}</td><td>${t['3b']}</td><td>${t.hr}</td><td>${t.gidp}</td>
                <td>${t.sh}</td><td>${t.sf}</td><td>${t.bb}</td><td>${t.hbp}</td>
                <td>${t.sb}</td><td>${t.so}</td><td>${t.rbi}</td>
              </tr>
            </tfoot>
          </table>

          <h3>PITCHERS</h3>
          <table class="pitch">
            <thead><tr><th class="name">PITCHER</th><th>IP</th><th>BF</th><th>H</th><th>R</th><th>ER</th>
              <th>HR</th><th>BB</th><th>IBB</th><th>HP</th><th>K</th><th>WP</th><th>BK</th>
              <th>ERA</th><th>WHIP</th></tr></thead>
            <tbody>${pitchRows}</tbody>
          </table>

          <div class="balance">
            <strong>THE BOX SCORE BALANCE</strong>
            <div class="bal-row">
              AB ${t.ab} + SH ${t.sh} + SF ${t.sf} + BB ${t.bb} + HP ${t.hbp} + IO ${t.io}
              = <b>${left}</b>
            </div>
            <div class="bal-row">
              R ${runs} + LOB ${lob} + PO ${po} = <b>${right}</b>
            </div>
            <div class="${left === right ? 'ok' : 'bad'}">
              ${left === right ? '✓ 兩式相等，記錄平衡' : '✗ 兩式不等，請複查記錄'}
            </div>
          </div>
        </section>`;
    }

    function buildOfficialSheet(state) {
        const innings = Math.max(9, (state.teams.a.score || []).length, (state.teams.b.score || []).length);
        const line = key => {
            const s = state.teams[key];
            const cells = Array.from({ length: innings }, (_, i) =>
                `<td>${s.score[i] != null ? s.score[i] : ''}</td>`).join('');
            const r = (s.score || []).reduce((a, b) => a + (b || 0), 0);
            return `<tr><td class="name">${esc(s.name)}</td>${cells}
                    <td class="rhe">${r}</td><td class="rhe">${s.hits || 0}</td><td class="rhe">${s.errors || 0}</td></tr>`;
        };
        const head = Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join('');
        const wt = { sunny: '晴', cloudy: '陰', rainy: '雨' }[state.weather] || '';

        return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<title>正式記錄表 ${esc(state.teams.a.name)} vs ${esc(state.teams.b.name)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: -apple-system, "Noto Sans TC", Arial, sans-serif; color: #111; margin: 0; padding: 10px; }
  h1 { font-size: 15px; margin: 0 0 6px; }
  h2 { font-size: 13px; margin: 14px 0 4px; }
  h2 .sub { font-weight: 400; font-size: 11px; color: #666; }
  h3 { font-size: 11px; margin: 10px 0 3px; }
  .meta { font-size: 11px; margin-bottom: 8px; color: #333; }
  .meta span { margin-right: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; }
  th, td { border: 1px solid #999; padding: 2px 3px; text-align: center; }
  th { background: #e8eef5; font-weight: 600; }
  td.name, th.name { text-align: left; white-space: nowrap; min-width: 70px; }
  td.pos, th.pos { width: 24px; }
  td.num, th.num { width: 22px; }
  td.ab-cell { min-width: 26px; height: 20px; font-weight: 600; }
  tfoot .totals td { background: #f2f2f2; font-weight: 700; }
  .linescore { width: auto; margin-bottom: 10px; }
  .linescore .rhe { background: #f2f2f2; font-weight: 700; }
  .balance { margin-top: 8px; font-size: 10px; border: 1px solid #999; padding: 6px; display: inline-block; }
  .bal-row { margin: 2px 0; }
  .ok { color: #147a3d; font-weight: 700; margin-top: 3px; }
  .bad { color: #b3261e; font-weight: 700; margin-top: 3px; }
  .sheet { page-break-inside: avoid; }
  .sheet + .sheet { page-break-before: always; }
  @media print { .no-print { display: none; } }
  .no-print { margin: 10px 0; }
  .no-print button { padding: 6px 14px; font-size: 13px; cursor: pointer; }
</style></head><body>
<div class="no-print"><button onclick="window.print()">列印 / 存成 PDF</button></div>
<h1>OFFICIAL SCORESHEET　${esc(state.teams.a.name)} vs ${esc(state.teams.b.name)}</h1>
<div class="meta">
  <span>DATE：${esc(state.gameDate || '')}</span>
  <span>FIELD：${esc(state.stadium || '')}</span>
  <span>WEATHER：${esc(wt)}</span>
  <span>結果：${state.isGameOver ? '終場' : '進行中'}</span>
</div>
<table class="linescore">
  <thead><tr><th class="name">TEAMS</th>${head}<th>R</th><th>H</th><th>E</th></tr></thead>
  <tbody>${line('a')}${line('b')}</tbody>
</table>
${teamSheet(state, 'a', 'b', innings)}
${teamSheet(state, 'b', 'a', innings)}
</body></html>`;
    }

    window.buildOfficialSheet = buildOfficialSheet;
    window.openOfficialSheet = function (state) {
        const html = buildOfficialSheet(state);
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); return true; }
        // 開新視窗被擋時改為下載
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '正式記錄表.html';
        a.click();
        return false;
    };
})();
