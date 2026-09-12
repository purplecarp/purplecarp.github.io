(function(root){
 'use strict';
 function state(p,t){const radius=p.lock?p.n*p.n:p.radius,wavelength=p.lock?2*Math.PI*p.n:p.wavelength,ratio=2*Math.PI*radius/wavelength,nearest=Math.round(ratio),mismatch=2*Math.PI*(ratio-nearest),allowed=nearest>=1&&Math.abs(ratio-nearest)<1e-6;return {t,radius,wavelength,ratio,mismatch,allowed,n:nearest,energy:p.lock?-13.6/(p.n*p.n):null,phase:Math.cos(2*Math.PI*t)};}
 function wave(p,t,theta){const s=state(p,t);return Math.sin(s.ratio*theta)*s.phase;}
 const api={state,wave};if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
