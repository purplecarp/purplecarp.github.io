(function(root){
 'use strict';
 function velocities(m1,m2,u1,u2){return [((m1-m2)*u1+2*m2*u2)/(m1+m2),(2*m1*u1+(m2-m1)*u2)/(m1+m2)];}
 function instantState(p,t){
  let x1=5,x2=15,v1=p.u1,v2=p.u2,elapsed=0,count=0,wallHits=0;
  const r1=1+.04*p.m1,r2=1+.04*p.m2;
  for(let i=0;i<5000&&elapsed<t-1e-10;i++){
   const events=[];
   if(v1>v2)events.push({dt:Math.max(0,(x2-x1-r1-r2)/(v1-v2)),kind:'pair'});
   if(p.walls){
    if(v1<0)events.push({dt:Math.max(0,(r1-x1)/v1),kind:'a'});
    if(v2>0)events.push({dt:Math.max(0,(20-r2-x2)/v2),kind:'b'});
   }
   events.sort((a,b)=>a.dt-b.dt);const event=events[0],remaining=t-elapsed;
   if(!event||event.dt>remaining){x1+=v1*remaining;x2+=v2*remaining;elapsed=t;break;}
   x1+=v1*event.dt;x2+=v2*event.dt;elapsed+=event.dt;
   if(event.kind==='pair'){[v1,v2]=velocities(p.m1,p.m2,v1,v2);count++;}
   else if(event.kind==='a'){v1=-v1;wallHits++;}else{v2=-v2;wallHits++;}
  }
  return {t,x1,x2,v1,v2,r1,r2,count,wallHits,p1:p.m1*v1,p2:p.m2*v2,momentum:p.m1*v1+p.m2*v2,e1:.5*p.m1*v1*v1,e2:.5*p.m2*v2*v2,energy:.5*p.m1*v1*v1+.5*p.m2*v2*v2};
 }
 // A massless spring attached to A pushes B only while compressed.
 // Exact center-of-mass / relative-motion solution; no integration drift.
 function springState(p,t){
  const m=p.m1+p.m2,mu=p.m1*p.m2/m,k=p.k??100;
  const r1=1+.04*p.m1,r2=1+.04*p.m2,springLength=4;
  const relative=p.u1-p.u2,omega=Math.sqrt(k/mu);
  const contactTime=relative>0?(10-r1-r2-springLength)/relative:Infinity;
  const contactDuration=Math.PI/omega,phase=t-contactTime;
  let x1=5+p.u1*t,x2=15+p.u2*t,v1=p.u1,v2=p.u2,compression=0,count=0,stage='尚未接觸';
  if(phase>=0){
   count=1;
   const center=(p.m1*5+p.m2*15)/m+(p.m1*p.u1+p.m2*p.u2)/m*t;
   const centerV=(p.m1*p.u1+p.m2*p.u2)/m;
   let separation,relativeV;
   if(phase<contactDuration){
    compression=relative/omega*Math.sin(omega*phase);
    separation=r1+r2+springLength-compression;
    relativeV=relative*Math.cos(omega*phase);
    stage=phase<contactDuration/2?'壓縮中':'回彈中';
   }else{
    separation=r1+r2+springLength+relative*(phase-contactDuration);
    relativeV=-relative;stage='已分離';
   }
   x1=center-p.m2/m*separation;x2=center+p.m1/m*separation;
   v1=centerV+p.m2/m*relativeV;v2=centerV-p.m1/m*relativeV;
  }
  const e1=.5*p.m1*v1*v1,e2=.5*p.m2*v2*v2,potential=.5*k*compression*compression;
  return {t,x1,x2,v1,v2,r1,r2,count,wallHits:0,p1:p.m1*v1,p2:p.m2*v2,momentum:p.m1*v1+p.m2*v2,e1,e2,energy:e1+e2,potential,totalEnergy:e1+e2+potential,compression,springLength,contactTime,contactDuration,stage,force:k*compression};
 }
 function state(p,t){
  if(p.mode==='spring')return springState(p,t);
  const s=instantState(p,t);
  return {...s,potential:0,totalEnergy:s.energy,compression:0,force:0};
 }
 const api={state,velocities};if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
