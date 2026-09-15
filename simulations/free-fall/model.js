/* Vertical free-fall model. SI units; ground is x = 0 and upward is positive. */
(function (root) {
  'use strict';

  function validate({ height, v0, gravity }) {
    if (![height, v0, gravity].every(Number.isFinite) || height < 0 || gravity <= 0) {
      throw new RangeError('Expected finite values with height >= 0 and gravity > 0.');
    }
  }

  function impactTime(parameters) {
    validate(parameters);
    const { height, v0, gravity } = parameters;
    return (v0 + Math.sqrt(v0 * v0 + 2 * gravity * height)) / gravity;
  }

  function stateAt(parameters, time) {
    validate(parameters);
    if (!Number.isFinite(time)) throw new RangeError('Expected a finite time.');
    const duration = impactTime(parameters);
    const t = Math.max(0, Math.min(time, duration));
    const x = parameters.height + parameters.v0 * t - 0.5 * parameters.gravity * t * t;
    const v = parameters.v0 - parameters.gravity * t;
    return {
      t,
      x: Math.max(0, x),
      v,
      a: -parameters.gravity,
      duration,
      landed: t >= duration,
      peakTime: Math.max(0, parameters.v0 / parameters.gravity),
      peakHeight: parameters.height + Math.max(0, parameters.v0) ** 2 / (2 * parameters.gravity)
    };
  }

  function samples(parameters, count = 160) {
    const duration = impactTime(parameters);
    return Array.from({ length: count + 1 }, (_, index) =>
      stateAt(parameters, duration * index / count)
    );
  }

  const api = { impactTime, stateAt, samples };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FreeFallModel = api;
})(globalThis);
