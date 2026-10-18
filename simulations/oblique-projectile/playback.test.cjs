const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('./model.js');

function app() {
  const nodes = new Map(), frames = new Map(), drawing = [];
  let frameId = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', checked: false, textContent: '', children: [], attrs: {}, listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      set innerHTML(value) { this.markup = value; this.children = Array.from({ length: (value.match(/<tr>/g) || []).length }, () => ({ children: Array.from({ length: 7 }, () => ({ textContent: '' })) })); },
      getBoundingClientRect() { return { width: 700, height: 400 }; },
      getContext() { return new Proxy({}, { get: (target, key) => target[key] || ((...args) => {
        if (key === 'arc') assert.ok(args[2] > 0, 'All seven balls must have positive radii');
        if (key === 'clearRect') drawing.length = 0;
        drawing.push({ method: key, args, color: target.strokeStyle, weight: target.lineWidth });
      }), set: (target, key, value) => { target[key] = value; return true; } }); }
    });
    return nodes.get(id);
  };
  for (const [id, value] of Object.entries({ v0: 20, angle: 45, speed: 1, time: 0 })) node(id).value = String(value);
  node('prediction').checked = node('trail').checked = true;
  const document = { getElementById: node, listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; } };
  const context = { document, window: { devicePixelRatio: 1 }, ObliqueProjectileModel: model,
    ResizeObserver: class { observe() {} },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./lesson.js'), 'utf8'), context);
  return { node, document, frames, drawing,
    fire(id, type = 'click', value) { if (value !== undefined) node(id).value = String(value); node(id).listeners[type](); },
    tick(stamp) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(stamp)); } };
}

test('compare mode launches all seven requested angles on one clock, stops at last impact, and replays', () => {
  const a = app();
  a.fire('compareMode'); assert.equal(a.node('results').children.length, 7);
  for (const [i, angle] of [0, 15, 30, 45, 60, 75, 90].entries()) {
    assert.ok(a.node('legend').markup.includes(`${'ABCDEFG'[i]} · ${angle}° · 20 m/s`));
    const row = a.node('results').children[i];
    assert.equal(row.children[5].textContent, model.stateAt({ v0: 20, angle }, 0).flightTime.toFixed(2));
  }
  assert.equal(a.node('compareControls').hidden, false);
  a.fire('play'); a.tick(0);
  for (let stamp = 100; stamp <= 2300; stamp += 100) a.tick(stamp);
  const rows = a.node('results').children;
  assert.equal(rows[0].children[6].textContent, '已落地');
  assert.equal(rows[2].children[6].textContent, '已落地');
  assert.equal(rows[4].children[6].textContent, '飛行中');
  assert.equal(rows[6].children[6].textContent, '飛行中');
  for (let stamp = 2400; stamp <= 5000; stamp += 100) a.tick(stamp);
  assert.equal(a.node('status').textContent, '全部已落地'); assert.equal(a.frames.size, 0);
  a.fire('play'); assert.equal(a.node('timeValue').textContent, '0.00 s'); assert.equal(a.frames.size, 1);
});
test('pause, seek, step, reset and parameter changes retain a single animation loop', () => {
  const a = app();
  a.fire('play'); a.tick(0); a.tick(100); a.fire('play');
  assert.equal(a.frames.size, 0); assert.equal(a.node('timeValue').textContent, '0.10 s');
  a.fire('step'); assert.equal(a.node('timeValue').textContent, '0.15 s');
  a.fire('time', 'input', 500); assert.equal(a.node('timeValue').textContent, '1.44 s');
  a.fire('play'); a.fire('v0', 'input', 40);
  assert.equal(a.node('timeValue').textContent, '0.00 s'); assert.equal(a.frames.size, 0);
  a.fire('play'); a.tick(0); a.tick(100); a.fire('reset');
  assert.equal(a.node('timeValue').textContent, '0.00 s'); assert.equal(a.frames.size, 0);
});
test('zero-degree and vertical shots and mode changes update controls safely', () => {
  const a = app();
  a.fire('angle', 'input', 0); assert.equal(a.node('play').disabled, true); assert.equal(a.node('time').disabled, true);
  a.fire('compareMode');
  a.fire('time', 'input', 500);
  assert.equal(a.node('results').children[0].children[6].textContent, '已落地');
  assert.equal(a.node('results').children[6].children[1].textContent, '0.00');
  a.fire('singleMode'); assert.equal(a.node('results').children.length, 1); assert.equal(a.node('compareControls').hidden, true);
});

test('gravity toggle draws downward vectors and g value without resetting time or playback', () => {
  const a = app(); a.fire('compareMode'); a.fire('time', 'input', 300);
  const time = a.node('timeValue').textContent;
  assert.ok(!a.drawing.some(call => call.method === 'fillText' && call.args[0].includes('g =')));
  a.node('gravity').checked = true; a.fire('gravity', 'change');
  assert.equal(a.node('timeValue').textContent, time);
  assert.ok(a.drawing.some(call => call.method === 'fillText' && call.args[0] === '↓ g = 9.8 m/s²'));
  const shafts = a.drawing.filter(call => call.method === 'stroke' && call.color === '#f4e66f' && call.weight === 4.5);
  assert.equal(shafts.length, 5, '0 and 15 degrees have landed; five gravity arrows remain');
  for (let i = 0; i < a.drawing.length; i++) {
    const call = a.drawing[i];
    if (call.method !== 'stroke' || call.color !== '#f4e66f' || call.weight !== 4.5) continue;
    const from = a.drawing[i - 2].args, to = a.drawing[i - 1].args;
    assert.equal(to[0], from[0]); assert.equal(to[1] - from[1], 66);
  }
  a.fire('play'); a.node('gravity').checked = false; a.fire('gravity', 'change');
  assert.equal(a.frames.size, 1); assert.equal(a.node('timeValue').textContent, time);
  assert.ok(!a.drawing.some(call => call.method === 'fillText' && call.args[0].includes('g =')));
  a.node('gravity').checked = true; a.fire('gravity', 'change'); a.fire('time', 'input', 1000);
  assert.ok(!a.drawing.some(call => call.method === 'stroke' && call.color === '#f4e66f' && call.weight === 4.5));
});

test('velocity arrows have enlarged shafts and filled heads', () => {
  const a = app(); a.node('velocity').checked = true; a.fire('velocity', 'change');
  const index = a.drawing.findIndex(call => call.method === 'stroke' && call.weight === 4.5);
  assert.ok(index > 1);
  const from = a.drawing[index - 2].args, to = a.drawing[index - 1].args;
  assert.ok(Math.abs(Math.hypot(to[0] - from[0], to[1] - from[1]) - 100) < 1e-9);
  assert.ok(a.drawing.some(call => call.method === 'closePath'));
});
test('hidden tab pauses instead of advancing unseen', () => {
  const a = app(); a.fire('play'); a.tick(0); a.tick(100);
  a.document.hidden = true; a.document.listeners.visibilitychange();
  assert.equal(a.frames.size, 0); assert.equal(a.node('status').textContent, '已暫停');
});
