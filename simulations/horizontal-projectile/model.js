/* SI units; origin on the ground below launch, positive y upward. */
(function (root) {
  'use strict';
  function stateAt({ v0, height, gravity }, time) {
    if (![v0, height, gravity, time].every(Number.isFinite) || v0 < 0 || height <= 0 || gravity <= 0) {
      throw new RangeError('Expected finite values, v0 >= 0, height > 0, gravity > 0.');
    }
    const flightTime = Math.sqrt(2 * height / gravity);
    const t = Math.max(0, Math.min(time, flightTime));
    const vy = -gravity * t;
    return { t, x: v0 * t, y: Math.max(0, height - gravity * t * t / 2),
      vx: v0, vy, speed: Math.hypot(v0, vy), ax: 0, ay: -gravity,
      flightTime, range: v0 * flightTime, landed: t >= flightTime };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { stateAt };
  else root.ProjectileModel = { stateAt };
})(globalThis);
