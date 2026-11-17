/* SI units; stationary air; uniform, subsonic source and observer motion. */
(function(root){
 'use strict';
 const C=343, DURATION=12, CYCLES_PER_RING=10, SOURCE_X=-30, OBSERVER_X=30;
 function velocities(p){return {vs:p.mode==='observer'||p.mode==='stationary'?0:p.sourceSpeed,vo:p.mode==='source'||p.mode==='stationary'?0:p.observerSpeed};}
 // Two alternating fundamentals, each held for half of a one-second cycle.
 const SIREN_LOW=715,SIREN_HIGH=956,SIREN_PERIOD=1;
 const HALF_PERIOD=SIREN_PERIOD/2,LOW_CYCLES=SIREN_LOW*HALF_PERIOD;
 const CYCLE_PHASE=(SIREN_LOW+SIREN_HIGH)*HALF_PERIOD;
 function sourceFrequency(p,t){
  if(p.soundType!=='ambulance')return p.frequency;
  const within=t-Math.floor(t/SIREN_PERIOD)*SIREN_PERIOD;
  return within<HALF_PERIOD?SIREN_LOW:SIREN_HIGH;
 }
 function sourcePhase(p,t){
  if(p.soundType!=='ambulance')return p.frequency*t;
  // Floor also extends the continuous phase correctly to emission times before t=0.
  const cycles=Math.floor(t/SIREN_PERIOD),within=t-cycles*SIREN_PERIOD;
  return cycles*CYCLE_PHASE+SIREN_LOW*Math.min(within,HALF_PERIOD)+SIREN_HIGH*Math.max(0,within-HALF_PERIOD);
 }
 function emissionAtPhase(p,phase){
  if(p.soundType!=='ambulance')return phase/p.frequency;
  const cycles=Math.floor(phase/CYCLE_PHASE),within=phase-cycles*CYCLE_PHASE;
  return cycles*SIREN_PERIOD+(within<LOW_CYCLES?within/SIREN_LOW:HALF_PERIOD+(within-LOW_CYCLES)/SIREN_HIGH);
 }
 function state(p,t){
  const {vs,vo}=velocities(p),sx=SOURCE_X+vs*t,ox=OBSERVER_X+vo*t,dy=p.offset,dx=ox-sx;
  // |observer(t) - source(t-tau)| = c*tau. Positive retarded-time root.
  const q=C*C-vs*vs,rad=Math.sqrt(C*C*dx*dx+q*dy*dy);
  const delay=(vs*dx+rad)/q,emissionTime=t-delay,emissionX=sx-vs*delay;
  // At exact coincidence use the post-crossing time limit, avoiding a spurious original-tone sample.
  const distance=C*delay,nx=distance>1e-9?(dx+vs*delay)/distance:Math.sign(vo-vs);
  const emittedFrequency=sourceFrequency(p,emissionTime),ratio=(C-vo*nx)/(C-vs*nx),frequency=emittedFrequency*ratio;
  return {t,sx,ox,sy:-dy/2,oy:dy/2,vs,vo,delay,emissionTime,emissionX,nx,frequency,sourceFrequency:sourceFrequency(p,t),emittedFrequency,ratio,shift:frequency-emittedFrequency};
 }
 // Keep the tightest (forward, highest-tone) sampled gap at least 32 CSS pixels.
 // Use the whole siren band so the sampling does not jump at each tone change.
 function wavefrontSampling(p,pixelsPerMeter){
  const maxFrequency=p.soundType==='ambulance'?SIREN_HIGH:p.frequency;
  const shortestWavelength=(C-Math.abs(velocities(p).vs))/maxFrequency;
  return Math.max(5,5*Math.ceil(32/(shortestWavelength*pixelsPerMeter*5)));
 }
 function wavefronts(p,t,history=20,cyclesPerRing=CYCLES_PER_RING){
  const {vs}=velocities(p),last=Math.floor((sourcePhase(p,t)+1e-9)/cyclesPerRing),first=Math.floor(sourcePhase(p,t-history)/cyclesPerRing),count=Math.min(600,last-first+1);
  return Array.from({length:count},(_,i)=>{const emitted=emissionAtPhase(p,(last-i)*cyclesPerRing);return {emitted,x:SOURCE_X+vs*emitted,y:-p.offset/2,radius:C*Math.max(0,t-emitted)};});
 }
 const api={C,DURATION,CYCLES_PER_RING,SOURCE_X,OBSERVER_X,velocities,sourceFrequency,sourcePhase,state,wavefrontSampling,wavefronts};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
