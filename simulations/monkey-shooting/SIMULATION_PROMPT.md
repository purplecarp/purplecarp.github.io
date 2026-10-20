# 物理模擬生成指引：平板課堂格式

適用：新建模擬、改善既有模擬及維護共用模板。
情境：老師用平板操作並鏡像投影，隨時暫停、比較、提問與重播。
優先順序：物理正確、現象清楚、觸控方便、操作一致。

## 建立新模擬

1. 閱讀本文件與 `index.html`、`model.js`、`lesson.js`。
2. 複製整個 template 到 `simulations/<小寫連字號名稱>/`。
3. 修改 HTML 的 title、h1、摘要、公式、模型限制與參考來源。
4. 在 model.js 實作純函式 `state(parameters, time)`；計算使用明確單位。
5. 在 lesson.js 設定 `new Classroom(config)` 與繪圖方法。
6. 在 `physics-simulations.html` 合適分類加上連結。

共用檔案位於 `css/classroom.css`、`js/classroom.js`。
先載入 `css/simulations.css`，再載入課堂 CSS，body 使用 `class="classroom"`。
腳本按 classroom.js → model.js → lesson.js 的順序以 defer 載入。
保持純 HTML、CSS、JavaScript、Canvas 2D，繁體中文介面，不需要 CDN 或建置工具。
不要複製過去的固定畫布尺寸、重複動畫迴圈、舊網站選單腳本。
範例可直接開啟 index.html 執行，也適用 GitHub Pages。

## config 契約

- `title`：畫布可及性名稱。
- `defaults`：所有物理、顯示參數與 `speed: 1`。
- `controls`：滑桿名稱、key、min、max、step、unit；亦支援 check 與 select。
- `display: true`：速度、軌跡、向量等顯示參數不重置時間。
- `disabled(parameters)`：例如量子化鎖定後停用自由參數。
- `normalize(parameters, changedKey)`：需要連動的參數；不要自行啟動動畫。
- `state(parameters,time)`：動畫、圖表、讀值共享的物理狀態。
- `duration(parameters)`：有限、正值的本次演示時間；不是物理停止條件時須說明。
- `step`：單步的模擬時間，預設 0.05；按鈕說明應包含單位。
- `timeUnit`：預設 s；示意時間須明確標記。
- `timeRate(parameters)`：可選，每一真實秒對應多少模擬時間；若非 1，需在頁面說明。
- `views`：一個或多個 `{label,draw(lesson,state)}`，預設只顯示主要現象。
- `metrics(parameters,state)`：2–4 組 `[名稱,格式化值,單位]`。
- `note(parameters,state)`：精簡模型與比例提示。
- `presets`：至少三組 `{label,values,question,answer}`；結論預設隱藏。
- `actions`：可選的附加操作 `{label,run(lesson),disabled(lesson)}`。

請勿在 config.controls 重複加入 speed，共用 shell 已提供速度控制。
若附加比較資料，必須保存該筆參數與單位；不同材料或條件不能混成同一條曲線。

## 格式與操作

共用 shell 已提供：播放／暫停、單步、重播、恢復預設、時間軸、圖表切換、參數收合、大字、課堂演示及全螢幕。

- 播放／暫停保留當前狀態。
- 重播保留參數，回到 t = 0 並暫停。
- 恢復預設還原參數、顯示選項與初始狀態。
- 物理參數改變後保留新值，回到起點並暫停。
- 播放速度、向量、軌跡等選項立即更新且保留時間。
- 滑桿提供加減按鈕；觸控區至少 48 × 48 CSS px。
- 重要圖中文字以 24 CSS px 起始，核心數值 32 px，並提供大字。
- 畫面保持幾何比例；資訊太多時切換圖表，不把整張大圖縮成小字。
- 全螢幕須由點擊啟用；失敗時提供演示模式並可退出。
- 橫向平板演示模式讓主畫面和操作可見，側邊參數面板可自行捲動。
- 直向演示模式使用可關閉的參數面板，避免壓縮主畫布。
- 詳細原理放在 lesson-notes 的 details 中，不擠占主現象。

## 畫布與模型

Classroom 管理 requestAnimationFrame、時間戳、單一動畫循環及背景暫停。
不要在繪圖函式或子模擬中另開 RAF。
Classroom 以 ResizeObserver 和 devicePixelRatio 重建畫布，保持狀態與 CSS 座標分離。
`lesson.width`、`lesson.height` 與繪圖座標皆為 CSS px。
不要再設定固定像素的 canvas.style.width/height，也不要重複 scale transform。

- 有解析解優先使用解析解。
- 需數值積分時，物理時間步長和畫面更新分離。
- 碰撞使用事件時間；離散碰撞前後的圖線應清楚表示跳變。
- 軌跡依模擬時間等距取樣，不按畫面幀率取樣。
- 限制軌跡與歷史數量，倒拖時間不能留下未來軌跡。
- 向量零值不畫非零長度，對照物分量使用同一比例。
- 速度、力、加速度單位不同；若分別縮放須標記，不比較不同物理量的箭頭長度。
- 圖表有物理量、單位與易讀刻度；比較維持相同尺度，變更尺度須說明。
- 原子圖與粒子示意需區別真實模型和視覺類比。

## 教學預設

三組情境依序為：基本現象、單一自變量比較、迷思或邊界情況。
每組提供預測問題、觀察目標與老師可揭示的結論。
範例的等速運動需依新主題替換，不能只改標題。

## 驗收

- 1024×768、1180×820、1366×768、768×1024 與手機尺寸無橫向溢出。
- 演示模式的主畫面、播放、重播、參數開關保持可見。
- 所有操作可用單指完成；不依賴 hover 或鍵盤。
- 暫停、繼續、單步、重播、恢復預設、時間倒拖都與讀值一致。
- 速度和顯示選項保留進度，物理參數更新回到起點。
- 旋轉、收合面板、大字與全螢幕不重置或拉伸物理圖形。
- 模型測試包含手算案例、守恆／解析關係、零值與參數極值。
- 瀏覽器無 JavaScript 例外；本機資源完整。
- 保留使用者既有改動，不自動部署。

交付時說明修改內容、物理修正與驗證結果。瀏覽器尺寸測試不能取代真實平板鏡像投影；未實測時標示「平板觸控／電視遠距可讀性待實機確認」。
