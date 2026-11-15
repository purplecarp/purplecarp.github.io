// 線性回歸計算
let regressionChartInstance = null;
let currentRegressionData = null;
let dataRowCount = 0;

// 初始化表格
document.addEventListener('DOMContentLoaded', function() {
  // 添加初始數據行
  for (let i = 0; i < 5; i++) {
    addDataRow();
  }
});

// 新增數據行
function addDataRow(xValue = '', yValue = '') {
  dataRowCount++;
  const tbody = document.getElementById('dataTableBody');
  const row = document.createElement('tr');
  row.id = `dataRow${dataRowCount}`;
  row.innerHTML = `
    <td>${dataRowCount}</td>
    <td><input type="number" step="any" value="${xValue}" oninput="onDataChange()" placeholder="輸入 X"></td>
    <td><input type="number" step="any" value="${yValue}" oninput="onDataChange()" placeholder="輸入 Y"></td>
    <td><button class="delete-row-btn" onclick="deleteDataRow('dataRow${dataRowCount}')">×</button></td>
  `;
  tbody.appendChild(row);
}

// 刪除數據行
function deleteDataRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    updateRowNumbers();
    onDataChange();
  }
}

// 更新行號
function updateRowNumbers() {
  const rows = document.querySelectorAll('#dataTableBody tr');
  rows.forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
}

// 填入範例數據
function fillSampleData() {
  clearAllData();
  const sampleData = [
    [1, 2.1],
    [2, 4.2],
    [3, 5.9],
    [4, 8.1],
    [5, 10.2]
  ];
  sampleData.forEach(([x, y]) => addDataRow(x, y));
  onDataChange();
}

// 快速輸入數據
function quickInput() {
  const n = prompt('請輸入數據點數目：', '5');
  if (!n || isNaN(n) || parseInt(n) < 1) {
    if (n !== null) alert('請輸入有效的數據點數目！');
    return;
  }

  const count = parseInt(n);
  if (count > REGRESSION_MAX_POINTS) {
    alert(`數據點過多（${count}），為避免瀏覽器記憶體不足，請減少到 ${REGRESSION_MAX_POINTS} 以下。`);
    return;
  }
  const data = [];

  for (let i = 1; i <= count; i++) {
    const x = prompt(`請輸入 X${i}：`, '');
    if (x === null) return; // 用戶取消

    const y = prompt(`請輸入 Y${i}：`, '');
    if (y === null) return; // 用戶取消

    data.push({ x: x, y: y });
  }

  // 清空現有數據
  clearAllData();

  // 添加新數據
  data.forEach(point => {
    addDataRow(point.x, point.y);
  });

  alert(`成功輸入 ${count} 個數據點！`);

  // 如果開啟自動更新，則自動計算
  if (document.getElementById('autoUpdate').checked) {
    calculateRegression();
  }
}

// 下載CSV檔案
function downloadCSV() {
  const { xData, yData } = getTableData();
  if (xData.length === 0) {
    alert('請先輸入數據！');
    return;
  }

  // 建立CSV內容
  let csvContent = 'X,Y\n';
  for (let i = 0; i < xData.length; i++) {
    csvContent += `${xData[i]},${yData[i]}\n`;
  }

  // 建立下載連結
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `regression_data_${new Date().getTime()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 釋放 ObjectURL，避免大量下載造成記憶體累積
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 清除所有數據
function clearAllData() {
  document.getElementById('dataTableBody').innerHTML = '';
  dataRowCount = 0;
  if (regressionChartInstance) {
    regressionChartInstance.destroy();
    regressionChartInstance = null;
  }
  document.getElementById('regressionChart').style.display = 'none';
  document.getElementById('regressionResult').style.display = 'none';
}

// 從表格獲取數據
function getTableData() {
  const rows = document.querySelectorAll('#dataTableBody tr');
  const xData = [];
  const yData = [];

  rows.forEach(row => {
    const xInput = row.cells[1].querySelector('input');
    const yInput = row.cells[2].querySelector('input');
    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);

    if (!isNaN(x) && !isNaN(y)) {
      xData.push(x);
      yData.push(y);
    }
  });

  return { xData, yData };
}

// 數據變更時的處理
function onDataChange() {
  const autoUpdate = document.getElementById('autoUpdate').checked;
  if (autoUpdate) {
    scheduleRegressionCalculation();
  }
}

// 防止輸入時每個字元都重繪圖表造成效能/記憶體壓力
const REGRESSION_DEBOUNCE_MS = 250;
const REGRESSION_MAX_POINTS = 5000;
let regressionUpdateTimer = null;

function scheduleRegressionCalculation() {
  if (regressionUpdateTimer) {
    clearTimeout(regressionUpdateTimer);
  }
  regressionUpdateTimer = setTimeout(() => {
    calculateRegression({ silent: true });
  }, REGRESSION_DEBOUNCE_MS);
}

// 切換控制面板
function toggleSection(sectionId) {
  const content = document.getElementById(sectionId);
  const icon = document.getElementById(sectionId + 'Icon');
  if (content.classList.contains('active')) {
    content.classList.remove('active');
    icon.textContent = '\u25bc';
  } else {
    content.classList.add('active');
    icon.textContent = '\u25b2';
  }
}

function calculateRegression(options = {}) {
  const silent = options && options.silent === true;
  const { xData, yData } = getTableData();

  if (xData.length === 0 || yData.length === 0) {
    if (!silent) alert('請至少輸入一組有效的 X 和 Y 數據！');
    return;
  }

  if (xData.length < 2) {
    if (!silent) alert('需要至少兩個數據點才能進行線性回歸！');
    return;
  }

  if (xData.length > REGRESSION_MAX_POINTS) {
    if (!silent) alert(`數據點過多（${xData.length}），為避免瀏覽器記憶體不足，請減少到 ${REGRESSION_MAX_POINTS} 以下再計算。`);
    return;
  }

  const n = xData.length;
  const sumX = xData.reduce((sum, val) => sum + val, 0);
  const sumY = yData.reduce((sum, val) => sum + val, 0);
  const sumXY = xData.reduce((sum, val, i) => sum + val * yData[i], 0);
  const sumX2 = xData.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = yData.reduce((sum, val) => sum + val * val, 0);

  // 計算平均值
  const meanX = sumX / n;
  const meanY = sumY / n;

  // 計算母體標準差
  const varianceX = xData.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / n;
  const varianceY = yData.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / n;
  const stdDevX = Math.sqrt(varianceX);
  const stdDevY = Math.sqrt(varianceY);

  // 計算斜率和截距
  const delta = (n * sumX2 - sumX * sumX);
  if (!isFinite(delta) || Math.abs(delta) < 1e-12) {
    if (!silent) alert('無法進行線性回歸：所有 X 值太接近或相同，導致 Δ 接近 0。');
    return;
  }
  const slope = (n * sumXY - sumX * sumY) / delta;
  const intercept = (sumY * sumX2 - sumXY * sumX) / delta;

  // 計算殘差平方和
  const yPred = xData.map(x => slope * x + intercept);
  const residuals = yData.map((y, i) => y - yPred[i]);
  const ssr = residuals.reduce((sum, r) => sum + r * r, 0);

  // 計算斜率和截距的不確定度
  const sigma2 = ssr / (n - 2);
  const sigmaSlope = Math.sqrt((n * sigma2) / delta);
  const sigmaIntercept = Math.sqrt((sigma2 * sumX2) / delta);

  // 計算相關係數
  const sst = yData.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  let r2;
  if (!isFinite(sst) || Math.abs(sst) < 1e-12) {
    // y 全部相同時 sst = 0，避免 NaN
    r2 = (Math.abs(ssr) < 1e-12) ? 1 : 0;
  } else {
    r2 = 1 - (ssr / sst);
  }
  r2 = Math.max(0, Math.min(1, r2));
  const r = Math.sqrt(r2) * (slope > 0 ? 1 : -1);

  // 保存當前數據供更新圖表使用
  currentRegressionData = {
    xData, yData, slope, intercept, r, r2, n
  };

  // 取得小數點位數設定
  const decimalPlaces = parseInt(document.getElementById('regressionDecimalPlaces').value) || 6;

  const output = `
    <div class="result-item"><strong>數據點數 (n)：</strong>${n}</div>
    <div class="result-item" style="font-size: 16px; color: #818181; font-weight: bold; margin-top: 10px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;"><strong>回歸方程式：</strong>y = (${slope.toFixed(decimalPlaces)} ± ${sigmaSlope.toFixed(decimalPlaces)})x + (${intercept.toFixed(decimalPlaces)} ± ${sigmaIntercept.toFixed(decimalPlaces)})</div>
    <div class="result-item"><strong>斜率 (b)：</strong>${slope.toFixed(decimalPlaces)} ± ${sigmaSlope.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>截距 (a)：</strong>${intercept.toFixed(decimalPlaces)} ± ${sigmaIntercept.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>相關係數 (r)：</strong>${r.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>決定係數 (R²)：</strong>${r2.toFixed(decimalPlaces)}</div>
    <div class="result-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;"><strong>x總和 (Σx)：</strong>${sumX.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>y總和 (Σy)：</strong>${sumY.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>x平方總和 (Σx²)：</strong>${sumX2.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>y平方總和 (Σy²)：</strong>${sumY2.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>xy總和 (Σxy)：</strong>${sumXY.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>x母體標準差 (σx)：</strong>${stdDevX.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>y母體標準差 (σy)：</strong>${stdDevY.toFixed(decimalPlaces)}</div>
  `;

  document.getElementById('regressionOutput').innerHTML = output;
  document.getElementById('regressionResult').style.display = 'block';

  // 顯示圖表
  document.getElementById('regressionChart').style.display = 'block';
  drawRegressionChart();
}

function drawRegressionChart() {
  if (!currentRegressionData) return;

  const { xData, yData, slope, intercept } = currentRegressionData;

  // 生成回歸直線的點
  // 避免大量資料時使用展開運算子造成記憶體/呼叫堆疊壓力
  const minX = xData.reduce((min, v) => (v < min ? v : min), xData[0]);
  const maxX = xData.reduce((max, v) => (v > max ? v : max), xData[0]);
  const lineX = [minX, maxX];
  const lineY = lineX.map(x => slope * x + intercept);

  const ctx = document.getElementById('regressionCanvas');

  function buildRegressionChartConfig() {
    // 獲取控制值
    const chartTitle = document.getElementById('chartTitle').value;
    const xAxisLabel = document.getElementById('xAxisLabel').value;
    const yAxisLabel = document.getElementById('yAxisLabel').value;

    const titleFontSize = parseInt(document.getElementById('titleFontSize').value) || 18;
    const titleFontWeight = document.getElementById('titleFontWeight').value;
    const axisLabelFontSize = parseInt(document.getElementById('axisLabelFontSize').value) || 14;
    const axisTickFontSize = parseInt(document.getElementById('axisTickFontSize').value) || 12;

    const showXGrid = document.getElementById('showXGrid').checked;
    const showYGrid = document.getElementById('showYGrid').checked;
    const showXMinorGrid = document.getElementById('showXMinorGrid').checked;
    const showYMinorGrid = document.getElementById('showYMinorGrid').checked;

    const xAxisStep = parseFloat(document.getElementById('xAxisStep').value) || undefined;
    const yAxisStep = parseFloat(document.getElementById('yAxisStep').value) || undefined;
    const xMinorTicks = parseInt(document.getElementById('xMinorTicks').value) || 5;
    const yMinorTicks = parseInt(document.getElementById('yMinorTicks').value) || 5;

    const pointRadius = parseInt(document.getElementById('pointRadius').value) || 6;
    const pointStyle = document.getElementById('pointStyle').value;
    const pointColor = document.getElementById('pointColor').value;
    const pointBorderWidth = parseInt(document.getElementById('pointBorderWidth').value) || 2;

    const showRegressionLine = document.getElementById('showRegressionLine').checked;
    const lineWidth = parseInt(document.getElementById('lineWidth').value) || 2;
    const lineStyle = document.getElementById('lineStyle').value;
    const lineColor = document.getElementById('lineColor').value;

    // 設定線條樣式
    let borderDash = [];
    if (lineStyle === 'dashed') {
      borderDash = [10, 5];
    } else if (lineStyle === 'dotted') {
      borderDash = [2, 3];
    }

    // 準備數據集
    const datasets = [
      {
        label: '實驗數據',
        data: xData.map((x, i) => ({ x: x, y: yData[i] })),
        backgroundColor: pointColor,
        borderColor: pointColor,
        pointRadius: pointRadius,
        pointHoverRadius: pointRadius + 2,
        pointStyle: pointStyle,
        borderWidth: pointBorderWidth
      }
    ];

    if (showRegressionLine) {
      datasets.push({
        label: `回歸直線: y = ${slope.toFixed(4)}x ${intercept >= 0 ? '+' : ''} ${intercept.toFixed(4)}`,
        data: lineX.map((x, i) => ({ x: x, y: lineY[i] })),
        type: 'line',
        borderColor: lineColor,
        backgroundColor: lineColor + '20',
        borderWidth: lineWidth,
        borderDash: borderDash,
        pointRadius: 0,
        fill: false
      });
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      normalized: true,
      plugins: {
        title: {
          display: true,
          text: chartTitle,
          font: {
            size: titleFontSize,
            weight: titleFontWeight
          }
        },
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xAxisLabel,
            font: {
              size: axisLabelFontSize,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: axisTickFontSize
            },
            stepSize: xAxisStep,
            autoSkip: false,
            callback: function(value, index, ticks) {
              const tick = ticks && ticks[index];
              if (tick && tick.major === false) return '';
              return Number(value).toFixed(2);
            }
          },
          afterBuildTicks: function(axis) {
            if (!(showXMinorGrid && xMinorTicks > 0)) return;

            const min = axis.min;
            const max = axis.max;
            if (!isFinite(min) || !isFinite(max) || max <= min) return;

            const majorStep = xAxisStep || (max - min) / 5;
            if (!isFinite(majorStep) || majorStep <= 0) return;

            const minorStep = majorStep / (xMinorTicks + 1);
            if (!isFinite(minorStep) || minorStep <= 0) return;

            const maxTicks = 2000;
            const ticks = [];
            let current = Math.floor(min / minorStep) * minorStep;
            let safety = 0;
            const end = max + minorStep / 2;

            while (current <= end && safety < maxTicks) {
              const normalized = Math.abs((current - min) % majorStep);
              const isMajor = normalized < 1e-8 || normalized > majorStep - 1e-8;
              ticks.push({ value: current, major: isMajor });
              current += minorStep;
              safety++;
            }

            if (safety < maxTicks) {
              axis.ticks = ticks;
            }
          },
          grid: {
            display: true,
            drawTicks: true,
            color: function(context) {
              if (!context.tick) return 'rgba(0, 0, 0, 0.1)';
              if (showXMinorGrid && context.tick.major === false) {
                return 'rgba(0, 0, 0, 0.05)';
              }
              if (showXGrid && context.tick.major !== false) {
                return 'rgba(0, 0, 0, 0.1)';
              }
              return 'transparent';
            },
            lineWidth: function(context) {
              if (!context.tick) return 1;
              if (showXMinorGrid && context.tick.major === false) {
                return 0.5;
              }
              return 1;
            }
          }
        },
        y: {
          title: {
            display: true,
            text: yAxisLabel,
            font: {
              size: axisLabelFontSize,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: axisTickFontSize
            },
            stepSize: yAxisStep,
            autoSkip: false,
            callback: function(value, index, ticks) {
              const tick = ticks && ticks[index];
              if (tick && tick.major === false) return '';
              return Number(value).toFixed(2);
            }
          },
          afterBuildTicks: function(axis) {
            if (!(showYMinorGrid && yMinorTicks > 0)) return;

            const min = axis.min;
            const max = axis.max;
            if (!isFinite(min) || !isFinite(max) || max <= min) return;

            const majorStep = yAxisStep || (max - min) / 5;
            if (!isFinite(majorStep) || majorStep <= 0) return;

            const minorStep = majorStep / (yMinorTicks + 1);
            if (!isFinite(minorStep) || minorStep <= 0) return;

            const maxTicks = 2000;
            const ticks = [];
            let current = Math.floor(min / minorStep) * minorStep;
            let safety = 0;
            const end = max + minorStep / 2;

            while (current <= end && safety < maxTicks) {
              const normalized = Math.abs((current - min) % majorStep);
              const isMajor = normalized < 1e-8 || normalized > majorStep - 1e-8;
              ticks.push({ value: current, major: isMajor });
              current += minorStep;
              safety++;
            }

            if (safety < maxTicks) {
              axis.ticks = ticks;
            }
          },
          grid: {
            display: true,
            drawTicks: true,
            color: function(context) {
              if (!context.tick) return 'rgba(0, 0, 0, 0.1)';
              if (showYMinorGrid && context.tick.major === false) {
                return 'rgba(0, 0, 0, 0.05)';
              }
              if (showYGrid && context.tick.major !== false) {
                return 'rgba(0, 0, 0, 0.1)';
              }
              return 'transparent';
            },
            lineWidth: function(context) {
              if (!context.tick) return 1;
              if (showYMinorGrid && context.tick.major === false) {
                return 0.5;
              }
              return 1;
            }
          }
        }
      }
    };

    return {
      type: 'scatter',
      data: { datasets: datasets },
      options: options
    };
  }

  const config = buildRegressionChartConfig();
  if (!regressionChartInstance) {
    regressionChartInstance = new Chart(ctx, config);
  } else {
    regressionChartInstance.data = config.data;
    regressionChartInstance.options = config.options;
    regressionChartInstance.update();
  }
}

// 控制面板連續調整時避免高頻重繪
const CHART_DEBOUNCE_MS = 100;
let chartUpdateTimer = null;

function updateChart() {
  if (!currentRegressionData) return;
  if (chartUpdateTimer) {
    clearTimeout(chartUpdateTimer);
  }
  chartUpdateTimer = setTimeout(() => {
    drawRegressionChart();
  }, CHART_DEBOUNCE_MS);
}

// 下載圖表
function downloadChart() {
  if (!regressionChartInstance) {
    alert('請先繪製圖表！');
    return;
  }

  const canvas = document.getElementById('regressionCanvas');
  const backgroundType = document.getElementById('downloadBackground').value;

  if (backgroundType === 'white') {
    // 創建一個新的 canvas 並填充白色背景
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // 填充白色背景
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 將原始 canvas 繪製到新 canvas 上
    tempCtx.drawImage(canvas, 0, 0);

    const url = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = '線性回歸分析圖_白底.png';
    link.href = url;
    link.click();
  } else {
    // 透明背景
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = '線性回歸分析圖_透明.png';
    link.href = url;
    link.click();
  }
}
