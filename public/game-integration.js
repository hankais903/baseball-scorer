// 整合腳本 - 連接遊戲管理器與主程式
(function() {
    'use strict';

    // 等待 DOM 和主程式載入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // 稍微延遲以確保主程式已初始化
        setTimeout(() => {
            initGameManagement();
        }, 500);
    }

    function initGameManagement() {
        // 初始化遊戲管理器
        const gameManager = new window.GameManager();
        const gameListUI = new window.GameListUI(gameManager);

        console.log('✅ 遊戲管理系統已啟動');
        console.log('📊 自動儲存間隔: 10秒');

        // 在視窗中保存引用以供主程式使用
        window.baseballGameManager = gameManager;
        window.baseballGameListUI = gameListUI;

        // 監聽自動儲存事件
        window.addEventListener('autosave-trigger', () => {
            // 從主程式獲取當前遊戲狀態
            const gameState = window.getCurrentGameState ? window.getCurrentGameState() : null;
            if (gameState) {
                gameManager.saveCurrentGame(gameState);
            }
        });

        // 監聽載入遊戲事件
        window.addEventListener('load-game', (e) => {
            const gameData = gameManager.loadGame(e.detail.gameId);
            if (gameData && window.loadGameState) {
                gameManager.switchToGame(e.detail.gameId);
                window.loadGameState(gameData);
            }
        });

        // 監聽重置遊戲事件
        window.addEventListener('reset-game', () => {
            if (window.resetGameToDefault) {
                window.resetGameToDefault();
            }
        });

        // 註：不再攔截「新比賽」與「上一動」按鈕。
        // 主程式已有自己的確認視窗與重置流程，之前的攔截寫法（cloneNode / onclick）
        // 會把主程式的事件處理器砍掉或重複觸發，導致資料清不掉、復原被執行兩次。
        // 這裡只保留「上一動」的滑鼠提示。
        addUndoTooltip();

        // 註：暫不自動載入上次的比賽。
        // loadGameState 的做法是寫入暫存後 location.reload()，若在啟動時呼叫
        // 會有無限重新整理的風險；且主程式本身已會從 baseballGameState 還原。

        // 顯示歡迎訊息
        // 開場提示對使用者沒有意義，移除
        // gameManager.showNotification('⚾ 遊戲管理系統已就緒', 'info');
    }

    // 「上一動」滑鼠提示（不攔截點擊行為）
    function addUndoTooltip() {
        const undoBtn = document.getElementById('undo-btn');
        if (!undoBtn) return;
        undoBtn.addEventListener('mouseenter', () => {
            const lastEvent = getLastEvent();
            undoBtn.title = lastEvent ? `復原：${lastEvent}` : '';
        });
    }

    //  // 獲取最後一個事件
    function getLastEvent() {
        try {
            const eventLog = document.getElementById('event-log');
            if (eventLog && eventLog.children.length > 0) {
                const lastEvent = eventLog.children[eventLog.children.length - 1];
                return lastEvent.textContent.trim();
            }
        } catch (error) {
            console.error('獲取最後事件失敗:', error);
        }
        return null;
    }

    // 嘗試載入上次的遊戲
    function loadLastGame(gameManager) {
        const lastGame = gameManager.loadCurrentGame();
        if (lastGame && window.loadGameState) {
            try {
                window.loadGameState(lastGame);
                console.log('✅ 已載入上次的比賽');
                gameManager.showNotification('✓ 已載入上次的比賽', 'info');
            } catch (error) {
                console.error('載入遊戲失敗:', error);
                gameManager.showNotification('載入上次比賽失敗，已重新開始', 'warning');
            }
        }
    }

    // 添加鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: 手動儲存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const gameState = window.getCurrentGameState ? window.getCurrentGameState() : null;
            if (gameState && window.baseballGameManager) {
                window.baseballGameManager.saveCurrentGame(gameState);
                window.baseballGameManager.showNotification('✓ 手動儲存成功', 'success');
            }
        }

        // Ctrl/Cmd + L: 開啟遊戲列表
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            if (window.baseballGameListUI) {
                window.baseballGameListUI.showGameList();
            }
        }
    });

    // 頁面可見性變化時儲存
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            const gameState = window.getCurrentGameState ? window.getCurrentGameState() : null;
            if (gameState && window.baseballGameManager) {
                window.baseballGameManager.saveCurrentGame(gameState);
            }
        }
    });

    console.log('🎮 整合腳本已載入');
    console.log('💡 快捷鍵: Ctrl+S (儲存) / Ctrl+L (開啟比賽列表)');
})();
