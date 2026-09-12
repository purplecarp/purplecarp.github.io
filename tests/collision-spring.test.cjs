const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../simulations/elastic-collision/model.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
const base={mode:'spring',k:100,m1:2,m2:4,u1:5,u2:-1.5,walls:false};
test('spring collision conserves momentum and mechanical energy throughout contact at parameter extremes',()=>{
 for(const m1 of [.5,2,10])for(const m2 of [.5,4,10])for(const k of [100,500])for(const u1 of [-8,0,8])for(const u2 of [-8,0,8]){
  const p={...base,m1,m2,k,u1,u2},initial=M.state(p,0);
  const times=[0,1,8];
  if(Number.isFinite(initial.contactTime))for(let i=0;i<=20;i++)times.push(initial.contactTime+initial.contactDuration*i/20);
  for(const t of times){const s=M.state(p,t);near(s.totalEnergy,initial.energy);near(s.momentum,initial.momentum);assert.ok(s.x2-s.x1>=s.r1+s.r2-1e-9);assert.ok(s.compression>=-1e-9);near(s.potential,.5*k*s.compression**2);}
 }
});
test('maximum compression has equal velocities and stores relative kinetic energy',()=>{
 const initial=M.state(base,0),s=M.state(base,initial.contactTime+initial.contactDuration/2);
 near(s.v1,s.v2);near(s.v1,(base.m1*base.u1+base.m2*base.u2)/(base.m1+base.m2));
 near(s.potential,.5*base.m1*base.m2/(base.m1+base.m2)*(base.u1-base.u2)**2);
 assert.ok(s.energy<initial.energy);assert.ok(s.force>0);
});
test('separation matches elastic velocities and endpoints are continuous',()=>{
 const initial=M.state(base,0),end=initial.contactTime+initial.contactDuration,s=M.state(base,end),expected=M.velocities(base.m1,base.m2,base.u1,base.u2);
 near(s.v1,expected[0]);near(s.v2,expected[1]);near(s.potential,0);near(s.energy,initial.energy);assert.equal(s.stage,'已分離');
 for(const t of [initial.contactTime,end]){const before=M.state(base,t-1e-10),after=M.state(base,t+1e-10);for(const key of ['x1','x2','v1','v2','totalEnergy'])near(before[key],after[key]);}
});
test('equal or separating velocities never compress the spring; stiffness changes contact time',()=>{
 for(const [u1,u2] of [[3,3],[-2,4]]){const s=M.state({...base,u1,u2},8);assert.equal(s.count,0);near(s.potential,0);near(s.v1,u1);near(s.v2,u2);}
 near(M.state({...base,k:400},0).contactDuration,M.state(base,0).contactDuration/2);
});
