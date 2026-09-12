/* Pure physics: use the same function for animation, readouts, graphs and tests. */
(function(root){
 'use strict';
 function state(p,t){return {t,x:p.x0+p.velocity*t,v:p.velocity,a:0};}
 const api={state};
 if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
