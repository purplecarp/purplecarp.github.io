/* Ideal two-body model. Distance: AU; time: yr; central mass: solar masses.
 * Adopt GM_sun = 4 pi² AU³/yr²; orbiting masses are negligible.
 */
(function(root){
 'use strict';
 const TAU=2*Math.PI;
 function period(a,mass){return Math.sqrt(a*a*a/mass);}
 function eccentricAnomaly(mean,e){
  const m=((mean%TAU)+TAU)%TAU;
  let E=e<.8?m:Math.PI;
  for(let i=0;i<30;i++){
   const delta=(E-e*Math.sin(E)-m)/(1-e*Math.cos(E));
   E-=delta;if(Math.abs(delta)<1e-13)break;
  }
  return E;
 }
 function orbit(a,e,mass,t){
  const T=period(a,mass),n=TAU/T,b=a*Math.sqrt(1-e*e),mu=TAU*TAU*mass;
  const E=eccentricAnomaly(n*t,e),d=1-e*Math.cos(E);
  const x=a*(Math.cos(E)-e),y=b*Math.sin(E);
  const vx=-a*n*Math.sin(E)/d,vy=b*n*Math.cos(E)/d,r=a*d;
  return {a,b,e,t,period:T,E,x,y,vx,vy,r,speed:Math.hypot(vx,vy),
   ax:-mu*x/(r*r*r),ay:-mu*y/(r*r*r),acceleration:mu/(r*r),
   perihelion:a*(1-e),aphelion:a*(1+e),areaRate:Math.PI*a*b/T,
   energy:-mu/(2*a),angularMomentum:Math.sqrt(mu*a*(1-e*e)),ratio:T*T/(a*a*a)};
 }
 function sector(a,e,mass,start,dt,samples=160){
  return Array.from({length:samples+1},(_,i)=>orbit(a,e,mass,start+dt*i/samples));
 }
 function sweptArea(a,e,mass,dt){return Math.PI*a*a*Math.sqrt(1-e*e)*dt/period(a,mass);}
 function state(p,t){
  const primary=orbit(p.a,p.e,p.mass,t),secondary=orbit(p.a2,p.e,p.mass,t);
  const interval=primary.period/Number(p.divisions);
  return {...primary,secondary,interval,sectorArea:sweptArea(p.a,p.e,p.mass,interval)};
 }
 const api={period,eccentricAnomaly,orbit,sector,sweptArea,state};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
