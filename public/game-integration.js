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

        // 增強現有的「新比賽」按鈕
        enhanceNewGameButton(gameManager);

        // 增強「上一動」按鈕，添加確認
        enhanceUndoButton(gameManager);

        // 嘗試載入上次的遊戲
        loadLastGame(gameManager);

        // 顯示歡迎訊息
        gameManager.showNotification('⚾ 遊戲管理系統已就緒', 'info');
    }

    // 增強「新比賽」按鈕
    function enhanceNewGameButton(gameManager) {
        const newGameBtn = document.getElementById('new-game-btn');
        if (!newGameBtn) return;

        // 移除原有的事件監聽器（通過替換元素）
        const newBtn = newGameBtn.cloneNode(true);
        newGameBtn.parentNode.replaceChild(newBtn, newGameBtn);

        newBtn.addEventListener('click', () => {
            gameManager.showConfirmDialog(
                '確定要開始新比賽嗎？<br><br>目前的比賽將會被自動儲存到「比賽記錄」中。',
                () => {
                    // 先儲存當前遊戲
                    const currentState = window.getCurrentGameState ? window.getCurrentGameState() : null;
                    if (currentState) {
                        gameManager.saveCurrentGame(currentState);
                    }

                    // 創建新遊戲
                    gameManager.createNewGame();

                    // 重置遊戲
                    if (window.resetGameToDefault) {
                        window.resetGameToDefault();
                    }

                    gameManager.showNotification('✓ 已開始新比賽', 'success');
                }
            );
        });
    }

    // 增強「上一動」按鈕
    function enhanceUndoButton(gameManager) {
        const undoBtn = document.getElementById('undo-btn');
        if (!undoBtn) return;

        // 添加提示文字
        undoBtn.addEventListener('mouseenter', () => {
            const lastEvent = getLastEvent();
            if (lastEvent) {
                undoBtn.title = `復原：${lastEvent}`;
            }
        });

        // 包裝原有的點擊事件
        const originalClick = undoBtn.onclick;
        undoBtn.onclick = function(e) {
            const lastEvent = getLastEvent();
            if (lastEvent) {
                gameManager.showConfirmDialog(
                    `確定要復原以下操作嗎？<br><br><strong>${lastEvent}</strong>`,
                    () => {
                        if (originalClick) {
                            originalClick.call(this, e);
                        }
                        gameManager.showNotification('✓ 已復原', 'success');
                    }
                );
            } else {
                if (originalClick) {
                    originalClick.call(this, e);
                }
            }
        };
    }

    // 獲取最後一個事件
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
