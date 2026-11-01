'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js');
const p={scenario:'incline',mass:2,inclineAngle:30,muS:.6,muK:.4,pendulumAngle:35,length:2};
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
test('30 degree hand calculation: static friction is demand, not its maximum',()=>{
 const s=M.state(p,0);near(s.weight,19.6);near(s.parallel,9.8);near(s.normal,9.8*Math.sqrt(3));
 near(s.friction,9.8);assert.ok(s.friction<s.maxStatic);assert.equal(s.stuck,true);
 near(M.state(p,6).distance,0);
});
test('45 degree sliding and frictionless 30 degree acceleration',()=>{
 const s=M.state({...p,inclineAngle:45},2);assert.equal(s.stuck,false);
 near(s.acceleration,9.8*Math.SQRT1_2*.6);near(s.friction,.4*s.normal);
 near(s.distance,.5*s.acceleration*4);near(s.speed,s.acceleration*2);
 near(M.state({...p,muS:0,muK:0},1).acceleration,4.9);
});
test('horizontal and static boundary do not generate spurious motion or friction',()=>{
 const flat=M.state({...p,inclineAngle:0},6);near(flat.friction,0);near(flat.normal,flat.weight);near(flat.speed,0);
 const angle=Math.atan(.6)*180/Math.PI;
 assert.equal(M.state({...p,inclineAngle:angle},1).stuck,true);
 assert.equal(M.state({...p,inclineAngle:angle+.001},1).stuck,false);
});
test('gravity components reconstruct the original vector; contact balances normal direction',()=>{
 for(const scenario of ['incline','pendulum'])for(const mass of [.5,2,5])for(const angle of [-70,0,30,70]) {
  const params={...p,scenario,mass,inclineAngle:Math.abs(angle),pendulumAngle:angle};
  for(const time of [0,.5,2,6]) {
   const s=M.state(params,time),v=M.vectors(s);
   near(v.parallel.x+v.perpendicular.x,0);near(v.parallel.y+v.perpendicular.y,s.weight);
   near(v.parallel.x*v.perpendicular.x+v.parallel.y*v.perpendicular.y,0);
   near(Math.hypot(v.support.x,v.support.y),s.support);
   const sum={x:v.weight.x+v.support.x+v.friction.x,y:v.weight.y+v.support.y+v.friction.y};
   if(scenario==='incline') {near(sum.x,mass*s.acceleration*s.tangent.x);near(sum.y,mass*s.acceleration*s.tangent.y);}
   else near(-(sum.x*s.radial.x+sum.y*s.radial.y),mass*s.speed*s.speed/params.length);
  }
 }
});
test('pendulum releases at rest, tension at bottom exceeds weight, left/right symmetry',()=>{
 const right={...p,scenario:'pendulum',pendulumAngle:60};
 const start=M.state(right,0);near(start.tension,9.8);near(start.speed,0);
 let bottom=start;
 for(let t=0;t<1;t+=.01) {const s=M.state(right,t);if(Math.abs(s.theta)<Math.abs(bottom.theta))bottom=s;}
 assert.ok(Math.abs(bottom.theta)<.02);assert.ok(bottom.tension>bottom.weight);
 near(bottom.tension,right.mass*M.G*(3*Math.cos(bottom.theta)-2*Math.cos(Math.PI/3)),1e-8);
 for(const t of [.2,1,3]) {
  const a=M.state(right,t),b=M.state({...right,pendulumAngle:-60},t);
  near(a.theta,-b.theta);near(a.omega,-b.omega);near(a.tension,b.tension);
 }
});
test('nonlinear pendulum conserves energy across parameter extremes and keeps the string taut',()=>{
 for(const mass of [.5,5])for(const length of [.5,3])for(const pendulumAngle of [-70,0,1,70]) {
  const params={...p,scenario:'pendulum',mass,length,pendulumAngle},initial=M.state(params,0);
  for(const t of [.001,.25,3.123,12]) {
   const s=M.state(params,t);near(s.energy,initial.energy,2e-8);
   assert.ok(s.tension>0);assert.ok(Math.abs(s.theta)<=Math.abs(pendulumAngle*Math.PI/180)+1e-8);
   assert.ok(Object.values(s).filter(x=>typeof x==='number').every(Number.isFinite));
  }
 }
});
test('zero-angle pendulum stays at rest and time seeking is deterministic',()=>{
 const params={...p,scenario:'pendulum',pendulumAngle:0},s=M.state(params,12);
 near(s.theta,0);near(s.speed,0);near(s.tension,s.weight);near(s.parallel,0);
 const moving={...params,pendulumAngle:40},before={...moving},first=M.state(moving,.625);
 M.state(moving,12);assert.deepEqual(M.state(moving,.625),first);assert.deepEqual(moving,before);
});


test('tilt reaches the static threshold, locks the angle, then slides from rest',()=>{
 const scan={...p,angleSweep:true,inclineAngle:10},plan=M.sweepPlan(scan);
 near(plan.criticalAngle,Math.atan(.6)*180/Math.PI);
 near(plan.releaseTime,(plan.criticalAngle-10)/3);
 const before=M.state(scan,plan.releaseTime-.01),event=M.state(scan,plan.releaseTime);
 assert.equal(before.stuck,true);assert.equal(before.phase,'raising');near(before.distance,0);near(before.speed,0);
 assert.equal(event.stuck,false);assert.equal(event.phase,'sliding');
 assert.ok(event.parallel>event.maxStatic);near(event.distance,0);near(event.speed,0);
 near(event.friction,scan.muK*event.normal);
 assert.ok(event.friction<before.friction);
 const later=M.state(scan,plan.releaseTime+2);
 near(later.theta,event.theta);near(later.speed,later.acceleration*2);near(later.distance,.5*later.acceleration*4);
 near(later.slideTime,2);near(M.duration(scan),plan.releaseTime+6);
});
test('tilt switch and displacement are independent of frame sampling and seeking order',()=>{
 const scan={...p,angleSweep:true,inclineAngle:0},plan=M.sweepPlan(scan);
 const first=M.state(scan,plan.releaseTime/2),later=M.state(scan,plan.releaseTime+1.234);
 for(const step of [1/30,1/60,1/144])for(let t=0;t<plan.releaseTime+2;t+=step)M.state(scan,t);
 assert.deepEqual(M.state(scan,plan.releaseTime/2),first);
 assert.deepEqual(M.state(scan,plan.releaseTime+1.234),later);
 assert.equal(first.phase,'raising');assert.equal(later.phase,'sliding');
});
test('tilt handles zero friction, equal friction coefficients, and already-sliding starts',()=>{
 for(const muS of [0,.2,.6,1])for(const muK of [0,muS])for(const mass of [.5,5]) {
  const scan={...p,angleSweep:true,inclineAngle:0,muS,muK,mass},plan=M.sweepPlan(scan);
  const s=M.state(scan,plan.releaseTime+1);
  assert.equal(s.phase,'sliding');assert.equal(s.stuck,false);assert.ok(s.acceleration>0);
  near(s.friction,muK*s.normal);near(s.speed,s.acceleration);
  near(s.distance,.5*s.acceleration);
  assert.ok(Object.values(s).filter(x=>typeof x==='number').every(Number.isFinite));
 }
 for(const inclineAngle of [45,70]){
  const scan={...p,angleSweep:true,inclineAngle},plan=M.sweepPlan(scan);
  near(plan.releaseTime,0);near(plan.stopAngle,inclineAngle);near(M.duration(scan),6);
  near(M.state(scan,0).distance,0);assert.ok(M.state(scan,1).distance>0);
  near(M.state(scan,1).theta,inclineAngle*Math.PI/180);
 }
});

test('C/P hand calculation: vertical projection is downhill of the bottom midpoint',()=>{
 const g=M.inclineGeometry(Math.PI/6,{x:0,y:0},2,2);
 near(g.C.x,-.5);near(g.C.y,-Math.sqrt(3)/2);
 near(g.P.x,-.5);near(g.P.y,1/(2*Math.sqrt(3)));
 near(g.offset,-1/Math.sqrt(3));near(g.lambda,2/Math.sqrt(3));
 assert.ok(g.inside);assert.notEqual(g.P.x,g.B.x);
});
test('static geometry: three lines concur at P, correct normals, and zero net torque',()=>{
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
 for(const angle of [0,1,15,30,40,45])for(const size of [2,60,120]) {
  const s=M.state({...p,inclineAngle:angle,muS:1},0),v=M.vectors(s);
  const g=M.inclineGeometry(s.theta,{x:320,y:240},size,size,s.friction/s.normal);
  assert.ok(s.stuck);assert.ok(g.inside);
  near(g.C.x,g.P.x);assert.ok(g.P.y>g.C.y);
  near(cross(minus(g.P,g.B),g.u),0);
  near(g.u.x*g.n.x+g.u.y*g.n.y,0);
  near(Math.hypot(g.u.x,g.u.y),1);near(Math.hypot(g.n.x,g.n.y),1);
  near(g.P.x,g.Q.x);near(g.P.y,g.Q.y);
  near(cross(minus(g.P,g.C),v.weight),0);
  near(v.support.x*g.u.x+v.support.y*g.u.y,0);
  near(cross(v.friction,g.u),0);
  near(cross(minus(g.P,g.C),v.support)+cross(minus(g.P,g.C),v.friction),0);
  if(angle>0)assert.ok(Math.abs(cross(minus(g.C,g.P),v.support))>.001);
 }
});
test('projection is never clamped: square edge at 45 degrees, outside above 45',()=>{
 const B={x:0,y:0};
 const flat=M.inclineGeometry(0,B,2,2);assert.deepEqual(flat.P,B);
 const edge=M.inclineGeometry(Math.PI/4,B,2,2);assert.ok(edge.atEdge);assert.ok(edge.inside);
 const outside=M.inclineGeometry(Math.PI/3,B,2,2);
 assert.equal(outside.inside,false);assert.ok(outside.offset < -1);near(outside.P.x,outside.C.x);
});
test('sliding contact Q balances torque without falsely forcing concurrence at P',()=>{
 const s=M.state({...p,inclineAngle:60},1),v=M.vectors(s);
 const g=M.inclineGeometry(s.theta,{x:0,y:0},2,2,s.friction/s.normal);
 assert.equal(s.stuck,false);assert.ok(g.contactInside);
 assert.ok(Math.hypot(g.Q.x-g.P.x,g.Q.y-g.P.y)>.1);
 const r={x:g.Q.x-g.C.x,y:g.Q.y-g.C.y};
 near(r.x*(v.support.y+v.friction.y)-r.y*(v.support.x+v.friction.x),0);
});
