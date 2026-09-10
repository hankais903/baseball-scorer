// prettier-ignore
'use strict';
declare var XLSX: any; // Declare the XLSX global object from the CDN script

// --- Default Placeholder Images (SVG encoded in Base64) ---
const TEAM_NAME_MAX = 4;
// 延長局上限，平手打滿即為和局（CPBL 例行賽為 12 局）
const MAX_INNINGS = 12;
    // 依落點區域提供合理的結果選項（位置優先流程）
    // 點球場任一處都用同一組結果；誰處理球在下一步用守備鏈決定。
    // zones 只影響「先顯示哪些」：落點對得上的先列出來，其餘收在「其他結果」裡，
    // 任何結果都還是記得到，只是不用每次都從十幾顆按鈕裡找。
    const ZONE_PLAYS = {
        field: [
            { play: '一安', label: '一壘安打', group: '安打', zones: ['infield', 'outfield'] },
            { play: '二安', label: '二壘安打', group: '安打', zones: ['outfield'] },
            { play: '三安', label: '三壘安打', group: '安打', zones: ['outfield'] },
            { play: '本打', label: '全壘打', group: '安打', zones: ['outfield'] },
            { play: '內安', label: '內野安打', group: '安打', zones: ['infield'] },
            { play: '滾地', label: '滾地出局', out: true, group: '出局', zones: ['infield'] },
            { play: '飛球', label: '飛球出局', out: true, group: '出局', zones: ['infield', 'outfield'] },
            { play: '界飛', label: '界外飛球接殺', out: true, group: '出局', zones: ['foul'] },
            { play: '犧飛', label: '高飛犧牲', out: true, group: '出局', zones: ['outfield'] },
            { play: '犧短', label: '犧牲觸擊', out: true, group: '出局', zones: ['infield', 'foul'] },
            { play: '雙殺', label: '雙殺', out: true, group: '出局', zones: ['infield'] },
            { play: '三殺', label: '三殺', out: true, group: '出局', zones: ['infield'] },
            { play: '失誤', label: '失誤上壘', group: '其他', zones: ['infield', 'outfield', 'foul'] },
            { play: '野手選擇', label: '野手選擇', group: '其他', zones: ['infield'] },
            { play: '妨礙守備', label: '妨礙守備', out: true, group: '其他', zones: ['infield', 'foul'] }
        ]
    };
    ZONE_PLAYS.infield = ZONE_PLAYS.field;   // 相容舊呼叫
    ZONE_PLAYS.outfield = ZONE_PLAYS.field;
    ZONE_PLAYS.foul = ZONE_PLAYS.field;

// 擊球落點分區：以本壘為圓心切出的扇形，對應九個守備位置
const HIT_ZONES = [
    { dir: '捕', label: '捕手', d: 'M100.0 170.0 L109.2 160.8 A13 13 0 0 0 90.8 160.8 Z', x: 100.0, y: 163.5 },
    { dir: '投', label: '投手', d: 'M103.4 157.4 L109.3 135.2 A36 36 0 0 0 90.7 135.2 L96.6 157.4 A13 13 0 0 1 103.4 157.4 Z', x: 100.0, y: 145.5 },
    { dir: '一', label: '一壘', d: 'M125.5 144.5 L141.7 128.3 A59 59 0 0 0 118.2 113.9 L111.1 135.8 A36 36 0 0 1 125.5 144.5 Z', x: 124.8, y: 129.5 },
    { dir: '二', label: '二壘', d: 'M111.1 135.8 L118.2 113.9 A59 59 0 0 0 100.0 111.0 L100.0 134.0 A36 36 0 0 1 111.1 135.8 Z', x: 107.4, y: 123.1 },
    { dir: '游', label: '游擊', d: 'M100.0 134.0 L100.0 111.0 A59 59 0 0 0 81.8 113.9 L88.9 135.8 A36 36 0 0 1 100.0 134.0 Z', x: 92.6, y: 123.1 },
    { dir: '三', label: '三壘', d: 'M88.9 135.8 L81.8 113.9 A59 59 0 0 0 58.3 128.3 L74.5 144.5 A36 36 0 0 1 88.9 135.8 Z', x: 75.2, y: 129.5 },
    { dir: '右', label: '右外野', d: 'M141.7 128.3 L182.0 88.0 A116 116 0 0 0 130.0 58.0 L115.3 113.0 A59 59 0 0 1 141.7 128.3 Z', x: 143.8, y: 94.2 },
    { dir: '中', label: '中外野', d: 'M115.3 113.0 L130.0 58.0 A116 116 0 0 0 70.0 58.0 L84.7 113.0 A59 59 0 0 1 115.3 113.0 Z', x: 100.0, y: 82.5 },
    { dir: '左', label: '左外野', d: 'M84.7 113.0 L70.0 58.0 A116 116 0 0 0 18.0 88.0 L58.3 128.3 A59 59 0 0 1 84.7 113.0 Z', x: 56.3, y: 94.2 }
];
// 處理野手：沿用守備位置代號
const HIT_DIRECTIONS = {
    infield: ['投', '捕', '一', '二', '三', '游'],
    outfield: ['左', '中', '右']
};

// === 落點座標：主畫面球場 → 記錄用小圖 ===
// 兩張圖的本壘位置與半徑比例不同（內野／全壘打牆各自縮放），
// 但兩邊界外線都是本壘往外 45 度，因此換算時「角度保留、半徑分段縮放」。
const MAIN_FIELD_GEO = { hx: 202, hy: 341, rInfield: 185, rFence: 265 };
const MINI_FIELD_GEO = { hx: 100, hy: 170, rInfield: 59, rFence: 116 };

function mainPointToMini(p: { x: number; y: number }) {
    const dx = p.x - MAIN_FIELD_GEO.hx;
    const dy = p.y - MAIN_FIELD_GEO.hy;
    const r = Math.hypot(dx, dy);
    if (r < 0.5) return { x: MINI_FIELD_GEO.hx, y: MINI_FIELD_GEO.hy };
    let rm;
    if (r <= MAIN_FIELD_GEO.rInfield) {
        rm = r / MAIN_FIELD_GEO.rInfield * MINI_FIELD_GEO.rInfield;
    }
    else {
        const t = (r - MAIN_FIELD_GEO.rInfield) / (MAIN_FIELD_GEO.rFence - MAIN_FIELD_GEO.rInfield);
        rm = MINI_FIELD_GEO.rInfield + t * (MINI_FIELD_GEO.rFence - MINI_FIELD_GEO.rInfield);
    }
    // 落到牆外（球場圖邊角）時稍微收住，避免標記畫出小圖之外
    rm = Math.min(rm, MINI_FIELD_GEO.rFence + 8);
    return {
        x: Math.round(MINI_FIELD_GEO.hx + dx / r * rm),
        y: Math.round(MINI_FIELD_GEO.hy + dy / r * rm)
    };
}

// 依小圖上的落點推出處理野手；界外或無法判定時回傳 null
function fielderFromMiniPoint(p: { x: number; y: number }) {
    const dx = p.x - MINI_FIELD_GEO.hx;
    const dy = p.y - MINI_FIELD_GEO.hy;
    const r = Math.hypot(dx, dy);
    // 角度：正上方（中外野）為 0，向右（一壘側）為正
    const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (Math.abs(deg) > 45) return null;          // 界外
    if (r < 13) return '捕';
    if (r < 36) return Math.abs(deg) < 15 ? '投' : (deg > 0 ? '一' : '三');
    if (r < MINI_FIELD_GEO.rInfield) {
        if (deg >= 18) return '一';
        if (deg >= 0) return '二';
        if (deg > -18) return '游';
        return '三';
    }
    if (deg > 15) return '右';
    if (deg >= -15) return '中';
    return '左';
}

// 點到的區域才是權威：外野的球不會由內野手處理，反之亦然
const INFIELD_BY_ANGLE = ['三', '游', '二', '一'];
function fielderInZone(fielder: string | null, mini: { x: number; y: number }, zone: string | null) {
    if (!zone || zone === 'foul') return zone === 'foul' ? null : fielder;
    const dx = mini.x - MINI_FIELD_GEO.hx;
    const dy = mini.y - MINI_FIELD_GEO.hy;
    const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (Math.abs(deg) > 45) return null;
    if (zone === 'outfield') {
        if (fielder && ['左', '中', '右'].includes(fielder)) return fielder;
        return deg > 15 ? '右' : deg >= -15 ? '中' : '左';
    }
    // infield
    if (fielder && !['左', '中', '右'].includes(fielder)) return fielder;
    const idx = Math.min(3, Math.max(0, Math.floor((deg + 45) / 22.5)));
    return INFIELD_BY_ANGLE[idx];
}

// 供測試使用的純函式出口（不影響畫面行為）
(window as any).__fieldMath = { mainPointToMini, fielderFromMiniPoint, fielderInZone };
const DEFAULT_TEAM_LOGO_BASE64 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#3e3e3e"/><path d="M50 15L85 50L50 85L15 50Z" stroke="#666" stroke-width="5" fill="none"/><circle cx="50" cy="50" r="10" stroke="#666" stroke-width="5" fill="none"/></svg>');
const DEFAULT_PLAYER_PHOTO_BASE64 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 100"><rect width="75" height="100" fill="#3e3e3e" rx="4" /><g fill="#666"><circle cx="37.5" cy="35" r="15"/><path d="M15 100 V 80 C 15 65, 25 60, 37.5 60 C 50 60, 60 65, 60 80 V 100 Z"/></g></svg>');
// 沒有上傳照片的球員，就用背號當頭像；連背號都沒有才用剪影。
// 尺寸與剪影一致（75×100），才能直接沿用同一組樣式。
function jerseyAvatar(jersey) {
    const num = String(jersey == null ? '' : jersey).trim();
    if (!num) return DEFAULT_PLAYER_PHOTO_BASE64;
    // 位數越多字級越小，才不會超出邊界
    const size = num.length >= 3 ? 34 : (num.length === 2 ? 44 : 52);
    const text = num.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 100">'
        + '<rect width="75" height="100" fill="#3e3e3e" rx="4"/><desc data-avatar="jersey"></desc>'
        + '<text x="37.5" y="50" fill="#d6dae0" font-family="-apple-system, Segoe UI, Roboto, sans-serif"'
        + ' font-size="' + size + '" font-weight="700" text-anchor="middle" dominant-baseline="central">'
        + text + '</text></svg>';
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
// 判斷這張圖是不是我們自己畫的（剪影或背號），而不是使用者上傳的照片。
// 畫面上的預覽會被讀回 gameState，沒有這道判斷的話背號圖會被當成照片存起來，
// 之後改背號頭像就不會跟著換。
function isGeneratedAvatar(src) {
    if (!src || src === DEFAULT_PLAYER_PHOTO_BASE64) return true;
    const prefix = 'data:image/svg+xml;base64,';
    if (String(src).indexOf(prefix) !== 0) return false;
    try {
        return decodeURIComponent(escape(atob(String(src).slice(prefix.length)))).indexOf('data-avatar="jersey"') >= 0;
    }
    catch (e) { return false; }
}
// 球員頭像來源：優先用上傳的照片，其次背號，最後剪影
function playerPhotoSrc(player) {
    const photo = player && player.photo;
    if (photo && photo !== DEFAULT_PLAYER_PHOTO_BASE64) return photo;
    return jerseyAvatar(player && player.jersey);
}

let currentPanelIndex = 1; // 0: settings, 1: main, 2: log
let panelDragStartX = 0;
let panelDragStartY = 0;
let panelDragDeltaX = 0;
let isPanelDragging = false;
let isSwipeConfirmed = false;
let dragIsMouseEvent = false;
document.addEventListener('DOMContentLoaded', () => {
    const POSITIONS = {
        'P': '投手', 'C': '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手',
        'SS': '游擊手', 'LF': '左外野手', 'CF': '中外野手', 'RF': '右外野手', 'DH': '指定打擊'
    };
    const ERROR_POSITIONS = {
        'P': '投手', 'C': '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手',
        'SS': '游擊手', 'LF': '左外野手', 'CF': '中外野手', 'RF': '右外野手'
    };
    const ERROR_ABBREVIATIONS = {
        'P': '投失', 'C': '捕失', '1B': '一失', '2B': '二失', '3B': '三失',
        'SS': '游失', 'LF': '左失', 'CF': '中失', 'RF': '右失'
    };
    // prettier-ignore
    const PLAY_TYPES = {
        // FIX: Quoted key 'out' to prevent parsing errors.
        'out': ['三振', '滾地', '飛球', '界飛', '雙殺', '犧飛', '犧短', '三殺', '妨礙守備'],
        'on-base': ['一安', '四壞', '二安', '內安', '三安', '本打', '失誤', '觸身球', '野手選擇', '不死三振', '妨礙打擊']
    };
    const PLAY_DESCRIPTIONS = {
        '三振': '三振出局', '滾地': '滾地球出局', '飛球': '飛球出局', '野手選擇': '擊出野手選擇',
        '界飛': '擊出界外飛球，被接殺出局', '雙殺': '造成雙殺', '三殺': '造成三殺',
        '四壞': '獲得四壞保送', '觸身球': '獲得觸身球保送', '不死三振': '揮空三振但捕手未能接妥', '內安': '擊出內野安打',
        '一安': '擊出一壘安打', '二安': '擊出二壘安打',
        '三安': '擊出三壘安打', '本打': '擊出全壘打', '失誤': '因失誤上壘',
        '犧短': '犧牲短打', '犧飛': '擊出高飛犧牲打',
        '妨礙守備': '因妨礙守備出局', '妨礙打擊': '因捕手妨礙打擊上壘'
    };
    const HIT_BASES = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4 };
    const PLAY_ABBREVIATIONS = {
        '三振': '三振', '滾地': '滾地', '飛球': '飛球', '野手選擇': '野選',
        '界飛': '界飛', '雙殺': '雙殺', '三殺': '三殺',
        '四壞': '四壞', '觸身球': '觸身', '不死三振': '不死三振', '內安': '內安', '一安': '一安', '二安': '二安',
        '三安': '三安', '本打': '本打', '失誤': '失誤', '犧短': '犧短', '犧飛': '犧飛',
        '妨礙守備': '妨礙守備', '妨礙打擊': '妨礙打擊'
    };
    const PLAY_TYPE_CATEGORIES = {
        '三振': 'strikeout',
        '滾地': 'groundout',
        '飛球': 'flyout', '界飛': 'flyout',
        '雙殺': 'special-out', '三殺': 'special-out',
        '犧短': 'sacrifice', '犧飛': 'sacrifice',
        '四壞': 'walk', '觸身球': 'walk', '不死三振': 'walk',
        '內安': 'hit', '一安': 'hit', '二安': 'hit', '三安': 'hit', '本打': 'hit',
        '失誤': 'error',
        '野手選擇': 'fielder-choice',
        '妨礙守備': 'interference',
        '妨礙打擊': 'interference'
    };
    // FIX: Quoted keys with hyphens, and all other keys for consistency.
    const BASE_NAME = (n: number) => ['一', '二', '三', '本'][n - 1] || String(n);
    const STEAL_BASE_NAME = (dest: number) => dest >= 4 ? '本壘' : `${BASE_NAME(dest)}壘`;
    // 守備位置全名，用於事件敘述
    const FIELDER_FULL = {
        '投': '投手', '捕': '捕手', '一': '一壘手', '二': '二壘手', '三': '三壘手',
        '游': '游擊手', '左': '左外野手', '中': '中外野手', '右': '右外野手'
    };
    const FIELDER_AREA = {
        '投': '投手前', '捕': '本壘前', '一': '一壘方向', '二': '二壘方向', '三': '三壘方向',
        '游': '游擊方向', '左': '左外野', '中': '中外野', '右': '右外野'
    };
    const FIELDER_NUM = { '投': 1, '捕': 2, '一': 3, '二': 4, '三': 5, '游': 6, '左': 7, '中': 8, '右': 9 };
    const chainCode = (chain: string[]) => chain.map(f => FIELDER_NUM[f]).filter(Boolean).join('-');
    // 事件敘述裡不再附上「（4-3）」這種守備代號（使用者要求）；
    // 代號仍保留給記錄當下的提示用（例如「已選：二→一（4-3）」）。
    const chainTail = (_chain: string[]) => '';
    function setFielderChain(chain: string[]) {
        advancedPlayState.fielders = chain;
        advancedPlayState.direction = chain[0] || null;
    }
    // 依落點野手與打席結果給出整條預設守備鏈
    function defaultFielderChain(play: string, first: string | null): string[] {
        if (!first) return [];
        const isOF = ['左', '中', '右'].includes(first);
        switch (play) {
            case '滾地':
            case '犧短':
                return first === '一' ? ['一'] : [first, '一'];
            case '雙殺':
            case '三殺': {
                // 平飛／高飛雙殺是接殺後再傳殺離壘跑者，傳到哪裡看情況，只預設接球者
                if (advancedPlayState.ballType && advancedPlayState.ballType !== 'G') return [first];
                if (isOF) return [first, '一'];
                if (first === '一') return ['一', '游', '一'];          // 3-6-3
                const pivot = first === '二' ? '游' : '二';             // 6-4-3 / 4-6-3 / 5-4-3 / 1-4-3
                return [first, pivot, '一'];
            }
            default:
                return [first];
        }
    }
    // 把守備鏈寫成中文：「游擊手傳給一壘手」「二壘手傳給游擊手再傳給一壘手」
    function chainText(chain: string[]) {
        const names = chain.map(f => FIELDER_FULL[f]).filter(Boolean);
        if (names.length === 0) return '';
        if (names.length === 1) return names[0];
        return names[0] + names.slice(1).map((n, i) => (i === 0 ? '傳給' : '再傳給') + n).join('');
    }
    // 夾殺的自動判斷：傳球在兩個壘之間來回，同一名野手會再拿到球（1-3-6-3、5-2-5）；
    // 單向的接力傳球（8-9-4-2）不論幾個人都不是夾殺，所以只看「有沒有人重複」。
    function looksLikeRundown(chain: string[]) {
        return chain.length >= 3 && new Set(chain).size < chain.length;
    }
    function isRundown(chain: string[], flag: boolean | null | undefined) {
        return flag === null || flag === undefined ? looksLikeRundown(chain) : !!flag;
    }
    // 接力傳球的中文：兩人「A傳給B」，三人以上「A經B、C轉傳給D」
    function relayText(chain: string[]) {
        const names = chain.map(f => FIELDER_FULL[f]).filter(Boolean);
        if (names.length <= 2) return chainText(chain);
        return `${names[0]}經${names.slice(1, -1).join('、')}轉傳給${names[names.length - 1]}`;
    }
    // 跑者出局的敘述：夾殺寫成「在X壘與Y壘之間被夾殺」，否則依傳球順序寫觸殺
    function runnerOutText(chain: string[], fromBase: number, toBase: number, rundown: boolean) {
        const tail = chainTail(chain);
        const seg = `${BASE_NAME(fromBase)}壘與${toBase >= 4 ? '本壘' : BASE_NAME(toBase) + '壘'}之間`;
        if (rundown && chain.length >= 2) return `在${seg}被夾殺出局${tail}`;
        if (chain.length >= 1) return `被${relayText(chain)}觸殺出局${tail}`;
        return '出局';
    }
    // 把「打了什麼」和「誰處理的」寫成一句話，取代生硬的「處理野手：X」
    function describePlayWithFielder(play, dir, chain?: string[]) {
        const who = FIELDER_FULL[dir];
        const area = FIELDER_AREA[dir];
        if (!who) return PLAY_DESCRIPTIONS[play];
        const c = (chain && chain.length ? chain : [dir]);
        const tail = chainTail(c);
        switch (play) {
            case '滾地':
                if (c.length === 1) {
                    return dir === '一'
                        ? `擊出${area}滾地球，一壘手接球踩壘封殺出局${tail}`
                        : `擊出${area}滾地球出局，由${who}處理${tail}`;
                }
                return `擊出${area}滾地球，${chainText(c)}封殺出局${tail}`;
            case '飛球': return `擊出${area}高飛球，被${who}接殺出局${tail}`;
            case '界飛': return `擊出界外高飛球，被${who}接殺出局${tail}`;
            case '犧飛': return `擊出${area}高飛犧牲打${tail}`;
            case '犧短':
                return c.length > 1
                    ? `犧牲觸擊，${chainText(c)}封殺出局${tail}`
                    : `犧牲觸擊，由${who}處理${tail}`;
            case '雙殺':
            case '三殺': {
                const kind = play === '雙殺' ? '雙殺' : '三殺';
                const bt = advancedPlayState.ballType || 'G';
                if (bt === 'G') {
                    return c.length > 1
                        ? `擊出${area}滾地球，${chainText(c)}，形成${kind}${tail}`
                        : `擊出${area}滾地球，${who}接球轉傳形成${kind}${tail}`;
                }
                // 平飛／高飛：打者先被接殺，再傳殺離壘的跑者
                const ball = bt === 'L' ? '平飛球' : '高飛球';
                const names = c.map(f => FIELDER_FULL[f]);
                if (c.length === 1) return `擊出${area}${ball}，${who}接殺後獨力完成${kind}${tail}`;
                const throws = `傳給${names[1]}` + names.slice(2).map(n => `再傳給${n}`).join('');
                return `擊出${area}${ball}，${who}接殺後${throws}，形成${kind}${tail}`;
            }
            case '野手選擇': {
                const last = c[c.length - 1];
                let target = c.length > 1 ? { '捕': '本壘', '一': '一壘', '二': '二壘', '游': '二壘', '三': '三壘' }[last] : '';
                // 只點了一個野手：用「被判出局的跑者」推算他傳去哪個壘
                if (!target && advancedPlayState.outRunnerBase !== null && advancedPlayState.outRunnerBase !== undefined) {
                    target = ['二壘', '三壘', '本壘'][advancedPlayState.outRunnerBase] || '';
                }
                return target
                    ? `擊出${area}滾地球，${who}選擇傳向${target}處理跑者${tail}`
                    : `擊出${area}滾地球，守方選擇處理其他跑者${tail}`;
            }
            case '內安': return `擊出${area}內野安打`;
            case '一安': return `擊出${area}一壘安打`;
            case '二安': return `擊出${area}二壘安打`;
            case '三安': return `擊出${area}三壘安打`;
            case '本打': return `擊出${area}全壘打`;
            case '失誤': return `擊向${who}`;
            case '不死三振': return `揮空三振但${who}未能接妥`;
            default: return `${PLAY_DESCRIPTIONS[play]}，由${who}處理`;
        }
    }
    const RUNNER_ACTION_TYPES = {
        'steal': '盜壘',
        'wild-pitch': '暴投',
        'passed-ball': '捕逸',
        'balk': '投手犯規',
        'pickoff-out': '投手牽制',
        'obstruction': '妨礙跑壘'
    };
    const ROSTER_SIZE = 30;
    const BENCH_SIZE = 15;
    const LINEUP_SIZE = 9;
    const PITCHER_ROSTER_INDEX = 24;
    const SAVED_ROSTERS_KEY = 'savedBaseballRosters';
    const placeholderNames = [
        '陳金鋒', '王建民', '郭泓志', '陽岱鋼', '林智勝', '彭政閔', '張泰山',
        '胡金龍', '高國輝', '周思齊', '王柏融', '蘇智傑', '陳傑憲', '林立',
        '廖健富', '江坤宇', '王威晨', '詹子賢', '岳東華', '林泓育', '潘威倫',
        '陳偉殷', '曾頌恩', '吉力吉撈', '劉基鴻', '戴培峰', '李宗賢', '范國宸',
        '林安可', '張育成'
    ];
    const awayTeamNames = ['猛虎', '飛鷹', '獵豹', '暴龍', '巨鯨', '狂獅'];
    const homeTeamNames = ['神龍', '金剛', '鳳凰', '麒麟', '戰神', '銀狼'];
    function shuffleArray(array) {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }
    const createDefaultTeamState = (teamKey) => {
        const shuffledNames = shuffleArray(placeholderNames);
        const usedJerseys = new Set();
        const lineupPositions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
        const shuffledPositions = shuffleArray(lineupPositions);
        const roster = Array.from({ length: ROSTER_SIZE }, (_, i) => {
            let jerseyNum;
            do {
                jerseyNum = Math.floor(Math.random() * 99) + 1;
            } while (usedJerseys.has(jerseyNum));
            usedJerseys.add(jerseyNum);
            const pos = i < LINEUP_SIZE ? shuffledPositions[i] : '';
            return {
                _id: `${teamKey}_player_${i}`,
                // 板凳預設留空：有需要再新增，不要二十個假名字塞滿畫面
                // 先發九人 01～09、先發投手 10；背號與編號相同，方便對照
                jersey: i < LINEUP_SIZE ? String(i + 1).padStart(2, '0')
                      : i === PITCHER_ROSTER_INDEX ? '10' : '',
                name: i < LINEUP_SIZE ? `${teamKey === 'a' ? '客隊' : '主隊'}球員${String(i + 1).padStart(2, '0')}`
                    : i === PITCHER_ROSTER_INDEX ? `${teamKey === 'a' ? '客隊' : '主隊'}球員10` : '',
                pos: pos,
                photo: DEFAULT_PLAYER_PHOTO_BASE64,
                pa: 0, ab: 0, r: 0, h: 0, rbi: 0, tb: 0, '2b': 0, '3b': 0, hr: 0,
                gidp: 0, bb: 0, hbp: 0, so: 0, sf: 0, sh: 0, sb: 0,
                abResults: []
            };
        });
        const pitcher = roster[PITCHER_ROSTER_INDEX];
        pitcher.pos = 'P';
        const pitcherId = pitcher._id;
        const teamName = teamKey === 'a'
            ? awayTeamNames[Math.floor(Math.random() * awayTeamNames.length)]
            : homeTeamNames[Math.floor(Math.random() * homeTeamNames.length)];
        return {
            name: teamName,
            color: teamKey === 'a' ? '#4a90e2' : '#e24a4a',
            logo: DEFAULT_TEAM_LOGO_BASE64,
            useDH: true,
            score: [],
            hits: 0,
            errors: 0,
            roster: roster,
            pitchers: [{
                    _id: pitcherId,
                    name: pitcher.name,
                    outsRecorded: 0, h: 0, r: 0, er: 0,
                    bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0,
                }],
            activePitcherId: pitcherId,
            lineupSpots: Array.from({ length: LINEUP_SIZE }, (_, i) => ({
                order: i + 1,
                activePlayerId: roster[i]._id,
                history: [roster[i]._id]
            })),
            positions: {}
        };
    };
    const getInitialGameState = () => {
        return {
            teams: {
                a: createDefaultTeamState('a'),
                b: createDefaultTeamState('b')
            },
            inning: 1,
            isTop: true,
            outs: 0,
            bases: [null, null, null],
            currentBatterIndex: { a: 0, b: 0 },
            events: [],
            pitchCount: 0,
            lastPlay: '',
            inningPotentialOuts: 0,
            isGameOver: false,
            stadium: '',
            started: false,
            startTime: null,        // 按下 PLAY BALL 的時間（毫秒）
            endTime: null,          // 比賽結束時間；有值時計時器停住
            pausedMs: 0,            // 累計已暫停的時間，計時要扣掉
            pausedAt: null,         // 目前這次暫停的起點；有值代表正在暫停
            weather: 'sunny',
            gameDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        };
    };
    let gameState = getInitialGameState();
    let gameStateHistory = [];
    interface Player {
        _id: string;
        jersey: string;
        name: string;
        pos: string;
        photo?: string;
        pa: number;
        ab: number;
        r: number;
        h: number;
        rbi: number;
        tb: number;
        '2b': number;
        '3b': number;
        hr: number;
        gidp: number;
        bb: number;
        hbp: number;
        so: number;
        sf: number;
        sh: number;
        sb: number;
        abResults: string[];
        [key: string]: any;
    }
    interface Pitcher {
        _id: string;
        name: string;
        outsRecorded: number;
        h: number;
        r: number;
        er: number;
        bb: number;
        k: number;
        hbp: number;
        hr: number;
        bf: number;
        ibb: number;
        wp: number;
        bk: number;
        [key: string]: any;
    }
    interface Team {
        name: string;
        color: string;
        logo?: string;
        useDH: boolean;
        score: (number | null)[];
        hits: number;
        errors: number;
        roster: Player[];
        pitchers: Pitcher[];
        activePitcherId: string;
        lineupSpots: { order: number; activePlayerId: string; history: string[] }[];
        positions: { [key: string]: { player: Player, spotIndex: number } };
    }
    interface BaseRunner {
        runnerId: string;
        isUnearned: boolean;
    }
    interface GameState {
        teams: {
            a: Team;
            b: Team;
        };
        inning: number;
        isTop: boolean;
        outs: number;
        bases: (BaseRunner | null)[];
        currentBatterIndex: { a: number; b: number };
        events: { text: string, teamKey: string | null }[];
        pitchCount: number;
        lastPlay: string;
        inningPotentialOuts: number;
        isGameOver: boolean;
        started?: boolean;
        stadium?: string;
        gameDate?: string;
        weather?: string;
    }
    let advancedPlayState: AdvancedPlayState = {
        play: '',
        error: null,
        batterDestination: { dest: 0, isUnearned: false },
        runnerDestinations: {},
        originalBases: [],
        step: '',
        batterIsOut: false,
        outRunnerBase: null,
    };
    interface AdvancedPlayState {
        play: string;
        direction?: string | null;      // 相容用：等於 fielders[0]
        directionAuto?: boolean;
        fielders?: string[];            // 守備鏈：第一個接球，之後依序傳給誰
        rundown?: boolean | null;       // 夾殺（null = 尚未指定，依鏈自動判斷）
        ballType?: 'G' | 'L' | 'F';     // 雙殺／三殺的球種：滾地／平飛／高飛
        errors?: string[];              // 同一個 play 內的所有失誤（守位代號，可重複）
        hitPoint?: { x: number; y: number } | null;
        pointConfirmed?: boolean;
        error: string | null;
        batterDestination: { dest: number, isUnearned: boolean };
        runnerDestinations: { [key: string]: { dest: number, isUnearned: boolean } };
        originalBases: (BaseRunner | null)[];
        step: string;
        batterIsOut: boolean;
        outRunnerBase: number | null;
        obstruction?: boolean;
    }
    let runnerActionState: RunnerActionState = {
        step: '',
        type: null,
        destinations: {},
        originalBases: [],
        error: false,
    };
    interface RunnerActionState {
        step: string;
        type: string | null;
        destinations: { [key: string]: { dest: number; isOut: boolean; } };
        originalBases: (BaseRunner | null)[];
        error?: boolean;
        fielders?: string[];       // 處理跑者出局的守備鏈（含夾殺）
        fieldersAuto?: boolean;
        rundown?: boolean | null;  // 夾殺（null = 依鏈自動判斷）
        errorPosition?: string | null;
    }
    interface ManagementState {
        activeTeamKey: 'a' | 'b';
        selectedPlayer: {
            id: string;
            source: 'field' | 'bench';
            element: HTMLElement;
        } | null;
    }
    let managementState: ManagementState = {
        activeTeamKey: 'a',
        selectedPlayer: null,
    };
    const lineupForm = document.getElementById('lineup-form') as HTMLFormElement;
    const gameStateDisplay = document.getElementById('game-state-display');
    const modal = document.getElementById('play-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal');
    const modalStep1 = document.getElementById('modal-step-1');
    const modalStep2 = document.getElementById('modal-step-2');
    const modalStep2Title = document.getElementById('modal-step-2-title');
    const modalStep2Options = document.getElementById('modal-options-step-2');
    const backButton = modal.querySelector('.back-button');
    const modalStepAdvanced = document.getElementById('modal-step-advanced');
    const modalAdvancedTitle = document.getElementById('modal-advanced-title');
    const modalAdvancedOptions = document.getElementById('modal-advanced-options');
    const backButtonAdvanced = modal.querySelector('.back-button-advanced');
    const doneButtonAdvanced = document.getElementById('modal-advanced-done');
    const advancedSummaryEl = document.getElementById('modal-advanced-summary');
    const newGameBtn = document.getElementById('new-game-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    const viewBoxScoreBtn = document.getElementById('view-box-score-btn');
    const boxScoreModal = document.getElementById('box-score-modal');
    const closeBoxScoreModalBtn = document.getElementById('close-box-score-modal');
    const exportBoxScoreBtn = document.getElementById('export-box-score-btn');
    const exportBoxScoreXLSXBtn = document.getElementById('export-box-score-xlsx-btn');
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    const runnerActionBtn = document.getElementById('runner-action-btn') as HTMLButtonElement;
    const runnerActionModal = document.getElementById('runner-action-modal');
    const runnerActionModalContent = document.getElementById('runner-action-modal-content');
    const closeRunnerActionModalBtn = document.getElementById('close-runner-action-modal');
    const runnerActionStep1 = document.getElementById('runner-action-step-1');
    const runnerActionStep2 = document.getElementById('runner-action-step-2');
    const runnerActionOptions = document.getElementById('runner-action-options');
    const runnerActionTitleStep2 = document.getElementById('runner-action-title-step-2');
    const runnerActionDetails = document.getElementById('runner-action-details');
    const runnerActionDoneBtn = document.getElementById('runner-action-done');
    const backButtonRunnerAction = document.getElementById('back-button-runner-action');
    const managementBtn = document.getElementById('management-btn') as HTMLButtonElement;
    const managementModal = document.getElementById('management-modal');
    const closeManagementModalBtn = document.getElementById('close-management-modal');
    const playBallBtn = document.getElementById('play-ball-btn') as HTMLButtonElement;
    const stadiumInput = document.getElementById('stadium-input') as HTMLInputElement;
    const gameDateInput = document.getElementById('game-date-input') as HTMLInputElement;
    const weatherInput = document.getElementById('weather-input') as HTMLSelectElement;
    const appContainer = document.getElementById('app-container') as HTMLDivElement;
    const mobileNav = document.getElementById('mobile-nav') as HTMLDivElement;
    const loadRosterModal = document.getElementById('load-roster-modal');
    const closeLoadRosterModalBtn = document.getElementById('close-load-roster-modal');
    const savedRostersList = document.getElementById('saved-rosters-list');
    let isDragging = false;
    let dragTarget: HTMLElement | null = null;
    let offsetX = 0;
    let offsetY = 0;
    function init() {
        createLineupInputs();
        loadState();
        addEventListeners();
        render();
        updateLayout(); // Set initial layout based on screen size
    }
    // 拖曳只改了 DOM 順序，輸入欄上的 data-index 仍是舊的位置。
    // 套用前先依畫面上的排列把 roster 重新排好（整個球員物件一起搬，統計數據跟著走）。
    // 相機拍的照片存成 base64 動輒 1～2MB，瀏覽器的 localStorage 只有約 5MB。
    // 上傳時先縮到合理尺寸再存，容量通常能降到原本的百分之幾。
    function shrinkImage(dataUrl: string, maxSize: number, quality = 0.82): Promise<string> {
        // 已經夠小的圖不必再轉一次，省時也避免不必要的畫質損失
        if (dataUrl.length < 120000) return Promise.resolve(dataUrl);
        return new Promise<string>(resolve => {
            // 圖片若一直沒有載入完成（或環境根本不會觸發 onload），
            // 不能讓上傳流程卡住，超時就直接用原圖。
            let settled = false;
            const finish = (value: string) => { if (!settled) { settled = true; resolve(value); } };
            const timer = setTimeout(() => finish(dataUrl), 3000);
            const resolveOnce = (value: string) => { clearTimeout(timer); finish(value); };
            try {
                const img = new Image();
                img.onload = () => {
                    try {
                        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                        if (scale >= 1) return resolveOnce(dataUrl);
                        const w = Math.max(1, Math.round(img.width * scale));
                        const h = Math.max(1, Math.round(img.height * scale));
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return resolveOnce(dataUrl);
                        // 透明底轉白，避免 PNG 轉 JPEG 後變黑
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        const out = canvas.toDataURL('image/jpeg', quality);
                        resolveOnce(out && out.length < dataUrl.length ? out : dataUrl);
                    }
                    catch {
                        resolveOnce(dataUrl);   // 環境不支援 canvas 就照原樣使用
                    }
                };
                img.onerror = () => resolveOnce(dataUrl);
                img.src = dataUrl;
            }
            catch {
                resolveOnce(dataUrl);
            }
        });
    }
    function reorderRosterFromDOM(teamKey: 'a' | 'b') {
        const lineupC = document.getElementById(`team-${teamKey}-lineup`);
        const benchC = document.getElementById(`team-${teamKey}-bench`);
        if (!lineupC || !benchC) return false;
        const rows = [...lineupC.querySelectorAll('.lineup-player'),
                      ...benchC.querySelectorAll('.lineup-player')] as HTMLElement[];
        const order: number[] = [];
        rows.forEach(row => {
            const inp = row.querySelector('input[data-type="name"]') as HTMLInputElement | null;
            if (!inp) return;
            const n = Number(inp.dataset.index);
            if (!Number.isNaN(n) && !order.includes(n)) order.push(n);
        });
        // 專屬投手欄不參與拖曳，補在後面維持長度
        for (let i = 0; i < ROSTER_SIZE; i++) if (!order.includes(i)) order.push(i);
        if (order.length !== ROSTER_SIZE) return false;
        if (order.every((v, i) => v === i)) return false;   // 順序沒變
        const team = gameState.teams[teamKey];
        const q = (idx: number, type: string) =>
            document.querySelector(`[data-team="${teamKey}"][data-index="${idx}"][data-type="${type}"]`) as HTMLInputElement | null;
        // 先把畫面上尚未套用的編輯收進球員物件，才不會在搬動時遺失
        order.forEach(old => {
            const player = team.roster[old];
            if (!player) return;
            const nameEl = q(old, 'name');
            if (nameEl) player.name = nameEl.value || player.name;
            const jerseyEl = q(old, 'jersey');
            if (jerseyEl) player.jersey = jerseyEl.value;
            const posEl = q(old, 'pos');
            if (posEl) player.pos = posEl.value;
            const preview = document.getElementById(`player-photo-preview-${teamKey}-${old}`) as HTMLImageElement | null;
            const src = preview ? (preview.getAttribute('src') || '') : '';
            if (src.startsWith('data:')) player.photo = src;
        });
        team.roster = order.map(old => team.roster[old]);
        return true;
    }
    function createLineupInputs() {
        ['a', 'b'].forEach(teamKey => {
            const container = document.getElementById(`team-${teamKey}-settings-container`);
            const team = gameState.teams[teamKey];
            container.innerHTML = `
                <h4>
                    <div class="team-logo-container">
                        <img src="" id="team-${teamKey}-logo-preview" class="team-logo-preview" alt="隊徽">
                        <label for="team-${teamKey}-logo-upload" class="image-upload-label">+</label>
                        <input type="file" id="team-${teamKey}-logo-upload" class="image-upload-input" data-team="${teamKey}" data-type="logo" accept="image/*">
                    </div>
                    <input type="color" id="team-${teamKey}-color" value="${team.color}" class="team-color-input" title="球隊代表色">
                    <input type="text" id="team-${teamKey}-name" class="team-name-input" maxlength="4" value="${team.name}">
                </h4>
                <div class="team-settings-controls">
                    <div class="roster-actions">
                        <button type="button" class="roster-action-btn save-roster-btn" data-team="${teamKey}">儲存名單</button>
                        <button type="button" class="roster-action-btn load-roster-btn" data-team="${teamKey}">讀取名單</button>
                    </div>
                    <div class="dh-toggle-container">
                        <label for="team-${teamKey}-dh-toggle">啟用DH</label>
                        <label class="switch">
                            <input type="checkbox" id="team-${teamKey}-dh-toggle" data-team="${teamKey}" ${team.useDH ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                <div id="team-${teamKey}-pitcher-container" style="display: ${team.useDH ? 'block' : 'none'};">
                    <h5>先發投手</h5>
                    <div id="team-${teamKey}-pitcher">${createPitcherInputHTML(teamKey)}</div>
                </div>
                <h5>先發打序</h5>
                <div id="team-${teamKey}-lineup"></div>
                <h5 class="collapsible-header expanded" data-target="team-${teamKey}-bench">板凳球員 <span class="bench-count" id="team-${teamKey}-bench-count"></span></h5>
                <div id="team-${teamKey}-bench" class="collapsible-content expanded"></div>
                <button type="button" class="bench-add-btn" data-team="${teamKey}">＋ 新增板凳球員</button>
            `;
            const lineupContainer = document.getElementById(`team-${teamKey}-lineup`);
            const benchContainer = document.getElementById(`team-${teamKey}-bench`);
            lineupContainer.innerHTML = '';
            benchContainer.innerHTML = '';
            const availablePositions = { ...POSITIONS };
            if (team.useDH) {
                delete availablePositions['P'];
            }
            else {
                delete availablePositions['DH'];
            }
            const positionOptions = Object.keys(availablePositions).map(abbr => `<option value="${abbr}">${abbr}</option>`).join('');
            for (let i = 0; i < LINEUP_SIZE; i++) {
                lineupContainer.innerHTML += createPlayerInputHTML(teamKey, i, false, positionOptions);
            }
            for (let i = 0; i < BENCH_SIZE; i++) {
                benchContainer.innerHTML += createPlayerInputHTML(teamKey, i + LINEUP_SIZE, true, positionOptions);
            }
        });
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = (header as HTMLElement).dataset.target;
                const content = document.getElementById(targetId);
                if (content) {
                    header.classList.toggle('expanded');
                    content.classList.toggle('expanded');
                }
            });
        });
    }
    // 板凳只顯示有人的列；「新增」會揭開下一個空列
    function updateBenchVisibility(teamKey: string, revealNext = false) {
        const bench = document.getElementById(`team-${teamKey}-bench`);
        if (!bench) return;
        const rows = [...bench.querySelectorAll('.lineup-player')] as HTMLElement[];
        let revealed = false;
        let count = 0;
        rows.forEach(row => {
            const nameInput = row.querySelector('input[data-type="name"]') as HTMLInputElement | null;
            const hasName = !!(nameInput && nameInput.value.trim());
            const keepOpen = row.dataset.revealed === '1';
            let show = hasName || keepOpen;
            if (!show && revealNext && !revealed) {
                show = true;
                revealed = true;
                row.dataset.revealed = '1';
                setTimeout(() => nameInput && nameInput.focus(), 0);
            }
            row.classList.toggle('bench-hidden', !show);
            if (hasName) count++;
        });
        const countEl = document.getElementById(`team-${teamKey}-bench-count`);
        if (countEl) countEl.textContent = count ? `（${count}）` : '（尚無）';
        const addBtn = document.querySelector(`.bench-add-btn[data-team="${teamKey}"]`) as HTMLButtonElement | null;
        if (addBtn) addBtn.disabled = rows.every(r => !r.classList.contains('bench-hidden'));
    }
    function createPitcherInputHTML(team) {
        return `
        <div class="pitcher-input-container">
            <div class="player-photo-container">
                <img src="" id="player-photo-preview-${team}-${PITCHER_ROSTER_INDEX}" class="player-photo-preview" alt="照片">
                <label for="player-photo-upload-${team}-${PITCHER_ROSTER_INDEX}" class="image-upload-label">+</label>
                <input type="file" id="player-photo-upload-${team}-${PITCHER_ROSTER_INDEX}" class="image-upload-input" data-team="${team}" data-index="${PITCHER_ROSTER_INDEX}" data-type="photo" accept="image/*">
            </div>
            <span class="pitcher-order-span">P</span>
            <input type="text" data-team="${team}" data-type="pitcher-jersey" placeholder="背號">
            <input type="text" data-team="${team}" data-type="pitcher-name" placeholder="姓名">
            <span class="pos-fixed" data-type="pitcher-pos" title="投手">P</span>
        </div>`;
    }
    function createPlayerInputHTML(team, index, isBench, positionOptions) {
        const displayIndex = isBench ? '' : index + 1;
        const benchClass = isBench ? 'bench-player' : '';
        const dragHandle = '<div class="drag-handle" title="拖曳排序">⠿</div>';
        const playerInputFields = `
            <span class="player-order-span">${displayIndex}</span>
            <input type="text" data-team="${team}" data-index="${index}" data-type="jersey" placeholder="背號">
            <input type="text" data-team="${team}" data-index="${index}" data-type="name" placeholder="姓名">
            <select data-team="${team}" data-index="${index}" data-type="pos"><option value="" hidden>—</option>${positionOptions}</select>
        `;
        // 板凳列：往右滑會露出左側的紅色 ⛔，滑到底直接刪除（iOS 風格）
        const removeBtn = isBench
            ? `<div class="swipe-reveal" data-team="${team}" data-index="${index}" role="button" aria-label="移除此板凳球員">⛔</div>`
            : '';
        return `
            <div class="lineup-player ${benchClass}">
                ${dragHandle}
                ${removeBtn}
                <div class="player-photo-container">
                    <img src="" id="player-photo-preview-${team}-${index}" class="player-photo-preview" alt="照片">
                    <label for="player-photo-upload-${team}-${index}" class="image-upload-label">+</label>
                    <input type="file" id="player-photo-upload-${team}-${index}" class="image-upload-input" data-team="${team}" data-index="${index}" data-type="photo" accept="image/*">
                </div>
                ${playerInputFields}
            </div>
        `;
    }
    function openModal(modalEl, contentEl?) {
        modalEl.classList.remove('modal-hidden');
        // 每次開啟都清掉上次拖曳留下的座標，讓 CSS 的 flex 置中重新生效
        const content = contentEl || modalEl.querySelector('.draggable-modal-content');
        if (content) {
            content.classList.remove('is-dragging');
            content.style.top = '';
            content.style.left = '';
        }
    }
    function closeModal(modalEl) {
        modalEl.classList.add('modal-hidden');
    }
    function drag(e: MouseEvent) {
        if (!isDragging || !dragTarget)
            return;
        e.preventDefault();
        // 限制在視窗內，避免拖到看不見的地方
        const rect = dragTarget.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);
        const left = Math.min(Math.max(0, e.clientX - offsetX), maxLeft);
        const top = Math.min(Math.max(0, e.clientY - offsetY), maxTop);
        dragTarget.style.left = `${left}px`;
        dragTarget.style.top = `${top}px`;
    }
    function stopDrag() {
        isDragging = false;
        dragTarget = null;
        document.body.style.cursor = ''; // Reset cursor
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
    function setupStep2(playType) {
        modalStep2Title.textContent = playType === 'out' ? '選擇出局方式' : '選擇上壘方式';
        modalStep2Options.innerHTML = PLAY_TYPES[playType].map(play => {
            const categoryClass = PLAY_TYPE_CATEGORIES[play] ? `play-category-${PLAY_TYPE_CATEGORIES[play]}` : '';
            return `<button data-play="${play}" class="${categoryClass}">${PLAY_ABBREVIATIONS[play] || play}</button>`;
        }).join('');
        // Disable Fielder's Choice if no runners on base
        const fcButton = modalStep2Options.querySelector('button[data-play="野手選擇"]');
        if (fcButton && !gameState.bases.some(r => r !== null)) {
            (fcButton as HTMLButtonElement).disabled = true;
            // FIX: Cast fcButton to HTMLButtonElement to access the 'title' property.
            (fcButton as HTMLButtonElement).title = '壘上無人，無法選擇此項';
        }
    }
    function showModalStep(step) {
        [modalStep1, modalStep2, modalStepAdvanced].forEach(el => el.classList.add('modal-hidden'));
        if (step === 'step1')
            modalStep1.classList.remove('modal-hidden');
        if (step === 'step2')
            modalStep2.classList.remove('modal-hidden');
        if (step === 'advanced')
            modalStepAdvanced.classList.remove('modal-hidden');
    }
    function attachTeamSettingsListeners() {
        ['a', 'b'].forEach(teamKey => {
            const dhToggle = document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement;
            // Re-assigning onchange overwrites the previous handler, avoiding listener stacking.
            dhToggle.onchange = () => {
                saveStateForUndo();
                const team = gameState.teams[teamKey];
                team.useDH = dhToggle.checked;
                const pitcherSlot = PITCHER_ROSTER_INDEX;
                const gameStarted = gameState.inning > 1 || gameState.outs > 0 || gameState.events.length > 0;
                const teamLabel = teamKey === 'a' ? '客隊' : '主隊';
                const firstEmptyBench = () => {
                    for (let i = LINEUP_SIZE; i < PITCHER_ROSTER_INDEX; i++) {
                        if (!(team.roster[i].name || '').trim()) return i;
                    }
                    return -1;
                };
                if (!team.useDH) {
                    // 關閉 DH：先發投手取代 DH 的棒次，原 DH 退到板凳區（放進第一個空位）
                    let dhIdx = team.roster.slice(0, LINEUP_SIZE).findIndex(p => p.pos === 'DH');
                    if (dhIdx < 0) dhIdx = LINEUP_SIZE - 1;
                    const pitcher = team.roster[pitcherSlot];
                    const formerDH = team.roster[dhIdx];
                    if (pitcher && formerDH && pitcher !== formerDH) {
                        const benchIdx = firstEmptyBench();
                        team.roster[dhIdx] = pitcher;
                        if (benchIdx >= 0) {
                            // 空的板凳物件挪去投手欄佔位，原 DH 進板凳
                            team.roster[pitcherSlot] = team.roster[benchIdx];
                            team.roster[benchIdx] = formerDH;
                        }
                        else {
                            team.roster[pitcherSlot] = formerDH;   // 板凳全滿才暫放投手欄
                        }
                        pitcher.pos = 'P';
                        formerDH.pos = '';
                        (team as any).benchedDHId = formerDH._id;
                        team.lineupSpots[dhIdx].activePlayerId = pitcher._id;
                        team.lineupSpots[dhIdx].history = [pitcher._id];
                        if (gameStarted) logEvent(`${pitcher.name} 接替第 ${dhIdx + 1} 棒（原 DH ${formerDH.name} 退回板凳）。`, teamKey);
                    }
                }
                else {
                    // 開啟 DH：打線裡的投手移回投手欄；原本的 DH（若還在板凳）回到該棒次
                    const pIdx = team.roster.slice(0, LINEUP_SIZE).findIndex(p => p.pos === 'P');
                    if (pIdx >= 0) {
                        const pitcher = team.roster[pIdx];
                        let rIdx = team.roster.findIndex((p, i) => i >= LINEUP_SIZE && p._id === (team as any).benchedDHId);
                        if (rIdx < 0) rIdx = team.roster.findIndex((p, i) => i >= LINEUP_SIZE && i !== pitcherSlot && (p.name || '').trim());
                        if (rIdx < 0) rIdx = pitcherSlot;   // 沒有人可用：把投手欄的空物件叫進來取個名字
                        const returning = team.roster[rIdx];
                        team.roster[pIdx] = returning;
                        team.roster[rIdx] = team.roster[pitcherSlot];   // 投手欄原本的（空位或別人）補到板凳
                        team.roster[pitcherSlot] = pitcher;
                        returning.pos = 'DH';
                        if (!(returning.name || '').trim()) {
                            returning.name = `${teamLabel}球員${String(pIdx + 1).padStart(2, '0')}`;
                            returning.jersey = returning.jersey || String(pIdx + 1).padStart(2, '0');
                        }
                        (team as any).benchedDHId = null;
                        team.lineupSpots[pIdx].activePlayerId = returning._id;
                        team.lineupSpots[pIdx].history = [returning._id];
                        if (gameStarted) logEvent(`${returning.name} 擔任第 ${pIdx + 1} 棒指定打擊，${pitcher.name} 專任投手。`, teamKey);
                    }
                }
                if (gameStarted) logEvent(`${team.name} 的指定打擊(DH)制度已${team.useDH ? '啟用' : '停用'}。`, teamKey);
                // Rebuild UI and re-attach listeners, following the app's existing pattern.
                createLineupInputs();
                attachTeamSettingsListeners();
                saveState();
                render();
            };
            const nameInput = document.getElementById(`team-${teamKey}-name`) as HTMLInputElement;
            // Use oninput property to prevent stacking multiple event listeners.
            nameInput.oninput = (e) => {
                gameState.teams[teamKey].name = (e.target as HTMLInputElement).value;
            };
            const colorInput = document.getElementById(`team-${teamKey}-color`) as HTMLInputElement;
            // Use oninput property here as well for the same reason.
            colorInput.oninput = (e) => {
                gameState.teams[teamKey].color = (e.target as HTMLInputElement).value;
                applyTeamColors(); // Immediate visual feedback
            };
        });
    }
    function addEventListeners() {
        // 套用名單：不依賴表單原生送出。
        // 在沙箱化的 iframe（例如預覽環境）中，瀏覽器會靜默阻擋 form submit，
        // 造成按了按鈕卻毫無反應，因此改由按鈕的 click 直接呼叫。
        function applyLineup() {
            const isGameInProgress = gameState.inning > 1 || gameState.outs > 0 || gameState.events.length > 0;
            // 先處理拖曳造成的棒次變動，再重畫欄位讓 data-index 對回新位置
            const reordered = (['a', 'b'] as const).map(k => reorderRosterFromDOM(k)).some(Boolean);
            if (reordered) {
                createLineupInputs();
                attachTeamSettingsListeners();
                renderLineupInputs();
            }
            saveLineup();
            // 已寫入 gameState，清除編輯標記讓後續重繪恢復正常同步
            lineupForm.querySelectorAll('[data-dirty]').forEach(el => {
                delete (el as HTMLElement).dataset.dirty;
            });
            saveState();
            render();
        }
        const applyLineupBtn = document.getElementById('apply-lineup');
        if (applyLineupBtn) {
            applyLineupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                applyLineup();
            });
        }
        // 自動套用：改完任何欄位就直接生效，不必再按按鈕
        let autoApplyTimer: any = null;
        function scheduleAutoApply() {
            clearTimeout(autoApplyTimer);
            autoApplyTimer = setTimeout(() => {
                const before = lineupFingerprint();
                applyLineup();
                if (lineupFingerprint() !== before) flashSaved();
            }, 120);
        }
        (window as any).__scheduleAutoApply = scheduleAutoApply;
        function lineupFingerprint() {
            return (['a', 'b'] as const).map(k => {
                const t = gameState.teams[k];
                return [t.name, t.color, t.useDH, ...t.roster.map(p => `${p.name}|${p.jersey}|${p.pos}`)].join(',');
            }).join(';');
        }
        function flashSaved() {
            const el = document.getElementById('lineup-save-status');
            if (!el) return;
            el.textContent = '✓ 已儲存';
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 1200);
        }
        lineupForm.addEventListener('change', (e) => {
            const t = e.target as HTMLElement;
            if (t instanceof HTMLInputElement && t.type === 'file') return;   // 照片另有處理
            if (t.closest('.bench-add-btn')) return;
            if (t instanceof HTMLSelectElement && t.dataset.type === 'pos') swapPositionWithHolder(t);
            scheduleAutoApply();
        });
        // A 改成某個守位時，原本守那個位置的 B 換成 A 原本的守位，兩人對調
        function swapPositionWithHolder(sel: HTMLSelectElement) {
            const teamKey = sel.dataset.team as 'a' | 'b';
            const index = Number(sel.dataset.index);
            const newPos = sel.value;
            if (!newPos) return;
            const roster = gameState.teams[teamKey].roster;
            const oldPos = roster[index] ? roster[index].pos : '';
            if (oldPos === newPos) return;
            const other = [...lineupForm.querySelectorAll(`select[data-team="${teamKey}"][data-type="pos"]`)]
                .find(el => el !== sel && (el as HTMLSelectElement).value === newPos) as HTMLSelectElement | undefined;
            if (!other) return;
            other.value = oldPos;
            const otherRow = other.closest('.lineup-player');
            if (otherRow) {
                otherRow.classList.add('pos-swapped');
                setTimeout(() => otherRow.classList.remove('pos-swapped'), 900);
            }
        }
        lineupForm.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.bench-add-btn') as HTMLElement | null;
            if (btn) {
                e.preventDefault();
                updateBenchVisibility(btn.dataset.team, true);
                return;
            }
        });
        // ===== 板凳列往右滑刪除 =====
        const SWIPE_OPEN = 84;          // 露出 ⛔ 的距離
        let swipe: { row: HTMLElement; startX: number; startY: number; dx: number; locked: boolean; width: number } | null = null;
        const openRows = new Set<HTMLElement>();
        const setRowX = (row: HTMLElement, x: number, animate: boolean) => {
            row.style.transition = animate ? 'transform 0.18s ease-out' : 'none';
            row.style.transform = x ? `translateX(${x}px)` : '';
            row.classList.toggle('swipe-open', x >= SWIPE_OPEN);
            row.classList.toggle('will-delete', x >= row.clientWidth * 0.55);
        };
        const closeOpenRows = (except?: HTMLElement) => {
            openRows.forEach(r => { if (r !== except) { setRowX(r, 0, true); openRows.delete(r); } });
        };
        const deleteRow = (row: HTMLElement) => {
            const reveal = row.querySelector('.swipe-reveal') as HTMLElement;
            row.style.transition = 'transform 0.15s ease-in, opacity 0.15s';
            row.style.transform = `translateX(${row.clientWidth}px)`;
            row.style.opacity = '0';
            setTimeout(() => {
                row.style.transition = ''; row.style.transform = ''; row.style.opacity = '';
                row.classList.remove('swipe-open', 'will-delete');
                openRows.delete(row);
                removeBenchPlayer(reveal.dataset.team as 'a' | 'b', Number(reveal.dataset.index));
            }, 160);
        };
        (window as any).__swipeDeleteRow = deleteRow;   // 供測試
        lineupForm.addEventListener('pointerdown', (e: PointerEvent) => {
            const target = e.target as HTMLElement;
            const row = target.closest('.lineup-player.bench-player') as HTMLElement | null;
            if (!row) { closeOpenRows(); return; }
            if (target.closest('.drag-handle, select, .swipe-reveal, .image-upload-label')) return;
            if (row.classList.contains('bench-hidden')) return;
            closeOpenRows(row);
            swipe = { row, startX: e.clientX, startY: e.clientY, dx: 0, locked: false, width: row.clientWidth || 360 };
        });
        lineupForm.addEventListener('pointermove', (e: PointerEvent) => {
            if (!swipe) return;
            const dx = e.clientX - swipe.startX;
            const dy = e.clientY - swipe.startY;
            if (!swipe.locked) {
                if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }   // 垂直捲動
                if (dx < 8) return;
                swipe.locked = true;
                (document.activeElement as HTMLElement)?.blur?.();
            }
            e.preventDefault();
            swipe.dx = Math.max(0, Math.min(dx, swipe.width * 0.9));
            setRowX(swipe.row, swipe.dx, false);
        });
        const endSwipe = () => {
            if (!swipe) return;
            const { row, dx, width, locked } = swipe;
            swipe = null;
            if (!locked) return;
            if (dx >= width * 0.55) { deleteRow(row); return; }
            if (dx >= 40) { setRowX(row, SWIPE_OPEN, true); openRows.add(row); }
            else { setRowX(row, 0, true); openRows.delete(row); }
        };
        lineupForm.addEventListener('pointerup', endSwipe);
        lineupForm.addEventListener('pointercancel', endSwipe);
        lineupForm.addEventListener('click', (e) => {
            const reveal = (e.target as HTMLElement).closest('.swipe-reveal') as HTMLElement | null;
            if (!reveal) return;
            e.preventDefault();
            const row = reveal.closest('.lineup-player') as HTMLElement;
            deleteRow(row);
        });
        // 移除板凳球員：清空該位置的資料並把列收起來（不跳確認視窗）
        function removeBenchPlayer(teamKey: 'a' | 'b', index: number) {
            const player = gameState.teams[teamKey].roster[index];
            if (!player) return;
            player.name = '';
            player.jersey = '';
            player.pos = '';
            player.photo = DEFAULT_PLAYER_PHOTO_BASE64;
            const row = lineupForm.querySelector(`input[data-team="${teamKey}"][data-index="${index}"][data-type="name"]`)?.closest('.lineup-player') as HTMLElement | null;
            if (row) {
                (row.querySelector('input[data-type="name"]') as HTMLInputElement).value = '';
                (row.querySelector('input[data-type="jersey"]') as HTMLInputElement).value = '';
                const sel = row.querySelector('select[data-type="pos"]') as HTMLSelectElement | null;
                if (sel) sel.value = '';
                const img = row.querySelector('img') as HTMLImageElement | null;
                if (img) img.src = DEFAULT_PLAYER_PHOTO_BASE64;
                delete row.dataset.revealed;
            }
            updateBenchVisibility(teamKey);
            scheduleAutoApply();
        }
        // 保留 submit 監聽，讓在欄位中按 Enter 也能套用
        lineupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyLineup();
        });
        // 使用者手動輸入時標記，避免重繪覆蓋尚未套用的內容
        lineupForm.addEventListener('input', (e) => {
            const t = e.target as HTMLElement;
            if (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'number')) {
                t.dataset.dirty = '1';
            }
        });
        lineupForm.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            if (target instanceof HTMLSelectElement) {
                (target as HTMLElement).dataset.dirty = '1';
            }
            if (target.type === 'file' && target.classList.contains('image-upload-input')) {
                const file = target.files?.[0];
                if (!file)
                    return;
                const { team, index, type } = target.dataset;
                try {
                    const base64String = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = error => reject(error);
                        reader.readAsDataURL(file);
                    });
                    if (type === 'logo') {
                        const small = await shrinkImage(base64String, 192);
                        gameState.teams[team].logo = small;
                        (document.getElementById(`team-${team}-logo-preview`) as HTMLImageElement).src = small;
                    }
                    else if (type === 'photo') {
                        const small = await shrinkImage(base64String, 256);
                        const playerIndex = parseInt(index, 10);
                        gameState.teams[team].roster[playerIndex].photo = small;
                        (document.getElementById(`player-photo-preview-${team}-${index}`) as HTMLImageElement).src = small;
                    }
                    saveState();
                    render();
                    saveState();
                    render(); // Re-render to show images in other parts of the UI
                }
                catch (error) {
                    console.error('Error reading image file:', error);
                    alert('讀取圖片失敗。');
                }
            }
        });
        lineupForm.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            if (target.classList.contains('save-roster-btn')) {
                saveRoster(target.dataset.team as 'a' | 'b');
            }
            else if (target.classList.contains('load-roster-btn')) {
                openLoadRosterModal(target.dataset.team);
            }
        });
        const teamSettingsTabs = document.getElementById('team-settings-tabs');
        if (teamSettingsTabs) {
            teamSettingsTabs.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                if (!target.classList.contains('tab-button'))
                    return;
                const teamKey = target.dataset.team;
                if (!teamKey)
                    return;
                // Update active tab button
                teamSettingsTabs.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.team === teamKey);
                });
                // Update active tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === `team-${teamKey}-tab-content`);
                });
            });
        }
        closeLoadRosterModalBtn.addEventListener('click', () => closeModal(loadRosterModal));
        loadRosterModal.addEventListener('click', (e) => { if (e.target === loadRosterModal)
            closeModal(loadRosterModal); });
        savedRostersList.addEventListener('mousedown', handleLoadRosterModalClick);
        attachTeamSettingsListeners();
        newGameBtn.addEventListener('click', () => { openModal(confirmModal); });
        confirmResetBtn.addEventListener('click', () => { gameState = getInitialGameState(); gameStateHistory = []; saveState(); createLineupInputs(); attachTeamSettingsListeners(); render(); closeModal(confirmModal); });
        cancelResetBtn.addEventListener('click', () => { closeModal(confirmModal); });
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal)
            closeModal(confirmModal); });
        viewBoxScoreBtn.addEventListener('click', () => { renderBoxScore(); openModal(boxScoreModal); });
        closeBoxScoreModalBtn.addEventListener('click', () => { closeModal(boxScoreModal); });
        boxScoreModal.addEventListener('click', (e) => { if (e.target === boxScoreModal)
            closeModal(boxScoreModal); });
        exportBoxScoreBtn.addEventListener('click', exportBoxScoreToCSV);
        exportBoxScoreXLSXBtn.addEventListener('click', exportBoxScoreToXLSX);
        const exportLogBtn = document.getElementById('export-log-btn');
        if (exportLogBtn) {
            exportLogBtn.addEventListener('click', exportEventLogToTxt);
        }
        playBallBtn.addEventListener('click', () => {
            if (gameState.isGameOver)
                return;
            // 按下即開賽，字樣消失，之後改為直接點球場記錄
            gameState.started = true;
            gameState.startTime = Date.now();
            gameState.endTime = null;
            gameState.pausedMs = 0;
            gameState.pausedAt = null;
            logEvent('比賽開始。');
            saveState();
            render();
            startGameClock();
        });
        closeModalBtn.addEventListener('click', () => closeModal(modal));
        setupClockControls();
        if (gameState.started && gameState.startTime) startGameClock();
        modal.addEventListener('click', (e) => { if (e.target === modal)
            closeModal(modal); });
        backButton.addEventListener('click', () => showModalStep('step1'));
        backButtonAdvanced.addEventListener('click', () => {
            if (advancedPlayState.step === 'set-runners') {
                if (advancedPlayState.play === '野手選擇') {
                    // Go back to runner selection for Fielder's Choice
                    advancedPlayState.step = 'select-fc-out';
                    // Clear the previously selected out runner
                    const outRunnerKey = `base-${advancedPlayState.outRunnerBase}`;
                    delete advancedPlayState.runnerDestinations[outRunnerKey];
                    advancedPlayState.outRunnerBase = null;
                    renderAdvancedPlayOptions();
                }
                else if (advancedPlayState.error) {
                    advancedPlayState.step = 'select-error';
                    renderAdvancedPlayOptions();
                }
                else if (['內安', '一安', '二安', '三安', '不死三振'].includes(advancedPlayState.play)) {
                    advancedPlayState.step = 'ask-error';
                    renderAdvancedPlayOptions();
                }
                else if (advancedPlayState.play === '本打') {
                    showModalStep('step2'); // Go back to play selection for Home Run
                }
                else {
                    showModalStep('step2');
                }
            }
            else if (advancedPlayState.step === 'select-error') {
                if (['內安', '一安', '二安', '三安', '不死三振'].includes(advancedPlayState.play)) {
                    advancedPlayState.error = null;
                    advancedPlayState.errors = [];
                    advancedPlayState.step = 'ask-error';
                    renderAdvancedPlayOptions();
                }
                else {
                    showModalStep('step2');
                }
            }
            else {
                showModalStep('step2');
            }
        });
        doneButtonAdvanced.addEventListener('click', processAdvancedPlay);
        undoBtn.addEventListener('click', handleUndo);
        runnerActionBtn.addEventListener('click', openRunnerActionModal);
        closeRunnerActionModalBtn.addEventListener('click', () => closeModal(runnerActionModal));
        runnerActionModal.addEventListener('click', (e) => { if (e.target === runnerActionModal)
            closeModal(runnerActionModal); });
        runnerActionModal.addEventListener('click', handleRunnerActionClick);
        backButtonRunnerAction.addEventListener('click', () => showRunnerActionStep('select-event'));
        runnerActionDoneBtn.addEventListener('click', processRunnerAction);
        managementBtn.addEventListener('click', openManagementModal);
        // 代打／換投改放在「球員調度」視窗最上方（打者卡片維持原本資訊）
        document.getElementById('management-container')?.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if (t.closest('#pinch-hit-btn')) { e.stopPropagation(); closeModal(managementModal); pinchHit(); }
            else if (t.closest('#change-pitcher-btn')) { e.stopPropagation(); closeModal(managementModal); changePitcher(); }
        }, true);

        document.getElementById('picker-close')?.addEventListener('click', () => closeModal(document.getElementById('picker-modal')));
        // 壘上跑者人像：點了就代跑
        ['mf-first', 'mf-second', 'mf-third'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.pointerEvents = 'auto';
            el.addEventListener('click', (e) => {
                if (!gameState.bases[i] || !gameState.started || gameState.isGameOver) return;
                e.stopPropagation();
                pinchRun(i);
            });
        });
        closeManagementModalBtn.addEventListener('click', () => closeModal(managementModal));
        managementModal.addEventListener('click', (e) => { if (e.target === managementModal)
            closeModal(managementModal); });
        managementModal.addEventListener('click', handleManagementInteraction);
        modalStep1.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON') {
                const step = target.dataset.step;
                if (step) {
                    setupStep2(step);
                    showModalStep('step2');
                }
            }
        });
        modalStep2Options.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON' && !(target as HTMLButtonElement).disabled) {
                const play = target.dataset.play;
                const playCategory = PLAY_TYPE_CATEGORIES[play];
                const isHit = ['hit'].includes(playCategory);
                const isAdvancedOut = ['sacrifice'].includes(playCategory);
                const isAdvancedOnBase = ['error', 'walk', 'fielder-choice', 'interference'].includes(playCategory) && !['四壞', '觸身球'].includes(play);
                const isGroundOrFlyOut = ['groundout', 'flyout'].includes(playCategory);
                const isSpecialOut = playCategory === 'special-out';
                if (isHit || isAdvancedOut || isAdvancedOnBase || isGroundOrFlyOut || isSpecialOut) {
                    const batterIsOut = isAdvancedOut || isGroundOrFlyOut || isSpecialOut;
                    startAdvancedPlay(play, { batterIsOut });
                }
                else {
                    handlePlay(play);
                    closeModal(modal);
                }
            }
        });
        // FIX: Use `e.target.closest('button')` to robustly handle clicks on button child elements. This prevents errors where `e.target` is not the button itself, ensuring `dataset` is always accessible on the correct element.
        modalAdvancedOptions.addEventListener('click', (e) => {
            const target = e.target as Element;
            // 球場圖：只記錄落點座標，不再分區
            const svg = target.closest('#hit-field') as SVGSVGElement | null;
            if (svg) {
                const onField = target.closest('[data-step="set-point"]') as SVGPathElement | null;
                if (onField) {
                    // 座標換算：舊瀏覽器或特殊環境可能不支援，改用邊界框推算作為後備
                    let next: { x: number; y: number };
                    try {
                        const pt = (svg as any).createSVGPoint();
                        pt.x = (e as MouseEvent).clientX;
                        pt.y = (e as MouseEvent).clientY;
                        const loc = pt.matrixTransform((svg as any).getScreenCTM().inverse());
                        next = { x: Math.round(loc.x), y: Math.round(loc.y) };
                    } catch {
                        const box = svg.getBoundingClientRect();
                        const vb = (svg.getAttribute('viewBox') || '0 0 200 180').split(/\s+/).map(Number);
                        const rx = box.width ? ((e as MouseEvent).clientX - box.left) / box.width : 0.5;
                        const ry = box.height ? ((e as MouseEvent).clientY - box.top) / box.height : 0.5;
                        next = { x: Math.round(vb[0] + rx * vb[2]), y: Math.round(vb[1] + ry * vb[3]) };
                    }
                    const prev = advancedPlayState.hitPoint;
                    // 點在同一位置附近視為取消
                    const same = prev && Math.hypot(prev.x - next.x, prev.y - next.y) < 6;
                    advancedPlayState.hitPoint = same ? null : next;
                }
                else {
                    advancedPlayState.hitPoint = null;
                }
                renderAdvancedPlayOptions();
                return;
            }
            const button = target.closest('button');
            if (button) {
                const { step, errorPos, dest, runnerId, choice, outRunnerBase } = button.dataset;
                if (step === 'set-fielder') {
                    // 必須從 button 讀取，target 可能是按鈕內的子節點
                    const dir = button.dataset.dir;
                    // 依序點：第一個是接球者，之後每點一個就是傳給誰；點最後一個可退回一步
                    let chain = [...(advancedPlayState.fielders || [])];
                    if (advancedPlayState.directionAuto) {
                        // 自動帶入的鏈只是猜測：使用者一動手就從頭重建，不然會接在猜測後面
                        chain = [dir];
                    }
                    else if (chain.length && chain[chain.length - 1] === dir) chain.pop();
                    else chain.push(dir);
                    setFielderChain(chain);
                    advancedPlayState.directionAuto = false;   // 手動選過就不再標示為自動
                    renderAdvancedPlayOptions();
                }
                else if (step === 'clear-fielders') {
                    setFielderChain([]);
                    advancedPlayState.directionAuto = false;
                    advancedPlayState.rundown = null;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'set-ball-type') {
                    advancedPlayState.ballType = button.dataset.ball as any;
                    // 換球種時，若守備鏈還是自動帶入的，重算預設鏈
                    if (advancedPlayState.directionAuto && advancedPlayState.direction) {
                        setFielderChain(defaultFielderChain(advancedPlayState.play, advancedPlayState.direction));
                    }
                    renderAdvancedPlayOptions();
                }
                else if (step === 'toggle-rundown') {
                    advancedPlayState.rundown = !isRundown(advancedPlayState.fielders || [], advancedPlayState.rundown);
                    renderAdvancedPlayOptions();
                }
                else if (step === 'add-error') {
                    advancedPlayState.step = 'select-error';
                    renderAdvancedPlayOptions();
                }
                else if (step === 'clear-error') {
                    advancedPlayState.error = null;
                    advancedPlayState.errors = [];
                    renderAdvancedPlayOptions();
                }
                else if (step === 'ask-error') {
                    if (choice === 'yes') {
                        advancedPlayState.step = 'select-error';
                    }
                    else {
                        advancedPlayState.step = 'set-runners';
                    }
                    renderAdvancedPlayOptions();
                }
                else if (step === 'select-error') {
                    advancedPlayState.step = 'set-runners';
                    advancedPlayState.errors = [...(advancedPlayState.errors || []), errorPos];
                    advancedPlayState.error = advancedPlayState.errors[0];
                    renderAdvancedPlayOptions();
                }
                else if (step === 'remove-error') {
                    const idx = Number(button.dataset.idx);
                    const list = [...(advancedPlayState.errors || [])];
                    list.splice(idx, 1);
                    advancedPlayState.errors = list;
                    advancedPlayState.error = list[0] || null;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'select-fc-out') {
                    if (outRunnerBase === 'none') {
                        advancedPlayState.outRunnerBase = null;
                    }
                    else {
                        const outRunnerBaseIndex = Number(outRunnerBase);
                        advancedPlayState.outRunnerBase = outRunnerBaseIndex;
                        // Pre-set the runner as out
                        advancedPlayState.runnerDestinations[`base-${outRunnerBaseIndex}`] = { dest: 0, isUnearned: false };
                    }
                    advancedPlayState.step = 'set-runners';
                    renderAdvancedPlayOptions();
                }
                else if (step === 'set-runners') {
                    if (runnerId) {
                        const runnerKey = `base-${runnerId}`;
                        advancedPlayState.runnerDestinations[runnerKey] = { dest: Number(dest), isUnearned: advancedPlayState.runnerDestinations[runnerKey]?.isUnearned || false };
                    }
                    else { // Batter
                        const outAdvancing = button.dataset.outAdvancing === '1';
                        advancedPlayState.batterDestination = {
                            dest: outAdvancing ? 0 : Number(dest),
                            isUnearned: advancedPlayState.batterDestination?.isUnearned || false,
                            ...(outAdvancing ? { outAdvancing: true } : {})
                        } as any;
                    }
                    renderAdvancedPlayOptions(); // Re-render to show selection
                }
                else if (step === 'toggle-obstruction') {
                    advancedPlayState.obstruction = !advancedPlayState.obstruction;
                    renderAdvancedPlayOptions();
                }
            }
        });
        stadiumInput.addEventListener('input', () => {
            gameState.stadium = stadiumInput.value;
            saveState();
        });
        gameDateInput.addEventListener('change', () => {
            gameState.gameDate = gameDateInput.value;
            saveState();
        });
        if (weatherInput) {
            weatherInput.addEventListener('change', () => {
                gameState.weather = weatherInput.value;
                saveState();
            });
        }
        // --- Mobile Navigation & Layout Listeners ---
        // 正式記錄表：暫時只呈現與「匯出紀錄」相同的內容，並且留在 APP 裡。
        // （原本開新視窗寫入 WBSC 格式的做法在手機上會回不來，先停用）
        const officialSheetBtn = document.getElementById('official-sheet-btn');
        const logViewModal = document.getElementById('log-view-modal');
        const logViewText = document.getElementById('log-view-text');
        if (officialSheetBtn && logViewModal && logViewText) {
            officialSheetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const lines = (gameState.events || []).map(ev => ev.text);
                logViewText.textContent = lines.length ? lines.join('\n') : '目前沒有任何紀錄。';
                openModal(logViewModal);
            });
            const closeBtn = document.getElementById('close-log-view-modal');
            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(logViewModal));
            logViewModal.addEventListener('click', (e) => {
                if (e.target === logViewModal) closeModal(logViewModal);
            });
        }
        // === 主畫面球場：位置優先的記錄流程 ===
        const mainField = document.getElementById('main-field');
        const resultPanel = document.getElementById('field-result-panel');
        const quickPlays = document.getElementById('quick-plays');
        let pendingPoint = null;   // 已標示但尚未選結果的落點
        let pendingZone = null;    // 該落點所屬的區域（internal/outfield/foul）

        function fieldPointFrom(e, svg) {
            try {
                const pt = (svg as any).createSVGPoint();
                pt.x = (e as MouseEvent).clientX;
                pt.y = (e as MouseEvent).clientY;
                const loc = pt.matrixTransform((svg as any).getScreenCTM().inverse());
                return { x: Math.round(loc.x), y: Math.round(loc.y) };
            }
            catch {
                // 後備推算：沿用主球場自己的 viewBox，之後再統一換算成小圖座標
                const box = svg.getBoundingClientRect();
                const vb = (svg.getAttribute('viewBox') || '18 -35 370 425').split(/\s+/).map(Number);
                const cx = (e as MouseEvent).clientX, cy = (e as MouseEvent).clientY;
                if (!box.width && !box.height && (cx || cy)) return { x: cx, y: cy };   // 無版面環境（測試）：直接當座標
                const rx = box.width ? (cx - box.left) / box.width : 0.5;
                const ry = box.height ? (cy - box.top) / box.height : 0.5;
                return { x: Math.round(vb[0] + rx * vb[2]), y: Math.round(vb[1] + ry * vb[3]) };
            }
        }

        function clearPendingPoint() {
            pendingPoint = null;
            pendingZone = null;
            const mark = document.getElementById('mf-mark');
            if (mark) (mark as any).style.display = 'none';
            if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }
        }

        function showResultOptions(zone) {
            const list = ZONE_PLAYS.field;
            if (!resultPanel) return;
            const groups = ['安打', '出局', '其他'];
            const zoneWord = zone === 'foul' ? '界外' : zone === 'infield' ? '內野' : '外野';
            const fits = (o: any) => !o.zones || o.zones.indexOf(zone) >= 0;
            const btn = (o: any) => `<button type="button" data-play="${o.play}" class="${o.out ? 'is-out' : ''}">${o.label}</button>`;
            const section = (items: any[]) => groups.map(g => {
                const inGroup = items.filter(o => o.group === g);
                if (!inGroup.length) return '';
                return `<div class="frp-group"><span class="frp-group-label">${g}</span><div class="frp-options">`
                    + inGroup.map(btn).join('') + `</div></div>`;
            }).join('');
            const main = list.filter(fits);
            const rest = list.filter(o => !fits(o));
            resultPanel.innerHTML =
                `<div class="frp-title">落點：${zoneWord}　選擇結果</div>`
                + section(main)
                + (rest.length
                    ? `<button type="button" class="frp-more" data-more="1">其他結果（${rest.length}）</button>`
                      + `<div class="frp-rest hidden">${section(rest)}</div>`
                    : '')
                + `<button type="button" class="frp-cancel" data-cancel="1">取消</button>`;
            resultPanel.classList.remove('hidden');
        }
        // 整片球場只有一個點擊區：內野／外野／界外改由落點的幾何位置判斷
        function zoneOfPoint(p: { x: number; y: number }) {
            const dx = p.x - MAIN_FIELD_GEO.hx, dy = p.y - MAIN_FIELD_GEO.hy;
            const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
            if (Math.abs(deg) > 45) return 'foul';
            return Math.hypot(dx, dy) <= MAIN_FIELD_GEO.rInfield ? 'infield' : 'outfield';
        }

        // 依結果決定要直接記錄還是進入跑者處理
        function runPlay(play) {
            const category = PLAY_TYPE_CATEGORIES[play];
            const isHit = category === 'hit';
            const isAdvancedOut = category === 'sacrifice';
            const isAdvancedOnBase = ['error', 'fielder-choice', 'interference'].includes(category)
                || play === '不死三振';
            const isGroundOrFlyOut = ['groundout', 'flyout'].includes(category);
            // 雙殺／三殺也要能逐壘指定誰出局、誰推進
            const isSpecialOut = category === 'special-out';
            if (isHit || isAdvancedOut || isAdvancedOnBase || isGroundOrFlyOut || isSpecialOut) {
                startAdvancedPlay(play, { batterIsOut: isAdvancedOut || isGroundOrFlyOut || isSpecialOut });
                if (pendingPoint) {
                    // 主畫面已經標好落點，換算成記錄用小圖座標後直接沿用，
                    // 後面的視窗只顯示結果，不再要求重選一次。
                    const mini = mainPointToMini(pendingPoint);
                    advancedPlayState.hitPoint = mini;
                    advancedPlayState.pointConfirmed = true;
                    const auto = fielderInZone(fielderFromMiniPoint(mini), mini, pendingZone);
                    if (auto) {
                        setFielderChain(defaultFielderChain(play, auto));
                        advancedPlayState.directionAuto = true;
                    }
                }
                renderAdvancedPlayOptions();
                openModal(modal, modalContent);
                showModalStep('advanced');
            }
            else {
                handlePlay(play);
            }
            clearPendingPoint();
        }

        if (mainField) {
            mainField.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.mf-base.occupied')) return;   // 點跑者＝代跑
                if (gameState.isGameOver) return;
                if (!gameState.started) return;          // 未開賽先按 PLAY BALL
                const target = e.target as Element;
                const zoneEl = target.closest('[data-zone]') as SVGPathElement | null;
                if (!zoneEl) return;
                const zone = (zoneEl as any).dataset.zone;
                pendingPoint = fieldPointFrom(e, mainField as any);
                pendingZone = zoneOfPoint(pendingPoint);
                const mark = document.getElementById('mf-mark');
                if (mark) {
                    mark.setAttribute('cx', String(pendingPoint.x));
                    mark.setAttribute('cy', String(pendingPoint.y));
                    (mark as any).style.display = '';
                }
                showResultOptions(pendingZone);
            });
        }

        if (resultPanel) {
            resultPanel.addEventListener('click', (e) => {
                const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
                if (!btn) return;
                if (btn.dataset.cancel) { clearPendingPoint(); return; }
                // 「其他結果」：把落點對不上的那些展開
                if (btn.dataset.more) {
                    const rest = resultPanel.querySelector('.frp-rest');
                    if (rest) rest.classList.remove('hidden');
                    btn.remove();
                    return;
                }
                if (btn.dataset.play) runPlay(btn.dataset.play);
            });
        }

        if (quickPlays) {
            quickPlays.addEventListener('click', (e) => {
                const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
                if (!btn || gameState.isGameOver || !gameState.started) return;
                const play = btn.dataset.play;
                if (play === '__more') {
                    clearPendingPoint();
                    showModalStep('step1');
                    openModal(modal, modalContent);
                    return;
                }
                clearPendingPoint();
                runPlay(play);
            });
        }

        const panelTabs = document.getElementById('panel-tabs');
        if (panelTabs) {
            panelTabs.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest('.panel-tab') as HTMLElement;
                if (btn && btn.dataset.tab) setPanelTab(btn.dataset.tab);
            });
        }
        mobileNav.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('nav-dot')) {
                const index = parseInt(target.dataset.index, 10);
                navigateToPanel(index);
            }
        });
        appContainer.addEventListener('touchstart', handlePanelDragStart, { passive: false });
        appContainer.addEventListener('mousedown', handlePanelDragStart);
        // --- Centralized Modal Drag Handler ---
        document.addEventListener('mousedown', (e: MouseEvent) => {
            // Only allow dragging on desktop, and only for left clicks
            if (e.button !== 0 || window.matchMedia('(max-width: 768px), (orientation: portrait)').matches) {
                return;
            }
            const target = e.target as HTMLElement;
            const handle = target.closest('.modal-drag-handle');
            // If mousedown was not on a handle, do nothing and let the event bubble
            if (!handle) {
                return;
            }
            // If we are here, a drag is initiated on a handle.
            // Prevent default actions like text selection on the title.
            e.preventDefault();
            const modalToDrag = handle.closest('.draggable-modal-content') as HTMLElement;
            if (!modalToDrag) {
                return;
            }
            // 行動裝置不啟用拖曳：視窗維持置中即可
            if (window.matchMedia('(max-width: 768px), (orientation: portrait)').matches) {
                return;
            }
            isDragging = true;
            dragTarget = modalToDrag;
            document.body.style.cursor = 'grabbing'; // Provide visual feedback
            const startRect = dragTarget.getBoundingClientRect();
            offsetX = e.clientX - startRect.left;
            offsetY = e.clientY - startRect.top;
            // 由置中切換成絕對定位，並沿用當下位置，避免跳動
            dragTarget.classList.add('is-dragging');
            dragTarget.style.left = `${startRect.left}px`;
            dragTarget.style.top = `${startRect.top}px`;
            // These listeners are added for the duration of the drag and removed on mouseup
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        });
        window.addEventListener('resize', updateLayout);
        // --- Roster Drag & Drop ---
        let draggedElement: HTMLElement | null = null;
        let ghostElement: HTMLElement | null = null;
        let currentDropTarget: HTMLElement | null = null;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        function handleDragStart(e: MouseEvent | TouchEvent) {
            const target = e.target as HTMLElement;
            const handle = target.closest('.drag-handle');
            if (!handle || (e instanceof MouseEvent && e.button !== 0)) {
                return;
            }
            // 比賽進行中不能用拖曳換人（會繞過替補紀錄），請用主頁的代打／代跑／換投或球員調度
            if (gameState.started && !gameState.isGameOver) return;
            // Prevent default behavior that can interfere with drag (e.g., text selection)
            e.preventDefault();
            draggedElement = handle.closest('.lineup-player');
            if (!draggedElement)
                return;
            const rect = draggedElement.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            ghostElement = draggedElement.cloneNode(true) as HTMLElement;
            ghostElement.classList.add('ghost');
            ghostElement.style.width = `${rect.width}px`;
            ghostElement.style.height = `${rect.height}px`;
            ghostElement.style.left = `${clientX - dragOffsetX}px`;
            ghostElement.style.top = `${clientY - dragOffsetY}px`;
            document.body.appendChild(ghostElement);
            // Use a short timeout to allow the browser to render the initial state before applying the dragging class
            setTimeout(() => {
                draggedElement?.classList.add('dragging');
            }, 0);
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('touchmove', handleDragMove, { passive: false });
            document.addEventListener('mouseup', handleDragEnd);
            document.addEventListener('touchend', handleDragEnd);
        }
        function handleDragMove(e: MouseEvent | TouchEvent) {
            if (!draggedElement || !ghostElement)
                return;
            e.preventDefault();
            const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
            ghostElement.style.left = `${x - dragOffsetX}px`;
            ghostElement.style.top = `${y - dragOffsetY}px`;
            // The ghost element has `pointer-events: none`, so `elementFromPoint` will see through it.
            const elementUnderPointer = document.elementFromPoint(x, y);
            if (currentDropTarget) {
                currentDropTarget.classList.remove('drop-target');
                currentDropTarget = null;
            }
            // FIX: Cast the result of `closest` to `HTMLElement` to match the type of `currentDropTarget`.
            const potentialTarget = elementUnderPointer?.closest('.lineup-player') as HTMLElement | null;
            const draggedTeam = (draggedElement.querySelector('[data-team]') as HTMLElement)?.dataset.team;
            if (potentialTarget && potentialTarget !== draggedElement) {
                const targetTeam = (potentialTarget.querySelector('[data-team]') as HTMLElement)?.dataset.team;
                const isSameTeam = draggedTeam === targetTeam;
                const isDifferentList = potentialTarget.parentElement !== draggedElement.parentElement;
                if (isSameTeam && isDifferentList) {
                    // It's a valid swap target
                    currentDropTarget = potentialTarget;
                    currentDropTarget.classList.add('drop-target');
                }
                else if (isSameTeam && !isDifferentList) {
                    // It's a reorder within the same list
                    const container = draggedElement.parentElement;
                    const afterElement = getDragAfterElement(container, y);
                    if (afterElement === null) {
                        container.appendChild(draggedElement);
                    }
                    else {
                        container.insertBefore(draggedElement, afterElement);
                    }
                }
            }
        }
        function handleDragEnd() {
            if (ghostElement) {
                ghostElement.remove();
                ghostElement = null;
            }
            if (!draggedElement)
                return;
            const teamKey = (draggedElement.querySelector('[data-team]') as HTMLElement).dataset.team as 'a' | 'b';
            if (currentDropTarget) {
                // --- SWAP LOGIC ---
                // Swap the DOM nodes
                const parent1 = draggedElement.parentNode;
                const parent2 = currentDropTarget.parentNode;
                const next1 = draggedElement.nextSibling;
                const next2 = currentDropTarget.nextSibling;
                parent1.insertBefore(currentDropTarget, next1);
                parent2.insertBefore(draggedElement, next2);
                resyncRosterAfterSwap(draggedElement, currentDropTarget, teamKey);
                currentDropTarget.classList.remove('drop-target');
            }
            else {
                // --- REORDER LOGIC ---
                const container = draggedElement.parentElement;
                if (container.id.includes('-lineup')) {
                    updateLineupOrderNumbers(container);
                }
            }
            // --- CLEANUP ---
            draggedElement.classList.remove('dragging');
            draggedElement = null;
            currentDropTarget = null;
            (window as any).__scheduleAutoApply && (window as any).__scheduleAutoApply();
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchend', handleDragEnd);
        }
        function resyncRosterAfterSwap(player1: HTMLElement, player2: HTMLElement, teamKey: 'a' | 'b') {
            // 換上場的人直接沿用先發的守位，下場的人守位清空
            const wasBench1 = player1.classList.contains('bench-player');
            const incoming = wasBench1 ? player1 : player2;
            const outgoing = wasBench1 ? player2 : player1;
            const inSel = incoming.querySelector('select[data-type="pos"]') as HTMLSelectElement | null;
            const outSel = outgoing.querySelector('select[data-type="pos"]') as HTMLSelectElement | null;
            if (inSel && outSel && inSel.value === '' ) {
                inSel.value = outSel.value;
                outSel.value = '';
            }
            // Toggle the bench class for both players
            player1.classList.toggle('bench-player');
            player2.classList.toggle('bench-player');
            // Update the order numbers for the entire team's lineup and bench
            const lineupContainer = document.getElementById(`team-${teamKey}-lineup`);
            const benchContainer = document.getElementById(`team-${teamKey}-bench`);
            if (lineupContainer)
                updateLineupOrderNumbers(lineupContainer);
            if (benchContainer)
                updateLineupOrderNumbers(benchContainer);
        }
        function updateLineupOrderNumbers(container: HTMLElement) {
            const isBench = container.id.includes('-bench');
            const players = container.querySelectorAll('.lineup-player');
            players.forEach((player, index) => {
                const orderSpan = player.querySelector('.player-order-span') as HTMLSpanElement;
                if (orderSpan) {
                    orderSpan.textContent = isBench ? '' : String(index + 1);
                }
            });
        }
        function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
            const draggableElements = [...container.querySelectorAll('.lineup-player:not(.dragging)')] as HTMLElement[];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                }
                else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY, element: null as (HTMLElement | null) }).element;
        }
        (window as any).__imageUtils = { shrinkImage };
        (window as any).__resyncRosterAfterSwap = resyncRosterAfterSwap;   // 供測試
        lineupForm.addEventListener('mousedown', handleDragStart);
        lineupForm.addEventListener('touchstart', handleDragStart, { passive: false });
    }
    function updateLayout() {
        if (window.matchMedia('(max-width: 768px), (orientation: portrait)').matches) {
            // Mobile view: ensure the current panel is transformed into view
            navigateToPanel(currentPanelIndex);
        }
        else {
            // Desktop view: clear any transform/transition styles to restore the grid layout
            appContainer.style.transform = '';
            appContainer.style.transition = '';
        }
    }
    function navigateToPanel(index) {
        if (index < 0 || index > 2)
            return;
        currentPanelIndex = index;
        appContainer.style.transition = 'transform 0.3s ease-in-out';
        const offset = -index * 100;
        appContainer.style.transform = `translateX(${offset}vw)`;
        mobileNav.querySelectorAll('.nav-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    function handlePanelDragStart(e) {
        // Only allow dragging in mobile layout
        if (!window.matchMedia('(max-width: 768px), (orientation: portrait)').matches)
            return;
        const target = e.target as HTMLElement;
        // Allow dragging unless on an interactive element
        if (target.closest('button, input, select, a, .drag-handle, .lineup-player.bench-player'))
            return;
        // 成績表、戰況表可以橫向捲動：手指放在表格上時交給原生捲動，不切換面板
        const hScroll = target.closest('#pane-team-a, #pane-team-b, #pane-situation, .table-scroll') as HTMLElement | null;
        if (hScroll && hScroll.scrollWidth > hScroll.clientWidth + 2)
            return;
        dragIsMouseEvent = e.type === 'mousedown';
        const isTouchEvent = e.type === 'touchstart';
        panelDragStartX = isTouchEvent ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        panelDragStartY = isTouchEvent ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        isPanelDragging = true;
        isSwipeConfirmed = false; // Reset on new drag
        panelDragDeltaX = 0;
        appContainer.style.transition = 'none'; // Disable animation during drag
        if (isTouchEvent) {
            document.addEventListener('touchmove', handlePanelDragMove, { passive: false });
            document.addEventListener('touchend', handlePanelDragEnd);
        }
        else { // mousedown
            e.preventDefault(); // Prevent text selection
            document.addEventListener('mousemove', handlePanelDragMove);
            document.addEventListener('mouseup', handlePanelDragEnd);
        }
    }
    function handlePanelDragMove(e) {
        if (!isPanelDragging)
            return;
        const isTouchEvent = e.type === 'touchmove';
        const currentX = isTouchEvent ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        panelDragDeltaX = currentX - panelDragStartX;
        // For touch events, determine if it's a scroll or a swipe
        if (isTouchEvent && !isSwipeConfirmed) {
            const currentY = (e as TouchEvent).touches[0].clientY;
            const panelDragDeltaY = currentY - panelDragStartY;
            // Use a small threshold to decide
            if (Math.abs(panelDragDeltaX) > 5 || Math.abs(panelDragDeltaY) > 5) {
                if (Math.abs(panelDragDeltaY) > Math.abs(panelDragDeltaX)) {
                    // Vertical movement is dominant, so it's a scroll. Abort swipe.
                    handlePanelDragEnd();
                    return;
                }
                else {
                    // Horizontal movement is dominant. Confirm it's a swipe.
                    isSwipeConfirmed = true;
                }
            }
            else {
                // Not enough movement to decide, wait for the next move event.
                return;
            }
        }
        // For confirmed swipes or mouse drags, prevent default browser actions
        if (e.cancelable) {
            e.preventDefault();
        }
        // Provide visual feedback during drag
        const baseOffset = -currentPanelIndex * window.innerWidth;
        appContainer.style.transform = `translateX(${baseOffset + panelDragDeltaX}px)`;
    }
    function handlePanelDragEnd() {
        if (!isPanelDragging)
            return;
        const wasDragging = isPanelDragging;
        isPanelDragging = false;
        // Clean up listeners
        document.removeEventListener('mousemove', handlePanelDragMove);
        document.removeEventListener('mouseup', handlePanelDragEnd);
        document.removeEventListener('touchmove', handlePanelDragMove);
        document.removeEventListener('touchend', handlePanelDragEnd);
        // Only apply swipe logic if it was a confirmed swipe or a mouse drag
        if (wasDragging && (isSwipeConfirmed || dragIsMouseEvent)) {
            const swipeThreshold = 50;
            if (Math.abs(panelDragDeltaX) > swipeThreshold) {
                if (panelDragDeltaX > 0) { // Swipe right
                    navigateToPanel(Math.max(0, currentPanelIndex - 1));
                }
                else { // Swipe left
                    navigateToPanel(Math.min(2, currentPanelIndex + 1));
                }
            }
            else {
                // Not a strong enough swipe, snap back
                navigateToPanel(currentPanelIndex);
            }
        }
        else if (wasDragging) {
            // If drag started but wasn't a swipe (e.g., vertical scroll attempt), just snap back.
            navigateToPanel(currentPanelIndex);
        }
    }
    function saveState() {
        localStorage.setItem('baseballGameState', JSON.stringify(gameState));
    }
    function loadState() {
        const savedState = localStorage.getItem('baseballGameState');
        gameStateHistory = [];
        if (savedState) {
            const loaded = JSON.parse(savedState);
            if (!loaded.teams?.a?.roster || loaded.teams.a.roster.length < ROSTER_SIZE) {
                console.warn('Game state version mismatch or corrupted. Starting a new game.');
                gameState = getInitialGameState();
                return;
            }
            gameState = loaded;
            // Migration for older states that don't have the new structure
            if (gameState.bases.length > 0 && (typeof gameState.bases[0] === 'string' || gameState.bases[0] === null)) {
                gameState.bases = gameState.bases.map(runnerId => runnerId ? { runnerId: runnerId as string, isUnearned: false } : null);
            }
            if (gameState.inningPotentialOuts === undefined) {
                gameState.inningPotentialOuts = 0;
            }
            if (gameState.isGameOver === undefined) {
                gameState.isGameOver = false;
            }
            if (gameState.stadium === undefined) {
                gameState.stadium = '';
            }
            if (gameState.gameDate === undefined) {
                gameState.gameDate = new Date().toISOString().split('T')[0];
            }
            if (gameState.weather === undefined) {
                gameState.weather = 'sunny';
            }
             ['a', 'b'].forEach(teamKey => {
                if (gameState.teams[teamKey].useDH === undefined) {
                    gameState.teams[teamKey].useDH = true;
                }
            });
        }
        else {
            gameState = getInitialGameState();
        }
    }
    function saveLineup() {
        // 照片只存在畫面的預覽 <img> 上（讀取名單只會改預覽），
        // 這裡一併寫回 gameState，否則套用後重繪會用預設圖蓋掉剛載入的照片。
        const syncPhoto = (teamKey: string, index: number, player: any) => {
            const preview = document.getElementById(`player-photo-preview-${teamKey}-${index}`) as HTMLImageElement | null;
            if (!preview) return;
            const src = preview.getAttribute('src') || '';
            if (!src.startsWith('data:')) return;
            player.photo = isGeneratedAvatar(src) ? DEFAULT_PLAYER_PHOTO_BASE64 : src;
        };
        // This function now ONLY updates player data and team settings,
        // it does not reset the game state, preserving all stats.
        ['a', 'b'].forEach(teamKey => {
            const team = gameState.teams[teamKey];
            team.name = (document.getElementById(`team-${teamKey}-name`) as HTMLInputElement).value.slice(0, TEAM_NAME_MAX);
            team.color = (document.getElementById(`team-${teamKey}-color`) as HTMLInputElement).value;
            team.useDH = (document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement).checked;

            const newActiveLineupPlayerIds = new Set<string>();
            let pitcherFoundInLineup = null;

            if (team.useDH) {
                const pitcherNameInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement;
                const pitcherJerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement;

                const pitcherPlayer = team.roster[PITCHER_ROSTER_INDEX];
                pitcherPlayer.name = pitcherNameInput.value || '先發投手';
                pitcherPlayer.jersey = pitcherJerseyInput.value;
                pitcherPlayer.pos = 'P';
                syncPhoto(teamKey, PITCHER_ROSTER_INDEX, pitcherPlayer);
                
                const pitcherStats = team.pitchers.find(p => p._id === pitcherPlayer._id);
                if (pitcherStats) {
                    pitcherStats.name = pitcherPlayer.name;
                }
                
                team.activePitcherId = pitcherPlayer._id;
                newActiveLineupPlayerIds.add(pitcherPlayer._id);
            }

            let lineupPitcherId = null;
            let pitcherCount = 0;

            const gameStartedNow = gameState.inning > 1 || gameState.outs > 0 || gameState.events.length > 0;
            for (let i = 0; i < LINEUP_SIZE; i++) {
                const name = (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement).value;
                const jersey = (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement).value;
                const pos = (document.querySelector(`select[data-team="${teamKey}"][data-index="${i}"][data-type="pos"]`) as HTMLSelectElement).value;

                const player = team.roster[i];
                player.name = name || `第${i + 1}棒`;
                player.jersey = jersey;
                player.pos = pos;
                syncPhoto(teamKey, i, player);
                
                newActiveLineupPlayerIds.add(player._id);
                // 開賽後打序格由「球員調度」維護（含替補歷史），名單頁只改名字背號守位，不可重建
                if (!gameStartedNow || !team.lineupSpots[i] || team.lineupSpots[i].history.length === 0) {
                    team.lineupSpots[i] = { order: i + 1, activePlayerId: player._id, history: [player._id] };
                }

                if (!team.useDH && pos === 'P') {
                    pitcherCount++;
                    lineupPitcherId = player._id;
                }
            }

            if (!team.useDH) {
                if (pitcherCount === 0) {
                    alert(`${team.name} 的打線中沒有指定投手(P)，請修正後再套用。`);
                    return;
                }
                if (pitcherCount > 1) {
                    alert(`${team.name} 的打線中指定了超過一位投手(P)，請修正後再套用。`);
                    return;
                }
                team.activePitcherId = lineupPitcherId;
                const pitcherStats = team.pitchers.find(p => p._id === lineupPitcherId);
                const pitcherPlayer = team.roster.find(p => p._id === lineupPitcherId);
                if (pitcherStats) {
                    pitcherStats.name = pitcherPlayer.name;
                } else if(pitcherPlayer) {
                     team.pitchers.push({
                        _id: pitcherPlayer._id, name: pitcherPlayer.name, outsRecorded: 0, h: 0, r: 0, er: 0,
                        bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0,
                    });
                }
            }
            
            // Update bench players
            for (let i = 0; i < BENCH_SIZE; i++) {
                const playerIndex = i + LINEUP_SIZE;
                 // Skip the dedicated pitcher slot if they are not in the lineup
                if(playerIndex === PITCHER_ROSTER_INDEX && team.useDH) continue;
                
                const nameInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${playerIndex}"][data-type="name"]`) as HTMLInputElement;
                 if(nameInput) {
                    const name = nameInput.value;
                    const jersey = (document.querySelector(`input[data-team="${teamKey}"][data-index="${playerIndex}"][data-type="jersey"]`) as HTMLInputElement).value;
                    const player = team.roster[playerIndex];
                    player.name = name;          // 板凳允許空白，空白代表沒有這個人
                    player.jersey = jersey;
                    syncPhoto(teamKey, playerIndex, player);
                    // Clear position if they are on bench
                    if (!newActiveLineupPlayerIds.has(player._id)) {
                         player.pos = '';
                    }
                 }
            }
        });

        // Reset game state ONLY if it's a completely new game setup, otherwise preserve it.
        // Based on user feedback, this path should be taken very cautiously.
        // We will only reset if the game hasn't started AT ALL.
        const isGameStarted = gameState.inning > 1 || gameState.outs > 0 || gameState.events.length > 0;
        if (!isGameStarted) {
             const initialGame = getInitialGameState();
            gameState.inning = 1;
            gameState.isTop = true;
            gameState.outs = 0;
            gameState.bases = [null, null, null];
            gameState.currentBatterIndex = { a: 0, b: 0 };
            gameState.events = [];
            gameState.inningPotentialOuts = 0;
            gameState.isGameOver = false;
            ['a', 'b'].forEach(teamKey => {
                gameState.teams[teamKey].score = [];
                gameState.teams[teamKey].hits = 0;
                gameState.teams[teamKey].errors = 0;
                gameState.teams[teamKey].roster.forEach(player => {
                    const defaultPlayer = initialGame.teams[teamKey].roster[0];
                    Object.keys(defaultPlayer).forEach(key => {
                        if (['name', 'jersey', 'pos', '_id', 'photo'].indexOf(key) === -1) {
                            // 陣列／物件必須各自複製一份：直接指派會讓所有球員共用同一個
                            // abResults，造成「下一棒繼承上一棒的本場成績」
                            const v = defaultPlayer[key];
                            player[key] = Array.isArray(v) ? [...v]
                                        : (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v))
                                        : v;
                        }
                    });
                });
                 const activePitcher = gameState.teams[teamKey].roster.find(p => p._id === gameState.teams[teamKey].activePitcherId);
                gameState.teams[teamKey].pitchers = [{
                        _id: activePitcher._id, name: activePitcher.name, outsRecorded: 0, h: 0, r: 0, er: 0,
                        bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0
                    }];
            });
        }
    }
    function render() {
        applyTeamColors();
        renderHeaderInputs();
        renderScoreboard();
        renderPanelTabLabels();
        renderGameStateDisplay();
        renderEventLog();
        renderActivePanelTab();
        renderLineupInputs();
        // 鎖住時要講原因，不然使用者只會覺得「怎麼按不動」
        const noRunner = !gameState.bases.some(runner => runner !== null);
        runnerActionBtn.disabled = noRunner || gameState.isGameOver;
        runnerActionBtn.textContent = runnerActionBtn.disabled && noRunner && !gameState.isGameOver
            ? '壘間事件（壘上無人）' : '壘間事件';
        runnerActionBtn.title = runnerActionBtn.disabled
            ? (gameState.isGameOver ? '比賽已結束' : '壘上沒有跑者，沒有壘間事件可記')
            : '';
        undoBtn.disabled = gameStateHistory.length === 0;
        managementBtn.disabled = gameState.isGameOver;
        if (gameState.isGameOver) {
            playBallBtn.innerHTML = '<span class="pb-main">比賽結束</span><span class="pb-sub">GAME OVER</span>';
            playBallBtn.classList.add('disabled');
            playBallBtn.classList.remove('hidden');
        }
        else if (gameState.started) {
            // 開賽後字樣消失，球場直接可點
            playBallBtn.classList.add('hidden');
        }
        else {
            playBallBtn.innerHTML = '<span class="pb-main">PLAY BALL</span><span class="pb-sub">點此開始比賽並開始計時</span>';
            playBallBtn.classList.remove('disabled', 'hidden');
        }
        renderGameClock();
        // 開賽前：球場壓暗、PLAY BALL 突顯
        const gsd = document.getElementById('game-state-display');
        if (gsd) gsd.classList.toggle('pregame', !gameState.started && !gameState.isGameOver);
        // 壘包狀態畫在球場圖上：有人時顯示半身人像並標上姓名
        const runnerTeamKey = gameState.isTop ? 'a' : 'b';
        ['mf-first', 'mf-second', 'mf-third'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            const runner = gameState.bases[i];
            el.classList.toggle('occupied', !!runner);
            const label = el.querySelector('.mf-runner-name');
            if (label) {
                const player = runner ? getPlayerById(runnerTeamKey, runner.runnerId) : null;
                label.textContent = player ? player.name : '';
            }
        });
        const field = document.getElementById('main-field');
        if (field) field.classList.toggle('live', !!gameState.started && !gameState.isGameOver);
    }
    function applyTeamColors() {
        document.documentElement.style.setProperty('--team-a-color', gameState.teams.a.color);
        document.documentElement.style.setProperty('--team-b-color', gameState.teams.b.color);
    }
    function renderHeaderInputs() {
        stadiumInput.value = gameState.stadium || '';
        gameDateInput.value = gameState.gameDate || new Date().toISOString().split('T')[0];
        if (weatherInput)
            weatherInput.value = gameState.weather || 'sunny';
    }
    function renderScoreboard() {
        const headerRow = document.getElementById('scoreboard-header-row');
        const tbody = document.getElementById('scoreboard-body');
        const numInnings = Math.max(9, gameState.inning);
        // 目前進行中的局（用於高亮，取代原本的格線提示）
        const activeInning = gameState.isGameOver ? -1 : gameState.inning;
        headerRow.innerHTML = `<th class="team-col"></th>${Array.from({ length: numInnings }, (_, i) => `<th class="${i + 1 === activeInning ? 'inning-now' : ''}">${i + 1}</th>`).join('')}<th class="rhe rhe-first">R</th><th class="rhe">H</th><th class="rhe">E</th>`;
        tbody.innerHTML = ['a', 'b'].map(teamKey => {
            const team = gameState.teams[teamKey];
            const totalRuns = team.score.reduce((a, b) => a + (b || 0), 0);
            let scoreCells = '';
            for (let i = 0; i < numInnings; i++) {
                const score = team.score[i];
                const hasPlayed = gameState.inning > i + 1 || (gameState.inning === i + 1 && (teamKey === 'a' || !gameState.isTop));
                const nowCls = (i + 1 === activeInning) ? ' class="inning-now"' : '';
                if (score != null) {
                    scoreCells += `<td${nowCls}>${score}</td>`;
                }
                else if (hasPlayed) {
                    scoreCells += `<td${nowCls}>0</td>`;
                }
                else {
                    scoreCells += `<td${nowCls}></td>`;
                }
            }
            const teamLogoHTML = `<img src="${team.logo || DEFAULT_TEAM_LOGO_BASE64}" alt="${team.name}" class="scoreboard-team-logo">`;
            const shortName = (team.name || '').slice(0, TEAM_NAME_MAX);
            const teamCellContent = `<div class="scoreboard-team-cell">${teamLogoHTML}<span>${shortName}</span></div>`;
            return `<tr><td class="team-col">${teamCellContent}</td>${scoreCells}<td class="rhe rhe-first total-col">${totalRuns}</td><td class="rhe">${team.hits}</td><td class="rhe">${team.errors}</td></tr>`;
        }).join('');
        // 比分不再另闢一列，直接由計分板的 R 欄呈現；領先方加重
        const runsA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const runsB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        const totalCells = tbody.querySelectorAll('td.total-col');
        totalCells[0]?.classList.toggle('leading', runsA > runsB);
        totalCells[1]?.classList.toggle('leading', runsB > runsA);
    }
    // ===== 比賽計時 =====
    let gameClockTimer: any = null;
    function formatElapsed(ms: number) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
        const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }
    function renderGameClock() {
        const el = document.getElementById('game-clock');
        if (!el) return;
        if (!gameState.started || !gameState.startTime) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        const end = gameState.endTime || gameState.pausedAt || Date.now();
        el.textContent = formatElapsed(end - gameState.startTime - (gameState.pausedMs || 0));
        el.classList.toggle('stopped', !!gameState.endTime);
        el.classList.toggle('paused', !gameState.endTime && !!gameState.pausedAt);
    }
    function startGameClock() {
        if (gameClockTimer) clearInterval(gameClockTimer);
        renderGameClock();
        gameClockTimer = setInterval(renderGameClock, 1000);
    }
    // 計時控制：點一下計時器叫出「暫停／繼續」與「結束計時」
    function toggleClockPause() {
        if (gameState.endTime) return;
        if (gameState.pausedAt) {
            gameState.pausedMs = (gameState.pausedMs || 0) + (Date.now() - gameState.pausedAt);
            gameState.pausedAt = null;
        }
        else {
            gameState.pausedAt = Date.now();
        }
        renderGameClock();
        saveState();
    }
    function stopClock() {
        if (gameState.endTime) return;
        // 暫停中按結束，時間就停在暫停的那一刻
        gameState.endTime = gameState.pausedAt || Date.now();
        gameState.pausedAt = null;
        renderGameClock();
        saveState();
    }
    function setupClockControls() {
        const clock = document.getElementById('game-clock');
        const menu = document.getElementById('clock-menu');
        const pauseBtn = document.getElementById('clock-pause-btn');
        const stopBtn = document.getElementById('clock-stop-btn');
        if (!clock || !menu || !pauseBtn || !stopBtn) return;
        const closeMenu = () => menu.classList.add('modal-hidden');
        clock.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (gameState.endTime) return;              // 已結束就沒得調整
            pauseBtn.textContent = gameState.pausedAt ? '繼續計時' : '暫停計時';
            menu.classList.toggle('modal-hidden');
        });
        pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleClockPause(); closeMenu(); });
        stopBtn.addEventListener('click', (e) => { e.stopPropagation(); stopClock(); closeMenu(); });
        document.addEventListener('click', closeMenu);
    }
    (window as any).__toggleClockPause = toggleClockPause;   // 供測試
    (window as any).__stopClock = stopClock;                 // 供測試
    (window as any).__formatElapsed = formatElapsed;   // 供測試
    function renderGameStateDisplay() {
        const { inning, isTop, outs } = gameState;
        // 比賽結束就顯示「終場」，取代原本大比分列上的狀態字
        (document.getElementById('inning-display')).textContent =
            gameState.isGameOver ? '終場' : `${inning}局${isTop ? '上' : '下'}`;
        const batterDisplayContainer = document.getElementById('current-batter-display');
        batterDisplayContainer.innerHTML = ''; // Clear previous content
        const batter = getCurrentBatter();
        if (batter) {
            const teamKey = isTop ? 'a' : 'b';
            const team = gameState.teams[teamKey];
            const batterIndex = gameState.currentBatterIndex[teamKey];
            const photoContainer = document.createElement('div');
            photoContainer.innerHTML = `<img src="${playerPhotoSrc(batter)}" class="batter-photo-main" alt="${batter.name}">`;
            const infoTextEl = document.createElement('div');
            infoTextEl.id = 'batter-info-text';
            const mainInfoEl = document.createElement('div');
            mainInfoEl.id = 'batter-main-info';
            const lastAbEl = document.createElement('div');
            lastAbEl.id = 'batter-last-ab';
            infoTextEl.append(mainInfoEl, lastAbEl);
            batterDisplayContainer.append(photoContainer, infoTextEl);
            mainInfoEl.style.setProperty('--team-accent', team.color);
            const calculateStatString = (value) => {
                if (isNaN(value) || !isFinite(value))
                    return '.000';
                const fixed = value.toFixed(3);
                return (value < 1) ? fixed.substring(1) : fixed;
            };
            const avg = batter.ab > 0 ? (batter.h / batter.ab) : 0;
            const slg = batter.ab > 0 ? (batter.tb / batter.ab) : 0;
            // 分層排版：姓名最大，隊伍與棒次為次要，數據做成小方塊，
            // 本場打席結果獨立一行以標籤呈現
            const results = (batter.abResults || []).map(raw => {
                const res = String(raw).split('#')[0];     // 去掉局數標記
                const [name, dir] = res.split('@');
                const label = PLAY_ABBREVIATIONS[name] || name;
                return dir ? `${label}${dir}` : label;
            });
            mainInfoEl.innerHTML = `
                <div class="batter-name-row">
                    <span class="batter-order">${batterIndex + 1}棒</span>
                    <span class="batter-name">${batter.name || '未命名'}</span>
                </div>
                <div class="batter-team-name">${team.name}</div>
                <div class="batter-stats">
                    <span class="stat"><b>${batter.ab}</b><i>打數</i></span>
                    <span class="stat"><b>${batter.h}</b><i>安打</i></span>
                    <span class="stat"><b>${batter.rbi}</b><i>打點</i></span>
                    <span class="stat"><b>${calculateStatString(avg)}</b><i>打擊率</i></span>
                    <span class="stat"><b>${calculateStatString(slg)}</b><i>長打率</i></span>
                </div>`;
            lastAbEl.innerHTML = results.length
                ? `<span class="last-ab-label">本場</span>${results.map(r => `<span class="ab-chip">${r}</span>`).join('')}`
                : `<span class="last-ab-label">本場</span><span class="ab-chip ab-chip-empty">尚未上場</span>`;
        }
        else {
            batterDisplayContainer.innerHTML = `<div id="batter-info-text"><div id="batter-main-info">請設定打序</div><div id="batter-last-ab"></div></div>`;
        }
        renderNextBatters();
        document.querySelectorAll('#sbo-display .sbo-row:nth-child(1) .sbo-light').forEach((l, i) => l.classList.toggle('o-on', i < outs));
        // 壘包已改畫在球場 SVG 上（mf-first/second/third），由 render 統一更新
        playBallBtn.classList.remove('hidden');
    }
    // === 右側面板分頁（即時事件 / 打擊 / 投手）===
    let activePanelTab = 'log';
    function setPanelTab(tab) {
        activePanelTab = tab;
        document.querySelectorAll('#panel-tabs .panel-tab').forEach(btn => {
            btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab);
        });
        ['log', 'situation', 'team-a', 'team-b'].forEach(name => {
            const pane = document.getElementById(`pane-${name}`);
            if (pane) pane.classList.toggle('panel-pane-hidden', name !== tab);
        });
        renderActivePanelTab();
    }
    // 只重繪目前顯示的分頁，避免每次打席都重算兩張大表
    function renderActivePanelTab() {
        // 同一隊的打擊與投球成績放同一頁，兩隊各一個分頁
        if (activePanelTab === 'team-a') renderBoxScore('pane-team-a', 'all', 'a');
        else if (activePanelTab === 'team-b') renderBoxScore('pane-team-b', 'all', 'b');
        else if (activePanelTab === 'situation') renderSituationTable('pane-situation');
    }
    // 分頁標籤直接用隊名，才看得出是哪一隊
    function renderPanelTabLabels() {
        const label = (tab: string, name: string, fallback: string) => {
            const btn = document.querySelector(`#panel-tabs .panel-tab[data-tab="${tab}"]`);
            if (btn) btn.textContent = (name || '').trim() || fallback;
        };
        label('team-a', gameState.teams.a.name, '客隊');
        label('team-b', gameState.teams.b.name, '主隊');
    }
    // 打席結果 → 戰況表用的兩三字縮寫（左飛、游滾、一安…）
    function situationLabel(raw: string) {
        const res = String(raw).split('#')[0];
        let [name, dir] = res.split('@');
        let bt = '';
        const m = /~([LF])$/.exec(dir || name);
        if (m) { bt = m[1]; if (dir) dir = dir.replace(/~[LF]$/, ''); else name = name.replace(/~[LF]$/, ''); }
        const first = dir ? dir[0] : '';
        switch (name) {
            case '滾地': return first ? `${first}滾` : '滾地';
            case '飛球': return first ? `${first}飛` : '飛球';
            case '界飛': return '界飛';
            case '犧飛': return '犧飛';
            case '犧短': return '犧短';
            case '雙殺': return bt ? `${first}${bt === 'L' ? '平' : '飛'}雙殺` : '雙殺';
            case '三殺': return '三殺';
            case '失誤': return first ? `${first}失` : '失誤';
            case '野手選擇': return '野選';
            case '觸身球': return '觸身';
            case '故意四壞': return '故四';
            default: return PLAY_ABBREVIATIONS[name] || name;
        }
    }
    (window as any).__situationLabel = situationLabel;   // 供測試
    function renderSituationTable(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        const innings = Math.max(9, gameState.inning);
        const avgStr = (h: number, ab: number) => ab > 0 ? (h / ab).toFixed(3) : '0.000';
        (['a', 'b'] as const).forEach(teamKey => {
            const team = gameState.teams[teamKey];
            const table = document.createElement('table');
            table.className = 'situation-table';
            const inningHeads = Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join('');
            table.innerHTML = `
                <thead><tr>
                    <th class="sit-name">${team.name}</th>${inningHeads}
                    <th>打數</th><th>安打</th><th>全壘打</th><th>打點</th><th>得分</th><th>打擊率</th>
                </tr></thead>`;
            const tbody = document.createElement('tbody');
            const totals = { ab: 0, h: 0, hr: 0, rbi: 0, r: 0 };
            team.lineupSpots.forEach((spot, index) => {
                spot.history.forEach((playerId, hi) => {
                    const player = team.roster.find(p => p._id === playerId);
                    if (!player) return;
                    const isSub = hi > 0;
                    const cells = Array.from({ length: innings }, () => [] as string[]);
                    (player.abResults || []).forEach(raw => {
                        const inn = Number(String(raw).split('#')[1] || 0);
                        if (inn >= 1 && inn <= innings) cells[inn - 1].push(situationLabel(raw));
                    });
                    // 球員列的寫法與打擊成績表一致：棒次. 姓名 守位／替補用 ↳ 姓名 (PH)
                    const subLabel = isSub ? (((spot as any).subInfo || {})[playerId] || player.pos || '') : '';
                    const posTag = isSub
                        ? (subLabel ? ` <em class="box-pos">(${subLabel})</em>` : '')
                        : (player.pos ? ` <em class="box-pos">${player.pos}</em>` : '');
                    const playerLabel = isSub
                        ? `&nbsp;&nbsp;↳ ${player.name}${posTag}`
                        : `${index + 1}. ${player.name}${posTag}`;
                    const tr = document.createElement('tr');
                    if (isSub) tr.classList.add('substitute-row');
                    tr.innerHTML = `
                        <td class="sit-name"><div class="box-score-player-cell"><span>${playerLabel}</span></div></td>
                        ${cells.map(c => `<td>${c.join('<br>')}</td>`).join('')}
                        <td>${player.ab}</td><td>${player.h}</td><td>${player.hr}</td><td>${player.rbi}</td><td>${player.r}</td>
                        <td>${avgStr(player.h, player.ab)}</td>`;
                    tbody.appendChild(tr);
                    totals.ab += player.ab; totals.h += player.h; totals.hr += player.hr; totals.rbi += player.rbi; totals.r += player.r;
                });
            });
            table.appendChild(tbody);
            const tfoot = document.createElement('tfoot');
            tfoot.innerHTML = `<tr class="total-row"><td class="sit-name">Total</td>${'<td></td>'.repeat(innings)}
                <td>${totals.ab}</td><td>${totals.h}</td><td>${totals.hr}</td><td>${totals.rbi}</td><td>${totals.r}</td><td></td></tr>`;
            table.appendChild(tfoot);
            const wrap = document.createElement('div');
            wrap.className = 'table-scroll';
            wrap.appendChild(table);
            container.appendChild(wrap);
        });
    }
    // 壘包小圖示：左下三壘、上二壘、右下一壘；有人黃色、沒人灰色。下方兩顆出局燈。
    function situationIcon(bases: boolean[] = [false, false, false], outs = 0) {
        const sq = (cx: number, cy: number, on: boolean) =>
            `<rect x="${cx - 4.2}" y="${cy - 4.2}" width="8.4" height="8.4" rx="1" transform="rotate(45 ${cx} ${cy})" class="${on ? 'on' : ''}"/>`;
        return `<span class="ev-sit" aria-label="壘上：${['一', '二', '三'].filter((_, i) => bases[i]).join('、') || '無人'}，${outs}出局">
            <svg viewBox="0 0 30 22" width="30" height="22">${sq(6, 15, !!bases[2])}${sq(15, 6, !!bases[1])}${sq(24, 15, !!bases[0])}</svg>
            <span class="ev-outs">${[0, 1].map(i => `<i class="${i < outs ? 'on' : ''}"></i>`).join('')}${outs >= 3 ? '<i class="on"></i>' : ''}</span>
        </span>`;
    }
    function renderEventLog() {
        const log = document.getElementById('event-log');
        // FIX: Renamed 'event' to 'gameEvent' to avoid conflict with the global 'Event' type.
        log.innerHTML = [...(gameState.events || [])].reverse().map(gameEvent => {
            if (!gameEvent.teamKey) return `<li class="ev-inning">${gameEvent.text}</li>`;
            const [title, ...rest] = String(gameEvent.text).split('\n');
            const body = rest.join(' ');
            const text = body
                ? `<div class="ev-title">${title}</div><div class="ev-body">${body}</div>`
                : `<div class="ev-body">${title}</div>`;
            return `<li class="event-team-${gameEvent.teamKey}">${situationIcon(gameEvent.bases, gameEvent.outs)}<div class="ev-text">${text}</div></li>`;
        }).join('');
    }
    function renderLineupInputs() {
        renderLineupInputsInner();
        ['a', 'b'].forEach(k => updateBenchVisibility(k));
        const locked = !!gameState.started && !gameState.isGameOver;
        lineupForm.classList.toggle('game-started', locked);
        const hint = document.getElementById('lineup-lock-hint');
        if (hint) hint.classList.toggle('hidden', !locked);
    }
    function renderLineupInputsInner() {
        ['a', 'b'].forEach(teamKey => {
            const team = gameState.teams[teamKey];
            // Update team-level settings
            (document.getElementById(`team-${teamKey}-name`) as HTMLInputElement).value = team.name;
            (document.getElementById(`team-${teamKey}-color`) as HTMLInputElement).value = team.color;
            (document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement).checked = team.useDH;
            (document.getElementById(`team-${teamKey}-logo-preview`) as HTMLImageElement).src = team.logo || DEFAULT_TEAM_LOGO_BASE64;
            document.getElementById(`team-${teamKey}-pitcher-container`).style.display = team.useDH ? 'block' : 'none';
            // Populate all roster player inputs
            team.roster.forEach((player, i) => {
                const nameInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement;
                const jerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement;
                const photoPreview = document.getElementById(`player-photo-preview-${teamKey}-${i}`) as HTMLImageElement;
                if (nameInput) {
                    // dirty 表示使用者改過但還沒按「套用名單」，重繪不可覆蓋，
                    // 否則上傳照片等動作觸發的重繪會把剛打的字洗掉
                    if (nameInput.dataset.dirty !== '1')
                        nameInput.value = player.name;
                    if (jerseyInput.dataset.dirty !== '1')
                        jerseyInput.value = player.jersey;
                    if (photoPreview) {
                        photoPreview.src = playerPhotoSrc(player);
                    }
                }
                if (i < LINEUP_SIZE) {
                    const posSelect = document.querySelector(`select[data-team="${teamKey}"][data-index="${i}"][data-type="pos"]`) as HTMLSelectElement;
                    if (posSelect && posSelect.dataset.dirty !== '1')
                        posSelect.value = player.pos;
                }
            });
            // Handle dedicated pitcher input specifically for DH enabled
            if (team.useDH) {
                const pitcherPlayer = team.roster[PITCHER_ROSTER_INDEX];
                const pitcherNameInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement;
                const pitcherJerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement;
                const pitcherPhotoPreview = document.getElementById(`player-photo-preview-${teamKey}-${PITCHER_ROSTER_INDEX}`) as HTMLImageElement;
                if (pitcherNameInput && pitcherNameInput.dataset.dirty !== '1')
                    pitcherNameInput.value = pitcherPlayer.name;
                if (pitcherJerseyInput && pitcherJerseyInput.dataset.dirty !== '1')
                    pitcherJerseyInput.value = pitcherPlayer.jersey;
                if (pitcherPhotoPreview)
                    pitcherPhotoPreview.src = playerPhotoSrc(pitcherPlayer);
            }
        });
    }
    // containerId：要畫到哪個容器；mode：'all' | 'batting' | 'pitching'
    // 表頭：一律中文；手機版靠左右滑動看完整張表
    const th = (long: string, _short: string) => `<th>${long}</th>`;
    function renderBoxScore(containerId = 'box-score-tables', mode = 'all', teamFilter: 'a' | 'b' | null = null) {
        const boxScoreContainer = document.getElementById(containerId);
        if (!boxScoreContainer) return;
        boxScoreContainer.innerHTML = '';
        const calculateStatString = (value) => {
            if (isNaN(value) || !isFinite(value))
                return '.000';
            const fixed = value.toFixed(3);
            return (value < 1) ? fixed.substring(1) : fixed;
        };
        const teamKeys = teamFilter ? [teamFilter] : ['a', 'b'];
        teamKeys.forEach((teamKey) => {
            const team = gameState.teams[teamKey];
            // --- Batting Table ---
            const battingTable = document.createElement('table');
            battingTable.innerHTML = `
                <thead>
                    <tr>
                        <th>${team.name} 打擊成績</th>
                        ${th('打席', 'PA')} ${th('打數', 'AB')} ${th('得分', 'R')} ${th('安打', 'H')} ${th('打點', 'RBI')} ${th('二安', '2B')} ${th('三安', '3B')}
                        ${th('全壘打', 'HR')} ${th('盜壘', 'SB')} ${th('四壞', 'BB')} ${th('觸身', 'HBP')} ${th('三振', 'K')} ${th('犧飛', 'SF')} ${th('犧短', 'SH')} ${th('雙殺打', 'GDP')}
                        ${th('打擊率', 'AVG')} ${th('上壘率', 'OBP')} ${th('OPS', 'OPS')}
                    </tr>
                </thead>
            `;
            const battingBody = document.createElement('tbody');
            const totals = { pa: 0, ab: 0, r: 0, h: 0, rbi: 0, '2b': 0, '3b': 0, hr: 0, gidp: 0, bb: 0, hbp: 0, so: 0, sf: 0, sh: 0, sb: 0, tb: 0 };
            team.lineupSpots.forEach((spot, index) => {
                spot.history.forEach((playerId, historyIndex) => {
                    const player = team.roster.find(p => p._id === playerId);
                    if (!player)
                        return;
                    const row = document.createElement('tr');
                    const isSubstitute = historyIndex > 0;
                    if (isSubstitute)
                        row.classList.add('substitute-row');
                    const avg = player.ab > 0 ? (player.h / player.ab) : 0;
                    const obp_numerator = player.h + player.bb + player.hbp;
                    const obp_denominator = player.ab + player.bb + player.hbp + player.sf;
                    const obp = obp_denominator > 0 ? (obp_numerator / obp_denominator) : 0;
                    const slg = player.ab > 0 ? (player.tb / player.ab) : 0;
                    // 守位以空格分隔並降低亮度，不用逗號
                    const subLabel = isSubstitute ? (((spot as any).subInfo || {})[playerId] || player.pos || '') : '';
                    const posTag = isSubstitute
                        ? (subLabel ? ` <em class="box-pos">(${subLabel})</em>` : '')
                        : (player.pos ? ` <em class="box-pos">${player.pos}</em>` : '');
                    const playerName = isSubstitute
                        ? `&nbsp;&nbsp;↳ ${player.name}${posTag}`
                        : `${index + 1}. ${player.name}${posTag}`;
                    // 成績表不顯示照片，把寬度留給數據
                    row.innerHTML = `
                        <td><div class="box-score-player-cell"><span>${playerName}</span></div></td>
                        <td>${player.pa}</td> <td>${player.ab}</td> <td>${player.r}</td> <td>${player.h}</td> <td>${player.rbi}</td>
                        <td>${player['2b']}</td> <td>${player['3b']}</td> <td>${player.hr}</td> <td>${player.sb}</td>
                        <td>${player.bb}</td> <td>${player.hbp}</td> <td>${player.so}</td> <td>${player.sf}</td> <td>${player.sh}</td> <td>${player.gidp}</td>
                        <td>${calculateStatString(avg)}</td>
                        <td>${calculateStatString(obp)}</td>
                        <td>${calculateStatString(obp + slg)}</td>
                    `;
                    battingBody.appendChild(row);
                });
            });
            battingTable.appendChild(battingBody);
            const tfoot = document.createElement('tfoot');
            const teamTotals = team.roster.reduce((acc, player) => {
                if (player.pos === 'P' && !team.lineupSpots.some(s => s.history.includes(player._id))) {
                    return acc;
                }
                for (const key in totals)
                    acc[key] += Number(player[key] || 0);
                return acc;
            }, { ...totals });
            const total_obp_numerator = teamTotals.h + teamTotals.bb + teamTotals.hbp;
            const total_obp_denominator = teamTotals.ab + teamTotals.bb + teamTotals.hbp + teamTotals.sf;
            const total_obp = total_obp_denominator > 0 ? (total_obp_numerator / total_obp_denominator) : 0;
            const total_slg = teamTotals.ab > 0 ? (teamTotals.tb / teamTotals.ab) : 0;
            const total_avg = teamTotals.ab > 0 ? (teamTotals.h / teamTotals.ab) : 0;
            const totalRow = document.createElement('tr');
            totalRow.classList.add('total-row');
            totalRow.innerHTML = `
                <td>合計</td>
                <td>${teamTotals.pa}</td> <td>${teamTotals.ab}</td> <td>${teamTotals.r}</td> <td>${teamTotals.h}</td> <td>${teamTotals.rbi}</td>
                <td>${teamTotals['2b']}</td> <td>${teamTotals['3b']}</td> <td>${teamTotals.hr}</td> <td>${teamTotals.sb}</td>
                <td>${teamTotals.bb}</td> <td>${teamTotals.hbp}</td> <td>${teamTotals.so}</td> <td>${teamTotals.sf}</td> <td>${teamTotals.sh}</td> <td>${teamTotals.gidp}</td>
                <td>${calculateStatString(total_avg)}</td>
                <td>${calculateStatString(total_obp)}</td>
                <td>${calculateStatString(total_obp + total_slg)}</td>
            `;
            tfoot.appendChild(totalRow);
            battingTable.appendChild(tfoot);
            if (mode !== 'pitching') {
                battingTable.classList.add('box-batting');
                boxScoreContainer.appendChild(battingTable);
            }
            // --- Pitching Table ---
            const pitchingHeader = document.createElement('h4');
            pitchingHeader.textContent = `${team.name} 投球成績`;
            if (mode !== 'batting') boxScoreContainer.appendChild(pitchingHeader);
            const pitchingTable = document.createElement('table');
            pitchingTable.innerHTML = `
            <thead>
                <tr>
                    <th>投手</th>
                    ${th('局數', 'IP')}
                    ${th('面對打席', 'BF')}
                    ${th('安打', 'H')}
                    ${th('失分', 'R')}
                    ${th('責失', 'ER')}
                    ${th('四壞', 'BB')}
                    ${th('死球', 'HBP')}
                    ${th('三振', 'K')}
                    ${th('被全壘打', 'HR')}
                    ${th('暴投', 'WP')}
                    ${th('投手犯規', 'BK')}
                    ${th('故意四壞', 'IBB')}
                    ${th('防禦率', 'ERA')}
                    ${th('WHIP', 'WHIP')}
                </tr>
            </thead>
            `;
            const pitchingBody = document.createElement('tbody');
            const pTotals = { outsRecorded: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0 };
            team.pitchers.forEach(pitcher => {
                const row = document.createElement('tr');
                const ipWhole = Math.floor(pitcher.outsRecorded / 3);
                const ipFrac = pitcher.outsRecorded % 3;
                const ip = `${ipWhole} ${ipFrac > 0 ? `<span>${ipFrac}/3</span>` : ''}`.trim();
                const era = pitcher.outsRecorded > 0 ? (pitcher.er * 9 / (pitcher.outsRecorded / 3)).toFixed(2) : '0.00';
                const whip_denominator = pitcher.outsRecorded / 3;
                const whip = whip_denominator > 0 ? ((pitcher.bb + pitcher.h) / whip_denominator).toFixed(2) : '0.00';
                row.innerHTML = `
                    <td>${pitcher.name}</td>
                    <td>${ip || '0'}</td> <td>${pitcher.bf}</td> <td>${pitcher.h}</td> <td>${pitcher.r}</td> <td>${pitcher.er}</td>
                    <td>${pitcher.bb}</td> <td>${pitcher.hbp}</td> <td>${pitcher.k}</td> <td>${pitcher.hr}</td>
                    <td>${pitcher.wp}</td> <td>${pitcher.bk}</td> <td>${pitcher.ibb}</td>
                    <td>${era}</td> <td>${whip}</td>
                `;
                pitchingBody.appendChild(row);
                for (const key in pTotals) {
                    pTotals[key] += Number(pitcher[key] || 0);
                }
            });
            pitchingTable.appendChild(pitchingBody);
            const pTfoot = document.createElement('tfoot');
            const totalIpWhole = Math.floor(pTotals.outsRecorded / 3);
            const totalIpFrac = pTotals.outsRecorded % 3;
            const totalIp = `${totalIpWhole} ${totalIpFrac > 0 ? `<span>${totalIpFrac}/3</span>` : ''}`.trim();
            const totalEra = pTotals.outsRecorded > 0 ? (pTotals.er * 9 / (pTotals.outsRecorded / 3)).toFixed(2) : '0.00';
            const totalWhip_denominator = pTotals.outsRecorded / 3;
            const totalWhip = totalWhip_denominator > 0 ? ((pTotals.bb + pTotals.h) / totalWhip_denominator).toFixed(2) : '0.00';
            const pTotalRow = document.createElement('tr');
            pTotalRow.classList.add('total-row');
            pTotalRow.innerHTML = `
                <td>合計</td>
                <td>${totalIp || '0'}</td> <td>${pTotals.bf}</td> <td>${pTotals.h}</td> <td>${pTotals.r}</td> <td>${pTotals.er}</td>
                <td>${pTotals.bb}</td> <td>${pTotals.hbp}</td> <td>${pTotals.k}</td> <td>${pTotals.hr}</td>
                <td>${pTotals.wp}</td> <td>${pTotals.bk}</td> <td>${pTotals.ibb}</td>
                <td>${totalEra}</td> <td>${totalWhip}</td>
            `;
            pTfoot.appendChild(pTotalRow);
            pitchingTable.appendChild(pTfoot);
            if (mode !== 'batting') {
                pitchingTable.classList.add('box-pitching');
                boxScoreContainer.appendChild(pitchingTable);
            }

            // Add a separator after the first team's stats
            if (teamKey === 'a' && !teamFilter) {
                const separator = document.createElement('hr');
                separator.classList.add('team-separator');
                boxScoreContainer.appendChild(separator);
            }
        });
    }
    function logEvent(text, teamKey = null) {
        const inningHeaderText = `${gameState.inning}局${gameState.isTop ? '上' : '下'}`;
        const hasInningHeader = gameState.events.some(event => event.text === inningHeaderText);
        if (!hasInningHeader) {
            gameState.events.push({ text: inningHeaderText, teamKey: null });
        }
        // 即時事件左側的小圖示：記「這名打者上場打擊時」（事件發生前）的壘況與出局數
        const snap = pendingSituation || { bases: gameState.bases.map(b => !!b), outs: Math.min(3, gameState.outs) };
        pendingSituation = null;
        gameState.events.push({ text, teamKey, bases: snap.bases, outs: snap.outs });
    }
    // 在打席／壘間事件開始處理前先拍下當時的壘況，logEvent 會用掉它
    let pendingSituation: { bases: boolean[]; outs: number } | null = null;
    function snapshotSituation() {
        pendingSituation = { bases: gameState.bases.map(b => !!b), outs: Math.min(3, gameState.outs) };
    }
    function batterTitle(batter, orderIndex: number) {
        const pos = (batter && batter.pos) ? batter.pos : '';
        return `第${orderIndex + 1}棒${pos ? ' ' + pos : ''} ${batter ? batter.name : ''}`;
    }
    function getPlayerById(teamKey, playerId) {
        return gameState.teams[teamKey]?.roster.find(p => p._id === playerId) || null;
    }
    // 保證球員的統計陣列不與別人共用（若被共用，複製一份自己的）
    function ensureOwnStatArrays(player) {
        if (!player) return;
        if (!Array.isArray(player.abResults)) { player.abResults = []; return; }
        (['a', 'b'] as const).forEach(k => {
            gameState.teams[k].roster.forEach(other => {
                if (other !== player && other.abResults === player.abResults) {
                    player.abResults = [...player.abResults];
                }
            });
        });
    }
    // 打者卡旁邊的「NEXT」：接下來兩位打者的棒次與姓名
    function renderNextBatters() {
        const card = document.getElementById('next-batters');
        if (!card) return;
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const batterIndex = gameState.currentBatterIndex[teamKey];
        const items = card.querySelectorAll('.next-item');
        items.forEach((item, n) => {
            const i = (batterIndex + n + 1) % LINEUP_SIZE;
            const spot = team.lineupSpots[i];
            const player = spot ? getPlayerById(teamKey, spot.activePlayerId) : null;
            item.innerHTML = `<span class="next-order">${i + 1}棒</span>` +
                             `<span class="next-name">${player?.name || '—'}</span>`;
        });
    }
    function getCurrentBatter() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const batterIndex = gameState.currentBatterIndex[teamKey];
        const spot = team.lineupSpots[batterIndex];
        return spot ? getPlayerById(teamKey, spot.activePlayerId) : null;
    }
    function endGame() {
        if (gameState.isGameOver)
            return; // Prevent multiple calls
        gameState.isGameOver = true;
        if (!gameState.endTime) gameState.endTime = Date.now();
        const scoreA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        const tie = scoreA === scoreB ? '（和局）' : '';
        logEvent(`比賽結束${tie}。 終場比數 ${gameState.teams.a.name} ${scoreA} : ${scoreB} ${gameState.teams.b.name}。`);
        render();
    }
    function checkAndEndGame() {
        if (gameState.isGameOver)
            return false;
        const scoreA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        // Walk-off win (bottom 9th or later, home team takes lead, any number of outs)
        if (gameState.inning >= 9 && !gameState.isTop && scoreB > scoreA) {
            endGame();
            return true;
        }
        // Check for game end only if the half-inning is over
        if (gameState.outs < 3)
            return false;
        const isTopHalfJustEnded = gameState.isTop;
        // Home team wins because they are ahead after top of 9th or extras
        if (isTopHalfJustEnded && gameState.inning >= 9 && scoreB > scoreA) {
            endGame();
            return true;
        }
        // Visiting team wins after a full 9+ innings are played
        if (!isTopHalfJustEnded && gameState.inning >= 9 && scoreA > scoreB) {
            endGame();
            return true;
        }
        // 平手時原本會無限延長；依延長局上限判定和局結束
        if (!isTopHalfJustEnded && gameState.inning >= MAX_INNINGS && scoreA === scoreB) {
            endGame();
            return true;
        }
        return false;
    }
    function endHalfInning() {
        const currentTeamKey = gameState.isTop ? 'a' : 'b';
        if (gameState.teams[currentTeamKey].score[gameState.inning - 1] === undefined) {
            gameState.teams[currentTeamKey].score[gameState.inning - 1] = 0;
        }
        if (gameState.isTop) {
            gameState.isTop = false;
        }
        else {
            gameState.isTop = true;
            gameState.inning++;
        }
        gameState.outs = 0;
        gameState.bases = [null, null, null];
        gameState.inningPotentialOuts = 0;
    }
    function addRuns(runnersScored, rbis) {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const inningIndex = gameState.inning - 1;
        if (team.score[inningIndex] === undefined) {
            team.score[inningIndex] = 0;
        }
        team.score[inningIndex] += runnersScored.length;
        const batter = getCurrentBatter();
        if (batter) {
            batter.rbi += rbis;
        }
        const defendingTeamKey = gameState.isTop ? 'b' : 'a';
        const defendingTeam = gameState.teams[defendingTeamKey];
        const activePitcher = defendingTeam.pitchers.find(p => p._id === defendingTeam.activePitcherId);
        runnersScored.forEach(runner => {
            const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
            if (runnerPlayer)
                runnerPlayer.r++;
            activePitcher.r++;
            if (!runner.isUnearned && gameState.inningPotentialOuts < 3) {
                activePitcher.er++;
            }
        });
    }
    function advanceRunners(baseAdvancements, outsOnBases = 0, hitInfo: { isHit: boolean; isSH: boolean; isSF: boolean; isBB: boolean; isError?: boolean; } = { isHit: false, isSH: false, isSF: false, isBB: false }) {
        let runnersScored: BaseRunner[] = [];
        let newBases: (BaseRunner | null)[] = [null, null, null];
        const originalBases = [...gameState.bases];
        for (let i = 2; i >= 0; i--) {
            const runner = originalBases[i];
            if (runner) {
                const destination = baseAdvancements[i + 1];
                if (destination >= 4) {
                    runnersScored.push(runner);
                }
                else if (destination > 0) {
                    newBases[destination - 1] = runner;
                }
            }
        }
        const batterDestination = baseAdvancements[0];
        const batter = getCurrentBatter();
        if (batterDestination > 0 && batter) {
            const isUnearned = hitInfo.isError || (originalBases.some(r => r?.isUnearned) && batterDestination > 0);
            newBases[batterDestination - 1] = { runnerId: batter._id, isUnearned };
        }
        gameState.bases = newBases;
        return { runnersScored, outsOnBases };
    }
    function handlePlay(play) {
        saveStateForUndo();
        snapshotSituation();
        const teamKey = gameState.isTop ? 'a' : 'b';
        const batter = getCurrentBatter();
        if (!batter)
            return;
        const activePitcher = gameState.teams[gameState.isTop ? 'b' : 'a'].pitchers.find(p => p._id === gameState.teams[gameState.isTop ? 'b' : 'a'].activePitcherId);
        activePitcher.bf++;
        batter.pa++;
        // 附上局數，正式記錄表的欄位是局數而非打席序號
        ensureOwnStatArrays(batter);
        batter.abResults.push(`${play}#${gameState.inning}`);
        let outs = 0;
        let isAB = true;
        let isHit = false;
        let runnersScored: BaseRunner[] = [];
        let rbis = 0;
        switch (play) {
            case '三振':
                outs = 1;
                batter.so++;
                activePitcher.k++;
                if (gameState.outs < 2 && gameState.bases[0] === null) {
                    // Check for dropped third strike
                    const catcherCanDrop = true; // Simplified
                    if (catcherCanDrop) {
                        // This logic is simplified. A real app would need a modal for this.
                        // Assuming simple strikeout for now.
                    }
                }
                break;
            case '雙殺':
                outs = 2;
                batter.gidp++;
                break;
            case '三殺':
                outs = 3;
                break;
            case '四壞':
                isAB = false;
                batter.bb++;
                activePitcher.bb++;
                // Simple runner advance
                if (gameState.bases[0] && gameState.bases[1] && gameState.bases[2]) { // Bases loaded
                    runnersScored.push(gameState.bases[2]);
                    rbis = 1;
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else if (gameState.bases[0] && gameState.bases[1]) { // 1st and 2nd
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else if (gameState.bases[0]) { // 1st only
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else { // Bases empty
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                break;
            case '觸身球':
                isAB = false;
                batter.hbp++;
                activePitcher.hbp++;
                // Same advance logic as walk
                if (gameState.bases[0] && gameState.bases[1] && gameState.bases[2]) {
                    runnersScored.push(gameState.bases[2]);
                    rbis = 1;
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else if (gameState.bases[0] && gameState.bases[1]) {
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else if (gameState.bases[0]) {
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                else {
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false };
                }
                break;
            case '妨礙打擊':
                isAB = false;
                const defendingTeamKey = gameState.isTop ? 'b' : 'a';
                gameState.teams[defendingTeamKey].errors++;
                gameState.inningPotentialOuts++; // Catcher's interference should have been an out
                // Runner advancement logic is the same as a walk
                if (gameState.bases[0] && gameState.bases[1] && gameState.bases[2]) { // Bases loaded
                    // A run scored on Catcher's Interference is unearned.
                    runnersScored.push({ ...gameState.bases[2], isUnearned: true });
                    rbis = 1;
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    // Batter reaching on CI is also unearned.
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true };
                }
                else if (gameState.bases[0] && gameState.bases[1]) { // 1st and 2nd
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true };
                }
                else if (gameState.bases[0]) { // 1st only
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true };
                }
                else { // Bases empty
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true };
                }
                break;
            default: // Other outs
                outs = 1;
                break;
        }
        if (isAB)
            batter.ab++;
        gameState.outs += outs;
        activePitcher.outsRecorded += outs;
        gameState.inningPotentialOuts += outs;
        if (runnersScored.length > 0) {
            addRuns(runnersScored, rbis);
        }
        logEvent(`${batterTitle(batter, gameState.currentBatterIndex[teamKey])}\n${PLAY_DESCRIPTIONS[play]}。${outs > 0 ? ` ${Math.min(3, gameState.outs)}人出局。` : ''}`, teamKey);
        // Advance batter
        gameState.currentBatterIndex[teamKey] = (gameState.currentBatterIndex[teamKey] + 1) % LINEUP_SIZE;
        if (checkAndEndGame()) {
            saveState();
            render();
            return;
        }
        if (gameState.outs >= 3) {
            endHalfInning();
        }
        saveState();
        render();
    }
    // === 跑者預設推進 ===
    // 未指定去向的跑者原本會「留在原壘」，導致打者上同一壘時把跑者蓋掉。
    // 這裡依照棒球慣例先填入合理的預設值，記錄員只需要修改例外狀況。
    function applyDefaultRunnerAdvancement(play, batterIsOut) {
        const bases = advancedPlayState.originalBases;
        const setDest = (i, dest) => {
            const runner = bases[i];
            if (runner) {
                advancedPlayState.runnerDestinations[`base-${i}`] = { dest: Math.min(dest, 4), isUnearned: runner.isUnearned };
            }
        };
        const hitAdvance = { '內安': 1, '一安': 1, '二安': 2, '三安': 3 };
        if (hitAdvance[play]) {
            // 安打：所有跑者至少推進與打者相同的壘數
            const n = hitAdvance[play];
            bases.forEach((runner, i) => { if (runner) setDest(i, i + 1 + n); });
        }
        else if (!batterIsOut && ['失誤', '野手選擇', '不死三振', '妨礙打擊'].includes(play)) {
            // 打者上一壘：只推進被迫進壘的跑者
            if (bases[0]) {
                setDest(0, 2);
                if (bases[1]) {
                    setDest(1, 3);
                    if (bases[2]) setDest(2, 4);
                }
            }
        }
        else if (play === '犧短') {
            bases.forEach((runner, i) => { if (runner) setDest(i, i + 2); });
        }
        else if (play === '犧飛') {
            if (bases[2]) setDest(2, 4);
        }
        else if (play === '雙殺' || play === '三殺') {
            // 打者已出局，再把被迫進壘的跑者依序預設為出局（可自行改）
            const need = play === '雙殺' ? 1 : 2;
            const forced: number[] = [];
            for (let i = 0; i < 3; i++) {
                if (!bases[i]) break;      // 被迫進壘必須從一壘開始連續
                forced.push(i);
            }
            forced.slice(0, need).forEach(i => setDest(i, 0));
        }
        // 滾地／飛球出局：跑者預設不動，維持原行為
    }
    // === 壘包衝突偵測 ===
    // 回傳被指派到同一個壘包的人員清單，供「完成」前擋下並提示。
    function findBaseConflicts() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const occupancy = {};
        const push = (dest, name) => {
            if (dest > 0 && dest < 4) {
                if (!occupancy[dest]) occupancy[dest] = [];
                occupancy[dest].push(name);
            }
        };
        advancedPlayState.originalBases.forEach((runner, i) => {
            if (!runner) return;
            const entry = advancedPlayState.runnerDestinations[`base-${i}`];
            const dest = entry ? entry.dest : i + 1; // 未指定則視為留在原壘
            const player = getPlayerById(teamKey, runner.runnerId);
            push(dest, (player && player.name) || `${['一', '二', '三'][i]}壘跑者`);
        });
        if (!advancedPlayState.batterIsOut) {
            const batter = getCurrentBatter();
            push(advancedPlayState.batterDestination.dest, (batter && batter.name) || '打者');
        }
        return Object.keys(occupancy)
            .filter(base => occupancy[base].length > 1)
            .map(base => ({ base: Number(base), names: occupancy[base] }));
    }
    function startAdvancedPlay(play, options = { batterIsOut: false }) {
        advancedPlayState = {
            direction: null,
            directionAuto: false,
            fielders: [],
            rundown: null,
            ballType: 'G',
            errors: [],
            hitPoint: null,
            pointConfirmed: false,
            play,
            error: null,
            batterDestination: { dest: 0, isUnearned: false },
            runnerDestinations: {},
            originalBases: JSON.parse(JSON.stringify(gameState.bases)),
            step: '',
            batterIsOut: options.batterIsOut,
            outRunnerBase: null,
            obstruction: false,
        };
        const hitBases = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4 };
        if (hitBases[play]) {
            advancedPlayState.batterDestination = { dest: hitBases[play], isUnearned: false };
        }
        else if (play === '不死三振' || play === '野手選擇' || play === '妨礙打擊') {
            advancedPlayState.batterDestination = { dest: 1, isUnearned: false };
        }
        // 先填入預設推進（本壘打與各分支會在下方視需要覆寫）
        applyDefaultRunnerAdvancement(play, options.batterIsOut);
        if (play === '本打') {
            // It's a home run, auto-advance everyone to score.
            advancedPlayState.originalBases.forEach((runner, i) => {
                if (runner) {
                    const runnerKey = `base-${i}`;
                    advancedPlayState.runnerDestinations[runnerKey] = { dest: 4, isUnearned: false };
                }
            });
            advancedPlayState.step = 'set-runners'; // Go directly to the runner placement view
        }
        else if (play === '失誤') {
            advancedPlayState.step = 'select-error';
            // 靠失誤上壘，預設站上一壘；不預設的話按完成會讓打者憑空消失
            advancedPlayState.batterDestination = { dest: 1, isUnearned: true };
        }
        else if (play === '野手選擇') {
            advancedPlayState.step = 'select-fc-out';
        }
        else if (options.batterIsOut) { // Sacrifices and other outs
            advancedPlayState.step = 'set-runners';
        }
        else if (play === '妨礙打擊') {
            advancedPlayState.step = 'set-runners';
            advancedPlayState.batterDestination.isUnearned = true;
            advancedPlayState.error = 'C'; // Automatically assign error to catcher
            advancedPlayState.errors = ['C'];
        }
        else { // Hits (not HR) and Uncaught Third Strike
            // 壘上無人時「是否失誤」沒有跑者需要安排，直接跳到確認畫面，
            // 失誤仍可在確認畫面用「加上失誤」補記。
            const noRunners = advancedPlayState.originalBases.every(r => !r);
            advancedPlayState.step = noRunners ? 'set-runners' : 'ask-error';
        }
        renderAdvancedPlayOptions();
        showModalStep('advanced');
    }
    function renderAdvancedPlayOptions() {
        if (advancedPlayState.step === 'ask-error') {
            modalAdvancedTitle.textContent = '是否有失誤發生?';
            modalAdvancedOptions.innerHTML = `
                <div class="modal-options play-options">
                    <button data-step="ask-error" data-choice="yes">是，加上失誤</button>
                    <button data-step="ask-error" data-choice="no">否，繼續</button>
                </div>
            `;
        }
        else if (advancedPlayState.step === 'select-error') {
            modalAdvancedTitle.textContent = '選擇失誤位置';
            modalAdvancedOptions.innerHTML = `<div class="modal-options play-options">${Object.entries(ERROR_ABBREVIATIONS).map(([pos, abbr]) => `<button data-step="select-error" data-error-pos="${pos}">${abbr}</button>`).join('')}</div>`;
        }
        else if (advancedPlayState.step === 'select-fc-out') {
            modalAdvancedTitle.textContent = '野手選擇 - 請選擇出局的跑者';
            let optionsHTML = '';
            const teamKey = gameState.isTop ? 'a' : 'b';
            advancedPlayState.originalBases.forEach((runner, i) => {
                if (runner) {
                    const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
                    optionsHTML += `
                    <div class="runner-placement-row">
                        <div class="runner-name">${['一', '二', '三'][i]}壘跑者: ${runnerPlayer.name}</div>
                        <div class="runner-options">
                           <button data-step="select-fc-out" data-out-runner-base="${i}" class="out-option">選擇壘間狀況</button>
                        </div>
                    </div>`;
                }
            });
            // 傳球未及、所有人都安全，仍是野手選擇（打者不算安打）
            optionsHTML += `
                    <div class="runner-placement-row">
                        <div class="runner-name">傳球未及</div>
                        <div class="runner-options">
                           <button data-step="select-fc-out" data-out-runner-base="none" class="out-option">沒有人出局</button>
                        </div>
                    </div>`;
            modalAdvancedOptions.innerHTML = optionsHTML;
        }
        else if (advancedPlayState.step === 'set-runners') {
            let title = advancedPlayState.error ?
                `${PLAY_DESCRIPTIONS[advancedPlayState.play]}, 並靠著${ERROR_POSITIONS[advancedPlayState.error]}失誤` :
                PLAY_DESCRIPTIONS[advancedPlayState.play];
            modalAdvancedTitle.textContent = title;
            let optionsHTML = '';
            // 打者已出局時也要列出來，否則使用者看不到這一個出局數，
            // 容易再多點一位跑者出局而讓半局提早結束
            if (advancedPlayState.batterIsOut) {
                const outBatter = getCurrentBatter();
                optionsHTML += `
                <div class="runner-placement-row batter-out-row">
                    <div class="runner-name">打者: ${outBatter.name}</div>
                    <div class="runner-options"><span class="static-out">已出局（本打席已計 1 個出局數）</span></div>
                </div>`;
            }
            // Batter
            if (!advancedPlayState.batterIsOut) {
                const batter = getCurrentBatter();
                const batterDest = advancedPlayState.batterDestination.dest;
                optionsHTML += `
                <div class="runner-placement-row">
                    <div class="runner-name">打者: ${batter.name}</div>
                    <div class="runner-options">
                        <button data-step="set-runners" data-dest="1" class="${batterDest === 1 ? 'selected' : ''}">一壘</button>
                        <button data-step="set-runners" data-dest="2" class="${batterDest === 2 ? 'selected' : ''}">二壘</button>
                        <button data-step="set-runners" data-dest="3" class="${batterDest === 3 ? 'selected' : ''}">三壘</button>
                        <button data-step="set-runners" data-dest="4" class="${batterDest === 4 ? 'selected' : ''}">得分</button>
                        ${HIT_BASES[advancedPlayState.play] && advancedPlayState.play !== '本打'
                            ? `<button data-step="set-runners" data-dest="0" data-out-advancing="1" class="out-option ${(advancedPlayState.batterDestination as any).outAdvancing ? 'selected' : ''}">趁傳進壘被觸殺</button>`
                            : ''}
                    </div>
                </div>`;
            }
            // Runners
            advancedPlayState.originalBases.forEach((runner, i) => {
                if (runner) {
                    const runnerPlayer = getPlayerById(gameState.isTop ? 'a' : 'b', runner.runnerId);
                    const runnerKey = `base-${i}`;
                    const runnerDest = advancedPlayState.runnerDestinations[runnerKey]?.dest;
                    optionsHTML += `
                    <div class="runner-placement-row">
                        <div class="runner-name">${['一', '二', '三'][i]}壘跑者: ${runnerPlayer.name}</div>
                        <div class="runner-options">
                           ${[...Array(4 - i)].map((_, j) => {
                        const destBase = i + 1 + j;
                        return `<button data-step="set-runners" data-runner-id="${i}" data-dest="${destBase}" class="${runnerDest === destBase ? 'selected' : ''}">${destBase > 3 ? '得分' : `${['一', '二', '三'][destBase - 1]}壘`}</button>`;
                    }).join('')}
                           <button data-step="set-runners" data-runner-id="${i}" data-dest="0" class="out-option ${runnerDest === 0 ? 'selected' : ''}">出局</button>
                        </div>
                    </div>`;
                }
            });
            let modifierHTML = '';
            const canHaveObstruction = ['內安', '一安', '二安', '三安', '失誤', '野手選擇', '不死三振'].includes(advancedPlayState.play);
            // 壘上無人時已跳過「是否失誤」，在這裡提供補記入口
            const canAddError = ['內安', '一安', '二安', '三安', '不死三振'].includes(advancedPlayState.play);
            let errorToggleHTML = '';
            const errList = advancedPlayState.errors || (advancedPlayState.error ? [advancedPlayState.error] : []);
            if (canAddError || errList.length) {
                // 同一個 play 可能有多次失誤：每筆一個籌碼可移除，並可再加一次
                errorToggleHTML = errList.map((e, i) =>
                    `<button data-step="remove-error" data-idx="${i}" class="selected">失誤：${ERROR_POSITIONS[e] || e} ×</button>`).join('')
                    + `<button data-step="add-error">${errList.length ? '再加一次失誤' : '加上失誤'}</button>`;
            }
            // 擊球方向：安打與上壘類結果才需要（滾地／飛球出局的名稱本身已含位置）
            const canPickDirection = ['內安', '一安', '二安', '三安', '本打',
                                      '失誤', '野手選擇', '不死三振',
                                      '滾地', '飛球', '界飛', '犧短', '犧飛',
                                      '雙殺', '三殺'].includes(advancedPlayState.play);
            let directionHTML = '';
            if (canPickDirection) {
                const mark = advancedPlayState.hitPoint;
                // 落點已在主畫面球場標好時，這裡完全不再顯示球場圖
                const locked = !!advancedPlayState.pointConfirmed;
                // 飛球與界飛才有界外區可點；已判定界外時界內就鎖住
                // 界飛只點界外區，其餘球種只點界內
                const isFoulPlay = advancedPlayState.play === '界飛';
                const chain = advancedPlayState.fielders || [];
                const orderMark = d => {
                    const idxs = chain.map((f, i) => f === d ? i + 1 : 0).filter(Boolean);
                    return idxs.length ? `<i class="dir-order">${idxs.join(',')}</i>` : '';
                };
                const fBtn = d => `<button data-step="set-fielder" data-dir="${d}" class="dir-btn ${chain.includes(d) ? 'selected' : ''}">${d}${orderMark(d)}</button>`;
                const isMultiOut = ['雙殺', '三殺'].includes(advancedPlayState.play);
                const bt = advancedPlayState.ballType || 'G';
                const ballTypeRow = isMultiOut ? `
                        <span class="hit-direction-label">球種
                            <em>滾地球是傳殺封殺；平飛／高飛是接殺後再傳殺離壘跑者</em>
                        </span>
                        <div class="hit-direction-row ball-type-row">
                            ${[['G', '滾地球'], ['L', '平飛球'], ['F', '高飛球']].map(([k, t]) =>
                                `<button data-step="set-ball-type" data-ball="${k}" class="dir-btn ${bt === k ? 'selected' : ''}">${t}</button>`).join('')}
                        </div>` : '';
                const anyRunnerOut = advancedPlayState.originalBases.some((r, i) =>
                    r && advancedPlayState.runnerDestinations[`base-${i}`]?.dest === 0);
                const rdOn = isRundown(chain, advancedPlayState.rundown);
                const rundownBtn = (anyRunnerOut && chain.length >= 2)
                    ? ` <button type="button" data-step="toggle-rundown" class="dir-clear ${rdOn ? 'selected' : ''}">夾殺${rdOn ? '✓' : ''}</button>` : '';
                const clearBtn = (chain.length ? ` <button type="button" data-step="clear-fielders" class="dir-clear">清除</button>` : '') + rundownBtn;
                const chainLabel = (chain.length
                    ? `已選：${chain.join('→')}（${chainCode(chain)}）${advancedPlayState.directionAuto ? '　自動帶入，點任一野手可重選' : '　點最後一個可退回'}`
                    : '依序點：先點接球的野手，再點傳給誰（可不選）') + clearBtn;
                if (locked) {
                    // 需求：主畫面點過落點就定案，這裡只留文字確認與處理野手
                    directionHTML = `
                    <div class="hit-direction hit-direction-locked">
                        ${ballTypeRow}
                        <span class="hit-direction-label">擊球落點
                            <em>已在球場標記${advancedPlayState.direction ? `：${advancedPlayState.direction}方向` : ''}${fielderFromMiniPoint(mark) === null ? '（界外）' : ''}　要改請按「返回」重點一次</em>
                        </span>
                        <span class="hit-direction-label fielder-label">處理野手
                            <em>${chainLabel}</em>
                        </span>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.outfield.map(fBtn).join('')}</div>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.infield.map(fBtn).join('')}</div>
                    </div>`;
                }
                else directionHTML = `
                    <div class="hit-direction">
                        ${ballTypeRow}
                        <span class="hit-direction-label">擊球落點
                            <em>${isFoulPlay ? '（點界外區，可不選）'
                                  : mark ? '（再點一次球場可清除）' : '（點球場圖，可不選）'}</em>
                        </span>
                        <svg id="hit-field" viewBox="0 50 200 146" role="img" aria-label="擊球落點">
                            <path class="hf-grass" d="M100 170 L18 88 A116 116 0 0 1 182 88 Z"/>
                            <path class="hf-dirt" d="M100 170 L58 128 A59 59 0 0 1 142 128 Z"/>
                            <path class="hf-arc" d="M58 128 A59 59 0 0 1 142 128"/>
                            <line class="hf-line" x1="100" y1="170" x2="18" y2="88"/>
                            <line class="hf-line" x1="100" y1="170" x2="182" y2="88"/>
                            <rect class="hf-base" x="96" y="166" width="8" height="8" transform="rotate(45 100 170)"/>
                            <rect class="hf-base" x="126" y="136" width="7" height="7" transform="rotate(45 129.5 139.5)"/>
                            <rect class="hf-base" x="96" y="106" width="7" height="7" transform="rotate(45 99.5 109.5)"/>
                            <rect class="hf-base" x="66" y="136" width="7" height="7" transform="rotate(45 69.5 139.5)"/>
                            <path class="hf-foul ${isFoulPlay ? '' : 'off'}" d="M182.0 88.0 L197.6 103.5 L115.6 185.6 L100.0 192.0 L84.4 185.6 L2.4 103.5 L18.0 88.0 L100.0 170.0 Z"${isFoulPlay ? ' data-step="set-point"' : ''}/>
                            <path class="hf-hit ${isFoulPlay ? 'off' : ''}" d="M100 170 L18 88 A116 116 0 0 1 182 88 Z"${isFoulPlay ? '' : ' data-step="set-point"'}/>
                            ${mark ? `<circle class="hf-mark" cx="${mark.x}" cy="${mark.y}" r="5"/>` : ''}
                        </svg>
                        <span class="hit-direction-label fielder-label">處理野手
                            <em>${chainLabel}</em>
                        </span>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.outfield.map(fBtn).join('')}</div>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.infield.map(fBtn).join('')}</div>
                    </div>`;
            }
            if (canHaveObstruction || canPickDirection) {
                modifierHTML = directionHTML + `
                    <div class="advanced-play-modifiers">
                        ${errorToggleHTML}
                        ${canHaveObstruction ? `<button
                            data-step="toggle-obstruction"
                            class="${advancedPlayState.obstruction ? 'selected' : ''}"
                        >加上妨礙跑壘</button>` : ''}
                    </div>
                `;
            }
            modalAdvancedOptions.innerHTML = optionsHTML + modifierHTML;
        }
        renderAdvancedSummary();
    }
    // === 完成前的摘要與衝突提示 ===
    function renderAdvancedSummary() {
        if (!advancedSummaryEl) return;
        if (advancedPlayState.step !== 'set-runners') {
            // 失誤位置、野手選擇的出局跑者等步驟都還沒選完，這時按完成會做出殘缺的記錄
            advancedSummaryEl.textContent = '請先完成上方的選擇';
            advancedSummaryEl.className = '';
            (doneButtonAdvanced as HTMLButtonElement).disabled = true;
            return;
        }
        const conflicts = findBaseConflicts();
        if (conflicts.length > 0) {
            const msg = conflicts
                .map(c => `${['一', '二', '三'][c.base - 1]}壘同時有 ${c.names.join('、')}`)
                .join('；');
            advancedSummaryEl.textContent = `⚠ ${msg} — 請調整跑者去向`;
            advancedSummaryEl.className = 'summary-conflict';
            (doneButtonAdvanced as HTMLButtonElement).disabled = true;
            return;
        }
        if (!advancedPlayState.batterIsOut &&
            (!advancedPlayState.batterDestination || (advancedPlayState.batterDestination.dest < 1 && !(advancedPlayState.batterDestination as any).outAdvancing))) {
            advancedSummaryEl.textContent = '⚠ 尚未指定打者跑到哪一個壘（或是否出局）';
            advancedSummaryEl.className = 'summary-conflict';
            (doneButtonAdvanced as HTMLButtonElement).disabled = true;
            return;
        }
        const someoneScored = advancedPlayState.originalBases.some((r, i) =>
            r && advancedPlayState.runnerDestinations[`base-${i}`]?.dest >= 4);
        if (advancedPlayState.play === '犧飛' && !someoneScored) {
            advancedSummaryEl.textContent = '⚠ 犧牲飛球必須有跑者回本壘得分；跑者被觸殺出局的話，請按返回改記「飛球出局」';
            advancedSummaryEl.className = 'summary-conflict';
            (doneButtonAdvanced as HTMLButtonElement).disabled = true;
            return;
        }
        const sfHint = (advancedPlayState.play === '飛球' && someoneScored)
            ? '　※ 有跑者回本壘得分，正式記錄應為犧牲飛球（不計打數）' : '';
        const outsOnPlay = countAdvancedOuts();
        const remaining = 3 - gameState.outs;
        if (outsOnPlay > remaining) {
            advancedSummaryEl.textContent =
                `⚠ 這個打席會產生 ${outsOnPlay} 個出局，但本半局只剩 ${remaining} 個 — 請調整跑者去向`;
            advancedSummaryEl.className = 'summary-conflict';
            (doneButtonAdvanced as HTMLButtonElement).disabled = true;
            return;
        }
        const outsText = outsOnPlay > 0 ? `　本打席出局 ${outsOnPlay} 個（半局剩 ${remaining}）` : '';
        advancedSummaryEl.textContent = buildAdvancedSummaryText() + outsText + sfHint;
        advancedSummaryEl.className = 'summary-ok';
        (doneButtonAdvanced as HTMLButtonElement).disabled = false;
    }
    // 本打席實際會產生幾個出局（打者 + 被判出局的跑者）
    function countAdvancedOuts() {
        let n = (advancedPlayState.batterIsOut || (advancedPlayState.batterDestination as any)?.outAdvancing) ? 1 : 0;
        advancedPlayState.originalBases.forEach((runner, i) => {
            if (!runner) return;
            const entry = advancedPlayState.runnerDestinations[`base-${i}`];
            if (entry && entry.dest === 0) n++;
        });
        return n;
    }
    function buildAdvancedSummaryText() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const baseName = dest => dest >= 4 ? '得分' : `${['一', '二', '三'][dest - 1]}壘`;
        const parts = [];
        const desc = advancedPlayState.error
            ? `${PLAY_DESCRIPTIONS[advancedPlayState.play]}（${ERROR_POSITIONS[advancedPlayState.error] || advancedPlayState.error}失誤）`
            : PLAY_DESCRIPTIONS[advancedPlayState.play];
        const chain = advancedPlayState.fielders || [];
        parts.push(chain.length ? `${desc}（${chain.join('→')}）` : desc);
        if (advancedPlayState.hitPoint) parts.push('已標記落點');
        advancedPlayState.originalBases.forEach((runner, i) => {
            if (!runner) return;
            const entry = advancedPlayState.runnerDestinations[`base-${i}`];
            const dest = entry ? entry.dest : i + 1;
            const player = getPlayerById(teamKey, runner.runnerId);
            const name = (player && player.name) || `${['一', '二', '三'][i]}壘跑者`;
            if (dest === 0) parts.push(`${name} 出局`);
            else if (dest === i + 1) parts.push(`${name} 留在${baseName(dest)}`);
            else parts.push(`${name} 上${baseName(dest)}`);
        });
        if (!advancedPlayState.batterIsOut) {
            const batter = getCurrentBatter();
            const d = advancedPlayState.batterDestination.dest;
            const name = (batter && batter.name) || '打者';
            if (d > 0) parts.push(`${name} 上${baseName(d)}`);
        }
        if (advancedPlayState.obstruction) parts.push('含妨礙跑壘');
        return parts.join('，');
    }
    function processAdvancedPlay() {
        const conflicts = findBaseConflicts();
        if (conflicts.length > 0) {
            renderAdvancedSummary();
            return;
        }
        snapshotSituation();
        {
        }
        saveStateForUndo();
        const { play, error, batterDestination, runnerDestinations, batterIsOut, obstruction } = advancedPlayState;
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const batter = getCurrentBatter();
        const activePitcher = gameState.teams[teamKey === 'a' ? 'b' : 'a'].pitchers.find(p => p._id === gameState.teams[teamKey === 'a' ? 'b' : 'a'].activePitcherId);
        batter.pa++;
        activePitcher.bf++;
        const isSacrifice = play === '犧短' || play === '犧飛';
        if (!isSacrifice && play !== '不死三振' && play !== '妨礙打擊') {
            batter.ab++;
        }
        else if (play === '犧短') {
            batter.sh++;
        }
        else if (play === '犧飛') {
            batter.sf++;
        }
        // 守備鏈整串記進打席結果（例如 滾地@游一），正式記錄表會轉成 6-3
        const chainStr = (advancedPlayState.fielders || []).join('');
        const btMark = (['雙殺', '三殺'].includes(play) && advancedPlayState.ballType && advancedPlayState.ballType !== 'G')
            ? `~${advancedPlayState.ballType}` : '';
        ensureOwnStatArrays(batter);
        batter.abResults.push((chainStr ? `${play}@${chainStr}${btMark}` : play + btMark) + `#${gameState.inning}`);
        // 保留落點座標，供日後製作打擊分布圖
        if (advancedPlayState.hitPoint) {
            batter.hitPoints = batter.hitPoints || [];
            batter.hitPoints.push({
                play,
                fielder: advancedPlayState.direction,   // 處理野手（可為 null）
                x: advancedPlayState.hitPoint.x,
                y: advancedPlayState.hitPoint.y,
                inning: gameState.inning
            });
        }
        const hitBases = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4 };
        if (play === '不死三振') {
            batter.so++;
            activePitcher.k++;
        }
        if (play === '雙殺' && (advancedPlayState.ballType || 'G') === 'G') {
            batter.gidp++;   // 只有滾地雙殺才算 GIDP
        }
        if (hitBases[play]) {
            batter.h++;
            activePitcher.h++;
            team.hits++;
            batter['2b'] += (play === '二安' ? 1 : 0);
            batter['3b'] += (play === '三安' ? 1 : 0);
            batter.hr += (play === '本打' ? 1 : 0);
            activePitcher.hr += (play === '本打' ? 1 : 0);
            batter.tb += hitBases[play];
        }
        const errorList: string[] = (advancedPlayState.errors && advancedPlayState.errors.length)
            ? advancedPlayState.errors : (error ? [error] : []);
        if (errorList.length) {
            gameState.teams[teamKey === 'a' ? 'b' : 'a'].errors += errorList.length;
        }
        const hitPowerForRules = hitBases[play] || (play === '失誤' || play === '野手選擇' || play === '不死三振' ? 1 : 0);
        let runnersScored: BaseRunner[] = [];
        let rbis = 0;
        let outsOnPlay = 0;
        const newBases: (BaseRunner | null)[] = [null, null, null];
        const originalBases = advancedPlayState.originalBases;
        const runnerDestinationsFinal = { ...runnerDestinations };
        // Default runners to stay on their original base if no destination is selected
        originalBases.forEach((runner, i) => {
            if (runner) {
                const runnerKey = `base-${i}`;
                if (!runnerDestinationsFinal[runnerKey]) {
                    runnerDestinationsFinal[runnerKey] = { dest: i + 1, isUnearned: runner.isUnearned };
                }
            }
        });
        // Process final destinations for ALL runners on base at the start of the play
        Object.entries(runnerDestinationsFinal).forEach(([key, val]) => {
            const baseIndex = parseInt(key.split('-')[1]);
            const runner = originalBases[baseIndex];
            if (!runner)
                return; // Only process runners who were actually on base.
            // 靠失誤多跑的壘：超過這個結果正常給的壘數，就是失誤造成的
            const advancedBy = (val.dest >= 4 ? 4 : val.dest) - (baseIndex + 1);
            const beyondHit = errorList.length > 0 && hitPowerForRules > 0 && advancedBy > hitPowerForRules;
            const nowUnearned = runner.isUnearned || beyondHit || (play === '失誤');
            if (val.dest >= 4) { // Runner scores
                runnersScored.push({ ...runner, isUnearned: nowUnearned });
                // 規則 9.04(b)：因失誤才得的分不給打點
                if (!beyondHit) rbis++;
            }
            else if (val.dest > 0) { // Runner advances to a base
                newBases[val.dest - 1] = { ...runner, isUnearned: nowUnearned };
            }
            else { // Runner is out
                outsOnPlay++;
            }
        });
        if (!batterIsOut) {
            const batterBeyond = errorList.length > 0 && hitPowerForRules > 0 && batterDestination.dest > hitPowerForRules;
            const isBatterUnearned = batterDestination.isUnearned || batterBeyond || (play === '失誤');
            if ((batterDestination as any).outAdvancing) {
                // 安打後想多跑一個壘被觸殺：安打照算，打者出局
                outsOnPlay++;
            }
            else if (batterDestination.dest >= 4) {
                runnersScored.push({ runnerId: batter._id, isUnearned: isBatterUnearned });
                if (play === '本打') rbis++;       // 只有全壘打才給打者自己的打點
            }
            else if (batterDestination.dest > 0) {
                newBases[batterDestination.dest - 1] = { runnerId: batter._id, isUnearned: isBatterUnearned };
            }
        }
        else {
            outsOnPlay++;
        }
        addRuns(runnersScored, rbis);
        gameState.bases = newBases;
        gameState.outs += outsOnPlay;
        activePitcher.outsRecorded += outsOnPlay;
        gameState.inningPotentialOuts += outsOnPlay;
        if (error) {
            // An error on a play that isn't a hit implies an out should have been recorded.
            if (!hitBases[play]) {
                gameState.inningPotentialOuts += 1;
            }
        }
        // Part 1: Build the initial event description for the batter's action
        let eventDesc = `${batterTitle(batter, gameState.currentBatterIndex[teamKey])}\n`;
        const dirUsed = advancedPlayState.direction;
        const chainUsed = advancedPlayState.fielders || [];
        if (play !== '失誤') {
            eventDesc += ` ${describePlayWithFielder(play, dirUsed, chainUsed)}`;
        }
        else if (dirUsed) {
            eventDesc += ` ${describePlayWithFielder(play, dirUsed, chainUsed)}`;
        }
        let hitErrorTail = '';
        let errWhoText = '';
        const errListForText: string[] = (advancedPlayState.errors && advancedPlayState.errors.length)
            ? advancedPlayState.errors : (error ? [error] : []);
        if (errListForText.length) {
            // 多次失誤：同一人「投手兩次失誤」，不同人「游擊手與中外野手失誤」
            const counts: { [k: string]: number } = {};
            errListForText.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
            const parts = Object.entries(counts).map(([e, n]) => `${ERROR_POSITIONS[e] || e}${n > 1 ? ['', '', '兩次', '三次', '四次'][n] || n + '次' : ''}`);
            errWhoText = parts.join('與');
            if (play === '失誤') {
                eventDesc += dirUsed ? `，${errWhoText}失誤` : ` ${errWhoText}失誤`;
            }
            else {
                hitErrorTail = `，${errWhoText}發生失誤`;   // 若沒有人因此多進壘才會用到
            }
        }
        let errorMentioned = false;   // 失誤已寫進「靠○○失誤進壘」時，就不再另外補一句
        let batterSentenceOpen = false;
        const basesText = ['一', '二', '三', '本'];
        // Part 2: Add batter's destination and RBI information
        if (!batterIsOut) {
            let batterDestText = '';
            const hitPower = hitBases[play] || 0;
            if ((batterDestination as any).outAdvancing && hitPower > 0) {
                const c = chainUsed;
                const nextBase = basesText[hitPower] || '本';
                const tagger = c.length ? `被${relayText(c)}` : '';
                batterDestText = `上到${basesText[hitPower - 1]}壘，趁傳想上${nextBase}壘時${tagger}觸殺出局${chainTail(c)}`;
            }
            else if (batterDestination.dest > 0) {
                const extraWord = errListForText.length ? `靠${errWhoText}失誤` : '趁傳';
                if (hitPower > 0 && batterDestination.dest > hitPower && batterDestination.dest <= 3) {
                     batterDestText = `上到${basesText[hitPower - 1]}壘，${extraWord}進壘到${basesText[batterDestination.dest - 1]}壘`;
                     if (errListForText.length) errorMentioned = true;
                } else if (hitPower > 0 && batterDestination.dest > hitPower && batterDestination.dest >= 4) {
                     batterDestText = `上到${basesText[hitPower - 1]}壘，${extraWord}回本壘得分`;
                     if (errListForText.length) errorMentioned = true;
                } else if (batterDestination.dest <= 3) {
                     batterDestText = `上到${basesText[batterDestination.dest - 1]}壘`;
                } else if (play !== '本打') {
                     batterDestText = `回到本壘得分`;
                }
            }
             eventDesc += (batterDestText ? `，${batterDestText}` : '');
             batterSentenceOpen = true;
        }
        else {
            batterSentenceOpen = true;
        }
        // 打點寫在所有跑者敘述之後（見下方）
        const rbiSentence = (!batterIsOut || play === '犧飛' || play === '犧短' || play === '滾地' || play === '雙殺' || play === '野手選擇') && rbis > 0
            ? ` ${['一', '兩', '三', '四'][rbis - 1] || rbis}分打點。` : '';
        // Part 3: Add descriptions for each runner's movement
        const runnerMoves = [];
        advancedPlayState.originalBases.forEach((runner, i) => {
            if (runner) {
                const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
                const dest = runnerDestinationsFinal[`base-${i}`]?.dest;
                // Only describe if runner moved or was out
                if (dest !== undefined && dest !== i + 1) {
                    const fromBaseText = basesText[i];
                    let toDestText = '';
                    if (dest >= 4) {
                        toDestText = '回到本壘得分';
                    }
                    else if (dest > 0) {
                        toDestText = `上到${basesText[dest - 1]}壘`;
                    }
                    else {
                        toDestText = '出局';
                        const c = chainUsed;
                        const last = c[c.length - 1];
                        const isFly = ['飛球', '犧飛', '界飛'].includes(play);
                        const batterSafe = !advancedPlayState.batterIsOut;
                        const nextBase = i + 2;   // 跑者理應前進的下一壘（三壘跑者 → 本壘 = 4）
                        const rd = isRundown(c, advancedPlayState.rundown);
                        const isAirDP = ['雙殺', '三殺'].includes(play) && advancedPlayState.ballType && advancedPlayState.ballType !== 'G';
                        if (isAirDP) {
                            // 平飛：多半是離壘太遠回不去；高飛：多半是接殺後起跑被傳殺
                            toDestText = advancedPlayState.ballType === 'L'
                                ? '離壘過遠回壘不及，被傳殺出局'
                                : (last === '捕' ? '接殺後衝本壘，被傳殺出局' : '接殺後起跑進壘，被傳殺出局');
                        }
                        const codeTail = chainTail(c);
                        // 飛球：第一個野手負責接殺打者，之後的傳球才是處理跑者
                        if (isFly && c.length >= 2) {
                            toDestText = rd
                                ? `接殺後起跑，${runnerOutText(c, i + 1, nextBase, true)}`
                                : (last === '捕'
                                    ? `接殺後回本壘，被${relayText(c)}觸殺出局${codeTail}`
                                    : `接殺後進壘，被${relayText(c)}刺殺出局${codeTail}`);
                        }
                        // 打者安全上壘（野手選擇、失誤、安打）：整條鏈都是在處理這名跑者
                        else if (batterSafe && c.length >= 1) {
                            const isGroundFC = play === '野手選擇' || play === '失誤';
                            toDestText = rd
                                ? runnerOutText(c, i + 1, nextBase, true)
                                : (last === '捕'
                                    ? `衝本壘時被${relayText(c)}觸殺出局${codeTail}`
                                    : (isGroundFC
                                        ? `於${basesText[nextBase - 1]}壘被封殺出局${codeTail}`
                                        : `被${relayText(c)}刺殺出局${codeTail}`));
                        }
                        // 滾地雙殺／三殺／犧牲觸擊：被迫進壘的跑者在下一個壘被封殺
                        else if (['雙殺', '三殺', '犧短', '滾地'].includes(play) && (advancedPlayState.ballType || 'G') === 'G') {
                            toDestText = `於${basesText[nextBase - 1]}壘被封殺出局`;
                        }
                    }

                    const hitPower = hitBases[play] || (play === '野手選擇' || play === '失誤' ? 1 : 0);
                    const basesAdvanced = dest - (i + 1);
                    if (hitPower > 0 && dest <= 4 && basesAdvanced > hitPower) {
                        if (errListForText.length) {
                            // 「回到本壘得分」→「靠左外野手失誤回到本壘得分」；已寫過誰失誤就只寫「靠失誤」
                            toDestText = `靠${errorMentioned ? '' : errWhoText}失誤${toDestText}`;
                            errorMentioned = true;
                        }
                        else {
                            toDestText = `趁傳${toDestText}`;
                        }
                    }

                    runnerMoves.push(`在${fromBaseText}壘的${runnerPlayer.name} ${toDestText}。`);
                }
            }
        });
        if (batterSentenceOpen) {
            eventDesc += (errorMentioned ? '' : hitErrorTail) + '。';
        }
        if (runnerMoves.length > 0) {
            // Join with a space to make it feel like separate sentences, but part of the same play description.
            eventDesc += ' ' + runnerMoves.join(' ');
        }
        eventDesc += rbiSentence;
        if (obstruction) {
            eventDesc += ' 過程中發生妨礙跑壘。';
        }
        if (outsOnPlay > 0) eventDesc += ` ${Math.min(3, gameState.outs)}人出局。`;

        // 標題行後面接的第一個描述前不需要空白
        logEvent(eventDesc.replace('\n ', '\n').trim(), teamKey);
        gameState.currentBatterIndex[teamKey] = (gameState.currentBatterIndex[teamKey] + 1) % LINEUP_SIZE;
        closeModal(modal);
        // Reset advanced play state to prevent data from leaking into the next play.
        advancedPlayState = {
            play: '',
            error: null,
            batterDestination: { dest: 0, isUnearned: false },
            runnerDestinations: {},
            originalBases: [],
            step: '',
            batterIsOut: false,
            outRunnerBase: null,
            obstruction: false
        };
        if (checkAndEndGame()) {
            saveState();
            render();
            return;
        }
        if (gameState.outs >= 3) {
            endHalfInning();
        }
        saveState();
        render();
    }
    function handleUndo() {
        if (gameStateHistory.length > 0) {
            // 復原就是把上一動抹掉，紀錄本身要乾淨，不再留下「已復原」那一行
            gameState = gameStateHistory.pop();
            saveState();
            createLineupInputs(); // Re-create inputs in case DH was changed
            attachTeamSettingsListeners(); // Re-attach listeners to new inputs
            render();
        }
    }
    function saveStateForUndo() {
        gameStateHistory.push(JSON.parse(JSON.stringify(gameState)));
    }
    function openRunnerActionModal() {
        if (gameState.bases.some(r => r !== null)) {
            showRunnerActionStep('select-event');
            openModal(runnerActionModal, runnerActionModalContent);
        }
    }
    function showRunnerActionStep(step) {
        runnerActionState.step = step;
        runnerActionStep1.classList.toggle('modal-hidden', step !== 'select-event');
        runnerActionStep2.classList.toggle('modal-hidden', step === 'select-event');
        if (step === 'select-event') {
            runnerActionOptions.innerHTML = Object.entries(RUNNER_ACTION_TYPES).map(([type, name]) => `<button data-type="${type}" data-step="select-event">${name}</button>`).join('');
        }
        else {
            renderRunnerActionOptions();
        }
    }
    function renderRunnerActionOptions() {
        const { type, destinations, step } = runnerActionState;
        if (step === 'ask-steal-error') {
            runnerActionTitleStep2.textContent = '盜壘過程是否有失誤?';
            runnerActionDetails.innerHTML = `
                <div class="modal-options play-options" style="grid-template-columns: 1fr 1fr;">
                    <button data-step="ask-steal-error" data-choice="yes">是，發生失誤</button>
                    <button data-step="ask-steal-error" data-choice="no">否，繼續</button>
                </div>
            `;
            return;
        }
        if (step === 'select-steal-error-position') {
            runnerActionTitleStep2.textContent = '盜壘失誤 - 選擇失誤位置';
            runnerActionDetails.innerHTML = `<div class="modal-options play-options">${Object.entries(ERROR_ABBREVIATIONS).map(([pos, abbr]) => `<button data-step="select-steal-error-position" data-error-pos="${pos}">${abbr}</button>`).join('')}</div>`;
            return;
        }
        if (step === 'ask-pickoff-outcome') {
            runnerActionTitleStep2.textContent = '投手牽制結果';
            runnerActionDetails.innerHTML = `
                <div class="modal-options play-options" style="grid-template-columns: 1fr 1fr;">
                    <button data-step="ask-pickoff-outcome" data-choice="success">成功</button>
                    <button data-step="ask-pickoff-outcome" data-choice="error">失誤</button>
                </div>
            `;
            return;
        }
        runnerActionTitleStep2.textContent = RUNNER_ACTION_TYPES[type];
        let detailsHTML = '';
        const teamKey = gameState.isTop ? 'a' : 'b';
        runnerActionState.originalBases.forEach((runner, i) => {
            if (runner) {
                const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
                const currentDest = destinations[`base-${i}`];
                let options = '';
                if (type === 'steal') {
                    const advanceOptions = [...Array(4 - (i + 1))].map((_, j) => {
                        const destBase = i + 2 + j;
                        return `<button data-step="set-dest" data-runner-id="${i}" data-dest="${destBase}" class="${currentDest?.dest === destBase ? 'selected' : ''}">${destBase > 3 ? '得分' : `${['二', '三', '本'][destBase - 2]}壘`}</button>`;
                    }).join('');
                    const outOption = `<button data-step="set-dest" data-runner-id="${i}" data-dest="${i + 1}" data-out="true" class="out-option ${currentDest?.isOut ? 'selected' : ''}">盜壘失敗（出局）</button>`;
                    options = advanceOptions + outOption;
                }
                else if (type === 'pickoff-out') {
                    if (runnerActionState.error) { // Pickoff ERROR
                        options = [...Array(4 - (i + 1))].map((_, j) => {
                            const destBase = i + 2 + j;
                            return `<button data-step="set-dest" data-runner-id="${i}" data-dest="${destBase}" class="${currentDest?.dest === destBase ? 'selected' : ''}">${destBase > 3 ? '得分' : `${['一', '二', '三'][destBase - 1]}壘`}</button>`;
                        }).join('');
                    }
                    else { // Pickoff SUCCESS
                        options = `<button data-step="set-dest" data-runner-id="${i}" data-dest="${i + 1}" data-out="true" class="out-option ${currentDest?.isOut ? 'selected' : ''}">牽制出局</button>`;
                    }
                }
                else { // WP, PB, Balk, Obstruction
                    options = [...Array(4 - (i + 1))].map((_, j) => {
                        const destBase = i + 2 + j;
                        return `<button data-step="set-dest" data-runner-id="${i}" data-dest="${destBase}" class="${currentDest?.dest === destBase ? 'selected' : ''}">${destBase > 3 ? '得分' : `${['一', '二', '三'][destBase - 1]}壘`}</button>`;
                    }).join('');
                }
                detailsHTML += `
                    <div class="runner-placement-row">
                        <div class="runner-name">${['一', '二', '三'][i]}壘跑者: ${runnerPlayer.name}</div>
                        <div class="runner-options">${options}</div>
                    </div>`;
            }
        });
        // 有跑者出局時，才需要記是誰傳給誰（夾殺就照傳球順序全部點）
        const anyOut = Object.values(destinations).some(d => d && d.isOut);
        if (anyOut) {
            if (!runnerActionState.fielders || (runnerActionState.fieldersAuto && runnerActionState.fielders.length === 0)) {
                runnerActionState.fielders = defaultRunnerOutChain();
                runnerActionState.fieldersAuto = true;
            }
            const chain = runnerActionState.fielders;
            const orderMark = d => {
                const idxs = chain.map((f, j) => f === d ? j + 1 : 0).filter(Boolean);
                return idxs.length ? `<i class="dir-order">${idxs.join(',')}</i>` : '';
            };
            const fBtn = d => `<button data-step="ra-fielder" data-dir="${d}" class="dir-btn ${chain.includes(d) ? 'selected' : ''}">${d}${orderMark(d)}</button>`;
            const rdOn = isRundown(chain, runnerActionState.rundown);
            const rundownBtn = chain.length >= 2
                ? ` <button type="button" data-step="ra-toggle-rundown" class="dir-clear ${rdOn ? 'selected' : ''}">夾殺${rdOn ? '✓' : ''}</button>` : '';
            const clearBtn = (chain.length ? ` <button type="button" data-step="ra-clear-fielders" class="dir-clear">清除</button>` : '') + rundownBtn;
            const label = chain.length
                ? `已選：${chain.join('→')}（${chainCode(chain)}）${runnerActionState.fieldersAuto ? '　自動帶入，點任一野手可重選' : '　點最後一個可退回'}`
                : '依序點：先點接球者，再點傳給誰；夾殺就照傳球順序全部點';
            detailsHTML += `
                <div class="hit-direction">
                    <span class="hit-direction-label fielder-label">處理野手 <em>${label}${clearBtn}</em></span>
                    <div class="hit-direction-row">${HIT_DIRECTIONS.outfield.map(fBtn).join('')}</div>
                    <div class="hit-direction-row">${HIT_DIRECTIONS.infield.map(fBtn).join('')}</div>
                </div>`;
        }
        runnerActionDetails.innerHTML = detailsHTML;
    }
    // 壘間事件的預設守備鏈：盜壘＝捕手傳到目標壘；牽制＝投手傳到該壘
    function defaultRunnerOutChain(): string[] {
        const { type, destinations, originalBases } = runnerActionState;
        const idx = originalBases.findIndex((r, i) => r && destinations[`base-${i}`]?.isOut);
        if (idx < 0) return [];
        const baseFielder = ['一', '游', '三'];     // 一壘／二壘／三壘的補位者
        if (type === 'steal') {
            const target = idx + 2;                    // 想盜的壘
            return target >= 4 ? ['捕'] : ['捕', baseFielder[target - 1]];
        }
        if (type === 'pickoff-out') return ['投', baseFielder[idx]];
        return [];
    }
    function handleRunnerActionClick(e) {
        const target = (e.target as HTMLElement).closest('button') as HTMLElement;
        if (!target)
            return;
        if (target.dataset.step === 'ra-fielder') {
            const dir = target.dataset.dir;
            let chain = [...(runnerActionState.fielders || [])];
            if (runnerActionState.fieldersAuto) chain = [dir];
            else if (chain.length && chain[chain.length - 1] === dir) chain.pop();
            else chain.push(dir);
            runnerActionState.fielders = chain;
            runnerActionState.fieldersAuto = false;
            renderRunnerActionOptions();
            return;
        }
        if (target.dataset.step === 'ra-clear-fielders') {
            runnerActionState.fielders = [];
            runnerActionState.fieldersAuto = false;
            runnerActionState.rundown = null;
            renderRunnerActionOptions();
            return;
        }
        if (target.dataset.step === 'ra-toggle-rundown') {
            runnerActionState.rundown = !isRundown(runnerActionState.fielders || [], runnerActionState.rundown);
            renderRunnerActionOptions();
            return;
        }
        const { step, type: actionType, runnerId, dest, out, choice, errorPos } = target.dataset;
        if (step === 'select-event') {
            if (actionType === 'steal') {
                runnerActionState = {
                    step: 'ask-steal-error',
                    type: 'steal',
                    destinations: {},
                    originalBases: JSON.parse(JSON.stringify(gameState.bases)),
                    error: false,
                    errorPosition: null,
                    fielders: [],
                    fieldersAuto: true,
                    rundown: null,
                };
                showRunnerActionStep('ask-steal-error');
            }
            else if (actionType === 'pickoff-out') {
                runnerActionState = {
                    step: 'ask-pickoff-outcome',
                    type: 'pickoff-out',
                    destinations: {},
                    originalBases: JSON.parse(JSON.stringify(gameState.bases)),
                    error: false, // Default
                    errorPosition: null,
                    fielders: [],
                    fieldersAuto: true,
                    rundown: null,
                };
                showRunnerActionStep('ask-pickoff-outcome');
            }
            else {
                runnerActionState = {
                    step: 'set-dest',
                    type: actionType,
                    destinations: {},
                    originalBases: JSON.parse(JSON.stringify(gameState.bases)),
                    error: false,
                    errorPosition: null,
                    fielders: [],
                    fieldersAuto: true,
                    rundown: null,
                };
                showRunnerActionStep('set-dest');
            }
        }
        else if (step === 'ask-steal-error') {
            if (choice === 'yes') {
                runnerActionState.error = true;
                runnerActionState.step = 'select-steal-error-position';
            }
            else {
                runnerActionState.error = false;
                runnerActionState.step = 'set-dest';
            }
            renderRunnerActionOptions();
        }
        else if (step === 'select-steal-error-position') {
            runnerActionState.errorPosition = errorPos;
            runnerActionState.step = 'set-dest';
            renderRunnerActionOptions();
        }
        else if (step === 'ask-pickoff-outcome') {
            runnerActionState.error = choice === 'error';
            runnerActionState.step = 'set-dest';
            renderRunnerActionOptions();
        }
        else if (step === 'set-dest') {
            const key = `base-${runnerId}`;
            runnerActionState.destinations[key] = {
                dest: Number(dest),
                isOut: out === 'true'
            };
            renderRunnerActionOptions();
        }
    }
    function processRunnerAction() {
        saveStateForUndo();
        snapshotSituation();
        const { type, destinations, originalBases, error, errorPosition } = runnerActionState;
        const teamKey = gameState.isTop ? 'a' : 'b';
        const defendingTeamKey = teamKey === 'a' ? 'b' : 'a';
        const activePitcher = gameState.teams[defendingTeamKey].pitchers.find(p => p._id === gameState.teams[defendingTeamKey].activePitcherId);
        if (error) {
            gameState.teams[defendingTeamKey].errors++;
        }
        if (type === 'wild-pitch')
            activePitcher.wp++;
        if (type === 'balk')
            activePitcher.bk++;
        const finalBases: (BaseRunner | null)[] = [null, null, null];
        let runnersScored: BaseRunner[] = [];
        let outsOnPlay = 0;
        const eventParts = [];
        // Determine the fate of each runner
        originalBases.forEach((runner, baseIndex) => {
            if (!runner)
                return; // Skip empty base
            const runnerKey = `base-${baseIndex}`;
            const destinationInfo = destinations[runnerKey];
            const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
            if (destinationInfo) {
                // This runner has a new destination
                const { dest, isOut } = destinationInfo;
                const isNowUnearned = runner.isUnearned || type === 'passed-ball' || !!error;
                if (isOut) {
                    outsOnPlay++;
                    const chain = runnerActionState.fielders || [];
                    const rd = isRundown(chain, runnerActionState.rundown);
                    if (type === 'steal') {
                        // 出局時畫面不會帶目標壘，企圖盜的就是下一個壘包
                        const target = STEAL_BASE_NAME(baseIndex + 2);
                        const how = chain.length ? runnerOutText(chain, baseIndex + 1, baseIndex + 2, rd) : '遭阻殺出局';
                        eventParts.push(`${runnerPlayer.name}從${BASE_NAME(baseIndex + 1)}壘盜${target}失敗，${how}。`);
                    }
                    else if (type === 'pickoff-out') {
                        const how = chain.length
                            ? (rd
                                ? `遭牽制後${runnerOutText(chain, baseIndex + 1, baseIndex + 2, true)}`
                                : `遭牽制，被${relayText(chain)}觸殺出局（${chainCode(chain)}）`)
                            : '遭牽制出局';
                        eventParts.push(`${runnerPlayer.name}${how}。`);
                    }
                }
                else {
                    if (dest >= 4) {
                        runnersScored.push({ ...runner, isUnearned: isNowUnearned });
                    }
                    else {
                        finalBases[dest - 1] = { ...runner, isUnearned: isNowUnearned };
                    }
                    // Logging for advancement
                    if (type === 'steal') {
                        runnerPlayer.sb++;
                        eventParts.push(dest >= 4
                            ? `${runnerPlayer.name}從三壘盜本壘成功，回到本壘得分。`
                            : `${runnerPlayer.name}從${BASE_NAME(baseIndex + 1)}壘盜${BASE_NAME(dest)}壘成功。`);
                    }
                    else {
                        eventParts.push(dest >= 4
                            ? `${BASE_NAME(baseIndex + 1)}壘跑者${runnerPlayer.name}回到本壘得分。`
                            : `${BASE_NAME(baseIndex + 1)}壘跑者${runnerPlayer.name}推進到${BASE_NAME(dest)}壘。`);
                    }
                }
            }
            else {
                // This runner did not move, so they stay put
                finalBases[baseIndex] = runner;
            }
        });
        gameState.bases = finalBases;
        gameState.outs += outsOnPlay;
        activePitcher.outsRecorded += outsOnPlay;
        gameState.inningPotentialOuts += outsOnPlay;
        addRuns(runnersScored, 0);
        let prefix = '';
        if (type === 'wild-pitch')
            prefix = '暴投，';
        if (type === 'passed-ball')
            prefix = '捕逸，';
        if (type === 'balk')
            prefix = '投手犯規，';
        if (type === 'obstruction')
            prefix = '妨礙跑壘，';
        if (type === 'steal' && error) {
            const errorPosText = errorPosition ? ERROR_POSITIONS[errorPosition] + '失誤' : '失誤';
            prefix = `盜壘時發生${errorPosText}，`;
        }
        if (type === 'pickoff-out' && error)
            prefix = '投手牽制失誤，';
        logEvent(prefix + eventParts.join(' '), teamKey);
        closeModal(runnerActionModal);
        if (checkAndEndGame()) {
            saveState();
            render();
            return;
        }
        if (gameState.outs >= 3) {
            endHalfInning();
        }
        saveState();
        render();
    }
    // 情境式換人：只列出可用的人，點一下就完成
    function openPicker(opts: { title: string; teamKey: 'a' | 'b'; candidates: any[]; onPick: (id: string) => void; note?: string }) {
        const modal = document.getElementById('picker-modal');
        const list = document.getElementById('picker-list');
        const title = document.getElementById('picker-title');
        const note = document.getElementById('picker-note');
        if (!modal || !list || !title) return;
        title.textContent = opts.title;
        if (note) note.textContent = opts.note || '';
        list.innerHTML = opts.candidates.length
            ? opts.candidates.map(p => `
                <button type="button" class="picker-item" data-player-id="${p._id}">
                    <img src="${playerPhotoSrc(p)}" alt="">
                    <span class="picker-name">${p.name}</span>
                    <span class="picker-sub">${p.jersey ? '#' + p.jersey : ''}${p.pos ? ' ' + p.pos : ''}</span>
                </button>`).join('')
            : '<div class="def-empty">沒有可用的球員，請先在名單頁新增板凳球員</div>';
        list.onclick = (e) => {
            const btn = (e.target as HTMLElement).closest('.picker-item') as HTMLElement | null;
            if (!btn) return;
            closeModal(modal);
            opts.onPick(btn.dataset.playerId);
        };
        openModal(modal);
    }
    // 可上場的板凳：有名字、目前不在場上、也沒有被換下過（棒球規則：離場不能再上）
    function benchOf(teamKey: 'a' | 'b') {
        const team = gameState.teams[teamKey];
        const used = new Set<string>();
        team.lineupSpots.forEach(s => s.history.forEach(id => used.add(id)));
        team.pitchers.forEach(p => used.add(p._id));
        return team.roster.filter(p => !used.has(p._id) && (p.name || '').trim());
    }
    function pinchHit() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const batter = getCurrentBatter();
        if (!batter) return;
        openPicker({
            title: `代打：換掉 ${batter.name}`,
            teamKey,
            candidates: benchOf(teamKey),
            onPick: (id) => { managementState.activeTeamKey = teamKey; processSubstitution(id, batter._id, 'PH'); }
        });
    }
    function pinchRun(baseIndex: number) {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const runner = gameState.bases[baseIndex];
        if (!runner) return;
        const player = getPlayerById(teamKey, runner.runnerId);
        openPicker({
            title: `代跑：換掉${['一', '二', '三'][baseIndex]}壘的 ${player ? player.name : ''}`,
            teamKey,
            candidates: benchOf(teamKey),
            onPick: (id) => { managementState.activeTeamKey = teamKey; processSubstitution(id, runner.runnerId, 'PR'); }
        });
    }
    function changePitcher() {
        const teamKey = gameState.isTop ? 'b' : 'a';
        const team = gameState.teams[teamKey];
        const current = getPlayerById(teamKey, team.activePitcherId);
        const bench = benchOf(teamKey);
        // 無 DH 時，打線裡的人也可以上來投（與現任投手守位互換）
        const fromLineup = team.useDH ? [] : team.lineupSpots
            .map(sp => getPlayerById(teamKey, sp.activePlayerId))
            .filter(p => p && p._id !== team.activePitcherId);
        const candidates = [...bench, ...fromLineup.map(p => ({ ...p, _fromLineup: true }))];
        openPicker({
            title: `換投：換掉 ${current ? current.name : ''}`,
            teamKey,
            note: team.useDH ? '' : '選打線裡的球員會與現任投手互換守位',
            candidates,
            onPick: (id) => {
                managementState.activeTeamKey = teamKey;
                if (fromLineup.some(p => p._id === id)) processDefensiveSwapToPitcher(id, team.activePitcherId);
                else processSubstitution(id, team.activePitcherId, 'P');
            }
        });
    }
    // 打線裡的人上來投：兩人守位互換，並更新活動投手與投手統計
    function processDefensiveSwapToPitcher(newPitcherId: string, oldPitcherId: string) {
        const teamKey = managementState.activeTeamKey;
        const team = gameState.teams[teamKey];
        processDefensiveSwap(newPitcherId, oldPitcherId);
        team.activePitcherId = newPitcherId;
        if (!team.pitchers.some(p => p._id === newPitcherId)) {
            const np = getPlayerById(teamKey, newPitcherId);
            team.pitchers.push({ _id: newPitcherId, name: np.name, outsRecorded: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0 });
        }
        saveState();
        render();
    }
    (window as any).__ctxSub = { pinchHit, pinchRun, changePitcher };   // 供測試
    function openManagementModal() {
        managementState = {
            activeTeamKey: gameState.isTop ? 'a' : 'b',
            selectedPlayer: null,
        };
        renderManagementModal();
        openModal(managementModal);
    }
    // 守位圖：沿用主頁球場圖（viewBox 18 25 370 365），座標為該圖的座標
    const DEF_POS_XY: { [pos: string]: [number, number] } = {
        'P': [202, 262], 'C': [202, 372], '1B': [284, 248], '2B': [242, 203], '3B': [120, 248],
        'SS': [162, 203], 'LF': [92, 138], 'CF': [202, 92], 'RF': [312, 138], 'DH': [352, 356]
    };
    // 同高度的鄰居（游擊↔二壘、三壘↔投手↔一壘）名字要一上一下，否則會疊在一起
    // 名字一律避開鄰居：內野角落（一、三壘）與投手、DH 放下面，
    // 二壘、游擊與外野放上面，這樣同一條水平線上不會有兩個名字相撞
    const DEF_LABEL_DY: { [pos: string]: number } = { 'P': 34, '1B': 34, '3B': 34, 'DH': 34 };
    function renderManagementModal() {
        const tabsContainer = document.getElementById('management-team-tabs');
        const managementContainer = document.getElementById('management-container');
        tabsContainer.innerHTML = ['a', 'b'].map(teamKey => {
            const team = gameState.teams[teamKey];
            const isActive = managementState.activeTeamKey === teamKey;
            return `<button class="tab-btn ${isActive ? 'active' : ''} team-${teamKey}" data-team-key="${teamKey}">${team.name}</button>`;
        }).join('');
        const teamKey = managementState.activeTeamKey;
        const team = gameState.teams[teamKey];
        const sel = managementState.selectedPlayer;
        // 場上的人：打序格現任者 + （DH 制）專任投手
        const onField: any[] = team.lineupSpots.map(spot => getPlayerById(teamKey, spot.activePlayerId)).filter(Boolean);
        if (team.useDH) {
            const pitcher = getPlayerById(teamKey, team.activePitcherId);
            if (pitcher && !onField.includes(pitcher)) onField.push(pitcher);
        }
        const bench = benchOf(teamKey);
        const isBattingTeam = (gameState.isTop && teamKey === 'a') || (!gameState.isTop && teamKey === 'b');
        const runnerIds = new Set(isBattingTeam ? gameState.bases.filter(Boolean).map(r => r.runnerId) : []);
        const shortName = (n: string) => [...(n || '')].slice(-4).join('');
        const orderOf = (id: string) => { const i = team.lineupSpots.findIndex(s => s.activePlayerId === id); return i >= 0 ? i + 1 : 0; };
        // 守位節點
        const placed = new Set<string>();
        let nodes = '';
        onField.forEach(p => {
            const pos = (p._id === team.activePitcherId) ? 'P' : p.pos;
            const xy = DEF_POS_XY[pos];
            if (!xy || placed.has(pos)) return;
            placed.add(pos);
            const isSel = sel && sel.id === p._id;
            // 名字太長會蓋到隔壁，只顯示後 4 個字（真實姓名多半 2–3 字，不受影響）
            const label = shortName(p.name);
            // 靠左右邊界的守位（LF／RF／DH）改成貼齊自己那一側，名字才不會被切掉
            const anchor = xy[0] < 100 ? 'start' : (xy[0] > 300 ? 'end' : 'middle');
            const anchorX = anchor === 'start' ? -20 : (anchor === 'end' ? 20 : 0);
            const dy = DEF_LABEL_DY[pos] || -22;
            // 與主頁壘上跑者相同的半身人像 + 姓名（不放守位代號）
            nodes += `
                <g class="def-node ${isSel ? 'selected' : ''} ${runnerIds.has(p._id) ? 'on-base' : ''}" data-player-id="${p._id}" data-source="field" data-pos="${pos}" transform="translate(${xy[0]},${xy[1]})">
                    <circle class="def-hit" r="26"/>
                    <path class="mf-runner-body" d="M-13 14 A13 13 0 0 1 13 14 Z"/>
                    <circle class="mf-runner-head" cx="0" cy="-6" r="8"/>
                    <text class="mf-runner-name def-name" x="${anchorX}" y="${dy}" style="text-anchor:${anchor}">${label}</text>
                </g>`;
        });
        // 沒有守位（或守位重複）的場上球員：另列成籌碼
        const unplaced = onField.filter(p => {
            const pos = (p._id === team.activePitcherId) ? 'P' : p.pos;
            return !DEF_POS_XY[pos] || (nodes.indexOf(`data-player-id="${p._id}"`) < 0);
        });
        const chip = (p, source: string, extra = '') => `
            <button type="button" class="def-chip ${sel && sel.id === p._id ? 'selected' : ''}" data-player-id="${p._id}" data-source="${source}">
                <img src="${playerPhotoSrc(p)}" alt=""><span>${p.name}</span>${extra}
            </button>`;
        const hint = !sel ? '點一個守位或板凳球員開始'
            : sel.source === 'field' ? `已選 ${getPlayerById(teamKey, sel.id)?.name}：再點另一個守位互換，或點板凳球員換他上場`
            : `已選 ${getPlayerById(teamKey, sel.id)?.name}：點一個守位，讓他接替那個位置`;
        const batterNow = getCurrentBatter();
        const defKey = gameState.isTop ? 'b' : 'a';
        const pitcherNow = getPlayerById(defKey, gameState.teams[defKey].activePitcherId);
        const canSub = gameState.started && !gameState.isGameOver;
        const quickSubs = canSub ? `
            <div class="def-quick">
                <button type="button" id="pinch-hit-btn" class="def-quick-btn">代打<small>換掉 ${gameState.teams[gameState.isTop ? 'a' : 'b'].name} ${batterNow ? batterNow.name : '—'}</small></button>
                <button type="button" id="change-pitcher-btn" class="def-quick-btn">換投<small>換掉 ${gameState.teams[defKey].name} ${pitcherNow ? pitcherNow.name : '—'}</small></button>
            </div>` : '';
        managementContainer.innerHTML = `
            ${quickSubs}
            <div class="def-hint">${hint}</div>
            <svg class="def-field" viewBox="18 25 370 365" role="img" aria-label="守備位置圖">
                <image href="./img/field.png" x="0" y="0" width="412" height="402"/>
                ${nodes}
            </svg>
            ${unplaced.length ? `<div class="def-group"><h4>場上（未定守位）</h4><div class="def-chips">${unplaced.map(p => chip(p, 'field', ` <em>${orderOf(p._id) ? orderOf(p._id) + '棒' : ''}${p.pos ? ' ' + p.pos : ''}</em>`)).join('')}</div></div>` : ''}
            <div class="def-group"><h4>板凳球員${bench.length ? '' : '（無）'}</h4>
                <div class="def-chips">${bench.map(p => chip(p, 'bench')).join('') || '<span class="def-empty">請先在名單頁新增板凳球員</span>'}</div>
            </div>`;
    }
    function handleManagementInteraction(e) {
        const target = e.target as HTMLElement;
        const popover = target.closest('.substitution-popover');
        if (popover) {
            handlePopoverClick(e);
            return;
        }
        const tabBtn = target.closest('.tab-btn') as HTMLButtonElement | null;
        if (tabBtn) {
            managementState.activeTeamKey = tabBtn.dataset.teamKey as 'a' | 'b';
            managementState.selectedPlayer = null;
            renderManagementModal();
            return;
        }
        const node = target.closest('[data-player-id]') as HTMLElement | null;
        if (!node) {
            if (managementState.selectedPlayer) {
                managementState.selectedPlayer = null;
                renderManagementModal();
            }
            return;
        }
        const playerId = node.dataset.playerId;
        const source = node.dataset.source as 'field' | 'bench';
        const current = managementState.selectedPlayer;
        if (!current) {
            managementState.selectedPlayer = { id: playerId, source, element: node };
            renderManagementModal();
            return;
        }
        if (current.id === playerId) {
            managementState.selectedPlayer = null;
            renderManagementModal();
            return;
        }
        const teamKey = managementState.activeTeamKey;
        if (current.source === 'field' && source === 'field') {
            processDefensiveSwap(current.id, playerId);               // 兩個守位互換
        }
        else if (current.source === 'bench' && source === 'field') {
            const out = getPlayerById(teamKey, playerId);
            processSubstitution(current.id, playerId, posOfOnField(teamKey, out));   // 板凳接替該守位
        }
        else if (current.source === 'field' && source === 'bench') {
            const out = getPlayerById(teamKey, current.id);
            processSubstitution(playerId, current.id, posOfOnField(teamKey, out));
        }
        else {
            managementState.selectedPlayer = { id: playerId, source, element: node };
            renderManagementModal();
        }
    }
    function posOfOnField(teamKey: 'a' | 'b', player) {
        const team = gameState.teams[teamKey];
        if (player._id === team.activePitcherId) return 'P';
        return player.pos || 'PH';
    }
    function removePopover() {
        const existingPopover = document.getElementById('substitution-popover');
        if (existingPopover)
            existingPopover.remove();
    }
    function showSubstitutionPopover(playerInId, playerOutId, targetElement) {
        removePopover();
        const teamKey = managementState.activeTeamKey;
        const team = gameState.teams[teamKey];
        const playerIn = getPlayerById(teamKey, playerInId);
        const playerOut = getPlayerById(teamKey, playerOutId);
        const availablePositions = { ...POSITIONS };
        if (team.useDH)
            delete availablePositions['P'];
        else
            delete availablePositions['DH'];
        const posOptions = Object.keys(availablePositions).map(abbr => `<option value="${abbr}" ${playerOut.pos === abbr ? 'selected' : ''}>${abbr} - ${availablePositions[abbr]}</option>`).join('');
        const popoverHTML = `
            <p>將 <strong>${playerOut.name} (${playerOut.pos})</strong><br/>換成 <strong>${playerIn.name}</strong></p>
            <label for="new-position-select-popover">請選擇新守備位置:</label>
            <select id="new-position-select-popover">${posOptions}</select>
            <div class="substitution-popover-actions">
                <button class="popover-confirm-btn" data-action="confirm-sub" data-in="${playerInId}" data-out="${playerOutId}">確定</button>
                <button class="popover-cancel-btn" data-action="cancel">取消</button>
            </div>
        `;
        const popover = document.createElement('div');
        popover.id = 'substitution-popover';
        popover.className = 'substitution-popover';
        popover.innerHTML = popoverHTML;
        const modalContent = managementModal.querySelector('.management-modal-content');
        modalContent.appendChild(popover);
        const targetRect = targetElement.getBoundingClientRect();
        const modalRect = modalContent.getBoundingClientRect();
        popover.style.top = `${targetRect.top - modalRect.top}px`;
        popover.style.left = `${targetRect.right - modalRect.left + 10}px`;
    }
    function showSwapPopover(player1Id, player2Id, targetElement) {
        removePopover();
        const teamKey = managementState.activeTeamKey;
        const player1 = getPlayerById(teamKey, player1Id);
        const player2 = getPlayerById(teamKey, player2Id);
        const popoverHTML = `
            <p>確定要將 <strong>${player1.name} (${player1.pos})</strong><br/>與 <strong>${player2.name} (${player2.pos})</strong><br/>交換守備位置嗎?</p>
            <div class="substitution-popover-actions">
                <button class="popover-confirm-btn" data-action="confirm-swap" data-p1="${player1Id}" data-p2="${player2Id}">確定</button>
                <button class="popover-cancel-btn" data-action="cancel">取消</button>
            </div>
        `;
        const popover = document.createElement('div');
        popover.id = 'substitution-popover';
        popover.className = 'substitution-popover';
        popover.innerHTML = popoverHTML;
        const modalContent = managementModal.querySelector('.management-modal-content');
        modalContent.appendChild(popover);
        const targetRect = targetElement.getBoundingClientRect();
        const modalRect = modalContent.getBoundingClientRect();
        popover.style.top = `${targetRect.top - modalRect.top}px`;
        popover.style.left = `${targetRect.right - modalRect.left + 10}px`;
    }
    function handlePopoverClick(e) {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button)
            return;
        const { action, in: playerInId, out: playerOutId, p1: player1Id, p2: player2Id } = button.dataset;
        if (action === 'cancel') {
            removePopover();
            managementState.selectedPlayer = null;
            renderManagementModal();
        }
        else if (action === 'confirm-sub') {
            const newPos = (document.getElementById('new-position-select-popover') as HTMLSelectElement).value;
            processSubstitution(playerInId, playerOutId, newPos);
        }
        else if (action === 'confirm-swap') {
            processDefensiveSwap(player1Id, player2Id);
        }
    }
    function processSubstitution(playerInId, playerOutId, newPos) {
        saveStateForUndo();
        const teamKey = managementState.activeTeamKey;
        const team = gameState.teams[teamKey];
        const playerIn = getPlayerById(teamKey, playerInId);
        const playerOut = getPlayerById(teamKey, playerOutId);
        // 要在改打序格之前判斷：被換下的人此刻是不是正要打擊（→ 代打 PH）
        const wasBattingNow = getCurrentBatter()?._id === playerOutId;
        playerIn.pos = newPos;
        const spotIndex = team.lineupSpots.findIndex(s => s.activePlayerId === playerOutId);
        const baseIndex = gameState.bases.findIndex(r => r?.runnerId === playerOutId);
        let subType = '';
        if (playerOut._id === team.activePitcherId) {
            team.activePitcherId = playerInId;
            if (!team.pitchers.some(p => p._id === playerInId)) {
                team.pitchers.push({
                    _id: playerInId, name: playerIn.name, outsRecorded: 0, h: 0, r: 0, er: 0,
                    bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0,
                });
            }
            subType = '更換投手';
        }
        if (spotIndex !== -1) {
            team.lineupSpots[spotIndex].activePlayerId = playerInId;
            team.lineupSpots[spotIndex].history.push(playerInId);
            subType = '代打';
        }
        if (baseIndex !== -1) {
            gameState.bases[baseIndex].runnerId = playerInId;
            subType = '代跑';
        }
        // 戰況表／成績表要標示替補類型：代打 PH、代跑 PR、守備替補寫守位
        if (spotIndex !== -1) {
            const spot = team.lineupSpots[spotIndex] as any;
            spot.subInfo = spot.subInfo || {};
            spot.subInfo[playerInId] = subType === '代跑' ? 'PR' : (wasBattingNow ? 'PH' : (newPos || 'PH'));
        }
        logEvent(`球員調度: ${playerIn.name} (${newPos}) ${subType} ${playerOut.name}。`, teamKey);
        removePopover();
        managementState.selectedPlayer = null;
        renderManagementModal();
        render(); // Re-render main UI
        saveState();
    }
    function processDefensiveSwap(player1Id, player2Id) {
        saveStateForUndo();
        const teamKey = managementState.activeTeamKey;
        const player1 = getPlayerById(teamKey, player1Id);
        const player2 = getPlayerById(teamKey, player2Id);
        const pos1 = player1.pos;
        const pos2 = player2.pos;
        player1.pos = pos2;
        player2.pos = pos1;
        logEvent(`守備調度: ${player1.name} 移防至 ${pos2}, ${player2.name} 移防至 ${pos1}。`, teamKey);
        removePopover();
        managementState.selectedPlayer = null;
        renderManagementModal();
        render(); // Re-render main UI
        saveState();
    }
    function getBoxScoreDataForExport() {
        const data = {};
        ['a', 'b'].forEach(teamKey => {
            const team = gameState.teams[teamKey];
            const teamData = {
                name: team.name,
                batting: [],
                battingTotals: {},
                pitching: [],
                pitchingTotals: {}
            };

            // Batting Data
            team.lineupSpots.forEach((spot, index) => {
                spot.history.forEach((playerId, historyIndex) => {
                    const player = team.roster.find(p => p._id === playerId);
                    if (!player) return;
                    const isSubstitute = historyIndex > 0;
                    const playerName = isSubstitute ? `  ↳ ${player.name}, ${player.pos}` : `${index + 1}. ${player.name}, ${player.pos}`;
                    const avg = player.ab > 0 ? (player.h / player.ab) : 0;
                    const obp_numerator = player.h + player.bb + player.hbp;
                    const obp_denominator = player.ab + player.bb + player.hbp + player.sf;
                    const obp = obp_denominator > 0 ? (obp_numerator / obp_denominator) : 0;
                    const slg = player.ab > 0 ? (player.tb / player.ab) : 0;
                    teamData.batting.push({
                        player: playerName, pa: player.pa, ab: player.ab, r: player.r, h: player.h, rbi: player.rbi,
                        '2b': player['2b'], '3b': player['3b'], hr: player.hr, sb: player.sb, bb: player.bb,
                        hbp: player.hbp, so: player.so, sf: player.sf, sh: player.sh, gidp: player.gidp,
                        tb: player.tb, avg: avg, obp: obp, slg: slg, ops: obp + slg
                    });
                });
            });

            // Batting Totals
            const totals = { pa: 0, ab: 0, r: 0, h: 0, rbi: 0, '2b': 0, '3b': 0, hr: 0, gidp: 0, bb: 0, hbp: 0, so: 0, sf: 0, sh: 0, sb: 0, tb: 0 };
            const teamTotals = team.roster.reduce((acc, player) => {
                if (player.pos === 'P' && !team.lineupSpots.some(s => s.history.includes(player._id))) return acc;
                for (const key in totals) acc[key] += Number(player[key] || 0);
                return acc;
            }, { ...totals });
            const total_obp_numerator = teamTotals.h + teamTotals.bb + teamTotals.hbp;
            const total_obp_denominator = teamTotals.ab + teamTotals.bb + teamTotals.hbp + teamTotals.sf;
            teamTotals.obp = total_obp_denominator > 0 ? (total_obp_numerator / total_obp_denominator) : 0;
            teamTotals.slg = teamTotals.ab > 0 ? (teamTotals.tb / teamTotals.ab) : 0;
            teamTotals.ops = teamTotals.obp + teamTotals.slg;
            teamTotals.avg = teamTotals.ab > 0 ? (teamTotals.h / teamTotals.ab) : 0;
            teamData.battingTotals = teamTotals;

            // Pitching Data
            team.pitchers.forEach(pitcher => {
                const era = pitcher.outsRecorded > 0 ? (pitcher.er * 9 / (pitcher.outsRecorded / 3)) : 0;
                const whip_denominator = pitcher.outsRecorded / 3;
                const whip = whip_denominator > 0 ? ((pitcher.bb + pitcher.h) / whip_denominator) : 0;
                teamData.pitching.push({
                    pitcher: pitcher.name, outsRecorded: pitcher.outsRecorded, h: pitcher.h, r: pitcher.r, er: pitcher.er, bb: pitcher.bb, k: pitcher.k, hr: pitcher.hr,
                    bf: pitcher.bf, wp: pitcher.wp, bk: pitcher.bk, hbp: pitcher.hbp, ibb: pitcher.ibb, era, whip
                });
            });
            
            // Pitching Totals
            const pTotals = { outsRecorded: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0 };
            team.pitchers.forEach(pitcher => {
                for (const key in pTotals) pTotals[key] += Number(pitcher[key] || 0);
            });
            const era = pTotals.outsRecorded > 0 ? (pTotals.er * 9 / (pTotals.outsRecorded / 3)) : 0;
            const totalWhip_denominator = pTotals.outsRecorded / 3;
            const whip = totalWhip_denominator > 0 ? ((pTotals.bb + pTotals.h) / totalWhip_denominator) : 0;
            teamData.pitchingTotals = { ...pTotals, outsRecorded: pTotals.outsRecorded, era, whip };
            
            data[teamKey] = teamData;
        });
        return data;
    }
    function exportBoxScoreToCSV() {
        // FIX: The `str` parameter could be of various types from the data object. Changing `unknown` to `any` resolves the error by allowing string methods to be called after explicit conversion with `String()`.
        const escapeCSV = (str: any) => {
            const s = String(str);
            let result = s.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0) {
                result = `"${result}"`;
            }
            return result;
        };
        const battingHeaders = ['球員', '打席', '打數', '得分', '安打', '打點', '二安', '三安', '全壘打', '盜壘', '四壞', '觸身', '三振', '犧飛', '犧短', '雙殺打', '打擊率', '上壘率', 'OPS'];
        const pitchingHeaders = ['投手', '局數', '面對打席', '安打', '失分', '責失', '四壞', '死球', '三振', '被全壘打', '暴投', '投手犯規', '故意四壞', '防禦率', 'WHIP'];
        let csvContent = [];
        const calculateStatString = (value) => {
            if (isNaN(value) || !isFinite(value))
                return '0.000';
            return value.toFixed(3);
        };
        const data = getBoxScoreDataForExport();

        ['a', 'b'].forEach(teamKey => {
            const teamData = data[teamKey];
            
            // Batting stats
            csvContent.push([teamData.name + ' 打擊成績']);
            csvContent.push(battingHeaders);
            teamData.batting.forEach(player => {
                csvContent.push([
                    player.player, player.pa, player.ab, player.r, player.h, player.rbi,
                    player['2b'], player['3b'], player.hr, player.sb, player.bb,
                    player.hbp, player.so, player.sf, player.sh, player.gidp,
                    calculateStatString(player.avg), calculateStatString(player.obp), calculateStatString(player.ops)
                ]);
            });

            // Batting Totals
            const teamTotals = teamData.battingTotals;
            csvContent.push([
                '合計', teamTotals.pa, teamTotals.ab, teamTotals.r, teamTotals.h, teamTotals.rbi,
                teamTotals['2b'], teamTotals['3b'], teamTotals.hr, teamTotals.sb, teamTotals.bb,
                teamTotals.hbp, teamTotals.so, teamTotals.sf, teamTotals.sh, teamTotals.gidp,
                calculateStatString(teamTotals.avg), calculateStatString(teamTotals.obp), calculateStatString(teamTotals.slg)
            ]);
            csvContent.push([]); // Spacer row

            // Pitching Stats
            csvContent.push([teamData.name + ' 投球成績']);
            csvContent.push(pitchingHeaders);
            teamData.pitching.forEach(pitcher => {
                const ipWhole = Math.floor(pitcher.outsRecorded / 3);
                const ipFrac = pitcher.outsRecorded % 3;
                const ip = `${ipWhole}.${ipFrac}`;
                csvContent.push([
                    pitcher.pitcher, ip, pitcher.bf, pitcher.h, pitcher.r, pitcher.er, pitcher.bb, pitcher.hbp, pitcher.k, pitcher.hr,
                    pitcher.wp, pitcher.bk, pitcher.ibb, pitcher.era.toFixed(2), pitcher.whip.toFixed(2)
                ]);
            });

            // Pitching Totals
            const pTotals = teamData.pitchingTotals;
            const totalIpWhole = Math.floor(pTotals.outsRecorded / 3);
            const totalIpFrac = pTotals.outsRecorded % 3;
            const totalIp = `${totalIpWhole}.${totalIpFrac}`;
            csvContent.push([
                '合計', totalIp, pTotals.bf, pTotals.h, pTotals.r, pTotals.er, pTotals.bb, pTotals.hbp, pTotals.k, pTotals.hr,
                pTotals.wp, pTotals.bk, pTotals.ibb, pTotals.era.toFixed(2), pTotals.whip.toFixed(2)
            ]);
            csvContent.push([]); // Spacer row after team block
        });

        const csvString = csvContent.map(row => row.map(escapeCSV).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for BOM to help Excel
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const awayTeamName = gameState.teams.a.name || '客隊';
        const homeTeamName = gameState.teams.b.name || '主隊';
        const gameDate = gameState.gameDate || new Date().toISOString().split('T')[0];
        const filename = `${homeTeamName} vs ${awayTeamName} 總表 ${gameDate}.csv`;
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    function exportBoxScoreToXLSX() {
        // Define headers, including raw data columns for formulas
        const battingHeaders = ['球員', 'PA', 'AB', 'R', 'H', 'RBI', '2B', '3B', 'HR', 'SB', 'BB', 'HBP', 'SO', 'SF', 'SH', 'GIDP', 'AVG', 'OBP', 'SLG', 'TB'];
        const pitchingHeaders = ['投手', 'Outs', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'BF', 'WP', 'BK', 'HBP', 'IBB', 'ERA', 'WHIP'];
        const data = getBoxScoreDataForExport();
        const wb = XLSX.utils.book_new();

        ['a', 'b'].forEach(teamKey => {
            const teamData = data[teamKey];
            const ws_data = [];
            // --- BATTING ---
            ws_data.push([`${teamData.name} 打擊成績`]);
            ws_data.push(battingHeaders);
            const batting_data_start_row = ws_data.length + 1;
            teamData.batting.forEach(p => {
                ws_data.push([
                    p.player, p.pa, p.ab, p.r, p.h, p.rbi, p['2b'], p['3b'], p.hr, p.sb, p.bb, p.hbp, p.so, p.sf, p.sh, p.gidp,
                    p.avg, p.obp, p.ops, p.tb
                ]);
            });
            const batting_data_end_row = ws_data.length;
            const bt = teamData.battingTotals;
            ws_data.push([
                '合計', bt.pa, bt.ab, bt.r, bt.h, bt.rbi, bt['2b'], bt['3b'], bt.hr, bt.sb, bt.bb, bt.hbp, bt.so, bt.sf, bt.sh, bt.gidp,
                bt.avg, bt.obp, bt.ops, bt.tb
            ]);
            const batting_total_row = ws_data.length;
            ws_data.push([]); // Spacer

            // --- PITCHING ---
            ws_data.push([`${teamData.name} 投球成績`]);
            ws_data.push(pitchingHeaders);
            const pitching_data_start_row = ws_data.length + 1;
            teamData.pitching.forEach(p => {
                ws_data.push([
                    p.pitcher, p.outsRecorded, (p.outsRecorded / 3), p.h, p.r, p.er, p.bb, p.k, p.hr, p.bf, p.wp, p.bk, p.hbp, p.ibb,
                    p.era, p.whip
                ]);
            });
            const pitching_data_end_row = ws_data.length;
            const pt = teamData.pitchingTotals;
            ws_data.push([
                '合計', pt.outsRecorded, (pt.outsRecorded / 3), pt.h, pt.r, pt.er, pt.bb, pt.k, pt.hr, pt.bf, pt.wp, pt.bk, pt.hbp, pt.ibb,
                pt.era, pt.whip
            ]);
            const pitching_total_row = ws_data.length;

            const ws = XLSX.utils.aoa_to_sheet(ws_data);

            // --- ADD FORMULAS AND FORMATTING ---
            const addFormulaToRange = (startRow, endRow, formulas) => {
                for (let R = startRow - 1; R < endRow; R++) {
                    const rowNum = R + 1;
                    for (const [colIndex, formulaTemplate] of Object.entries(formulas)) {
                        const cellRef = XLSX.utils.encode_cell({ r: R, c: parseInt(colIndex) });
                        if (ws[cellRef]) {
                            ws[cellRef].f = formulaTemplate.replace(/##/g, rowNum.toString());
                        }
                    }
                }
            };
            
            // Batting Formulas (Player Rows)
            addFormulaToRange(batting_data_start_row, batting_data_end_row, {
                15: 'IFERROR(E##/C##,0)', // AVG = H/AB
                16: 'IFERROR((E##+K##+L##)/(C##+K##+L##+N##),0)', // OBP = (H+BB+HBP)/(AB+BB+HBP+SF)
                17: 'IFERROR(S##/C##,0)'  // SLG = TB/AB
            });

            // Batting Totals Row Formulas
            const bTotalR = batting_total_row - 1;
            for (let C = 1; C <= 14; C++) { // Sum PA to GIDP
                const colLetter = XLSX.utils.encode_col(C);
                const cellAddress = XLSX.utils.encode_cell({ r: bTotalR, c: C });
                if (ws[cellAddress]) {
                    ws[cellAddress].f = `SUM(${colLetter}${batting_data_start_row}:${colLetter}${batting_data_end_row})`;
                    delete ws[cellAddress].v; // Remove pre-calculated value
                }
            }
            const tbTotalCellAddress = XLSX.utils.encode_cell({ r: bTotalR, c: 18 });
            if (ws[tbTotalCellAddress]) {
                ws[tbTotalCellAddress].f = `SUM(S${batting_data_start_row}:S${batting_data_end_row})`; // SUM TB
                delete ws[tbTotalCellAddress].v;
            }
            addFormulaToRange(batting_total_row, batting_total_row, {
                15: 'IFERROR(E##/C##,0)',
                16: 'IFERROR((E##+K##+L##)/(C##+K##+L##+N##),0)',
                17: 'IFERROR(S##/C##,0)'
            });

             // Pitching Formulas (Player Rows)
            addFormulaToRange(pitching_data_start_row, pitching_data_end_row, {
                2: 'B##/3', // IP = Outs/3
                14: 'IFERROR(F##*9/(B##/3),0)', // ERA = ER*9/IP
                15: 'IFERROR((G##+D##)/(B##/3),0)' // WHIP = (BB+H)/IP
            });

            // Pitching Totals Row Formulas
            const pTotalR = pitching_total_row - 1;
            const outsTotalCellAddress = XLSX.utils.encode_cell({ r: pTotalR, c: 1 });
            if (ws[outsTotalCellAddress]) {
                ws[outsTotalCellAddress].f = `SUM(B${pitching_data_start_row}:B${pitching_data_end_row})`; // Sum Outs
                delete ws[outsTotalCellAddress].v;
            }
            for (let C = 3; C <= 13; C++) { // Sum H to IBB
                const colLetter = XLSX.utils.encode_col(C);
                const cellAddress = XLSX.utils.encode_cell({ r: pTotalR, c: C });
                if (ws[cellAddress]) {
                    ws[cellAddress].f = `SUM(${colLetter}${pitching_data_start_row}:${colLetter}${pitching_data_end_row})`;
                    delete ws[cellAddress].v;
                }
            }
            addFormulaToRange(pitching_total_row, pitching_total_row, {
                2: 'B##/3',
                14: 'IFERROR(F##*9/(B##/3),0)',
                15: 'IFERROR((G##+D##)/(B##/3),0)'
            });
            
             // Number Formatting
            for (let R = batting_data_start_row - 1; R < batting_total_row; R++) {
                ['f0.000', 'f0.000', 'f0.000'].forEach((fmt, i) => { ws[XLSX.utils.encode_cell({r:R, c:15+i})].z = fmt; });
            }
            for (let R = pitching_data_start_row - 1; R < pitching_total_row; R++) {
                ws[XLSX.utils.encode_cell({r:R, c:2})].z = '# ??/3'; // IP as fraction
                ws[XLSX.utils.encode_cell({r:R, c:14})].z = '0.00'; // ERA
                ws[XLSX.utils.encode_cell({r:R, c:15})].z = '0.00'; // WHIP
            }
            
            // Auto-fit columns and hide raw data columns
            // FIX: Add explicit type to `colWidths` to allow both `wch` and `hidden` properties, fixing assignment errors.
            const colWidths: { wch?: number; hidden?: boolean; }[] = battingHeaders.map((h, i) => ({ wch: (i === 0 ? 25 : h.length + 5) }));
            colWidths[18] = { hidden: true }; // Hide Batting TB (Col S)
            colWidths[1] = { hidden: true }; // Hide Pitching Outs (Col B)
            ws['!cols'] = colWidths;
            
            XLSX.utils.book_append_sheet(wb, ws, teamData.name);
        });
        
        const awayTeamName = gameState.teams.a.name || '客隊';
        const homeTeamName = gameState.teams.b.name || '主隊';
        const gameDate = gameState.gameDate || new Date().toISOString().split('T')[0];
        const filename = `${homeTeamName} vs ${awayTeamName} 總表 ${gameDate}.xlsx`;
        XLSX.writeFile(wb, filename);
    }
    function exportEventLogToTxt() {
        const { teams, gameDate, events } = gameState;
        if (!events || events.length === 0) {
            alert('沒有事件可匯出。');
            return;
        }
        const logContent = events.map(event => event.text).join('\n');
        const blob = new Blob(['\uFEFF' + logContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const awayTeamName = teams.a.name || '客隊';
        const homeTeamName = teams.b.name || '主隊';
        const date = gameDate || new Date().toISOString().split('T')[0];
        const filename = `${homeTeamName} vs ${awayTeamName} 文字轉播 ${date}.txt`;
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    function getRosterFromForm(teamKey) {
        const teamName = (document.getElementById(`team-${teamKey}-name`) as HTMLInputElement).value;
        const useDH = (document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement).checked;
        const roster = Array.from({ length: ROSTER_SIZE }, () => ({ name: '', jersey: '', photo: DEFAULT_PLAYER_PHOTO_BASE64 }));
        // 依畫面上的排列讀取，這樣拖曳過棒次還沒套用時，存下來的也是眼睛看到的順序
        const readRow = (row: HTMLElement) => {
            const nameInput = row.querySelector('input[data-type="name"]') as HTMLInputElement | null;
            if (!nameInput) return null;
            const idx = nameInput.dataset.index;
            const preview = document.getElementById(`player-photo-preview-${teamKey}-${idx}`) as HTMLImageElement | null;
            return {
                name: nameInput.value,
                jersey: (row.querySelector('input[data-type="jersey"]') as HTMLInputElement)?.value || '',
                pos: (row.querySelector('select[data-type="pos"]') as HTMLSelectElement)?.value || '',
                photo: (preview && !isGeneratedAvatar(preview.src)) ? preview.src : DEFAULT_PLAYER_PHOTO_BASE64
            };
        };
        const lineupC = document.getElementById(`team-${teamKey}-lineup`);
        const benchC = document.getElementById(`team-${teamKey}-bench`);
        const rows = [...(lineupC ? lineupC.querySelectorAll('.lineup-player') : []),
                      ...(benchC ? benchC.querySelectorAll('.lineup-player') : [])] as HTMLElement[];
        let slot = 0;
        rows.forEach(row => {
            if (slot >= ROSTER_SIZE) return;
            if (slot === PITCHER_ROSTER_INDEX && useDH) slot++;   // 專屬投手欄另外處理
            const data = readRow(row);
            if (data) roster[slot++] = data;
        });
        // Get dedicated DH pitcher
        if (useDH) {
            roster[PITCHER_ROSTER_INDEX] = {
                name: (document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement).value,
                jersey: (document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement).value,
                photo: (() => {
                    const src = (document.getElementById(`player-photo-preview-${teamKey}-${PITCHER_ROSTER_INDEX}`) as HTMLImageElement).src;
                    return isGeneratedAvatar(src) ? DEFAULT_PLAYER_PHOTO_BASE64 : src;
                })()
            };
        }
        return { name: teamName, useDH, roster };
    }
    // Renders the list of saved rosters in the modal.
    function renderSavedRostersList() {
        const savedRosters = JSON.parse(localStorage.getItem(SAVED_ROSTERS_KEY) || '[]');
        if (savedRosters.length === 0) {
            savedRostersList.innerHTML = '<p>沒有已儲存的名單。</p>';
        }
        else {
            savedRostersList.innerHTML = savedRosters.map(roster => `
                <div class="saved-roster-item">
                    <span class="saved-roster-item-name">${roster.name}</span>
                    <div class="saved-roster-item-actions">
                        <button class="load-roster-item-btn" data-roster-id="${roster.id}">載入</button>
                        <button class="delete-roster-item-btn" data-roster-id="${roster.id}">刪除</button>
                    </div>
                </div>
            `).join('');
        }
    }
    function saveRoster(teamKey: 'a' | 'b') {
        const teamDataFromForm = getRosterFromForm(teamKey);
        const teamName = teamDataFromForm.name.trim();
        if (!teamName) {
            alert('請輸入隊伍名稱以儲存名單。');
            return;
        }
        const savedRosters = JSON.parse(localStorage.getItem(SAVED_ROSTERS_KEY) || '[]');
        // 照片是 base64，容量很容易超過瀏覽器上限；失敗時要明講而不是靜靜失敗
        const writeRosters = (data) => {
            try {
                localStorage.setItem(SAVED_ROSTERS_KEY, JSON.stringify(data));
                return true;
            }
            catch (err) {
                alert('儲存失敗：瀏覽器的儲存空間不足，通常是球員照片太大。\n請改用較小的照片，或先刪除幾份用不到的名單再試一次。');
                return false;
            }
        };
        // Use a case-insensitive search to find if a roster with the same name already exists.
        const existingRosterIndex = savedRosters.findIndex(r => r.name.toLowerCase() === teamName.toLowerCase());
        // 守位與 DH 設定也要一起存，否則讀回來時守備位置會是畫面上的舊值
        const newRosterData = {
            name: teamName,
            useDH: teamDataFromForm.useDH,
            roster: teamDataFromForm.roster.map((p: any) =>
                ({ name: p.name, jersey: p.jersey, pos: p.pos || '', photo: p.photo }))
        };
        if (existingRosterIndex > -1) {
            const existingRoster = savedRosters[existingRosterIndex];
            // Ask for confirmation to overwrite, showing the existing name's casing.
            if (confirm(`名單 "${existingRoster.name}" 已存在。您想要覆蓋它嗎？`)) {
                // Overwrite the existing roster, keeping its ID but updating the name and content.
                savedRosters[existingRosterIndex] = { ...newRosterData, id: existingRoster.id };
                if (!writeRosters(savedRosters)) return;
                alert(`名單 "${teamName}" 已成功覆蓋！`);
            }
        }
        else {
            // This is a new roster, so save it with a new unique ID.
            const newRoster = {
                ...newRosterData,
                id: `${teamName}_${Date.now()}`
            };
            savedRosters.push(newRoster);
            if (!writeRosters(savedRosters)) return;
            alert(`名單 "${newRoster.name}" 已儲存！`);
        }
    }
    function openLoadRosterModal(teamKey) {
        renderSavedRostersList();
        // Store the target teamKey on the modal for the click handler
        loadRosterModal.dataset.teamKey = teamKey;
        openModal(loadRosterModal);
    }
    function handleLoadRosterModalClick(e: MouseEvent) {
        // Only respond to the main mouse button (left-click)
        if (e.button !== 0) {
            return;
        }
        // Stop the event from bubbling up to prevent any other handlers
        // (like modal dragging) from interfering.
        e.stopPropagation();
        const target = e.target as HTMLElement;
        const loadButton = target.closest('.load-roster-item-btn');
        const deleteButton = target.closest('.delete-roster-item-btn');
        if (loadButton) {
            const rosterId = (loadButton as HTMLElement).dataset.rosterId;
            const teamKey = loadRosterModal.dataset.teamKey;
            if (rosterId && teamKey) {
                loadRoster(rosterId, teamKey);
            }
            return;
        }
        if (deleteButton) {
            const rosterId = (deleteButton as HTMLElement).dataset.rosterId;
            if (rosterId) {
                deleteRoster(rosterId);
            }
            return;
        }
    }
    function loadRoster(rosterId, teamKey) {
        const savedRosters = JSON.parse(localStorage.getItem(SAVED_ROSTERS_KEY) || '[]');
        const rosterToLoad = savedRosters.find(r => r.id === rosterId);
        if (!rosterToLoad) {
            alert('找不到指定的名單。');
            return;
        }
        (document.getElementById(`team-${teamKey}-name`) as HTMLInputElement).value = rosterToLoad.name;
        // DH 設定也要跟著回來，否則第 4 棒（DH）與投手欄會對不上
        const dhToggle = document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement | null;
        if (dhToggle && typeof rosterToLoad.useDH === 'boolean') dhToggle.checked = rosterToLoad.useDH;
        // Apply player data to the form
        rosterToLoad.roster.forEach((player, i) => {
            const isDhPitcherSlot = i === PITCHER_ROSTER_INDEX && (document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement).checked;
            if (isDhPitcherSlot) {
                const pitcherNameInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement;
                const pitcherJerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement;
                const pitcherPhotoPreview = document.getElementById(`player-photo-preview-${teamKey}-${PITCHER_ROSTER_INDEX}`) as HTMLImageElement;
                if (pitcherNameInput)
                    pitcherNameInput.value = player.name;
                if (pitcherJerseyInput)
                    pitcherJerseyInput.value = player.jersey;
                if (pitcherPhotoPreview)
                    pitcherPhotoPreview.src = playerPhotoSrc(player);
            }
            else {
                const nameInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement;
                const jerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement;
                const photoPreview = document.getElementById(`player-photo-preview-${teamKey}-${i}`) as HTMLImageElement;
                if (nameInput) {
                    nameInput.value = player.name;
                    jerseyInput.value = player.jersey;
                    // 舊版名單沒有存守位，這時就沿用畫面上的設定
                    const posSelect = document.querySelector(`select[data-team="${teamKey}"][data-index="${i}"][data-type="pos"]`) as HTMLSelectElement | null;
                    if (posSelect && typeof player.pos === 'string') posSelect.value = player.pos;
                    if (photoPreview)
                        photoPreview.src = playerPhotoSrc(player);
                }
            }
        });
        // 有名字的板凳列要跟著現身，否則載進來的板凳球員看起來像不見了
        updateBenchVisibility(teamKey);
        closeModal(loadRosterModal);
        // 名單頁是自動儲存的，載入後直接套用，不用再叫使用者按一次
        // （scheduleAutoApply 定義在名單區塊內部，這裡走它掛在 window 上的入口）
        (window as any).__scheduleAutoApply?.();
        alert(`已載入名單 "${rosterToLoad.name}"。`);
    }
    function deleteRoster(rosterId: string) {
        const savedRosters = JSON.parse(localStorage.getItem(SAVED_ROSTERS_KEY) || '[]');
        const rosterToDelete = savedRosters.find(r => r.id === rosterId);
        if (!rosterToDelete) {
            console.error(`Roster with ID ${rosterId} not found for deletion.`);
            return;
        }
        if (confirm(`確定要刪除名單 "${rosterToDelete.name}" 嗎？`)) {
            const updatedRosters = savedRosters.filter(r => r.id !== rosterId);
            localStorage.setItem(SAVED_ROSTERS_KEY, JSON.stringify(updatedRosters));
            // Re-render the list to ensure the UI is in sync with the latest data.
            renderSavedRostersList();
        }
    }
    init();
});
