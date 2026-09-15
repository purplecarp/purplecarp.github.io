const { test } = require('node:test');
const assert = require('node:assert/strict');
const { impactTime, stateAt, samples } = require('./model.js');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('drop from rest follows constant-acceleration equations', () => {
  const p = { height: 19.6, v0: 0, gravity: 9.8 };
  close(impactTime(p), 2);
  const s = stateAt(p, 1);
  close(s.x, 14.7); close(s.v, -9.8); close(s.a, -9.8);
});

test('downward launch reaches the ground sooner', () => {
  const still = { height: 60, v0: 0, gravity: 9.8 };
  const down = { ...still, v0: -12 };
  assert.ok(impactTime(down) < impactTime(still));
  assert.ok(stateAt(down, 0.5).x < stateAt(still, 0.5).x);
});

test('upward launch reaches the predicted peak then falls', () => {
  const p = { height: 40, v0: 19.6, gravity: 9.8 };
  const peak = stateAt(p, 2);
  close(peak.v, 0); close(peak.x, 59.6); close(peak.peakHeight, 59.6);
  assert.ok(impactTime(p) > 4);
});

test('time clamps at impact and sample endpoints are exact', () => {
  const p = { height: 25, v0: 8, gravity: 9.8 };
  const end = stateAt(p, 999);
  close(end.t, impactTime(p)); close(end.x, 0); assert.equal(end.landed, true);
  const points = samples(p, 20);
  close(points[0].t, 0); close(points.at(-1).t, end.t); close(points.at(-1).x, 0);
});

test('ground-level starts support both immediate impact and upward launch', () => {
  const grounded = { height: 0, v0: 0, gravity: 9.8 };
  close(impactTime(grounded), 0);
  const still = stateAt(grounded, 1);
  close(still.x, 0); close(still.t, 0); assert.equal(still.landed, true);

  const upward = { height: 0, v0: 9.8, gravity: 9.8 };
  close(impactTime(upward), 2);
  close(stateAt(upward, 1).x, 4.9);
});

test('invalid parameters are rejected', () => {
  assert.throws(() => stateAt({ height: -1, v0: 0, gravity: 9.8 }, 0), RangeError);
  assert.throws(() => stateAt({ height: 10, v0: 0, gravity: 0 }, 0), RangeError);
  assert.throws(() => stateAt({ height: 10, v0: 0, gravity: 9.8 }, NaN), RangeError);
});
