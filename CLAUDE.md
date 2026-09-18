# 棒球比賽記錄 APP — 專案規則（給 Claude Code）

單一頁面的 PWA，用手機在場邊記錄棒球比賽。所有回覆與程式內註解一律**繁體中文**。

回覆要**用白話講**：使用者不是工程師，少用專有名詞。非提不可時，先用一句人話說它是什麼、會影響什麼，再講名字。報告結果講「做了什麼、結果如何、還有什麼要決定」就好。

## 指令
```bash
npm install                 # 第一次
npm run build               # Vite 建置到 dist/（測試跑的是 dist/，改完一定要先 build）
npm test                    # 317+ 項回歸測試（jsdom），約 3 分鐘
npm run build:preview       # 產生單檔預覽 HTML 到 preview/（會先自動 build）
```
交付前必須：`npm run build && npm test` 全綠。每修一個 bug 就在 `tests/` 加一條釘住它的測試，套件名稱在 `tests/run.mjs` 註冊。

**每次交付都要把版號往上加**：`index.tsx` 最上面的 `APP_VERSION`（顯示在主頁標題「棒球比賽紀錄」右邊的 `#app-version`）。小改動加最後一碼，大改版加前面那一碼。

## 檔案結構
- `index.tsx`（主程式，單一 IIFE）、`index.css`、`mobile.css`（手機／直向覆寫）、`index.html`
- `public/*.js`：不經 Vite 打包的全域腳本 — `game-manager.js`（多場比賽／自動儲存）、`game-list-ui.js`、`game-helpers.js`、`game-integration.js`、`official-sheet.js`（正式記錄表，另開視窗列印）、`service-worker.js`
- `public/img/stadium-night.webp`（1000×1777）：**整個 APP 的底圖**（首頁與三個內頁共用同一張，換圖只要換這個檔）；`public/img/batter-default.jpg`（330×440）：主頁打者卡沒照片時的卡通小打者（名單頁仍用背號頭像）。兩張都在 service worker 的離線清單裡，預覽檔也會內嵌。
- `public/img/logo.webp`（760×710）：Diamond Log 的 LOGO，放在首頁；`public/icon-192.png`／`icon-512.png` 是加到主畫面的 APP 圖示（iOS 不吃透明背景，所以配深藍底）。
- `public/img/field.png`（412×402）：主頁球場圖，也給球員調度的守位圖用。本壘 (202,341)、一壘 (275,272)、二壘 (202,198)、三壘 (127,271)。主球場 SVG viewBox 為 `18 -35 370 425`（上方多 60 單位是全壘打區）。
- `tests/harness.mjs`：jsdom 開機、`click`、`clickZone(w, 'infield'|'outfield'|'foul'|'deepcf')` 等工具。

## 資料模型要點
- `gameState.teams[a|b].roster[30]`：每位球員一個物件，**統計數據跟著物件走**。前 9 個是先發打序（roster 索引＝棒次），索引 29 是 DH 制的先發投手，其餘板凳（預設空白，`name === ''` 代表沒這個人）。
- `lineupSpots[i] = { order, activePlayerId, history[], subInfo{playerId: 'PH'|'PR'|守位} }`：打序格。**開賽後不可重建**（`saveLineup` 只在開賽前重建），替補一律走 `processSubstitution`。
- 球員 `abResults` 是 `打席結果@守備鏈~球種#局數`，例如 `滾地@游一#3`、`雙殺@中游~F#5`。**絕不能讓多個球員共用同一個陣列**（曾發生過：用 `player[key] = defaultPlayer[key]` 複製統計時把陣列參考共用，導致下一棒繼承上一棒成績；已有 `ensureOwnStatArrays` 防線與回歸測試）。
- `events[]`：`{ text, teamKey, bases[3], outs }`，`bases/outs` 是**該打者上場打擊時（事件發生前）**的狀況，由 `snapshotSituation()` 在處理前拍下。

## 記錄規則（已實作，不要改壞）
- **記錄一個打席的入口只有一個：本壘上的打者半身像**（`#mf-batter`，圖示＋姓名，只在開賽後顯示）。下面那排快捷鍵（`#quick-plays`）已經拿掉。點打者跳出「打席選單」：沒打到的是三振／四壞／觸身／其他（選完直接記完），打出去的先選球種（滾地球／平飛球／高飛球／短打），另有「不確定，直接標落點」與「取消」。
- 選完球種：選單收起來、球場解鎖、上面出現提示條（`#field-hint`，附「取消」），**同時把打者鎖住**（`.mf-batter.locked`，`pointer-events:none`）避免標落點時誤觸。`awaitingPoint` 這個旗標是關鍵：`canMarkField` 只有在它為 true 時才收落點，否則球場的 `pointerdown` 會把打者那一下點擊吃掉（踩過一次，已有回歸測試）。`awaitingPoint` 與 `renderFieldBatter` 都放在外層，因為 `renderGameStateDisplay` 每次重繪都要叫（放進內層會直接壞掉，也有測試釘住）。
- 落點：整片球場一個點擊區，內野／外野／界外由幾何判斷（`zoneOfPoint`）。標好落點才列結果（`ZONE_PLAYS.field` 每個結果標了 `balls`，依球種過濾）；結果選單裡有「← 回上一步」（`.frp-back`）回到打席選單，會把紅點一起清掉；不管有沒有挑球種都要有這顆。選過的球種會自動帶進雙殺／三殺的 `ballType`，不必再挑一次。測試的 `clickZone(w, zone, ball)` 會幫你走完「開選單→選球種→標落點」，`ball` 預設 `'all'`（＝不確定，直接標落點），要測球種過濾再傳 `'G'`／`'L'`／`'F'`／`'B'`，傳 `null` 則只開選單；只想標落點用 `markPoint(w, zone)`，只想開選單用 `openAtBatMenu(w)`，沒打到的結果用 `quickPlay(w, '三振')`。**可以按住拖曳**：`pointerdown` 就標出紅點並跟著手指走，`pointerup` 才跳出結果選單（沒有 pointer 事件的環境仍走 click）。球場上任何一點都能標，只有壘上跑者人像例外（那是代跑）。結果選單會蓋住球場，所以標題旁放了一張小球場（`.frp-map`）標出剛才的落點，選單最高 78vh，比球場高就往上長（蓋到上面幾列沒關係），確保一次看完。
- 打者卡對應的球員先前打席的落點畫在球場上（`#mf-ghosts`，取 `player.hitPoints` 最後 3 筆，用 `miniPointToMain` 換算回主球場座標），最後一筆是黃色。點了落點之後的視窗不再顯示球場小圖。結果選項依落點分成「先顯示」與「其他結果」（`ZONE_PLAYS` 的 `zones`）：對得上的先列，其餘收起來但仍按得到。
- **進階視窗的「返回」一次只退一步**：`advancedPlayState.stepStack` 記著走過的步驟
  （往前走一律用 `advGoStep(next)`，會先把現在這一步推進去），返回就 `pop()` 回去。
  **不能用「這個結果理論上的上一步」去推**：`startAdvancedPlay` 會跳過用不到的步驟
  （壘上無人的安打直接到確認畫面），硬推就會跳到使用者根本沒看過的「是否有失誤發生?」（踩過一次）。
  退回去之前要把那一步做過的事清掉（野手選擇的出局跑者、從「是否有失誤」進來時選到一半的失誤）。
- **堆疊空了代表已經在第一步**，再按「返回」就 `backFromAdvanced()` 離開視窗：
  從球場落點進來的回落點結果選單（`lastFieldPick` 記著落點／區域／球種，回去時把紅點放回球場、
  `showResultOptions` 重開選單）；走「其他」那條路進來的才回結果分類頁（`showModalStep('step2')`）。
  以前一律回分類頁，但那條路沒填過內容，會變成一個只剩「返回」的空視窗、整個卡住（也踩過一次）。
  三條路都有測試釘住。
- 記錄比賽各視窗的**說明文字不要小於 0.82rem**（使用者要求，場邊看得清楚）：
  落點選單標題與分組標籤、視窗裡的 `em`／`small`／`.picker-note`／`.sub-note`，規則在 `theme.css` 最後面。
- 守備鏈 `fielders[]`：第一個接球，之後依序傳給誰；自動帶入的鏈一經手動點擊就從頭重建；同一人可重複（3-6-3）。代碼用 1–9。
- 夾殺 `rundown`：`null` 時自動判斷「鏈裡有人重複」才算夾殺；單向接力（8-9-4-2）不是夾殺。
- 雙殺／三殺有球種 `ballType`：G 滾地（傳殺、算 GIDP）、L 平飛／F 高飛（接殺後傳殺離壘跑者、不算 GIDP）。
- 責失分：`inningPotentialOuts`（失誤視為本該出局，滿 3 後的分數全部非責失）；暴投算責失、捕逸不算；靠失誤上壘或多進壘的跑者 `isUnearned`。
- 打點：靠失誤多進壘（超過安打正常壘數）的得分**不給打點**；打者自己得分只有全壘打給打點。
- 安打後衝過頭被觸殺：安打照算、打者出局（`batterDestination.outAdvancing`）。
- 一個 play 可有多次失誤：`errors[]`，守方失誤數依筆數累計。
- 犧飛必須有人得分，否則擋下完成；完成鍵在打者無去向、步驟未完成、出局數超過半局剩餘時都要鎖住。
- DH 關閉：先發投手接替 DH 的棒次，原 DH 進板凳第一個空位（`benchedDHId`）；重新開啟時叫回同一人。
- 離場球員不能再上場（`benchOf` 會排除 history 與 pitchers 裡的人）。

## 記錄規則補充（規則依據）
- 妨礙守備要先選「是誰妨礙」：打者妨礙＝打者出局；**跑者被界內球打到＝跑者出局、打者上一壘並記一壘安打**（官方規則 5.09(b)(7) 球成死球、打者獲一壘；記錄規則 9.05(a)(5) 未經野手碰觸的界內球觸及跑者，打者記安打）。
- 妨礙跑壘要選是哪一位野手（進階視窗的「加上妨礙跑壘」與壘間事件都會問），敘述會寫成「過程中游擊手妨礙跑壘」。
- 野手選擇、失誤上壘的打者也可能「趁傳進壘被觸殺」，選項與安打一樣要出現。
- 計分板上只有**正在進行的那個半局的那一格**有灰色反白（進攻方那一列、當局那一欄，`td.inning-now`，就是原本那個淡灰底）；同一欄另一隊的格子不要反白，隊名欄與 R 欄也不要。換半局時反白跟著換到另一列。
- 有得分的事件在敘述下面附一行比分小標（`.ev-score`，隊名用各自隊色）；小標是獨立元素，不算進敘述文字。

## 即時事件敘述格式
兩行：第一行 `第N棒 守位 姓名`（`batterTitle`），第二行敘述。範例：
- 「二壘方向滾地球，二壘手傳給一壘手封殺出局。 1人出局。」（**句首不寫「擊出」**）
- 「左外野二壘安打，上到二壘，靠左外野手失誤回本壘得分。」
- 「中外野高飛球，被中外野手接殺出局。 在三壘的○○ 接殺後回本壘，被中外野手傳給捕手觸殺出局。 2人出局。」
- 「在三壘與本壘之間被夾殺出局」
規則：句首不寫「擊出」；雙殺／三殺的跑者句**不寫「被傳殺出局」**（前面已經說「形成雙殺／三殺」了），只寫「離壘過遠回壘不及」「接殺後起跑進壘」「接殺後衝本壘」；四壞／觸身寫「四壞保送」「觸身球保送」（不寫「獲得」）；野手選擇寫「選擇傳二壘」（不寫「傳向」）；滾地球不寫「接殺」（接殺只用於飛球）；跑者句在前、打點句在後、「N人出局」最後；失誤已寫進「靠○○失誤」就不再另補一句「○○發生失誤」；壘間事件寫明從哪個壘出發（「二壘跑者○○推進到三壘」）。用全形標點。
**敘述不附守備代號**（不寫「（4-3）」）：`chainTail()` 一律回傳空字串；代號仍留給記錄當下的提示（「已選：二→一（4-3）」）與正式記錄表用。局數列與「比賽開始。」走 `.ev-inning`，字級放大加粗。

## 介面規則
- 手機優先（iPhone 393×852，動態島 59px 用 `env(safe-area-inset-*)`），三面板：名單頁／主頁／事件頁，**只用底部的文字分頁切換**（名單／比賽／紀錄，仍是 `.nav-dot`）。左右滑動換頁已移除，因為會跟球場上「按住拖曳標落點」搶手勢。每頁各自有底色（深夜藍），滑動時背景會跟著頁面一起移動，不要用固定在螢幕上的背景。表格（打擊、投手、戰況表）可橫向捲動，手指在表格上時面板手勢要讓路。
- 打者卡右邊原本的 NEXT（接下來兩位打者）已移除，那一格改放 **OUT／局數／計時**（`#status-bar`，上排局數置中、下排左 OUT 右計時）。格子很窄，計時的時鐘圖示要關掉，否則會被切到。
- 上方資訊列（依使用者提供的示意圖）：三顆藥丸——球場（圖示＋可輸入，右邊箭頭列出用過的球場，存在 `baseball_stadium_history`）／日期（左右箭頭前後一天，中間顯示「2026年9月11日 (五)」，真正的 `input[type=date]` 透明疊在上面點了叫日曆）／天氣。局數依 `data-half` 顯示 ▲／▼。
- 主頁最上面是標題列（`.stadium-toolbar`：⚾＋「棒球比賽紀錄」＋版號），**點一下回首頁**（`#home-btn`）。LOGO 縮到 30px 會糊成一團，所以這裡維持 ⚾。夜景照是**整個畫面的底圖**（`#stadium-bg-layer`，放在 `#app-container` 外面、`position:fixed`，左右滑頁時不會跟著動），上面蓋一層深色漸層紗保持字的清晰度；三個頁面本身都是透明的。全壘打區 `.mf-wall-area` 設成透明讓底圖透出來。
- 主頁高度很緊：改版面後用 playwright 量一次，最下排按鈕底部要跟換頁列留至少 6px。
- 球場上的疊層（`#bases-container` 裡的 PLAY BALL、`#field-result-panel` 落點結果、開賽前壓暗的 `.pregame::after`）靠 `index.css` 原本的 position 與 z-index 互相疊。**不要在主題檔裡改它們的 position，也不要另外給 z-index**：改 position 會讓 PLAY BALL 掉到球場下面不見，加 z-index 會多開一層堆疊、讓 PLAY BALL 被壓暗那層蓋住。已有回歸測試釘住。
- 主頁：計分板全顯示；球場滿版；開賽前球場壓暗、PLAY BALL 黃色膠囊；開賽後計時在右上、局數標籤置中。打者卡片只放打者資訊。
- 手機打字（中文輸入法）：選字途中不可以重建欄位（`scheduleAutoApply` 遇到 `compositionstart` 會先跳過，`compositionend` 才套用），否則正在打的字會不見、焦點也會跑掉；輸入結束（`focusout`）後會把畫面捲回頂端並重設面板位移，避免鍵盤把畫面推上去之後回不來。
- 名單頁：預設名稱「客隊球員01～10／主隊球員01～10」，板凳預設空白、「＋新增板凳球員」揭開一列、往右滑刪除；自動儲存（無套用鈕）；守位互換（A 改成 B 的守位，B 換成 A 的舊守位）；投手守位固定 P；比賽中鎖住拖曳。
- 比賽中換人：球員調度視窗上方「代打」「換投」「代跑」（標籤要寫出是哪一隊；代跑壘上無人時鎖住，超過一位跑者會先選要換誰）。**主頁的跑者人像不吃點擊**（標落點時會誤觸），守位圖（用主頁球場圖＋半身人像）點兩個守位互換或板凳籌碼→守位。守位圖的名字只取後 4 字，一、三壘與投手、DH 的名字放圖示下面（`DEF_LABEL_DY`），其餘放上面，靠邊的改變對齊方向，避免名字互相重疊或被切掉。
- 可點的東西一律至少 44×44（底部換頁、分頁標籤、隊伍顏色同理）。**例外**：最上面那排球場／日期／天氣壓到 36 高、底部換頁列壓到 30 高（都是使用者要求）。手機端有一條「按鈕至少 44 高」的規則，這幾個地方要自己寫 `min-height:0` 蓋掉，否則整排會被撐高。按不動的按鈕要寫原因（例：「壘間事件（壘上無人）」）。復原不在事件列表留下任何一行。
- 事件頁分頁：即時事件、戰況表，以及兩隊各一頁（標籤直接用隊名），每隊那頁同時放該隊的打擊與投球成績；主標「事件及記錄」，下方「匯出紀錄／正式記錄表」並排。成績表的姓名欄鎖在左邊、寬度固定（`--name-col`），其餘欄位左右滑，捲軸隱藏。
- 球員照片一律**方形**（打者卡 44×44、名單頁跟著同比例），圓角 6–8。
- 沒上傳照片的球員用背號當頭像（`playerPhotoSrc`／`jerseyAvatar`）；產生的頭像帶 `data-avatar="jersey"` 記號，讀回 gameState 前會用 `isGeneratedAvatar` 還原成預設值，不會被當成上傳的照片。照片右上角有移除鍵（`.image-remove-btn`），只在真的上傳過照片時出現（`.player-photo-container.has-photo`），按了就還原成預設、背號頭像自己回來。
- 點擊回饋：`mobile.css` 關掉了 iOS 預設的灰色點擊框，所以按鈕要自己給回饋——一律 `:active` 變亮，記錄流程的大按鈕再加 `scale(0.95)`；點球場時落點標記播 `mf-mark-pop` 擴散動畫；`tapFeedback()` 會試著震動（Android 有效，iPhone 的 Safari 不支援）。動畫都要尊重 `prefers-reduced-motion`。
- 計時器**一開始就顯示**（停在 00:00），按了 PLAY BALL 才開始跑；開賽前點它不會叫出選單。開賽後可點：叫出「暫停／繼續」與「結束計時」（`pausedMs`／`pausedAt` 記錄暫停時間）。**「結束計時」＝比賽結束**，按下去會先用 `confirm` 問一次，確定後才停錶並 `endGame()`。
- 正式記錄表暫時只顯示與「匯出紀錄」相同的內容，在 APP 內開視窗，不另開新視窗。

## 啟動畫面（v2.22）
- **每次開 APP 都停在只有 LOGO 的那一頁**（`#onboard-screen` 的第 0 步，`showOnboard(0)`），
  不管有沒有進行中的比賽。`restartApp()` 也回到這裡。
- 按鈕依狀態換（`renderLaunchButtons()`）：
  - 還沒建過球隊 → 只有「創建球隊」（`#ob-start`），文案「歡迎！先建立你的球隊⋯」。
  - 建過球隊 → 「進入」（`#ob-enter`，進主畫面首頁）＋「我的球隊」（`#ob-team`，直接跳球隊分頁），
    文案是「〈球隊全名〉　要做什麼？」。
  - 另外有沒打完的比賽（`canContinue()`）→ 中間多一顆「繼續比賽」（`#ob-resume`，亮橘），
    副標寫比分與局數，按了 `enterGameView()` 直接回比賽。
- 收起按鈕靠 `.ob-launch.hidden, #ob-start.hidden { display:none }`（這個專案沒有共用的 `.hidden`）。
- `restartApp()`（清除全部資料／還原備份）除了叫出歡迎頁，**一定要先 `hideShell()`**，
  否則五分頁主畫面會留在下面，兩層內容疊在一起糊成一片（踩過一次，已有測試釘住）。
- LOGO 的高度：第 0 步時 `#onboard-screen` 會帶上 `launch` 記號，`.ob-inner` 改成 `margin:0 auto` ＋ `padding-top:10vh`，
  LOGO 就落在畫面上緣約兩成的位置（使用者指定）。建立球隊那兩步是長表單，不加這個記號。
- 版號（`#ob-version`）釘在歡迎頁最下面（`.ob-ver` 用 `position:fixed`，因為 `#onboard-screen` 本身就是 fixed），
  跟主畫面首頁的 `#shell-version` 同一個值。**只在第 0 步顯示**（靠 `#onboard-screen.launch .ob-ver`）：
  建立球隊那兩步是會捲動的長表單，版號浮著會蓋住名單與按鈕（踩過一次，已有測試釘住）。
- 上面那張圖（`.ob-logo`）：**填了球隊 LOGO 之後，下一頁（球員名單，第 2 步）就換成球隊自己的**，
  沒填就一直用 APP 的（`syncOnboardLogo(step)`，`gotoOnboardStep` 每次都叫）。
  APP LOGO 的網址第一次進來時記在 `appLogoSrc`，**不能寫死 `./img/logo.webp`**（預覽檔會換成內嵌圖）。
  換成球隊 LOGO 時加 `.is-team`：球隊圖不一定是方的，所以框成正方形、`object-fit:contain` 不裁切。
- 建立球隊最後一顆鍵寫「完成，進入球隊頁面」，按了 `closeLaunch()` ＋ `showShell('team')`（不是首頁）。
- 「比賽進行中」那個綠點標記（`.live-badge`）原本是 `position:absolute`（首頁那張卡用的），
  放進 `#ob-resume` 一定要給按鈕 `position:relative` 並把標記改回 `position:static`，
  否則它會飄到整個畫面的左上角（踩過一次，已有測試釘住）。

## 畫面轉場（v2.27）
- **一律淡出淡入，不做放大縮小**（使用者指定）。規則都在 `theme.css` 最後面。
- **出現**：純 CSS。這個專案的東西一律靠 `display:none` 收起來，所以只要在「看得到」的狀態
  （`:not(.hidden)`／`:not(.modal-hidden)`）掛 `animation: dl-fade-in`，元素一顯示就會自己播一次。
  涵蓋整片畫面（歡迎頁／五分頁主畫面／回比賽的 `#app-container`）、分頁與子頁、
  **歡迎頁的每一步 `.ob-step`**（按「創建球隊」換下一步也要淡入）、所有視窗、
  視窗裡換步驟、以及 `#field-result-panel > *`（打席選單換內容）。
- **消失**：只靠 CSS 做不到（東西一藏起來就不存在了），走 `index.tsx` 的 `hideWithFade(el, 收起來的class)`：
  立刻加上收起來的記號（功能上就是關了，其他邏輯與測試看到的都是關閉狀態），
  同時加 `dl-leaving` 讓 CSS 用 `display:flex !important` 把它多留 0.22 秒播 `dl-fade-out`，
  時間到 JS 再把 `dl-leaving` 拿掉。淡出期間 `pointer-events:none`，免得按到正在消失的畫面。
  `closeLaunch`／`hideShell`／`closeAsk`／`closeModal` 都走這個。
- **淡入不要加 fill-mode**（`forwards`／`both`）：萬一動畫沒跑，畫面要停在正常樣子，不能整片不見。
  淡出那一條可以用 `forwards`，因為 0.22 秒後 JS 一定會把記號拿掉。
- 每一條都要進 `@media (prefers-reduced-motion: reduce)`：淡入 `animation:none`，
  正在淡出的直接 `display:none !important` 讓它立刻消失。

## 我的球隊與五分頁主畫面（v2.0 改版，進行中）
- **第一次使用只有「創建球隊」**（`#onboard-screen`，三步：簡介 → 球員 → 完成）。
  簡介＝全名（≤15）、簡稱（≤5，記分板顯示這個）、LOGO、代表色；成立時間自動記當天。
  沒填名字的球員一律用「簡稱＋兩位數」（`memberName`）。
- 球隊資料存在 `baseball_my_team`：`{ id, fullName, shortName, logo, color, foundedAt, players[], lineups[] }`。
  `players` 是全部球員（不分先發替補）；`lineups` 是常用陣容 `{ id, name, useDH, spots[9], pitcherId }`。
  **刪球員時要把陣容裡指到他的格子一起清掉**，否則會指向不存在的人（已有測試）。
- `#main-shell` 是五分頁主畫面（首頁／球隊／比賽／成績／設定），疊在 APP 上面，
  `z-index: 90`、`body.shell-open` 會把 `#app-container` 藏起來——規則與舊的首頁相同，兩條都有測試釘住。
- 設定存在 `baseball_settings`：語言、比賽局數、延長上限、預設 DH、點擊震動；另有備份／還原／清除全部資料。
- **建立比賽是三步**（`#page-game`）：比賽資訊（日期／時間／球場／天氣／對手隊名／我方先攻或後攻）
  → 對手名單（預設十列＝九棒＋投手，沒填名字用「對手01」；存進 `baseball_opponents`，下次可帶入）
  → 我方先發（從常用陣容帶入，改了不會動到常用陣容；關掉 DH 時第九棒就是投手）。
  `buildTeamState()` 把資料鋪成計分引擎要的格式：先發九人放 roster[0..8]、投手放 roster[24]（DH 關掉時改用 roster[8]），
  其餘的人依序進板凳（跳過 24）。**我方先攻＝客隊 a，後攻＝主隊 b。**
- **比賽中是獨立畫面**（`body.playing`）：底部分頁全部藏起來，球場因此高出約 60px。
  紀錄改成從下面滑出（`body.sheet-open`），面板就是原本那個 `#event-log-container` 用 CSS 換位置，
  所以即時事件／戰況表／兩隊成績全部照舊、事件也不用搬 DOM。
  **`body.playing` 一定要把 `#app-container` 的 transform 關掉**，否則裡面 `position:fixed` 的面板
  會以它為基準，滑出來的位置整個跑掉（已有測試釘住）。
- 「紀錄」鍵放在標題列裡（`.stadium-toolbar` 改成容器，左邊 `.brand-btn` 回主畫面、右邊 `#game-log-btn`）。
  放到標題列外面會多吃一整列、球場少 38px。
- **絕對不要用 `location.reload()`**：預覽檔是把整個 APP 塞在 iframe 裡（`doc.write`），
  重新整理那個 iframe 會得到一張空白文件，畫面整片變白而且回不去。踩過一次（點比賽紀錄整片變白）。
  讀取比賽走 `adoptSavedGame()`、清除／還原資料走 `restartApp()`，都是就地重來；
  `game-helpers.js` 的 `loadGameState` 也改接到 `window.__adoptSavedGame`。已有測試釘住（主程式不得出現 `location.reload`）。
- 自動儲存原本是 `extractGameStateFromDOM()`「從畫面反推比賽狀態」，存進比賽紀錄的東西不完整。
  改成用 `window.__getGameState()` 直接讀真正的存檔；建立比賽與按 PLAY BALL 時另外 `pushToGameList()` 立刻寫入，
  不用等自動儲存那 10 秒。
- 點標題列回主畫面一律停在**首頁**（留在「比賽」分頁會看到已經用過的建立流程，首頁的紀錄列表也會被藏住）。
- **同時只能有一場比賽**：比賽進行中時「比賽」分頁整個壓暗鎖住（`#page-game.is-busy`），
  改顯示 `#gs-busy` 提醒並給「回到目前的比賽」。要開新的得先用計時器的「結束計時」結束目前這場。
- 首頁的「繼續比賽」用 `.home-live`（亮橘＋跳動的「比賽進行中」標記），要一眼看得到。
  顯示條件是 `canContinue()`＝沒結束且（開過賽 或 有 `createdAt`）；**不能用「名單有沒有名字」判斷**，
  預設狀態本來就有假名字。按下去一律 `enterGameView()`，卡片看得到就一定進得去。
- 版號（`#shell-version`）放在**首頁最下面**（不是 LOGO 旁邊，使用者要求，跟歡迎頁一致）：
  `#page-home { min-height:100% }` 先撐滿看得到的高度，`.shell-ver { margin: auto 0 0 }` 再把它推到底。
- 首頁的比賽紀錄**只列已經結束的比賽**（還沒打完的那場由「繼續比賽」負責，兩邊都出現會讓人以為有兩場），
  每一列右邊有刪除鍵。
- 常用陣容關掉 DH 要把「先發投手」那一列收起來並換說明文字，否則按了畫面沒變化，看起來像壞掉。
- 子頁（球員／常用陣容）改完回球隊分頁要 `renderTeamPage()`，人數與陣容套數才會即時更新。
- **不要用系統的 `confirm()`／`alert()`**：在內嵌（iframe）環境會被擋掉，而且不報錯，
  按了完全沒反應——刪除常用陣容、結束計時都踩過。改用 `askConfirm(text, onYes, yesLabel)`（`#ask-modal`）。
- **DH 不要用勾選框**：太小、按了看不出有沒有切換到。用兩顆按鈕（`.dh-pick` / `.dh-btn[data-dh]`），
  常用陣容與建立比賽都是。切到「投手打擊」時收起先發投手那一列（第九棒就是投手）。
- 球員名單只放頭像（正方形）／背號／姓名（約 5 字寬），**不放守位**；守位排在常用陣容與先發名單裡
  （`lu.positions[9]`／`gsLineup.positions`），`buildTeamState` 從那裡取。
  沒填名字的顯示「簡稱＋背號」（`memberName`，沒背號才退回棒次）。
- Home 指示條：使用者要求只留 15，所以 `--sab: min(env(safe-area-inset-bottom), 15px)`。
- **還沒做**：成績分頁；英文／日文版（工程很大，見下）。

## 多語言（還沒做）
- 使用者要英文版與日文版，而且要用當地的棒球術語。難處不在介面文字，在**即時事件敘述是動態組出來的**
  （`generateEventText` 那一整套：守備鏈、跑者句、打點句、失誤句⋯⋯數百個片語），
  三種語言的語序完全不同，不是換字典就能解決。
- 建議分兩段：先做介面文字（分頁、按鈕、設定、建立流程），敘述先維持中文；
  之後再把敘述抽成各語言自己的產生器。

## 舊的首頁（啟動畫面，已被 #main-shell 取代）
- `#home-screen`：大 LOGO ＋ 四塊（繼續比賽／開始新比賽／比賽紀錄／我的球隊）。
  沒有進行中的比賽時，最大那顆直接變成「開始新比賽」，重複的那張收起來。
- ~~有比賽進行中就直接進比賽~~ → **v2.22 起改成「開啟 APP 一律停在啟動畫面」**（使用者要求，見下）。
- `z-index: 90`：要蓋過換頁列（50），但**一定要低於視窗**（遮罩 100、球員選擇 1000、比賽列表 9999），
  否則從首頁叫出來的「我的球隊」會被首頁整片蓋住（踩過一次）。
- 首頁不自己畫底色，吃底下那張球場照；但球場照在最底層、APP 內容在它上面，
  所以 `body.home-open` 要一併把 `#app-container` 藏起來（用 `visibility`，別用 `display`），
  不然比賽頁會從薄紗後面透出來（也踩過一次）。兩件事都有測試釘住。
- 「我的球隊」沿用既有的儲存名單（`savedBaseballRosters`）：從首頁進來時每一隊給
  「載入客隊／載入主隊」兩顆、視窗標題是「我的球隊」；從名單頁進來仍然只有一顆「載入」。

## 多場比賽（`public/game-manager.js`／`game-list-ui.js`）
- **最多留 10 場**（`MAX_GAMES`）：存檔時 `trimToLimit` 會把最舊的丟掉，正在記錄的那一場一定保留。
- **正在記錄的比賽不能刪**：列表上那張卡的刪除鍵鎖住、寫「使用中」，`deleteGame` 兩邊都擋（以前刪得掉，刪完 `currentGameId` 被清空、畫面整個空掉）。已有回歸測試（`tests/games.test.mjs`）。

## 重播引擎（修改前面某一筆打席的基礎）
- 每個會改變比賽狀態的動作都會記成一張「紙條」存進 `playLog`：`play`（快捷結果）、`adv`（球場落點那一整套）、`runner`（壘間事件）、`sub`（換人）、`swap`（守位互換）、`dh`（DH 開關）。起點是 PLAY BALL 當下的 `startSnapshot`（拿掉照片，省記憶體）。
- `rebuildFromLog()` 從起點照紙條重算一次，**重播中 `saveState`／`render`／`saveStateForUndo` 都會自動跳過**。重播是叫原本那幾個記錄函式跑一次（設好 `advancedPlayState`／`runnerActionState` 再呼叫），所以記分邏輯只有一份，不會有兩套規則。
- 每記一筆就在下一個事件圈自動對帳一次（`verifyReplay`），對不上會在 console 留警告並記在 `__replay.lastCheck()`。測試可用 `window.__replay`（log/rebuild/verify/digest/lastCheck）。
- 紙條跟著比賽一起存進 `baseballGameState.replay`（`{start, log}`），關掉 APP 再打開仍能修改；記憶體裡兩者分開放，`saveState` 時才合併，這樣「上一動」的備份不用複製整疊紙條。存檔空間不足時會先犧牲紙條保住比賽本身。舊存檔沒有這一段就是不能改前面的打席（不會出錯）。
- 壓力測試：`node tools/replay-stress.mjs preview/xxx-預覽檔.html`（隨機打完一場再比對）。
- **修改／刪除前面某一筆**：事件列表每一行右邊有很淡的 `✎`（`.ev-edit`，鉛筆用 CSS `::after` 畫，不進 `textContent`，否則事件敘述的測試會被干擾；感應範圍用 `::before` 補到 44）。點了跳出 `#event-edit-modal`：
  - 刪除 → 抽掉那張紙條、整場重算（`adoptRebuilt`）。
  - 重記 → 退回那一筆之前（`startEntryEdit`），主頁出現 `#edit-mode-bar`（排在主頁最上面，不能做成浮動的，會蓋住快捷鍵），記完一筆後自動把後面的接回去（`finishEntryEdit`）。
  - 復原（`gameStateHistory`）現在同時記住狀態與紙條，修改與刪除都退得回去。
  - 新加的視窗要自己寫遮罩樣式（`position:fixed;inset:0`），不然會直接排在頁面最下面看不到。

## 交付習慣
- **每改完一次就更新預覽，等使用者說 OK 才上線**：跑 `npm run build:preview`，把 `preview/*-device.html`（iPhone 外框版）發布到同一個預覽網址（`Artifact` 工具，url 固定用 https://claude.ai/code/artifact/32d5482a-fe7a-462b-bfdb-ec40da09613d ，先 read 再 publish），再附幾張截圖。得到「可以上線」才合併進 `main`（推 `main` 會自動部署到 GitHub Pages）。平常只推工作分支。
- 合併上線之後**要立刻 `git checkout` 回工作分支**：留在 `main` 上的話，下一批修改會直接提交到 `main`，等於繞過「先給預覽再上線」的規矩（已經發生過兩次，都是事後把 commit 搬回工作分支、`main` 退回 origin 才修正）。
- 安全區寫成變數：`theme.css` 的 `:root` 定義 `--sat/--sab/--sal/--sar`（預設值就是 `env(safe-area-inset-*)`），
  所有地方一律用 `var(--sat)`，**不要直接寫 `env()`**。這樣機身外框版的預覽只要覆蓋這四個變數就能模擬實機，
  新畫面也自動涵蓋。以前預覽只畫紅色參考線、`env()` 讀到 0，看起來永遠貼著邊，等於驗不到（踩過一次）。
- **這個專案沒有共用的 `.hidden` 規則**，每個要收起來的東西都得自己寫一條（例如 `.home-card.hidden`）。
  v2.0 改版時 `.home-card` 那一組被連同舊首頁刪掉，卡片因此收不起來也沒有排版，已加測試釘住。
- 量版面要量兩種情況：一般 Safari（`env()` 為 0）和加到主畫面（動態島上 62、下 34，用機身外框版量）。球場高度已改成吃剩餘空間，頁面下緣留 `max(74px, 安全區+68px)` 給換頁列。
- 外觀調整走 `theme.css`（排在 `index.css`、`mobile.css` 之後，只改長相不動功能）；要退回舊樣子就拿掉 `index.html` 裡那行連結。成績表的圓角要加在外層 `.table-scroll`，加在 `table` 上會讓鎖住的姓名欄失效。
- 完整 zip 之外，另出「只含變動檔案」的 zip 與清單（使用者手動覆蓋 GitHub）。
- 預覽檔（單檔 HTML）用 `npm run build:preview` 產生（`tools/build-preview.mjs`），要內嵌字型／球場圖，並帶版本戳記：新版本開啟即為新比賽（清 `baseballGameState`、`baseball_current_game_id`，保留名單）。輸出兩份到 `preview/`：完整單檔，以及拆掉最外層 `<html>／<head>／<body>` 的嵌入版。
  - 兩個踩過的坑：取代內容一律用函式（壓縮後的 JS 含 `$&`，當字串取代會被吃掉）；拆骨架只能從檔頭、檔尾、`</head>\n<body>` 交界下刀（`official-sheet.js` 的列印樣板字串裡也有這些標籤）。
  - `xlsx` 仍走 cdnjs，預覽檔要有網路才能匯出；Service Worker 與 manifest 在預覽檔中拿掉，所以不能「加到主畫面」離線用。
- 改功能要快：先跑受影響的測試套件，最後才跑整套。
