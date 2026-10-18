/* Ground-level launch, SI units, positive y upward; no air resistance. */
(function (root) {
  'use strict';
  function stateAt({ v0, angle, gravity = 9.8 }, time) {
    if (![v0, angle, gravity, time].every(Number.isFinite) || v0 < 0 || angle < 0 || angle > 90 || gravity <= 0) {
      throw new RangeError('Expected v0 >= 0, 0 <= angle <= 90, gravity > 0 and finite time.');
    }
    const radians = angle * Math.PI / 180;
    const vx = angle === 90 ? 0 : v0 * Math.cos(radians);
    const vy0 = v0 * Math.sin(radians);
    const flightTime = 2 * vy0 / gravity;
    const t = Math.max(0, Math.min(time, flightTime));
    const vy = vy0 - gravity * t;
    return { t, x: vx * t, y: t === flightTime ? 0 : Math.max(0, vy0 * t - gravity * t * t / 2),
      vx, vy, speed: Math.hypot(vx, vy), flightTime, range: vx * flightTime,
      maxHeight: vy0 * vy0 / (2 * gravity), landed: time >= flightTime };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { stateAt };
  else root.ObliqueProjectileModel = { stateAt };
})(globalThis);
