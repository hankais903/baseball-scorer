// 遊戲管理模組 - 處理數據持久化和多場比賽管理
class GameManager {
    constructor() {
        this.STORAGE_KEY = 'baseball_games_v2';
        this.CURRENT_GAME_KEY = 'baseball_current_game_id';
        this.AUTO_SAVE_INTERVAL = 10000; // 10秒自動儲存
        this.autoSaveTimer = null;
        this.currentGameId = null;
        
        this.init();
    }

    init() {
        // 載入當前遊戲ID
        this.currentGameId = localStorage.getItem(this.CURRENT_GAME_KEY);
        
        // 開始自動儲存
        this.startAutoSave();
        
        // 監聽頁面關閉前儲存
        window.addEventListener('beforeunload', () => {
            this.saveCurrentGame();
        });
    }

    // 生成唯一ID
    generateGameId() {
        return 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 獲取所有遊戲
    getAllGames() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('讀取遊戲數據失敗:', error);
            return {};
        }
    }

    // 儲存遊戲
    saveGame(gameId, gameData) {
        try {
            const games = this.getAllGames();
            games[gameId] = {
                ...gameData,
                id: gameId,
                lastModified: new Date().toISOString(),
                version: 2
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(games));
            
            // 顯示儲存成功提示
            this.showNotification('✓ 已自動儲存', 'success');
            
            return true;
        } catch (error) {
            console.error('儲存遊戲失敗:', error);
            this.showNotification('✗ 儲存失敗', 'error');
            return false;
        }
    }

    // 儲存當前遊戲
    saveCurrentGame(gameState) {
        if (!this.currentGameId) {
            this.currentGameId = this.generateGameId();
            localStorage.setItem(this.CURRENT_GAME_KEY, this.currentGameId);
        }
        
        if (gameState) {
            return this.saveGame(this.currentGameId, gameState);
        }
        return false;
    }

    // 載入遊戲
    loadGame(gameId) {
        try {
            const games = this.getAllGames();
            return games[gameId] || null;
        } catch (error) {
            console.error('載入遊戲失敗:', error);
            return null;
        }
    }

    // 載入當前遊戲
    loadCurrentGame() {
        if (!this.currentGameId) {
            return null;
        }
        return this.loadGame(this.currentGameId);
    }

    // 刪除遊戲
    deleteGame(gameId) {
        try {
            const games = this.getAllGames();
            delete games[gameId];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(games));
            
            // 如果刪除的是當前遊戲，清除當前ID
            if (gameId === this.currentGameId) {
                this.currentGameId = null;
                localStorage.removeItem(this.CURRENT_GAME_KEY);
            }
            
            this.showNotification('✓ 遊戲已刪除', 'success');
            return true;
        } catch (error) {
            console.error('刪除遊戲失敗:', error);
            return false;
        }
    }

    // 創建新遊戲
    createNewGame() {
        this.currentGameId = this.generateGameId();
        localStorage.setItem(this.CURRENT_GAME_KEY, this.currentGameId);
        return this.currentGameId;
    }

    // 切換到指定遊戲
    switchToGame(gameId) {
        this.currentGameId = gameId;
        localStorage.setItem(this.CURRENT_GAME_KEY, gameId);
    }

    // 取得遊戲列表（用於顯示）
    getGamesList() {
        const games = this.getAllGames();
        return Object.values(games).sort((a, b) => {
            return new Date(b.lastModified) - new Date(a.lastModified);
        });
    }

    // 開始自動儲存
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            // 這裡會由主程式呼叫 saveCurrentGame
            const event = new CustomEvent('autosave-trigger');
            window.dispatchEvent(event);
        }, this.AUTO_SAVE_INTERVAL);
    }

    // 停止自動儲存
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // 匯出遊戲為JSON
    exportGameAsJSON(gameId) {
        const game = this.loadGame(gameId);
        if (!game) return null;
        
        const dataStr = JSON.stringify(game, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        return {
            blob: dataBlob,
            filename: `baseball_game_${gameId}_${new Date().toISOString().slice(0, 10)}.json`
        };
    }

    // 從JSON匯入遊戲
    importGameFromJSON(jsonString) {
        try {
            const gameData = JSON.parse(jsonString);
            const newGameId = this.generateGameId();
            
            // 重置一些自動生成的欄位
            delete gameData.id;
            delete gameData.lastModified;
            
            return this.saveGame(newGameId, gameData) ? newGameId : null;
        } catch (error) {
            console.error('匯入遊戲失敗:', error);
            this.showNotification('✗ 匯入失敗：格式錯誤', 'error');
            return null;
        }
    }

    // 取得儲存空間使用情況
    getStorageInfo() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const sizeInBytes = new Blob([data || '']).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            const gameCount = Object.keys(this.getAllGames()).length;
            
            return {
                sizeInKB,
                gameCount,
                available: sizeInKB < 5000 // LocalStorage 通常有 5-10MB 限制
            };
        } catch (error) {
            return { sizeInKB: 0, gameCount: 0, available: true };
        }
    }

    // 顯示通知
    showNotification(message, type = 'info') {
        // 創建或更新通知元素
        let notification = document.getElementById('game-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'game-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px;
                word-wrap: break-word;
            `;
            document.body.appendChild(notification);
        }

        // 設定顏色
        const colors = {
            success: { bg: '#10b981', text: '#fff' },
            error: { bg: '#ef4444', text: '#fff' },
            warning: { bg: '#f59e0b', text: '#fff' },
            info: { bg: '#3b82f6', text: '#fff' }
        };
        
        const color = colors[type] || colors.info;
        notification.style.backgroundColor = color.bg;
        notification.style.color = color.text;
        notification.textContent = message;
        notification.style.display = 'block';

        // 3秒後自動隱藏
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 3000);
    }

    // 確認對話框
    showConfirmDialog(message, onConfirm, onCancel) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.2s ease;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #2a2a2a;
                padding: 24px;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                animation: scaleIn 0.3s ease;
            `;

            dialog.innerHTML = `
                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #fff;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        background: #444;
                        color: #fff;
                        min-width: 80px;
                    ">取消</button>
                    <button id="confirm-btn" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        background: #ef4444;
                        color: #fff;
                        font-weight: 500;
                        min-width: 80px;
                    ">確定</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const confirmBtn = dialog.querySelector('#confirm-btn');
            const cancelBtn = dialog.querySelector('#cancel-btn');

            const cleanup = () => {
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 200);
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                if (onConfirm) onConfirm();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                if (onCancel) onCancel();
                resolve(false);
            });

            // ESC 鍵取消
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    if (onCancel) onCancel();
                    resolve(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }
}

// 添加動畫 CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes scaleIn {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// 匯出為全域變數
window.GameManager = GameManager;
