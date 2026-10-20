/* SI units. The projectile and monkey are point particles; stop at the first event. */
(function (root) {
  'use strict';
  const G = 9.8, DISTANCE = 24, HEIGHT = 18, LAUNCH_HEIGHT = 2;
  const RISE = HEIGHT - LAUNCH_HEIGHT, LENGTH = Math.hypot(DISTANCE, RISE);
  const ANGLE = Math.atan2(RISE, DISTANCE);
  const FALL_TIME = Math.sqrt(2 * HEIGHT / G);
  const MIN_SPEED = LENGTH / FALL_TIME;
  function events(p) {
    const v0 = Math.max(0, Number(p.v0) || 0);
    const vx = v0 * DISTANCE / LENGTH, vy = v0 * RISE / LENGTH;
    const meetingTime = v0 > 0 ? LENGTH / v0 : Infinity;
    const bulletGroundTime = (vy + Math.sqrt(vy * vy + 2 * G * LAUNCH_HEIGHT)) / G;
    const hit = meetingTime <= FALL_TIME + 1e-10;
    const duration = Math.min(meetingTime, FALL_TIME, bulletGroundTime);
    const outcome = hit ? 'hit' : bulletGroundTime < FALL_TIME ? 'bullet-ground' : 'monkey-ground';
    return { vx, vy, meetingTime, bulletGroundTime, duration, outcome, hit };
  }
  function state(p, time) {
    const e = events(p), t = Math.max(0, Math.min(time, e.duration));
    const drop = G * t * t / 2;
    const bullet = { x: e.vx * t, y: Math.max(0, LAUNCH_HEIGHT + e.vy * t - drop), vx: e.vx, vy: e.vy - G * t };
    const monkey = { x: DISTANCE, y: Math.max(0, HEIGHT - drop), vx: 0, vy: -G * t };
    return { t, bullet, monkey, drop, ghost: { x: bullet.x, y: LAUNCH_HEIGHT + e.vy * t },
      separation: Math.hypot(monkey.x - bullet.x, monkey.y - bullet.y),
      status: t >= e.duration ? e.outcome : 'flight', ...e };
  }
  const api = { G, DISTANCE, HEIGHT, LAUNCH_HEIGHT, LENGTH, ANGLE, FALL_TIME, MIN_SPEED, events, state };
  if (typeof module !== 'undefined') module.exports = api; else root.PhysicsModel = api;
})(globalThis);