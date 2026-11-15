const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../simulations/ripple-tank-3d/optics.js');
const M=require('../simulations/ripple-tank-3d/model.js');
const p={wavelength:10,frequency:1,amplitude:.6,separation:20,phase:0,sources:'both',waterDepth:4,screenGap:16,lightOn:true};
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,String(a)+' != '+b);
const cross=(a,b)=>Math.hypot(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
test('surface height matches wave model and analytic normal matches numerical gradient',()=>{
 for(const phase of [0,90,180])for(const sources of ['both','s1','s2']){
  const q={...p,phase,sources},eps=1e-5;
  for(const [x,y] of [[2,7],[-15,-8],[23,4]]){
   const s=O.surface(q,.17,x,y);near(s.height,M.field(q,.17,x,y).height);
   near(s.dx,(M.field(q,.17,x+eps,y).height-M.field(q,.17,x-eps,y).height)/(2*eps),1e-7);
   near(s.dy,(M.field(q,.17,x,y+eps).height-M.field(q,.17,x,y-eps).height)/(2*eps),1e-7);
  }
 }
});
test('flat water keeps rays vertical and every screen bin at I/I0 = 1',()=>{
 for(const screenGap of [2,16,32])for(const waterDepth of [3,10]){
  const q={...p,amplitude:0,screenGap,waterDepth},r=O.traceRay(q,0,3,8);
  near(r.hit.x,3);near(r.hit.y,8);near(r.hit.z,-waterDepth-screenGap);
  near(r.water.z,-1);near(r.air.z,-1);
  for(const value of O.frame(q,0,40).intensity)near(value,1,1e-8);
 }
});
test('both interfaces obey vector Snell law and produce unit directions',()=>{
 for(const [x,y] of [[3,8],[7,14],[-4,6]]){
  const r=O.traceRay(p,.137,x,y);assert.ok(r.hit);
  near(cross({x:0,y:0,z:-1},r.normal),O.NW*cross(r.water,r.normal));
  near(O.NW*Math.hypot(r.water.x,r.water.y),Math.hypot(r.air.x,r.air.y));
  near(Math.hypot(...Object.values(r.water)),1);near(Math.hypot(...Object.values(r.air)),1);
 }
 const angle=Math.PI/3;
 assert.equal(O.refract({x:Math.sin(angle),y:0,z:-Math.cos(angle)},{x:0,y:0,z:1},O.NW,1),null);
});
test('changing screen distance changes hit position along the same emergent ray',()=>{
 const a=O.traceRay(p,.137,3,8),b=O.traceRay({...p,screenGap:30},.137,3,8);
 near(b.hit.x-a.hit.x,-14*a.air.x/a.air.z);
 near(b.hit.y-a.hit.y,-14*a.air.y/a.air.z);
 assert.deepEqual(O.traceRay({...p,exaggeration:5},.137,3,8),a);
});
test('projection redistributes power with fixed normalization and conserves captured power',()=>{
 for(const time of [0,.17,.35]){
  const f=O.frame(p,time,60);
  assert.ok(f.peak>1.2);near(f.mean,f.capturedFraction,1e-8);
  assert.ok(f.capturedFraction<=f.transmittedFraction);
  for(const v of f.intensity)assert.ok(Number.isFinite(v)&&v>=0);
 }
 const off=O.frame({...p,lightOn:false},0,40);
 assert.equal(off.peak,0);assert.equal(off.mean,0);
 const a=O.frame(p,0,60),b=O.frame(p,.2,60);
 assert.ok(a.intensity.some((v,i)=>Math.abs(v-b.intensity[i])>.1));
});
test('screen sample convergence and finite parameter extremes',()=>{
 const a=O.frame(p,.13,60,2),b=O.frame(p,.13,60,4);
 const error=a.intensity.reduce((sum,v,i)=>sum+Math.abs(v-b.intensity[i]),0)/a.intensity.length;
 assert.ok(error<.08,'mean sampling error '+error);
 for(const amplitude of [0,1])for(const wavelength of [4,20])for(const phase of [0,180]){
  const f=O.frame({...p,amplitude,wavelength,phase,waterDepth:3,screenGap:32},.17,40);
  for(const v of f.intensity)assert.ok(Number.isFinite(v)&&v>=0);
  near(f.mean,f.capturedFraction,1e-8);
 }
});
