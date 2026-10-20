(() => {
  'use strict';
  const C = LessonColors, M = PhysicsModel;
  const labels = { flight: '同時受重力作用', hit: '子彈與猴子相遇', 'bullet-ground': '子彈先落地，未相遇', 'monkey-ground': '猴子先落地，未相遇' };
  function monkey(a, x, y) {
    const c = a.ctx;
    c.save(); c.translate(x, y);
    c.strokeStyle = '#c89a6c'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(8, 8); c.bezierCurveTo(29, 22, 29, -4, 20, 2); c.stroke();
    a.line(-5, 1, -14, -11, '#c89a6c', 5); a.line(5, 1, 14, -11, '#c89a6c', 5);
    a.line(-4, 9, -11, 17, '#c89a6c', 5); a.line(4, 9, 11, 17, '#c89a6c', 5);
    a.dot(0, 3, 10, '#a77850'); a.dot(-10, -13, 5, '#c89a6c'); a.dot(10, -13, 5, '#c89a6c');
    a.dot(0, -12, 11, '#a77850'); a.dot(0, -10, 8, '#f3d5ac');
    a.dot(-3, -13, 1.5, '#182638'); a.dot(3, -13, 1.5, '#182638');
    a.dot(0, 0, 3, C.yellow);
    c.restore();
  }
  function draw(a, s) {
    const scale = Math.min((a.width - 64) / 32, (a.height - 110) / 26);
    const left = (a.width - 32 * scale) / 2 + 3 * scale;
    const bottom = a.height - 36;
    const X = x => left + x * scale, Y = y => bottom - y * scale;
    const c = a.ctx, bx = X(s.bullet.x), by = Y(s.bullet.y), mx = X(M.DISTANCE), my = Y(s.monkey.y);
    a.text('固定瞄準 · 33.7°', 14, 30, C.ink, 24);
    a.text(labels[s.status], 14, 61, s.status === 'hit' ? C.green : C.yellow, 24);
    for (const y of [6, 12, 18]) a.line(X(-2), Y(y), X(29), Y(y));
    a.line(X(-2), Y(0), X(29), Y(0), '#7eaa87', 3);
    a.text('地面', X(0), Y(0) + 27, C.ink, 20);
    // Tree branch stays at the initial monkey position.
    a.line(X(28), Y(0), X(28), Y(22), '#88674d', 12);
    a.line(X(28), Y(21), X(23), Y(21), '#88674d', 6);
    for (const [x, y, r] of [[26, 23, 2.2], [29, 22, 2], [24, 23, 1.8]]) a.dot(X(x), Y(y), r * scale, '#295b4d');
    a.line(X(M.DISTANCE), Y(0), X(M.DISTANCE), Y(M.HEIGHT), C.yellow, 1.5, [4, 5]);
    if (a.p.aim) a.line(X(0), Y(M.LAUNCH_HEIGHT), X(M.DISTANCE), Y(M.HEIGHT), C.ink, 2, [8, 6]);
    // Launcher direction is fixed by the initial line of sight.
    a.line(X(-1), Y(0), X(0), Y(2), C.ink, 5);
    a.line(X(-1.5), Y(1), X(0), Y(2), C.blue, 10);
    if (a.p.trail) {
      for (let t = 0; t < s.t; t += .05) {
        const z = M.state(a.p, t);
        a.dot(X(z.bullet.x), Y(z.bullet.y), 2.5, C.blue);
        a.dot(mx, Y(z.monkey.y), 2.5, C.yellow);
      }
    }
    if (a.p.drop) {
      a.line(bx, Y(s.ghost.y), bx, by, C.orange, 3, [5, 5]);
      a.line(mx, Y(M.HEIGHT), mx, my, C.orange, 3, [5, 5]);
      c.save(); c.globalAlpha = .4;
      a.dot(bx, Y(s.ghost.y), 7, C.blue); monkey(a, mx, Y(M.HEIGHT));
      c.restore();
    }
    monkey(a, mx, my);
    a.dot(bx, by, 7, C.blue);
    if (s.status === 'hit') {
      c.strokeStyle = C.green; c.lineWidth = 3; c.beginPath(); c.arc(bx, by, 25, 0, 2 * Math.PI); c.stroke();
    }
  }
  function heightGraph(a, s) {
    const data = { bullet: [], monkey: [] };
    for (let i = 0; i <= 100; i++) {
      const z = M.state(a.p, s.t * i / 100);
      data.bullet.push({ x: z.t, y: z.bullet.y }); data.monkey.push({ x: z.t, y: z.monkey.y });
    }
    a.graph({ xmax: a.duration, ymin: 0, ymax: 20, ylabel: '高度 y (m)',
      series: [{ color: C.blue, data: data.bullet }, { color: C.yellow, data: data.monkey }],
      points: [{ x: s.t, y: s.bullet.y, color: C.blue }, { x: s.t, y: s.monkey.y, color: C.yellow }] });
  }
  window.lesson = new Classroom({
    title: '猴子射擊問題：子彈斜拋與猴子自由落下',
    defaults: { v0: 22, aim: true, trail: true, drop: true, speed: 1 },
    controlsHelp: '調整子彈初速度會回到起點；瞄準角度固定。播放速度與顯示選項保留進度。',
    controls: [
      { key: 'v0', label: '子彈初速度 v₀', min: 5, max: 40, step: .5, digits: 1, unit: 'm/s' },
      { key: 'aim', label: '原始瞄準線', type: 'check', display: true },
      { key: 'trail', label: '等時距軌跡', type: 'check', display: true },
      { key: 'drop', label: '等量下落對照', type: 'check', display: true }
    ],
    state: M.state, duration: p => M.events(p).duration, step: .05,
    views: [{ label: '運動演示', draw }],
    comparisonLayout: 'paired',
    comparisonTitle: '高度－時間關係圖',
    comparisonViews: [{ label: '高度－時間關係圖', draw: heightGraph }],
    metrics: (p, s) => [['子彈高度', s.bullet.y.toFixed(2), 'm'], ['猴子高度', s.monkey.y.toFixed(2), 'm'],
      ['兩者距離', s.separation.toFixed(2), 'm'], ['重力下移量', s.drop.toFixed(2), 'm']],
    note: (p, s) => `藍色：子彈；黃色：猴子。${s.t === 0 ? '發射與鬆手同時發生' : labels[s.status]}。空中相遇需 v₀ > ${M.MIN_SPEED.toFixed(2)} m/s；g = 9.8 m/s²。`,
    presets: [
      { label: '① 直接瞄準 · 22 m/s', values: { v0: 22 }, question: '猴子鬆手後，瞄準原始位置的子彈會從牠上方通過嗎？', answer: '兩者都因重力下移 ½gt²，因此仍會相遇。22 m/s 時約在 1.31 s、高度 9.58 m 處相遇。' },
      { label: '② 提高初速度 · 32 m/s', values: { v0: 32 }, question: '只提高子彈初速度，相遇位置會變高還是變低？', answer: '初速度提高，相遇時間縮短、下落量減少，因此相遇位置更高；瞄準角度不必改變。' },
      { label: '③ 速度太低 · 10 m/s', values: { v0: 10 }, question: '只要瞄準猴子，不論初速度多小都一定能在空中相遇嗎？', answer: '不一定。這個情境需要初速度大於約 15.05 m/s 才能在空中相遇。10 m/s 時子彈先落地，模擬在落地時停止。' }
    ]
  });
})();