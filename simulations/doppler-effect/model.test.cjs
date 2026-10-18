'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),Audio=require('./audio.js');
const p={mode:'both',frequency:440,sourceSpeed:100,observerSpeed:-100,offset:60,soundMode:'observer',volume:20};
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('stationary and equal velocity have exactly the original frequency',()=>{
 for(const t of [0,3,6,12]){
  near(M.state({...p,mode:'stationary'},t).frequency,440);
  near(M.state({...p,observerSpeed:100},t).frequency,440);
 }
});
test('one-dimensional handwritten approach and recession cases',()=>{
 near(M.state({...p,mode:'source',offset:0},0).frequency,440*343/243);
 near(M.state({...p,mode:'source',sourceSpeed:-100,offset:0},0).frequency,440*343/443);
 near(M.state({...p,mode:'observer',offset:0},0).frequency,440*443/343);
 near(M.state({...p,mode:'observer',observerSpeed:100,offset:0},0).frequency,440*243/343);
 near(M.state({...p,offset:0},0).frequency,440*443/243);
 near(M.state({...p,offset:0},12).frequency,440*243/443);
});
test('retarded sound-cone equation and phase derivative agree with frequency',()=>{
 for(const sourceSpeed of [-200,0,200])for(const observerSpeed of [-200,0,200])for(const t of [0,2.8,6,12]){
  const q={...p,sourceSpeed,observerSpeed},s=M.state(q,t),h=1e-5;
  near(Math.hypot(s.ox-s.emissionX,s.oy-s.sy),343*s.delay);
  near(q.frequency*(M.state(q,t+h).emissionTime-M.state(q,t-h).emissionTime)/(2*h),s.frequency,1e-6);
  assert.ok(s.delay>0&&Number.isFinite(s.frequency)&&s.frequency>0);
 }
});
test('pass-by is continuous and includes propagation delay',()=>{
 const q={...p,mode:'source'},a=M.state(q,6-1e-5),b=M.state(q,6+1e-5);
 assert.ok(Math.abs(a.frequency-b.frequency)<.1);
 assert.ok(M.state(q,0).frequency>440);assert.ok(M.state(q,12).frequency<440);
 assert.ok(M.state(q,6).frequency>440);
 near(M.state(q,6+q.offset/343).frequency,440);
});
test('parameter extremes remain finite and wavefronts reconstruct on rewind',()=>{
 for(const mode of ['source','observer','both','stationary'])for(const frequency of [100,1000])for(const offset of [0,20,200])for(const sourceSpeed of [-200,200])for(const observerSpeed of [-200,200]){
  const q={...p,mode,frequency,offset,sourceSpeed,observerSpeed};
  for(const t of [0,6,12]){
   const s=M.state(q,t);assert.ok(s.frequency>20&&s.frequency<4000);
   const waves=M.wavefronts(q,t);assert.ok(waves.length<=600);
   for(const w of waves){assert.ok(w.emitted<=t+1e-8);near(w.radius,343*(t-w.emitted));}
  }
 }
 const before=M.wavefronts(p,2);M.wavefronts(p,11);assert.deepEqual(M.wavefronts(p,2),before);
 const rings=M.wavefronts(p,3);near(rings[0].emitted-rings[1].emitted,100/p.frequency);
});
test('audio follows frequency, ignores animation speed, mutes on pause and background',async()=>{
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}});
 class FakeContext{constructor(){this.currentTime=0;this.state='suspended';this.destination={};}createOscillator(){return {frequency:param(),connect(){},start(){}};}createGain(){return {gain:param(),connect(){}};}async resume(){this.state='running';}}
 global.AudioContext=FakeContext;
 try{
  const audio=new Audio();await audio.enable();
  const s=M.state(p,2);audio.update(p,s,true);near(audio.oscillator.frequency.value,s.frequency);assert.ok(audio.targetGain>0);
  audio.update({...p,speed:2},s,true);near(audio.targetFrequency,s.frequency);
  audio.update({...p,soundMode:'source'},s,true);near(audio.targetFrequency,440);
  audio.update(p,s,false);near(audio.targetGain,0);
  audio.update(p,s,true,true);near(audio.targetGain,0);
  audio.update({...p,volume:0},s,true);near(audio.targetGain,0);
  audio.disable();audio.update(p,s,true);near(audio.targetGain,0);
  const pending=audio.enable();audio.disable();assert.equal(await pending,false);assert.equal(audio.enabled,false);
 }finally{delete global.AudioContext;}
});

test('collinear crossing uses the outgoing limit without a false original-tone spike',()=>{
 for(const mode of ['source','observer','both']){
  const q={...p,mode,offset:0},{vs,vo}=M.velocities(q),t=600/(vs-vo);
  const before=M.state(q,t-1e-7),at=M.state(q,t),after=M.state(q,t+1e-7);
  near(before.frequency,q.frequency*(M.C-vo)/(M.C-vs));
  near(at.frequency,q.frequency*(M.C+vo)/(M.C+vs));
  near(at.frequency,after.frequency);near(at.delay,0);
  assert.ok(before.frequency>q.frequency&&after.frequency<q.frequency);
 }
});
