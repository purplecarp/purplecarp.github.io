/* Pure ticker-timer kinematics shared by animation, analysis and tests. */
(function(root){
 'use strict';
 const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function position(p,t){return number(p.v0)*t+.5*number(p.acceleration)*t*t;}
 function velocity(p,t){return number(p.v0)+number(p.acceleration)*t;}
 function dots(p,t){
  const frequency=Math.max(1,number(p.frequency,60));
  const count=Math.max(0,Math.floor(Math.max(0,t)*frequency+1e-9));
  return Array.from({length:count+1},(_,index)=>{
   const time=index/frequency;
   return {index,time,x:position(p,time),v:velocity(p,time)};
  });
 }
 function holes(p,t){
  const currentX=position(p,Math.max(0,number(t)));
  return dots(p,t).map(dot=>({...dot,offsetFromTimer:currentX-dot.x}));
 }
 function groups(p,t){
  const frequency=Math.max(1,number(p.frequency,60));
  const groupSize=Math.max(1,Math.round(number(p.groupSize,6)));
  const lastIndex=Math.floor(Math.max(0,t)*frequency+1e-9);
  const result=[];
  for(let end=groupSize;end<=lastIndex;end+=groupSize){
   const start=end-groupSize,t0=start/frequency,t1=end/frequency;
   result.push({start,end,t0,t1,midTime:(t0+t1)/2,dx:position(p,t1)-position(p,t0),averageVelocity:(position(p,t1)-position(p,t0))/(t1-t0)});
  }
  return result;
 }
 function state(p,t){
  const time=Math.max(0,number(t));
  const frequency=Math.max(1,number(p.frequency,60));
  const groupSize=Math.max(1,Math.round(number(p.groupSize,6)));
  const tapeDots=dots(p,time),tapeHoles=holes(p,time),segments=groups(p,time),latest=segments.length?segments[segments.length-1]:null,previous=segments.length>1?segments[segments.length-2]:null;
  const estimatedAcceleration=latest&&previous?(latest.averageVelocity-previous.averageVelocity)/(latest.midTime-previous.midTime):null;
  return {t:time,x:position(p,time),v:velocity(p,time),a:number(p.acceleration),frequency,interval:1/frequency,groupSize,groupTime:groupSize/frequency,dotCount:tapeDots.length,lastTick:tapeDots.length-1,dots:tapeDots,holes:tapeHoles,groups:segments,latestGroup:latest,estimatedVelocity:latest?latest.averageVelocity:null,estimatedAcceleration};
 }
 const api={state,position,velocity,dots,holes,groups};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
