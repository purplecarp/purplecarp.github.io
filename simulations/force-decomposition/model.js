/* SI units; screen vectors use +x right, +y down. No rendering or frame state. */
(function(root) {
 'use strict';
 const G = 9.8, DT = 1 / 240, SWEEP_RATE = 3, MAX_ANGLE = 70;
 const rad = degrees => degrees * Math.PI / 180;
 function incline(p, t) {
  const theta = rad(p.inclineAngle), weight = p.mass * G;
  const parallel = weight * Math.sin(theta), perpendicular = weight * Math.cos(theta);
  const normal = perpendicular, maxStatic = p.muS * normal;
  const stuck = parallel <= maxStatic + 1e-10;
  const friction = stuck ? parallel : Math.min(p.muK, p.muS) * normal;
  const acceleration = stuck ? 0 : (parallel - friction) / p.mass;
  const tangent = {x:-Math.cos(theta), y:Math.sin(theta)};
  const radial = {x:Math.sin(theta), y:Math.cos(theta)};
  return {t, theta, weight, parallel, perpendicular, normal, friction, maxStatic, stuck,
   acceleration, distance:.5 * acceleration * t * t, speed:acceleration * t,
   tangent, radial, support:normal, kind:'incline'};
 }
 // Fixed-step RK4 for the full nonlinear pendulum equation, independent of frame rate.
 function advance(theta, omega, h, length) {
  const acc = q => -G / length * Math.sin(q);
  const k1q = omega, k1w = acc(theta);
  const k2q = omega + h*k1w/2, k2w = acc(theta + h*k1q/2);
  const k3q = omega + h*k2w/2, k3w = acc(theta + h*k2q/2);
  const k4q = omega + h*k3w, k4w = acc(theta + h*k3q);
  return [theta + h*(k1q+2*k2q+2*k3q+k4q)/6,
   omega + h*(k1w+2*k2w+2*k3w+k4w)/6];
 }
 function pendulum(p, t) {
  let theta = rad(p.pendulumAngle), omega = 0;
  const steps = Math.floor(t / DT);
  for(let i=0;i<steps;i++) [theta, omega] = advance(theta, omega, DT, p.length);
  const remainder = t - steps*DT;
  if(remainder>1e-12) [theta, omega] = advance(theta, omega, remainder, p.length);
  const weight = p.mass * G, speed = Math.abs(omega * p.length);
  const radial = {x:Math.sin(theta), y:Math.cos(theta)};
  const tangent = {x:-Math.cos(theta), y:Math.sin(theta)};
  const parallel = weight * Math.sin(theta), perpendicular = weight * Math.cos(theta);
  const tension = perpendicular + p.mass * speed * speed / p.length;
  return {t, theta, omega, speed, weight, parallel, perpendicular, tension, support:tension,
   tangent, radial, kind:'pendulum',
   energy:.5*p.mass*speed*speed + weight*p.length*(1-Math.cos(theta))};
 }
 // Quasi-static tilt until the analytic static-friction threshold, then slide.
 // A tiny angular excess resolves strict "greater than" without frame-size overshoot.
 function sweepPlan(p) {
  const criticalAngle=Math.atan(p.muS)*180/Math.PI;
  const stopAngle=Math.min(MAX_ANGLE,Math.max(p.inclineAngle,criticalAngle+1e-7));
  const releaseTime=Math.max(0,(criticalAngle-p.inclineAngle)/SWEEP_RATE);
  return {criticalAngle,stopAngle,releaseTime};
 }
 function sweepAngle(p,t) {
  const plan=sweepPlan(p),time=Math.max(0,t);
  return time<plan.releaseTime?p.inclineAngle+SWEEP_RATE*time:plan.stopAngle;
 }
 function duration(p) {
  return p.scenario==='pendulum'?12:p.angleSweep?sweepPlan(p).releaseTime+6:6;
 }
 function state(p, time) {
  const t = Math.max(0, time);
  if(p.scenario==='pendulum')return pendulum(p,t);
  if(p.angleSweep) {
   const plan=sweepPlan(p),sweeping=t<plan.releaseTime;
   const slideTime=sweeping?0:t-plan.releaseTime;
   const current=incline({...p,inclineAngle:sweepAngle(p,t)},slideTime);
   return {...current,t,sweeping,sweepSequence:true,
    phase:sweeping?'raising':'sliding',slideTime,...plan};
  }
  return incline(p,t);
 }
 // Canvas coordinates: +x right, +y down; theta is measured above horizontal.
 // B is the bottom-edge midpoint, u points upslope, n points into the block.
 function inclineGeometry(theta, B, width, height, frictionRatio) {
  const u={x:Math.cos(theta),y:-Math.sin(theta)};
  const n={x:-Math.sin(theta),y:-Math.cos(theta)};
  const halfHeight=height/2;
  const C={x:B.x+halfHeight*n.x,y:B.y+halfHeight*n.y};
  // Solve (C + lambda * (0,1) - B) dot n = 0, never clamp to an edge.
  const lambda=-halfHeight/n.y;
  const P={x:C.x,y:C.y+lambda};
  const offset=(P.x-B.x)*u.x+(P.y-B.y)*u.y;
  const inside=Math.abs(offset)<=width/2+1e-9;
  // During translation, zero torque requires q = -(height/2) f/N.
  // At static equilibrium f/N = tan(theta), so Q coincides with P.
  const q=frictionRatio===undefined?offset:-halfHeight*frictionRatio;
  const Q={x:B.x+q*u.x,y:B.y+q*u.y};
  return {B:{...B},C,P,Q,u,n,width,height,lambda,offset,inside,
   contactInside:Math.abs(q)<=width/2+1e-9,
   atEdge:Math.abs(Math.abs(offset)-width/2)<=1e-9};
 }
 function vectors(s) {
  return {
   weight:{x:0,y:s.weight},
   parallel:{x:s.parallel*s.tangent.x,y:s.parallel*s.tangent.y},
   perpendicular:{x:s.perpendicular*s.radial.x,y:s.perpendicular*s.radial.y},
   support:{x:-s.support*s.radial.x,y:-s.support*s.radial.y},
   friction:{x:-(s.friction||0)*s.tangent.x,y:-(s.friction||0)*s.tangent.y}
  };
 }
 const api = {G, DT, SWEEP_RATE, MAX_ANGLE, sweepPlan, sweepAngle, duration, state, vectors, inclineGeometry};
 if(typeof module!=='undefined') module.exports=api; else root.PhysicsModel=api;
})(globalThis);

