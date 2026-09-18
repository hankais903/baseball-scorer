// prettier-ignore
'use strict';
declare var XLSX: any; // Declare the XLSX global object from the CDN script
// 記分規則速查的內容（打包進 APP，離線也查得到）
import { RULE_BOOK, RULE_SOURCE } from './rules-data';

// --- Default Placeholder Images (SVG encoded in Base64) ---
// APP 版號：顯示在主頁標題右邊。**每次交付都要往上加**（小改動加最後一碼）。
const APP_VERSION = 'v2.36';
const TEAM_NAME_MAX = 4;
// 延長局上限，平手打滿即為和局（CPBL 例行賽為 12 局）
const MAX_INNINGS = 12;
    // 依落點區域提供合理的結果選項（位置優先流程）
    // 點球場任一處都用同一組結果；誰處理球在下一步用守備鏈決定。
    // zones 只影響「先顯示哪些」：落點對得上的先列出來，其餘收在「其他結果」裡，
    // 任何結果都還是記得到，只是不用每次都從十幾顆按鈕裡找。
    const ZONE_PLAYS = {
        field: [
            { play: '一安', label: '一壘安打', group: '安打', zones: ['infield', 'outfield'], balls: ['G', 'L', 'F', 'B'] },
            { play: '二安', label: '二壘安打', group: '安打', zones: ['outfield'], balls: ['G', 'L', 'F'] },
            { play: '場地二安', label: '場地二壘打', group: '安打', zones: ['outfield', 'foul'], balls: ['G', 'L', 'F'] },
            { play: '三安', label: '三壘安打', group: '安打', zones: ['outfield'], balls: ['G', 'L', 'F'] },
            { play: '本打', label: '全壘打', group: '安打', zones: ['outfield'], balls: ['L', 'F'] },
            { play: '內安', label: '內野安打', group: '安打', zones: ['infield'], balls: ['G', 'B'] },
            { play: '滾地', label: '滾地出局', out: true, group: '出局', zones: ['infield'], balls: ['G', 'B'] },
            { play: '飛球', label: '飛球出局', out: true, group: '出局', zones: ['infield', 'outfield'], balls: ['L', 'F'] },
            { play: '界飛', label: '界外飛球接殺', out: true, group: '出局', zones: ['foul'], balls: ['L', 'F', 'B'] },
            { play: '犧飛', label: '高飛犧牲', out: true, group: '出局', zones: ['outfield'], balls: ['F'] },
            { play: '犧短', label: '犧牲觸擊', out: true, group: '出局', zones: ['infield', 'foul'], balls: ['B'] },
            { play: '雙殺', label: '雙殺', out: true, group: '出局', zones: ['infield'], balls: ['G', 'L', 'F', 'B'] },
            { play: '三殺', label: '三殺', out: true, group: '出局', zones: ['infield'], balls: ['G', 'L', 'F'] },
            { play: '失誤', label: '失誤上壘', group: '其他', zones: ['infield', 'outfield', 'foul'], balls: ['G', 'L', 'F', 'B'] },
            { play: '野手選擇', label: '野手選擇', group: '其他', zones: ['infield'], balls: ['G', 'B'] },
            { play: '妨礙守備', label: '妨礙守備', out: true, group: '其他', zones: ['infield', 'foul'], balls: ['G', 'B'] },
            // 內野高飛必死球：只有「一二壘有人或滿壘、不到兩出局」才成立，用 when 擋掉其他情況
            { play: '內飛', label: '內野高飛必死球', out: true, group: '出局', zones: ['infield'], balls: ['L', 'F'], when: 'infieldFly' }
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

// mainPointToMini 的反向換算：把存起來的小圖座標放回主球場上
function miniPointToMain(p: { x: number; y: number }) {
    const dx = p.x - MINI_FIELD_GEO.hx;
    const dy = p.y - MINI_FIELD_GEO.hy;
    const rm = Math.hypot(dx, dy);
    if (rm < 0.5) return { x: MAIN_FIELD_GEO.hx, y: MAIN_FIELD_GEO.hy };
    let r;
    if (rm <= MINI_FIELD_GEO.rInfield) {
        r = rm / MINI_FIELD_GEO.rInfield * MAIN_FIELD_GEO.rInfield;
    }
    else {
        const t = (rm - MINI_FIELD_GEO.rInfield) / (MINI_FIELD_GEO.rFence - MINI_FIELD_GEO.rInfield);
        r = MAIN_FIELD_GEO.rInfield + t * (MAIN_FIELD_GEO.rFence - MAIN_FIELD_GEO.rInfield);
    }
    return {
        x: Math.round(MAIN_FIELD_GEO.hx + dx / rm * r),
        y: Math.round(MAIN_FIELD_GEO.hy + dy / rm * r)
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
        + '<defs><linearGradient id="jn" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="#24406f"/><stop offset="1" stop-color="#16294d"/></linearGradient></defs>'
        + '<rect width="75" height="100" fill="url(#jn)" rx="6"/><desc data-avatar="jersey"></desc>'
        + '<text x="37.5" y="50" fill="#cfe0ff" font-family="-apple-system, Segoe UI, Roboto, sans-serif"'
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
// 主頁打者卡專用：沒上傳照片就放卡通小打者（名單頁仍用背號，十幾個人才分得出誰是誰）
const BATTER_DEFAULT_PHOTO = './img/batter-default.jpg';
function batterPhotoSrc(player) {
    const photo = player && player.photo;
    if (photo && photo !== DEFAULT_PLAYER_PHOTO_BASE64 && !isGeneratedAvatar(photo)) return photo;
    return BATTER_DEFAULT_PHOTO;
}

let currentPanelIndex = 1; // 0: settings, 1: main, 2: log
document.addEventListener('DOMContentLoaded', () => {
    const POSITIONS = {
        'P': '投手', 'C': '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手',
        'SS': '游擊手', 'LF': '左外野手', 'CF': '中外野手', 'RF': '右外野手', 'DH': '指定打擊'
    };
    const ERROR_POSITIONS = {
        'P': '投手', 'C': '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手',
        'SS': '游擊手', 'LF': '左外野手', 'CF': '中外野手', 'RF': '右外野手'
    };
    // 守備鏈用的代號（投捕一二三游左中右）對應到名單上的守位代號
    const CHAIN_TO_POS = {
        '投': 'P', '捕': 'C', '一': '1B', '二': '2B', '三': '3B',
        '游': 'SS', '左': 'LF', '中': 'CF', '右': 'RF'
    };
    const ERROR_ABBREVIATIONS = {
        'P': '投失', 'C': '捕失', '1B': '一失', '2B': '二失', '3B': '三失',
        'SS': '游失', 'LF': '左失', 'CF': '中失', 'RF': '右失'
    };
    // prettier-ignore
    const PLAY_TYPES = {
        // FIX: Quoted key 'out' to prevent parsing errors.
        'out': ['三振', '滾地', '飛球', '界飛', '雙殺', '犧飛', '犧短', '三殺', '妨礙守備', '內飛', '不死三振出局', '打序錯誤'],
        'on-base': ['一安', '四壞', '故意四壞', '場地二安', '二安', '內安', '三安', '本打', '失誤', '觸身球', '野手選擇', '不死三振', '妨礙打擊']
    };
    const PLAY_DESCRIPTIONS = {
        '三振': '三振出局', '滾地': '滾地球出局', '飛球': '飛球出局', '野手選擇': '野手選擇',
        '界飛': '界外飛球，被接殺出局', '雙殺': '造成雙殺', '三殺': '造成三殺',
        '四壞': '四壞保送', '故意四壞': '故意四壞保送', '觸身球': '觸身球保送', '不死三振': '揮空三振但捕手未能接妥', '內安': '內野安打',
        '一安': '一壘安打', '二安': '二壘安打',
        '三安': '三壘安打', '本打': '全壘打', '失誤': '因失誤上壘',
        '場地二安': '場地二壘打（球彈出場外，各進兩個壘）',
        '犧短': '犧牲短打', '犧飛': '高飛犧牲打',
        '妨礙守備': '因妨礙守備出局', '妨礙打擊': '因捕手妨礙打擊上壘',
        '內飛': '內野高飛必死球，打者出局', '不死三振出局': '揮空三振，捕手未接妥後傳一壘刺殺出局',
        '打序錯誤': '打擊順序錯誤，應該打擊的球員被判出局'
    };
    const HIT_BASES = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4, '場地二安': 2 };
    const PLAY_ABBREVIATIONS = {
        '三振': '三振', '滾地': '滾地', '飛球': '飛球', '野手選擇': '野選',
        '界飛': '界飛', '雙殺': '雙殺', '三殺': '三殺',
        '四壞': '四壞', '故意四壞': '故四', '觸身球': '觸身', '不死三振': '不死三振', '內安': '內安', '一安': '一安', '二安': '二安',
        '三安': '三安', '本打': '本打', '失誤': '失誤', '場地二安': '場地二安', '犧短': '犧短', '犧飛': '犧飛',
        '妨礙守備': '妨礙守備', '妨礙打擊': '妨礙打擊',
        '內飛': '內飛', '不死三振出局': '不死三振', '打序錯誤': '打序錯誤',
        // 界外高飛犧牲打（FSF）與場內全壘打（IHR）只是同一個結果的標記，
        // 統計欄位跟犧飛／全壘打完全一樣，差別在記錄符號與敘述。
        '界犧飛': '界犧飛', '場內全打': '場內全打'
    };
    const PLAY_TYPE_CATEGORIES = {
        '三振': 'strikeout',
        '滾地': 'groundout',
        '飛球': 'flyout', '界飛': 'flyout',
        '雙殺': 'special-out', '三殺': 'special-out',
        '犧短': 'sacrifice', '犧飛': 'sacrifice',
        '四壞': 'walk', '故意四壞': 'walk', '觸身球': 'walk', '不死三振': 'walk',
        '內安': 'hit', '一安': 'hit', '二安': 'hit', '三安': 'hit', '本打': 'hit', '場地二安': 'hit',
        '失誤': 'error',
        '野手選擇': 'fielder-choice',
        '妨礙守備': 'interference',
        '妨礙打擊': 'interference',
        '內飛': 'flyout',
        '不死三振出局': 'strikeout',
        '打序錯誤': 'special-out'
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
                        ? `${area}滾地球，一壘手接球踩壘封殺出局${tail}`
                        : `${area}滾地球出局，由${who}處理${tail}`;
                }
                return `${area}滾地球，${chainText(c)}封殺出局${tail}`;
            // 球種要跟著寫：平飛球接殺就不能寫成「高飛球」
            case '飛球': {
                const bw = { L: '平飛球', F: '高飛球', G: '滾地球', B: '短打' }[advancedPlayState.ballType] || '高飛球';
                return `${area}${bw}，被${who}接殺出局${tail}`;
            }
            case '界飛': {
                const bw = { L: '平飛球', F: '高飛球', B: '短打' }[advancedPlayState.ballType] || '高飛球';
                return `界外${bw}，被${who}接殺出局${tail}`;
            }
            case '犧飛':
                return (advancedPlayState as any).foulSF
                    ? `界外高飛犧牲打${tail}`
                    : `${area}高飛犧牲打${tail}`;
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
                        ? `${area}滾地球，${chainText(c)}，形成${kind}${tail}`
                        : `${area}滾地球，${who}接球轉傳形成${kind}${tail}`;
                }
                // 平飛／高飛：打者先被接殺，再傳殺離壘的跑者
                const ball = bt === 'L' ? '平飛球' : '高飛球';
                const names = c.map(f => FIELDER_FULL[f]);
                if (c.length === 1) return `${area}${ball}，${who}接殺後獨力完成${kind}${tail}`;
                const throws = `傳給${names[1]}` + names.slice(2).map(n => `再傳給${n}`).join('');
                return `${area}${ball}，${who}接殺後${throws}，形成${kind}${tail}`;
            }
            case '野手選擇': {
                const last = c[c.length - 1];
                let target = c.length > 1 ? { '捕': '本壘', '一': '一壘', '二': '二壘', '游': '二壘', '三': '三壘' }[last] : '';
                // 只點了一個野手：用「被判出局的跑者」推算他傳去哪個壘
                if (!target && advancedPlayState.outRunnerBase !== null && advancedPlayState.outRunnerBase !== undefined) {
                    target = ['二壘', '三壘', '本壘'][advancedPlayState.outRunnerBase] || '';
                }
                return target
                    ? `${area}滾地球，${who}選擇傳${target}處理跑者${tail}`
                    : `${area}滾地球，守方選擇處理其他跑者${tail}`;
            }
            case '內安': return `${area}內野安打`;
            case '一安': return `${area}一壘安打`;
            case '二安': return `${area}二壘安打`;
            case '場地二安': return `${area}的球彈出場外，形成場地二壘打`;
            case '三安': return `${area}三壘安打`;
            case '本打':
                return (advancedPlayState as any).insideHR
                    ? `${area}場內全壘打`
                    : `${area}全壘打`;
            case '失誤': {
                // 用「落點方向＋球種」開頭，跟其他結果一致（原本寫「擊向中外野手」很生硬）
                const bw = { G: '滾地球', L: '平飛球', F: '高飛球', B: '短打' }[advancedPlayState.ballType] || '';
                return bw ? `${area}${bw}` : `${area}的球`;
            }
            case '不死三振': return `揮空三振但${who}未能接妥`;
            case '不死三振出局': return `揮空三振，捕手未接妥後傳一壘${tail ? '' : ''}，打者被刺殺出局`;
            case '內飛': return `${area}內野高飛球，宣告內野高飛必死球，打者出局`;
            default: return `${PLAY_DESCRIPTIONS[play]}，由${who}處理`;
        }
    }
    const RUNNER_ACTION_TYPES = {
        'steal': '盜壘',
        // 守備冷漠（規則 9.07(g)）：守方明顯不去阻止跑者推進，
        // 這種推進不算盜壘，記成野手選擇。
        'indifference': '守方未防守',
        'wild-pitch': '暴投',
        'passed-ball': '捕逸',
        'balk': '投手犯規',
        'pickoff-out': '投手牽制',
        'obstruction': '妨礙跑壘',
        // 申訴出局（規則 5.09(c)）：漏踩壘包、飛球被接到後沒有回壘再出發。
        // 要守方自己提出，而且要在對下一棒投出第一球之前。
        'appeal': '申訴出局'
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
                gidp: 0, bb: 0, hbp: 0, so: 0, sf: 0, sh: 0, sb: 0, cs: 0,
                po: 0, a: 0, e: 0,          // 守備：刺殺、助殺、失誤
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
            lob: 0,      // 殘壘：每個半局結束時還留在壘上的人數（記錄表結算要用）
            roster: roster,
            pitchers: [{
                    _id: pitcherId,
                    name: pitcher.name,
                    outsRecorded: 0, h: 0, r: 0, er: 0,
                    bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0,
                    w: 0, l: 0, sv: 0, hld: 0,      // 勝投／敗投／救援／中繼
                    enterLead: 0, enterOuts: 0,     // 上場時領先幾分、球隊已經幾個出局數（判救援用）
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
    // 一場比賽的規則。0 代表「不限／不用」
    const defaultRules = () => ({
        innings: 9,          // 正規局數
        maxInnings: 12,      // 延長到第幾局判和局（0＝不限）
        mercy: [],           // 提前結束（扣倒）：[{ inn, diff }]
        tiebreakFrom: 0,     // 突破僵局制從第幾局開始（0＝不用）
        tiebreakBases: '12', // WBSC 標準是一二壘各一位；'2' 是中職日職的二壘版
    });
    // 讀這一場的規則（舊存檔沒有這一段就用預設值）
    const rulesOf = () => Object.assign(defaultRules(), (gameState as any).rules || {});
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
            // 這一場的規則。建立比賽時從設定複製過來，
            // 之後改設定也不會動到正在打的這一場
            rules: defaultRules(),
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
        cs?: number;
        po?: number;
        a?: number;
        e?: number;
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
        w?: number;
        l?: number;
        sv?: number;
        hld?: number;
        enterLead?: number;
        enterOuts?: number;
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
        // 是哪一位投手把他送上壘的。換投之後他回來得分，責失要算在這個人頭上，
        // 跟當下誰在投球無關（記錄規則：繼承跑者）。舊存檔沒有這一欄，就算給場上的投手。
        pitcherId?: string;
        // 突破僵局制一開局就放上壘的那兩位。他們回來得分算球隊失分，
        // 不算投手的失分，也永遠不是責失（WBSC 記錄員手冊附錄 2）。
        fromTiebreak?: boolean;
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
    // === 上方資訊列：日期顯示成中文、左右箭頭前後一天 ===
    const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
    function pad2(n: number) { return String(n).padStart(2, '0'); }
    function renderDateFace() {
        const el = document.getElementById('date-text');
        if (!el) return;
        const v = gameDateInput.value;
        if (!v) { el.textContent = '選擇日期'; return; }
        const [y, m, d] = v.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        el.textContent = `${y}年${m}月${d}日 (${WEEKDAY_ZH[dt.getDay()]})`;
    }
    // 比賽頁面的球場／日期時間／天氣改成固定顯示：這些在建立比賽時就填好了，
    // 記錄當中不該再被改到（以前是三顆可以輸入的藥丸，很容易誤觸）
    function renderGameMetaStatic() {
        const box = document.getElementById('game-meta-static');
        if (!box) return;
        const v = (gameDateInput && gameDateInput.value) || '';
        let dateText = '';
        if (v) {
            const [y, m, d] = v.split('-').map(Number);
            dateText = `${y}年${m}月${d}日 (${WEEKDAY_ZH[new Date(y, m - 1, d).getDay()]})`;
        }
        const time = ((gameState as any).gameTime || '').trim();
        const wx = { sunny: '晴', cloudy: '陰', rainy: '雨' }[(weatherInput && weatherInput.value) || ''] || '';
        const parts = [
            (stadiumInput && stadiumInput.value.trim()) || '未填球場',
            dateText + (time ? ' ' + time : ''),
            wx,
        ].filter(Boolean);
        box.innerHTML = parts.map(t => `<span>${t}</span>`).join('');
    }
    function shiftGameDate(days: number) {
        const v = gameDateInput.value || new Date().toISOString().split('T')[0];
        const [y, m, d] = v.split('-').map(Number);
        const dt = new Date(y, m - 1, d + days);
        gameDateInput.value = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
        gameDateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // === 球場：記住用過的名字，右邊箭頭可以直接選 ===
    const STADIUM_HISTORY_KEY = 'baseball_stadium_history';
    function stadiumHistory(): string[] {
        try {
            const raw = JSON.parse(localStorage.getItem(STADIUM_HISTORY_KEY) || '[]');
            return Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.trim()) : [];
        }
        catch { return []; }
    }
    function rememberStadium(name: string) {
        const n = (name || '').trim();
        if (!n) return;
        const list = stadiumHistory().filter(x => x !== n);
        list.unshift(n);
        try { localStorage.setItem(STADIUM_HISTORY_KEY, JSON.stringify(list.slice(0, 8))); }
        catch { /* 存不下就算了，不影響記錄 */ }
    }
    function renderStadiumHistory() {
        const menu = document.getElementById('stadium-history');
        if (!menu) return;
        const list = stadiumHistory();
        menu.innerHTML = list.length
            ? list.map(n => `<li><button type="button" class="stadium-history-item">${n}</button></li>`).join('')
            : '<li class="stadium-history-empty">還沒有用過的球場</li>';
    }
    function toggleStadiumHistory(show?: boolean) {
        const menu = document.getElementById('stadium-history');
        if (!menu) return;
        const next = show === undefined ? menu.classList.contains('modal-hidden') : show;
        if (next) renderStadiumHistory();
        menu.classList.toggle('modal-hidden', !next);
    }
    const appContainer = document.getElementById('app-container') as HTMLDivElement;
    const mobileNav = document.getElementById('mobile-nav') as HTMLDivElement;
    const loadRosterModal = document.getElementById('load-roster-modal');
    const closeLoadRosterModalBtn = document.getElementById('close-load-roster-modal');
    const savedRostersList = document.getElementById('saved-rosters-list');
    let isDragging = false;
    let dragTarget: HTMLElement | null = null;
    let offsetX = 0;
    let offsetY = 0;
    // ======================================================================
    // 我的球隊 + 五分頁主畫面
    // 主畫面（#main-shell）疊在整個 APP 上面，記比賽時才收起來。
    // 第一次使用（還沒建立球隊）只會看到 #onboard-screen。
    // ======================================================================
    const MY_TEAM_KEY = 'baseball_my_team';
    const SETTINGS_KEY = 'baseball_settings';
    const DEFAULT_SETTINGS = { lang: 'zh-TW', innings: 9, maxInnings: 12, dh: true, haptic: true, mercy: '', tiebreak: '' };
    let myTeam: any = null;
    let appSettings: any = { ...DEFAULT_SETTINGS };
    let shellPage = 'home';

    function loadMyTeam() {
        try { myTeam = JSON.parse(localStorage.getItem(MY_TEAM_KEY) || 'null'); }
        catch { myTeam = null; }
    }
    function saveMyTeam() {
        if (!myTeam) return;
        try { localStorage.setItem(MY_TEAM_KEY, JSON.stringify(myTeam)); }
        catch { alert('儲存失敗：瀏覽器的空間不足，通常是球員照片或 LOGO 太大。'); }
    }
    function loadSettings() {
        try { appSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
        catch { appSettings = { ...DEFAULT_SETTINGS }; }
    }
    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings)); } catch { /* 滿了就算了 */ }
    }
    // 沒填名字的球員用「簡稱＋兩位數」代替，名單上才不會一片空白
    function memberName(p, i) {
        const n = (p && p.name || '').trim();
        if (n) return n;
        const short = (myTeam && myTeam.shortName) || '球員';
        const num = (p && p.jersey || '').trim();
        return short + (num || String(i + 1).padStart(2, '0'));
    }
    const blankMember = () => ({ _id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), jersey: '', name: '', pos: '', photo: '' });

    // --- 建立球隊（三步）---
    function showOnboard(step = 0) {
        const scr = document.getElementById('onboard-screen');
        if (!scr) return;
        scr.classList.remove('hidden');
        document.body.classList.add('shell-open');
        const ver = document.getElementById('ob-version');
        if (ver) ver.textContent = APP_VERSION;
        gotoOnboardStep(step);
    }
    // 建立球隊上面那張圖：填了球隊 LOGO 之後，下一頁（球員名單）就換成球隊自己的 LOGO；
    // 沒填就一直用 APP 的 LOGO。APP LOGO 的網址第一次進來時記下來（預覽檔會把它換成內嵌圖，不能寫死路徑）。
    let appLogoSrc = '';
    function syncOnboardLogo(step: number) {
        const img = document.querySelector('#onboard-screen .ob-logo') as HTMLImageElement | null;
        if (!img) return;
        if (!appLogoSrc) appLogoSrc = img.getAttribute('src') || '';
        const picked = (document.getElementById('ob-logo-preview') as HTMLImageElement | null)?.getAttribute('src') || '';
        const useTeam = step >= 2 && picked.startsWith('data:');
        const want = useTeam ? picked : appLogoSrc;
        if (img.getAttribute('src') !== want) img.setAttribute('src', want);
        img.classList.toggle('is-team', useTeam);
    }
    function gotoOnboardStep(step) {
        document.querySelectorAll('#onboard-screen .ob-step').forEach(s => {
            s.classList.toggle('hidden', Number((s as HTMLElement).dataset.step) !== step);
        });
        // 歡迎頁（第 0 步）的 LOGO 要往上靠，建立球隊那兩步是長表單，仍照原本排。
        document.getElementById('onboard-screen')?.classList.toggle('launch', step === 0);
        syncOnboardLogo(step);
        if (step === 0) renderLaunchButtons();
        if (step === 2) renderOnboardPlayers();
    }
    // 啟動畫面（第 0 步）的按鈕：
    //   還沒建過球隊 → 只有「創建球隊」
    //   已經建過     → 進入／繼續比賽（有未完成的比賽才出現）／我的球隊
    function renderLaunchButtons() {
        const has = !!myTeam;
        const show = (id: string, on: boolean) =>
            document.getElementById(id)?.classList.toggle('hidden', !on);
        show('ob-start', !has);
        show('ob-enter', has);
        show('ob-team', has);
        show('ob-resume', has && canContinue());
        const hello = document.getElementById('ob-hello');
        if (hello) {
            hello.textContent = has
                ? `${myTeam.fullName || myTeam.shortName || '我的球隊'}　要做什麼？`
                : '歡迎！先建立你的球隊，之後記比賽都會用到。';
        }
        const sub = document.getElementById('ob-resume-sub');
        if (sub && has && canContinue()) {
            const a = gameState.teams.a, b = gameState.teams.b;
            const sa = a.score.reduce((x, y) => x + (y || 0), 0);
            const sb = b.score.reduce((x, y) => x + (y || 0), 0);
            const where = gameState.stadium ? `　${gameState.stadium}` : '';
            sub.textContent = `${a.name} ${sa} : ${sb} ${b.name}　${gameState.inning}局${gameState.isTop ? '上' : '下'}${where}`;
        }
    }
    // 收起一層整片的畫面時先淡出再真的消失。
    // 立刻加上收起來的記號（功能上就是關了，其他邏輯與測試看到的都是關閉狀態），
    // 另外加 dl-leaving 讓 CSS 多留 0.18 秒播淡出，時間到再拿掉。
    function hideWithFade(el: HTMLElement | null, hiddenClass = 'hidden') {
        if (!el) return;
        el.classList.add(hiddenClass, 'dl-leaving');
        window.setTimeout(() => el.classList.remove('dl-leaving'), 220);
    }
    function closeLaunch() {
        hideWithFade(document.getElementById('onboard-screen'));
    }
    let obPlayers: any[] = [];
    function renderOnboardPlayers() {
        const box = document.getElementById('ob-players');
        if (!box) return;
        if (!obPlayers.length) obPlayers = Array.from({ length: 9 }, () => blankMember());
        const short = (document.getElementById('ob-shortname') as HTMLInputElement)?.value.trim() || '球員';
        box.innerHTML = obPlayers.map((p, i) => `
            <div class="ob-player" data-i="${i}">
                <input type="text" class="ob-jersey" value="${p.jersey}" inputmode="numeric" maxlength="3" placeholder="${i + 1}" aria-label="背號">
                <input type="text" class="ob-name" value="${p.name}" maxlength="10" placeholder="${short}${String(i + 1).padStart(2, '0')}" aria-label="姓名">
                <button type="button" class="ob-del" aria-label="刪除">×</button>
            </div>`).join('');
    }
    function collectOnboardPlayers() {
        document.querySelectorAll('#ob-players .ob-player').forEach(row => {
            const i = Number((row as HTMLElement).dataset.i);
            obPlayers[i].jersey = (row.querySelector('.ob-jersey') as HTMLInputElement).value.trim();
            obPlayers[i].name = (row.querySelector('.ob-name') as HTMLInputElement).value.trim();
        });
    }

    // 自己的詢問視窗。系統的 confirm()／alert() 在內嵌（iframe）環境會被擋掉而且
    // 不會報錯，按了完全沒反應——刪除陣容、結束計時都踩過這個坑。
    let askYes: (() => void) | null = null;
    function askConfirm(text: string, onYes: () => void, yesLabel = '確定') {
        const box = document.getElementById('ask-modal');
        const t = document.getElementById('ask-text');
        const yes = document.getElementById('ask-yes');
        if (!box || !t || !yes) { onYes(); return; }      // 真的找不到視窗就別擋著使用者
        t.textContent = text;
        yes.textContent = yesLabel;
        askYes = onYes;
        box.classList.remove('hidden');
    }
    function closeAsk() {
        hideWithFade(document.getElementById('ask-modal'));
        askYes = null;
    }
    function fileToDataUrl(file: File): Promise<string> {
        return new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => resolve('');
            r.readAsDataURL(file);
        });
    }
    // 子頁上的球員欄位收回資料（每次改動都要先收，不然重畫會把沒存的字洗掉）
    function collectSubPlayers() {
        if (!myTeam) return;
        document.querySelectorAll('#sub-body .mp-row').forEach(row => {
            const id = (row as HTMLElement).dataset.id;
            const p = (myTeam.players || []).find(x => x._id === id);
            if (!p) return;
            p.jersey = (row.querySelector('.mp-jersey') as HTMLInputElement).value.trim();
            p.name = (row.querySelector('.mp-name') as HTMLInputElement).value.trim();
        });
    }

    // --- 五分頁主畫面 ---
    function showShell(page?: string) {
        document.getElementById('main-shell')?.classList.remove('hidden');
        document.body.classList.add('shell-open');
        closeSub();
        if (page) shellPage = page;
        renderShell();
    }
    function hideShell() {
        hideWithFade(document.getElementById('main-shell'));
        document.body.classList.remove('shell-open');
    }
    function setShellPage(page) {
        shellPage = page;
        closeSub();
        document.querySelectorAll('#main-shell .shell-page').forEach(s => {
            s.classList.toggle('hidden', s.id !== 'page-' + page);
        });
        document.querySelectorAll('#shell-nav .shell-tab').forEach(b => {
            b.classList.toggle('active', (b as HTMLElement).dataset.page === page);
        });
        renderShell();
    }
    const gameInProgress = () => !!gameState.started && !gameState.isGameOver;
    // 建立了但還沒按 PLAY BALL 的也算「還沒打完」，一樣要能接回去。
    // 用 createdAt 判斷，不能看名單有沒有名字——預設狀態本來就有假名字
    const canContinue = () => !gameState.isGameOver && (!!gameState.started || !!(gameState as any).createdAt);

    function renderShell() {
        setShellPageClasses();
        renderHomePage();
        renderTeamPage();
        renderStatsPage();
        renderSettingsPage();
    }
    function setShellPageClasses() {
        document.querySelectorAll('#main-shell .shell-page').forEach(s => {
            s.classList.toggle('hidden', s.id !== 'page-' + shellPage);
        });
        document.querySelectorAll('#shell-nav .shell-tab').forEach(b => {
            b.classList.toggle('active', (b as HTMLElement).dataset.page === shellPage);
        });
    }

    function renderHomePage() {
        const ver = document.getElementById('shell-version');
        if (ver) ver.textContent = APP_VERSION;
        const main = document.getElementById('home-continue');
        const label = main?.querySelector('.home-card-label');
        const sub = document.getElementById('home-continue-sub');
        if (main) {
            if (canContinue()) {
                const a = gameState.teams.a, b = gameState.teams.b;
                const sa = a.score.reduce((x, y) => x + (y || 0), 0);
                const sb = b.score.reduce((x, y) => x + (y || 0), 0);
                const where = gameState.stadium ? `　${gameState.stadium}` : '';
                if (label) label.textContent = '繼續比賽';
                if (sub) sub.textContent = `${a.name} ${sa} : ${sb} ${b.name}　${gameState.inning}局${gameState.isTop ? '上' : '下'}${where}`;
                main.classList.remove('hidden');
            }
            else main.classList.add('hidden');
        }
        renderHomeGameList();
    }
    function renderHomeGameList() {
        const box = document.getElementById('home-game-list');
        if (!box) return;
        let games = [];
        try { games = (window as any).baseballGameManager?.getGamesList() || []; } catch { games = []; }
        const cur = (window as any).baseballGameManager?.currentGameId;
        if (!games.length) {
            box.innerHTML = '<div class="shell-empty"><p>還沒有比賽紀錄</p><p class="shell-empty-sub">記完一場就會出現在這裡</p></div>';
            return;
        }
        // 只列已經結束的比賽：還沒打完的那一場由上面的「繼續比賽」負責，
        // 兩個地方都出現會讓人以為有兩場
        // 新的排前面：用比賽日期排，同一天才看最後存檔時間
        const when = g => new Date(g.gameDate || g.lastModified || 0).getTime() || 0;
        const done = games.filter(g => g.isGameOver).sort((x, y) => when(y) - when(x));
        if (!done.length) {
            box.innerHTML = '<div class="shell-empty"><p>還沒有打完的比賽</p><p class="shell-empty-sub">比賽結束後就會收在這裡</p></div>';
            return;
        }
        box.innerHTML = done.map(g => {
            const a = g.teams?.a?.name || '客隊', b = g.teams?.b?.name || '主隊';
            const sa = totalRuns(g.teams?.a?.score), sb = totalRuns(g.teams?.b?.score);
            const mine = mySideOf(g);
            const mark = mine ? ` <em class="gl-res gl-${resultOf(g)}">${RESULT_WORD[resultOf(g)]}</em>` : '';
            // 左邊：日期／時間／球場；右邊：比數（放大）。使用者指定的排法。
            const time = (g as any).gameTime ? `　${(g as any).gameTime}` : '';
            return `<div class="gl-row">
                <button type="button" class="gl-item gl-item-2col" data-game="${g.id}">
                    <span class="gl-when">
                        <span class="gl-sub">${fullDate(g.gameDate || g.lastModified)}${time}</span>
                        <span class="gl-sub">${g.stadium || '未填球場'}　${WEATHER_WORD[g.weather] || '－'}</span>
                    </span>
                    <span class="gl-score">
                        <span class="gl-score-line"><b>${a}</b> <i>${sa}</i></span>
                        <span class="gl-score-line"><b>${b}</b> <i>${sb}</i></span>
                        ${mark}
                    </span>
                </button>
                <button type="button" class="gl-del" data-del="${g.id}" aria-label="刪除這場比賽">×</button>
            </div>`;
        }).join('');
    }

    // ======================================================================
    // 成績：把已經結束的比賽累加起來
    // ======================================================================
    // 天氣只用文字：預覽檔內嵌的字型沒有太陽／雲的符號，放符號會變成別的圖案
    const WEATHER_WORD = { sunny: '晴', cloudy: '陰', rainy: '雨' };
    const RESULT_WORD = { win: '勝', lose: '敗', tie: '和' };
    const totalRuns = (s) => (s || []).reduce((a, b) => a + (b || 0), 0);
    function fullDate(v) {
        const d = new Date(v || Date.now());
        if (isNaN(d.getTime())) return '';
        const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${week})`;
    }
    // 哪一邊是我們？建立比賽時會記 mySide；舊資料就用隊名比對
    function mySideOf(g) {
        if (g && (g as any).mySide) return (g as any).mySide;
        const short = myTeam && myTeam.shortName;
        if (!short) return null;
        if (g?.teams?.a?.name === short) return 'a';
        if (g?.teams?.b?.name === short) return 'b';
        return null;
    }
    function resultOf(g) {
        const side = mySideOf(g);
        if (!side) return 'tie';
        const mine = totalRuns(g.teams[side].score);
        const theirs = totalRuns(g.teams[side === 'a' ? 'b' : 'a'].score);
        return mine > theirs ? 'win' : mine < theirs ? 'lose' : 'tie';
    }
    const BAT_SUM = ['pa', 'ab', 'r', 'h', 'rbi', 'tb', '2b', '3b', 'hr', 'bb', 'hbp', 'so', 'sf', 'sh', 'sb', 'cs', 'po', 'a', 'e'];
    const PIT_SUM = ['outsRecorded', 'h', 'r', 'er', 'bb', 'k', 'hbp', 'hr', 'bf', 'ibb', 'w', 'l', 'sv', 'hld'];
    const rate = (n, d, digits = 3) => d > 0 ? (n / d).toFixed(digits).replace(/^0/, '') : '－';
    // 防禦率＝責失 × 規定局數 ÷ 投球局數（規則 9.21）。七局制的比賽要乘 7，不是 9。
    const era = (er, outs) => outs > 0 ? (er * (rulesOf().innings || 9) * 3 / outs).toFixed(2) : '－';
    const ipText = (outs) => `${Math.floor(outs / 3)}${outs % 3 ? '.' + (outs % 3) : ''}`;
    (window as any).__eraText = era;   // 測試用：驗防禦率有沒有跟著規定局數走

    function collectStats() {
        let games = [];
        try { games = (window as any).baseballGameManager?.getGamesList() || []; } catch { games = []; }
        const done = games.filter(g => g.isGameOver && mySideOf(g));
        const rec = { win: 0, lose: 0, tie: 0 };
        const bat = {}, pit = {};
        const blankBat = () => Object.fromEntries(BAT_SUM.map(k => [k, 0]));
        const blankPit = () => Object.fromEntries(PIT_SUM.map(k => [k, 0]));
        done.forEach(g => {
            rec[resultOf(g)]++;
            const team = g.teams[mySideOf(g)];
            (team.roster || []).forEach(p => {
                if (!p || !p.name) return;
                const key = (p.jersey || '') + '|' + p.name;
                bat[key] = bat[key] || { name: p.name, jersey: p.jersey || '', ...blankBat() };
                BAT_SUM.forEach(k => { bat[key][k] += Number(p[k]) || 0; });
            });
            (team.pitchers || []).forEach(p => {
                if (!p || !p.name) return;
                pit[p.name] = pit[p.name] || { name: p.name, ...blankPit() };
                PIT_SUM.forEach(k => { pit[p.name][k] += Number(p[k]) || 0; });
            });
        });
        const sum = (list, keys) => {
            const o = Object.fromEntries(keys.map(k => [k, 0]));
            list.forEach(x => keys.forEach(k => { o[k] += x[k]; }));
            return o;
        };
        const batList = Object.values(bat).filter((x: any) => x.pa > 0) as any[];
        const pitList = Object.values(pit).filter((x: any) => x.bf > 0 || x.outsRecorded > 0) as any[];
        return {
            games: done.length, rec,
            batList: batList.sort((a, b) => b.pa - a.pa),
            pitList: pitList.sort((a, b) => b.outsRecorded - a.outsRecorded),
            batTotal: sum(batList, BAT_SUM), pitTotal: sum(pitList, PIT_SUM),
        };
    }

    function renderStatsPage() {
        const box = document.getElementById('stats-body');
        if (!box) return;
        const s = collectStats();
        const bt = s.batTotal, pt = s.pitTotal;
        // 一場都還沒打完時也把版面顯示出來（數字都是 0），
        // 第一次用的人才知道有這個功能、之後會看到什麼
        const note = s.games ? '' : '<p class="st-note">還沒有打完的比賽。比賽結束後，成績會自動累加到這裡。</p>';
        const obpD = bt.ab + bt.bb + bt.hbp + bt.sf;
        const table = (head, rows) =>
            `<div class="table-scroll"><table class="st-table"><thead><tr>${head.map((h, i) =>
                `<th${i === 0 ? ' class="st-name"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows
                || `<tr class="st-blank"><td class="st-name">－</td><td colspan="${head.length - 1}">還沒有資料</td></tr>`}</tbody></table></div>`;
        const batRow = (x, cls = '') => `<tr class="${cls}"><td class="st-name">${x.name}</td>`
            + [x.pa, x.ab, x.h, x['2b'], x['3b'], x.hr, x.rbi, x.r, x.bb, x.so, x.sb, x.cs,
               rate(x.h, x.ab), rate(x.tb, x.ab), rate(x.h + x.bb + x.hbp, x.ab + x.bb + x.hbp + x.sf)]
              .map(v => `<td>${v}</td>`).join('') + '</tr>';
        const pitRow = (x, cls = '') => `<tr class="${cls}"><td class="st-name">${x.name}</td>`
            + [x.w, x.l, x.sv, ipText(x.outsRecorded), x.h, x.r, x.er, x.bb, x.k, x.hr,
               era(x.er, x.outsRecorded), x.outsRecorded ? ((x.h + x.bb) * 3 / x.outsRecorded).toFixed(2) : '－']
              .map(v => `<td>${v}</td>`).join('') + '</tr>';

        box.innerHTML = note + `
            <div class="st-record">
                <div class="st-rec-main"><b>${s.rec.win}</b> 勝 <b>${s.rec.lose}</b> 敗${s.rec.tie ? ` <b>${s.rec.tie}</b> 和` : ''}</div>
                <div class="st-rec-sub">共 ${s.games} 場　勝率 ${rate(s.rec.win, s.rec.win + s.rec.lose)}</div>
            </div>
            <h3 class="shell-section">全隊打擊</h3>
            <div class="st-cards">
                ${[['打擊率', rate(bt.h, bt.ab)], ['上壘率', rate(bt.h + bt.bb + bt.hbp, obpD)],
                   ['長打率', rate(bt.tb, bt.ab)], ['安打', bt.h], ['全壘打', bt.hr], ['打點', bt.rbi]]
                  .map(([k, v]) => `<div class="st-card"><b>${v}</b><i>${k}</i></div>`).join('')}
            </div>
            <h3 class="shell-section">全隊投球</h3>
            <div class="st-cards">
                ${[['防禦率', era(pt.er, pt.outsRecorded)], ['投球局數', ipText(pt.outsRecorded)],
                   ['三振', pt.k], ['四壞', pt.bb], ['被安打', pt.h], ['失分', pt.r]]
                  .map(([k, v]) => `<div class="st-card"><b>${v}</b><i>${k}</i></div>`).join('')}
            </div>
            <h3 class="shell-section">個人打擊</h3>
            ${table(['姓名', '打席', '打數', '安打', '二安', '三安', '全壘打', '打點', '得分', '四壞', '三振', '盜壘', '盜刺', '打擊率', '長打率', '上壘率'],
                    s.batList.map(x => batRow(x)).join('') + (s.batList.length ? batRow({ ...bt, name: '全隊' }, 'st-total') : ''))}
            <h3 class="shell-section">個人守備</h3>
            ${table(['姓名', '刺殺', '助殺', '失誤', '守備機會', '守備率'],
                    s.batList.filter(x => (x.po || 0) + (x.a || 0) + (x.e || 0) > 0).map(x => {
                        const tc = (x.po || 0) + (x.a || 0) + (x.e || 0);
                        return `<tr><td class="st-name">${x.name}</td>`
                            + [x.po || 0, x.a || 0, x.e || 0, tc, rate((x.po || 0) + (x.a || 0), tc)]
                              .map(v => `<td>${v}</td>`).join('') + '</tr>';
                    }).join(''))}
            <h3 class="shell-section">個人投球</h3>
            ${table(['姓名', '勝', '敗', '救', '局數', '被安打', '失分', '責失', '四壞', '三振', '被全壘打', '防禦率', 'WHIP'],
                    s.pitList.map(x => pitRow(x)).join('') + (s.pitList.length ? pitRow({ ...pt, name: '全隊' }, 'st-total') : ''))}`;
    }

    function renderTeamPage() {
        if (!myTeam) return;
        const img = document.getElementById('team-logo-img') as HTMLImageElement;
        if (img) {
            img.src = myTeam.logo || '';
            img.closest('.team-logo-pick')?.classList.toggle('has-logo', !!myTeam.logo);
        }
        const hero = document.getElementById('team-hero-name');
        if (hero) hero.textContent = myTeam.fullName || myTeam.shortName || '我的球隊';
        const set = (id, v) => { const el = document.getElementById(id) as HTMLInputElement; if (el && el !== document.activeElement) el.value = v; };
        set('team-short-input', myTeam.shortName || '');
        set('team-full-input', myTeam.fullName || '');
        set('team-color-input', myTeam.color || '#4a90e2');
        const pc = document.getElementById('team-players-count');
        if (pc) pc.textContent = `${(myTeam.players || []).length} 人`;
        const lc = document.getElementById('team-lineups-count');
        const n = (myTeam.lineups || []).length;
        if (lc) lc.textContent = n ? `${n} 套` : '還沒編排';
    }

    function renderSettingsPage() {
        const set = (id, v) => { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = String(v); };
        set('set-lang', appSettings.lang);
        set('set-innings', appSettings.innings);
        set('set-max-innings', appSettings.maxInnings);
        set('set-mercy', appSettings.mercy || '');
        set('set-tiebreak', appSettings.tiebreak || '');
        const dh = document.getElementById('set-dh') as HTMLInputElement;
        if (dh) dh.checked = !!appSettings.dh;
        const hap = document.getElementById('set-haptic') as HTMLInputElement;
        if (hap) hap.checked = !!appSettings.haptic;
        const about = document.getElementById('set-about');
        if (about) about.textContent = `Diamond Log ${APP_VERSION}`;
    }

    // ======================================================================
    // 建立比賽（三步）：比賽資訊 → 對手名單 → 我方先發名單
    // ======================================================================
    const OPPONENTS_KEY = 'baseball_opponents';
    let gsStep = 1;
    let gsSide = 'top';                 // 我方先攻（客隊）或後攻（主隊）
    let gsOpp: any[] = [];              // 對手名單
    let gsLineup: any = null;           // 我方這一場的先發

    const readOpponents = () => { try { return JSON.parse(localStorage.getItem(OPPONENTS_KEY) || '[]'); } catch { return []; } };
    const oppName = (p, i) => (p && p.name || '').trim() || '對手' + String(i + 1).padStart(2, '0');

    // 對手的守位先隨機排好，省得每次都要自己點；第 10 列固定是投手
    const OPP_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    function shuffled(list: string[]) {
        const a = [...list];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function resetGameSetup() {
        gsStep = 1;
        gsSide = 'top';
        gsOpp = Array.from({ length: 10 }, () => blankMember());
        const pos = shuffled(OPP_POS);
        gsOpp.forEach((p, i) => { p.pos = i < 9 ? pos[i] : 'P'; });
        const lus = (myTeam && myTeam.lineups) || [];
        gsLineup = {
            useDH: lus[0] ? !!lus[0].useDH : !!appSettings.dh,
            spots: lus[0] ? [...(lus[0].spots || Array(9).fill(''))] : Array(9).fill(''),
            positions: lus[0] ? [...(lus[0].positions || Array(9).fill(''))] : Array(9).fill(''),
            pitcherId: lus[0] ? lus[0].pitcherId : '',
            from: lus[0] ? lus[0].id : '',
        };
    }
    function renderGameSetup() {
        // 比賽進行中就把整個建立流程鎖住（同時只能有一場，不然紀錄會亂掉）
        const busy = gameInProgress();
        const busyBox = document.getElementById('gs-busy');
        if (busyBox) {
            busyBox.classList.toggle('hidden', !busy);
            if (busy) {
                const a = gameState.teams.a, b = gameState.teams.b;
                const sa = a.score.reduce((x, y) => x + (y || 0), 0);
                const sb = b.score.reduce((x, y) => x + (y || 0), 0);
                const txt = document.getElementById('gs-busy-text');
                if (txt) txt.textContent = `${a.name} ${sa} : ${sb} ${b.name}　${gameState.inning}局${gameState.isTop ? '上' : '下'}`;
            }
        }
        document.getElementById('page-game')?.classList.toggle('is-busy', busy);
        const title = document.getElementById('gs-title');
        const count = document.getElementById('gs-count');
        if (title) title.textContent = ['', '建立比賽', '對手名單', '我方先發'][gsStep];
        if (count) count.textContent = `${gsStep} / 3`;
        document.getElementById('gs-back')?.classList.toggle('hidden', gsStep === 1);
        document.querySelectorAll('#page-game .gs-step').forEach(s => {
            s.classList.toggle('hidden', Number((s as HTMLElement).dataset.gstep) !== gsStep);
        });
        if (gsStep === 1) {
            const d = document.getElementById('gs-date') as HTMLInputElement;
            if (d && !d.value) d.value = new Date().toISOString().split('T')[0];
            document.querySelectorAll('.gs-side-btn').forEach(b => {
                b.classList.toggle('active', (b as HTMLElement).dataset.side === gsSide);
            });
        }
        if (gsStep === 2) renderOppList();
        if (gsStep === 3) renderStarters();
    }
    function renderOppList() {
        const sel = document.getElementById('gs-opp-load') as HTMLSelectElement;
        const saved = readOpponents();
        if (sel) {
            sel.innerHTML = '<option value="">－ 不帶入 －</option>'
                + saved.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            document.getElementById('gs-opp-load-row')?.classList.toggle('hidden', !saved.length);
        }
        const box = document.getElementById('gs-opp-list');
        if (!box) return;
        const allPos = gsOpp.map(x => x.pos);
        box.innerHTML = gsOpp.map((p, i) => `
            <div class="mp-row op-row" data-i="${i}">
                <input type="text" class="mp-jersey" value="${p.jersey || ''}" inputmode="numeric" maxlength="3" placeholder="${i + 1}" aria-label="背號">
                <input type="text" class="mp-name" value="${p.name || ''}" maxlength="10" placeholder="${oppName(p, i)}" aria-label="姓名">
                <select class="mp-pos" aria-label="守位">${POS_OPTIONS_LEFT(p.pos, takenPos(allPos, i))}</select>
                <button type="button" class="mp-del" aria-label="刪除">×</button>
            </div>`).join('');
    }
    function collectOppList() {
        document.querySelectorAll('#gs-opp-list .mp-row').forEach(row => {
            const i = Number((row as HTMLElement).dataset.i);
            gsOpp[i].jersey = (row.querySelector('.mp-jersey') as HTMLInputElement).value.trim();
            gsOpp[i].name = (row.querySelector('.mp-name') as HTMLInputElement).value.trim();
            gsOpp[i].pos = (row.querySelector('.mp-pos') as HTMLSelectElement).value;
        });
    }
    // 建立比賽被擋下來的原因寫在畫面上（系統的 alert 在內嵌環境會被擋掉，按了沒反應）
    function gsWarn(text: string) {
        const el = document.getElementById('gs-warn');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('hidden', !text);
    }
    function renderStarters() {
        gsWarn('');
        const players = (myTeam && myTeam.players) || [];
        const lus = (myTeam && myTeam.lineups) || [];
        const pick = document.getElementById('gs-lineup-pick') as HTMLSelectElement;
        if (pick) {
            pick.innerHTML = '<option value="">－ 自己排 －</option>'
                + lus.map(l => `<option value="${l.id}"${l.id === gsLineup.from ? ' selected' : ''}>${l.name || '未命名'}</option>`).join('');
        }
        document.querySelectorAll('#gs-dh .dh-btn').forEach(b => {
            b.classList.toggle('active', ((b as HTMLElement).dataset.dh === '1') === !!gsLineup.useDH);
        });
        // 同一個人不能排兩棒，同一個守位也不能有兩個人
        const opt = (sel, taken?: Set<string>) => '<option value="">－</option>' + players
            .filter(p => p._id === sel || !taken || !taken.has(p._id))
            .map((p) => `<option value="${p._id}"${p._id === sel ? ' selected' : ''}>${p.jersey ? p.jersey + '　' : ''}${memberName(p, players.indexOf(p))}</option>`).join('');
        const spots = document.getElementById('gs-spots');
        const pSpot = pitcherSpotOf(gsLineup);
        if (spots) {
            spots.innerHTML = Array.from({ length: 9 }, (_, i) => {
                const isP = !gsLineup.useDH && i === pSpot;
                return `<div class="lu-spot${isP ? ' is-pitcher' : ''}"><span>${i + 1}棒${isP ? '（投）' : ''}</span>
                    <select data-gspot="${i}">${opt(gsLineup.spots[i], takenIds(gsLineup, i))}</select>
                    <select class="lu-pos" data-gpos="${i}" aria-label="守位"${isP ? ' disabled' : ''}>${isP ? '<option value="P" selected>P</option>' : POS_OPTIONS_LEFT((gsLineup.positions || [])[i], takenPos(gsLineup.positions, i))}</select></div>`;
            }).join('');
        }
        const pit = document.getElementById('gs-pitcher') as HTMLSelectElement;
        if (pit) {
            pit.innerHTML = opt(gsLineup.pitcherId, takenIds(gsLineup, 'P'));
            // DH 制的投手不排進打線，人數不夠時要講清楚，不然選單空空的看不懂
            if (gsLineup.useDH && pit.options.length <= 1) {
                gsWarn('球員都排進打線了，沒有人可以當先發投手。'
                    + '可以改成「投手打擊」，或到球隊分頁新增球員。');
            }
        }
        // DH 關掉時投手自己打擊，第 9 棒就是投手，不需要另一個欄位
        document.getElementById('gs-pitcher-row')?.classList.toggle('hidden', !gsLineup.useDH);
    }

    // 把一隊的資料鋪進計分引擎要的格式（先發九人、投手、板凳）
    function buildTeamState(key: 'a' | 'b', info, order: any[], pitcherSrc, useDH: boolean, bench: any[]) {
        const t = createDefaultTeamState(key);
        t.name = (info.shortName || info.name || '').slice(0, TEAM_NAME_MAX) || (key === 'a' ? '客隊' : '主隊');
        if (info.color) t.color = info.color;
        if (info.logo) t.logo = info.logo;
        t.useDH = useDH;
        const fill = (slot, src, fallbackName, fallbackJersey) => {
            slot.jersey = (src && src.jersey) || fallbackJersey;
            slot.name = (src && (src.name || '').trim()) || fallbackName;
            if (src && src.pos) slot.pos = src.pos;
            if (src && src.photo) slot.photo = src.photo;
        };
        order.forEach((src, i) => {
            fill(t.roster[i], src, `${t.name}${String(i + 1).padStart(2, '0')}`, String(i + 1).padStart(2, '0'));
        });
        if (useDH) {
            const pit = t.roster[PITCHER_ROSTER_INDEX];
            fill(pit, pitcherSrc, `${t.name}投手`, '10');
            pit.pos = 'P';
            t.pitchers[0]._id = pit._id;
            t.pitchers[0].name = pit.name;
            t.activePitcherId = pit._id;
        }
        else {
            // 投手自己打擊：守位排 P 的那一棒就是投手（沒有就退回第九棒）
            let pIdx = order.findIndex(p => p && p.pos === 'P');
            if (pIdx < 0) pIdx = 8;
            const pit = t.roster[pIdx];
            pit.pos = 'P';
            t.roster[PITCHER_ROSTER_INDEX].name = '';
            t.roster[PITCHER_ROSTER_INDEX].jersey = '';
            t.pitchers[0]._id = pit._id;
            t.pitchers[0].name = pit.name;
            t.activePitcherId = pit._id;
        }
        // 其餘的人放板凳（跳過投手那一格）。
        // 沒填名字的一定要補一個（簡稱＋背號），不能留空白：
        // `name === ''` 在這個專案代表「沒這個人」，板凳會整排被當成空的，
        // 比賽中代打／代跑／換投就一個人也選不到（踩過一次，已有測試釘住）。
        let slot = LINEUP_SIZE;
        bench.forEach((src, k) => {
            while (slot === PITCHER_ROSTER_INDEX) slot++;
            if (slot >= ROSTER_SIZE) return;
            const num = (src && (src.jersey || '').trim()) || String(LINEUP_SIZE + k + 1).padStart(2, '0');
            fill(t.roster[slot], src, `${t.name}${num}`, num);
            slot++;
        });
        return t;
    }

    // 把設定頁的選擇翻成這一場的規則
    function rulesFromSettings() {
        const r = defaultRules();
        r.innings = Number(appSettings.innings) || 9;
        r.maxInnings = Number(appSettings.maxInnings) || 0;
        // 扣倒："5:10,7:7" → [{inn:5,diff:10},{inn:7,diff:7}]
        r.mercy = String(appSettings.mercy || '').split(',').filter(Boolean).map(part => {
            const [inn, diff] = part.split(':').map(Number);
            return { inn, diff };
        }).filter(m => m.inn > 0 && m.diff > 0);
        // 突破僵局："10:12" → 第 10 局起、一二壘有人
        const tb = String(appSettings.tiebreak || '').split(':');
        r.tiebreakFrom = Number(tb[0]) || 0;
        r.tiebreakBases = tb[1] === '2' ? '2' : '12';
        return r;
    }
    function createGameFromSetup() {
        if (!myTeam) return false;
        const players = myTeam.players || [];
        const byId = id => players.find(p => p._id === id);
        const order = gsLineup.spots.map((id, i) => {
            const p = byId(id);
            return p ? { ...p, pos: (gsLineup.positions || [])[i] || '' } : null;
        });
        if (order.some(p => !p)) { gsWarn('先發九棒還沒排完，每一棒都要指定球員。'); return false; }
        if (gsLineup.useDH && !byId(gsLineup.pitcherId)) {
            gsWarn('還沒選先發投手。DH 制的投手不排進打線，所以要有第 10 個人；'
                + '球員不夠的話可以先改成「投手打擊」，或到球隊分頁新增球員。');
            return false;
        }
        const used = new Set(gsLineup.spots.concat(gsLineup.useDH ? [gsLineup.pitcherId] : []));
        const bench = players.filter(p => !used.has(p._id));
        const oppInfo = {
            name: (document.getElementById('gs-opp-name') as HTMLInputElement).value.trim() || '對手',
            color: (document.getElementById('gs-opp-color') as HTMLInputElement)?.value || '',
        };
        const oppOrder = gsOpp.slice(0, 9).map((p, i) => ({ ...p, name: oppName(p, i) }));
        const oppPitcher = gsOpp[9] ? { ...gsOpp[9], name: oppName(gsOpp[9], 9) } : null;
        const oppBench = gsOpp.slice(10);

        const mine = () => buildTeamState(gsSide === 'top' ? 'a' : 'b', myTeam, order, byId(gsLineup.pitcherId), gsLineup.useDH, bench);
        const theirs = () => buildTeamState(gsSide === 'top' ? 'b' : 'a', oppInfo, oppOrder, oppPitcher, true, oppBench);

        gameState = getInitialGameState();
        if (gsSide === 'top') { gameState.teams.a = mine(); gameState.teams.b = theirs(); }
        else { gameState.teams.b = mine(); gameState.teams.a = theirs(); }
        gameState.gameDate = (document.getElementById('gs-date') as HTMLInputElement).value || gameState.gameDate;
        gameState.stadium = (document.getElementById('gs-stadium') as HTMLInputElement).value.trim();
        gameState.weather = (document.getElementById('gs-weather') as HTMLSelectElement).value;
        (gameState as any).gameTime = (document.getElementById('gs-time') as HTMLInputElement)?.value || '';
        (gameState as any).rules = rulesFromSettings();   // 這一場用的規則（之後改設定不影響這場）
        (gameState as any).createdAt = Date.now();   // 「有一場還沒打完」的依據
        (gameState as any).mySide = gsSide === 'top' ? 'a' : 'b';   // 成績要知道哪一邊是我們
        // 常用對手：下次可以直接帶入
        if (oppInfo.name !== '對手') {
            const saved = readOpponents().filter(o => o.name !== oppInfo.name);
            saved.unshift({ id: 'opp_' + Date.now(), name: oppInfo.name, players: gsOpp.filter(p => p.name || p.jersey) });
            try { localStorage.setItem(OPPONENTS_KEY, JSON.stringify(saved.slice(0, 10))); } catch { /* 滿了就算了 */ }
        }
        gameStateHistory = [];
        resetReplayLog();
        (window as any).baseballGameManager?.createNewGame();
        saveState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
        pushToGameList();
        return true;
    }

    // 把一場存起來的比賽直接讀進記憶體。
    // **絕對不要用 location.reload()**：預覽檔是把整個 APP 塞在 iframe 裡的，
    // 重新整理那個 iframe 會得到一張空白文件，畫面整片變白而且回不去（踩過一次）。
    function adoptSavedGame(data) {
        if (!data) return false;
        const { id, lastModified, version, ...state } = data as any;
        try { localStorage.setItem('baseballGameState', JSON.stringify(state)); }
        catch { return false; }
        loadState();                 // 沿用原本的讀檔流程，舊存檔的補值與紙條都會處理好
        gameStateHistory = [];
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
        return true;
    }
    // 從頭開始（清除全部資料之後用），同樣不重新整理
    // 立刻寫進比賽紀錄（不然要等自動儲存那 10 秒，列表上會看不到剛建立的比賽）
    function pushToGameList() {
        const gm = (window as any).baseballGameManager;
        if (!gm) return;
        try { gm.saveCurrentGame(JSON.parse(localStorage.getItem('baseballGameState') || 'null')); }
        catch { /* 存不進去就等自動儲存 */ }
    }
    function restartApp() {
        loadMyTeam();
        loadSettings();
        gameStateHistory = [];
        resetReplayLog();
        loadState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
        leaveGameView();
        // 五分頁主畫面也要收起來。不收的話（例如從「設定 → 清除全部資料」進來時）
        // 它會跟歡迎頁疊在一起，兩層內容糊成一片（踩過一次，已有測試釘住）。
        hideShell();
        document.getElementById('onboard-screen')?.classList.add('hidden');
        if (!myTeam) obPlayers = [];
        showOnboard(0);
    }

    // --- 比賽中的畫面：底部分頁藏起來，紀錄改成從下面滑出 ---
    function enterGameView() {
        hideShell();
        document.body.classList.add('playing');
        document.body.classList.remove('sheet-open');
        document.getElementById('game-log-btn')?.classList.remove('hidden');
        document.getElementById('log-sheet-close')?.classList.remove('hidden');
        navigateToPanel(1);
    }
    function leaveGameView() {
        document.body.classList.remove('playing', 'sheet-open');
        document.getElementById('game-log-btn')?.classList.add('hidden');
        document.getElementById('log-sheet-close')?.classList.add('hidden');
    }
    function toggleLogSheet(open?: boolean) {
        const on = open === undefined ? !document.body.classList.contains('sheet-open') : open;
        document.body.classList.toggle('sheet-open', on);
    }

    // --- 子頁：球員 / 常用陣容 ---
    function openSub(kind) {
        const sub = document.getElementById('shell-sub');
        const title = document.getElementById('sub-title');
        if (!sub || !title) return;
        sub.dataset.kind = kind;
        title.textContent = kind === 'players' ? '球員' : kind === 'rules' ? '記分規則' : '常用陣容';
        document.querySelectorAll('#main-shell .shell-page').forEach(s => s.classList.add('hidden'));
        sub.classList.remove('hidden');
        renderSub();
    }
    function closeSub() {
        const sub = document.getElementById('shell-sub');
        if (sub && !sub.classList.contains('hidden')) {
            sub.classList.add('hidden');
            setShellPageClasses();
            renderTeamPage();      // 人數與陣容套數要是最新的
        }
    }
    function renderSub() {
        const sub = document.getElementById('shell-sub');
        const body = document.getElementById('sub-body');
        if (!sub || !body) return;
        if (sub.dataset.kind === 'rules') { renderSubRules(body); return; }
        if (!myTeam) return;
        if (sub.dataset.kind === 'players') renderSubPlayers(body);
        else renderSubLineups(body);
    }
    // --- 子頁：記分規則速查 ---
    // 內容來自 rules-data.ts，整段打包在 APP 裡，沒有網路也查得到。
    // 搜尋是直接把不符合的條目藏起來（不重建欄位），這樣手機打中文選字才不會被打斷。
    const rqBold = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    function renderSubRules(body) {
        body.innerHTML = `<p class="sub-note">依 ${RULE_SOURCE} 整理。這一頁不需要網路。</p>`
            + `<label class="rq-search"><input type="search" id="rq-q" placeholder="搜尋：例如 犧飛、責失、盜壘"></label>`
            + `<p class="rq-empty rq-hide" id="rq-empty">找不到相符的條目，換個詞試試。</p>`
            + `<div class="rq-list">` + RULE_BOOK.map(sec => `
                <section class="rq-sec" data-sec="${sec.id}">
                    <button type="button" class="rq-head"><span>${sec.title}</span><i>›</i></button>
                    <div class="rq-body">
                        ${sec.note ? `<p class="rq-note">${rqBold(sec.note)}</p>` : ''}
                        ${sec.items.map(it => `
                            <div class="rq-item">
                                <h4>${it.t}</h4>
                                <p>${rqBold(it.a)}</p>
                                ${it.ref ? `<span class="rq-ref">${it.ref}</span>` : ''}
                            </div>`).join('')}
                    </div>
                </section>`).join('') + `</div>`;
    }
    // 搜尋：符合的留下、其餘藏起來；有結果的段落自動展開
    function filterRules(q: string) {
        const key = (q || '').trim().toLowerCase();
        let hits = 0;
        document.querySelectorAll('#sub-body .rq-sec').forEach(sec => {
            let secHits = 0;
            sec.querySelectorAll('.rq-item').forEach(item => {
                const ok = !key || (item.textContent || '').toLowerCase().includes(key);
                item.classList.toggle('rq-hide', !ok);
                if (ok) secHits++;
            });
            const titleHit = !!key && ((sec.querySelector('.rq-head span') as HTMLElement)?.textContent || '')
                .toLowerCase().includes(key);
            if (titleHit) {
                sec.querySelectorAll('.rq-item').forEach(item => item.classList.remove('rq-hide'));
                secHits = sec.querySelectorAll('.rq-item').length;
            }
            sec.classList.toggle('rq-hide', secHits === 0);
            if (key) sec.classList.toggle('open', secHits > 0);
            hits += secHits;
        });
        document.getElementById('rq-empty')?.classList.toggle('rq-hide', hits > 0);
    }

    function renderSubPlayers(body) {
        const list = myTeam.players || [];
        body.innerHTML = `<p class="sub-note">這裡放全部的球員，不分先發或替補。沒填名字的會自動用「簡稱＋背號」。守位在「常用陣容」裡排。</p>`
            + `<div class="mp-list">` + list.map((p, i) => `
                <div class="mp-row" data-id="${p._id}">
                    <label class="mp-photo${p.photo ? ' has-photo' : ''}">
                        <img src="${p.photo || ''}" alt="">
                        <span class="mp-photo-hint">＋</span>
                        <input type="file" class="mp-photo-input" accept="image/*">
                    </label>
                    <input type="text" class="mp-jersey" value="${p.jersey || ''}" inputmode="numeric" maxlength="3" placeholder="－" aria-label="背號">
                    <input type="text" class="mp-name" value="${p.name || ''}" maxlength="10" placeholder="${memberName(p, i)}" aria-label="姓名">
                    <button type="button" class="mp-del" aria-label="刪除">×</button>
                </div>`).join('') + `</div>`
            + `<button type="button" class="ob-add" id="mp-add">＋ 新增球員</button>`;
    }
    const POS_LIST = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    const POS_OPTIONS = (cur) => POS_LIST.map(v => `<option value="${v}"${v === (cur || '') ? ' selected' : ''}>${v || '－'}</option>`).join('');

    // 同一份打線裡，一個人只能排一棒、一個守位也只能有一個人。
    // 選單裡把別人已經佔走的選項拿掉（自己目前選的那個要留著，不然會看不到）。
    const POS_OPTIONS_LEFT = (cur, taken: Set<string>) => POS_LIST
        .filter(v => !v || v === (cur || '') || !taken.has(v))
        .map(v => `<option value="${v}"${v === (cur || '') ? ' selected' : ''}>${v || '－'}</option>`).join('');
    const takenPos = (positions, skip) => new Set((positions || [])
        .filter((v, i) => v && i !== skip));
    const takenIds = (lu, skip) => new Set(((lu.spots || []) as string[])
        .filter((v, i) => v && i !== skip).concat(skip === 'P' || !lu.useDH ? [] : [lu.pitcherId]).filter(Boolean));

    // DH 關掉的那一棒：守位是 P 的那一格（沒有就用第九棒）
    const pitcherSpotOf = (lu) => {
        const i = (lu.positions || []).findIndex(v => v === 'P');
        return i >= 0 ? i : 8;
    };
    // 打開／關閉 DH：關掉時先發投手直接排進原本 DH 的那一棒，打開時再換回來
    function applyLineupDH(lu, on: boolean) {
        if (!lu.positions) lu.positions = Array(9).fill('');
        if (!on && lu.useDH !== false) {
            let i = lu.positions.findIndex(v => v === 'DH');
            if (i < 0) i = 8;
            lu.dhBackup = { i, id: lu.spots[i] || '', pos: lu.positions[i] || '', pitcherId: lu.pitcherId || '' };
            if (lu.pitcherId) lu.spots[i] = lu.pitcherId;
            lu.positions[i] = 'P';
        }
        else if (on && lu.useDH === false) {
            const b = lu.dhBackup;
            const i = b ? b.i : pitcherSpotOf(lu);
            if (b) {
                lu.spots[i] = b.id;
                lu.positions[i] = b.pos || 'DH';
                if (b.pitcherId) lu.pitcherId = b.pitcherId;
            }
            else {
                lu.pitcherId = lu.spots[i] || lu.pitcherId;   // 打線裡的投手移回投手欄
                lu.spots[i] = '';
                lu.positions[i] = 'DH';
            }
            lu.dhBackup = null;
        }
        lu.useDH = on;
    }

    function renderSubLineups(body) {
        const lineups = myTeam.lineups || [];
        const editing = (document.getElementById('shell-sub') as HTMLElement).dataset.editing;
        if (editing) { renderLineupEditor(body, lineups.find(l => l.id === editing)); return; }
        body.innerHTML = `<p class="sub-note">先把常用的先發打序排好，建立比賽時就能直接帶入，不用每次重排。</p>`
            + (lineups.length
                ? `<div class="lu-list">` + lineups.map(l => `
                    <button type="button" class="lu-item" data-lineup="${l.id}">
                        <span class="lu-name">${l.name || '未命名'}</span>
                        <span class="lu-sub">${l.useDH ? 'DH 制' : '投手打擊'}　${(l.spots || []).filter(Boolean).length} / 9 棒</span>
                    </button>`).join('') + `</div>`
                : '<div class="shell-empty"><p>還沒有常用陣容</p></div>')
            + `<button type="button" class="ob-add" id="lu-add">＋ 新增陣容</button>`;
    }
    function renderLineupEditor(body, lu) {
        if (!lu) return;
        const players = myTeam.players || [];
        const opt = (sel, taken?: Set<string>) => `<option value="">－</option>` + players
            .filter(p => p._id === sel || !taken || !taken.has(p._id))
            .map((p) => `<option value="${p._id}"${p._id === sel ? ' selected' : ''}>${p.jersey ? p.jersey + '　' : ''}${memberName(p, players.indexOf(p))}</option>`).join('');
        const pos = (lu.positions || []);
        const pSpot = pitcherSpotOf(lu);
        body.innerHTML = `
            <label class="team-row"><span class="team-row-label">陣容名稱</span>
                <input type="text" id="lu-name" maxlength="10" value="${lu.name || ''}" placeholder="例：主力"></label>
            <div class="dh-pick" id="lu-dh">
                <span class="dh-label">打線</span>
                <button type="button" class="dh-btn${lu.useDH ? ' active' : ''}" data-dh="1">DH 制</button>
                <button type="button" class="dh-btn${lu.useDH ? '' : ' active'}" data-dh="0">投手打擊</button>
            </div>
            <p class="sub-note" id="lu-dh-hint">${lu.useDH ? '指定打擊上場打擊，投手不排進打線' : `投手自己打擊，排在第 ${pSpot + 1} 棒（原本 DH 的位置）`}</p>
            <div class="lu-spots">` + Array.from({ length: 9 }, (_, i) => {
                // DH 關掉時投手就排在原本 DH 的那一棒，守位鎖成 P，不要再讓人自己選
                const isP = !lu.useDH && i === pSpot;
                return `<div class="lu-spot${isP ? ' is-pitcher' : ''}"><span>${i + 1}棒${isP ? '（投）' : ''}</span>
                    <select data-spot="${i}">${opt((lu.spots || [])[i], takenIds(lu, i))}</select>
                    <select class="lu-pos" data-pos="${i}" aria-label="守位"${isP ? ' disabled' : ''}>${isP ? '<option value="P" selected>P</option>' : POS_OPTIONS_LEFT(pos[i], takenPos(pos, i))}</select></div>`;
            }).join('') + `</div>
            <label class="team-row${lu.useDH ? '' : ' hidden'}" id="lu-pitcher-row"><span class="team-row-label">先發投手</span>
                <select id="lu-pitcher">${opt(lu.pitcherId, takenIds(lu, 'P'))}</select></label>
            <div class="lu-actions">
                <button type="button" id="lu-delete" class="lu-del">刪除這套</button>
                <button type="button" id="lu-done" class="ob-primary">完成</button>
            </div>`;
    }

    function init() {
        // 舊的比賽列表視窗原本靠 location.reload() 載入，在預覽檔裡會變成空白頁；
        // 這裡把它改接到就地載入
        // 自動儲存原本是「從畫面反推比賽狀態」，那樣存進比賽紀錄的東西是不完整的。
        // 直接把真正的存檔內容給它。
        (window as any).__getGameState = () => {
            try { return JSON.parse(localStorage.getItem('baseballGameState') || 'null'); }
            catch { return null; }
        };
        (window as any).__adoptSavedGame = (data) => {
            if (!adoptSavedGame(data)) return false;
            enterGameView();
            return true;
        };
        const verEl = document.getElementById('app-version');
        if (verEl) verEl.textContent = APP_VERSION;
        loadMyTeam();
        loadSettings();
        createLineupInputs();
        loadState();
        addEventListeners();
        render();
        updateLayout(); // Set initial layout based on screen size
        // 開啟 APP 一律停在啟動畫面（大 LOGO 那一頁，使用者要求）：
        // 第一次使用只有「創建球隊」；已經建過球隊就是「進入／繼續比賽／我的球隊」。
        showOnboard(0);
    }
    // 拖曳只改了 DOM 順序，輸入欄上的 data-index 仍是舊的位置。
    // 套用前先依畫面上的排列把 roster 重新排好（整個球員物件一起搬，統計數據跟著走）。
    // 相機拍的照片存成 base64 動輒 1～2MB，瀏覽器的 localStorage 只有約 5MB。
    // 上傳時先縮到合理尺寸再存，容量通常能降到原本的百分之幾。
    function shrinkImage(dataUrl: string, maxSize: number, quality = 0.82): Promise<string> {
        // 去背的圖（PNG／WebP／GIF）背景是透明的：底不能填白，也不能轉成 JPEG，
        // 否則透明的地方會變成白色方塊
        const keepAlpha = /^data:image\/(png|webp|gif)/i.test(dataUrl);
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
                        if (!keepAlpha) {
                            // 沒有透明資訊的圖轉 JPEG 前先鋪白底，避免變黑
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, w, h);
                        }
                        ctx.drawImage(img, 0, 0, w, h);
                        const out = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
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
            <div class="player-photo-container" data-team="${team}" data-index="${PITCHER_ROSTER_INDEX}">
                <img src="" id="player-photo-preview-${team}-${PITCHER_ROSTER_INDEX}" class="player-photo-preview" alt="照片">
                <label for="player-photo-upload-${team}-${PITCHER_ROSTER_INDEX}" class="image-upload-label">+</label>
                <button type="button" class="image-remove-btn" data-team="${team}" data-index="${PITCHER_ROSTER_INDEX}" aria-label="移除照片" title="移除照片">×</button>
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
                <div class="player-photo-container" data-team="${team}" data-index="${index}">
                    <img src="" id="player-photo-preview-${team}-${index}" class="player-photo-preview" alt="照片">
                    <label for="player-photo-upload-${team}-${index}" class="image-upload-label">+</label>
                    <button type="button" class="image-remove-btn" data-team="${team}" data-index="${index}" aria-label="移除照片" title="移除照片">×</button>
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
        hideWithFade(modalEl, 'modal-hidden');
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
    // 進階視窗往前走一步：先把現在這一步記起來，「返回」才退得回原本那一步
    function advGoStep(next: string) {
        const st: any = advancedPlayState;
        (st.stepStack || (st.stepStack = [])).push(st.step);
        st.step = next;
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
    // DH 開關的實際動作抽出來：畫面上的開關與重播都走這裡
    function applyDHToggle(teamKey: 'a' | 'b', on: boolean) {
        recordLogEntry({ t: 'dh', team: teamKey, on });
        const team = gameState.teams[teamKey];
        team.useDH = on;
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
    }
    function attachTeamSettingsListeners() {
        ['a', 'b'].forEach(teamKey => {
            const dhToggle = document.getElementById(`team-${teamKey}-dh-toggle`) as HTMLInputElement;
            // Re-assigning onchange overwrites the previous handler, avoiding listener stacking.
            dhToggle.onchange = () => {
                saveStateForUndo();
                applyDHToggle(teamKey as 'a' | 'b', dhToggle.checked);
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
        // 中文輸入法在選字過程中就會丟出事件，這時重建欄位會把正在打的字洗掉、
        // 焦點也會跑掉，所以選字期間先不套用，等選完字再一次處理
        let imeComposing = false;
        lineupForm.addEventListener('compositionstart', () => { imeComposing = true; });
        lineupForm.addEventListener('compositionend', () => { imeComposing = false; scheduleAutoApply(); });
        function scheduleAutoApply() {
            if (imeComposing) return;
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
            // 移除照片：把照片還原成預設，背號頭像就會自己回來
            const rm = (e.target as HTMLElement).closest('.image-remove-btn') as HTMLElement | null;
            if (rm) {
                e.preventDefault();
                const teamKey = rm.dataset.team as 'a' | 'b';
                const index = Number(rm.dataset.index);
                const player = gameState.teams[teamKey]?.roster[index];
                if (player) player.photo = DEFAULT_PLAYER_PHOTO_BASE64;
                const preview = document.getElementById(`player-photo-preview-${teamKey}-${index}`) as HTMLImageElement | null;
                if (preview) {
                    preview.src = playerPhotoSrc(player || {});
                    preview.closest('.player-photo-container')?.classList.remove('has-photo');
                }
                const fileInput = document.getElementById(`player-photo-upload-${teamKey}-${index}`) as HTMLInputElement | null;
                if (fileInput) fileInput.value = '';     // 同一張照片才能再選一次
                saveState();
                (window as any).__scheduleAutoApply?.();
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
        confirmResetBtn.addEventListener('click', () => { gameState = getInitialGameState(); gameStateHistory = []; resetReplayLog(); saveState(); createLineupInputs(); attachTeamSettingsListeners(); render(); closeModal(confirmModal); hideShell(); navigateToPanel(0); });
        // === 建立球隊（三步）===
        document.getElementById('ask-yes')?.addEventListener('click', () => {
            const fn = askYes; closeAsk(); tapFeedback(); fn && fn();
        });
        document.getElementById('ask-no')?.addEventListener('click', () => { tapFeedback(); closeAsk(); });
        document.getElementById('ask-modal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('ask-modal')) closeAsk();
        });
        document.getElementById('ob-start')?.addEventListener('click', () => { tapFeedback(); gotoOnboardStep(1); });
        document.getElementById('ob-enter')?.addEventListener('click', () => {
            tapFeedback(); closeLaunch(); showShell('home');
        });
        document.getElementById('ob-resume')?.addEventListener('click', () => {
            tapFeedback(); closeLaunch(); enterGameView();
        });
        document.getElementById('ob-team')?.addEventListener('click', () => {
            tapFeedback(); closeLaunch(); showShell('team');
        });
        document.querySelectorAll('#onboard-screen .ob-back').forEach(b => {
            b.addEventListener('click', () => { collectOnboardPlayers(); gotoOnboardStep(Number((b as HTMLElement).dataset.goto)); });
        });
        document.getElementById('ob-to-players')?.addEventListener('click', () => {
            const full = (document.getElementById('ob-fullname') as HTMLInputElement).value.trim();
            const short = (document.getElementById('ob-shortname') as HTMLInputElement).value.trim();
            if (!full && !short) { alert('至少要填球隊全名或簡稱。'); return; }
            if (!short) (document.getElementById('ob-shortname') as HTMLInputElement).value = full.slice(0, 5);
            tapFeedback();
            gotoOnboardStep(2);
        });
        document.getElementById('ob-logo-input')?.addEventListener('change', async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const url = await shrinkImage(await fileToDataUrl(f), 420);
            const img = document.getElementById('ob-logo-preview') as HTMLImageElement;
            img.src = url;
            document.getElementById('ob-logo-pick')?.classList.add('has-logo');
        });
        document.getElementById('ob-add-player')?.addEventListener('click', () => {
            collectOnboardPlayers();
            obPlayers.push(blankMember());
            renderOnboardPlayers();
        });
        document.getElementById('ob-players')?.addEventListener('click', (e) => {
            const del = (e.target as HTMLElement).closest('.ob-del');
            if (!del) return;
            collectOnboardPlayers();
            obPlayers.splice(Number((del.closest('.ob-player') as HTMLElement).dataset.i), 1);
            if (!obPlayers.length) obPlayers.push(blankMember());
            renderOnboardPlayers();
        });
        document.getElementById('ob-finish')?.addEventListener('click', () => {
            collectOnboardPlayers();
            const full = (document.getElementById('ob-fullname') as HTMLInputElement).value.trim();
            const short = (document.getElementById('ob-shortname') as HTMLInputElement).value.trim() || full.slice(0, 5);
            myTeam = {
                id: 'team_' + Date.now(),
                fullName: full || short,
                shortName: short,
                logo: (document.getElementById('ob-logo-preview') as HTMLImageElement).src.startsWith('data:')
                    ? (document.getElementById('ob-logo-preview') as HTMLImageElement).src : '',
                color: (document.getElementById('ob-color-input') as HTMLInputElement).value,
                foundedAt: new Date().toISOString().split('T')[0],
                players: obPlayers.filter(p => p.jersey || p.name).length ? obPlayers : obPlayers,
                lineups: [],
            };
            saveMyTeam();
            // 走 closeLaunch() 才會播淡出（直接加 hidden 會硬切）
            closeLaunch();
            showShell('team');
        });

        // === 五分頁 ===
        // 回主畫面一律停在首頁：留在「比賽」分頁會看到已經用過的建立流程，很怪
        document.getElementById('home-btn')?.addEventListener('click', () => { tapFeedback(); leaveGameView(); showShell('home'); });
        document.getElementById('team-btn')?.addEventListener('click', () => { tapFeedback(); leaveGameView(); showShell('team'); });
        document.getElementById('shell-nav')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.shell-tab') as HTMLElement;
            if (!btn) return;
            tapFeedback();
            if (btn.dataset.page === 'game' && shellPage !== 'game') resetGameSetup();
            setShellPage(btn.dataset.page);
            if (btn.dataset.page === 'game') renderGameSetup();
        });
        document.getElementById('home-continue')?.addEventListener('click', () => {
            tapFeedback();
            enterGameView();       // 卡片只在有未完成的比賽時才出現，按了就一定要進得去
        });
        // === 建立比賽（三步）===
        document.getElementById('gs-busy-back')?.addEventListener('click', () => { tapFeedback(); enterGameView(); });
        document.getElementById('gs-back')?.addEventListener('click', () => {
            tapFeedback();
            if (gsStep === 2) collectOppList();
            gsStep = Math.max(1, gsStep - 1);
            renderGameSetup();
        });
        document.querySelectorAll('.gs-side-btn').forEach(b => {
            b.addEventListener('click', () => {
                tapFeedback();
                gsSide = (b as HTMLElement).dataset.side;
                renderGameSetup();
            });
        });
        document.getElementById('gs-to-opp')?.addEventListener('click', () => {
            tapFeedback(); gsStep = 2; renderGameSetup();
        });
        document.getElementById('gs-to-lineup')?.addEventListener('click', () => {
            collectOppList(); tapFeedback(); gsStep = 3; renderGameSetup();
        });
        document.getElementById('gs-opp-add')?.addEventListener('click', () => {
            collectOppList(); gsOpp.push(blankMember()); renderOppList();
        });
        document.getElementById('gs-opp-list')?.addEventListener('click', (e) => {
            const del = (e.target as HTMLElement).closest('.mp-del');
            if (!del) return;
            collectOppList();
            gsOpp.splice(Number((del.closest('.mp-row') as HTMLElement).dataset.i), 1);
            if (!gsOpp.length) gsOpp.push(blankMember());
            renderOppList();
        });
        // 守位改了就重畫，別人的選單才會把被佔走的守位拿掉
        document.getElementById('gs-opp-list')?.addEventListener('change', (e) => {
            if (!(e.target as HTMLElement).classList.contains('mp-pos')) return;
            collectOppList();
            renderOppList();
        });
        document.getElementById('gs-opp-load')?.addEventListener('change', (e) => {
            const id = (e.target as HTMLSelectElement).value;
            const o = readOpponents().find(x => x.id === id);
            if (!o) return;
            (document.getElementById('gs-opp-name') as HTMLInputElement).value = o.name;
            gsOpp = (o.players || []).map(p => ({ ...blankMember(), ...p }));
            while (gsOpp.length < 10) gsOpp.push(blankMember());
            renderOppList();
        });
        document.getElementById('gs-lineup-pick')?.addEventListener('change', (e) => {
            const id = (e.target as HTMLSelectElement).value;
            const lu = ((myTeam && myTeam.lineups) || []).find(l => l.id === id);
            gsLineup.from = id;
            if (lu) {
                gsLineup.useDH = !!lu.useDH;
                gsLineup.spots = [...(lu.spots || Array(9).fill(''))];
                gsLineup.positions = [...(lu.positions || Array(9).fill(''))];
                gsLineup.pitcherId = lu.pitcherId || '';
            }
            renderStarters();
        });
        document.getElementById('gs-dh')?.addEventListener('click', (e) => {
            const b = (e.target as HTMLElement).closest('.dh-btn') as HTMLElement;
            if (!b) return;
            tapFeedback();
            applyLineupDH(gsLineup, b.dataset.dh === '1');
            renderStarters();
        });
        document.getElementById('gs-spots')?.addEventListener('change', (e) => {
            const t = e.target as HTMLElement;
            if (t.dataset.gspot !== undefined) gsLineup.spots[Number(t.dataset.gspot)] = (t as HTMLSelectElement).value;
            else if (t.dataset.gpos !== undefined) {
                gsLineup.positions = gsLineup.positions || Array(9).fill('');
                gsLineup.positions[Number(t.dataset.gpos)] = (t as HTMLSelectElement).value;
            }
            else return;
            renderStarters();   // 重畫一次，別棒才不會再選到同一個人或同一個守位
        });
        document.getElementById('gs-pitcher')?.addEventListener('change', (e) => {
            gsLineup.pitcherId = (e.target as HTMLSelectElement).value;
        });
        document.getElementById('gs-create')?.addEventListener('click', () => {
            tapFeedback();
            if (!createGameFromSetup()) return;
            enterGameView();
        });

        // === 比賽中的紀錄面板 ===
        document.getElementById('game-log-btn')?.addEventListener('click', () => { tapFeedback(); toggleLogSheet(); });
        document.getElementById('log-sheet-close')?.addEventListener('click', () => { tapFeedback(); toggleLogSheet(false); });
        document.getElementById('home-game-list')?.addEventListener('click', (e) => {
            const del = (e.target as HTMLElement).closest('.gl-del') as HTMLElement;
            if (del) {
                tapFeedback();
                askConfirm('確定要刪除這場比賽嗎？此操作無法復原。', () => {
                    (window as any).baseballGameManager?.deleteGame(del.dataset.del);
                    renderHomeGameList();
                }, '刪除');
                return;
            }
            const item = (e.target as HTMLElement).closest('.gl-item') as HTMLElement;
            if (!item) return;
            tapFeedback();
            const gm = (window as any).baseballGameManager;
            if (!adoptSavedGame(gm?.loadGame(item.dataset.game))) { alert('讀不到這場比賽。'); return; }
            gm?.switchToGame(item.dataset.game);
            enterGameView();
        });

        // === 球隊分頁 ===
        const teamField = (id, key, after?) => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                if (!myTeam) return;
                myTeam[key] = (e.target as HTMLInputElement).value.trim();
                saveMyTeam(); renderTeamPage(); after && after();
            });
        };
        teamField('team-short-input', 'shortName');
        teamField('team-full-input', 'fullName');
        teamField('team-color-input', 'color');
        document.getElementById('team-logo-input')?.addEventListener('change', async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f || !myTeam) return;
            myTeam.logo = await shrinkImage(await fileToDataUrl(f), 420);
            saveMyTeam(); renderTeamPage();
        });
        document.querySelectorAll('#page-team .team-row-link').forEach(b => {
            b.addEventListener('click', () => { tapFeedback(); openSub((b as HTMLElement).dataset.sub); });
        });
        document.getElementById('sub-body')?.addEventListener('input', (e) => {
            if ((e.target as HTMLElement).id === 'rq-q') filterRules((e.target as HTMLInputElement).value);
        });
        document.getElementById('sub-back')?.addEventListener('click', () => {
            const sub = document.getElementById('shell-sub') as HTMLElement;
            if (sub.dataset.editing) { delete sub.dataset.editing; renderSub(); return; }   // 先退出編輯
            tapFeedback(); closeSub();
        });

        // 子頁：球員與常用陣容（內容是動態產生的，用委派處理）
        document.getElementById('sub-body')?.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            const sub = document.getElementById('shell-sub') as HTMLElement;
            // 規則頁：點標題展開或收合那一段
            const head = t.closest('.rq-head');
            if (head) { tapFeedback(); head.parentElement?.classList.toggle('open'); return; }
            if (!myTeam) return;
            if (t.closest('#mp-add')) {
                collectSubPlayers();
                myTeam.players.push(blankMember());
                saveMyTeam(); renderSub(); renderTeamPage(); return;
            }
            const del = t.closest('.mp-del');
            if (del) {
                collectSubPlayers();
                const id = (del.closest('.mp-row') as HTMLElement).dataset.id;
                myTeam.players = myTeam.players.filter(p => p._id !== id);
                // 陣容裡用到這個人的格子要一起清掉，否則會指到不存在的球員
                (myTeam.lineups || []).forEach(l => {
                    l.spots = (l.spots || []).map(s => (s === id ? '' : s));
                    if (l.pitcherId === id) l.pitcherId = '';
                });
                saveMyTeam(); renderSub(); renderTeamPage(); return;
            }
            if (t.closest('#lu-add')) {
                myTeam.lineups = myTeam.lineups || [];
                const lu = { id: 'lu_' + Date.now(), name: '', useDH: !!appSettings.dh, spots: Array(9).fill(''), positions: Array(9).fill(''), pitcherId: '' };
                myTeam.lineups.push(lu);
                saveMyTeam();
                sub.dataset.editing = lu.id;
                renderSub(); return;
            }
            const item = t.closest('.lu-item') as HTMLElement;
            if (item) { sub.dataset.editing = item.dataset.lineup; renderSub(); return; }
            const dhBtn = t.closest('.dh-btn') as HTMLElement;
            if (dhBtn && t.closest('#lu-dh')) {
                const lu2 = (myTeam.lineups || []).find(l => l.id === sub.dataset.editing);
                if (lu2) {
                    // 關掉 DH：先發投手直接排進原本 DH 的那一棒；打開再換回來
                    applyLineupDH(lu2, dhBtn.dataset.dh === '1');
                    saveMyTeam(); renderSub();
                }
                return;
            }
            if (t.closest('#lu-done')) { delete sub.dataset.editing; renderSub(); renderTeamPage(); return; }
            if (t.closest('#lu-delete')) {
                const id = sub.dataset.editing;
                askConfirm('確定要刪除這套陣容嗎？', () => {
                    myTeam.lineups = myTeam.lineups.filter(l => l.id !== id);
                    saveMyTeam(); delete sub.dataset.editing; renderSub(); renderTeamPage();
                }, '刪除');
                return;
            }
        });
        // 背號一邊打，姓名欄的提示（簡稱＋背號）就一邊跟著變
        document.getElementById('sub-body')?.addEventListener('input', (e) => {
            const jersey = (e.target as HTMLElement).closest('.mp-jersey') as HTMLInputElement;
            if (!jersey || !myTeam) return;
            const row = jersey.closest('.mp-row') as HTMLElement;
            const name = row.querySelector('.mp-name') as HTMLInputElement;
            const i = [...row.parentElement.children].indexOf(row);
            name.placeholder = memberName({ name: '', jersey: jersey.value.trim() }, i);
        });
        document.getElementById('sub-body')?.addEventListener('change', async (e) => {
            const photo = (e.target as HTMLElement).closest('.mp-photo-input') as HTMLInputElement;
            if (photo) {
                const f = photo.files?.[0];
                const id = (photo.closest('.mp-row') as HTMLElement).dataset.id;
                const p = myTeam && (myTeam.players || []).find(x => x._id === id);
                if (!f || !p) return;
                collectSubPlayers();
                p.photo = await shrinkImage(await fileToDataUrl(f), 260);
                saveMyTeam(); renderSub();
                return;
            }
            const t = e.target as HTMLElement;
            const sub = document.getElementById('shell-sub') as HTMLElement;
            if (!myTeam) return;
            if (t.closest('.mp-row')) { collectSubPlayers(); saveMyTeam(); renderTeamPage(); return; }
            const lu = (myTeam.lineups || []).find(l => l.id === sub.dataset.editing);
            if (!lu) return;
            if (t.id === 'lu-name') lu.name = (t as HTMLInputElement).value.trim();
            else if (t.id === 'lu-pitcher') lu.pitcherId = (t as HTMLSelectElement).value;
            else if ((t as HTMLElement).dataset.pos !== undefined) {
                lu.positions = lu.positions || Array(9).fill('');
                lu.positions[Number((t as HTMLElement).dataset.pos)] = (t as HTMLSelectElement).value;
            }
            else if ((t as HTMLElement).dataset.spot !== undefined) {
                lu.spots = lu.spots || Array(9).fill('');
                lu.spots[Number((t as HTMLElement).dataset.spot)] = (t as HTMLSelectElement).value;
            }
            saveMyTeam();
            // 選完人或守位要重畫一次，別棒的選單才會把已經被佔走的拿掉
            if (t.id === 'lu-pitcher' || (t as HTMLElement).dataset.pos !== undefined
                || (t as HTMLElement).dataset.spot !== undefined) renderSub();
        });

        // === 設定 ===
        const settingField = (id, key, cast: any = String) => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                const el = e.target as HTMLInputElement;
                appSettings[key] = el.type === 'checkbox' ? el.checked : cast(el.value);
                saveSettings();
            });
        };
        settingField('set-lang', 'lang');
        settingField('set-innings', 'innings', Number);
        settingField('set-max-innings', 'maxInnings', Number);
        settingField('set-dh', 'dh');
        settingField('set-haptic', 'haptic');
        settingField('set-mercy', 'mercy');
        settingField('set-tiebreak', 'tiebreak');
        document.getElementById('set-rules')?.addEventListener('click', () => { tapFeedback(); openSub('rules'); });
        document.getElementById('set-backup')?.addEventListener('click', () => {
            const dump = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('baseball')) dump[k] = localStorage.getItem(k);
            }
            const blob = new Blob([JSON.stringify({ app: 'DiamondLog', version: APP_VERSION, data: dump }, null, 2)],
                { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `diamondlog-備份-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        });
        document.getElementById('set-restore')?.addEventListener('click', () => {
            (document.getElementById('set-restore-input') as HTMLInputElement).click();
        });
        document.getElementById('set-restore-input')?.addEventListener('change', async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
                const parsed = JSON.parse(await f.text());
                if (!parsed || !parsed.data) throw new Error('格式不對');
                askConfirm('還原備份會覆蓋現在的球隊與比賽資料，確定嗎？', () => {
                    Object.entries(parsed.data).forEach(([k, v]) => localStorage.setItem(k, v as string));
                    restartApp();
                }, '還原');
            }
            catch { alert('還原失敗：這個檔案不是 Diamond Log 的備份。'); }
        });
        document.getElementById('set-reset')?.addEventListener('click', () => {
            askConfirm('這會刪除球隊、名單與全部比賽紀錄，而且無法復原。確定要清除嗎？', () => {
            Object.keys(localStorage).filter(k => k.startsWith('baseball') || k === SAVED_ROSTERS_KEY)
                .forEach(k => localStorage.removeItem(k));
            myTeam = null;
            gameState = getInitialGameState();
            restartApp();
            }, '全部清除');
        });

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
            captureStartSnapshot();     // 重算的起點
            saveState();
            pushToGameList();
            render();
            startGameClock();
        });
        closeModalBtn.addEventListener('click', () => closeModal(modal));
        setupClockControls();
        setupEndReason();
        if (gameState.started && gameState.startTime) startGameClock();
        modal.addEventListener('click', (e) => { if (e.target === modal)
            closeModal(modal); });
        backButton.addEventListener('click', () => showModalStep('step1'));
        backButtonAdvanced.addEventListener('click', () => {
            const st: any = advancedPlayState;
            const stack: string[] = st.stepStack || (st.stepStack = []);
            const cur = st.step;
            const prev = stack[stack.length - 1];
            // 退回去之前，先把這一步做過的事情清掉
            if (cur === 'set-runners' && prev === 'select-fc-out' && st.outRunnerBase !== null) {
                delete st.runnerDestinations[`base-${st.outRunnerBase}`];
                st.outRunnerBase = null;
            }
            if (cur === 'select-error' && prev === 'ask-error') {
                st.error = null;
                st.errors = [];
            }
            // 已經在第一步了：離開視窗，回到原本叫出它的地方
            if (!stack.length) { backFromAdvanced(); return; }
            st.step = stack.pop();
            renderAdvancedPlayOptions();
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
            else if (t.closest('#pinch-run-btn')) { e.stopPropagation(); closeModal(managementModal); pinchRunPick(); }
        }, true);

        document.getElementById('picker-close')?.addEventListener('click', () => closeModal(document.getElementById('picker-modal')));
        // 主頁的跑者人像不再吃點擊：標落點時很容易誤觸。代跑改到「球員調度」裡。
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
                if (play === '打序錯誤') { closeModal(modal); openBattingOrderFix(); return; }
                const playCategory = PLAY_TYPE_CATEGORIES[play];
                const isHit = ['hit'].includes(playCategory);
                const isAdvancedOut = ['sacrifice'].includes(playCategory);
                const isAdvancedOnBase = ['error', 'walk', 'fielder-choice', 'interference'].includes(playCategory) && !['四壞', '故意四壞', '觸身球'].includes(play);
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
                else if (step === 'toggle-fsf') {
                    (advancedPlayState as any).foulSF = !(advancedPlayState as any).foulSF;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'toggle-ihr') {
                    (advancedPlayState as any).insideHR = !(advancedPlayState as any).insideHR;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'toggle-rundown') {
                    advancedPlayState.rundown = !isRundown(advancedPlayState.fielders || [], advancedPlayState.rundown);
                    renderAdvancedPlayOptions();
                }
                else if (step === 'add-error') {
                    advGoStep('select-error');
                    renderAdvancedPlayOptions();
                }
                else if (step === 'clear-error') {
                    advancedPlayState.error = null;
                    advancedPlayState.errors = [];
                    renderAdvancedPlayOptions();
                }
                else if (step === 'ask-error') {
                    advGoStep(choice === 'yes' ? 'select-error' : 'set-runners');
                    renderAdvancedPlayOptions();
                }
                else if (step === 'select-error') {
                    advGoStep('set-runners');
                    advancedPlayState.errors = [...(advancedPlayState.errors || []), errorPos];
                    advancedPlayState.error = advancedPlayState.errors[0];
                    // 失誤分兩種（手冊 2-41）：
                    //   決定性失誤 E＝本來抓得到出局卻沒抓到（算一次守備機會）
                    //   多餘壘失誤 e＝抓不到出局，只是讓人多跑了壘（不算守備機會）
                    // 預設用「打者是不是靠這個失誤才沒出局」判斷，不對的話點籌碼可以改。
                    const auto = (!HIT_BASES[advancedPlayState.play]
                        && advancedPlayState.play !== '妨礙打擊'
                        && !advancedPlayState.batterIsOut) ? 'E' : 'e';
                    (advancedPlayState as any).errorKinds = [
                        ...((advancedPlayState as any).errorKinds || []), auto];
                    renderAdvancedPlayOptions();
                }
                else if (step === 'toggle-error-kind') {
                    const i = Number(button.dataset.idx);
                    const kinds = [...((advancedPlayState as any).errorKinds || [])];
                    kinds[i] = kinds[i] === 'E' ? 'e' : 'E';
                    (advancedPlayState as any).errorKinds = kinds;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'remove-error') {
                    const idx = Number(button.dataset.idx);
                    const list = [...(advancedPlayState.errors || [])];
                    list.splice(idx, 1);
                    advancedPlayState.errors = list;
                    advancedPlayState.error = list[0] || null;
                    const kinds = [...((advancedPlayState as any).errorKinds || [])];
                    kinds.splice(idx, 1);
                    (advancedPlayState as any).errorKinds = kinds;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'select-interferer') {
                    const who = button.dataset.interferer;
                    (advancedPlayState as any).interferer = who;
                    if (who === 'batter') {
                        advancedPlayState.batterIsOut = true;
                        advancedPlayState.batterDestination = { dest: 0, isUnearned: false };
                    }
                    else {
                        // 跑者被界內球打到：跑者出局，打者上一壘（記一壘安打）
                        advancedPlayState.batterIsOut = false;
                        advancedPlayState.batterDestination = { dest: 1, isUnearned: false };
                        advancedPlayState.runnerDestinations[`base-${who}`] = { dest: 0, isUnearned: false };
                    }
                    advGoStep('set-runners');
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
                    advGoStep('set-runners');
                    renderAdvancedPlayOptions();
                }
                else if (step === 'set-runners') {
                    if (runnerId) {
                        const runnerKey = `base-${runnerId}`;
                        advancedPlayState.runnerDestinations[runnerKey] = { dest: Number(dest), isUnearned: advancedPlayState.runnerDestinations[runnerKey]?.isUnearned || false };
                    }
                    else { // Batter
                        const outAdvancing = button.dataset.outAdvancing === '1';
                        // 跑過頭（overrun）＝已經安全到達那個壘，安打壘數照算；
                        // 滑過頭（overslide）＝沒有安全到達，只能算到前一個壘（規則 9.06(c)）
                        const overslide = button.dataset.overslide === '1';
                        advancedPlayState.batterDestination = {
                            dest: outAdvancing ? 0 : Number(dest),
                            isUnearned: advancedPlayState.batterDestination?.isUnearned || false,
                            ...(outAdvancing ? { outAdvancing: true } : {}),
                            ...(overslide ? { overslide: true } : {})
                        } as any;
                    }
                    renderAdvancedPlayOptions(); // Re-render to show selection
                }
                else if (step === 'set-obstruction-by') {
                    (advancedPlayState as any).obstructionBy = button.dataset.errorPos;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'overthrow') {
                    // 傳球出界是罰則進壘：從傳球當下的位置再進兩個壘。
                    // 這裡用「原本的壘包＋2」換算，打者則是他原本要去的壘再加兩個。
                    const bases = advancedPlayState.originalBases;
                    bases.forEach((runner, i) => {
                        if (!runner) return;
                        advancedPlayState.runnerDestinations[`base-${i}`] =
                            { dest: Math.min(i + 3, 4), isUnearned: true };
                    });
                    if (!advancedPlayState.batterIsOut) {
                        const now = advancedPlayState.batterDestination.dest || 1;
                        advancedPlayState.batterDestination = { dest: Math.min(now + 2, 4), isUnearned: true };
                    }
                    (advancedPlayState as any).overthrow = true;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'toggle-obstruction') {
                    advancedPlayState.obstruction = !advancedPlayState.obstruction;
                    if (!advancedPlayState.obstruction) (advancedPlayState as any).obstructionBy = null;
                    renderAdvancedPlayOptions();
                }
            }
        });
        stadiumInput.addEventListener('input', () => {
            gameState.stadium = stadiumInput.value;
            saveState();
        });
        stadiumInput.addEventListener('change', () => rememberStadium(stadiumInput.value));
        document.getElementById('stadium-history-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            tapFeedback();
            toggleStadiumHistory();
        });
        document.getElementById('stadium-history')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.stadium-history-item') as HTMLButtonElement | null;
            if (!btn) return;
            stadiumInput.value = btn.textContent || '';
            stadiumInput.dispatchEvent(new Event('input', { bubbles: true }));
            rememberStadium(stadiumInput.value);
            toggleStadiumHistory(false);
        });
        document.addEventListener('click', () => toggleStadiumHistory(false));
        gameDateInput.addEventListener('change', () => {
            gameState.gameDate = gameDateInput.value;
            renderDateFace();
            saveState();
        });
        document.getElementById('date-prev')?.addEventListener('click', () => { tapFeedback(); shiftGameDate(-1); });
        document.getElementById('date-next')?.addEventListener('click', () => { tapFeedback(); shiftGameDate(1); });
        if (weatherInput) {
            weatherInput.addEventListener('change', () => {
                gameState.weather = weatherInput.value;
                saveState();
            });
        }
        // 事件列表上的 ✎：選擇重記或刪除這一筆
        const eventEditModal = document.getElementById('event-edit-modal');
        let editTargetIndex = -1;
        document.getElementById('event-log')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.ev-edit') as HTMLElement | null;
            if (!btn) return;
            editTargetIndex = Number(btn.dataset.entry);
            const text = document.getElementById('event-edit-text');
            if (text) {
                const li = btn.closest('li');
                text.textContent = (li?.querySelector('.ev-text') as HTMLElement)?.textContent?.trim() || '';
            }
            const redo = document.getElementById('event-redo-btn');
            if (redo) redo.textContent = `重記這一筆（${entryLabel(editTargetIndex)}）`;
            eventEditModal?.classList.remove('modal-hidden');
        });
        document.getElementById('event-edit-cancel')?.addEventListener('click', () => eventEditModal?.classList.add('modal-hidden'));
        eventEditModal?.addEventListener('click', (e) => {
            if (e.target === eventEditModal) eventEditModal.classList.add('modal-hidden');
        });
        document.getElementById('event-redo-btn')?.addEventListener('click', () => {
            eventEditModal?.classList.add('modal-hidden');
            startEntryEdit(editTargetIndex);
        });
        document.getElementById('event-delete-btn')?.addEventListener('click', () => {
            eventEditModal?.classList.add('modal-hidden');
            deleteLogEntry(editTargetIndex);
        });
        document.getElementById('edit-mode-cancel')?.addEventListener('click', () => cancelEntryEdit());
        // 手機打字（尤其是中文輸入法的選字列）會把整頁往上推，有些機型關掉鍵盤後
        // 不會自己捲回來，畫面就卡在奇怪的位置回不去。輸入結束後主動歸位。
        let restoreViewTimer: any = null;
        document.addEventListener('focusout', () => {
            clearTimeout(restoreViewTimer);
            restoreViewTimer = setTimeout(() => {
                const el = document.activeElement as HTMLElement | null;
                if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;   // 只是換到下一格
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
                navigateToPanel(currentPanelIndex);      // 面板的左右位移也歸位
            }, 80);
        });
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
            pendingBall = null;
            awaitingPoint = false;
            hideFieldHint();
            renderFieldBatter();
            const mark = document.getElementById('mf-mark');
            if (mark) (mark as any).style.display = 'none';
            if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }
        }

        // 打者鎖住與否由外層的 awaitingPoint 決定（renderFieldBatter 放在外層，主畫面重繪時要叫得到）
        function showFieldHint(text) {
            const hint = document.getElementById('field-hint');
            const t = document.getElementById('field-hint-text');
            if (!hint || !t) return;
            t.textContent = text;
            hint.classList.remove('hidden');
        }
        function hideFieldHint() {
            document.getElementById('field-hint')?.classList.add('hidden');
            document.getElementById('game-state-display')?.classList.remove('await-point');
        }
        // 打席選單：沒打到的直接記完，打出去的先選球種再標落點
        function showAtBatMenu() {
            if (!resultPanel || gameState.isGameOver || !gameState.started) return;
            const batter = getCurrentBatter();
            const idx = gameState.currentBatterIndex[gameState.isTop ? 'a' : 'b'];
            const noContact = [
                { play: '三振', label: '三振' },
                { play: '四壞', label: '四壞' },
                { play: '觸身球', label: '觸身' },
                { play: '__more', label: '其他' },
            ];
            resultPanel.innerHTML =
                `<div class="frp-title"><span>第${idx + 1}棒 ${batter ? batter.name : ''}　這球怎麼了？</span></div>`
                + `<div class="frp-group"><span class="frp-group-label">沒打到</span><div class="frp-options">`
                + noContact.map(o => `<button type="button" data-play="${o.play}">${o.label}</button>`).join('')
                + `</div></div>`
                + `<div class="frp-group"><span class="frp-group-label">打出去了</span><div class="frp-balls">`
                + BALL_KINDS.map(b => `<button type="button" data-ball="${b.key}">${b.label}</button>`).join('')
                + `</div></div>`
                + `<button type="button" class="frp-all" data-ball="all">不確定，直接標落點</button>`
                + `<button type="button" class="frp-cancel" data-cancel="1">取消</button>`;
            resultPanel.classList.remove('hidden');
        }
        // 選好球種：把選單收起來，解鎖球場等使用者標落點
        function startPointPending(ball: string | null) {
            pendingBall = ball;
            awaitingPoint = true;
            if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }
            const word = (BALL_KINDS.find(b => b.key === ball) || { label: '' }).label;
            showFieldHint(`${word ? word + '：' : ''}點一下球落在哪裡（可按住拖曳）`);
            document.getElementById('game-state-display')?.classList.add('await-point');
            renderFieldBatter();
        }
        // 落點標好之後先問球種：一次只看四顆大按鈕，比一次列十幾個結果好按
        const BALL_KINDS = [
            { key: 'G', label: '滾地球' },
            { key: 'L', label: '平飛球' },
            { key: 'F', label: '高飛球' },
            { key: 'B', label: '短打' },
        ];
        let pendingBall: string | null = null;
        // 從球場落點進到進階視窗時，把落點記著；按「返回」才回得到落點結果選單。
        // 走「其他」那條路（打席選單 → 分類 → 結果）進來的設成 null，返回照舊回分類頁。
        let lastFieldPick: { point: any; zone: any; ball: string | null } | null = null;
        function fieldMiniMap() {
            const dot = pendingPoint
                ? `<circle class="frp-map-dot" cx="${pendingPoint.x}" cy="${pendingPoint.y}" r="26"/>` : '';
            return `<svg class="frp-map" viewBox="18 -35 370 425" aria-hidden="true">`
                + `<path class="frp-map-fan" d="M202 341 L15 154 A265 265 0 0 1 389 154 Z"/>`
                + `<path class="frp-map-infield" d="M202 341 L127 271 L202 198 L275 272 Z"/>`
                + dot + `</svg>`;
        }
        // 內野高飛必死球成立的條件（規則 5.09(a)(5)）
        function infieldFlyPossible() {
            const b = gameState.bases;
            return gameState.outs < 2 && !!b[0] && !!b[1];
        }
        function zoneWordOf(zone) {
            return zone === 'foul' ? '界外' : zone === 'infield' ? '內野' : '外野';
        }
        function showResultOptions(zone, ball: string | null = null) {
            // 內野高飛必死球只有「一二壘有人或滿壘、而且不到兩出局」才成立，
            // 其他情況不要列出來，免得誤選
            const list = ZONE_PLAYS.field.filter((o: any) => o.when !== 'infieldFly' || infieldFlyPossible());
            if (!resultPanel) return;
            pendingBall = ball;
            const groups = ['安打', '出局', '其他'];
            const zoneWord = zoneWordOf(zone);
            const ballWord = (BALL_KINDS.find(b => b.key === ball) || { label: '' }).label;
            const fits = (o: any) => (!o.zones || o.zones.indexOf(zone) >= 0)
                && (!ball || !o.balls || o.balls.indexOf(ball) >= 0);
            // 出局數不夠就按不動：雙殺至少要再抓 2 個、三殺要 3 個
            const needOuts = { 雙殺: 2, 三殺: 3 };
            const btn = (o: any) => {
                const need = needOuts[o.play] || 0;
                const short = need && gameState.outs + need > 3;
                const why = short ? ` disabled title="已經${gameState.outs}人出局，湊不到${o.label}"` : '';
                return `<button type="button" data-play="${o.play}" class="${o.out ? 'is-out' : ''}"${why}>${o.label}</button>`;
            };
            const section = (items: any[]) => groups.map(g => {
                const inGroup = items.filter(o => o.group === g);
                if (!inGroup.length) return '';
                return `<div class="frp-group"><span class="frp-group-label">${g}</span><div class="frp-options">`
                    + inGroup.map(btn).join('') + `</div></div>`;
            }).join('');
            const main = list.filter(fits);
            const rest = list.filter(o => !fits(o));
            // 選單會蓋住球場，所以在標題旁放一張小圖，隨時看得到剛才點在哪裡
            resultPanel.innerHTML =
                `<div class="frp-title">${fieldMiniMap()}<span>落點：${zoneWord}${ballWord ? '　' + ballWord : ''}　選擇結果</span></div>`
                + `<button type="button" class="frp-back" data-back-ball="1">← 回上一步</button>`
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
                // 落點時已經選過球種，全部沿用（原本只有雙殺／三殺會帶，
                // 導致平飛球接殺的敘述被寫成「高飛球」）。
                // 'all'（不確定，直接標落點）不在清單裡，會留著預設值。
                if (pendingBall && ['G', 'L', 'F', 'B'].includes(pendingBall)) {
                    advancedPlayState.ballType = pendingBall;
                }
                if (pendingPoint) {
                    // 主畫面已經標好落點，換算成記錄用小圖座標後直接沿用，
                    // 後面的視窗只顯示結果，不再要求重選一次。
                    const mini = mainPointToMini(pendingPoint);
                    advancedPlayState.hitPoint = mini;
                    advancedPlayState.pointConfirmed = true;
                    const auto = fielderInZone(fielderFromMiniPoint(mini), mini, pendingZone);
                    if (auto) {
                        // 全壘打沒有野手「處理」，但方向還是要留著（左外野全壘打），
                        // 敘述的方向就是守備鏈的第一個人，所以只放一個、不接後面的傳球。
                        setFielderChain(play === '本打' ? [auto] : defaultFielderChain(play, auto));
                        advancedPlayState.directionAuto = true;
                    }
                }
                lastFieldPick = pendingPoint
                    ? { point: pendingPoint, zone: pendingZone, ball: pendingBall } : null;
                renderAdvancedPlayOptions();
                openModal(modal, modalContent);
                showModalStep('advanced');
            }
            else {
                handlePlay(play);
            }
            clearPendingPoint();
        }

        // 進階視窗最前面那一步再按「返回」要回哪裡：
        // 從球場落點進來的就回落點結果選單（紅點放回去），
        // 從「其他」進來的才回原本的分類頁。以前一律回分類頁，
        // 但那條路沒有填過內容，會變成一個只剩「返回」的空視窗（踩過一次）。
        function backFromAdvanced() {
            if (!lastFieldPick) { showModalStep('step2'); return; }
            closeModal(modal);
            pendingPoint = lastFieldPick.point;
            pendingZone = lastFieldPick.zone;
            awaitingPoint = false;
            moveMarkTo(pendingPoint);
            renderFieldBatter();
            showResultOptions(pendingZone, lastFieldPick.ball);
        }

        // 落點標記：把紅點移到座標上（拖曳過程中也一直呼叫）
        function moveMarkTo(point, animate = false) {
            const mark = document.getElementById('mf-mark');
            if (!mark) return;
            mark.setAttribute('cx', String(point.x));
            mark.setAttribute('cy', String(point.y));
            (mark as any).style.display = '';
            if (animate) {
                // 重新播一次擴散動畫，讓人看得出「這一下有點到」
                mark.classList.remove('just-tapped');
                void (mark as any).getBoundingClientRect();
                mark.classList.add('just-tapped');
            }
        }
        // 點一下就標好，也可以按著拖到想要的位置再放開；放開才跳出結果選單
        function canMarkField(e) {
            if (gameState.isGameOver || !gameState.started) return false;               // 未開賽先按 PLAY BALL
            // 新流程：一定要先點本壘的打者、選過球種，球場才收落點。
            // 沒解鎖就不能吃掉事件，否則本壘打者那一下點擊會被球場搶走。
            return awaitingPoint;
        }
        function setPendingFromEvent(e) {
            pendingPoint = fieldPointFrom(e, mainField as any);
            pendingZone = zoneOfPoint(pendingPoint);
        }
        if (mainField) {
            let dragging = false;
            mainField.addEventListener('pointerdown', (e) => {
                if (!canMarkField(e)) return;
                // 這裡要自己吃掉事件，不然按著拖會被當成左右滑動換頁
                e.preventDefault();
                e.stopPropagation();
                dragging = true;
                if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }
                setPendingFromEvent(e);
                moveMarkTo(pendingPoint, true);
                tapFeedback();
                try { (mainField as any).setPointerCapture((e as PointerEvent).pointerId); } catch { /* 不支援就算了 */ }
            });
            mainField.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                e.preventDefault();
                setPendingFromEvent(e);
                moveMarkTo(pendingPoint);
            });
            const finishDrag = (e) => {
                if (!dragging) return;
                dragging = false;
                try { (mainField as any).releasePointerCapture((e as PointerEvent).pointerId); } catch { /* 同上 */ }
                setPendingFromEvent(e);
                moveMarkTo(pendingPoint);
                awaitingPoint = false;
                hideFieldHint();
                renderFieldBatter();
                showResultOptions(pendingZone, pendingBall);
            };
            mainField.addEventListener('pointerup', finishDrag);
            mainField.addEventListener('pointercancel', () => { dragging = false; });
            // 沒有 pointer 事件的環境（例如測試用的 jsdom）仍走原本的點一下
            mainField.addEventListener('click', (e) => {
                if ((window as any).PointerEvent) return;      // 已由上面處理過
                if (!canMarkField(e)) return;
                setPendingFromEvent(e);
                moveMarkTo(pendingPoint, true);
                tapFeedback();
                awaitingPoint = false;
                hideFieldHint();
                renderFieldBatter();
                showResultOptions(pendingZone, pendingBall);
            });
        }

        // 本壘的打者：點一下叫出打席選單（等標落點時鎖住，避免誤觸）
        document.getElementById('mf-batter')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (awaitingPoint || !gameState.started || gameState.isGameOver) return;
            tapFeedback();
            showAtBatMenu();
        });
        document.getElementById('field-hint-cancel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            clearPendingPoint();
        });
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
                if (btn.dataset.ball) {
                    tapFeedback();
                    startPointPending(btn.dataset.ball === 'all' ? null : btn.dataset.ball);
                    return;
                }
                // 選錯球種：回到打席選單重選
                if (btn.dataset.backBall) { tapFeedback(); clearPendingPoint(); showAtBatMenu(); return; }
                if (btn.dataset.play === '__more') {
                    tapFeedback();
                    clearPendingPoint();
                    lastFieldPick = null;
                    showModalStep('step1');
                    openModal(modal, modalContent);
                    return;
                }
                if (btn.dataset.play) { tapFeedback(); runPlay(btn.dataset.play); }
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
        // 換頁一律用底部那三個分頁。原本的左右滑動拿掉了：
        // 它會跟球場上「按住拖曳標落點」搶手勢。
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
            if (i === index) dot.setAttribute('aria-current', 'page');
            else dot.removeAttribute('aria-current');
        });
    }
    function saveState() {
        if (isReplaying) return;      // 重播只是算給自己看，不要覆蓋真正的存檔
        // 紙條（重播用）跟著比賽一起存，關掉 APP 再打開也還能改前面的打席。
        // 平常兩者分開放，是為了讓「上一動」的備份不用一直複製整疊紙條。
        const payload: any = { ...gameState };
        if (startSnapshot) payload.replay = { start: startSnapshot, log: playLog };
        try {
            localStorage.setItem('baseballGameState', JSON.stringify(payload));
        }
        catch (e) {
            // 空間不夠時先保比賽本身，紙條可以犧牲（頂多不能改前面的打席）
            try {
                delete payload.replay;
                localStorage.setItem('baseballGameState', JSON.stringify(payload));
                console.warn('存檔空間不足，這場比賽的修改紀錄沒有存進去');
            }
            catch (e2) { console.warn('存檔失敗', e2); }
        }
    }
    function loadState() {
        const savedState = localStorage.getItem('baseballGameState');
        gameStateHistory = [];
        // 換一場比賽（或重新整理）就沒有重算起點了，等下次開賽再拍
        resetReplayLog();
        if (savedState) {
            const loaded = JSON.parse(savedState);
            if (!loaded.teams?.a?.roster || loaded.teams.a.roster.length < ROSTER_SIZE) {
                console.warn('Game state version mismatch or corrupted. Starting a new game.');
                gameState = getInitialGameState();
                return;
            }
            // 把紙條拆出來（舊存檔沒有這一段就是不能改前面的打席）
            if (loaded.replay && loaded.replay.start && Array.isArray(loaded.replay.log)) {
                startSnapshot = loaded.replay.start;
                playLog = loaded.replay.log;
            }
            delete loaded.replay;
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
        if (isReplaying) return;      // 重播不動畫面
        renderEditModeBar();
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
        renderDateFace();
        if (weatherInput)
            weatherInput.value = gameState.weather || 'sunny';
        renderGameMetaStatic();
    }
    function renderScoreboard() {
        const headerRow = document.getElementById('scoreboard-header-row');
        const tbody = document.getElementById('scoreboard-body');
        const numInnings = Math.max(rulesOf().innings || 9, gameState.inning);
        // 目前進行中的局（用於高亮，取代原本的格線提示）
        const activeInning = gameState.isGameOver ? -1 : gameState.inning;
        headerRow.innerHTML = `<th class="team-col"></th>${Array.from({ length: numInnings }, (_, i) => `<th class="${i + 1 === activeInning ? 'inning-now' : ''}">${i + 1}</th>`).join('')}<th class="rhe rhe-first">R</th><th class="rhe">H</th><th class="rhe">E</th>`;
        tbody.innerHTML = ['a', 'b'].map(teamKey => {
            const team = gameState.teams[teamKey];
            const totalRuns = team.score.reduce((a, b) => a + (b || 0), 0);
            // 進攻中的那一隊：正在進行的那個半局的那一格反白
            const batting = gameState.started && !gameState.isGameOver
                && ((gameState.isTop && teamKey === 'a') || (!gameState.isTop && teamKey === 'b'));
            let scoreCells = '';
            for (let i = 0; i < numInnings; i++) {
                const score = team.score[i];
                const hasPlayed = gameState.inning > i + 1 || (gameState.inning === i + 1 && (teamKey === 'a' || !gameState.isTop));
                // 只有「正在進行的那個半局」那一格反白，同一欄另一隊的格子不反白
                const nowCls = (i + 1 === activeInning && batting) ? ' class="inning-now"' : '';
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
        el.classList.remove('hidden');
        // 還沒開賽也要看得到計時器，停在 00:00，按了 PLAY BALL 才開始跑
        if (!gameState.started || !gameState.startTime) {
            el.textContent = '00:00';
            el.classList.remove('stopped', 'paused');
            return;
        }
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
    // 點擊回饋：能震動就震一下（Android 有效；iPhone 的 Safari 不支援，會自動忽略）
    function tapFeedback(ms = 12) {
        try { (navigator as any).vibrate?.(ms); } catch (e) { /* 不支援就算了 */ }
    }
    (window as any).__tapFeedback = tapFeedback;   // 供測試
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
    // 結束計時＝這場比賽打完了，所以順便把比賽結束掉；按下去先問一次。
    // 用自己的視窗問，系統的 confirm() 在內嵌環境會被擋掉（按了完全沒反應）
    // 打擊順序錯誤（規則 6.03(b)）：被對方指出時，「應該上場打擊」的那一棒判出局，
    // 站上去的那位打者的結果取消。這裡先處理出局與打序歸位；
    // 已經記下去的錯誤結果，用事件列表右邊的鉛筆刪掉那一筆。
    function openBattingOrderFix() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const cands = (team.lineupSpots || []).map((sp, i) => {
            const p = getPlayerById(teamKey, sp.activePlayerId);
            return { _id: String(i), name: `${i + 1}棒 ${p ? p.name : ''}` };
        });
        openPicker({
            title: '打序錯誤：應該打擊的是哪一棒？',
            teamKey,
            candidates: cands,
            note: '選到的那一棒判出局，下一棒接著打。已經記下去的錯誤結果請用事件列表的鉛筆刪掉。',
            onPick: (spotStr) => {
                const spot = Number(spotStr);
                saveStateForUndo();
                recordLogEntry({ t: 'play', play: '打序錯誤', spot });
                snapshotSituation();
                const proper = getPlayerById(teamKey, team.lineupSpots[spot].activePlayerId);
                gameState.outs += 1;
                gameState.inningPotentialOuts += 1;
                const def = gameState.teams[teamKey === 'a' ? 'b' : 'a'];
                const ap = def.pitchers.find(p => p._id === def.activePitcherId);
                if (ap) ap.outsRecorded += 1;
                logEvent(`第${spot + 1}棒 ${proper ? proper.name : ''}\n打擊順序錯誤，應該打擊的球員被判出局。 ${Math.min(3, gameState.outs)}人出局。`, teamKey);
                // 下一棒從「應該打擊的那一棒」之後接著打
                gameState.currentBatterIndex[teamKey] = (spot + 1) % LINEUP_SIZE;
                if (!checkAndEndGame() && gameState.outs >= 3) endHalfInning();
                saveState();
                render();
            },
        });
    }
    (window as any).__orderFix = openBattingOrderFix;   // 供測試
    function stopClockAndEndGame() {
        if (gameState.endTime && gameState.isGameOver) return;
        document.getElementById('end-reason-modal')?.classList.remove('hidden');
    }
    // 選好結束原因才真的收尾
    const END_REASON_TEXT = {
        normal: '',
        called: '（因故中止，比賽成立）',
        suspended: '（保留，擇日續賽）',
        forfeit: '（沒收比賽）',
    };
    // 沒收比賽（規則 7.03）：比數直接記成「規定局數：0」給獲勝的那一隊，
    // 九局制就是 9：0、七局制就是 7：0。
    // 個人成績：第五局還沒開始就全部不算；已經開始就全部要記（規則 9.03(e)(2)）。
    // 勝敗投只有在「獲勝那一隊當時就領先」時才記。
    function applyForfeit(winKey: 'a' | 'b') {
        const reg = rulesOf().innings || 9;
        const scoreA = gameState.teams.a.score.reduce((x, y) => x + (y || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((x, y) => x + (y || 0), 0);
        const loseKey = winKey === 'a' ? 'b' : 'a';
        const winnerWasAhead = winKey === 'a' ? scoreA > scoreB : scoreB > scoreA;
        (gameState as any).forfeitWinner = winKey;
        (gameState as any).forfeitKeepStats = gameState.inning >= 5;
        (gameState as any).forfeitNoDecision = !winnerWasAhead;
        gameState.teams[winKey].score = [reg];
        gameState.teams[loseKey].score = [0];
    }
    function finishGame(reason: string, forfeitWinner?: 'a' | 'b') {
        document.getElementById('end-reason-modal')?.classList.add('hidden');
        stopClock();
        if (!gameState.isGameOver) {
            saveStateForUndo();
            (gameState as any).endReason = reason;
            if (reason === 'forfeit' && forfeitWinner) applyForfeit(forfeitWinner);
            endGame();
            saveState();
        }
        pushToGameList();
        render();
        leaveGameView();
        showShell('home');
    }
    function setupEndReason() {
        const box = document.getElementById('end-reason-modal');
        if (!box) return;
        box.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if (t.id === 'end-reason-cancel' || t === box) { box.classList.add('hidden'); return; }
            const btn = t.closest('.end-reason') as HTMLElement;
            if (!btn) return;
            tapFeedback();
            const reason = btn.dataset.reason || 'normal';
            if (reason === 'forfeit') {
                // 沒收比賽要先問是哪一隊獲勝，比數才知道要記給誰
                box.classList.add('hidden');
                openPicker({
                    title: '沒收比賽：哪一隊獲勝？',
                    teamKey: 'a',
                    candidates: (['a', 'b'] as const).map(k => ({
                        _id: k,
                        name: gameState.teams[k].name || (k === 'a' ? '客隊' : '主隊'),
                        jersey: '',
                        pos: k === 'a' ? '先攻' : '後攻',
                    })),
                    note: `比數會直接記成 ${(rulesOf().innings || 9)}：0。第五局還沒開始的話，個人成績不列入統計。`,
                    onPick: (k) => finishGame('forfeit', k as 'a' | 'b'),
                });
                return;
            }
            finishGame(reason);
        });
    }
    (window as any).__finishGame = finishGame;   // 供測試
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
            if (!gameState.started) return;             // 還沒開賽，沒有東西可以暫停
            pauseBtn.textContent = gameState.pausedAt ? '繼續計時' : '暫停計時';
            menu.classList.toggle('modal-hidden');
        });
        pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleClockPause(); closeMenu(); });
        stopBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); stopClockAndEndGame(); });
        document.addEventListener('click', closeMenu);
    }
    (window as any).__toggleClockPause = toggleClockPause;   // 供測試
    (window as any).__stopClock = stopClock;                 // 供測試
    (window as any).__stopClockAndEndGame = stopClockAndEndGame;   // 供測試
    (window as any).__formatElapsed = formatElapsed;   // 供測試
    // 本壘上的打者半身像：主畫面唯一的記錄入口。
    // 放在外層是因為 renderGameStateDisplay 每次重繪都要更新它（名字、鎖住與否）。
    let awaitingPoint = false;      // 已選球種、正在等使用者標落點
    function renderFieldBatter() {
        const g = document.getElementById('mf-batter');
        if (!g) return;
        // 球場上的半身圖示（打者與壘上跑者）用進攻方的球隊代表色（使用者要求）
        const field = document.getElementById('main-field');
        if (field) {
            const atk = gameState.teams[gameState.isTop ? 'a' : 'b'];
            (field as any).style.setProperty('--team-fig', atk?.color || '#fbbf24');
        }
        const live = gameState.started && !gameState.isGameOver;
        g.classList.toggle('hidden', !live);
        // 等標落點的時候把打者鎖住，免得點球場時誤觸
        g.classList.toggle('locked', awaitingPoint);
        const nameEl = g.querySelector('.mf-batter-name');
        const batter = getCurrentBatter();
        if (nameEl) nameEl.textContent = live && batter ? batter.name : '';
    }
    function renderGameStateDisplay() {
        const { inning, isTop, outs } = gameState;
        // 比賽結束就顯示「終場」，取代原本大比分列上的狀態字
        const inningEl = document.getElementById('inning-display');
        inningEl.textContent = gameState.isGameOver ? '終場' : `${inning}局${isTop ? '上' : '下'}`;
        // 上半局標▲、下半局標▼（三角形由 CSS 依這個記號畫）
        inningEl.dataset.half = gameState.isGameOver ? 'over' : (isTop ? 'top' : 'bottom');
        const batterDisplayContainer = document.getElementById('current-batter-display');
        batterDisplayContainer.innerHTML = ''; // Clear previous content
        const batter = getCurrentBatter();
        if (batter) {
            const teamKey = isTop ? 'a' : 'b';
            const team = gameState.teams[teamKey];
            const batterIndex = gameState.currentBatterIndex[teamKey];
            const photoContainer = document.createElement('div');
            photoContainer.innerHTML = `<img src="${batterPhotoSrc(batter)}" class="batter-photo-main" alt="${batter.name}">`;
            const infoTextEl = document.createElement('div');
            infoTextEl.id = 'batter-info-text';
            const mainInfoEl = document.createElement('div');
            mainInfoEl.id = 'batter-main-info';
            const lastAbEl = document.createElement('div');
            lastAbEl.id = 'batter-last-ab';
            infoTextEl.append(mainInfoEl);
            // 本場表現獨立成最下面一排（照片靠上對齊，這排跨滿整張卡片）
            batterDisplayContainer.append(photoContainer, infoTextEl, lastAbEl);
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
            // 本場打席結果用跟戰況表同一套簡稱（左2＝左外野二壘安打、二安＝二壘方向安打）
            const results = (batter.abResults || []).map(raw => situationLabel(raw));
            mainInfoEl.innerHTML = `
                <div class="batter-name-row">
                    <span class="batter-order">${team.name || ''} ${batterIndex + 1}棒</span>
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
            batterDisplayContainer.innerHTML = `<div id="batter-info-text"><div id="batter-main-info">請設定打序</div></div><div id="batter-last-ab"></div>`;
        }
        renderPreviousHits(batter);
        renderFieldBatter();
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
    // 記錄表結算檢查（手冊附錄 3）：
    // 打數＋犧短＋犧飛＋四壞＋觸身＋妨礙上壘＋得分＋殘壘＋突破僵局跑者
    //   ＝ 對手守備記到的刺殺總數。兩邊對不起來就代表哪裡漏記了。
    function balanceRowsFor(teamKey: 'a' | 'b') {
        const team = gameState.teams[teamKey];
        const foe = gameState.teams[teamKey === 'a' ? 'b' : 'a'];
        const sum = (list: any[], key: string) => list.reduce((n, p) => n + (Number(p && p[key]) || 0), 0);
        const bat = team.roster || [];
        const pa = sum(bat, 'pa');
        const tie = (team as any).tiebreakRunners || 0;
        const r = (team.score || []).reduce((x, y) => x + (y || 0), 0);
        const lob = (team as any).lob || 0;
        // 對手守備記到的刺殺（守備球員加投手；DH 制的投手不在打線裡）
        const po = sum(foe.roster || [], 'po') + sum(foe.pitchers || [], 'po');
        // 每一位站上打擊區的人，最後只有三種去向：得分、留在壘上、被抓出局。
        // 突破僵局制放上壘的跑者沒有打席，所以要另外加進左邊。
        const left = pa + tie;
        const right = r + lob + po;
        return { pa, tie, r, lob, po, left, right, ok: left === right };
    }
    function renderBalanceCheck(container: HTMLElement) {
        const wrap = document.createElement('div');
        wrap.className = 'balance-check';
        wrap.innerHTML = `<h4>記錄表結算檢查</h4>`
            + `<p class="bc-note">每一位站上打擊區的人，最後只有三種去向：得分、留在壘上、被抓出局。兩邊對不起來就代表有地方漏記了。</p>`
            + (['a', 'b'] as const).map(k => {
                const b = balanceRowsFor(k);
                return `<div class="bc-row ${b.ok ? 'bc-ok' : 'bc-bad'}">
                    <div class="bc-team">${gameState.teams[k].name || (k === 'a' ? '客隊' : '主隊')}</div>
                    <div class="bc-sum">打席 ${b.pa}${b.tie ? `＋突破僵局跑者 ${b.tie}` : ''} ＝ <b>${b.left}</b></div>
                    <div class="bc-sum">得分 ${b.r}＋殘壘 ${b.lob}＋對手刺殺 ${b.po} ＝ <b>${b.right}</b></div>
                    <div class="bc-verdict">${b.ok ? '✓ 對得起來' : '⚠ 差 ' + Math.abs(b.left - b.right) + '，有地方漏記了'}</div>
                </div>`;
            }).join('');
        container.appendChild(wrap);
    }
    (window as any).__balance = balanceRowsFor;   // 供測試
    function situationLabel(raw: string) {
        const res = String(raw).split('#')[0];
        let [name, dir] = res.split('@');
        let bt = '';
        const m = /~([LF])$/.exec(dir || name);
        if (m) { bt = m[1]; if (dir) dir = dir.replace(/~[LF]$/, ''); else name = name.replace(/~[LF]$/, ''); }
        const first = dir ? dir[0] : '';
        switch (name) {
            // 安打的簡稱：中文數字／方位＝球打去哪個方向，阿拉伯數字＝上到第幾壘（使用者指定）
            //   左2＝左外野方向的二壘安打；二安＝二壘方向的一壘安打
            case '一安': return first ? `${first}安` : '安';
            case '二安': return first ? `${first}2` : '2';
            case '三安': return first ? `${first}3` : '3';
            case '本打': return first ? `${first}H` : 'HR';
            case '場內全打': return first ? `${first}H場內` : 'HR場內';
            case '內安': return first ? `${first}內安` : '內安';
            case '場地二安': return first ? `${first}場2` : '場2';
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
        const innings = Math.max(rulesOf().innings || 9, gameState.inning);
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
        renderBalanceCheck(container);
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
        refreshEventOwner();
        const evs = gameState.events || [];
        // 半局的最後一則：下一行是局數標題（沒有 teamKey），或者整場就到這裡為止
        const isHalfEnd = (i: number) => {
            for (let k = i + 1; k < evs.length; k++) return !evs[k].teamKey;
            return true;
        };
        // 沒得分的事件本身不帶比分，所以一路把最近一次的比分帶下來
        let running = { a: 0, b: 0 };
        log.innerHTML = evs.map((gameEvent, i) => {
            if (!gameEvent.teamKey) return `<li class="ev-inning">${gameEvent.text}</li>`;
            const [title, ...rest] = String(gameEvent.text).split('\n');
            const body = rest.join(' ');
            if ((gameEvent as any).score) running = (gameEvent as any).score;
            // 有得分的那一則照舊附比分；另外每半局的最後一則也附一次，
            // 半局結束時一眼看得到目前比數（使用者要求）
            const showScore = ((gameEvent as any).scored && (gameEvent as any).score) || isHalfEnd(i);
            const sc = (gameEvent as any).score || running;
            const scoreChip = showScore
                ? `<span class="ev-score">`
                    + `<b style="color:${gameState.teams.a.color}">${gameState.teams.a.name}</b>`
                    + `<i>${sc.a} : ${sc.b}</i>`
                    + `<b style="color:${gameState.teams.b.color}">${gameState.teams.b.name}</b></span>`
                : '';
            // 比分小標放在敘述外面（自己一行），敘述本身維持乾淨
            const text = (body
                ? `<div class="ev-title">${title}</div><div class="ev-body">${body}</div>`
                : `<div class="ev-body">${title}</div>`) + scoreChip;
            // 有對應紙條的行才改得動；記號做得很淡，不干擾閱讀
            const owner = eventOwner[i];
            const editBtn = (owner === undefined || !gameState.started)
                ? ''
                : `<button type="button" class="ev-edit" data-entry="${owner}" aria-label="修改這一筆"></button>`;
            return `<li class="event-team-${gameEvent.teamKey}">${situationIcon(gameEvent.bases, gameEvent.outs)}<div class="ev-text">${text}</div>${editBtn}</li>`;
        }).reverse().join('');
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
                        // 只有真的上傳過照片才顯示「移除」，背號頭像不需要
                        photoPreview.closest('.player-photo-container')
                            ?.classList.toggle('has-photo', !isGeneratedAvatar(player.photo));
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
                    pitcherPhotoPreview.closest('.player-photo-container')
                        ?.classList.toggle('has-photo', !isGeneratedAvatar(pitcherPlayer.photo));
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
        // 這一筆之後的總比分；跟上一筆不同就代表有人得分，事件列表會在句尾附上比分
        const totals = {
            a: gameState.teams.a.score.reduce((x, y) => x + (y || 0), 0),
            b: gameState.teams.b.score.reduce((x, y) => x + (y || 0), 0),
        };
        const prev = [...gameState.events].reverse().find(e => (e as any).score);
        const scored = !prev || (prev as any).score.a !== totals.a || (prev as any).score.b !== totals.b;
        gameState.events.push({ text, teamKey, bases: snap.bases, outs: snap.outs, score: totals, scored } as any);
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
    // 找出守方現在守某個位置的人（守位代號如 'SS'）
    function fielderByPos(pos: string) {
        const t = gameState.teams[gameState.isTop ? 'b' : 'a'];
        const inLineup = (t.lineupSpots || []).map(sp => getPlayerById(gameState.isTop ? 'b' : 'a', sp.activePlayerId));
        const found = inLineup.find(p => p && p.pos === pos);
        if (found) return found;
        // DH 制的投手不在打線裡
        return (t.roster || []).find(p => p && p.pos === pos && (p.name || '').trim()) || null;
    }
    // 守備鏈換算成個人守備成績。
    // 規則：最後接到球完成出局的人記刺殺，中間傳球的人記助殺。
    // 雙殺 6-4-3 就是 6 助殺、4 刺殺＋助殺、3 刺殺——也就是
    // 「最後 N 個人各記一次刺殺（N＝這個 play 的出局數），最後一個以外的人各記一次助殺」。
    // catchFirst：飛球類的出局是「接到球的那一刻」完成的，所以第一位一定記一次刺殺，
    // 剩下的出局數（例如接殺後再傳殺離壘跑者）才輪到鏈尾。
    // 不這樣分的話，「接殺後傳三壘沒抓到」會把刺殺記到三壘手身上（他根本沒抓到人）。
    function creditFielding(chain: string[], outs: number, catchFirst = false) {
        if (!chain || !chain.length || outs <= 0) return;
        const players = chain.map(c => fielderByPos(CHAIN_TO_POS[c] || c));
        const poIdx = new Set<number>();
        if (catchFirst) {
            poIdx.add(0);
            for (let k = 0; k < outs - 1; k++) poIdx.add(players.length - 1 - k);
        }
        else {
            for (let k = 0; k < outs; k++) poIdx.add(players.length - 1 - k);
        }
        // 助殺只給「促成了那個刺殺」的傳球：鏈上最後一次刺殺之前的人才算。
        // 接殺之後再傳出去卻沒抓到人的那一傳，不是助殺（規則 9.10(a)(1)）。
        const lastPo = Math.max(...poIdx);
        players.forEach((p, i) => {
            if (!p) return;
            if (i < lastPo) p.a = (p.a || 0) + 1;                             // 助殺
            if (poIdx.has(i)) p.po = (p.po || 0) + 1;                         // 刺殺
        });
    }
    // 這個結果的出局是不是「接到球就完成」（飛球、平飛、界外飛球、內野高飛必死球，
    // 以及非滾地的雙殺三殺）
    const isCatchOut = (play: string, ballType?: string) =>
        ['飛球', '界飛', '犧飛', '內飛'].includes(play)
        || (['雙殺', '三殺'].includes(play) && !!ballType && ballType !== 'G');
    // 失誤記到那個位置的人身上（隊伍的失誤數本來就有累計）
    function creditErrors(list: string[]) {
        (list || []).forEach(pos => {
            const p = fielderByPos(pos);
            if (p) p.e = (p.e || 0) + 1;
        });
    }
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
    // 這位打者本場先前打席的落點：在球場上畫淡色的點與結果，方便比較守備位置
    function renderPreviousHits(batter) {
        const layer = document.getElementById('mf-ghosts');
        if (!layer) return;
        layer.innerHTML = '';
        const points = (batter && Array.isArray(batter.hitPoints)) ? batter.hitPoints.slice(-3) : [];
        if (!points.length) return;
        const last = points.length - 1;
        points.forEach((hp, i) => {
            if (typeof hp?.x !== 'number' || typeof hp?.y !== 'number') return;
            const p = miniPointToMain(hp);
            const label = (PLAY_ABBREVIATIONS[hp.play] || hp.play || '') + (hp.inning ? `　${hp.inning}局` : '');
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'mf-ghost' + (i === last ? ' mf-ghost-last' : ''));
            g.innerHTML =
                `<circle cx="${p.x}" cy="${p.y}" r="9"/>`
                + `<text x="${p.x}" y="${p.y - 14}" text-anchor="middle">${label}</text>`;
            layer.appendChild(g);
        });
    }
    function getCurrentBatter() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const batterIndex = gameState.currentBatterIndex[teamKey];
        const spot = team.lineupSpots[batterIndex];
        return spot ? getPlayerById(teamKey, spot.activePlayerId) : null;
    }
    // 投手上場那一刻：自家領先幾分、這場比賽已經打了幾個出局數
    function pitcherEntryInfo(teamKey: 'a' | 'b') {
        const mine = totalOf(teamKey), theirs = totalOf(teamKey === 'a' ? 'b' : 'a');
        const outsSoFar = (gameState.inning - 1) * 6 + (gameState.isTop ? 0 : 3) + gameState.outs;
        return { w: 0, l: 0, sv: 0, hld: 0, enterLead: mine - theirs, enterOuts: outsSoFar };
    }
    const totalOf = (k: 'a' | 'b') => gameState.teams[k].score.reduce((x, y) => x + (y || 0), 0);

    // 每次有人得分就記一筆：當下的比分、兩邊各是誰在投球。
    // 勝敗投要靠這條時間軸找出「領先之後再也沒被追平的那一刻」。
    // blameId：這一分該算在哪一位投手頭上（繼承跑者時是前一位）。
    // 敗投看的是「讓致勝分那位跑者上壘的投手」，不是當下在投的那位（規則 9.17(d)）。
    function pushScoreTimeline(blameId?: string) {
        const gs: any = gameState;
        gs.scoreLog = gs.scoreLog || [];
        gs.scoreLog.push({
            inning: gameState.inning,
            isTop: gameState.isTop,
            a: totalOf('a'),
            b: totalOf('b'),
            pa: gameState.teams.a.activePitcherId,
            pb: gameState.teams.b.activePitcherId,
            blame: blameId || '',
        });
    }
    // 勝投、敗投、救援（記錄規則 9.17、9.19）。
    // 自動判定＋在事件裡寫出來，記錄員看得到也改得掉（用修改前面某一筆）。
    // 先發不夠局數時，勝投改給「最有效的後援」——不是投最久的那位（規則 9.17(b)）。
    // 比的順序：失分少 → 責失少 → 被上壘的人少 → 投得久；都一樣就給比較早上場的。
    // 規則 9.17(c)：投不到一局又丟兩分以上的「短暫又失敗」的後援，後面還有人接手時不列入。
    function mostEffectiveRelief(pitchers: any[]) {
        const relief = pitchers.slice(1).filter(p => p.outsRecorded > 0);
        if (!relief.length) return null;
        const ok = relief.filter((p, i) =>
            !(p.outsRecorded < 3 && (p.er || 0) >= 2 && relief.slice(i + 1).length > 0));
        const pool = ok.length ? ok : relief;
        const onBase = (p: any) => (p.h || 0) + (p.bb || 0) + (p.hbp || 0);
        return pool.slice().sort((x, y) =>
            (x.r || 0) - (y.r || 0)
            || (x.er || 0) - (y.er || 0)
            || onBase(x) - onBase(y)
            || (y.outsRecorded - x.outsRecorded))[0] || null;
    }
    function decidePitcherRecords() {
        const gs: any = gameState;
        // 沒收比賽：獲勝的那一隊在被判沒收時如果沒有領先（平手或落後），
        // 就沒有勝投也沒有敗投（規則 9.03(e)(2)）
        if (gs.forfeitNoDecision) return null;
        const A = totalOf('a'), B = totalOf('b');
        if (A === B) return null;                       // 和局沒有勝敗投
        const winKey: 'a' | 'b' = A > B ? 'a' : 'b';
        const loseKey: 'a' | 'b' = winKey === 'a' ? 'b' : 'a';
        const log = (gs.scoreLog || []) as any[];
        const ahead = (e: any) => (winKey === 'a' ? e.a - e.b : e.b - e.a) > 0;
        // 勝隊「取得之後再也沒有丟掉的領先」是在哪一筆得分
        let idx = -1;
        for (let i = 0; i < log.length; i++) {
            if (ahead(log[i]) && log.slice(i).every(ahead)) { idx = i; break; }
        }
        const at = idx >= 0 ? log[idx] : null;
        const pick = (team: 'a' | 'b', e: any) => e ? (team === 'a' ? e.pa : e.pb) : gameState.teams[team].activePitcherId;
        const winners = gameState.teams[winKey].pitchers;
        const losers = gameState.teams[loseKey].pitchers;
        const byId = (list: any[], id: string) => list.find(p => p._id === id) || null;

        // 敗投：要為致勝分負責的投手＝「讓那位跑者上壘的人」，不一定是當下在投的那位（規則 9.17(d)）
        const loser = (at && at.blame && byId(losers, at.blame)) || byId(losers, pick(loseKey, at));
        let winner = byId(winners, pick(winKey, at));
        // 先發投手要投滿規定局數才拿得到勝投（九局制五局、其他局制四局）
        const starter = winners[0];
        const needOuts = (rulesOf().innings || 9) >= 9 ? 15 : 12;
        if (winner && starter && winner._id === starter._id && starter.outsRecorded < needOuts) {
            winner = mostEffectiveRelief(winners) || winner;
        }
        if (winner) winner.w = 1;
        if (loser) loser.l = 1;
        // 救援：最後把比賽守下來的那一位，不是勝投，而且
        //（上場時領先不超過 3 分並至少投滿一局）或（至少投滿三局）
        const last = winners[winners.length - 1];
        if (last && (!winner || last._id !== winner._id)) {
            const lead = last.enterLead || 0;
            if ((lead > 0 && lead <= 3 && last.outsRecorded >= 3) || last.outsRecorded >= 9) last.sv = 1;
        }
        // 中繼：中途上場、把領先交出去給下一位、投滿至少一個出局數
        winners.slice(1, Math.max(1, winners.length - 1)).forEach(p => {
            if ((p.enterLead || 0) > 0 && p.outsRecorded > 0 && !p.w && !p.sv) p.hld = 1;
        });
        return { winKey, winner, loser, save: last && last.sv ? last : null };
    }
    function endGame() {
        if (gameState.isGameOver)
            return; // Prevent multiple calls
        gameState.isGameOver = true;
        if (!gameState.endTime) gameState.endTime = Date.now();
        const scoreA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        const tie = scoreA === scoreB ? '（和局）' : '';
        const why = END_REASON_TEXT[(gameState as any).endReason] || '';
        const forfeitNote = ((gameState as any).endReason === 'forfeit'
            && (gameState as any).forfeitKeepStats === false)
            ? '　第五局前沒收，個人成績不列入統計。' : '';
        const rec = decidePitcherRecords();
        const recText = rec
            ? `　勝投 ${rec.winner ? rec.winner.name : '－'}／敗投 ${rec.loser ? rec.loser.name : '－'}`
                + (rec.save ? `／救援 ${rec.save.name}` : '')
            : '';
        logEvent(`比賽結束${tie}${why}。 終場比數 ${gameState.teams.a.name} ${scoreA} : ${scoreB} ${gameState.teams.b.name}。${recText}${forfeitNote}`);
        render();
    }
    function checkAndEndGame() {
        if (gameState.isGameOver)
            return false;
        const rules = rulesOf();
        const reg = rules.innings || 9;                 // 正規局數（七局制的球賽就是 7）
        const maxInn = rules.maxInnings || 0;           // 0＝不限延長
        const scoreA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        // 再見：最後一局（含延長）的下半，主隊超前就立刻結束
        if (gameState.inning >= reg && !gameState.isTop && scoreB > scoreA) {
            endGame();
            return true;
        }
        // 以下都要等這個半局結束才判斷
        if (gameState.outs < 3)
            return false;
        const isTopHalfJustEnded = gameState.isTop;
        // 上半打完，主隊已經領先，不用再打下半
        if (isTopHalfJustEnded && gameState.inning >= reg && scoreB > scoreA) {
            endGame();
            return true;
        }
        // 整局打完，客隊領先
        if (!isTopHalfJustEnded && gameState.inning >= reg && scoreA > scoreB) {
            endGame();
            return true;
        }
        // 提前結束（扣倒）：分差夠大就不用打完
        if (mercyReached(scoreA, scoreB, isTopHalfJustEnded)) {
            endGame();
            return true;
        }
        // 平手時依延長上限判和局；設成「不限」就一直打下去
        if (!isTopHalfJustEnded && maxInn && gameState.inning >= maxInn && scoreA === scoreB) {
            endGame();
            return true;
        }
        return false;
    }
    // 提前結束（扣倒）：例如「5 局後領先 10 分」「7 局後領先 7 分」。
    // 落後的那一隊要打完該局的進攻才算數，所以上半結束時只有主隊領先才適用。
    function mercyReached(scoreA: number, scoreB: number, isTopHalfJustEnded: boolean) {
        const list = (rulesOf().mercy || []).filter(m => m && m.inn > 0 && m.diff > 0);
        if (!list.length) return false;
        const lead = Math.abs(scoreA - scoreB);
        const homeLeads = scoreB > scoreA;
        if (isTopHalfJustEnded && !homeLeads) return false;   // 客隊領先要等主隊打完這一局
        return list.some(m => gameState.inning >= m.inn && lead >= m.diff);
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
        // 殘壘：清空壘包之前先數還留在壘上的人（記錄表結算的平衡式要用）
        const t = gameState.teams[currentTeamKey] as any;
        t.lob = (t.lob || 0) + gameState.bases.filter(Boolean).length;
        gameState.outs = 0;
        gameState.bases = [null, null, null];
        gameState.inningPotentialOuts = 0;
        applyTiebreak();
    }
    // 突破僵局制：延長賽一開場就先把跑者放上壘。
    // 放的是上一局最後出局的那幾棒——先出局的那位在前面（二壘），最後那位在一壘。
    // 這種跑者回來得分不算投手責失。
    function applyTiebreak() {
        const rules = rulesOf();
        const from = rules.tiebreakFrom || 0;
        if (!from || gameState.isGameOver || gameState.inning < from) return;
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const prev = (n: number) => (n - 1 + LINEUP_SIZE) % LINEUP_SIZE;
        const idx = gameState.currentBatterIndex[teamKey];
        const idAt = (spot: number) => (team.lineupSpots && team.lineupSpots[spot] && team.lineupSpots[spot].activePlayerId)
            || (team.roster[spot] && team.roster[spot]._id) || '';
        const put = (baseIdx: number, spot: number) => {
            const id = idAt(spot);
            // fromTiebreak：這兩位回來得分算球隊失分，不算投手的（WBSC 附錄 2）
            if (id) gameState.bases[baseIdx] = { runnerId: id, isUnearned: true, fromTiebreak: true } as any;
        };
        const twoRunners = rules.tiebreakBases === '12';
        if (twoRunners) { put(1, prev(prev(idx))); put(0, prev(idx)); }
        else put(1, prev(idx));
        // 這些跑者沒有打席也沒有打數，結算平衡式要另外算進去（手冊附錄 2）
        (team as any).tiebreakRunners = ((team as any).tiebreakRunners || 0)
            + gameState.bases.filter(Boolean).length;
        const names = gameState.bases
            .map((r, i) => r ? `${['一', '二', '三'][i]}壘 ${(getPlayerById(teamKey, r.runnerId) || { name: '' }).name}` : '')
            .filter(Boolean).join('、');
        logEvent(`突破僵局制：${names} 開始這一局。`, teamKey);
    }
    // 現在守備方在投球的那一位（跑者上壘時蓋在身上，之後算責失要用）
    function currentPitcherId() {
        const d = gameState.teams[gameState.isTop ? 'b' : 'a'];
        return d.activePitcherId;
    }
    function addRuns(runnersScored, rbis) {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const team = gameState.teams[teamKey];
        const inningIndex = gameState.inning - 1;
        if (team.score[inningIndex] === undefined) {
            team.score[inningIndex] = 0;
        }
        const batter = getCurrentBatter();
        if (batter) {
            batter.rbi += rbis;
        }
        const defendingTeamKey = gameState.isTop ? 'b' : 'a';
        const defendingTeam = gameState.teams[defendingTeamKey];
        const activePitcher = defendingTeam.pitchers.find(p => p._id === defendingTeam.activePitcherId);
        // 失分與責失算在「把這位跑者送上壘的投手」頭上（繼承跑者）。
        // 前一位投手放了人上壘才被換下來，那些人回來得分不該算接手投手的。
        const blameFor = (runner) => (runner && runner.pitcherId
            && defendingTeam.pitchers.find(p => p._id === runner.pitcherId)) || activePitcher;
        // 一分一分記，得分時間軸才對得上（勝敗投要用）
        runnersScored.forEach(runner => {
            const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
            if (runnerPlayer)
                runnerPlayer.r++;
            const blame = blameFor(runner);
            // 突破僵局制放上壘的那兩位回來得分算球隊失分，不算投手的（WBSC 附錄 2）
            if (!(runner as any).fromTiebreak) {
                blame.r++;
                if (!runner.isUnearned && gameState.inningPotentialOuts < 3) {
                    blame.er++;
                }
            }
            team.score[inningIndex]++;
            pushScoreTimeline(blame ? blame._id : '');
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
            newBases[batterDestination - 1] = { runnerId: batter._id, isUnearned, pitcherId: currentPitcherId() };
        }
        gameState.bases = newBases;
        return { runnersScored, outsOnBases };
    }
    function handlePlay(play) {
        saveStateForUndo();
        recordLogEntry({ t: 'play', play });
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
            case '不死三振出局':
                // 捕手漏接後打者被傳殺：投手照記一次三振，打者也記三振與出局
                outs = 1;
                batter.so++;
                activePitcher.k++;
                break;
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
            case '故意四壞':
                activePitcher.ibb = (activePitcher.ibb || 0) + 1;
                // 之後跟一般四壞完全一樣，直接往下走
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
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0] && gameState.bases[1]) { // 1st and 2nd
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0]) { // 1st only
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else { // Bases empty
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
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
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0] && gameState.bases[1]) {
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0]) {
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                else {
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: false, pitcherId: currentPitcherId() };
                }
                break;
            case '妨礙打擊':
                isAB = false;
                const defendingTeamKey = gameState.isTop ? 'b' : 'a';
                gameState.teams[defendingTeamKey].errors++;
                // 妨礙打擊**不算**一次守備機會（規則 9.16(a) 註解）：
                // 打者根本沒機會打完這個打席，不能假設他會出局。
                // 他得的分永遠不是責失（下面上壘時已標 isUnearned），但也不佔守備機會。
                // Runner advancement logic is the same as a walk
                if (gameState.bases[0] && gameState.bases[1] && gameState.bases[2]) { // Bases loaded
                    // A run scored on Catcher's Interference is unearned.
                    runnersScored.push({ ...gameState.bases[2], isUnearned: true });
                    rbis = 1;
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    // Batter reaching on CI is also unearned.
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0] && gameState.bases[1]) { // 1st and 2nd
                    gameState.bases[2] = gameState.bases[1];
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true, pitcherId: currentPitcherId() };
                }
                else if (gameState.bases[0]) { // 1st only
                    gameState.bases[1] = gameState.bases[0];
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true, pitcherId: currentPitcherId() };
                }
                else { // Bases empty
                    gameState.bases[0] = { runnerId: batter._id, isUnearned: true, pitcherId: currentPitcherId() };
                }
                break;
            default: // Other outs
                outs = 1;
                break;
        }
        if (isAB)
            batter.ab++;
        // 三振是捕手接到第三個好球完成出局，刺殺記給捕手
        if ((play === '三振' || play === '不死三振出局') && outs > 0) creditFielding(['捕'], 1);
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
        // 場地二壘打是罰則進壘：一律各進兩個壘，不能多也不能少
        const hitAdvance = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '場地二安': 2 };
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
        const hitBases = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4, '場地二安': 2 };
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
        else if (play === '妨礙守備') {
            // 誰妨礙的結果完全不同：打者妨礙＝打者出局；跑者被球打到＝跑者出局、
            // 打者上一壘並記一壘安打（官方規則 5.09(b)(7) 與記錄規則 9.05(a)(5)）
            advancedPlayState.step = 'select-interferer';
            (advancedPlayState as any).interferer = null;
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
        // 「返回」要一步一步退回去，所以從第一步開始記。空的就代表已經在第一步，
        // 再按一次就離開視窗——不能往回跳到當初被跳過的步驟
        // （例如壘上無人的安打會直接跳到確認畫面，「是否有失誤」根本沒出現過）。
        advancedPlayState.stepStack = [];
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
        else if (advancedPlayState.step === 'select-interferer') {
            modalAdvancedTitle.textContent = '妨礙守備 - 是誰妨礙？';
            const teamKey = gameState.isTop ? 'a' : 'b';
            const batter = getCurrentBatter();
            let optionsHTML = `
                    <div class="runner-placement-row">
                        <div class="runner-name">打者: ${batter ? batter.name : ''}</div>
                        <div class="runner-options">
                           <button data-step="select-interferer" data-interferer="batter" class="out-option">打者妨礙（打者出局）</button>
                        </div>
                    </div>`;
            advancedPlayState.originalBases.forEach((runner, i) => {
                if (!runner) return;
                const runnerPlayer = getPlayerById(teamKey, runner.runnerId);
                optionsHTML += `
                    <div class="runner-placement-row">
                        <div class="runner-name">${['一', '二', '三'][i]}壘跑者: ${runnerPlayer ? runnerPlayer.name : ''}</div>
                        <div class="runner-options">
                           <button data-step="select-interferer" data-interferer="${i}" class="out-option">被球打到／妨礙（跑者出局）</button>
                        </div>
                    </div>`;
            });
            optionsHTML += `<div class="frp-title">跑者被界內球打到：跑者出局、打者上一壘並記一壘安打（規則 5.09(b)(7)、9.05(a)(5)）。</div>`;
            modalAdvancedOptions.innerHTML = optionsHTML;
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
                        ${(HIT_BASES[advancedPlayState.play] || ['野手選擇', '失誤'].includes(advancedPlayState.play)) && advancedPlayState.play !== '本打'
                            ? `<button data-step="set-runners" data-dest="0" data-out-advancing="1" class="out-option ${((advancedPlayState.batterDestination as any).outAdvancing && !(advancedPlayState.batterDestination as any).overslide) ? 'selected' : ''}">跑過頭被觸殺<small>安打壘數照算</small></button>`
                            : ''}
                        ${HIT_BASES[advancedPlayState.play] && advancedPlayState.play !== '本打'
                            ? `<button data-step="set-runners" data-dest="0" data-out-advancing="1" data-overslide="1" class="out-option ${(advancedPlayState.batterDestination as any).overslide ? 'selected' : ''}">滑過頭被觸殺<small>安打降一級</small></button>`
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
            // 可以補記失誤的結果。除了安打類，出局與犧牲類也要能記——
            // 手冊裡有不少這種例子：犧牲觸擊傳一壘失手（例 9、130）、
            // 內野高飛必死球沒接到讓跑者多推進一個壘（例 54）。
            const canAddError = ['內安', '一安', '二安', '三安', '場地二安', '不死三振',
                                 '滾地', '飛球', '界飛', '內飛', '犧短', '犧飛', '雙殺', '三殺']
                .includes(advancedPlayState.play);
            let errorToggleHTML = '';
            const errList = advancedPlayState.errors || (advancedPlayState.error ? [advancedPlayState.error] : []);
            if (canAddError || errList.length) {
                // 同一個 play 可能有多次失誤：每筆一個籌碼可移除，並可再加一次
                const kinds = (advancedPlayState as any).errorKinds || [];
                errorToggleHTML = errList.map((e, i) => {
                    const decisive = (kinds[i] || 'e') === 'E';
                    return `<button data-step="toggle-error-kind" data-idx="${i}" class="selected err-kind">`
                        + `失誤：${ERROR_POSITIONS[e] || e}`
                        + `<small>${decisive ? '決定性（本來抓得到出局）' : '多餘壘（只是多跑了壘）'}　點一下切換</small>`
                        + `</button>`
                        + `<button data-step="remove-error" data-idx="${i}" class="err-del">移除</button>`;
                }).join('')
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
                // 全壘打球飛出場，沒有野手處理，所以不問「處理野手」（方向還是要留著：左外野全壘打）
                const noFielder = advancedPlayState.play === '本打';
                const fielderPick = noFielder ? '' : `
                        <span class="hit-direction-label fielder-label">處理野手
                            <em>${'@@CHAIN@@'}</em>
                        </span>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.outfield.map(fBtn).join('')}</div>
                        <div class="hit-direction-row">${HIT_DIRECTIONS.infield.map(fBtn).join('')}</div>`;
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
                        ${fielderPick.replace('@@CHAIN@@', chainLabel)}
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
                        ${fielderPick.replace('@@CHAIN@@', chainLabel)}
                    </div>`;
            }
            // 只要有一樣修飾（失誤、妨礙跑壘、擊球方向）就要把這一區畫出來，
            // 否則像內野高飛必死球這種沒有方向可選的結果就補記不了失誤
            if (canHaveObstruction || canPickDirection || canAddError || errList.length) {
                modifierHTML = directionHTML + `
                    <div class="advanced-play-modifiers">
                        ${advancedPlayState.play === '犧飛' ? `<button
                            data-step="toggle-fsf"
                            class="${(advancedPlayState as any).foulSF ? 'selected' : ''}"
                        >界外接殺（FSF）</button>` : ''}
                        ${advancedPlayState.play === '本打' ? `<button
                            data-step="toggle-ihr"
                            class="${(advancedPlayState as any).insideHR ? 'selected' : ''}"
                        >場內全壘打（IHR）</button>` : ''}
                        ${errorToggleHTML}
                        ${canHaveObstruction ? `<button
                            data-step="toggle-obstruction"
                            class="${advancedPlayState.obstruction ? 'selected' : ''}"
                        >加上妨礙跑壘</button>` : ''}
                        ${(advancedPlayState.errors || []).length ? `<button
                            data-step="overthrow"
                        >傳球出界（各再進兩個壘）</button>` : ''}
                        ${canHaveObstruction && advancedPlayState.obstruction ? `
                        <div class="obstruction-who">
                            <span class="frp-group-label">妨礙跑壘的野手</span>
                            <div class="modal-options play-options">${Object.entries(ERROR_ABBREVIATIONS).map(([pos, abbr]) =>
                                `<button data-step="set-obstruction-by" data-error-pos="${pos}" class="${(advancedPlayState as any).obstructionBy === pos ? 'selected' : ''}">${abbr}</button>`).join('')}</div>
                        </div>` : ''}
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
        if (advancedPlayState.obstruction) {
            const w = ERROR_POSITIONS[(advancedPlayState as any).obstructionBy] || '';
            parts.push(w ? `含${w}妨礙跑壘` : '含妨礙跑壘');
        }
        return parts.join('，');
    }
    // 再見安打只算到「送回致勝分那位跑者推進的壘數」（規則 9.06(f)）。
    // 三壘跑者回來就只算一壘安打、二壘跑者就算二壘安打、一壘跑者就算三壘安打。
    // 唯一例外是把球打出場的再見全壘打，全部照算（規則 9.06(g)）。
    function applyWalkOffHitLimit(batter, pitcher, play, hitCredit, winnerBaseIndex, batterReached) {
        if (!batter || hitCredit <= 0 || winnerBaseIndex < 0) return null;
        if (play === '本打' && !(advancedPlayState as any).insideHR) return null;  // 打出場的全壘打不縮
        const cap = Math.min(4 - (winnerBaseIndex + 1), batterReached || 4);
        if (cap >= hitCredit || cap <= 0) return null;
        const bump = (n: number, d: number) => {
            if (n === 2) batter['2b'] += d;
            else if (n === 3) batter['3b'] += d;
            else if (n === 4) { batter.hr += d; if (pitcher) pitcher.hr += d; }
        };
        bump(hitCredit, -1);
        bump(cap, +1);
        batter.tb += cap - hitCredit;
        // 打席結果也要跟著改（記錄表上顯示的是縮減後的壘數）
        const NAME = { 1: '一安', 2: '二安', 3: '三安' };
        const last = batter.abResults.length - 1;
        if (last >= 0 && NAME[cap]) {
            batter.abResults[last] = String(batter.abResults[last])
                .replace(/^[^@~#]+/, NAME[cap]);
        }
        return cap;
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
        recordLogEntry({ t: 'adv', adv: advancedPlayState });
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
        // 界外犧飛與場內全壘打在記錄符號上另外標，統計欄位跟原本的一樣
        const markName = (play === '犧飛' && (advancedPlayState as any).foulSF) ? '界犧飛'
            : (play === '本打' && (advancedPlayState as any).insideHR) ? '場內全打' : play;
        batter.abResults.push((chainStr ? `${markName}@${chainStr}${btMark}` : markName + btMark) + `#${gameState.inning}`);
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
        const hitBases = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4, '場地二安': 2 };
        // 跑者被界內球打到：跑者出局，打者上一壘並記一壘安打（記錄規則 9.05(a)(5)）
        const runnerInterfered = play === '妨礙守備'
            && (advancedPlayState as any).interferer && (advancedPlayState as any).interferer !== 'batter';
        // 滑過頭被觸殺：沒有安全到達那個壘，安打降一級（三安→二安、二安→一安、一安→沒有安打）
        const overslid = !!(advancedPlayState.batterDestination as any)?.overslide;
        const hitCreditRaw = hitBases[play] || (runnerInterfered ? 1 : 0);
        const hitCredit = overslid ? Math.max(0, hitCreditRaw - 1) : hitCreditRaw;
        if (play === '不死三振' || play === '不死三振出局') {
            // 不死三振不管有沒有上壘，投手都記一次三振
            batter.so++;
            activePitcher.k++;
        }
        if (play === '雙殺' && (advancedPlayState.ballType || 'G') === 'G') {
            batter.gidp++;   // 只有滾地雙殺才算 GIDP
        }
        if (hitCredit) {
            batter.h++;
            activePitcher.h++;
            team.hits++;
            // 滑過頭降級之後，二安／三安的欄位也要跟著降（用實際算到的壘數判斷）
            batter['2b'] += (hitCredit === 2 ? 1 : 0);
            batter['3b'] += (hitCredit === 3 ? 1 : 0);
            batter.hr += (hitCredit === 4 ? 1 : 0);
            activePitcher.hr += (hitCredit === 4 ? 1 : 0);
            batter.tb += hitCredit;
        }
        const errorList: string[] = (advancedPlayState.errors && advancedPlayState.errors.length)
            ? advancedPlayState.errors : (error ? [error] : []);
        if (errorList.length) {
            gameState.teams[teamKey === 'a' ? 'b' : 'a'].errors += errorList.length;
        }
        const hitPowerForRules = hitCredit || (play === '失誤' || play === '野手選擇' || play === '不死三振' ? 1 : 0);
        let runnersScored: BaseRunner[] = [];
        let rbis = 0;
        let outsOnPlay = 0;
        // --- 打點的判斷（規則 9.04）---
        // 給打點：安打、打出去造成出局但送回三壘跑者、犧牲打、滿壘保送擠回來，
        //         以及「兩出局前，三壘跑者本來就會回來、只是過程中有失誤」。
        // 不給打點：靠失誤才發生的得分。
        const hasError = errorList.length > 0;
        const outsBefore = gameState.outs;                       // 這個 play 之前的出局數
        const batterOnError = hasError && !hitCredit && !batterIsOut;  // 打者是靠失誤才沒出局
        const errorDrivenRun = (baseIndex: number, advancedBy: number) => {
            if (!hasError) return false;
            // 兩出局時打者靠失誤上壘：沒有那個失誤這個半局就結束了，之後的分永遠不是打點
            if (batterOnError && outsBefore >= 2) return true;
            // 打者的結果本身沒有安打價值（出局、犧牲）：只有三壘跑者算「本來就會回來」
            if (hitPowerForRules === 0) return baseIndex < 2;
            // 多跑的壘數超過這個結果應有的 → 是失誤送他回來的
            return advancedBy > hitPowerForRules;
        };
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
                // 規則 9.04：靠失誤才發生的得分不給打點
                if (!errorDrivenRun(baseIndex, advancedBy)) rbis++;
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
            // 妨礙打擊上壘的打者得分永遠不是責失（規則 9.16(a) 註解）
            const isBatterUnearned = batterDestination.isUnearned || batterBeyond
                || (play === '失誤') || (play === '妨礙打擊');
            if ((batterDestination as any).outAdvancing) {
                // 安打後想多跑一個壘被觸殺：安打照算，打者出局
                outsOnPlay++;
            }
            else if (batterDestination.dest >= 4) {
                runnersScored.push({ runnerId: batter._id, isUnearned: isBatterUnearned });
                if (play === '本打') rbis++;       // 只有全壘打才給打者自己的打點
            }
            else if (batterDestination.dest > 0) {
                newBases[batterDestination.dest - 1] = { runnerId: batter._id, isUnearned: isBatterUnearned, pitcherId: currentPitcherId() };
            }
        }
        else {
            outsOnPlay++;
        }
        // 規則 9.04(b)：打者擊出的球造成雙殺或三殺，因此得的分不記打點
        if (play === '雙殺' || play === '三殺') rbis = 0;

        // 規則 5.08(a)：第三個出局如果是「封殺」，或是打者在上到一壘前就出局，
        // 這個 play 的得分一律不算（就算跑者比出局早踩到本壘也一樣）。
        // 飛球接殺與三振不適用——高飛犧牲打就是靠這個得分的。
        const BATTER_OUT_BEFORE_FIRST = ['滾地', '雙殺', '三殺', '犧短', '妨礙守備', '野手選擇', '不死三振出局'];
        // 打者有沒有變成跑者（＝跑者會不會被封殺）。飛球被接殺就沒有封殺，
        // 內野高飛必死球也是（規則上跑者可以自行判斷要不要跑）
        const batterBecameRunner = !['三振', '飛球', '界飛', '犧飛', '內飛'].includes(play);
        // 後面有人擠著、非跑不可＝封殺。一壘跑者只要打者上壘就被封，
        // 二壘跑者要一壘也有人，三壘跑者要一二壘都有人
        const forcedAt = (i: number) => originalBases.slice(0, i).every(r => !!r);
        const forcedRunnerOut = Object.entries(runnerDestinationsFinal).some(([key, val]) => {
            const i = parseInt(key.split('-')[1]);
            return !!originalBases[i] && !((val as any).dest > 0) && batterBecameRunner && forcedAt(i);
        });
        const batterOutBeforeFirst = batterIsOut && BATTER_OUT_BEFORE_FIRST.includes(play);
        let forceThirdOut = false;
        if (runnersScored.length && gameState.outs + outsOnPlay >= 3
            && (batterOutBeforeFirst || forcedRunnerOut)) {
            forceThirdOut = true;
            runnersScored = [];
            rbis = 0;
        }

        // 守備成績：刺殺／助殺依守備鏈換算，失誤記到那位野手身上
        creditFielding(advancedPlayState.fielders || [], outsOnPlay,
            isCatchOut(play, advancedPlayState.ballType));
        creditErrors(errorList);

        // 再見安打：先記下「致勝分是哪一位跑者送回來的」，比賽真的結束時才拿來縮壘數。
        // 要在 addRuns 之前算，因為 addRuns 會把比分加上去。
        let walkOffInfo: any = null;
        if (!gameState.isTop && hitCredit > 0 && runnersScored.length) {
            const need = (totalOf('a') - totalOf('b')) + 1;     // 主隊還要幾分才超前
            if (need >= 1 && need <= runnersScored.length) {
                // 離本壘近的跑者先回來，所以依壘包由大到小排
                const order = Object.entries(runnerDestinationsFinal)
                    .filter(([k, v]: any) => originalBases[parseInt(k.split('-')[1])] && v.dest >= 4)
                    .map(([k]) => parseInt(k.split('-')[1]))
                    .sort((x, y) => y - x);
                const idx = order[need - 1];
                if (idx !== undefined) {
                    walkOffInfo = {
                        batter, pitcher: activePitcher, play, hitCredit,
                        winnerBaseIndex: idx, batterReached: batterDestination.dest,
                    };
                }
            }
        }
        addRuns(runnersScored, rbis);
        gameState.bases = newBases;
        gameState.outs += outsOnPlay;
        activePitcher.outsRecorded += outsOnPlay;
        gameState.inningPotentialOuts += outsOnPlay;
        // 守備機會＝出局數 ＋ 決定性失誤（手冊 5-4）。
        // 決定性失誤＝本來抓得到出局卻沒抓到；多餘壘失誤只是讓人多跑了壘，不算。
        // 例外：妨礙打擊不算（規則 9.16(a) 註解）——打者根本沒機會打完這個打席。
        if (play !== '妨礙打擊') {
            const kinds = (advancedPlayState as any).errorKinds || [];
            const decisive = errorList.filter((_, i) => (kinds[i] || 'e') === 'E').length;
            gameState.inningPotentialOuts += decisive;
        }
        // Part 1: Build the initial event description for the batter's action
        let eventDesc = `${batterTitle(batter, gameState.currentBatterIndex[teamKey])}\n`;
        const dirUsed = advancedPlayState.direction;
        const chainUsed = advancedPlayState.fielders || [];
        if (runnerInterfered) {
            const iBase = Number((advancedPlayState as any).interferer);
            const hitRunner = getPlayerById(teamKey, advancedPlayState.originalBases[iBase]?.runnerId);
            const area = dirUsed ? FIELDER_AREA[dirUsed] : '';
            eventDesc += ` ${area}滾地球打中${['一', '二', '三'][iBase]}壘跑者${hitRunner ? hitRunner.name : ''}，跑者出局`;
        }
        else if (play !== '失誤') {
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
        // 這個 play 的決定性失誤是誰犯的（敘述要寫「靠○○失誤安全回壘」）
        const errKinds = (advancedPlayState as any).errorKinds || [];
        const decisiveErrWho = errListForText
            .map((e, i) => ((errKinds[i] || 'e') === 'E') ? (ERROR_POSITIONS[e] || e) : '')
            .filter(Boolean)[0] || '';
        let errorMentioned = false;   // 失誤已寫進「靠○○失誤進壘」時，就不再另外補一句
        let batterSentenceOpen = false;
        const basesText = ['一', '二', '三', '本'];
        // Part 2: Add batter's destination and RBI information
        if (!batterIsOut) {
            let batterDestText = '';
            // 野手選擇與失誤上壘也會有跑過頭被觸殺的情況（先站上一壘再被追觸殺）
            const hitPowerRaw = hitBases[play] || (['野手選擇', '失誤'].includes(play) ? 1 : 0);
            const hitPower = hitCredit || hitPowerRaw;
            if ((batterDestination as any).overslide && hitPowerRaw > 0) {
                // 滑過頭：沒有安全到達，安打只算到前一個壘（規則 9.06(c)）
                const c = chainUsed;
                const tagger = c.length ? `被${relayText(c)}` : '';
                const got = hitCredit > 0 ? `只算${basesText[hitCredit - 1]}壘安打` : '不算安打';
                batterDestText = `衝${basesText[hitPowerRaw - 1]}壘時滑過頭，${tagger}觸殺出局，${got}`;
            }
            else if ((batterDestination as any).outAdvancing && hitPower > 0) {
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
                     // 野手選擇的前一句在講跑者被處理，這裡不寫「打者」會分不清是誰上壘
                     const subject = play === '野手選擇' ? '打者' : '';
                     batterDestText = `${subject}上到${basesText[batterDestination.dest - 1]}壘`;
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
                // 留在原壘但這個 play 有決定性失誤：代表守方想抓他卻沒抓到，要寫出來
                if (dest === i + 1 && decisiveErrWho) {
                    const why = ['飛球', '界飛', '犧飛', '內飛', '雙殺', '三殺'].includes(play)
                        ? '離壘過遠' : '離壘後';
                    // 守備鏈有第二個人，代表球傳出去想封殺他，敘述要寫出來
                    const throwPart = chainUsed.length >= 2 ? `${chainText(chainUsed)}想封殺，` : '';
                    // 失誤是傳球的那位犯的就寫「但傳球失誤」，否則寫「靠○○失誤」
                    const thrower = FIELDER_FULL[chainUsed[0]] || '';
                    const errPart = (throwPart && decisiveErrWho === thrower)
                        ? `但傳球失誤，安全回到${basesText[i]}壘。`
                        : `靠${decisiveErrWho}失誤安全回到${basesText[i]}壘。`;
                    runnerMoves.push(`在${basesText[i]}壘的${runnerPlayer.name} ${why}，${throwPart}${errPart}`);
                    errorMentioned = true;
                    return;
                }
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
                                ? '離壘過遠回壘不及'
                                : (last === '捕' ? '接殺後衝本壘' : '接殺後起跑進壘');
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
            const obsWho = ERROR_POSITIONS[(advancedPlayState as any).obstructionBy] || '';
            eventDesc += obsWho ? ` 過程中${obsWho}妨礙跑壘。` : ' 過程中發生妨礙跑壘。';
        }
        if (forceThirdOut) eventDesc += ` 第三個出局是封殺，這個半局的得分不算。`;
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
            // 再見安打：比賽就在這一球結束，安打壘數要縮到致勝跑者推進的壘數
            if (walkOffInfo && walkOffInfo.hitCredit > 0) {
                const cut = applyWalkOffHitLimit(walkOffInfo.batter, walkOffInfo.pitcher,
                    walkOffInfo.play, walkOffInfo.hitCredit, walkOffInfo.winnerBaseIndex,
                    walkOffInfo.batterReached);
                if (cut) {
                    logEvent(`再見安打只算到致勝跑者推進的壘數，記為${['一', '二', '三'][cut - 1]}壘安打。`,
                        gameState.isTop ? 'a' : 'b');
                }
            }
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
            const prev = gameStateHistory.pop();
            gameState = prev.state;
            playLog = prev.log;
            saveState();
            createLineupInputs(); // Re-create inputs in case DH was changed
            attachTeamSettingsListeners(); // Re-attach listeners to new inputs
            render();
        }
    }
    // =====================================================================
    // 重播引擎（第一步：只記錄與自我對帳，畫面行為完全不變）
    // 每個會改變比賽狀態的動作都記成一張「紙條」（誰、什麼結果、跑者去哪）。
    // 之後要修改前面某一筆時，就是改紙條再把整場重算一次。
    // 這一步先把紙條記下來，並且每記一次就偷偷重算一遍跟現況比對，
    // 確認引擎算出來的跟實際一模一樣，之後才敢開放「修改」。
    // =====================================================================
    let playLog: any[] = [];
    let startSnapshot: any = null;      // 開賽當下的狀態（重算的起點）
    let isReplaying = false;            // 重播中：不存檔、不重畫、不記新紙條
    let lastReplayCheck: { ok: boolean; where: string } = { ok: true, where: '' };

    function deepCopyState(v) { return JSON.parse(JSON.stringify(v)); }

    // 照片很大又跟比分無關，重算用的副本一律拿掉
    function stripPhotos(state) {
        (['a', 'b'] as const).forEach(k => {
            (state.teams[k].roster || []).forEach(p => { p.photo = ''; });
            state.teams[k].logo = '';
        });
        return state;
    }

    let verifyTimer: any = null;
    function recordLogEntry(entry) {
        if (isReplaying || !startSnapshot) return;
        playLog.push(deepCopyState(entry));
        // 這一動整個做完之後再對帳，才不會拖慢操作
        if (verifyTimer) clearTimeout(verifyTimer);
        verifyTimer = setTimeout(() => {
            verifyTimer = null;
            if (editState) { finishEntryEdit(); return; }      // 修改模式：接回後面的紀錄
            verifyReplay(entry.t);
        }, 0);
    }

    function captureStartSnapshot() {
        startSnapshot = stripPhotos(deepCopyState(gameState));
        playLog = [];
        lastReplayCheck = { ok: true, where: '' };
    }

    function resetReplayLog() {
        playLog = [];
        startSnapshot = null;
    }

    function applyLogEntry(entry) {
        switch (entry.t) {
            case 'play': handlePlay(entry.play); break;
            case 'adv': advancedPlayState = deepCopyState(entry.adv); processAdvancedPlay(); break;
            case 'runner': runnerActionState = deepCopyState(entry.st); processRunnerAction(); break;
            case 'sub': processSubstitution(entry.inId, entry.outId, entry.pos); break;
            case 'swap': processDefensiveSwap(entry.a, entry.b); break;
            case 'dh': applyDHToggle(entry.team, entry.on); break;
            case 'addp': applyAddPlayer(entry.team, entry.id, entry.name, entry.jersey); break;
        }
    }

    // 從開賽的狀態照著紙條重算一次，回傳算出來的比賽狀態（不會動到現在的比賽）
    // ranges：順便記下每張紙條產生了哪幾行事件，事件列表才知道某一行屬於哪一筆
    function rebuildFromLog(log = playLog, ranges: any[] | null = null) {
        if (!startSnapshot) return null;
        const liveState = gameState, liveAdv = advancedPlayState, liveRunner = runnerActionState;
        isReplaying = true;
        try {
            gameState = deepCopyState(startSnapshot);
            log.forEach((entry, i) => {
                const from = gameState.events.length;
                applyLogEntry(entry);
                if (ranges) ranges.push({ index: i, t: entry.t, from, to: gameState.events.length });
            });
            return gameState;
        }
        finally {
            gameState = liveState;
            advancedPlayState = liveAdv;
            runnerActionState = liveRunner;
            isReplaying = false;
        }
    }

    // 事件列表的第幾行 → 第幾張紙條（沒對應的行不能改，例如「比賽開始」與局數列）
    let eventOwner: number[] = [];
    function refreshEventOwner() {
        eventOwner = [];
        if (!startSnapshot) return;
        const ranges: any[] = [];
        if (!rebuildFromLog(playLog, ranges)) return;
        ranges.forEach(r => { for (let i = r.from; i < r.to; i++) eventOwner[i] = r.index; });
    }

    // 照片沒有存進重算用的快照，重算完要把現在的照片補回去
    function restorePhotosInto(target, source) {
        (['a', 'b'] as const).forEach(k => {
            target.teams[k].logo = source.teams[k].logo;
            const byId = new Map(source.teams[k].roster.map(p => [p._id, p]));
            target.teams[k].roster.forEach(p => {
                const src = byId.get(p._id) as any;
                if (src) p.photo = src.photo;
            });
        });
        return target;
    }

    // 把重算結果變成正在進行的比賽（刪除、修改後都走這裡）
    function adoptRebuilt(log) {
        const rebuilt = rebuildFromLog(log);
        if (!rebuilt) return false;
        gameStateHistory.push({ state: JSON.parse(JSON.stringify(gameState)), log: deepCopyState(playLog) });
        playLog = log;
        gameState = restorePhotosInto(rebuilt, gameState);
        saveState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
        return true;
    }

    // 比對用的摘要：只取跟比賽結果有關的欄位（時間、照片這種不算）
    function stateDigest(st) {
        const teamPart = (t) => ({
            score: t.score,
            hits: t.hits,
            errors: t.errors,
            activePitcherId: t.activePitcherId,
            useDH: t.useDH,
            lineup: (t.lineupSpots || []).map(sp => [sp.activePlayerId, (sp.history || []).join('>'), JSON.stringify(sp.subInfo || {})]),
            roster: (t.roster || []).map(p => [p._id, p.pa, p.ab, p.r, p.h, p.rbi, p.tb, p['2b'], p['3b'], p.hr,
                p.bb, p.hbp, p.so, p.sf, p.sh, p.sb, p.gidp, (p.abResults || []).join('|'), p.pos]),
            pitchers: (t.pitchers || []).map(p => [p._id, p.outsRecorded, p.h, p.r, p.er, p.bb, p.k, p.hbp, p.hr, p.bf, p.wp, p.bk]),
        });
        return JSON.stringify({
            inning: st.inning, isTop: st.isTop, outs: st.outs, isGameOver: st.isGameOver,
            bases: (st.bases || []).map(b => b ? [b.runnerId, b.isUnearned] : null),
            batterIndex: st.currentBatterIndex,
            events: (st.events || []).map(e => [e.text, e.teamKey, e.outs, JSON.stringify(e.bases || []), JSON.stringify((e as any).score || null), !!(e as any).scored]),
            a: teamPart(st.teams.a), b: teamPart(st.teams.b),
        });
    }

    // 每記一筆就重算一次跟現況比對；對不上代表引擎有漏，先記下來
    function verifyReplay(where = '') {
        if (isReplaying || !startSnapshot) return true;
        const rebuilt = rebuildFromLog();
        if (!rebuilt) return true;
        const ok = stateDigest(rebuilt) === stateDigest(gameState);
        lastReplayCheck = { ok, where };
        if (!ok) console.warn('[重播對帳] 重算結果與現況不符，動作：' + where);
        return ok;
    }
    (window as any).__replay = {
        log: () => playLog,
        hasStart: () => !!startSnapshot,
        rebuild: () => rebuildFromLog(),
        verify: (where = '手動') => verifyReplay(where),
        digest: (st?) => stateDigest(st || gameState),
        lastCheck: () => lastReplayCheck,
    };
    // === 修改或刪除前面某一筆 ===
    // 做法是「把紙條抽掉或換掉，再從開賽重算一次」，所以後面的打席不用重打。
    let editState: any = null;      // { index, tail, original }

    function entryLabel(index) {
        const e = playLog[index];
        if (!e) return '這一筆';
        return ({ play: '打席結果', adv: '打席結果', runner: '壘間事件', sub: '換人', swap: '守位互換', dh: 'DH 設定' })[e.t] || '這一筆';
    }

    function deleteLogEntry(index) {
        if (index < 0 || index >= playLog.length) return;
        const next = playLog.slice(0, index).concat(playLog.slice(index + 1));
        if (!adoptRebuilt(next)) {
            alert('這一筆刪不掉：後面的紀錄跟它有關，請先處理後面的。');
        }
    }

    function startEntryEdit(index) {
        if (index < 0 || index >= playLog.length) return;
        const head = playLog.slice(0, index);
        const tail = playLog.slice(index + 1);
        const rebuilt = rebuildFromLog(head);
        if (!rebuilt) { alert('沒辦法回到那個時間點。'); return; }
        gameStateHistory.push({ state: JSON.parse(JSON.stringify(gameState)), log: deepCopyState(playLog) });
        editState = { index, tail, original: deepCopyState(playLog) };
        playLog = head;
        gameState = restorePhotosInto(rebuilt, gameState);
        saveState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
        navigateToPanel(1);
    }

    function finishEntryEdit() {
        if (!editState) return;
        const merged = playLog.concat(editState.tail);
        const rebuilt = rebuildFromLog(merged);
        if (!rebuilt) {
            alert('改不成功：後面的紀錄接不回去，已經還原。');
            cancelEntryEdit();
            return;
        }
        playLog = merged;
        gameState = restorePhotosInto(rebuilt, gameState);
        editState = null;
        saveState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
    }

    function cancelEntryEdit() {
        if (!editState) return;
        const original = editState.original;
        editState = null;
        const rebuilt = rebuildFromLog(original);
        if (rebuilt) {
            playLog = original;
            gameState = restorePhotosInto(rebuilt, gameState);
        }
        saveState();
        createLineupInputs();
        attachTeamSettingsListeners();
        render();
    }

    function renderEditModeBar() {
        const bar = document.getElementById('edit-mode-bar');
        const text = document.getElementById('edit-mode-text');
        if (!bar || !text) return;
        bar.classList.toggle('hidden', !editState);
        if (editState) text.textContent = `修改中：記完這一筆會自動接回後面 ${editState.tail.length} 筆`;
    }
    (window as any).__editEntry = { start: startEntryEdit, del: deleteLogEntry, cancel: cancelEntryEdit, current: () => editState };

    function saveStateForUndo() {
        if (isReplaying) return;
        // 狀態與紙條一起存，這樣不管是一般記錄還是修改／刪除，復原都回得去
        gameStateHistory.push({ state: JSON.parse(JSON.stringify(gameState)), log: deepCopyState(playLog) });
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
        if (step === 'select-obstruction-position') {
            runnerActionTitleStep2.textContent = '妨礙跑壘 - 是哪一位野手？';
            runnerActionDetails.innerHTML = `<div class="modal-options play-options">${Object.entries(ERROR_ABBREVIATIONS).map(([pos, abbr]) => `<button data-step="select-obstruction-position" data-error-pos="${pos}">${abbr}</button>`).join('')}</div>`;
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
        if (type === 'appeal') {
            const reason = (runnerActionState as any).appealReason || 'miss-base';
            detailsHTML += `
                <div class="runner-placement-row">
                    <div class="runner-name">申訴的理由</div>
                    <div class="runner-options">
                        <button data-step="set-appeal" data-reason="miss-base" class="${reason === 'miss-base' ? 'selected' : ''}">漏踩壘包</button>
                        <button data-step="set-appeal" data-reason="left-early" class="${reason === 'left-early' ? 'selected' : ''}">飛球被接到前就離壘</button>
                    </div>
                </div>`;
        }
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
                else if (type === 'appeal') {
                    options = `<button data-step="set-dest" data-runner-id="${i}" data-dest="${i + 1}" data-out="true" class="out-option ${currentDest?.isOut ? 'selected' : ''}">申訴成立（出局）</button>`;
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
                else { // WP、PB、投手犯規、妨礙跑壘、守方未防守
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
                // 妨礙跑壘要先問是哪一位野手妨礙的
                const firstStep = actionType === 'obstruction' ? 'select-obstruction-position' : 'set-dest';
                runnerActionState = {
                    step: firstStep,
                    type: actionType,
                    destinations: {},
                    originalBases: JSON.parse(JSON.stringify(gameState.bases)),
                    error: false,
                    errorPosition: null,
                    fielders: [],
                    fieldersAuto: true,
                    rundown: null,
                };
                showRunnerActionStep(firstStep);
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
        else if (step === 'select-obstruction-position') {
            (runnerActionState as any).obstructionBy = errorPos;
            runnerActionState.step = 'set-dest';
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
        else if (step === 'set-appeal') {
            (runnerActionState as any).appealReason = target.dataset.reason;
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
        recordLogEntry({ t: 'runner', st: runnerActionState });
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
                        runnerPlayer.cs = (runnerPlayer.cs || 0) + 1;   // 盜壘刺
                        // 出局時畫面不會帶目標壘，企圖盜的就是下一個壘包
                        const target = STEAL_BASE_NAME(baseIndex + 2);
                        const how = chain.length ? runnerOutText(chain, baseIndex + 1, baseIndex + 2, rd) : '遭阻殺出局';
                        eventParts.push(`${runnerPlayer.name}從${BASE_NAME(baseIndex + 1)}壘盜${target}失敗，${how}。`);
                    }
                    else if (type === 'appeal') {
                        // 申訴出局不記盜壘刺；刺殺與助殺照守備鏈記
                        const why = (runnerActionState as any).appealReason === 'left-early'
                            ? '在飛球被接到前就離壘' : `未踩${BASE_NAME(baseIndex + 1)}壘`;
                        eventParts.push(`${runnerPlayer.name}${why}，申訴成立被判出局。`);
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
                    else if (type === 'indifference') {
                        // 守備冷漠：推進照算，但**不記盜壘**（規則 9.07(g)）
                        eventParts.push(dest >= 4
                            ? `${BASE_NAME(baseIndex + 1)}壘跑者${runnerPlayer.name}回到本壘得分。`
                            : `${BASE_NAME(baseIndex + 1)}壘跑者${runnerPlayer.name}推進到${BASE_NAME(dest)}壘。`);
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
        creditFielding(runnerActionState.fielders || [], outsOnPlay);
        if ((runnerActionState as any).errorPosition) creditErrors([(runnerActionState as any).errorPosition]);
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
        if (type === 'indifference')
            prefix = '守方未做防守（不記盜壘），';
        if (type === 'appeal')
            prefix = '守方提出申訴，';
        if (type === 'obstruction') {
            const who = ERROR_POSITIONS[(runnerActionState as any).obstructionBy] || '';
            prefix = who ? `${who}妨礙跑壘，` : '妨礙跑壘，';
        }
        if (type === 'steal' && error) {
            const errorPosText = errorPosition ? ERROR_POSITIONS[errorPosition] + '失誤' : '失誤';
            prefix = `盜壘時發生${errorPosText}，`;
        }
        if (type === 'pickoff-out' && error)
            prefix = '投手牽制失誤，';
        // 兩位以上同時盜壘就是雙盜壘／三盜，敘述講一次就好
        if (type === 'steal' && !error) {
            const stole = eventParts.filter(t => t.includes('盜') && t.includes('成功')).length;
            if (stole >= 2) prefix = (stole >= 3 ? '發動三盜壘，' : '發動雙盜壘，') + prefix;
        }
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
        const canAdd = !!freeBenchSlot(opts.teamKey);
        const teamName = gameState.teams[opts.teamKey].name || (opts.teamKey === 'a' ? '客隊' : '主隊');
        // 比賽中進不去名單頁，所以人不夠時要能就地補一位
        const addBlock = canAdd
            ? `<div class="picker-add">
                   <button type="button" class="picker-add-btn" data-add="1">＋ 臨時新增${teamName}的球員</button>
                   <div class="picker-add-form hidden">
                       <input type="text" class="pa-jersey" inputmode="numeric" maxlength="2" placeholder="背號">
                       <input type="text" class="pa-name" maxlength="10" placeholder="姓名">
                       <button type="button" class="pa-ok">加入並換上</button>
                   </div>
               </div>`
            : '';
        list.innerHTML = (opts.candidates.length
            ? opts.candidates.map(p => `
                <button type="button" class="picker-item" data-player-id="${p._id}">
                    <img src="${playerPhotoSrc(p)}" alt="">
                    <span class="picker-name">${p.name}</span>
                    <span class="picker-sub">${p.jersey ? '#' + p.jersey : ''}${p.pos ? ' ' + p.pos : ''}</span>
                </button>`).join('')
            : `<div class="def-empty">${teamName}沒有可換的球員了${canAdd ? '，可以在下面臨時補一位' : ''}</div>`)
            + addBlock;
        const form = () => list.querySelector('.picker-add-form') as HTMLElement | null;
        const confirmAdd = () => {
            const f = form();
            if (!f) return;
            const jersey = (f.querySelector('.pa-jersey') as HTMLInputElement).value.trim();
            const name = (f.querySelector('.pa-name') as HTMLInputElement).value.trim()
                || `${teamName}${jersey || String(benchOf(opts.teamKey).length + 1).padStart(2, '0')}`;
            const added = addBenchPlayer(opts.teamKey, name, jersey);
            if (!added) return;
            closeModal(modal);
            opts.onPick(added._id);
        };
        list.onclick = (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.picker-add-btn')) {
                tapFeedback();
                form()?.classList.remove('hidden');
                (target.closest('.picker-add') as HTMLElement)
                    ?.querySelector<HTMLInputElement>('.pa-jersey')?.focus();
                return;
            }
            if (target.closest('.pa-ok')) { tapFeedback(); confirmAdd(); return; }
            const btn = target.closest('.picker-item') as HTMLElement | null;
            if (!btn) return;
            closeModal(modal);
            opts.onPick(btn.dataset.playerId);
        };
        openModal(modal);
    }
    // 比賽中臨時補一位球員到板凳。
    // 比賽畫面裡進不去名單頁，人不夠時整個換人流程會卡死，所以要能就地新增。
    // 一定要記成紙條（重播時重建的是開賽當下的名單，不然這個人會變成沒名字的空格）。
    function applyAddPlayer(teamKey: 'a' | 'b', slotId: string, name: string, jersey: string) {
        const team = gameState.teams[teamKey];
        const slot = team.roster.find(p => p._id === slotId);
        if (!slot) return null;
        slot.name = name;
        slot.jersey = jersey;
        return slot;
    }
    // 找一個還空著的板凳格（跳過先發九棒與投手那一格）
    function freeBenchSlot(teamKey: 'a' | 'b') {
        const team = gameState.teams[teamKey];
        return team.roster.find((p, i) =>
            i >= LINEUP_SIZE && i !== PITCHER_ROSTER_INDEX && !(p.name || '').trim()) || null;
    }
    function addBenchPlayer(teamKey: 'a' | 'b', name: string, jersey: string) {
        const slot = freeBenchSlot(teamKey);
        if (!slot) return null;
        recordLogEntry({ t: 'addp', team: teamKey, id: slot._id, name, jersey });
        const added = applyAddPlayer(teamKey, slot._id, name, jersey);
        saveState();
        return added;
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
    // 代跑：壘上超過一位就先選要換誰
    function pinchRunPick() {
        const teamKey = gameState.isTop ? 'a' : 'b';
        const onBase = gameState.bases
            .map((b, i) => (b ? { base: i, runner: b } : null))
            .filter(Boolean) as any[];
        if (!onBase.length) return;
        if (onBase.length === 1) { pinchRun(onBase[0].base); return; }
        openPicker({
            title: '代跑：先選要換掉哪一位跑者',
            teamKey,
            candidates: onBase.map(o => {
                const p = getPlayerById(teamKey, o.runner.runnerId);
                return { ...(p || {}), _id: 'base-' + o.base, name: `${['一', '二', '三'][o.base]}壘　${p ? p.name : ''}` };
            }),
            onPick: (id) => pinchRun(Number(String(id).replace('base-', '')))
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
            team.pitchers.push({ _id: newPitcherId, name: np.name, outsRecorded: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hbp: 0, hr: 0, bf: 0, ibb: 0, wp: 0, bk: 0, ...pitcherEntryInfo(teamKey) });
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
        // 壘上有人才點得下代跑
        const runnersOnBase = gameState.bases
            .map((b, i) => (b ? { base: i, runner: b } : null))
            .filter(Boolean) as any[];
        const quickSubs = canSub ? `
            <div class="def-quick">
                <button type="button" id="pinch-hit-btn" class="def-quick-btn">代打<small>換掉 ${gameState.teams[gameState.isTop ? 'a' : 'b'].name} ${batterNow ? batterNow.name : '—'}</small></button>
                <button type="button" id="change-pitcher-btn" class="def-quick-btn">換投<small>換掉 ${gameState.teams[defKey].name} ${pitcherNow ? pitcherNow.name : '—'}</small></button>
                <button type="button" id="pinch-run-btn" class="def-quick-btn"${runnersOnBase.length ? '' : ' disabled'}>代跑<small>${runnersOnBase.length ? `壘上 ${runnersOnBase.length} 人` : '壘上無人'}</small></button>
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
        recordLogEntry({ t: 'sub', inId: playerInId, outId: playerOutId, pos: newPos });
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
                    ...pitcherEntryInfo(teamKey),
                });
            }
            subType = '更換投手';
        }
        if (spotIndex !== -1) {
            team.lineupSpots[spotIndex].activePlayerId = playerInId;
            team.lineupSpots[spotIndex].history.push(playerInId);
            // 只有「這一刻正要打擊的人被換掉」才是代打；
            // 守備中途換人（換下的人不是現在的打者）要寫守備替補，
            // 以前一律寫成「代打」，換個守備員也會記成代打（踩過一次）。
            if (!subType) subType = wasBattingNow ? '代打' : '守備替補';
        }
        if (baseIndex !== -1) {
            gameState.bases[baseIndex].runnerId = playerInId;
            subType = '代跑';
        }
        if (!subType) subType = '守備替補';
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
        recordLogEntry({ t: 'swap', a: player1Id, b: player2Id });
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
    // teamKey 為 null 表示從首頁進來：還不知道要載入哪一隊，所以兩邊都給一顆
    function renderSavedRostersList(teamKey?: string | null) {
        const savedRosters = JSON.parse(localStorage.getItem(SAVED_ROSTERS_KEY) || '[]');
        if (savedRosters.length === 0) {
            savedRostersList.innerHTML = '<p>還沒有存過球隊名單。<br>到名單頁按隊名旁邊的「儲存名單」就會出現在這裡。</p>';
            return;
        }
        const loadBtns = teamKey
            ? `<button class="load-roster-item-btn" data-roster-id="{id}">載入</button>`
            : `<button class="load-roster-item-btn" data-roster-id="{id}" data-team="a">載入客隊</button>`
              + `<button class="load-roster-item-btn" data-roster-id="{id}" data-team="b">載入主隊</button>`;
        savedRostersList.innerHTML = savedRosters.map(roster => `
            <div class="saved-roster-item">
                <span class="saved-roster-item-name">${roster.name}</span>
                <div class="saved-roster-item-actions">
                    ${loadBtns.split('{id}').join(roster.id)}
                    <button class="delete-roster-item-btn" data-roster-id="${roster.id}">刪除</button>
                </div>
            </div>
        `).join('');
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
        renderSavedRostersList(teamKey);
        // Store the target teamKey on the modal for the click handler
        const title = document.getElementById('load-roster-title');
        if (title) title.textContent = teamKey ? '讀取儲存的名單' : '我的球隊';
        if (teamKey) loadRosterModal.dataset.teamKey = teamKey;
        else delete loadRosterModal.dataset.teamKey;
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
            // 從首頁進來時，是哪一隊寫在按鈕上；從名單頁進來時寫在視窗上
            const teamKey = (loadButton as HTMLElement).dataset.team || loadRosterModal.dataset.teamKey;
            if (rosterId && teamKey) {
                loadRoster(rosterId, teamKey);
                hideShell();
                navigateToPanel(0);          // 載完直接帶到名單頁看結果
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
            renderSavedRostersList(loadRosterModal.dataset.teamKey || null);
        }
    }
    init();
});
