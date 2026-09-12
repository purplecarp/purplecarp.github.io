(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const parameters = { v0: 12, height: 18, gravity: 9.8 };
  const stateAt = t => ProjectileModel.stateAt(parameters, t);
  let time = 0, running = false, frame = null, previous = null, width = 0, height = 0;
  const colors = { ball: '#62b9fa', x: '#ffb66a', y: '#65dcaf', v: '#ff8f9e', a: '#efdb72', grid: '#23364b', text: '#b9ccdf' };
  function pause() {
    running = false;
    cancelAnimationFrame(frame);
    frame = null;
    previous = null;
  }
  function render() {
    const s = stateAt(time);
    $('timeValue').textContent = `${s.t.toFixed(2)} s`;
    $('time').value = s.t / s.flightTime * 1000;
    $('time').setAttribute('aria-valuetext', `${s.t.toFixed(2)} 秒，總長 ${s.flightTime.toFixed(2)} 秒`);
    for (const [id, value] of Object.entries({ xValue: s.x, yValue: s.y, vxValue: s.vx, vyValue: s.vy, vValue: s.speed })) $(id).textContent = (Math.abs(value) < 0.00001 ? 0 : value).toFixed(2);
    $('flightValue').textContent = `${s.flightTime.toFixed(2)} s`;
    $('rangeValue').textContent = `${s.range.toFixed(2)} m`;
    $('endTime').textContent = `落地 ${s.flightTime.toFixed(2)} s`;
    $('play').textContent = running ? 'Ⅱ 暫停' : s.landed ? '↻ 重播' : time > 0 ? '▶ 繼續' : '▶ 開始';
    const status = s.landed ? '已落地（碰地前瞬間）' : running ? '播放中' : time > 0 ? '已暫停' : '準備就緒';
    if ($('status').textContent !== status) $('status').textContent = status;
    $('step').disabled = running || s.landed;
    draw(s);
  }
  function tick(timestamp) {
    if (!running) return;
    if (previous !== null) time = Math.min(stateAt(0).flightTime, time + Math.min((timestamp - previous) / 1000, 0.1) * Number($('speed').value));
    previous = timestamp;
    if (stateAt(time).landed) pause();
    render();
    if (running) frame = requestAnimationFrame(tick);
  }
  $('play').addEventListener('click', () => {
    if (running) pause();
    else {
      if (stateAt(time).landed) time = 0;
      running = true;
      previous = null;
      frame = requestAnimationFrame(tick);
    }
    render();
  });
  $('reset').addEventListener('click', () => { pause(); time = 0; render(); });
  $('step').addEventListener('click', () => { pause(); time = Math.min(stateAt(0).flightTime, time + 0.05); render(); });
  $('time').addEventListener('input', () => { pause(); time = Number($('time').value) / 1000 * stateAt(0).flightTime; render(); });
  for (const [id, unit] of [['v0', 'm/s'], ['height', 'm'], ['gravity', 'm/s²']]) {
    const update = () => {
      parameters[id] = Number($(id).value);
      $(id + 'Value').textContent = `${parameters[id].toFixed(1)} ${unit}`;
    };
    update();
    $(id).addEventListener('input', () => { update(); pause(); time = 0; render(); });
  }
  $('speed').addEventListener('input', () => { $('speedValue').textContent = `${Number($('speed').value)}×`; previous = null; });
  for (const id of ['references', 'trail', 'prediction', 'velocity', 'acceleration']) $(id).addEventListener('change', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render(); } });
  function line(x1, y1, x2, y2, color, dash = [], strokeWidth = 1.5) {
    ctx.strokeStyle = color; ctx.lineWidth = strokeWidth; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  function text(label, x, y, color = colors.text, align = 'left') {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = '12px system-ui, sans-serif'; ctx.fillText(label, x, y);
  }
  function ball(x, y, color, radius = 7) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }
  function arrow(x, y, dx, dy, color, label, dashed = false) {
    if (Math.hypot(dx, dy) < 0.5) return;
    line(x, y, x + dx, y + dy, color, dashed ? [8, 5] : [], 3.5);
    const a = Math.atan2(dy, dx), size = Math.min(12, Math.hypot(dx, dy) * 0.65);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - size * Math.cos(a - 0.5), y + dy - size * Math.sin(a - 0.5));
    ctx.lineTo(x + dx - size * Math.cos(a + 0.5), y + dy - size * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = label === 'g' ? 'right' : 'left';
    const labelX = x + dx + (label === 'g' ? -9 : 9), labelY = y + dy - 9;
    ctx.strokeStyle = '#101e2e'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(label, labelX, labelY);
    ctx.fillStyle = color; ctx.fillText(label, labelX, labelY);
    ctx.restore();
  }
  function draw(s) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    // Reserve room for enlarged vectors at the right edge and just before impact.
    const left = 56, bottom = height - 174, top = 38, right = width - 160;
    // One distance scale for both axes keeps the velocity tangent to the trajectory.
    const scale = Math.min((right - left) / Math.max(s.range, 5), (bottom - top) / parameters.height);
    const X = x => left + x * scale, Y = y => bottom - y * scale;
    const maxX = (width - 30 - left) / scale, maxY = (bottom - 20) / scale;
    const rough = Math.max(1, 55 / scale), power = 10 ** Math.floor(Math.log10(rough));
    const spacing = [1, 2, 5, 10].find(n => n * power >= rough) * power;
    for (let x = 0; x <= maxX; x += spacing) { line(X(x), 20, X(x), bottom, colors.grid); text(String(Number(x.toFixed(1))), X(x), bottom + 18, colors.text, 'center'); }
    for (let y = spacing; y <= maxY; y += spacing) { line(left, Y(y), width - 25, Y(y), colors.grid); text(String(Number(y.toFixed(1))), left - 8, Y(y) + 4, colors.text, 'right'); }
    line(left, 20, left, bottom, '#839bb5'); line(left, bottom, width - 25, bottom, '#839bb5');
    text('y (m)', 12, 16); text('x (m)', width - 12, bottom + 35, colors.text, 'right');
    text('拋出', left + 9, Y(parameters.height) - 12);
    if ($('prediction').checked) {
      ctx.strokeStyle = '#527693'; ctx.setLineDash([5, 5]); ctx.beginPath();
      for (let i = 0; i <= 160; i++) { const p = stateAt(s.flightTime * i / 160); if (i === 0) ctx.moveTo(X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y)); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const showReferences = $('references').checked;
    const xRefY = bottom + 44;
    // Draw the reference lane before its trail so the dots remain visible.
    if (showReferences) line(left, xRefY, width - 25, xRefY, '#654d36');
    // Sample all three motions at the same exact times, including when scrubbing backward.
    if ($('trail').checked) for (let i = 0; i <= Math.floor((s.t + 1e-9) / 0.1); i++) {
      const p = stateAt(i * 0.1);
      ball(X(p.x), Y(p.y), colors.ball, 2.5);
      if (showReferences) {
        ball(X(p.x), xRefY, colors.x, 3);
        ball(left, Y(p.y), colors.y, 3);
      }
    }
    const px = X(s.x), py = Y(s.y);
    if (showReferences) {
      line(left, py, px, py, colors.y, [4, 5]);
      line(px, py, px, xRefY, colors.x, [4, 5]);
      ball(left, py, colors.y, 9);
      // A separate horizontal reference lane prevents overlap with the projectile at impact.
      ball(px, xRefY, colors.x, 6);
      text('水平等速對照', left, bottom + 66, colors.x);
    }
    ball(px, py, colors.ball, 6);
    // Keep one fixed scale throughout each flight, shared by velocity components.
    const vectorScale = Math.min(5.6, 120 / Math.max(stateAt(s.flightTime).speed, parameters.gravity));
    if ($('velocity').checked) {
      const dx = s.vx * vectorScale, dy = -s.vy * vectorScale;
      if (showReferences) {
        // Match the projectile components in both magnitude and visual scale.
        arrow(px, xRefY, dx, 0, colors.x, 'vₓ');
        arrow(left, py, 0, dy, colors.y, 'vᵧ');
      }
      arrow(px, py, dx, 0, colors.x, 'vₓ');
      arrow(px, py, 0, dy, colors.y, 'vᵧ');
      if (dx > 0.5 && dy > 0.5) { line(px + dx, py, px + dx, py + dy, '#896078', [3, 4]); line(px, py + dy, px + dx, py + dy, '#896078', [3, 4]); arrow(px, py, dx, dy, colors.v, 'v'); }
    }
    if ($('acceleration').checked) arrow(px - 24, py, 0, parameters.gravity * vectorScale, colors.a, 'g', true);
    text('速度：橘 vₓ · 綠 vᵧ · 粉紅 v', 12, height - 12);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render();
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
})();
