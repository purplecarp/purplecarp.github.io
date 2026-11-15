const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../simulations/ripple-tank-3d/model.js');
const p={wavelength:10,frequency:1,amplitude:.6,separation:20,phase:0,sources:'both',probeX:0,probeY:15};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('equal paths: in phase doubles amplitude; opposite phase cancels at every time',()=>{
 for(const t of [0,.125,.5,2.375])for(const y of [-30,0,15,30]){
  const s=M.field(p,t,0,y);near(s.envelope,1.2);near(s.height,2*s.first);
  const anti=M.field({...p,phase:180},t,0,y);near(anti.envelope,0);near(anti.height,0);
 }
});
test('hand-calculated half-wavelength path difference gives cancellation',()=>{
 const s=M.field(p,0,2.5,0);near(s.pathDifference,-5);near(s.envelope,0);near(s.height,0);
 near(M.field({...p,phase:180},0,2.5,0).envelope,1.2);
});
test('outward propagation and temporal periodicity',()=>{
 const single={...p,sources:'s1'},t=.37,dr=2;
 near(M.field(single,t,12,0).height,M.field(single,t+dr/10,14,0).height);
 near(M.field(p,t,4,7).height,M.field(p,t+1,4,7).height);
 near(M.state(p,t).waveSpeed,10);
});
test('sampled nodal contours cancel for every phase and parameter extremes',()=>{
 for(const separation of [4,20,36])for(const wavelength of [4,10,20])for(const phase of [0,45,180,360]){
  const q={...p,separation,wavelength,phase};
  for(const path of M.nodes(q))for(const {x,y} of path)near(M.field(q,.231,x,y).envelope,0);
 }
 assert.equal(M.nodes({...p,separation:4}).length,0);
});
test('single-source, zero amplitude, phase wrap, envelope bounds and parameter extremes',()=>{
 for(const sources of ['both','s1','s2'])for(const amplitude of [0,1])for(const wavelength of [4,20])for(const frequency of [.25,2]){
  const q={...p,sources,amplitude,wavelength,frequency,separation:36};
  for(const [x,y] of [[-30,-30],[30,30],[18,0],[-18,0],[0,0]]){
   const s=M.field(q,123.45,x,y);
   for(const value of Object.values(s))assert.ok(Number.isFinite(value));
   assert.ok(Math.abs(s.height)<=s.envelope+1e-9);
   near(M.field({...q,phase:360},123.45,x,y).height,s.height);
   if(sources==='s1')near(s.height,s.first);
   if(sources==='s2')near(s.height,s.second);
   if(amplitude===0)near(s.height,0);
  }
  if(sources!=='both'||amplitude===0)assert.deepEqual(M.nodes(q),[]);
 }
});
