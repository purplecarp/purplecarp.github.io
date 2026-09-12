(function(root){
 'use strict';
 function state(p,t){const omega=Math.sqrt(p.k/p.m),theta=omega*t,x=p.amplitude*Math.cos(theta),v=-p.amplitude*omega*Math.sin(theta),a=-omega*omega*x;return {t,omega,theta,x,v,a,force:-p.k*x,period:2*Math.PI/omega,energy:.5*p.k*p.amplitude*p.amplitude,circleY:p.amplitude*Math.sin(theta),circleVY:p.amplitude*omega*Math.cos(theta),circleAY:-omega*omega*p.amplitude*Math.sin(theta)};}
 const api={state};if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
