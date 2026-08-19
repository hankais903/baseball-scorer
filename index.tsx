// prettier-ignore
'use strict';
declare var XLSX: any; // Declare the XLSX global object from the CDN script

// --- Default Placeholder Images (SVG encoded in Base64) ---
const DEFAULT_TEAM_LOGO_BASE64 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#3e3e3e"/><path d="M50 15L85 50L50 85L15 50Z" stroke="#666" stroke-width="5" fill="none"/><circle cx="50" cy="50" r="10" stroke="#666" stroke-width="5" fill="none"/></svg>');
const DEFAULT_PLAYER_PHOTO_BASE64 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 100"><rect width="75" height="100" fill="#3e3e3e" rx="4" /><g fill="#666"><circle cx="37.5" cy="35" r="15"/><path d="M15 100 V 80 C 15 65, 25 60, 37.5 60 C 50 60, 60 65, 60 80 V 100 Z"/></g></svg>');

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
        'out': ['三振', '補滾', '投滾', '一滾', '二滾', '三滾', '游滾', '一飛', '二飛', '三飛', '游飛', '右飛', '中飛', '左飛', '界飛', '雙殺', '三殺', '犧短', '犧飛', '妨礙守備'],
        'on-base': ['四壞', '觸身球', '不死三振', '內安', '一安', '二安', '三安', '本打', '失誤', '妨礙打擊', '野手選擇']
    };
    const PLAY_DESCRIPTIONS = {
        '三振': '三振出局', '補滾': '捕手滾地球出局', '投滾': '投手滾地球出局', '一滾': '一壘滾地球出局',
        '二滾': '二壘滾地球出局', '三滾': '三壘滾地球出局', '游滾': '游擊滾地球出局', '野手選擇': '擊出野手選擇',
        '一飛': '一壘飛球出局', '二飛': '二壘飛球出局', '三飛': '三壘飛球出局', '游飛': '游擊飛球出局', '右飛': '右外野飛球出局',
        '中飛': '中外野飛球出局', '左飛': '左外野飛球出局', '界飛': '界外飛球接殺', '雙殺': '造成雙殺', '三殺': '造成三殺',
        '四壞': '獲得四壞保送', '觸身球': '獲得觸身球保送', '不死三振': '不死三振上壘', '內安': '擊出內野安打',
        '一安': '擊出一壘安打', '二安': '擊出二壘安打',
        '三安': '擊出三壘安打', '本打': '擊出全壘打', '失誤': '因失誤上壘',
        '犧短': '犧牲短打', '犧飛': '擊出高飛犧牲打',
        '妨礙守備': '因妨礙守備出局', '妨礙打擊': '因捕手妨礙打擊上壘'
    };
    const PLAY_ABBREVIATIONS = {
        '三振': '三振', '補滾': '補滾', '投滾': '投滾', '一滾': '一滾', '二滾': '二滾', '三滾': '三滾', '游滾': '游滾',
        '野手選擇': '野選', '一飛': '一飛', '二飛': '二飛', '三飛': '三飛', '游飛': '游飛',
        '右飛': '右飛', '中飛': '中飛', '左飛': '左飛', '界飛': '界飛', '雙殺': '雙殺', '三殺': '三殺',
        '四壞': '四壞', '觸身球': '觸身', '不死三振': '不死三振', '内安': '內安', '一安': '一安', '二安': '二安',
        '三安': '三安', '本打': '本打', '失誤': '失誤', '犧短': '犧短', '犧飛': '犧飛',
        '妨礙守備': '妨礙守備', '妨礙打擊': '妨礙打擊'
    };
    const PLAY_TYPE_CATEGORIES = {
        '三振': 'strikeout',
        '補滾': 'groundout', '投滾': 'groundout', '一滾': 'groundout', '二滾': 'groundout', '三滾': 'groundout', '游滾': 'groundout',
        '一飛': 'flyout', '二飛': 'flyout', '三飛': 'flyout', '游飛': 'flyout', '右飛': 'flyout', '中飛': 'flyout', '左飛': 'flyout', '界飛': 'flyout',
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
                jersey: String(jerseyNum),
                name: shuffledNames[i] || `球員 ${i+1}`,
                pos: pos,
                photo: DEFAULT_PLAYER_PHOTO_BASE64,
                pa: 0, ab: 0, r: 0, h: 0, rbi: 0, tb: 0, '2b': 0, '3b': 0, hr: 0,
                gidp: 0, bb: 0, hbp: 0, so: 0, sf: 0, sh: 0, sb: 0,
                abResults: []
            };
        });
        const pitcher = roster[PITCHER_ROSTER_INDEX];
        pitcher.pos = 'P';
        pitcher.name = shuffledNames[PITCHER_ROSTER_INDEX] || '先發投手';
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
        stadium?: string;
        gameDate?: string;
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
                    <input type="text" id="team-${teamKey}-name" class="team-name-input" value="${team.name}">
                    <input type="color" id="team-${teamKey}-color" value="${team.color}" class="team-color-input">
                </h4>
                <div class="team-settings-controls">
                    <div class="dh-toggle-container">
                        <label for="team-${teamKey}-dh-toggle">啟用DH</label>
                        <label class="switch">
                            <input type="checkbox" id="team-${teamKey}-dh-toggle" data-team="${teamKey}" ${team.useDH ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div class="roster-actions">
                        <button type="button" class="roster-action-btn save-roster-btn" data-team="${teamKey}">儲存名單</button>
                        <button type="button" class="roster-action-btn load-roster-btn" data-team="${teamKey}">讀取名單</button>
                    </div>
                </div>
                <div id="team-${teamKey}-pitcher-container" style="display: ${team.useDH ? 'block' : 'none'};">
                    <h5>先發投手</h5>
                    <div id="team-${teamKey}-pitcher">${createPitcherInputHTML(teamKey)}</div>
                </div>
                <h5>先發打序</h5>
                <div id="team-${teamKey}-lineup"></div>
                <h5 class="collapsible-header" data-target="team-${teamKey}-bench">板凳球員</h5>
                <div id="team-${teamKey}-bench" class="collapsible-content"></div>
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
    function createPitcherInputHTML(team) {
        return `
        <div class="pitcher-input-container">
            <div class="player-photo-container">
                <img src="" id="player-photo-preview-${team}-${PITCHER_ROSTER_INDEX}" class="player-photo-preview" alt="照片">
                <label for="player-photo-upload-${team}-${PITCHER_ROSTER_INDEX}" class="image-upload-label">+</label>
                <input type="file" id="player-photo-upload-${team}-${PITCHER_ROSTER_INDEX}" class="image-upload-input" data-team="${team}" data-index="${PITCHER_ROSTER_INDEX}" data-type="photo" accept="image/*">
            </div>
            <span>P</span>
            <input type="text" data-team="${team}" data-type="pitcher-jersey" placeholder="背號">
            <input type="text" data-team="${team}" data-type="pitcher-name" placeholder="姓名">
            <select data-team="${team}" data-type="pitcher-pos" disabled><option value="P">P</option></select>
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
            <select data-team="${team}" data-index="${index}" data-type="pos"><option value="">守位</option>${positionOptions}</select>
        `;
        return `
            <div class="lineup-player ${benchClass}">
                ${dragHandle}
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
        if (contentEl) {
            const scoreboardRect = document.getElementById('scoreboard').getBoundingClientRect();
            const modalHeight = contentEl.offsetHeight;
            const desiredTop = scoreboardRect.top - modalHeight - 20;
            const safeTop = Math.max(16, desiredTop);
            contentEl.style.top = `${safeTop}px`;
            contentEl.style.left = `${scoreboardRect.left}px`;
        }
    }
    function closeModal(modalEl) {
        modalEl.classList.add('modal-hidden');
    }
    function drag(e: MouseEvent) {
        if (!isDragging || !dragTarget)
            return;
        e.preventDefault();
        dragTarget.style.left = `${e.clientX - offsetX}px`;
        dragTarget.style.top = `${e.clientY - offsetY}px`;
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
                // When disabling DH, intelligently change the former DH player to Pitcher.
                if (!team.useDH) {
                    const dhSpot = team.lineupSpots.find(spot => {
                        const player = team.roster.find(p => p._id === spot.activePlayerId);
                        return player?.pos === 'DH';
                    });
                    if (dhSpot) {
                        const playerToBecomePitcher = team.roster.find(p => p._id === dhSpot.activePlayerId);
                        if (playerToBecomePitcher) {
                            playerToBecomePitcher.pos = 'P';
                        }
                    }
                }
                logEvent(`${team.name} 的指定打擊(DH)制度已${team.useDH ? '啟用' : '停用'}。`, teamKey);
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
        lineupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const isGameInProgress = gameState.inning > 1 || gameState.outs > 0 || gameState.events.length > 0;
            saveLineup();
            if (isGameInProgress) {
                logEvent('球員名單已更新。');
            }
            saveState();
            render();
        });
        lineupForm.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
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
                        gameState.teams[team].logo = base64String;
                        (document.getElementById(`team-${team}-logo-preview`) as HTMLImageElement).src = base64String;
                    }
                    else if (type === 'photo') {
                        const playerIndex = parseInt(index, 10);
                        gameState.teams[team].roster[playerIndex].photo = base64String;
                        (document.getElementById(`player-photo-preview-${team}-${index}`) as HTMLImageElement).src = base64String;
                    }
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
            openModal(modal, modalContent);
            showModalStep('step1');
        });
        closeModalBtn.addEventListener('click', () => closeModal(modal));
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
                if (isHit || isAdvancedOut || isAdvancedOnBase || isGroundOrFlyOut) {
                    const batterIsOut = isAdvancedOut || isGroundOrFlyOut;
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
            const button = target.closest('button');
            if (button) {
                const { step, errorPos, dest, runnerId, choice, outRunnerBase } = button.dataset;
                if (step === 'ask-error') {
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
                    advancedPlayState.error = errorPos;
                    renderAdvancedPlayOptions();
                }
                else if (step === 'select-fc-out') {
                    const outRunnerBaseIndex = Number(outRunnerBase);
                    advancedPlayState.outRunnerBase = outRunnerBaseIndex;
                    // Pre-set the runner as out
                    advancedPlayState.runnerDestinations[`base-${outRunnerBaseIndex}`] = { dest: 0, isUnearned: false };
                    advancedPlayState.step = 'set-runners';
                    renderAdvancedPlayOptions();
                }
                else if (step === 'set-runners') {
                    if (runnerId) {
                        const runnerKey = `base-${runnerId}`;
                        advancedPlayState.runnerDestinations[runnerKey] = { dest: Number(dest), isUnearned: advancedPlayState.runnerDestinations[runnerKey]?.isUnearned || false };
                    }
                    else { // Batter
                        advancedPlayState.batterDestination = { dest: Number(dest), isUnearned: advancedPlayState.batterDestination?.isUnearned || false };
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
        // --- Mobile Navigation & Layout Listeners ---
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
            isDragging = true;
            dragTarget = modalToDrag;
            document.body.style.cursor = 'grabbing'; // Provide visual feedback
            offsetX = e.clientX - dragTarget.getBoundingClientRect().left;
            offsetY = e.clientY - dragTarget.getBoundingClientRect().top;
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
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchend', handleDragEnd);
        }
        function resyncRosterAfterSwap(player1: HTMLElement, player2: HTMLElement, teamKey: 'a' | 'b') {
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
        if (target.closest('button, input, select, a, .drag-handle'))
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
        // This function now ONLY updates player data and team settings,
        // it does not reset the game state, preserving all stats.
        ['a', 'b'].forEach(teamKey => {
            const team = gameState.teams[teamKey];
            team.name = (document.getElementById(`team-${teamKey}-name`) as HTMLInputElement).value;
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
                
                const pitcherStats = team.pitchers.find(p => p._id === pitcherPlayer._id);
                if (pitcherStats) {
                    pitcherStats.name = pitcherPlayer.name;
                }
                
                team.activePitcherId = pitcherPlayer._id;
                newActiveLineupPlayerIds.add(pitcherPlayer._id);
            }

            let lineupPitcherId = null;
            let pitcherCount = 0;

            for (let i = 0; i < LINEUP_SIZE; i++) {
                const name = (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement).value;
                const jersey = (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement).value;
                const pos = (document.querySelector(`select[data-team="${teamKey}"][data-index="${i}"][data-type="pos"]`) as HTMLSelectElement).value;

                const player = team.roster[i];
                player.name = name || `第${i + 1}棒`;
                player.jersey = jersey;
                player.pos = pos;
                
                newActiveLineupPlayerIds.add(player._id);
                team.lineupSpots[i] = { order: i + 1, activePlayerId: player._id, history: [player._id] };

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
                    player.name = name || `球員 ${playerIndex + 1}`;
                    player.jersey = jersey;
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
                            player[key] = defaultPlayer[key];
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
        renderGameStateDisplay();
        renderEventLog();
        renderLineupInputs();
        runnerActionBtn.disabled = !gameState.bases.some(runner => runner !== null) || gameState.isGameOver;
        undoBtn.disabled = gameStateHistory.length === 0;
        managementBtn.disabled = gameState.isGameOver;
        if (gameState.isGameOver) {
            playBallBtn.innerHTML = '比賽結束';
            playBallBtn.classList.add('disabled');
        }
        else {
            playBallBtn.innerHTML = 'PLAY BALL';
            playBallBtn.classList.remove('disabled');
        }
    }
    function applyTeamColors() {
        document.documentElement.style.setProperty('--team-a-color', gameState.teams.a.color);
        document.documentElement.style.setProperty('--team-b-color', gameState.teams.b.color);
    }
    function renderHeaderInputs() {
        stadiumInput.value = gameState.stadium || '';
        gameDateInput.value = gameState.gameDate || new Date().toISOString().split('T')[0];
    }
    function renderScoreboard() {
        const headerRow = document.getElementById('scoreboard-header-row');
        const tbody = document.getElementById('scoreboard-body');
        const numInnings = Math.max(9, gameState.inning);
        headerRow.innerHTML = `<th>隊伍</th>${Array.from({ length: numInnings }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>R</th><th>H</th><th>E</th>`;
        tbody.innerHTML = ['a', 'b'].map(teamKey => {
            const team = gameState.teams[teamKey];
            const totalRuns = team.score.reduce((a, b) => a + (b || 0), 0);
            let scoreCells = '';
            for (let i = 0; i < numInnings; i++) {
                const score = team.score[i];
                const hasPlayed = gameState.inning > i + 1 || (gameState.inning === i + 1 && (teamKey === 'a' || !gameState.isTop));
                if (score != null) {
                    scoreCells += `<td>${score}</td>`;
                }
                else if (hasPlayed) {
                    scoreCells += `<td>0</td>`;
                }
                else {
                    scoreCells += `<td></td>`;
                }
            }
            const teamLogoHTML = `<img src="${team.logo || DEFAULT_TEAM_LOGO_BASE64}" alt="${team.name}" class="scoreboard-team-logo">`;
            const teamCellContent = `<div class="scoreboard-team-cell">${teamLogoHTML}<span>${team.name}</span></div>`;
            return `<tr><td>${teamCellContent}</td>${scoreCells}<td class="total-col">${totalRuns}</td><td>${team.hits}</td><td>${team.errors}</td></tr>`;
        }).join('');
        (document.getElementById('info-team-a')).textContent = gameState.teams.a.name;
        (document.getElementById('info-team-b')).textContent = gameState.teams.b.name;
        (document.getElementById('info-score')).textContent = `${gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0)} - ${gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0)}`;
    }
    function renderGameStateDisplay() {
        const { inning, isTop, outs } = gameState;
        (document.getElementById('inning-display')).textContent = `${inning}局${isTop ? '上' : '下'}`;
        const batterDisplayContainer = document.getElementById('current-batter-display');
        batterDisplayContainer.innerHTML = ''; // Clear previous content
        const batter = getCurrentBatter();
        if (batter) {
            const teamKey = isTop ? 'a' : 'b';
            const team = gameState.teams[teamKey];
            const batterIndex = gameState.currentBatterIndex[teamKey];
            const photoContainer = document.createElement('div');
            photoContainer.innerHTML = `<img src="${batter.photo || DEFAULT_PLAYER_PHOTO_BASE64}" class="batter-photo-main" alt="${batter.name}">`;
            const infoTextEl = document.createElement('div');
            infoTextEl.id = 'batter-info-text';
            const mainInfoEl = document.createElement('div');
            mainInfoEl.id = 'batter-main-info';
            const lastAbEl = document.createElement('div');
            lastAbEl.id = 'batter-last-ab';
            infoTextEl.append(mainInfoEl, lastAbEl);
            batterDisplayContainer.append(photoContainer, infoTextEl);
            mainInfoEl.style.color = team.color;
            const calculateStatString = (value) => {
                if (isNaN(value) || !isFinite(value))
                    return '.000';
                const fixed = value.toFixed(3);
                return (value < 1) ? fixed.substring(1) : fixed;
            };
            const avg = batter.ab > 0 ? (batter.h / batter.ab) : 0;
            const slg = batter.ab > 0 ? (batter.tb / batter.ab) : 0;
            mainInfoEl.innerHTML = `目前打者：<span class="batter-team-name">${team.name}</span> 第${batterIndex + 1}棒 ${batter.name || ''} (打數: ${batter.ab}, 安打: ${batter.h}, 打點: ${batter.rbi}, 打擊率: ${calculateStatString(avg)}, 長打率: ${calculateStatString(slg)})`;
            lastAbEl.textContent = `本場打擊：${(batter.abResults || []).map(res => PLAY_ABBREVIATIONS[res] || res).join(' | ') || '-'}`;
        }
        else {
            batterDisplayContainer.innerHTML = `<div id="batter-info-text"><div id="batter-main-info">請設定打序</div><div id="batter-last-ab"></div></div>`;
        }
        document.querySelectorAll('#sbo-display .sbo-row:nth-child(1) .sbo-light').forEach((l, i) => l.classList.toggle('o-on', i < outs));
        ['first', 'second', 'third'].forEach((base, i) => { document.getElementById(`${base}-base`).classList.toggle('occupied', !!gameState.bases[i]?.runnerId); });
        playBallBtn.classList.remove('hidden');
    }
    function renderEventLog() {
        const log = document.getElementById('event-log');
        // FIX: Renamed 'event' to 'gameEvent' to avoid conflict with the global 'Event' type.
        log.innerHTML = [...(gameState.events || [])].reverse().map(gameEvent => {
            return !gameEvent.teamKey
                ? `<li>${gameEvent.text}</li>`
                : `<li class="event-team-${gameEvent.teamKey}">${gameEvent.text}</li>`;
        }).join('');
    }
    function renderLineupInputs() {
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
                    nameInput.value = player.name;
                    jerseyInput.value = player.jersey;
                    if (photoPreview) {
                        photoPreview.src = player.photo || DEFAULT_PLAYER_PHOTO_BASE64;
                    }
                }
                if (i < LINEUP_SIZE) {
                    const posSelect = document.querySelector(`select[data-team="${teamKey}"][data-index="${i}"][data-type="pos"]`) as HTMLSelectElement;
                    if (posSelect)
                        posSelect.value = player.pos;
                }
            });
            // Handle dedicated pitcher input specifically for DH enabled
            if (team.useDH) {
                const pitcherPlayer = team.roster[PITCHER_ROSTER_INDEX];
                const pitcherNameInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement;
                const pitcherJerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement;
                const pitcherPhotoPreview = document.getElementById(`player-photo-preview-${teamKey}-${PITCHER_ROSTER_INDEX}`) as HTMLImageElement;
                if (pitcherNameInput)
                    pitcherNameInput.value = pitcherPlayer.name;
                if (pitcherJerseyInput)
                    pitcherJerseyInput.value = pitcherPlayer.jersey;
                if (pitcherPhotoPreview)
                    pitcherPhotoPreview.src = pitcherPlayer.photo || DEFAULT_PLAYER_PHOTO_BASE64;
            }
        });
    }
    function renderBoxScore() {
        const boxScoreContainer = document.getElementById('box-score-tables');
        boxScoreContainer.innerHTML = '';
        const calculateStatString = (value) => {
            if (isNaN(value) || !isFinite(value))
                return '.000';
            const fixed = value.toFixed(3);
            return (value < 1) ? fixed.substring(1) : fixed;
        };
        ['a', 'b'].forEach((teamKey) => {
            const team = gameState.teams[teamKey];
            // --- Batting Table ---
            const battingTable = document.createElement('table');
            battingTable.innerHTML = `
                <thead>
                    <tr>
                        <th>${team.name} 打擊成績</th>
                        <th>打席</th> <th>打數</th> <th>得分</th> <th>安打</th> <th>打點</th> <th>二安</th> <th>三安</th>
                        <th>全壘打</th> <th>盜壘</th> <th>四壞</th> <th>觸身</th> <th>三振</th> <th>高飛犧牲</th> <th>雙殺打</th>
                        <th>打擊率</th> <th>上壘率</th> <th>長打率</th>
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
                    const playerName = isSubstitute ? `&nbsp;&nbsp;↳ ${player.name}, ${player.pos}` : `${index + 1}. ${player.name}, ${player.pos}`;
                    const photoHTML = `<img src="${player.photo || DEFAULT_PLAYER_PHOTO_BASE64}" alt="${player.name}" class="box-score-player-photo">`;
                    row.innerHTML = `
                        <td><div class="box-score-player-cell">${photoHTML}<span>${playerName}</span></div></td>
                        <td>${player.pa}</td> <td>${player.ab}</td> <td>${player.r}</td> <td>${player.h}</td> <td>${player.rbi}</td>
                        <td>${player['2b']}</td> <td>${player['3b']}</td> <td>${player.hr}</td> <td>${player.sb}</td>
                        <td>${player.bb}</td> <td>${player.hbp}</td> <td>${player.so}</td> <td>${player.sf}</td> <td>${player.gidp}</td>
                        <td>${calculateStatString(avg)}</td>
                        <td>${calculateStatString(obp)}</td>
                        <td>${calculateStatString(slg)}</td>
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
                <td>${teamTotals.bb}</td> <td>${teamTotals.hbp}</td> <td>${teamTotals.so}</td> <td>${teamTotals.sf}</td> <td>${teamTotals.gidp}</td>
                <td>${calculateStatString(total_avg)}</td>
                <td>${calculateStatString(total_obp)}</td>
                <td>${calculateStatString(total_slg)}</td>
            `;
            tfoot.appendChild(totalRow);
            battingTable.appendChild(tfoot);
            boxScoreContainer.appendChild(battingTable);
            // --- Pitching Table ---
            const pitchingHeader = document.createElement('h4');
            pitchingHeader.textContent = `${team.name} 投球成績`;
            boxScoreContainer.appendChild(pitchingHeader);
            const pitchingTable = document.createElement('table');
            pitchingTable.innerHTML = `
            <thead>
                <tr>
                    <th>投手</th>
                    <th>投球局數</th>
                    <th>被安打</th>
                    <th>失分</th>
                    <th>自責分</th>
                    <th>四壞</th>
                    <th>奪三振</th>
                    <th>被全壘打</th>
                    <th>面對打席</th>
                    <th>暴投</th>
                    <th>投手犯規</th>
                    <th>死球</th>
                    <th>故意四壞</th>
                    <th>防禦率</th>
                    <th>每局被上壘率</th>
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
                    <td>${ip || '0'}</td> <td>${pitcher.h}</td> <td>${pitcher.r}</td> <td>${pitcher.er}</td>
                    <td>${pitcher.bb}</td> <td>${pitcher.k}</td> <td>${pitcher.hr}</td> <td>${pitcher.bf}</td>
                    <td>${pitcher.wp}</td> <td>${pitcher.bk}</td> <td>${pitcher.hbp}</td> <td>${pitcher.ibb}</td>
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
                <td>${totalIp || '0'}</td> <td>${pTotals.h}</td> <td>${pTotals.r}</td> <td>${pTotals.er}</td>
                <td>${pTotals.bb}</td> <td>${pTotals.k}</td> <td>${pTotals.hr}</td> <td>${pTotals.bf}</td>
                <td>${pTotals.wp}</td> <td>${pTotals.bk}</td> <td>${pTotals.hbp}</td> <td>${pTotals.ibb}</td>
                <td>${totalEra}</td> <td>${totalWhip}</td>
            `;
            pTfoot.appendChild(pTotalRow);
            pitchingTable.appendChild(pTfoot);
            boxScoreContainer.appendChild(pitchingTable);

            // Add a separator after the first team's stats
            if (teamKey === 'a') {
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
        gameState.events.push({ text, teamKey });
    }
    function getPlayerById(teamKey, playerId) {
        return gameState.teams[teamKey]?.roster.find(p => p._id === playerId) || null;
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
        const scoreA = gameState.teams.a.score.reduce((a, b) => a + (b || 0), 0);
        const scoreB = gameState.teams.b.score.reduce((a, b) => a + (b || 0), 0);
        logEvent(`比賽結束。 終場比數 ${gameState.teams.a.name} ${scoreA} : ${scoreB} ${gameState.teams.b.name}。`);
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
        const teamKey = gameState.isTop ? 'a' : 'b';
        const batter = getCurrentBatter();
        if (!batter)
            return;
        const activePitcher = gameState.teams[gameState.isTop ? 'b' : 'a'].pitchers.find(p => p._id === gameState.teams[gameState.isTop ? 'b' : 'a'].activePitcherId);
        activePitcher.bf++;
        batter.pa++;
        batter.abResults.push(play);
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
        logEvent(`第${gameState.currentBatterIndex[teamKey] + 1}棒 ${batter.name} ${PLAY_DESCRIPTIONS[play]}.`, teamKey);
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
    function startAdvancedPlay(play, options = { batterIsOut: false }) {
        advancedPlayState = {
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
            advancedPlayState.batterDestination.isUnearned = true;
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
        }
        else { // Hits (not HR) and Uncaught Third Strike
            advancedPlayState.step = 'ask-error';
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
            modalAdvancedOptions.innerHTML = optionsHTML;
        }
        else if (advancedPlayState.step === 'set-runners') {
            let title = advancedPlayState.error ?
                `${PLAY_DESCRIPTIONS[advancedPlayState.play]}, 並靠著${ERROR_POSITIONS[advancedPlayState.error]}失誤` :
                PLAY_DESCRIPTIONS[advancedPlayState.play];
            modalAdvancedTitle.textContent = title;
            let optionsHTML = '';
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
            if (canHaveObstruction) {
                modifierHTML = `
                    <div class="advanced-play-modifiers">
                        <button 
                            data-step="toggle-obstruction" 
                            class="${advancedPlayState.obstruction ? 'selected' : ''}"
                        >
                            加上妨礙跑壘
                        </button>
                    </div>
                `;
            }
            modalAdvancedOptions.innerHTML = optionsHTML + modifierHTML;
        }
    }
    function processAdvancedPlay() {
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
        batter.abResults.push(play);
        const hitBases = { '內安': 1, '一安': 1, '二安': 2, '三安': 3, '本打': 4 };
        if (play === '不死三振') {
            batter.so++;
            activePitcher.k++;
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
        if (error) {
            gameState.teams[teamKey === 'a' ? 'b' : 'a'].errors++;
        }
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
            const nowUnearned = runner.isUnearned || !!error;
            if (val.dest >= 4) { // Runner scores
                runnersScored.push({ ...runner, isUnearned: nowUnearned });
                rbis++; // Simple RBI logic
            }
            else if (val.dest > 0) { // Runner advances to a base
                newBases[val.dest - 1] = { ...runner, isUnearned: nowUnearned };
            }
            else { // Runner is out
                outsOnPlay++;
            }
        });
        if (!batterIsOut) {
            const isBatterUnearned = batterDestination.isUnearned || !!error;
            if (batterDestination.dest >= 4) {
                runnersScored.push({ runnerId: batter._id, isUnearned: isBatterUnearned });
                rbis++;
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
        let eventDesc = `第${gameState.currentBatterIndex[teamKey] + 1}棒 ${batter.name}`;
        if (play !== '失誤') {
            eventDesc += ` ${PLAY_DESCRIPTIONS[play]}`;
        }
        if (error) {
            const prefix = (play === '失誤') ? ' ' : ', ';
            eventDesc += `${prefix}並靠著${ERROR_POSITIONS[error]}失誤`;
        }
        const basesText = ['一', '二', '三', '本'];
        // Part 2: Add batter's destination and RBI information
        if (!batterIsOut) {
            let batterDestText = '';
            const hitPower = hitBases[play] || 0;
            if (batterDestination.dest > 0) {
                if (hitPower > 0 && batterDestination.dest > hitPower) {
                     batterDestText = `上到${basesText[hitPower - 1]}壘，並趁傳進壘到${basesText[batterDestination.dest - 1]}壘`;
                } else if (batterDestination.dest <= 3) {
                     batterDestText = `上到${basesText[batterDestination.dest - 1]}壘`;
                } else if (batterDestination.dest >=4) {
                     batterDestText = `回到本壘得分`;
                }
            }
             eventDesc += batterDestText ? `，${batterDestText}。` : `。`;
            if (rbis > 0) {
                const rbiText = ['一', '兩', '三', '四'][rbis - 1] || rbis;
                eventDesc += ` ${rbiText}分打點。`;
            }
        }
        else {
            eventDesc += `。`;
        }
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
                    }

                    const hitPower = hitBases[play] || (play === '野手選擇' || play === '失誤' ? 1 : 0);
                    const basesAdvanced = dest - (i + 1);
                    if (hitPower > 0 && dest <= 4 && basesAdvanced > hitPower) {
                        toDestText += '(趁傳進壘)';
                    }

                    runnerMoves.push(`在${fromBaseText}壘的${runnerPlayer.name} ${toDestText}。`);
                }
            }
        });
        if (runnerMoves.length > 0) {
            // Join with a space to make it feel like separate sentences, but part of the same play description.
            eventDesc += ' ' + runnerMoves.join(' ');
        }
        if (obstruction) {
            eventDesc += ' 過程中發生妨礙跑壘。';
        }
        logEvent(eventDesc.trim(), teamKey);
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
            gameState = gameStateHistory.pop();
            logEvent('上一動已復原。');
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
                    const outOption = `<button data-step="set-dest" data-runner-id="${i}" data-dest="${i + 1}" data-out="true" class="out-option ${currentDest?.isOut ? 'selected' : ''}">出局</button>`;
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
        runnerActionDetails.innerHTML = detailsHTML;
    }
    function handleRunnerActionClick(e) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'BUTTON')
            return;
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
                    if (type === 'steal') {
                        eventParts.push(`${runnerPlayer.name}盜壘失敗。`);
                    }
                    else if (type === 'pickoff-out') {
                        eventParts.push(`${runnerPlayer.name}遭牽制出局。`);
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
                        eventParts.push(`${runnerPlayer.name}盜壘成功上到${['二', '三', '本'][dest - 2]}壘。`);
                    }
                    else {
                        eventParts.push(`${runnerPlayer.name}推進到${['一', '二', '三', '本'][dest - 1]}壘。`);
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
            prefix = '投手犯規，所有跑者推進一個壘包。';
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
    function openManagementModal() {
        managementState = {
            activeTeamKey: gameState.isTop ? 'a' : 'b',
            selectedPlayer: null,
        };
        renderManagementModal();
        openModal(managementModal);
    }
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
        const onFieldIds = new Set(team.lineupSpots.map(s => s.activePlayerId));
        if (team.useDH) {
            onFieldIds.add(team.activePitcherId);
        }
        const runnerMap = new Map();
        const isBattingTeam = (gameState.isTop && teamKey === 'a') || (!gameState.isTop && teamKey === 'b');
        if (isBattingTeam) {
            gameState.bases.forEach((runner, i) => {
                if (runner) {
                    runnerMap.set(runner.runnerId, { base: i, text: ['一', '二', '三'][i] + '壘跑者' });
                }
            });
        }
        let onFieldHTML = ``;
        if (team.useDH) {
            const pitcher = getPlayerById(teamKey, team.activePitcherId);
            if (pitcher) {
                const runnerInfo = runnerMap.get(pitcher._id);
                const runnerIndicatorHTML = runnerInfo ? `<span class="runner-indicator">(${runnerInfo.text})</span>` : '';
                const photoHTML = `<img src="${pitcher.photo || DEFAULT_PLAYER_PHOTO_BASE64}" class="management-player-photo" alt="${pitcher.name}">`;
                onFieldHTML += `<li data-player-id="${pitcher._id}" data-source="field" class="management-pitcher-item">${photoHTML}<span class="pos">P</span> <span class="player-name">${pitcher.name}</span> ${runnerIndicatorHTML}</li>`;
            }
        }
        team.lineupSpots.forEach(spot => {
            const player = getPlayerById(teamKey, spot.activePlayerId);
            if (player) {
                const runnerInfo = runnerMap.get(player._id);
                const runnerIndicatorHTML = runnerInfo ? `<span class="runner-indicator">(${runnerInfo.text})</span>` : '';
                const isPitcherNoDH = !team.useDH && player.pos === 'P';
                const photoHTML = `<img src="${player.photo || DEFAULT_PLAYER_PHOTO_BASE64}" class="management-player-photo" alt="${player.name}">`;
                onFieldHTML += `<li data-player-id="${player._id}" data-source="field" class="${isPitcherNoDH ? 'management-pitcher-item' : ''}">${photoHTML}<span class="pos">${spot.order}. ${player.pos || 'N/A'}</span> <span class="player-name">${player.name}</span> ${runnerIndicatorHTML}</li>`;
            }
        });
        const benchPlayers = team.roster.filter(p => !onFieldIds.has(p._id));
        const benchHTML = benchPlayers.map(player => {
            const photoHTML = `<img src="${player.photo || DEFAULT_PLAYER_PHOTO_BASE64}" class="management-player-photo" alt="${player.name}">`;
            return `<li data-player-id="${player._id}" data-source="bench">${photoHTML}<span class="player-name">${player.name}</span></li>`;
        }).join('');
        managementContainer.innerHTML = `
            <div class="management-column">
                <h4>場上球員 (打線/守備)</h4>
                <ul class="management-player-list">${onFieldHTML}</ul>
            </div>
            <div class="management-column">
                <h4>板凳球員</h4>
                <ul class="management-player-list">${benchHTML}</ul>
            </div>
        `;
        if (managementState.selectedPlayer) {
            const selectedEl = managementContainer.querySelector(`li[data-player-id="${managementState.selectedPlayer.id}"]`);
            if (selectedEl) {
                selectedEl.classList.add('selected');
            }
        }
    }
    function handleManagementInteraction(e) {
        const target = e.target as HTMLElement;
        const popover = target.closest('.substitution-popover');
        if (popover) {
            handlePopoverClick(e);
            return;
        }
        // FIX: Cast return of closest() to specific element types to resolve type errors.
        const playerLi = target.closest('li[data-player-id]') as HTMLLIElement | null;
        const tabBtn = target.closest('.tab-btn') as HTMLButtonElement | null;
        if (tabBtn) {
            const teamKey = tabBtn.dataset.teamKey as 'a' | 'b';
            managementState.activeTeamKey = teamKey;
            managementState.selectedPlayer = null;
            renderManagementModal();
            return;
        }
        if (!playerLi) {
            if (!popover) { // Click outside clears selection
                if (managementState.selectedPlayer) {
                    managementState.selectedPlayer = null;
                    renderManagementModal();
                }
            }
            return;
        }
        const { playerId, source } = playerLi.dataset;
        if (managementState.selectedPlayer === null) {
            // First selection
            managementState.selectedPlayer = { id: playerId, source: source as 'field' | 'bench', element: playerLi };
            playerLi.classList.add('selected');
        }
        else {
            // Second selection
            if (managementState.selectedPlayer.id === playerId) {
                // Deselect if clicking the same player
                managementState.selectedPlayer = null;
                playerLi.classList.remove('selected');
                return;
            }
            const sourcePlayer = managementState.selectedPlayer;
            const targetPlayer = { id: playerId, source: source as 'field' | 'bench', element: playerLi };
            if (sourcePlayer.source === 'bench' && targetPlayer.source === 'field') {
                // Substitution: Bench player replaces field player
                showSubstitutionPopover(sourcePlayer.id, targetPlayer.id, targetPlayer.element);
            }
            else if (sourcePlayer.source === 'field' && targetPlayer.source === 'field') {
                // Defensive swap
                showSwapPopover(sourcePlayer.id, targetPlayer.id, targetPlayer.element);
            }
            else if (sourcePlayer.source === 'field' && targetPlayer.source === 'bench') {
                // Substitution: Field player is replaced by bench player (reversed click order)
                showSubstitutionPopover(targetPlayer.id, sourcePlayer.id, sourcePlayer.element);
            }
            else {
                // Invalid action (e.g., bench to bench), just select the new player
                sourcePlayer.element.classList.remove('selected');
                managementState.selectedPlayer = { id: playerId, source: source as 'field' | 'bench', element: playerLi };
                playerLi.classList.add('selected');
            }
        }
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
                        hbp: player.hbp, so: player.so, sf: player.sf, gidp: player.gidp,
                        tb: player.tb, avg: avg, obp: obp, slg: slg
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
        const battingHeaders = ['球員', '打席', '打數', '得分', '安打', '打點', '二安', '三安', '全壘打', '盜壘', '四壞', '觸身', '三振', '高飛犧牲', '雙殺打', '打擊率', '上壘率', '長打率'];
        const pitchingHeaders = ['投手', '投球局數', '被安打', '失分', '自責分', '四壞', '奪三振', '被全壘打', '面對打席', '暴投', '投手犯規', '死球', '故意四壞', '防禦率', '每局被上壘率'];
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
                    player.hbp, player.so, player.sf, player.gidp,
                    calculateStatString(player.avg), calculateStatString(player.obp), calculateStatString(player.slg)
                ]);
            });

            // Batting Totals
            const teamTotals = teamData.battingTotals;
            csvContent.push([
                '合計', teamTotals.pa, teamTotals.ab, teamTotals.r, teamTotals.h, teamTotals.rbi,
                teamTotals['2b'], teamTotals['3b'], teamTotals.hr, teamTotals.sb, teamTotals.bb,
                teamTotals.hbp, teamTotals.so, teamTotals.sf, teamTotals.gidp,
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
                    pitcher.pitcher, ip, pitcher.h, pitcher.r, pitcher.er, pitcher.bb, pitcher.k, pitcher.hr,
                    pitcher.bf, pitcher.wp, pitcher.bk, pitcher.hbp, pitcher.ibb, pitcher.era.toFixed(2), pitcher.whip.toFixed(2)
                ]);
            });

            // Pitching Totals
            const pTotals = teamData.pitchingTotals;
            const totalIpWhole = Math.floor(pTotals.outsRecorded / 3);
            const totalIpFrac = pTotals.outsRecorded % 3;
            const totalIp = `${totalIpWhole}.${totalIpFrac}`;
            csvContent.push([
                '合計', totalIp, pTotals.h, pTotals.r, pTotals.er, pTotals.bb, pTotals.k, pTotals.hr,
                pTotals.bf, pTotals.wp, pTotals.bk, pTotals.hbp, pTotals.ibb, pTotals.era.toFixed(2), pTotals.whip.toFixed(2)
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
        const battingHeaders = ['球員', 'PA', 'AB', 'R', 'H', 'RBI', '2B', '3B', 'HR', 'SB', 'BB', 'HBP', 'SO', 'SF', 'GIDP', 'AVG', 'OBP', 'SLG', 'TB'];
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
                    p.player, p.pa, p.ab, p.r, p.h, p.rbi, p['2b'], p['3b'], p.hr, p.sb, p.bb, p.hbp, p.so, p.sf, p.gidp,
                    p.avg, p.obp, p.slg, p.tb
                ]);
            });
            const batting_data_end_row = ws_data.length;
            const bt = teamData.battingTotals;
            ws_data.push([
                '合計', bt.pa, bt.ab, bt.r, bt.h, bt.rbi, bt['2b'], bt['3b'], bt.hr, bt.sb, bt.bb, bt.hbp, bt.so, bt.sf, bt.gidp,
                bt.avg, bt.obp, bt.slg, bt.tb
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
        // Get lineup players
        for (let i = 0; i < LINEUP_SIZE; i++) {
            roster[i] = {
                name: (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement).value,
                jersey: (document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement).value,
                photo: (document.getElementById(`player-photo-preview-${teamKey}-${i}`) as HTMLImageElement).src
            };
        }
        // Get bench players
        for (let i = 0; i < BENCH_SIZE; i++) {
            const playerIndex = i + LINEUP_SIZE;
            if (playerIndex === PITCHER_ROSTER_INDEX && useDH)
                continue; // Skip this slot, handled below
            const nameInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${playerIndex}"][data-type="name"]`) as HTMLInputElement;
            if (nameInput) {
                roster[playerIndex] = {
                    name: nameInput.value,
                    jersey: (document.querySelector(`input[data-team="${teamKey}"][data-index="${playerIndex}"][data-type="jersey"]`) as HTMLInputElement).value,
                    photo: (document.getElementById(`player-photo-preview-${teamKey}-${playerIndex}`) as HTMLImageElement).src
                };
            }
        }
        // Get dedicated DH pitcher
        if (useDH) {
            roster[PITCHER_ROSTER_INDEX] = {
                name: (document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-name"]`) as HTMLInputElement).value,
                jersey: (document.querySelector(`input[data-team="${teamKey}"][data-type="pitcher-jersey"]`) as HTMLInputElement).value,
                photo: (document.getElementById(`player-photo-preview-${teamKey}-${PITCHER_ROSTER_INDEX}`) as HTMLImageElement).src
            };
        }
        return { name: teamName, roster };
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
        // Use a case-insensitive search to find if a roster with the same name already exists.
        const existingRosterIndex = savedRosters.findIndex(r => r.name.toLowerCase() === teamName.toLowerCase());
        const newRosterData = {
            name: teamName,
            roster: teamDataFromForm.roster.map(p => ({ name: p.name, jersey: p.jersey, photo: p.photo }))
        };
        if (existingRosterIndex > -1) {
            const existingRoster = savedRosters[existingRosterIndex];
            // Ask for confirmation to overwrite, showing the existing name's casing.
            if (confirm(`名單 "${existingRoster.name}" 已存在。您想要覆蓋它嗎？`)) {
                // Overwrite the existing roster, keeping its ID but updating the name and content.
                savedRosters[existingRosterIndex] = { ...newRosterData, id: existingRoster.id };
                localStorage.setItem(SAVED_ROSTERS_KEY, JSON.stringify(savedRosters));
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
            localStorage.setItem(SAVED_ROSTERS_KEY, JSON.stringify(savedRosters));
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
                    pitcherPhotoPreview.src = player.photo || DEFAULT_PLAYER_PHOTO_BASE64;
            }
            else {
                const nameInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="name"]`) as HTMLInputElement;
                const jerseyInput = document.querySelector(`input[data-team="${teamKey}"][data-index="${i}"][data-type="jersey"]`) as HTMLInputElement;
                const photoPreview = document.getElementById(`player-photo-preview-${teamKey}-${i}`) as HTMLImageElement;
                if (nameInput) {
                    nameInput.value = player.name;
                    jerseyInput.value = player.jersey;
                    if (photoPreview)
                        photoPreview.src = player.photo || DEFAULT_PLAYER_PHOTO_BASE64;
                }
            }
        });
        closeModal(loadRosterModal);
        alert(`已載入名單 "${rosterToLoad.name}"。請點擊 "套用名單" 來更新比賽狀態。`);
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
