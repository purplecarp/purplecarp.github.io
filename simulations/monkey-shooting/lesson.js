(() => {
  'use strict';
  const C = LessonColors, M = PhysicsModel;
  const labels = { flight: '同時受重力作用', hit: '箭矢與猴子相遇', 'bullet-ground': '箭矢先落地，未相遇', 'monkey-ground': '猴子先落地，未相遇' };
  const R = MonkeyScene3D;
  const orbit = { ...R.DEFAULT_ORBIT };
  const modes = ['orbit', 'monkey', 'arrow'];
  const descriptions = [
    '拖曳場景旋轉，滾輪縮放；也可用下方按鈕。藍色為箭矢，黃色為猴子，橘色虛線為重力下移量。',
    '你正隨猴子自由落下，視線固定朝原始發射方向。觀察箭矢沿直線接近：兩者的相對加速度為零。',
    '你跟著箭尖飛行，攝影機持續看向猴子。觀察猴子逐漸接近，以及樹木與地面的相對移動。'
  ];
  function draw(a, s) {
    const mode = modes[a.view];
    R.draw(a, s, mode, orbit);
    const help = document.getElementById('camera-help');
    if (help && help.textContent !== descriptions[a.view]) help.textContent = descriptions[a.view];
    const buttons = document.getElementById('orbit-controls');
    if (buttons) buttons.hidden = mode !== 'orbit';
    a.canvas.style.touchAction = mode === 'orbit' ? 'none' : 'pan-y';
    a.canvas.style.cursor = mode === 'orbit' ? 'grab' : 'default';
    a.canvas.setAttribute('aria-label', `${a.config.views[a.view].label}；${labels[s.status]}；時間 ${s.t.toFixed(2)} 秒`);
    const heading = document.querySelector('.paired-primary h2');
    if (heading) heading.textContent = a.config.views[a.view].label;
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
    title: '3D 猴子射擊問題：箭矢斜拋與猴子自由落下',
    defaults: { v0: 22, aim: true, trail: true, drop: true, speed: 1 },
    controlsHelp: '調整箭矢初速度會回到起點；瞄準角度固定。視角切換、播放速度與顯示選項保留進度；可暫停或慢速觀察。',
    controls: [
      { key: 'v0', label: '箭矢初速度 v₀', min: 5, max: 40, step: .5, digits: 1, unit: 'm/s' },
      { key: 'aim', label: '原始瞄準線', type: 'check', display: true },
      { key: 'trail', label: '等時距軌跡', type: 'check', display: true },
      { key: 'drop', label: '等量下落對照', type: 'check', display: true }
    ],
    state: M.state, duration: p => M.events(p).duration, step: .05,
    views: [{ label: '3D 全景', draw }, { label: '猴子視角', draw }, { label: '箭矢視角', draw }],
    comparisonLayout: 'paired',
    comparisonTitle: '高度－時間關係圖',
    comparisonViews: [{ label: '高度－時間關係圖', draw: heightGraph }],
    metrics: (p, s) => [['箭矢高度', s.bullet.y.toFixed(2), 'm'], ['猴子高度', s.monkey.y.toFixed(2), 'm'],
      ['兩者距離', s.separation.toFixed(2), 'm'], ['重力下移量', s.drop.toFixed(2), 'm']],
    note: (p, s) => `藍色：箭矢；黃色：猴子。${s.t === 0 ? '發射與鬆手同時發生' : labels[s.status]}。空中相遇需 v₀ > ${M.MIN_SPEED.toFixed(2)} m/s；g = 9.8 m/s²。`,
    presets: [
      { label: '① 直接瞄準 · 22 m/s', values: { v0: 22 }, question: '猴子鬆手後，瞄準原始位置的箭矢會從牠上方通過嗎？', answer: '兩者都因重力下移 ½gt²，因此仍會相遇。22 m/s 時約在 1.31 s、高度 9.58 m 處相遇。' },
      { label: '② 提高初速度 · 32 m/s', values: { v0: 32 }, question: '只提高箭矢初速度，相遇位置會變高還是變低？', answer: '初速度提高，相遇時間縮短、下落量減少，因此相遇位置更高；瞄準角度不必改變。' },
      { label: '③ 速度太低 · 10 m/s', values: { v0: 10 }, question: '只要瞄準猴子，不論初速度多小都一定能在空中相遇嗎？', answer: '不一定。這個情境需要初速度大於約 15.05 m/s 才能在空中相遇。10 m/s 時箭矢先落地，模擬在落地時停止。' }
    ]
  });
  const app = window.lesson;
  const cameraTools = document.createElement('div');
  cameraTools.className = 'camera-tools';
  cameraTools.innerHTML = `<p id="camera-help"></p><div id="orbit-controls" role="group" aria-label="3D 全景攝影機操作">
    <button data-camera="left" aria-label="向左旋轉">↶ 左轉</button><button data-camera="right" aria-label="向右旋轉">右轉 ↷</button>
    <button data-camera="up" aria-label="提高觀察角度">↑ 仰角</button><button data-camera="down" aria-label="降低觀察角度">↓ 俯角</button>
    <button data-camera="in" aria-label="拉近場景">＋ 拉近</button><button data-camera="out" aria-label="拉遠場景">− 拉遠</button>
    <button data-camera="reset">重設視角</button></div>`;
  app.canvas.parentElement.after(cameraTools);
  document.querySelector('.lesson-views').setAttribute('aria-label', '觀察視角');
  function constrain() {
    orbit.pitch = Math.max(.05, Math.min(1.25, orbit.pitch));
    orbit.distance = Math.max(24, Math.min(85, orbit.distance));
  }
  function adjust(action) {
    if (action === 'left') orbit.yaw -= .18;
    if (action === 'right') orbit.yaw += .18;
    if (action === 'up') orbit.pitch += .1;
    if (action === 'down') orbit.pitch -= .1;
    if (action === 'in') orbit.distance /= 1.12;
    if (action === 'out') orbit.distance *= 1.12;
    if (action === 'reset') Object.assign(orbit, R.DEFAULT_ORBIT);
    constrain(); app.render();
  }
  cameraTools.querySelectorAll('[data-camera]').forEach(b => b.onclick = () => adjust(b.dataset.camera));
  let drag = null;
  app.canvas.addEventListener('pointerdown', e => {
    if (app.view !== 0 || !e.isPrimary || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    app.canvas.setPointerCapture(e.pointerId);
  });
  app.canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || app.view !== 0) return;
    orbit.yaw -= (e.clientX - drag.x) * .008;
    orbit.pitch += (e.clientY - drag.y) * .006;
    drag.x = e.clientX; drag.y = e.clientY;
    constrain(); app.render();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) app.canvas.addEventListener(event, () => { drag = null; });
  app.canvas.addEventListener('wheel', e => {
    if (app.view !== 0) return;
    e.preventDefault(); orbit.distance *= Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * .002);
    constrain(); app.render();
  }, { passive: false });
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-describedby', 'camera-help');
  app.canvas.addEventListener('keydown', e => {
    if (app.view !== 0) return;
    const action = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '-': 'out', Home: 'reset' }[e.key];
    if (action) { e.preventDefault(); adjust(action); }
  });
  app.$('defaults').addEventListener('click', () => { app.view=0;Object.assign(orbit,R.DEFAULT_ORBIT);document.querySelector('[data-view="0"]').click(); });
  app.render();
})();