/* SI units. The same pure model supplies the scene, meters and waveforms. */
(function(root){
 'use strict';
 const TAU=2*Math.PI, radius=.1, area=Math.PI*radius*radius, length=.16;
 const defaults={mode:'magnet',motion:'manual',magnetX:-25,coilX:10,polarity:1,field:.2,turns:20,resistance:10,rpm:30,angle:0,amplitude:22,frequency:.4,azimuth:-25,elevation:22,lines:true,normal:true,speed:1,manualVelocity:0};
 function flux(p,d){return p.polarity*p.field*area/Math.pow(1+(d/length)**2,1.5);}
 function gradient(p,d){return -3*p.polarity*p.field*area*d/(length*length)*Math.pow(1+(d/length)**2,-2.5);}
 function state(p,t){
  if(p.mode==='magnet'){
   let magnet=p.magnetX/100,coil=p.coilX/100,vm=0,vc=0;
   const phase=TAU*p.frequency*t,offset=p.amplitude/100*Math.sin(phase),v=p.amplitude/100*TAU*p.frequency*Math.cos(phase);
   if(p.motion==='magnet'||p.motion==='together'){magnet+=offset;vm=v;}
   if(p.motion==='coil'||p.motion==='together'){coil+=offset;vc=v;}
   const relative=p.motion==='manual'?(p.manualVelocity||0):vc-vm,d=coil-magnet;
   const phi=flux(p,d),emf=-p.turns*gradient(p,d)*relative;
   return {t,magnet,coil,vm,vc,relative,phi,emf,output:emf,current:emf/p.resistance,theta:0,omega:0};
  }
  const omega=TAU*p.rpm/60,theta=p.angle*Math.PI/180+omega*t,A=.04;
  const phi=p.field*A*Math.cos(theta),emf=p.turns*p.field*A*omega*Math.sin(theta);
  const output=p.mode==='dc'?Math.abs(emf):emf;
  return {t,theta,omega,phi,emf,output,current:output/p.resistance,internalCurrent:emf/p.resistance,peak:p.turns*p.field*A*Math.abs(omega)};
 }
 const api={defaults,state,flux,gradient,radius,area,length,TAU};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
