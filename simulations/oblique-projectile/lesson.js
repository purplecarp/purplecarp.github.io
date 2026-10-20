(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const colors = ['#c2cfdf', '#ff9ecb', '#63bbff', '#ffc16e', '#81dfb5', '#c5a5ff', '#79e4ed'];
  const darkColors = ['#526477', '#a32e66', '#18699e', '#975506', '#187450', '#7044a6', '#14757e'];
  const comparisonAngles = [0, 15, 30, 45, 60, 75, 90];
  const componentColors = { x: '#81dfb5', y: '#ff9ecb' };
  let mode = 'single', time = 0, running = false, previous = null, frame = null;
  let width = 0, height = 0;
  const v0 = () => Number($('v0').value);
  const shots = () => (mode === 'single' ? [Number($('angle').value)] : comparisonAngles).map((angle, i) => ({
    name: 'ABCDEFG'[i], angle, color: colors[mode === 'single' ? 2 : i], ink: darkColors[mode === 'single' ? 2 : i]
  }));
  const state = (shot, t) => ObliqueProjectileModel.stateAt({ v0: v0(), angle: shot.angle }, t);
  const duration = () => Math.max(...shots().map(shot => state(shot, 0).flightTime));
  const fixed = value => (Math.abs(value) < 0.00001 ? 0 : value).toFixed(2);

  function pause() {
    running = false;
    cancelAnimationFrame(frame);
    frame = null;
    previous = null;
  }
  function reset() { pause(); time = 0; render(); }
  function render() {
    const list = shots(), end = duration();
    $('componentInfo').hidden = !$('components').checked;
    $('componentValues').textContent = $('components').checked ? list.map(shot => {
      const s = state(shot, time);
      return s.landed ? `${shot.name}：已落地（分解運動觀察結束）`
        : `${shot.name}：vₓ = ${fixed(s.vx)} m/s，vᵧ = ${fixed(s.vy)} m/s`;
    }).join('；') : '';
    $('timeValue').textContent = `${fixed(time)} s`;
    $('time').value = end > 0 ? time / end * 1000 : 0;
    $('time').disabled = end === 0;
    $('time').setAttribute('aria-valuetext', `${fixed(time)} 秒，共 ${fixed(end)} 秒`);
    $('endTime').textContent = `全部落地 ${fixed(end)} s`;
    $('play').textContent = running ? 'Ⅱ 暫停' : time >= end && end > 0 ? '↻ 重播' : time > 0 ? '▶ 繼續' : mode === 'compare' ? '▶ 同時發射' : '▶ 發射';
    $('play').disabled = end === 0;
    $('step').disabled = running || time >= end;
    const status = end === 0 ? '地面水平發射，飛行時間為零' : time >= end ? '全部已落地' : running ? '飛行中' : time > 0 ? '已暫停' : '準備就緒';
    if ($('status').textContent !== status) $('status').textContent = status;
    list.forEach((shot, i) => {
      const s = state(shot, time), row = $('results').children[i];
      const values = [fixed(s.x), fixed(s.y), fixed(s.range), fixed(s.maxHeight), fixed(s.flightTime), s.landed ? '已落地' : time === 0 ? '待發射' : '飛行中'];
      values.forEach((value, j) => { row.children[j + 1].textContent = value; });
    });
    draw(list);
  }
  function configure() {
    pause(); time = 0;
    $('singleMode').setAttribute('aria-pressed', String(mode === 'single'));
    $('compareMode').setAttribute('aria-pressed', String(mode === 'compare'));
    $('singleControls').hidden = mode !== 'single';
    $('compareControls').hidden = mode !== 'compare';
    $('v0Value').textContent = `${v0()} m/s`;
    $('angleValue').textContent = `${$('angle').value}°`;
    const list = shots();
    $('legend').innerHTML = list.map(s => `<span><i class="swatch" style="--color:${s.ink}"></i>${s.name} · ${s.angle}° · ${v0()} m/s</span>`).join('');
    $('results').innerHTML = list.map(s => `<tr><th scope="row"><i class="swatch" style="--color:${s.ink}"></i> ${s.name} · ${s.angle}°</th>${'<td></td>'.repeat(6)}</tr>`).join('');
    $('insight').textContent = mode === 'single'
      ? '試試看：固定角度，將初速度加倍。射程與最高點會變成幾倍？'
      : '觀察提示：固定初速時，45° 射得最遠；15° 與 75°、30° 與 60° 各有相同射程，但落地時間不同。0° 留在原點，90° 鉛直上拋。';
    render();
  }
  function tick(timestamp) {
    if (!running) return;
    if (previous !== null) time = Math.min(duration(), time + Math.min((timestamp - previous) / 1000, 0.1) * Number($('speed').value));
    previous = timestamp;
    if (time >= duration()) pause();
    render();
    if (running) frame = requestAnimationFrame(tick);
  }
  $('play').addEventListener('click', () => {
    if (running) pause();
    else if (duration() > 0) {
      if (time >= duration()) time = 0;
      running = true; previous = null; frame = requestAnimationFrame(tick);
    }
    render();
  });
  $('reset').addEventListener('click', reset);
  $('step').addEventListener('click', () => { pause(); time = Math.min(duration(), time + 0.05); render(); });
  $('time').addEventListener('input', () => { pause(); time = Number($('time').value) / 1000 * duration(); render(); });
  for (const id of ['v0', 'angle']) $(id).addEventListener('input', configure);
  $('singleMode').addEventListener('click', () => { mode = 'single'; configure(); });
  $('compareMode').addEventListener('click', () => { mode = 'compare'; configure(); });
  $('speed').addEventListener('change', () => { previous = null; });
  for (const id of ['prediction', 'trail', 'velocity', 'components', 'gravity']) $(id).addEventListener('change', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); } });

  function line(x1, y1, x2, y2, color, weight = 1, dash = []) {
    ctx.strokeStyle = color; ctx.lineWidth = weight; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  function text(label, x, y, color = '#b9ccdf', align = 'left') {
    ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(label, x, y);
  }
  function dot(x, y, radius, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill();
  }
  function arrow(x, y, dx, dy, color) {
    const length = Math.hypot(dx, dy);
    if (length < 0.01) return;
    const a = Math.atan2(dy, dx), head = Math.min(18, length * 0.6);
    line(x, y, x + dx, y + dy, color, 4.5);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - head * Math.cos(a - 0.48), y + dy - head * Math.sin(a - 0.48));
    ctx.lineTo(x + dx - head * Math.cos(a + 0.48), y + dy - head * Math.sin(a + 0.48));
    ctx.closePath(); ctx.fill();
  }
  function draw(list) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const vectors = $('velocity').checked || $('components').checked;
    const left = 50, top = 42;
    const bottom = height - (vectors ? 110 : $('gravity').checked ? 80 : 48);
    const right = width - (vectors ? 116 : 28);
    // Fit the full selected trajectories, keeping the viewport stable during playback.
    // Independent axis scales use both dimensions, including on narrow screens.
    const initialStates = list.map(shot => state(shot, 0));
    const limit = v0() ** 2 / 9.8;
    const range = Math.max(...initialStates.map(s => s.range)) || limit;
    const maxHeight = Math.max(...initialStates.map(s => s.maxHeight)) || limit / 2;
    const scaleX = (right - left) / range, scaleY = (bottom - top) / maxHeight;
    const X = x => left + x * scaleX, Y = y => bottom - y * scaleY;
    // Transform all velocity arrows together so their sum stays tangent to the drawn path.
    const velocityScale = 100 / Math.max(...initialStates.map(s => Math.hypot(s.vx * scaleX, s.vy * scaleY)));
    const tickSpacing = scale => {
      const rough = 65 / scale, power = 10 ** Math.floor(Math.log10(rough));
      return [1, 2, 5, 10].find(n => n * power >= rough) * power;
    };
    const spacingX = tickSpacing(scaleX), spacingY = tickSpacing(scaleY);
    for (let x = 0; x <= range; x += spacingX) {
      line(X(x), top, X(x), bottom, '#23364b');
      text(String(Number(x.toPrecision(4))), X(x), bottom + 20, '#b9ccdf', 'center');
    }
    for (let y = spacingY; y <= maxHeight; y += spacingY) {
      line(left, Y(y), right, Y(y), '#23364b');
      text(String(Number(y.toPrecision(4))), left - 8, Y(y) + 4, '#b9ccdf', 'right');
    }
    ctx.fillStyle = '#192e3b'; ctx.fillRect(left, bottom, right - left, 4);
    line(left, bottom, right + 12, bottom, '#8296aa', 1.5);
    line(left, bottom, left, top - 12, '#8296aa', 1.5);
    text('y (m)', 12, 20); text('x (m)', right + 12, height - 8, '#b9ccdf', 'right');
    if ($('gravity').checked) {
      ctx.font = 'bold 16px system-ui, sans-serif'; ctx.fillStyle = '#f4e66f'; ctx.textAlign = 'right';
      ctx.fillText('↓ g = 9.8 m/s²', width - 16, 24);
    }
    const path = (shot, end, dash, opacity) => {
      ctx.globalAlpha = opacity; ctx.strokeStyle = shot.color; ctx.lineWidth = dash.length ? 1.5 : 2.5; ctx.setLineDash(dash);
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) { const p = state(shot, end * i / 160); if (i === 0) ctx.moveTo(X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y)); }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    };
    const states = list.map(shot => state(shot, time));
    if ($('components').checked) list.forEach((shot, index) => {
      const s = states[index], px = X(s.x), py = Y(s.y);
      // Both independent motions use the projectile's clamped observation time.
      // Thus x = vx0 * t and y = vy0 * t - g * t² / 2 stay exactly aligned.
      if ($('prediction').checked) {
        line(left, bottom, X(s.range), bottom, componentColors.x, 2, [6, 6]);
        line(left, bottom, left, Y(s.maxHeight), componentColors.y, 2, [6, 6]);
      }
      line(left, bottom, px, bottom, componentColors.x, 3);
      const reachedHeight = s.t >= s.flightTime / 2 ? s.maxHeight : s.y;
      line(left, bottom, left, Y(reachedHeight), componentColors.y, 3);
      line(left, py, px, py, componentColors.y, 1, [4, 5]);
      line(px, py, px, bottom, componentColors.x, 1, [4, 5]);
      if ($('trail').checked) for (let t = 0.2; t < s.t; t += 0.2) {
        const p = state(shot, t);
        dot(X(p.x), bottom, 2.5, componentColors.x);
        dot(left, Y(p.y), 2.5, componentColors.y);
      }
      ctx.fillStyle = componentColors.x;
      ctx.fillRect(px - 6, bottom - 6, 12, 12);
      ctx.fillStyle = componentColors.y;
      ctx.beginPath(); ctx.moveTo(left, py - 9); ctx.lineTo(left + 9, py);
      ctx.lineTo(left, py + 9); ctx.lineTo(left - 9, py); ctx.closePath(); ctx.fill();
      const xOverlap = states.slice(0, index).filter(other => Math.abs(other.x - s.x) * scaleX < 18).length;
      const yOverlap = states.slice(0, index).filter(other => Math.abs(other.y - s.y) * scaleY < 18).length;
      text(`${shot.name}ₓ`, px + (xOverlap % 3) * 24, bottom + 40 + Math.floor(xOverlap / 3) * 16, componentColors.x, 'center');
      text(`${shot.name}ᵧ`, left + 14 + yOverlap * 24, py + 18, componentColors.y);
    });
    list.forEach((shot, index) => {
      const s = states[index];
      if ($('prediction').checked) path(shot, s.flightTime, [6, 6], 0.55);
      path(shot, s.t, [], 1);
      if ($('trail').checked) for (let t = 0.2; t < s.t; t += 0.2) { const p = state(shot, t); dot(X(p.x), Y(p.y), 2.5, shot.color); }
      if ($('velocity').checked && !s.landed) {
        const dx = s.vx * scaleX * velocityScale, dy = -s.vy * scaleY * velocityScale;
        arrow(X(s.x), Y(s.y), dx, dy, shot.color);
      }
      if ($('components').checked && !s.landed) {
        // Use the same velocity scale as the resultant arrow.
        const dx = s.vx * scaleX * velocityScale, dy = -s.vy * scaleY * velocityScale;
        arrow(X(s.x), Y(s.y), dx, 0, componentColors.x);
        arrow(X(s.x), Y(s.y), 0, dy, componentColors.y);
        text('vₓ', X(s.x) + dx + 5, Y(s.y) - 5, componentColors.x);
        text('vᵧ', X(s.x) - 8, Y(s.y) + dy - 7, componentColors.y, 'right');
        arrow(X(s.x), bottom, dx, 0, componentColors.x);
        arrow(left, Y(s.y), 0, dy, componentColors.y);
      }
      if ($('gravity').checked && !s.landed) arrow(X(s.x), Y(s.y), 0, 66, '#f4e66f');
      // Concentric outlines and staggered labels keep coincident launches/landings identifiable.
      const overlap = states.slice(0, index).filter(other => Math.hypot((other.x - s.x) * scaleX, (other.y - s.y) * scaleY) < 1).length;
      const px = X(s.x), py = Y(s.y), radius = 7 + overlap * 2;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.strokeStyle = shot.color; ctx.lineWidth = 2; ctx.stroke();
      if (mode === 'single') dot(px, py, 4, shot.color);
      text(`${shot.name} ${shot.angle}°`, Math.min(px + radius + 6, width - 60), Math.max(40, py - 14 - overlap * 18), shot.color);
    });
  }
  function resize() {
    const box = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    width = box.width; height = box.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }
  configure();
  new ResizeObserver(resize).observe(canvas);
  resize();
})();
