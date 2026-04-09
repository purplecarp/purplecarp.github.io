# 物理模擬生成指引 (Physics Simulation Generation Prompt)

此文件為生成 agent 的參考規範，建立新模擬前請完整閱讀。

---

## 專案概覽

**網站**：purplecarp.github.io — 高中物理教學個人網站  
**目的**：製作互動式物理模擬，供台灣高中學生（選修物理 I~III）自學與課堂使用  
**語言**：繁體中文介面，程式碼以英文撰寫  
**技術**：純 HTML + CSS + JavaScript（Canvas 2D API），不使用框架

---

## 目錄結構

```
purplecarp.github.io/
├── index.html
├── physics-simulations.html      ← 模擬列表頁，新增模擬後需在此加入連結
├── css/
│   ├── simulations.css           ← 所有模擬共用的樣式（必須引用）
│   ├── style.css
│   └── ...
├── simulations/
│   ├── template/
│   │   ├── index.html            ← HTML 結構模板
│   │   └── SIMULATION_PROMPT.md  ← 本文件
│   ├── spring-shm/index.html     ← 範例：最完整的模擬，請參考其架構
│   ├── uniform-acceleration/index.html
│   ├── water-wave-interference/index.html
│   ├── ripple-tank/index.html
│   └── charged-particle-magnetic-field/index.html
```

**每個新模擬**放在 `simulations/<英文名稱>/index.html`，路徑使用小寫連字號。

---

## HTML `<head>` 標準結構

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="utf-8">
    <title>[模擬名稱] - 物理模擬</title>
    <meta content="IE=edge" http-equiv="X-UA-Compatible">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <link href="../../images/fish.png" rel="shortcut icon">

    <link href="../../css/bootstrap.min.css" rel="stylesheet">
    <link href="../../css/normalize.css" rel="stylesheet">
    <link href="../../css/style.css" rel="stylesheet">
    <link href="../../css/responsive.css" rel="stylesheet">
    <link href="../../css/simulations.css" rel="stylesheet">

    <link href='https://fonts.googleapis.com/css?family=Roboto+Slab:400,700' rel='stylesheet' type='text/css'>
    <link href='https://fonts.googleapis.com/css?family=Roboto:400,300,500,700' rel='stylesheet' type='text/css'>

    <!-- 若有數學公式，加入 KaTeX -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
        onload="renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]});"></script>

    <!-- 若需要額外 CSS，放在 <style> 內 -->
    <style>
        /* 頁面專屬樣式 */
    </style>
</head>
```

---

## 頁面 Layout 規範

### 版型：`sim-layout`（控制面板右側，模擬區左側）

```html
<div class="sim-layout">
    <!-- 右側控制面板（寬度固定約 280px） -->
    <div class="sim-layout-left">
        <div class="controls">
            <div class="control-section">
                <h3>⚙️ 參數控制</h3>
                <!-- 滑桿 -->
                <div class="control-row">
                    <label>參數名稱 單位</label>
                    <input type="range" id="xxxSlider" min="0" max="100" step="1" value="50">
                    <span class="value-display" id="xxxValue">50</span>
                </div>
                <!-- 勾選框 -->
                <div class="control-row">
                    <label>選項名稱</label>
                    <input type="checkbox" id="xxxToggle" checked>
                </div>
            </div>
        </div>
        <!-- 控制按鈕 -->
        <div class="button-group">
            <button class="btn btn-start" id="startBtn">▶ 開始模擬</button>
            <button class="btn btn-pause" id="pauseBtn">⏸ 暫停</button>
            <button class="btn btn-reset" id="resetBtn">🔄 重置</button>
        </div>
    </div>

    <!-- 左側模擬區域 -->
    <div class="sim-layout-right">
        <div class="simulation-section">
            <div class="canvas-wrapper">
                <canvas id="simCanvas" width="900" height="480"></canvas>
            </div>
            <!-- 若需要 x-t / v-t / a-t 圖 -->
            <div class="graphs-container">
                <div class="graph-box">
                    <h5>x-t 圖</h5>
                    <canvas id="xtCanvas" width="280" height="200"></canvas>
                </div>
                <!-- ... -->
            </div>
        </div>
    </div>
</div>
```

> **注意**：`sim-layout-left` 是右側控制面板，`sim-layout-right` 是左側模擬區（CSS 以 flex-direction 反轉）。

---

## JavaScript 類別結構

### 標準模板

```javascript
class MySimulation {
    constructor() {
        // 1. 取得畫布
        this.simCanvas = document.getElementById('simCanvas');
        this.simCtx = this.simCanvas.getContext('2d');
        // （若有多個畫布，逐一取得）

        // 2. 高 DPI 縮放（必須）
        this.dpr = window.devicePixelRatio || 1;
        this.scaleCanvas(this.simCanvas, this.simCtx);
        // 每個畫布都要 scaleCanvas

        // 3. 物理參數初始值
        this.param1 = 10;
        this.param2 = 5.0;

        // 4. 模擬狀態
        this.isRunning = false;
        this.time = 0;
        this.animationId = null;
        this.lastTimestamp = null;
        this.history = [];

        this.init();
    }

    // 高 DPI 縮放（必須實作）
    scaleCanvas(canvas, ctx) {
        const dpr = this.dpr;
        const cssW = canvas.width, cssH = canvas.height;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.scale(dpr, dpr);
    }

    init() {
        this.bindControls();
        this.reset();
    }

    bindControls() {
        // 滑桿
        document.getElementById('param1Slider').addEventListener('input', (e) => {
            this.param1 = parseFloat(e.target.value);
            document.getElementById('param1Value').textContent = this.param1.toFixed(1);
            this.reset(); // 參數改變後立即重置
        });
        // 按鈕
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTimestamp = null;
        this.animationId = requestAnimationFrame((ts) => this.loop(ts));
    }

    pause() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.pause();
        this.time = 0;
        this.history = [];
        this.draw();
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        if (this.lastTimestamp !== null) {
            const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
            this.time += dt * this.playbackSpeed;
            this.history.push({ t: this.time, /* 其他數據 */ });
        }
        this.lastTimestamp = timestamp;
        this.draw();
        this.animationId = requestAnimationFrame((ts) => this.loop(ts));
    }

    draw() {
        // 使用 canvas.width / this.dpr 取得 CSS 邏輯尺寸
        const W = this.simCanvas.width / this.dpr;
        const H = this.simCanvas.height / this.dpr;
        const ctx = this.simCtx;
        ctx.clearRect(0, 0, W, H);
        // ... 繪圖邏輯
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new MySimulation();
});
```

---

## 高 DPI 縮放規則（重要）

- 每個 `<canvas>` 都**必須**呼叫 `scaleCanvas(canvas, ctx)`
- 繪圖方法中取尺寸時一律用 `canvas.width / this.dpr`，不直接用 `canvas.width`
- 若有 `imageData` / `putImageData`（像素操作），應建立**離屏畫布**保持 CSS 像素尺寸，再用 `ctx.drawImage()` 縮放到主畫布

```javascript
// 離屏畫布範例（用於 imageData 像素操作）
this.offscreenCanvas = document.createElement('canvas');
this.offscreenCanvas.width = cssW;   // CSS 像素尺寸
this.offscreenCanvas.height = cssH;
this.offscreenCtx = this.offscreenCanvas.getContext('2d');
this.imageData = this.offscreenCtx.createImageData(cssW, cssH);
// 繪圖後：
this.offscreenCtx.putImageData(this.imageData, 0, 0);
this.ctx.drawImage(this.offscreenCanvas, 0, 0, cssW, cssH); // 縮放到主畫布
```

---

## 數學公式顯示

使用 **KaTeX**，語法：
- 行內公式：`$...$`（例：`質量 $m$ 的物體`）
- 獨立公式：`$$...$$`（例：`$$F = ma$$`）
- 分數：`\dfrac{分子}{分母}`
- 平方根：`\sqrt{...}`
- 向量：`\mathbf{F}`
- 垂直符號：`\perp`

物理原理說明區標準寫法：
```html
<div class="info-box physics-principle">
    <h4>📚 物理原理與公式</h4>
    <p>
        • <strong>概念名稱：</strong>說明文字，含行內公式 $x = A\cos(\omega t)$<br>
        • <strong>重要公式：</strong>$T = 2\pi\sqrt{\dfrac{m}{k}}$<br>
    </p>
</div>
```

---

## 畫布繪圖風格慣例

| 用途 | 顏色 |
|------|------|
| 背景（主模擬） | `#0d1117` |
| 背景（圖表） | `#0a0a1a` |
| 位移 x | 淡藍 `#74c0fc` |
| 速度 v | 淡綠 `#69db7c` |
| 加速度 a | 橘黃 `#f39c12` |
| 力 F（箭頭） | 紫色 `#a855f7` |
| 圓周速度箭頭 | 紅色 `#e74c3c` |
| 向心加速度箭頭 | 橘色 `#f39c12` |
| 軌跡點 | 同對應物理量顏色，帶透明度漸變 |
| 文字主色 | `#ecf0f1` |
| 網格線 | `#1a2a3a` |

### 即時數據面板（畫在 canvas 底部橫欄）

```javascript
// 在主畫布底部繪製數據橫欄
const barH = 36;
const barY = H - barH;
ctx.fillStyle = 'rgba(10,10,26,0.85)';
ctx.fillRect(0, barY, W, barH);
// 各數據項均分排列
const items = [
    { label: 'ω', value: omega.toFixed(2), unit: 'rad/s' },
    { label: 'T', value: period.toFixed(2), unit: 's' },
    // ...
];
```

---

## 參數控制行為

- **任何滑桿改變後，立即呼叫 `this.reset()`**（不論模擬是否正在執行）
- 不要有 `if (!this.isRunning)` 來防止重置，讓使用者隨時能調整參數

---

## 軌跡系統（選用）

若需要顯示運動軌跡：
```javascript
// 初始化
this.trailPoints = [];
this.trailInterval = 0.05; // 每 0.05s 記錄一點
this.lastTrailTime = -1;
this.maxTrailPoints = 120; // 最多保留 120 點

// 每幀更新中記錄
if (this.time - this.lastTrailTime >= this.trailInterval) {
    this.trailPoints.push({ x: currentX, y: currentY });
    if (this.trailPoints.length > this.maxTrailPoints) this.trailPoints.shift();
    this.lastTrailTime = this.time;
}

// 繪製（帶淡化效果）
this.trailPoints.forEach((pt, i) => {
    const age = i / this.trailPoints.length; // 0 = 最舊, 1 = 最新
    const alpha = 0.05 + 0.7 * age;
    const r = 1.2 + 1.8 * age;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
});
ctx.globalAlpha = 1;
```

---

## 更新 physics-simulations.html

每新增一個模擬，在 `physics-simulations.html` 的對應章節加入連結。在開發者工具或搜尋對應的 `<li>` 或分類 section 後插入：

```html
<a href="simulations/<資料夾名>/index.html" class="simulation-link">🔬 模擬標題</a>
```

---

## 生成新模擬的工作清單

1. [ ] 讀取 `simulations/template/index.html` 作為 HTML 骨架起點
2. [ ] 讀取 `simulations/spring-shm/index.html` 作為最完整的 JS 架構參考
3. [ ] 建立 `simulations/<英文名稱>/index.html`
4. [ ] `<head>` 包含所有標準 CSS 連結；若有公式加入 KaTeX
5. [ ] 物理原理說明用 KaTeX 格式撰寫公式
6. [ ] 使用 `sim-layout` 版型（控制面板在右側的 `sim-layout-left`）
7. [ ] JavaScript 類別實作 `scaleCanvas` 高 DPI 縮放
8. [ ] 所有繪圖方法的尺寸讀取用 `canvas.width / this.dpr`
9. [ ] 任何滑桿調整皆呼叫 `this.reset()` 重置模擬
10. [ ] 在 `physics-simulations.html` 加入連結
