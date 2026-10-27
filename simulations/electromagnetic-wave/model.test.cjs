'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js');
const p={frequency:100,amplitude:3,direction:'1',probe:.75};
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('hand calculation: 100 MHz, 3 V/m gives 3 m, 10 ns, 10 nT',()=>{
 const s=M.state(p,0);near(s.lambda,3);near(s.period,10);near(s.ey,3);near(s.bnT,10);
});
test('half period reverses both fields, quarter period is exactly zero',()=>{
 const half=M.state(p,5),zero=M.state(p,2.5);
 near(half.ey,-3);near(half.bnT,-10);assert.equal(zero.ey,0);assert.equal(zero.bz,0);
 assert.ok(half.ey*half.bz>0);
});
test('reverse propagation obeys E cross B and travels in the negative x direction',()=>{
 for(const d of [-1,1]){
  const q={...p,direction:String(d)};
  near(M.field(q,.75,0).ey,3);near(M.field(q,.75,0).bnT,d*10);
  for(const t of [0,1,5,8]){
   const f=M.field(q,.75,t);assert.equal(Math.sign(f.ey*f.bz),d);
   near(M.field(q,.75+d*.3*t,t).ey,3);
  }
 }
});
test('limits, zero amplitude, f lambda = c, and E = d c B throughout the wave',()=>{
 for(const frequency of [50,100,150])for(const amplitude of [0,.25,3])for(const d of [-1,1]){
  const q={...p,frequency,amplitude,direction:String(d)},s=M.state(q,0);
  near(frequency*1e6*s.lambda,M.C,1e-6);
  for(const x of [0,.75,6,12])for(const t of [0,1,15,30]){
   const f=M.field(q,x,t);near(f.ey,d*M.C*f.bz);
   assert.ok(Number.isFinite(f.ey)&&Number.isFinite(f.bz));
   near(M.field(q,x+s.lambda,t).ey,f.ey);
   near(M.field(q,x,t+s.period).ey,f.ey);
   if(amplitude===0){assert.ok(f.ey===0);assert.ok(f.bz===0);}
  }
 }
});
