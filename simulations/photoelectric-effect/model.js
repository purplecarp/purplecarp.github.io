(function(root){
 'use strict';
 const H=4.135667696e-15,C=299792458,HC=H*C*1e9;
 const metals={Cs:2.14,K:2.30,Na:2.28,Mg:3.66,Zn:3.74,Al:4.08,Ag:4.26,Cu:4.70,Au:5.10,Ni:5.15,Pt:5.65};
 function spectrum(p){return p.mode==='all'?[200,800]:p.mode==='white'?[380,750]:[p.wavelength,p.wavelength];}
 function state(p,t){const phi=metals[p.metal],[lambda,longest]=spectrum(p),energy=HC/lambda,maxKE=Math.max(0,energy-phi);return {t,phi,energy,minEnergy:HC/longest,maxKE,frequency:C/(lambda*1e-9)/1e12,threshold:phi/H/1e12,cutoff:HC/phi,emitting:p.intensity>0&&energy>phi,rate:24*p.intensity/100};}
 function sample(p,index){const [shortest,longest]=spectrum(p),lambda=shortest+(longest-shortest)*((index*.61803398875)%1),maximum=HC/lambda-metals[p.metal];return {lambda,frequency:C/(lambda*1e-9)/1e12,maximum,energy:Math.max(0,maximum)*(.15+.85*((index*.41421356237)%1))};}
 function events(p,t){const rate=state(p,t).rate;if(rate<=0)return[];const count=Math.floor(Math.max(0,t-.45)*rate);return Array.from({length:Math.min(count,500)},(_,i)=>{const index=count-Math.min(count,500)+i+1;return {...sample(p,index),index,age:t-index/rate-.45};}).filter(e=>e.maximum>0);}

 // Capture each photon at launch; later parameter changes cannot alter its energy.
 class Experiment {
  constructor(){this.reset();}
  reset(){this.params=null;this.time=0;this.photons=[];this.electrons=[];this.arrived=0;this.clearedAt=-1;}
  clearData(t){this.clearedAt=t;}
  update(p,t){
   if(this.params&&['mode','metal','intensity'].some(k=>this.params[k]!==p[k]))this.reset();
   if(!this.params)this.params={...p};
   const rate=state(this.params,t).rate;
   if(t<this.time){
    this.photons=this.photons.filter(e=>e.born<=t);
    this.electrons=this.electrons.filter(e=>e.emittedAt<=t);
    const pending=this.photons.findIndex(e=>e.emittedAt>t);
    this.arrived=pending<0?this.photons.length:pending;
    this.clearedAt=Math.min(this.clearedAt,t);
   }
   const total=Math.floor(t*rate);
   for(let index=this.photons.length+1;index<=total;index++){
    const born=index/rate;
    this.photons.push({...sample(this.params,index),index,born,emittedAt:born+.45});
   }
   while(this.arrived<this.photons.length&&this.photons[this.arrived].emittedAt<=t){
    const photon=this.photons[this.arrived++];
    if(photon.maximum>0)this.electrons.push(photon);
   }
   this.params={...p};this.time=t;
   return {
    photons:this.photons.slice(this.arrived),
    activeElectrons:this.electrons.slice(-50).filter(e=>t-e.emittedAt<=1.8),
    data:this.electrons.filter(e=>e.emittedAt>this.clearedAt)
   };
  }
 }
 const api={state,sample,events,metals,H,HC,Experiment};if(typeof module!=='undefined')module.exports=api;else root.PhysicsModel=api;
})(globalThis);
