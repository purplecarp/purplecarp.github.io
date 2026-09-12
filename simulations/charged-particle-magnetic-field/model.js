(function(root){
 'use strict';
 function state(p,t){
  const q=p.charge*1e-19,m=p.mass*1e-27,B=p.field*(p.direction==='out'?1:-1),v=p.velocity*1e6,theta=p.angle*Math.PI/180;
  const vx0=v*Math.cos(theta),vy0=v*Math.sin(theta),omega=q*B/m,seconds=t*1e-9;
  const initial={left:[-.05,0],right:[.05,0],top:[0,.05],bottom:[0,-.05]}[p.position]||[0,0];
  let x=initial[0]+vx0*seconds,y=initial[1]+vy0*seconds,vx=vx0,vy=vy0;
  if(omega!==0){const phase=omega*seconds,s=Math.sin(phase),c=Math.cos(phase);vx=vx0*c+vy0*s;vy=vy0*c-vx0*s;x=initial[0]+(vx0*s+vy0*(1-c))/omega;y=initial[1]+(vy0*s-vx0*(1-c))/omega;}
  return {t,x,y,vx,vy,speed:Math.hypot(vx,vy),fx:q*vy*B,fy:-q*vx*B,radius:omega===0?Infinity:v/Math.abs(omega),period:omega===0?Infinity:2*Math.PI/Math.abs(omega)*1e9,omega,cx:omega===0?0:initial[0]+vy0/omega,cy:omega===0?0:initial[1]-vx0/omega};
 }
 const api={state};if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
