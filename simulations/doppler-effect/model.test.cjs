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
 const q={...p,mode:'source'},crossing=(M.OBSERVER_X-M.SOURCE_X)/q.sourceSpeed,a=M.state(q,crossing-1e-5),b=M.state(q,crossing+1e-5);
 assert.ok(Math.abs(a.frequency-b.frequency)<.1);
 assert.ok(M.state(q,0).frequency>440);assert.ok(M.state(q,12).frequency<440);
 assert.ok(M.state(q,crossing).frequency>440);
 near(M.state(q,crossing+q.offset/343).frequency,440);
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
 const rings=M.wavefronts(p,3);near(rings[0].emitted-rings[1].emitted,M.CYCLES_PER_RING/p.frequency);
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
  const q={...p,mode,offset:0},{vs,vo}=M.velocities(q),t=(M.OBSERVER_X-M.SOURCE_X)/(vs-vo);
  const before=M.state(q,t-1e-7),at=M.state(q,t),after=M.state(q,t+1e-7);
  near(before.frequency,q.frequency*(M.C-vo)/(M.C-vs));
  near(at.frequency,q.frequency*(M.C+vo)/(M.C+vs));
  near(at.frequency,after.frequency);near(at.delay,0);
  assert.ok(before.frequency>q.frequency&&after.frequency<q.frequency);
 }
});


test('ambulance alternates 715/956 Hz every half second, including negative emission times',()=>{
 const q={...p,soundType:'ambulance'};
 for(const cycle of [-20,-2,-1,0,1,12]){
  for(const dt of [0,.1,.499999])near(M.sourceFrequency(q,cycle+dt),715);
  for(const dt of [.5,.7,.999999])near(M.sourceFrequency(q,cycle+dt),956);
  near(M.sourcePhase(q,cycle+1)-M.sourcePhase(q,cycle),835.5);
 }
 near(M.sourceFrequency({...q,frequency:100},.25),715);
 near(M.sourceFrequency({...q,frequency:1000},.75),956);
 near(M.sourceFrequency({...q,soundType:'tone'},.75),440);
});

test('ambulance phase stays continuous at switches and its derivative matches each tone',()=>{
 const q={...p,soundType:'ambulance'},h=1e-7;
 for(const t of [-2,-.5,0,.5,1,12]){
  assert.ok(Math.abs(M.sourcePhase(q,t+h)-M.sourcePhase(q,t-h))<.001);
 }
 for(const t of [-1.75,-.25,.25,.75,11.25,11.75]){
  near((M.sourcePhase(q,t+h)-M.sourcePhase(q,t-h))/(2*h),M.sourceFrequency(q,t),.0001);
 }
});

test('received ambulance tones follow retarded emission and Doppler phase rate',()=>{
 const q={...p,soundType:'ambulance'},h=1e-6;
 for(const mode of ['source','observer','both','stationary'])for(const t of [.13,.43,2.17,5.73,8.19,11.87]){
  const r={...q,mode},s=M.state(r,t);
  near(s.emittedFrequency,M.sourceFrequency(r,s.emissionTime));
  near(s.frequency,s.emittedFrequency*s.ratio);
  near((M.sourcePhase(r,M.state(r,t+h).emissionTime)-M.sourcePhase(r,M.state(r,t-h).emissionTime))/(2*h),s.frequency,.00001);
 }
 const stationary={...q,mode:'stationary',offset:0},delay=(M.OBSERVER_X-M.SOURCE_X)/M.C;
 near(M.state(stationary,delay+.25).frequency,715);
 near(M.state(stationary,delay+.75).frequency,956);
 const moving={...q,mode:'source',offset:0};
 // Half a source-second arrives sooner on approach and later on recession.
 near(M.state(moving,0.5*(M.C-100)/M.C).emissionTime-M.state(moving,0).emissionTime,.5);
 near(M.state(moving,9+.5*(M.C+100)/M.C).emissionTime-M.state(moving,9).emissionTime,.5);
});

test('ambulance wavefronts invert accumulated cycles across tone changes and rewind',()=>{
 const q={...p,soundType:'ambulance'};
 for(const t of [0,.5,1,6,12]){
  const waves=M.wavefronts(q,t);
  for(const [i,w] of waves.entries()){
   assert.ok(w.emitted<=t+1e-8);
   near(w.radius,M.C*(t-w.emitted));
   near(M.sourcePhase(q,w.emitted)/M.CYCLES_PER_RING,Math.round(M.sourcePhase(q,w.emitted)/M.CYCLES_PER_RING));
   if(i)near(M.sourcePhase(q,waves[i-1].emitted)-M.sourcePhase(q,w.emitted),M.CYCLES_PER_RING);
  }
 }
 const before=M.wavefronts(q,.5);M.wavefronts(q,12);assert.deepEqual(M.wavefronts(q,.5),before);
});


test('10 m/s source crosses a 60 m scene in six seconds within the 12-second lesson',()=>{
 const q={...p,mode:'source',sourceSpeed:10,offset:0};
 const start=M.state(q,0),crossing=M.state(q,6),end=M.state(q,M.DURATION);
 near(start.ox-start.sx,60);near(crossing.sx,crossing.ox);near(end.sx-end.ox,60);
 near(start.frequency,440*343/333);near(end.frequency,440*343/353);
 near(start.delay,60/333);near(end.delay,60/353);
 for(const w of M.wavefronts(q,6,1))near(w.x,-30+10*w.emitted);
});


test('adaptive wavefronts retain emission centers and physical front/back wavelengths',()=>{
 for(const sourceSpeed of [-40,-10,0,10,40])for(const frequency of [100,715,956,1000])for(const scale of [.25,1,2,4,8]){
  const q={...p,mode:'source',sourceSpeed,frequency,offset:0,soundType:'tone'};
  const n=M.wavefrontSampling(q,scale),waves=M.wavefronts(q,2,4,n);
  assert.ok(Number.isInteger(n)&&n>=1);
  const forward=(M.C-Math.abs(sourceSpeed))/frequency;
  assert.ok(n*forward*scale>=32-1e-8);
  const [inner,outer]=waves,dt=outer.emitted-inner.emitted;
  near(outer.x-inner.x,sourceSpeed*dt);
  near(outer.radius-inner.radius,-M.C*dt);
  near(Math.abs((outer.x+outer.radius)-(inner.x+inner.radius))/n,(M.C-sourceSpeed)/frequency);
  near(Math.abs((outer.x-outer.radius)-(inner.x-inner.radius))/n,(M.C+sourceSpeed)/frequency);
 }
});

test('siren sampling retains phase and high/low gap ratio across rewind',()=>{
 const q={...p,mode:'source',sourceSpeed:10,soundType:'ambulance'},scale=2;
 const n=M.wavefrontSampling(q,scale);
 const first=M.wavefronts(q,.75,2,n);
 for(const w of first){
  near(M.sourcePhase(q,w.emitted)/n,Math.round(M.sourcePhase(q,w.emitted)/n));
  near(w.x,M.SOURCE_X+10*w.emitted);
 }
 const gaps={};
 for(let i=1;i<first.length;i++){
  const a=first[i-1],b=first[i];
  if(Math.floor(a.emitted*2)!==Math.floor(b.emitted*2))continue;
  const f=M.sourceFrequency(q,a.emitted),gap=(b.x+b.radius)-(a.x+a.radius);
  near(gap/n,(M.C-10)/f);gaps[f]=gap;
 }
 near(gaps[715]/gaps[956],956/715);
 M.wavefronts(q,10,2,n);assert.deepEqual(M.wavefronts(q,.75,2,n),first);
});
