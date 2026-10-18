const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stateAt } = require('./model.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('45 degree launch has correct initial components, apex and landing', () => {
  const p = { v0: 20, angle: 45 }, start = stateAt(p, 0);
  near(start.vx, 20 / Math.sqrt(2)); near(start.vy, start.vx);
  const apex = stateAt(p, start.flightTime / 2);
  near(apex.vy, 0); near(apex.y, 400 / 39.2); near(apex.x, start.range / 2);
  const end = stateAt(p, start.flightTime);
  near(end.x, 400 / 9.8); near(end.y, 0); near(end.speed, 20); assert.equal(end.landed, true);
});
test('complementary angles share range, while 45 degrees has the longest range', () => {
  for (const angle of [1, 15, 30, 40]) {
    const low = stateAt({ v0: 30, angle }, 0), high = stateAt({ v0: 30, angle: 90 - angle }, 0);
    near(low.range, high.range); assert.ok(high.flightTime > low.flightTime); assert.ok(high.maxHeight > low.maxHeight);
    assert.ok(low.range < stateAt({ v0: 30, angle: 45 }, 0).range);
  }
});
test('shared clock keeps later shots airborne and earlier shots fixed at their landing point', () => {
  const p = { v0: 20, angle: 30 }, end = stateAt(p, 0).flightTime;
  const low = stateAt(p, end + 0.1), high = stateAt({ ...p, angle: 60 }, end + 0.1);
  assert.equal(low.landed, true); near(low.x, low.range); near(low.y, 0);
  assert.equal(high.landed, false); assert.ok(high.y > 0); near(high.t, end + 0.1);
  near(stateAt(p, 100).x, low.x);
});
test('zero degrees, vertical launch, zero speed and negative time stay finite', () => {
  const flat = stateAt({ v0: 20, angle: 0 }, 0);
  near(flat.range, 0); near(flat.flightTime, 0); assert.equal(flat.landed, true);
  const vertical = stateAt({ v0: 20, angle: 90 }, 1);
  near(vertical.x, 0); near(vertical.y, 15.1); near(vertical.range, 0);
  near(stateAt({ v0: 0, angle: 45 }, 1).maxHeight, 0);
  near(stateAt({ v0: 20, angle: 45 }, -1).t, 0);
});
test('doubling speed quadruples range and height and doubles flight time', () => {
  const a = stateAt({ v0: 15, angle: 37 }, 0), b = stateAt({ v0: 30, angle: 37 }, 0);
  near(b.range, 4 * a.range); near(b.maxHeight, 4 * a.maxHeight); near(b.flightTime, 2 * a.flightTime);
});
test('invalid parameters are rejected', () => {
  for (const p of [{ v0: -1, angle: 45 }, { v0: 20, angle: 91 }, { v0: 20, angle: -1 }, { v0: NaN, angle: 45 }, { v0: 20, angle: 45, gravity: 0 }]) assert.throws(() => stateAt(p, 0), RangeError);
});
