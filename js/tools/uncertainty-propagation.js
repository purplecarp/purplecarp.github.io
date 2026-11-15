// 更新不確定度傳遞輸入欄位
function updatePropagationInputs() {
  const type = document.getElementById('propagationType').value;
  let html = '';

  if (type === 'power') {
    html = `
      <div class="input-group">
        <label>A 值：</label>
        <input type="number" id="propA" step="any">
      </div>
      <div class="input-group">
        <label>A 的不確定度 (ΔA)：</label>
        <input type="number" id="propDeltaA" step="any">
      </div>
      <div class="input-group">
        <label>冪次 (n)：</label>
        <input type="number" id="propN" step="any">
      </div>
    `;
  } else if (type !== 'custom') {
    html = `
      <div class="input-group">
        <label>A 值：</label>
        <input type="number" id="propA" step="any">
      </div>
      <div class="input-group">
        <label>A 的不確定度 (ΔA)：</label>
        <input type="number" id="propDeltaA" step="any">
      </div>
      <div class="input-group">
        <label>B 值：</label>
        <input type="number" id="propB" step="any">
      </div>
      <div class="input-group">
        <label>B 的不確定度 (ΔB)：</label>
        <input type="number" id="propDeltaB" step="any">
      </div>
    `;
  } else {
    html = `
      <p class="hint-text">自訂公式功能開發中...</p>
    `;
  }

  document.getElementById('propagationInputs').innerHTML = html;
}

// 不確定度傳遞計算
function calculatePropagation() {
  const type = document.getElementById('propagationType').value;
  let output = '';

  try {
    const A = parseFloat(document.getElementById('propA').value);
    const deltaA = parseFloat(document.getElementById('propDeltaA').value);

    if (type === 'add') {
      const B = parseFloat(document.getElementById('propB').value);
      const deltaB = parseFloat(document.getElementById('propDeltaB').value);
      const result = A + B;
      const deltaResult = Math.sqrt(deltaA * deltaA + deltaB * deltaB);

      output = `
        <div class="result-item"><strong>運算類型：</strong>加法/減法</div>
        <div class="result-item"><strong>結果值：</strong>${result.toFixed(4)}</div>
        <div class="result-item"><strong>不確定度：</strong>±${deltaResult.toFixed(4)}</div>
        <div class="result-item"><strong>公式：</strong>Δf = √(ΔA² + ΔB²)</div>
        <div class="result-item"><strong>完整結果：</strong>f = ${result.toFixed(4)} ± ${deltaResult.toFixed(4)}</div>
      `;
    } else if (type === 'multiply') {
      const B = parseFloat(document.getElementById('propB').value);
      const deltaB = parseFloat(document.getElementById('propDeltaB').value);
      const result = A * B;
      const relativeUncertainty = Math.sqrt(
        Math.pow(deltaA/A, 2) + Math.pow(deltaB/B, 2)
      );
      const deltaResult = Math.abs(result) * relativeUncertainty;

      output = `
        <div class="result-item"><strong>運算類型：</strong>乘法/除法</div>
        <div class="result-item"><strong>結果值：</strong>${result.toFixed(4)}</div>
        <div class="result-item"><strong>不確定度：</strong>±${deltaResult.toFixed(4)}</div>
        <div class="result-item"><strong>相對不確定度：</strong>${(relativeUncertainty*100).toFixed(2)}%</div>
        <div class="result-item"><strong>公式：</strong>Δf/f = √((ΔA/A)² + (ΔB/B)²)</div>
        <div class="result-item"><strong>完整結果：</strong>f = ${result.toFixed(4)} ± ${deltaResult.toFixed(4)}</div>
      `;
    } else if (type === 'power') {
      const n = parseFloat(document.getElementById('propN').value);
      const result = Math.pow(A, n);
      const deltaResult = Math.abs(n * Math.pow(A, n-1) * deltaA);

      output = `
        <div class="result-item"><strong>運算類型：</strong>冪次運算</div>
        <div class="result-item"><strong>結果值：</strong>${result.toFixed(4)}</div>
        <div class="result-item"><strong>不確定度：</strong>±${deltaResult.toFixed(4)}</div>
        <div class="result-item"><strong>公式：</strong>Δf = |n × A^(n-1) × ΔA|</div>
        <div class="result-item"><strong>完整結果：</strong>f = ${result.toFixed(4)} ± ${deltaResult.toFixed(4)}</div>
      `;
    }

    document.getElementById('propagationOutput').innerHTML = output;
    document.getElementById('propagationResult').style.display = 'block';
  } catch (error) {
    alert('請填寫所有必要欄位！');
  }
}
