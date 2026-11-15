/* Geometrical optics: air -> corrugated water -> flat base -> air.
   The transparent base is treated as optically thin. No Fresnel losses. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports ? require('./model.js') : root.RippleModel);
  if(typeof module==='object'&&module.exports) module.exports=api; else root.RippleOptics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const NW=1.333, SIZE=60;
  function surface(p,t,x,y){
    const k=2*Math.PI/p.wavelength, w=2*Math.PI*p.frequency;
    let height=0,dx=0,dy=0;
    for(let i=0;i<2;i++){
      if((i===0&&p.sources==='s2')||(i===1&&p.sources==='s1'))continue;
      const rx=x+(i===0?1:-1)*p.separation/2, r=Math.hypot(rx,y);
      const phase=k*r-w*t+(i===1?p.phase*Math.PI/180:0);
      height+=p.amplitude*Math.cos(phase);
      const derivative=-p.amplitude*k*Math.sin(phase);
      // The mathematical point driver has no unique normal; use a vertical normal exactly at it.
      if(r>1e-10){dx+=derivative*rx/r;dy+=derivative*y/r;}
    }
    return {height,dx,dy};
  }
  function refract(v,n,n1,n2){
    const eta=n1/n2, c=-(v.x*n.x+v.y*n.y+v.z*n.z);
    const q=1-eta*eta*(1-c*c);
    if(q<0)return null;
    const b=eta*c-Math.sqrt(q);
    return {x:eta*v.x+b*n.x,y:eta*v.y+b*n.y,z:eta*v.z+b*n.z};
  }
  function traceRay(p,t,x,y){
    const s=surface(p,t,x,y), length=Math.hypot(s.dx,s.dy,1);
    const normal={x:-s.dx/length,y:-s.dy/length,z:1/length};
    const entry={x,y,z:s.height};
    const water=refract({x:0,y:0,z:-1},normal,1,NW);
    const depth=p.waterDepth??4, gap=p.screenGap??16;
    const travel=(-depth-s.height)/water.z;
    const bottom={x:x+water.x*travel,y:y+water.y*travel,z:-depth};
    const air=refract(water,{x:0,y:0,z:1},NW,1);
    const hit=air ? {x:bottom.x-gap*air.x/air.z,y:bottom.y-gap*air.y/air.z,z:-depth-gap} : null;
    return {entry,normal,water,bottom,air,hit};
  }
  function frame(p,t,resolution=96,samples=3){
    const n=resolution, intensity=new Float64Array(n*n);
    if(p.lightOn===false)return {intensity,peak:0,mean:0,capturedFraction:0,transmittedFraction:0,resolution:n};
    const count=n*samples, weight=1/(samples*samples);
    let transmitted=0;
    for(let j=0;j<count;j++)for(let i=0;i<count;i++){
      const x=-30+(i+.5)*SIZE/count,y=-30+(j+.5)*SIZE/count;
      const r=traceRay(p,t,x,y);
      if(!r.hit)continue;
      transmitted++;
      if(r.hit.x < -30 || r.hit.x > 30 || r.hit.y < -30 || r.hit.y > 30)continue;
      // Bilinear power deposition reduces aliasing without per-frame renormalization.
      const u=(r.hit.x+30)*n/SIZE-.5,v=(r.hit.y+30)*n/SIZE-.5;
      const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
      for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
        const xx=Math.max(0,Math.min(n-1,ix+ox)),yy=Math.max(0,Math.min(n-1,iy+oy));
        intensity[yy*n+xx]+=weight*(ox?fx:1-fx)*(oy?fy:1-fy);
      }
    }
    // Clamp interpolation support at screen edges to conserve each captured ray.
    let sum=0,peak=0;
    for(const value of intensity){sum+=value;peak=Math.max(peak,value);}
    return {intensity,peak,mean:sum/(n*n),capturedFraction:sum/(n*n),transmittedFraction:transmitted/(count*count),resolution:n};
  }
  return {NW,surface,refract,traceRay,frame};
});
