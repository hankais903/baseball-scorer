// 主程式輔助函數 - 提供給遊戲管理器使用
window.addEventListener('DOMContentLoaded', () => {
    // 等待主程式初始化
    setTimeout(() => {
        initHelperFunctions();
    }, 1000);
});

function initHelperFunctions() {
    // 獲取當前遊戲狀態
    window.getCurrentGameState = function() {
        try {
            // 這裡需要從主程式的 gameState 變數獲取
            // 由於主程式在閉包中，我們需要從 DOM 反向工程
            return extractGameStateFromDOM();
        } catch (error) {
            console.error('獲取遊戲狀態失敗:', error);
            return null;
        }
    };

    // 載入遊戲狀態
    window.loadGameState = function(gameData) {
        try {
            console.log('正在載入遊戲...', gameData);
            
            // 觸發頁面重新整理並載入數據
            // 暫時使用 localStorage 傳遞數據
            localStorage.setItem('temp_game_load', JSON.stringify(gameData));
            location.reload();
            
            return true;
        } catch (error) {
            console.error('載入遊戲狀態失敗:', error);
            return false;
        }
    };

    // 重置遊戲到預設狀態
    window.resetGameToDefault = function() {
        try {
            // 清除暫存的載入數據
            localStorage.removeItem('temp_game_load');
            
            // 重新整理頁面以重置狀態
            location.reload();
            
            return true;
        } catch (error) {
            console.error('重置遊戲失敗:', error);
            return false;
        }
    };

    // 從 DOM 提取遊戲狀態
    function extractGameStateFromDOM() {
        const state = {
            teams: {
                a: extractTeamData('a'),
                b: extractTeamData('b')
            },
            inning: extractInning(),
            isTop: extractIsTop(),
            outs: extractOuts(),
            bases: extractBases(),
            events: extractEvents(),
            stadium: extractStadium(),
            gameDate: extractGameDate(),
            isGameOver: false,
            version: 2,
            timestamp: new Date().toISOString()
        };

        return state;
    }

    // 提取球隊數據
    function extractTeamData(teamKey) {
        const teamData = {
            name: extractTeamName(teamKey),
            color: extractTeamColor(teamKey),
            score: extractTeamScore(teamKey),
            hits: extractTeamHits(teamKey),
            errors: extractTeamErrors(teamKey),
            roster: [],
            pitchers: [],
            useDH: false
        };

        return teamData;
    }

    // 提取球隊名稱
    function extractTeamName(teamKey) {
        const selector = teamKey === 'a' ? '#info-team-a' : '#info-team-b';
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : (teamKey === 'a' ? '客隊' : '主隊');
    }

    // 提取球隊顏色
    function extractTeamColor(teamKey) {
        // 嘗試從計算樣式獲取
        const rootStyle = getComputedStyle(document.documentElement);
        const colorVar = teamKey === 'a' ? '--team-a-color' : '--team-b-color';
        return rootStyle.getPropertyValue(colorVar).trim() || (teamKey === 'a' ? '#ef4444' : '#3b82f6');
    }

    // 提取球隊分數
    function extractTeamScore(teamKey) {
        const scoreboardBody = document.getElementById('scoreboard-body');
        if (!scoreboardBody) return [0];

        const rows = scoreboardBody.querySelectorAll('tr');
        const rowIndex = teamKey === 'a' ? 0 : 1;
        
        if (rows[rowIndex]) {
            const cells = rows[rowIndex].querySelectorAll('td');
            const scores = [];
            
            // 跳過第一個cell（球隊名稱）和最後三個（R/H/E）
            for (let i = 1; i < cells.length - 3; i++) {
                const score = parseInt(cells[i].textContent) || 0;
                scores.push(score);
            }
            
            return scores.length > 0 ? scores : [0];
        }

        return [0];
    }

    // 提取安打數
    function extractTeamHits(teamKey) {
        const scoreboardBody = document.getElementById('scoreboard-body');
        if (!scoreboardBody) return 0;

        const rows = scoreboardBody.querySelectorAll('tr');
        const rowIndex = teamKey === 'a' ? 0 : 1;
        
        if (rows[rowIndex]) {
            const cells = rows[rowIndex].querySelectorAll('td');
            const hitsCell = cells[cells.length - 2]; // H 在倒數第二個
            return parseInt(hitsCell?.textContent) || 0;
        }

        return 0;
    }

    // 提取失誤數
    function extractTeamErrors(teamKey) {
        const scoreboardBody = document.getElementById('scoreboard-body');
        if (!scoreboardBody) return 0;

        const rows = scoreboardBody.querySelectorAll('tr');
        const rowIndex = teamKey === 'a' ? 0 : 1;
        
        if (rows[rowIndex]) {
            const cells = rows[rowIndex].querySelectorAll('td');
            const errorsCell = cells[cells.length - 1]; // E 在最後一個
            return parseInt(errorsCell?.textContent) || 0;
        }

        return 0;
    }

    // 提取局數
    function extractInning() {
        const inningDisplay = document.getElementById('inning-display');
        if (!inningDisplay) return 1;

        const text = inningDisplay.textContent.trim();
        const match = text.match(/(\d+)局/);
        return match ? parseInt(match[1]) : 1;
    }

    // 提取上半局/下半局
    function extractIsTop() {
        const inningDisplay = document.getElementById('inning-display');
        if (!inningDisplay) return true;

        const text = inningDisplay.textContent.trim();
        return text.includes('上');
    }

    // 提取出局數
    function extractOuts() {
        const sboDisplay = document.getElementById('sbo-display');
        if (!sboDisplay) return 0;

        const lights = sboDisplay.querySelectorAll('.sbo-light.active');
        return lights.length;
    }

    // 提取壘包狀態
    function extractBases() {
        const bases = [null, null, null]; // 一壘、二壘、三壘

        ['first', 'second', 'third'].forEach((base, index) => {
            const baseElement = document.getElementById(`${base}-base`);
            if (baseElement && baseElement.classList.contains('occupied')) {
                bases[index] = {
                    runnerId: 'unknown',
                    isUnearned: false
                };
            }
        });

        return bases;
    }

    // 提取事件記錄
    function extractEvents() {
        const eventLog = document.getElementById('event-log');
        if (!eventLog) return [];

        const events = [];
        const items = eventLog.querySelectorAll('li');
        
        items.forEach(item => {
            events.push({
                text: item.textContent.trim(),
                teamKey: item.classList.contains('team-a-event') ? 'a' : 
                        item.classList.contains('team-b-event') ? 'b' : null
            });
        });

        return events;
    }

    // 提取球場
    function extractStadium() {
        const stadiumInput = document.getElementById('stadium-input');
        return stadiumInput ? stadiumInput.value.trim() : '';
    }

    // 提取日期
    function extractGameDate() {
        const gameDateInput = document.getElementById('game-date-input');
        return gameDateInput ? gameDateInput.value : '';
    }

    // 檢查是否有暫存的遊戲需要載入
    checkTempGameLoad();

    function checkTempGameLoad() {
        const tempData = localStorage.getItem('temp_game_load');
        if (tempData) {
            try {
                const gameData = JSON.parse(tempData);
                console.log('發現暫存遊戲，準備載入...', gameData);
                
                // 清除暫存
                localStorage.removeItem('temp_game_load');
                
                // 載入數據到 UI
                restoreGameDataToUI(gameData);
                
                if (window.baseballGameManager) {
                    window.baseballGameManager.showNotification('✓ 比賽已載入', 'success');
                }
            } catch (error) {
                console.error('載入暫存遊戲失敗:', error);
                localStorage.removeItem('temp_game_load');
            }
        }
    }

    // 將遊戲數據恢復到 UI
    function restoreGameDataToUI(gameData) {
        try {
            // 恢復球場和日期
            const stadiumInput = document.getElementById('stadium-input');
            const gameDateInput = document.getElementById('game-date-input');
            
            if (stadiumInput && gameData.stadium) {
                stadiumInput.value = gameData.stadium;
            }
            if (gameDateInput && gameData.gameDate) {
                gameDateInput.value = gameData.gameDate;
            }

            // 恢復事件記錄
            if (gameData.events && gameData.events.length > 0) {
                const eventLog = document.getElementById('event-log');
                if (eventLog) {
                    eventLog.innerHTML = '';
                    gameData.events.forEach(event => {
                        const li = document.createElement('li');
                        li.textContent = event.text;
                        if (event.teamKey === 'a') {
                            li.classList.add('team-a-event');
                        } else if (event.teamKey === 'b') {
                            li.classList.add('team-b-event');
                        }
                        eventLog.appendChild(li);
                    });
                }
            }

            console.log('✅ 遊戲數據已恢復到 UI');
        } catch (error) {
            console.error('恢復遊戲數據失敗:', error);
        }
    }

    console.log('✅ 主程式輔助函數已初始化');
}
