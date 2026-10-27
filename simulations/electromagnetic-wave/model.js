/* Vacuum plane wave. Inputs: MHz, V/m, m, ns. c is rounded for high-school calculations. */
(function(root){
 'use strict';
 const C=3e8;
 function field(p,x,t){
  const f=p.frequency*1e6, lambda=C/f, direction=Number(p.direction);
  const phase=2*Math.PI*(x/lambda-direction*f*t*1e-9);
  const raw=Math.sin(phase), wave=Math.abs(raw)<1e-12?0:raw;
  const ey=p.amplitude*wave, bz=direction*ey/C;
  return {ey,bz,bnT:bz*1e9,wave,phase};
 }
 function state(p,t){
  const f=p.frequency*1e6;
  return {t,...field(p,p.probe,t),lambda:C/f,period:1e9/f,b0:p.amplitude/C*1e9,direction:Number(p.direction)};
 }
 const api={C,field,state};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
