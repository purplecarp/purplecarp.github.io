// 不確定度計算與統計
function calculateUncertainty() {
  const dataText = document.getElementById('uncertaintyData').value;
  const data = dataText.split('\n')
    .map(line => parseFloat(line.trim()))
    .filter(num => !isNaN(num));

  if (data.length === 0) {
    alert('請輸入有效的數據！');
    return;
  }

  const minScale = parseFloat(document.getElementById('minScale').value) || 0.1;
  const decimalPlaces = parseInt(document.getElementById('decimalPlaces').value) || 2;

  // 排序數據用於計算中位數和最大最小值
  const sortedData = [...data].sort((a, b) => a - b);

  const n = data.length;
  const sum = data.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const min = sortedData[0];
  const max = sortedData[n - 1];
  const range = max - min;

  // 計算中位數
  let median;
  if (n % 2 === 0) {
    median = (sortedData[n/2 - 1] + sortedData[n/2]) / 2;
  } else {
    median = sortedData[Math.floor(n/2)];
  }

  // 樣本標準差（除以 n-1，貝塞爾校正）
  const sampleVariance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const sampleStdDev = Math.sqrt(sampleVariance);

  // 母體標準差（除以 n）
  const populationVariance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const populationStdDev = Math.sqrt(populationVariance);

  const stdError = sampleStdDev / Math.sqrt(n);

  // 計算儀器不確定度（最小刻度的一半）
  const instrumentUncertainty = minScale / 2;

  // A類不確定度（統計不確定度）
  const typeAUncertainty = stdError;

  // B類不確定度（儀器不確定度）
  const typeBUncertainty = instrumentUncertainty / Math.sqrt(3);

  // 總不確定度
  const totalUncertainty = Math.sqrt(typeAUncertainty * typeAUncertainty + typeBUncertainty * typeBUncertainty);

  const output = `
    <h4 style="margin-top: 0; color: #333;">基本統計量</h4>
    <div class="result-item"><strong>數據個數 (n)：</strong>${n}</div>
    <div class="result-item"><strong>總和：</strong>${sum.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>平均值 (x̄)：</strong>${mean.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>中位數：</strong>${median.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>最小值：</strong>${min.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>最大值：</strong>${max.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>全距：</strong>${range.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>樣本變異數 (s²)：</strong>${sampleVariance.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>樣本標準差 (s)：</strong>${sampleStdDev.toFixed(decimalPlaces)} <span style="color: #666; font-size: 12px;">(除以 n-1)</span></div>
    <div class="result-item"><strong>母體標準差 (σ)：</strong>${populationStdDev.toFixed(decimalPlaces)} <span style="color: #666; font-size: 12px;">(除以 n)</span></div>
    <div class="result-item"><strong>標準誤差 (SE)：</strong>${stdError.toFixed(decimalPlaces)}</div>
    <div class="result-item" style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #818181;"><h4 style="margin: 0 0 10px 0; color: #333;">不確定度分析</h4></div>
    <div class="result-item"><strong>A類不確定度 (統計)：</strong>±${typeAUncertainty.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>B類不確定度 (儀器)：</strong>±${typeBUncertainty.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>　儀器最小刻度：</strong>${minScale}</div>
    <div class="result-item"><strong>　儀器不確定度：</strong>±${instrumentUncertainty.toFixed(decimalPlaces)}</div>
    <div class="result-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;"><strong>總不確定度 (Δx)：</strong>±${totalUncertainty.toFixed(decimalPlaces)}</div>
    <div class="result-item" style="font-size: 16px; color: #818181; font-weight: bold; margin-top: 10px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;"><strong>結果表示：</strong>x = ${mean.toFixed(decimalPlaces)} ± ${totalUncertainty.toFixed(decimalPlaces)}</div>
    <div class="result-item"><strong>相對不確定度：</strong>${((totalUncertainty/mean)*100).toFixed(2)}%</div>
  `;

  document.getElementById('uncertaintyOutput').innerHTML = output;
  document.getElementById('uncertaintyResult').style.display = 'block';
}
