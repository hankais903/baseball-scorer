// 遊戲列表管理 UI
class GameListUI {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.createGameListButton();
    }

    // 創建遊戲列表按鈕
    createGameListButton() {
        const button = document.createElement('button');
        button.id = 'game-list-btn';
        button.type = 'button';
        button.textContent = '比賽記錄';
        button.style.cssText = `
            width: 100%;
            margin: 0.5rem 0;
            padding: 1rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.background = '#2563eb';
        });
        button.addEventListener('mouseout', () => {
            button.style.background = '#3b82f6';
        });
        
        button.addEventListener('click', () => {
            this.showGameList();
        });

        // 插入到「查看總表」按鈕後面
        const viewBoxScoreBtn = document.getElementById('view-box-score-btn');
        if (viewBoxScoreBtn && viewBoxScoreBtn.parentNode) {
            viewBoxScoreBtn.parentNode.insertBefore(button, viewBoxScoreBtn.nextSibling);
        }
    }

    // 創建模態框
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'game-list-modal';
        modal.className = 'modal-hidden';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #1e1e1e;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;

        content.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.3rem;">比賽記錄管理</h3>
                <button id="close-game-list" style="
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 1.5rem;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                ">&times;</button>
            </div>
            <div style="padding: 20px; overflow-y: auto; flex: 1;">
                <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="import-game-btn" style="
                        padding: 10px 16px;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 500;
                    ">📥 匯入比賽</button>
                    <button id="refresh-list-btn" style="
                        padding: 10px 16px;
                        background: #6b7280;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.9rem;
                    ">🔄 重新整理</button>
                    <div id="storage-info" style="
                        margin-left: auto;
                        padding: 10px 16px;
                        background: #374151;
                        border-radius: 6px;
                        font-size: 0.85rem;
                        color: #9ca3af;
                    "></div>
                </div>
                <input type="file" id="import-file-input" accept=".json" style="display: none;">
                <div id="game-list-container"></div>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);
        this.modal = modal;

        // 事件監聽
        modal.querySelector('#close-game-list').addEventListener('click', () => {
            this.hideGameList();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideGameList();
            }
        });

        modal.querySelector('#import-game-btn').addEventListener('click', () => {
            modal.querySelector('#import-file-input').click();
        });

        modal.querySelector('#import-file-input').addEventListener('change', (e) => {
            this.handleImportFile(e);
        });

        modal.querySelector('#refresh-list-btn').addEventListener('click', () => {
            this.refreshGameList();
        });
    }

    // 顯示遊戲列表
    showGameList() {
        this.modal.classList.remove('modal-hidden');
        this.refreshGameList();
        this.updateStorageInfo();
    }

    // 隱藏遊戲列表
    hideGameList() {
        this.modal.classList.add('modal-hidden');
    }

    // 更新儲存空間資訊
    updateStorageInfo() {
        const info = this.gameManager.getStorageInfo();
        const infoDiv = this.modal.querySelector('#storage-info');
        infoDiv.textContent = `${info.gameCount} 場比賽 · ${info.sizeInKB} KB`;
        
        if (!info.available) {
            infoDiv.style.color = '#ef4444';
            infoDiv.textContent += ' ⚠️ 空間不足';
        }
    }

    // 刷新遊戲列表
    refreshGameList() {
        const container = this.modal.querySelector('#game-list-container');
        const games = this.gameManager.getGamesList();

        if (games.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #9ca3af;">
                    <p style="font-size: 3rem; margin: 0;">⚾</p>
                    <p style="margin: 10px 0 0 0;">還沒有比賽記錄</p>
                    <p style="font-size: 0.9rem; margin: 5px 0 0 0;">開始一場新比賽吧！</p>
                </div>
            `;
            return;
        }

        container.innerHTML = games.map(game => this.createGameCard(game)).join('');

        // 綁定事件
        container.querySelectorAll('.game-card').forEach(card => {
            const gameId = card.dataset.gameId;
            
            card.querySelector('.load-game-btn').addEventListener('click', () => {
                this.loadGame(gameId);
            });

            card.querySelector('.export-game-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportGame(gameId);
            });

            card.querySelector('.delete-game-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteGame(gameId);
            });
        });
    }

    // 創建遊戲卡片
    createGameCard(game) {
        const date = new Date(game.lastModified);
        const dateStr = date.toLocaleDateString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const teamA = game.teams?.a?.name || '客隊';
        const teamB = game.teams?.b?.name || '主隊';
        const scoreA = this.calculateTotalScore(game.teams?.a?.score);
        const scoreB = this.calculateTotalScore(game.teams?.b?.score);
        const inning = game.inning || 1;
        const isTop = game.isTop !== false;
        const stadium = game.stadium || '';

        const isCurrent = game.id === this.gameManager.currentGameId;

        return `
            <div class="game-card" data-game-id="${game.id}" style="
                background: ${isCurrent ? '#1e3a5f' : '#2a2a2a'};
                border: ${isCurrent ? '2px solid #3b82f6' : '1px solid #444'};
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            ">
                ${isCurrent ? '<div style="position: absolute; top: 10px; right: 10px; background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">目前比賽</div>' : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 4px;">
                            ${teamA} <span style="color: #3b82f6; font-size: 1.3rem; margin: 0 8px;">${scoreA} - ${scoreB}</span> ${teamB}
                        </div>
                        <div style="font-size: 0.85rem; color: #9ca3af;">
                            ${inning}局${isTop ? '上' : '下'} ${stadium ? '· ' + stadium : ''}
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #444;">
                    <div style="font-size: 0.8rem; color: #6b7280;">
                        ${dateStr}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="load-game-btn" style="
                            padding: 6px 12px;
                            background: #10b981;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 0.85rem;
                            font-weight: 500;
                        ">載入</button>
                        <button class="export-game-btn" style="
                            padding: 6px 12px;
                            background: #6b7280;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 0.85rem;
                        ">匯出</button>
                        <button class="delete-game-btn" style="
                            padding: 6px 12px;
                            background: #ef4444;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 0.85rem;
                        ">刪除</button>
                    </div>
                </div>
            </div>
        `;
    }

    // 計算總分
    calculateTotalScore(scoreArray) {
        if (!scoreArray) return 0;
        return scoreArray.reduce((sum, score) => sum + (score || 0), 0);
    }

    // 載入遊戲
    loadGame(gameId) {
        this.gameManager.showConfirmDialog(
            '確定要載入這場比賽嗎？目前的比賽進度將會被覆蓋。',
            () => {
                // 觸發載入事件
                const event = new CustomEvent('load-game', { detail: { gameId } });
                window.dispatchEvent(event);
                this.hideGameList();
                this.gameManager.showNotification('✓ 比賽已載入', 'success');
            }
        );
    }

    // 匯出遊戲
    exportGame(gameId) {
        const result = this.gameManager.exportGameAsJSON(gameId);
        if (result) {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
            this.gameManager.showNotification('✓ 比賽已匯出', 'success');
        }
    }

    // 刪除遊戲
    deleteGame(gameId) {
        const isCurrent = gameId === this.gameManager.currentGameId;
        const message = isCurrent 
            ? '確定要刪除目前的比賽嗎？此操作無法復原！'
            : '確定要刪除這場比賽嗎？此操作無法復原！';

        this.gameManager.showConfirmDialog(
            message,
            () => {
                if (this.gameManager.deleteGame(gameId)) {
                    this.refreshGameList();
                    this.updateStorageInfo();
                    
                    if (isCurrent) {
                        // 觸發重置事件
                        const event = new CustomEvent('reset-game');
                        window.dispatchEvent(event);
                    }
                }
            }
        );
    }

    // 處理匯入檔案
    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const gameId = this.gameManager.importGameFromJSON(e.target.result);
                if (gameId) {
                    this.gameManager.showNotification('✓ 比賽已匯入', 'success');
                    this.refreshGameList();
                    this.updateStorageInfo();
                }
            } catch (error) {
                this.gameManager.showNotification('✗ 匯入失敗：檔案格式錯誤', 'error');
            }
        };
        reader.readAsText(file);
        
        // 清空 input，允許重複匯入同一檔案
        event.target.value = '';
    }
}

// 匯出
window.GameListUI = GameListUI;
