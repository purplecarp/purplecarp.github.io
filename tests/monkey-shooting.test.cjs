const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../simulations/monkey-shooting/model.js');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('initial aim and hand-calculated state at one second', () => {
  const s = M.state({ v0: M.LENGTH }, 1);
  near(s.bullet.x, 24); near(s.bullet.y, 13.1); near(s.monkey.y, 13.1);
  near(s.drop, 4.9); near(s.separation, 0); assert.equal(s.status, 'hit');
  const start = M.state({ v0: 22 }, 0);
  near(start.bullet.x, 0); near(start.bullet.y, 2); near(start.monkey.y, 18);
  near(start.bullet.vy / start.bullet.vx, 16 / 24); near(start.monkey.vy, 0);
});
test('every supported speed obeys equal gravitational displacement and exact event termination', () => {
  for (let v0 = 5; v0 <= 40; v0 += .5) {
    const p = { v0 }, e = M.events(p);
    assert.ok(Number.isFinite(e.duration) && e.duration > 0);
    for (const fraction of [0, .25, .5, .75, 1]) {
      const s = M.state(p, e.duration * fraction);
      near(s.ghost.y - s.bullet.y, s.drop); near(18 - s.monkey.y, s.drop);
      near(s.bullet.vy - s.monkey.vy, e.vy);
      assert.ok(s.bullet.y >= 0 && s.monkey.y >= 0);
    }
    const end = M.state(p, e.duration);
    assert.deepEqual(M.state(p, e.duration + 5), end);
    if (e.hit) { near(end.separation, 0); near(end.bullet.x, 24); assert.equal(end.status, 'hit'); }
    else { assert.ok(end.separation > 0); near(Math.min(end.bullet.y, end.monkey.y), 0); }
  }
});
test('ground boundary, insufficient speed and zero launch speed', () => {
  const boundary = M.state({ v0: M.MIN_SPEED }, M.FALL_TIME);
  assert.equal(boundary.status, 'hit'); near(boundary.bullet.y, 0); near(boundary.separation, 0);
  assert.equal(M.events({ v0: M.MIN_SPEED - .001 }).hit, false);
  assert.equal(M.events({ v0: M.MIN_SPEED + .001 }).hit, true);
  for (const v0 of [0, 5, 10]) {
    const e = M.events({ v0 }), s = M.state({ v0 }, e.duration);
    assert.equal(s.status, 'bullet-ground'); near(s.bullet.y, 0);
  }
  near(M.events({ v0: 0 }).duration, Math.sqrt(4 / 9.8));
});
test('higher initial speed gives earlier and higher encounters; rewinding restores the initial state', () => {
  const slow = M.state({ v0: 22 }, 10), fast = M.state({ v0: 32 }, 10);
  assert.ok(fast.t < slow.t); assert.ok(fast.bullet.y > slow.bullet.y);
  near(slow.bullet.y, 18 - 4.9 * 832 / 484);
  const initial = M.state({ v0: 22 }, 0);
  M.state({ v0: 22 }, 1);
  assert.deepEqual(M.state({ v0: 22 }, 0), initial);
});