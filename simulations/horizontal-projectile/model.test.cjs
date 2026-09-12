const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stateAt } = require('./model.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const p = { v0: 12, height: 18, gravity: 9.8 };
test('known trajectory and independent vertical motion', () => {
  const s = stateAt(p, 1), faster = stateAt({ ...p, v0: 24 }, 1);
  close(s.x, 12); close(s.y, 13.1); close(s.vy, -9.8);
  close(faster.y, s.y); close(faster.flightTime, s.flightTime); close(faster.range, 2 * s.range);
});
test('landing clamps exactly and retains pre-impact velocity', () => {
  const s = stateAt(p, 100);
  close(s.t, Math.sqrt(36 / 9.8)); close(s.y, 0); close(s.x, s.range);
  close(s.vy, -Math.sqrt(2 * p.gravity * p.height)); assert.equal(s.landed, true);
});
test('zero horizontal speed is free fall', () => {
  const s = stateAt({ ...p, v0: 0 }, 1);
  close(s.x, 0); close(s.range, 0); close(s.y, 13.1); close(s.speed, 9.8);
});
test('mechanical energy conserved across parameter extremes', () => {
  for (const v0 of [0, 12, 30]) for (const height of [2, 18, 35]) for (const gravity of [1, 9.8, 20]) {
    const params = { v0, height, gravity }, end = stateAt(params, 100);
    for (const fraction of [0, 0.25, 0.5, 1]) {
      const s = stateAt(params, fraction * end.flightTime);
      close(s.speed ** 2 / 2 + gravity * s.y, v0 ** 2 / 2 + gravity * height);
    }
  }
});
test('negative time clamps to launch and invalid input is rejected', () => {
  close(stateAt(p, -1).t, 0);
  assert.throws(() => stateAt({ ...p, gravity: 0 }, 1), RangeError);
});
