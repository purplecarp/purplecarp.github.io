(() => {
  'use strict';
  const M = window.FreeFallModel;
  const $ = id => document.getElementById(id);
  const canvases = {
    motion: $('motionCanvas'),
    xt: $('xtCanvas'),
    vt: $('vtCanvas')
  };
  const contexts = Object.fromEntries(Object.entries(canvases).map(([key, canvas]) => [key, canvas.getContext('2d')]));
  const colors = {
    bg: '#0b1725', panel: '#101f30', grid: '#294158', axis: '#819bb4', text: '#c8d9e9', muted: '#7891aa',
    position: '#4dc9ff', velocity: '#ffad45', acceleration: '#ff6b72', object: '#ffe068', ground: '#5ee6a8', future: '#536b82'
  };
  const presets = {
    rest: { height: 60, v0: 0, gravity: 9.8, description: '物體由 60 m 高處靜止釋放。' },
    down: { height: 60, v0: -12, gravity: 9.8, description: '物體由 60 m 高處以 12 m/s 向下拋。' },
    up: { height: 40, v0: 18, gravity: 9.8, description: '物體由 40 m 高處以 18 m/s 向上拋。' }
  };
  const parameters = { ...presets.rest };
  let time = 0;
  let running = false;
  let frame = null;
  let previous = null;

  const state = () => M.stateAt(parameters, time);
  const duration = () => M.impactTime(parameters);
  const minus = value => String(value).replace('-', '−');
  const fixed = (value, digits = 2) => minus(value.toFixed(digits));
  const signed = (value, digits = 2) => value > 0 ? `+${value.toFixed(digits)}` : fixed(value, digits);
  const visualScale = () => {
    if (document.body.classList.contains('large-type')) return 1.22;
    if ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (innerWidth >= 700 && innerWidth <= 1180)) return 1.12;
    return 1;
  };

  function setCanvasSize(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas._cssWidth = rect.width;
    canvas._cssHeight = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    for (const key of Object.keys(canvases)) setCanvasSize(canvases[key], contexts[key]);
    render();
  }

  function line(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
  }

  function label(ctx, content, x, y, options = {}) {
    ctx.fillStyle = options.color || colors.text;
    const scale = visualScale();
    ctx.font = `${options.weight || 400} ${(options.size || 12) * scale}px system-ui, "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillText(content, x, y);
  }

  function dot(ctx, x, y, radius, color, stroke) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function arrow(ctx, x, y, dx, dy, color, name) {
    const scale = visualScale(), large = scale > 1.15, tablet = scale > 1;
    const length = Math.hypot(dx, dy);
    if (length < 2) return;
    line(ctx, x, y, x + dx, y + dy, color, large ? 4.5 : tablet ? 3.75 : 3);
    const angle = Math.atan2(dy, dx), head = Math.min(large ? 14 : tablet ? 12 : 10, length * 0.45);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - head * Math.cos(angle - 0.55), y + dy - head * Math.sin(angle - 0.55));
    ctx.lineTo(x + dx - head * Math.cos(angle + 0.55), y + dy - head * Math.sin(angle + 0.55));
    ctx.closePath(); ctx.fill();
    label(ctx, name, x + dx + (large ? 12 : 9), y + dy, { color, size: 14, weight: 700, baseline: 'middle' });
  }

  function drawMotion(s) {
    const canvas = canvases.motion, ctx = contexts.motion;
    const W = canvas._cssWidth, H = canvas._cssHeight;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#102b46'); gradient.addColorStop(1, colors.bg);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);

    const top = 34, bottom = H - 46, trackX = Math.max(112, W * 0.56);
    const maxHeight = Math.max(10, parameters.height, s.peakHeight) * 1.12;
    const Y = x => bottom - x / maxHeight * (bottom - top);

    // faint altitude bands and ruler
    for (let i = 0; i <= 5; i++) {
      const altitude = maxHeight * i / 5, py = Y(altitude);
      line(ctx, 58, py, W - 18, py, i === 0 ? colors.ground : 'rgba(114,146,174,.16)', i === 0 ? 2 : 1);
      line(ctx, 48, py, 58, py, colors.axis, 1.5);
      label(ctx, `${Math.round(altitude)} m`, 42, py, { align: 'right', baseline: 'middle', color: colors.muted, size: 11 });
    }
    label(ctx, 'x', 52, 22, { color: colors.text, size: 15, weight: 700, align: 'center' });
    line(ctx, 53, top, 53, bottom, colors.axis, 1.5);
    line(ctx, 53, top, 48, top + 9, colors.axis, 1.5); line(ctx, 53, top, 58, top + 9, colors.axis, 1.5);

    // ground and a ledge marking the launch height
    ctx.fillStyle = '#173628'; ctx.fillRect(0, bottom + 2, W, H - bottom);
    for (let x = 0; x < W; x += 22) line(ctx, x, bottom + 4, x + 14, bottom + 17, '#2b6649', 2);
    const launchY = Y(parameters.height);
    line(ctx, trackX + 19, launchY, W - 12, launchY, '#819bb4', 3);
    label(ctx, `x₀ = ${parameters.height.toFixed(0)} m`, W - 15, launchY - 8, { align: 'right', color: colors.text, size: 12 });

    // full one-dimensional path and elapsed equal-time points
    line(ctx, trackX, Y(s.peakHeight), trackX, bottom, '#46627c', 2, [5, 6]);
    if ($('showTrail').checked) {
      const spacing = 0.2;
      for (let sampleTime = 0; sampleTime <= s.t + 1e-9; sampleTime += spacing) {
        const point = M.stateAt(parameters, sampleTime);
        dot(ctx, trackX, Y(point.x), 3, colors.position, colors.bg);
      }
      label(ctx, '每 0.2 s', trackX - 12, bottom - 9, { align: 'right', color: colors.position, size: 11 });
    }

    const py = Y(s.x);
    ctx.save();
    ctx.shadowColor = 'rgba(255,224,104,.5)'; ctx.shadowBlur = 14;
    dot(ctx, trackX, py, visualScale() > 1.15 ? 13 : visualScale() > 1 ? 12 : 10, colors.object, '#fff4b7');
    ctx.restore();
    label(ctx, `${fixed(s.x, 1)} m`, trackX + 18, py + 5, { color: colors.object, size: 14, weight: 700 });

    if ($('showVectors').checked) {
      const vScale = Math.min(2.2, (H * 0.21) / Math.max(12, Math.abs(M.stateAt(parameters, s.duration).v)));
      const drawVerticalVector = (x, dy, color, name) => {
        const safeTop = top + 12, safeBottom = bottom - 7;
        let startY = py, vectorY = dy;
        if (startY + vectorY > safeBottom) startY = py - vectorY;
        if (startY + vectorY < safeTop) startY = py - vectorY;
        arrow(ctx, x, startY, 0, vectorY, color, name);
      };
      drawVerticalVector(trackX - 24, -s.v * vScale, colors.velocity, 'v');
      drawVerticalVector(trackX + 21, Math.min(62, parameters.gravity * 4), colors.acceleration, 'a = −g');
    }
    label(ctx, s.v > 0.04 ? '上升中' : s.v < -0.04 ? '下降中' : '瞬間靜止', 14, H - 16,
      { color: s.v > 0.04 ? colors.position : s.v < -0.04 ? colors.velocity : colors.object, size: 13, weight: 700 });
  }

  function graphTicks(min, max, count = 4) {
    return Array.from({ length: count + 1 }, (_, i) => min + (max - min) * i / count);
  }

  function drawGraph(kind, s) {
    const canvas = canvases[kind], ctx = contexts[kind];
    const W = canvas._cssWidth, H = canvas._cssHeight;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, W, H);
    const left = 54, right = W - 17, top = 51, bottom = H - 36;
    const end = s.duration > 0 ? s.duration : 1;
    let ymin, ymax, color, value, yLabel;
    if (kind === 'xt') {
      ymin = 0; ymax = Math.max(10, s.peakHeight * 1.08); color = colors.position; value = point => point.x; yLabel = 'x (m)';
    } else {
      const impactV = M.stateAt(parameters, end).v;
      const rawMin = Math.min(impactV, 0), rawMax = Math.max(parameters.v0, 0), pad = Math.max(2, (rawMax - rawMin) * 0.09);
      ymin = rawMin - pad; ymax = rawMax + pad; color = colors.velocity; value = point => point.v; yLabel = 'v (m/s)';
    }
    const X = t => left + t / end * (right - left);
    const Y = v => bottom - (v - ymin) / (ymax - ymin) * (bottom - top);

    for (const tick of graphTicks(0, end)) {
      const px = X(tick); line(ctx, px, top, px, bottom, colors.grid);
      label(ctx, tick.toFixed(end < 4 ? 1 : 0), px, bottom + 19, { align: 'center', color: colors.muted, size: 10 });
    }
    for (const tick of graphTicks(ymin, ymax)) {
      const py = Y(tick); line(ctx, left, py, right, py, colors.grid);
      label(ctx, fixed(tick, Math.abs(ymax - ymin) < 20 ? 1 : 0), left - 7, py, { align: 'right', baseline: 'middle', color: colors.muted, size: 10 });
    }
    if (ymin < 0 && ymax > 0) line(ctx, left, Y(0), right, Y(0), colors.axis, 1.4);
    line(ctx, left, top, left, bottom, colors.axis, 1.4); line(ctx, left, bottom, right, bottom, colors.axis, 1.4);
    label(ctx, yLabel, left, top - 10, { color, size: 11, weight: 700 });
    label(ctx, 't (s)', right, H - 8, { align: 'right', color: colors.text, size: 11 });

    const drawCurve = (until, curveColor, width, dash = []) => {
      const count = Math.max(2, Math.ceil(160 * until / end));
      ctx.strokeStyle = curveColor; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const t = until * i / count, point = M.stateAt(parameters, t);
        if (i === 0) ctx.moveTo(X(t), Y(value(point))); else ctx.lineTo(X(t), Y(value(point)));
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
    if ($('showPrediction').checked && s.duration > 0) drawCurve(s.duration, colors.future, 2, [5, 5]);
    if (s.t > 0) drawCurve(s.t, color, 3);
    dot(ctx, X(s.t), Y(value(s)), 5, color, '#e8f3ff');
    ctx.restore();

    if (kind === 'vt' && parameters.v0 > 0) {
      const peakT = parameters.v0 / parameters.gravity;
      label(ctx, '最高點', X(peakT), Y(0) - 9, { align: 'center', color: colors.object, size: 10, weight: 700 });
    }
  }

  function updateReadouts(s) {
    $('readTime').textContent = fixed(s.t);
    $('readPosition').textContent = fixed(s.x);
    $('readVelocity').textContent = signed(s.v);
    $('readAcceleration').textContent = fixed(s.a);
    $('timeValue').textContent = `${fixed(s.t)} s`;
    $('endTime').textContent = `/ ${fixed(s.duration)} s`;
    $('time').value = s.duration > 0 ? String(Math.round(s.t / s.duration * 1000)) : '0';
    $('impactValue').textContent = `${fixed(s.duration)} s`;
    $('peakValue').textContent = `${fixed(s.peakHeight)} m`;
    $('impactVelocityValue').textContent = `${signed(M.stateAt(parameters, s.duration).v)} m/s`;

    let message;
    if (s.duration === 0) message = '物體已在地面，且初速度未指向上方，因此會立即接觸地面。';
    else if (s.landed) message = `已落地 · 歷時 ${fixed(s.duration)} s，落地前速度 ${signed(s.v)} m/s。`;
    else if (s.t === 0) message = `準備就緒 · ${parameters.description || '已套用自訂參數。'}`;
    else if (Math.abs(s.v) < 0.08) message = `到達最高點 · 此刻 v = 0，隨後改向下運動。`;
    else message = `${running ? '播放中' : '已暫停'} · 物體正在${s.v > 0 ? '向上減速' : '向下加速'}。`;
    $('status').textContent = message;
    $('play').textContent = s.duration === 0 ? '已在地面' : running ? 'Ⅱ 暫停' : s.landed ? '↻ 再播放' : '▶ 開始';
    $('play').disabled = s.duration === 0;
    $('step').disabled = running || s.landed;
  }

  function render() {
    const s = state();
    updateReadouts(s); drawMotion(s); drawGraph('xt', s); drawGraph('vt', s);
  }

  function pause() {
    running = false; previous = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function reset() {
    pause(); time = 0; render();
  }

  function tick(timestamp) {
    if (!running) return;
    if (previous !== null) {
      const delta = Math.min((timestamp - previous) / 1000, 0.1) * Number($('speed').value);
      time = Math.min(duration(), time + delta);
    }
    previous = timestamp;
    if (time >= duration()) running = false;
    render();
    if (running) frame = requestAnimationFrame(tick);
    else { frame = null; previous = null; }
  }

  function togglePlay() {
    if (running) { pause(); render(); return; }
    if (time >= duration()) time = 0;
    running = true; previous = null; render(); frame = requestAnimationFrame(tick);
  }

  function clearPreset() {
    document.querySelectorAll('.preset').forEach(button => {
      button.classList.remove('active'); button.setAttribute('aria-pressed', 'false');
    });
    parameters.description = '已套用自訂參數。';
  }

  function syncInputs() {
    $('height').value = parameters.height; $('heightValue').textContent = `${parameters.height.toFixed(1)} m`;
    $('v0').value = parameters.v0; $('v0Value').textContent = `${signed(parameters.v0, 1)} m/s`;
    $('gravity').value = parameters.gravity; $('gravityValue').textContent = `${parameters.gravity.toFixed(1)} m/s²`;
  }

  document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.preset;
    Object.assign(parameters, presets[name]);
    clearPreset();
    button.classList.add('active'); button.setAttribute('aria-pressed', 'true');
    parameters.description = presets[name].description;
    syncInputs(); reset();
  }));

  for (const [id, property, unit] of [['height', 'height', 'm'], ['v0', 'v0', 'm/s'], ['gravity', 'gravity', 'm/s²']]) {
    $(id).addEventListener('input', () => {
      parameters[property] = Number($(id).value);
      const shown = property === 'v0' ? signed(parameters[property], 1) : parameters[property].toFixed(1);
      $(`${id}Value`).textContent = `${shown} ${unit}`;
      clearPreset(); reset();
    });
  }
  $('speed').addEventListener('input', () => { $('speedValue').textContent = `${Number($('speed').value)}×`; previous = null; });
  $('showTrail').addEventListener('change', render);
  $('showVectors').addEventListener('change', render);
  $('showPrediction').addEventListener('change', render);
  $('play').addEventListener('click', togglePlay);
  $('reset').addEventListener('click', reset);
  $('step').addEventListener('click', () => { pause(); time = Math.min(duration(), time + 0.05); render(); });
  $('time').addEventListener('input', () => { pause(); time = Number($('time').value) / 1000 * duration(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render(); } });
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(document.querySelector('.visual-grid'));
  syncInputs(); resize();
})();
