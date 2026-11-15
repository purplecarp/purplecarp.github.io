// 二元一次方程式求解
function solveEquations() {
  try {
    const a1 = parseFloat(document.getElementById('eqA1').value);
    const b1 = parseFloat(document.getElementById('eqB1').value);
    const c1 = parseFloat(document.getElementById('eqC1').value);
    const a2 = parseFloat(document.getElementById('eqA2').value);
    const b2 = parseFloat(document.getElementById('eqB2').value);
    const c2 = parseFloat(document.getElementById('eqC2').value);

    // 使用 Cramer's Rule
    const determinant = a1 * b2 - a2 * b1;

    if (Math.abs(determinant) < 1e-10) {
      alert('此方程組無唯一解（行列式為零）！');
      return;
    }

    const x = (c1 * b2 - c2 * b1) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;

    // 驗證
    const check1 = a1 * x + b1 * y;
    const check2 = a2 * x + b2 * y;

    const output = `
      <div class="result-item"><strong>方程組：</strong></div>
      <div class="result-item">  ${a1}x + ${b1}y = ${c1}</div>
      <div class="result-item">  ${a2}x + ${b2}y = ${c2}</div>
      <div class="result-item" style="margin-top: 15px;"><strong>解：</strong></div>
      <div class="result-item"><strong>x = </strong>${x.toFixed(6)}</div>
      <div class="result-item"><strong>y = </strong>${y.toFixed(6)}</div>
      <div class="result-item" style="margin-top: 15px;"><strong>驗證：</strong></div>
      <div class="result-item">代入第一式：${check1.toFixed(6)} ≈ ${c1}</div>
      <div class="result-item">代入第二式：${check2.toFixed(6)} ≈ ${c2}</div>
    `;

    document.getElementById('equationOutput').innerHTML = output;
    document.getElementById('equationResult').style.display = 'block';
  } catch (error) {
    alert('請填寫所有欄位！');
  }
}
