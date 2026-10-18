/* SI units; stationary air; uniform, subsonic source and observer motion. */
(function(root){
 'use strict';
 const C=343, DURATION=12, CYCLES_PER_RING=100;
 function velocities(p){return {vs:p.mode==='observer'||p.mode==='stationary'?0:p.sourceSpeed,vo:p.mode==='source'||p.mode==='stationary'?0:p.observerSpeed};}
 // Synthetic ambulance wail: a two-second sweep from the base frequency to 1.5 times it.
 function sourceFrequency(p,t){return p.frequency*(p.soundType==='ambulance'?1.25+.25*Math.sin(Math.PI*t):1);}
 function sourcePhase(p,t){return p.frequency*(p.soundType==='ambulance'?1.25*t+.25/Math.PI*(1-Math.cos(Math.PI*t)):t);}
 function emissionAtPhase(p,phase){
  if(p.soundType!=='ambulance')return phase/p.frequency;
  let left=phase/(1.25*p.frequency)-1,right=left+2;
  for(let i=0;i<36;i++){const mid=(left+right)/2;if(sourcePhase(p,mid)<phase)left=mid;else right=mid;}
  return (left+right)/2;
 }
 function state(p,t){
  const {vs,vo}=velocities(p),sx=-300+vs*t,ox=300+vo*t,dy=p.offset,dx=ox-sx;
  // |observer(t) - source(t-tau)| = c*tau. Positive retarded-time root.
  const q=C*C-vs*vs,rad=Math.sqrt(C*C*dx*dx+q*dy*dy);
  const delay=(vs*dx+rad)/q,emissionTime=t-delay,emissionX=sx-vs*delay;
  // At exact coincidence use the post-crossing time limit, avoiding a spurious original-tone sample.
  const distance=C*delay,nx=distance>1e-9?(dx+vs*delay)/distance:Math.sign(vo-vs);
  const emittedFrequency=sourceFrequency(p,emissionTime),ratio=(C-vo*nx)/(C-vs*nx),frequency=emittedFrequency*ratio;
  return {t,sx,ox,sy:-dy/2,oy:dy/2,vs,vo,delay,emissionTime,emissionX,nx,frequency,sourceFrequency:sourceFrequency(p,t),emittedFrequency,ratio,shift:frequency-emittedFrequency};
 }
 function wavefronts(p,t,history=20){
  const {vs}=velocities(p),last=Math.floor((sourcePhase(p,t)+1e-9)/CYCLES_PER_RING),first=Math.floor(sourcePhase(p,t-history)/CYCLES_PER_RING),count=Math.min(600,last-first+1);
  return Array.from({length:count},(_,i)=>{const emitted=emissionAtPhase(p,(last-i)*CYCLES_PER_RING);return {emitted,x:-300+vs*emitted,y:-p.offset/2,radius:C*Math.max(0,t-emitted)};});
 }
 const api={C,DURATION,CYCLES_PER_RING,velocities,sourceFrequency,sourcePhase,state,wavefronts};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
