# 棒球比賽紀錄 APP

手機可安裝的棒球記分 PWA。TypeScript + Vite。

## 線上使用

部署到 GitHub Pages 後，用手機瀏覽器打開網址即可，並可加入主畫面當成 APP 使用。

## 本機開發

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 產出 dist/
```

## 部署

推送到 `main` 分支後，`.github/workflows/deploy.yml` 會自動建置並發布到 GitHub Pages。
需先在 repo 的 Settings → Pages → Source 選擇 **GitHub Actions**。

## 功能

- 打席記錄、比分板、壘包狀態、投打數據
- 壘間事件、球員調度
- 自動儲存、多場比賽管理、操作確認（第一階段，尚未完整驗證）
- 匯出比賽紀錄

## 測試

```bash
npm test
```

`tests/` 內的測試涵蓋曾經實際出過問題的情境，例如：

- 套用名單不依賴表單原生送出（沙箱環境會阻擋）
- 上傳照片觸發的重繪不可覆蓋尚未套用的輸入
- 天氣等新欄位在舊存檔缺漏時能自動補值

推送到 GitHub 後會在建置階段自動執行，**測試未通過就不會部署**。
新增功能時建議一併補上對應測試。
