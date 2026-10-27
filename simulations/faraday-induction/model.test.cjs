'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js');
const p={...M.defaults},close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('stationary magnet has flux but no emf or current',()=>{
 const s=M.state(p,1);assert.ok(s.phi>0);close(s.current,0);close(s.emf,0);
});
test('analytic flux gradient agrees with a central derivative',()=>{
 for(const d of [-.8,-.2,0,.1,.8])close(M.gradient(p,d),(M.flux(p,d+1e-6)-M.flux(p,d-1e-6))/2e-6,1e-8);
});
test('same relative motion gives same emf; polarity and velocity reverse it',()=>{
 const a=M.state({...p,motion:'magnet'},0),b=M.state({...p,motion:'coil'},0);
 close(a.emf,-b.emf);close(a.emf,-M.state({...p,motion:'magnet',polarity:-1},0).emf);
 close(M.state({...p,manualVelocity:a.relative},0).emf,a.emf);
 close(M.state({...p,manualVelocity:a.relative*2},0).emf,2*a.emf);
});
test('co-moving magnet and coil keep the flux constant and current zero',()=>{
 const q={...p,motion:'together'},initial=M.state(q,0);
 for(let t=0;t<=10;t+=.031){const s=M.state(q,t);close(s.phi,initial.phi);close(s.emf,0);}
});
test('Faraday law matches time derivative for all automatic modes',()=>{
 for(const motion of ['magnet','coil','together'])for(let t=.12;t<3;t+=.13){
  const q={...p,motion},s=M.state(q,t),dPhi=(M.state(q,t+1e-6).phi-M.state(q,t-1e-6).phi)/2e-6;
  close(s.emf,-p.turns*dPhi,1e-8);close(s.current,s.emf/p.resistance);
 }
});
test('generator hand calculation: N=20, B=.2 T, A=.04 m², 30 rpm',()=>{
 const q={...p,mode:'ac'},start=M.state(q,0),quarter=M.state(q,.5),half=M.state(q,1),threeQuarter=M.state(q,1.5);
 close(start.phi,.008);close(start.emf,0);close(quarter.phi,0);close(quarter.emf,.16*Math.PI);
 close(half.phi,-.008);close(half.emf,0);close(threeQuarter.emf,-.16*Math.PI);
});
test('AC alternates; ideal split-ring DC is full-wave rectified at identical angle',()=>{
 for(let t=0;t<4;t+=.017){const ac=M.state({...p,mode:'ac'},t),dc=M.state({...p,mode:'dc'},t);
  close(dc.emf,ac.emf);close(dc.phi,ac.phi);close(dc.output,Math.abs(ac.emf));assert.ok(dc.current>=0);
  const delta=1e-6,dPhi=(M.state({...p,mode:'ac'},t+delta).phi-M.state({...p,mode:'ac'},t-delta).phi)/(2*delta);
  close(ac.emf,-p.turns*dPhi,1e-8);
 }
});
test('zero field, stationary generator, extrema and linear scaling',()=>{
 for(const mode of ['magnet','ac','dc'])for(const turns of [1,100])for(const resistance of [1,50]){
  const q={...p,mode,motion:'magnet',turns,resistance};close(M.state({...q,field:0},.3).current,0);
  for(let t=0;t<10;t+=.217)for(const v of Object.values(M.state(q,t)))assert.ok(Number.isFinite(v));
 }
 for(const mode of ['ac','dc']){close(M.state({...p,mode,rpm:0,angle:90},3).current,0);}
 const s=M.state({...p,mode:'ac',angle:90},0);
 close(M.state({...p,mode:'ac',angle:90,turns:40},0).emf,2*s.emf);
 close(M.state({...p,mode:'ac',angle:90,rpm:60},0).emf,2*s.emf);
 close(M.state({...p,mode:'ac',angle:90,resistance:20},0).current,s.current/2);
});
