'use strict';
(() => {
  const $ = id => document.getElementById(id);
  // Analytic models avoid cancellation in the difference quotient near h = 0.
  const models = {
    quadratic: { label: 'f(x) = x²', f: x => x * x, derivative: x => 2 * x, secant: (a, h) => 2 * a + h, range: [-2, 18], tick: 2 },
    cubic: { label: 'f(x) = x³ / 4', f: x => x ** 3 / 4, derivative: x => 3 * x * x / 4, secant: (a, h) => (3 * a * a + 3 * a * h + h * h) / 4, range: [-18, 18], tick: 5 },
    linear: { label: 'f(x) = 2x + 1', f: x => 2 * x + 1, derivative: () => 2, secant: () => 2, range: [-9, 11], tick: 2 },
    absolute: { label: 'f(x) = |x|', f: Math.abs, derivative: x => x === 0 ? null : Math.sign(x), secant: (a, h) => (Math.abs(a + h) - Math.abs(a)) / h, range: [-1, 5], tick: 1 }
  };
  const scenarios = {
    right: { model: 'quadratic', a: 1, side: 1, question: '預測：Q 從右邊靠近 P，割線會怎麼轉？', observe: '觀察：縮小距離，比較橘色割線與紫色切線的斜率。', conclusion: '固定 a = 1 時，割線斜率為 2 + h；h 從正值趨近 0，平均變化率便趨近 2。' },
    left: { model: 'quadratic', a: 1, side: -1, question: '預測：只換成從左邊靠近，最後會得到不同的斜率嗎？', observe: '觀察：維持同一函數與 P，比較 h 為正、負時的平均變化率。', conclusion: '左側斜率從小於 2 的值趨近 2，右側從大於 2 的值趨近 2；兩側極限相同，所以 f′(1) = 2。' },
    corner: { model: 'absolute', a: 0, side: 1, question: '預測：尖點處能找到唯一的瞬時變化率嗎？', observe: '觀察：先縮小距離，再切換 Q 的左右方向，比較斜率。', conclusion: '|x| 在 0 的左側割線斜率為 −1，右側為 1。兩側極限不同，所以此點沒有導數，也沒有唯一的切線。' }
  };
  const state = { model: 'quadratic', a: 1, side: 1, distance: 2, initialDistance: 2, speed: 1, running: false, frame: null, lastTime: null };
  const canvas = $('graph');
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0;
  const fmt = (n, places = 3) => (Math.abs(n) < .5 * 10 ** -places ? 0 : n).toFixed(places).replace('-', '−');
  function data() {
    const model = models[state.model], h = state.side * state.distance;
    return { model, h, p: model.f(state.a), q: model.f(state.a + h), average: h === 0 ? null : model.secant(state.a, h), instant: model.derivative(state.a) };
  }
  function stop() {
    state.running = false;
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    state.lastTime = null;
    $('play').textContent = '▶ 播放逼近';
  }
  function update() {
    const d = data();
    $('a').value = state.a;
    $('distance').value = state.distance;
    $('a-value').textContent = fmt(state.a, 2);
    $('distance-value').textContent = fmt(state.distance, 2);
    $('h-value').textContent = fmt(d.h);
    $('average').textContent = d.average === null ? '未定義' : fmt(d.average);
    $('instant').textContent = d.instant === null ? '不存在' : fmt(d.instant);
    $('function-label').textContent = d.model.label;
    $('play').disabled = state.distance <= .01 && !state.running;
    $('step').disabled = state.distance <= .01;
    $('status').textContent = d.h === 0
      ? 'P、Q 重合：0 / 0 無法定義割線斜率。瞬時變化率需看 h 趨近 0 的極限。'
      : d.instant === null
        ? '尖點 a = 0：左側斜率 −1，右側斜率 1，無法得到唯一的瞬時變化率。'
        : `斜率差 |平均 − 瞬時| = ${fmt(Math.abs(d.average - d.instant))}。${state.distance <= .010001 ? '已到 |h| = 0.01；兩點仍不同，這是逼近值。' : '縮小 |h|，觀察兩條直線與斜率。'}`;
    $('calculation').textContent = `目前 P = (${fmt(state.a)}, ${fmt(d.p)})，Q = (${fmt(state.a + d.h)}, ${fmt(d.q)})。` + (d.h === 0 ? 'Δx = 0，差商未定義。' : ` Δy / Δx = (${fmt(d.q)} − (${fmt(d.p)})) / (${fmt(d.h)}) = ${fmt(d.average)}。`);
    $('limit-table').innerHTML = [1, .5, .1, .01, .001].map(h => `<tr><td>${fmt(h)}</td><td>${fmt(d.model.secant(state.a, -h))}</td><td>${fmt(d.model.secant(state.a, h))}</td></tr>`).join('');
    canvas.setAttribute('aria-label', `${d.model.label}；P 的 x = ${fmt(state.a)}；h = ${fmt(d.h)}；平均變化率 ${d.average === null ? '未定義' : fmt(d.average)}；瞬時變化率 ${d.instant === null ? '不存在' : fmt(d.instant)}。`);
    draw(d);
  }
  function draw(d = data()) {
    if (!ctx || width < 1 || height < 1) return;
    const big = document.body.classList.contains('st-large');
    const margin = { left: big ? 65 : 55, right: 25, top: 38, bottom: 40 };
    const pw = width - margin.left - margin.right, ph = height - margin.top - margin.bottom;
    const xmin = -4.5, xmax = 4.5, [ymin, ymax] = d.model.range;
    const X = x => margin.left + (x - xmin) / (xmax - xmin) * pw;
    const Y = y => margin.top + (ymax - y) / (ymax - ymin) * ph;
    const line = (x1, y1, x2, y2, color, thickness = 1, dash = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.font = `${big ? 21 : 18}px "Microsoft JhengHei", sans-serif`;
    for (let x = -4; x <= 4; x++) {
      line(X(x), margin.top, X(x), height - margin.bottom, '#e0e7ef');
      ctx.fillStyle = '#57687b'; ctx.textAlign = 'center'; ctx.fillText(String(x), X(x), height - 12);
    }
    for (let y = Math.ceil(ymin / d.model.tick) * d.model.tick; y <= ymax; y += d.model.tick) {
      line(margin.left, Y(y), width - margin.right, Y(y), '#e0e7ef');
      ctx.fillStyle = '#57687b'; ctx.textAlign = 'right'; ctx.fillText(String(y), margin.left - 9, Y(y) + 6);
    }
    line(margin.left, Y(0), width - margin.right, Y(0), '#8090a2', 2);
    line(X(0), margin.top, X(0), height - margin.bottom, '#8090a2', 2);
    ctx.fillStyle = '#20334a'; ctx.font = `${big ? 28 : 24}px "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('f(x)', margin.left, 27);
    ctx.textAlign = 'right'; ctx.fillText('x', width - 5, Math.max(26, Y(0) - 10));
    ctx.save(); ctx.beginPath(); ctx.rect(margin.left, margin.top, pw, ph); ctx.clip();
    const px = X(state.a), py = Y(d.p), qx = X(state.a + d.h), qy = Y(d.q);
    if ($('triangle').checked && d.h !== 0) {
      ctx.fillStyle = '#edaa4720'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, py); ctx.lineTo(qx, qy); ctx.closePath(); ctx.fill();
      line(px, py, qx, py, '#996321', 2, [5, 5]); line(qx, py, qx, qy, '#996321', 2, [5, 5]);
      ctx.fillStyle = '#805316'; ctx.font = `${big ? 28 : 24}px sans-serif`; ctx.textAlign = 'center';
      if (Math.abs(px - qx) > 75) ctx.fillText('Δx', (px + qx) / 2, py + (py < height - margin.bottom - 30 ? 28 : -12));
      if (Math.abs(py - qy) > 50) { ctx.textAlign = qx > width - 90 ? 'right' : 'left'; ctx.fillText('Δy', qx + (qx > width - 90 ? -10 : 10), (py + qy) / 2); }
    }
    ctx.strokeStyle = '#2463c2'; ctx.lineWidth = 3.5; ctx.beginPath();
    for (let i = 0; i <= pw; i++) { const x = xmin + i / pw * (xmax - xmin); if (i === 0) ctx.moveTo(X(x), Y(d.model.f(x))); else ctx.lineTo(X(x), Y(d.model.f(x))); }
    ctx.stroke();
    if (d.average !== null) line(X(xmin), Y(d.p + d.average * (xmin - state.a)), X(xmax), Y(d.p + d.average * (xmax - state.a)), '#c56818', 3.5);
    if ($('tangent').checked && d.instant !== null) line(X(xmin), Y(d.p + d.instant * (xmin - state.a)), X(xmax), Y(d.p + d.instant * (xmax - state.a)), '#7c3fc0', 3.5, [12, 8]);
    function point(x, y, color) { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (d.h !== 0) point(qx, qy, '#c56818');
    point(px, py, '#20334a');
    ctx.restore();
    ctx.font = `bold ${big ? 28 : 24}px sans-serif`;
    function label(text, x, y, color) { ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, Math.max(margin.left, Math.min(width - ctx.measureText(text).width - 8, x)), Math.max(margin.top + 24, Math.min(height - margin.bottom - 5, y))); }
    label(d.h === 0 ? 'P = Q' : 'P', px - 30, py + 32, '#20334a');
    if (d.h !== 0) label('Q', qx + 10, qy - 14, '#af520b');
  }
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function tick(now) {
    if (!state.running) return;
    if (state.lastTime !== null) state.distance = Math.max(.01, state.distance * Math.exp(-(now - state.lastTime) / 1000 * .8 * state.speed));
    state.lastTime = now;
    if (state.distance <= .01) stop();
    update();
    if (state.running) state.frame = requestAnimationFrame(tick);
  }
  function applyScenario(key) {
    stop(); const s = scenarios[key];
    Object.assign(state, { model: s.model, a: s.a, side: s.side, distance: 2, initialDistance: 2 });
    $('function').value = s.model; $('side').value = s.side; $('scenario').value = key;
    $('question').textContent = s.question; $('observe').textContent = s.observe;
    $('conclusion').textContent = s.conclusion; $('conclusion').hidden = true;
    $('reveal').setAttribute('aria-expanded', 'false'); $('reveal').textContent = '揭示結論'; update();
  }
  function parameterChanged(id, value) {
    stop();
    if (id === 'function') state.model = value;
    if (id === 'a') state.a = Number(value);
    if (id === 'side') state.side = Number(value);
    if (id === 'distance') state.initialDistance = Number(value);
    state.distance = state.initialDistance;
    $('question').textContent = '自由探索：固定 P，從左右逼近時，斜率會趨近同一個值嗎？';
    $('observe').textContent = '更改函數、a 或方向會回到本次起始距離並暫停。';
    $('conclusion').textContent = '光看圖形靠近還不夠：比較左右差商是否趨近同一個有限值。可展開下方數值表核對。';
    $('conclusion').hidden = true; $('reveal').setAttribute('aria-expanded', 'false'); $('reveal').textContent = '揭示結論';
    $('scenario').selectedIndex = -1; update();
  }
  $('play').addEventListener('click', () => {
    if (state.running) { stop(); update(); return; }
    if (state.distance <= .01) return;
    state.running = true; state.lastTime = null; $('play').textContent = '⏸ 暫停'; state.frame = requestAnimationFrame(tick);
  });
  $('replay').addEventListener('click', () => { stop(); state.distance = state.initialDistance; update(); });
  $('step').addEventListener('click', () => { stop(); state.distance = Math.max(.01, state.distance / 2); update(); });
  $('speed').addEventListener('change', () => { state.speed = Number($('speed').value); state.lastTime = null; });
  $('scenario').addEventListener('change', e => applyScenario(e.target.value));
  for (const id of ['function', 'a', 'side', 'distance']) $(id).addEventListener(id === 'a' || id === 'distance' ? 'input' : 'change', e => parameterChanged(id, e.target.value));
  document.querySelectorAll('[data-adjust]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.adjust, input = $(id);
    const current = id === 'a' ? state.a : state.distance;
    const value = Math.max(Number(input.min), Math.min(Number(input.max), Number((current + Number(button.dataset.delta)).toFixed(2))));
    parameterChanged(id, value);
  }));
  for (const id of ['tangent', 'triangle']) $(id).addEventListener('change', () => draw());
  $('reveal').addEventListener('click', () => { $('conclusion').hidden = !$('conclusion').hidden; $('reveal').setAttribute('aria-expanded', String(!$('conclusion').hidden)); $('reveal').textContent = $('conclusion').hidden ? '揭示結論' : '收起結論'; });
  $('controls-toggle').addEventListener('click', () => { $('controls').hidden = !$('controls').hidden; $('controls-toggle').setAttribute('aria-expanded', String(!$('controls').hidden)); $('controls-toggle').textContent = $('controls').hidden ? '開啟參數' : '收合參數'; });
  $('mode').addEventListener('click', () => { const enabled = document.body.classList.toggle('st-demo'); $('mode').setAttribute('aria-pressed', String(enabled)); $('mode').textContent = enabled ? '詳細說明' : '課堂演示'; });
  $('large').addEventListener('click', () => { const enabled = document.body.classList.toggle('st-large'); $('large').setAttribute('aria-pressed', String(enabled)); resize(); });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else throw new Error('Fullscreen unavailable'); }
    catch { $('status').textContent = '此瀏覽器無法開啟全螢幕，仍可使用「課堂演示」。'; }
  });
  document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '退出全螢幕' : '全螢幕'; resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); update(); } });
  $('reset').addEventListener('click', () => {
    state.speed = 1; $('speed').value = '1'; $('tangent').checked = true; $('triangle').checked = true;
    document.body.classList.remove('st-large'); $('large').setAttribute('aria-pressed', 'false'); applyScenario('right'); resize();
  });
  new ResizeObserver(resize).observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  applyScenario('right'); resize();
})();
