/* Browser-only renderer; no network, build step, or third-party runtime. */
(() => {
'use strict';
const M=window.RippleModel,O=window.RippleOptics,$=id=>document.getElementById(id);
const fixed=Object.freeze({waterDepth:4,screenGap:3});
const defaults={...fixed,wavelength:6,separation:10,frequency:1,amplitude:.15,phase:0,sources:'both',lightOn:true,exaggeration:3,showNodes:true,showRays:true,probeX:0,probeY:15};
let p={...defaults},time=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,speed=.5,mode='optical';
let yaw=-.42,elevation=.40,zoom=1,dirty=true,last=0,accumulator=0,frame;
const scene=$('scene'),screen=$('screen'),chart=$('chart');
const ctx=scene.getContext('2d'),sc=screen.getContext('2d'),cc=chart.getContext('2d');
const texture=document.createElement('canvas'),tc=texture.getContext('2d');
const N=96; texture.width=texture.height=N;
let image=tc.createImageData(N,N),nodalPaths=M.nodes(p),cells=[],project,sceneW=1,sceneH=1;
const ranges={separation:[' cm',0],wavelength:[' cm',1],frequency:[' Hz',2],amplitude:[' cm',2],phase:['°',0],exaggeration:['×',1]};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function syncControls(){
  for(const [key,unit] of [['waterDepth',' cm'],['screenGap',' cm']])$(key+'-out').value=fixed[key]+unit;
  for(const [key,[unit,digits]] of Object.entries(ranges)){
    $(key).value=p[key];
    if(key!=='frequency'||document.activeElement!==$('frequency-out'))$(key+'-out').value=p[key].toFixed(digits)+(key==='frequency'?'':unit);
  }
  for(const key of ['lightOn','showNodes','showRays'])$(key).checked=p[key];
  $('sources').value=p.sources;
  $('wave-speed').textContent=(p.frequency*p.wavelength).toFixed(1)+' cm/s';
  document.querySelectorAll('[data-phase]').forEach(b=>{
    const active=Number(b.dataset.phase)===p.phase;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);
  });
  $('play').textContent=playing?'Ⅱ 暫停':'▶ 播放';
  $('play').setAttribute('aria-label',playing?'暫停模擬':'播放模擬');
  nodalPaths=M.nodes(p);dirty=true;
}
for(const key of Object.keys(ranges))$(key).addEventListener('input',()=>{p[key]=Number($(key).value);syncControls();});
// The numeric field and slider share the same frequency parameter.
$('frequency-out').addEventListener('input',()=>{
  const input=$('frequency-out');
  if(input.value!==''&&input.validity.valid){p.frequency=input.valueAsNumber;syncControls();}
});
$('frequency-out').addEventListener('change',()=>{
  const input=$('frequency-out'),value=input.valueAsNumber;
  if(Number.isFinite(value))p.frequency=Math.round(clamp(value,.25,2)*20)/20;
  input.value=p.frequency.toFixed(2);syncControls();
});
for(const key of ['lightOn','showNodes','showRays'])$(key).addEventListener('change',()=>{p[key]=$(key).checked;syncControls();});
$('sources').addEventListener('change',()=>{p.sources=$('sources').value;syncControls();});
document.querySelectorAll('[data-phase]').forEach(b=>b.addEventListener('click',()=>{p.phase=Number(b.dataset.phase);syncControls();}));
$('play').addEventListener('click',()=>{playing=!playing;syncControls();});
$('step').addEventListener('click',()=>{playing=false;time+=1/(24*p.frequency);syncControls();});
$('speed').addEventListener('change',()=>{speed=Number($('speed').value);});
function setView(name){
  ({oblique:()=>{yaw=-.42;elevation=.40;},top:()=>{yaw=0;elevation=Math.PI/2;},side:()=>{yaw=0;elevation=.10;}}[name])();
  zoom=1;sortCells();dirty=true;
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
function manualView(){document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});sortCells();dirty=true;}
$('reset').addEventListener('click',()=>{p={...defaults};time=0;playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;speed=.5;$('speed').value='.5';setMode('optical');setView('oblique');syncControls();});
function setMode(value){
  mode=value;
  for(const name of ['optical','amplitude']){const active=name===mode;$(name+'-mode').classList.toggle('active',active);$(name+'-mode').setAttribute('aria-pressed',active);}
  $('screen-explanation').textContent=mode==='optical'?'亮暗來自水面折射後光線的聚散，並非水波振幅的直接映射。':'顏色表示各位置的合成振幅，不隨時間改變；這是水波分布圖，不是光學投影。';
  $('scale-min').textContent=mode==='optical'?'暗':'0';
  $('scale-max').textContent=mode==='optical'?'亮':'2A';
  $('color-scale').style.background=mode==='optical'?'linear-gradient(to right,#050505,#fff)':'linear-gradient(to right,#122434,#53d5d4,#fae6a3)';
  dirty=true;
}
$('optical-mode').addEventListener('click',()=>setMode('optical'));
$('amplitude-mode').addEventListener('click',()=>setMode('amplitude'));
function fit(canvas,context){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  context.setTransform(dpr,0,0,dpr,0,0);
  // Match drawing bounds to backing pixels so fractional CSS widths clear every edge pixel.
  return {w:w/dpr,h:h/dpr};
}
const observer=new ResizeObserver(()=>{dirty=true;});
[scene,screen,chart].forEach(c=>observer.observe(c));
let drag=null;
scene.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};scene.setPointerCapture(e.pointerId);});
scene.addEventListener('pointermove',e=>{
  if(!drag)return;
  yaw+=(e.clientX-drag.x)*.008;elevation=clamp(elevation+(e.clientY-drag.y)*.006,.08,Math.PI/2);
  drag={x:e.clientX,y:e.clientY};manualView();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(name,()=>drag=null);
scene.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.7,1.65);dirty=true;},{passive:false});
scene.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();
  if(e.key==='Home'){setView('oblique');return;}
  if(e.key==='ArrowLeft')yaw-=.08;if(e.key==='ArrowRight')yaw+=.08;
  if(e.key==='ArrowUp')elevation+=.05;if(e.key==='ArrowDown')elevation-=.05;
  elevation=clamp(elevation,.08,Math.PI/2);manualView();
});
function pick(e){
  const b=screen.getBoundingClientRect();
  p.probeX=clamp((e.clientX-b.left)/b.width*60-30,-30,30);
  p.probeY=clamp((e.clientY-b.top)/b.height*60-30,-30,30);dirty=true;
}
screen.addEventListener('pointerdown',e=>{pick(e);screen.focus();});
screen.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();if(e.key==='Home'){p.probeX=0;p.probeY=15;}
  if(e.key==='ArrowLeft')p.probeX-=.5;if(e.key==='ArrowRight')p.probeX+=.5;
  if(e.key==='ArrowUp')p.probeY-=.5;if(e.key==='ArrowDown')p.probeY+=.5;
  p.probeX=clamp(p.probeX,-30,30);p.probeY=clamp(p.probeY,-30,30);dirty=true;
});
const GRID=76,spacing=60/GRID;
for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)cells.push({x:-30+i*spacing,y:-30+j*spacing});
function sortCells(){const c=Math.cos(yaw),s=Math.sin(yaw);cells.sort((a,b)=>(a.x-b.x)*s+(a.y-b.y)*c);}
sortCells();
function setupProjection(w,h){
  const c=Math.cos(yaw),s=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);
  function unit(x,y,z){return {x:c*x-s*y,y:se*(s*x+c*y)-ce*z};}
  const bounds=[];
  for(const x of [-31,31])for(const y of [-31,31])for(const z of [-p.waterDepth-p.screenGap,15])bounds.push(unit(x,y,z));
  const minX=Math.min(...bounds.map(v=>v.x)),maxX=Math.max(...bounds.map(v=>v.x));
  const minY=Math.min(...bounds.map(v=>v.y)),maxY=Math.max(...bounds.map(v=>v.y));
  const scale=Math.min((w-48)/(maxX-minX),(h-112)/Math.max(1,maxY-minY))*zoom;
  project=(x,y,z)=>{const q=unit(x,y,z);return {x:w/2+(q.x-(minX+maxX)/2)*scale,y:h/2+8+(q.y-(minY+maxY)/2)*scale};};
}
function path3(points,color,width=1,dash=[]){
  if(!points.length)return;
  ctx.beginPath();points.forEach((a,i)=>{const q=project(a.x,a.y,a.z);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
}
function plane(z,fill,stroke){
  const corners=[[-30,-30],[30,-30],[30,30],[-30,30]].map(([x,y])=>project(x,y,z));
  ctx.beginPath();corners.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function label(text,x,y,color='#a3bcc8'){
  ctx.font='11px "Segoe UI","Microsoft JhengHei",sans-serif';
  const width=ctx.measureText(text).width;
  x=clamp(x,8,sceneW-width-16);y=clamp(y,45,sceneH-36);
  ctx.fillStyle='#10212de8';ctx.fillRect(x-5,y-14,width+10,20);
  ctx.fillStyle=color;ctx.fillText(text,x,y);
}
function marker(x,y,z,text,color){
  const q=project(x,y,z);ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#10212d';ctx.lineWidth=1.5;ctx.stroke();
  label(text,q.x+9,q.y-8,color);
}
function drawTexture(z){
  const a=project(-30,-30,z),b=project(30,-30,z),d=project(-30,30,z);
  ctx.save();ctx.transform((b.x-a.x)/N,(b.y-a.y)/N,(d.x-a.x)/N,(d.y-a.y)/N,a.x,a.y);
  ctx.drawImage(texture,0,0);ctx.restore();
}
function drawScene(){
  const {w,h}=fit(scene,ctx);sceneW=w;sceneH=h;ctx.clearRect(0,0,w,h);setupProjection(w,h);
  const bottom=-p.waterDepth,zScreen=bottom-p.screenGap;
  // Physical screen always shows optical irradiance, even when the comparison view shows amplitude.
  plane(zScreen,'#111','#9caeb7');drawTexture(zScreen);plane(zScreen,null,'#b1c1c9');
  for(const x of [-30,30])for(const y of [-30,30])
    path3([{x,y,z:bottom},{x,y,z:zScreen}],'#61809055',1,[3,5]);
  if(p.showRays&&p.lightOn){
    for(const x of [-20,-10,0,10,20]){
      const y=10,r=O.traceRay(p,time,x,y);
      if(r.hit)path3([r.entry,r.bottom,r.hit],'#f5ce6ca6',1.1);
    }
  }
  plane(bottom,'#19384466','#4b81947a');
  for(const x of [-30,30])for(const y of [-30,30])path3([{x,y,z:bottom},{x,y,z:0}],'#7ba7b480');
  // Sample one shared wave field for all mesh vertices; exaggeration is display-only.
  const points=[];
  for(let j=0;j<=GRID;j++)for(let i=0;i<=GRID;i++){
    const x=-30+i*spacing,y=-30+j*spacing,s=O.surface(p,time,x,y);
    points.push({...project(x,y,s.height*p.exaggeration),...s});
  }
  for(const cell of cells){
    const i=Math.round((cell.x+30)/spacing),j=Math.round((cell.y+30)/spacing),idx=j*(GRID+1)+i;
    const a=points[idx],b=points[idx+1],c=points[idx+GRID+2],d=points[idx+GRID+1];
    const ht=(a.height+b.height+c.height+d.height)/4;
    const light=clamp(.52+ht*.20+(a.dx*.25-a.dy*.35),.12,.97);
    const r=Math.round(17+light*49),g=Math.round(62+light*112),bl=Math.round(82+light*111);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
    ctx.fillStyle='rgb('+r+','+g+','+bl+')';ctx.fill();
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.55;ctx.stroke();
  }
  plane(0,null,'#7ab5c5a0');
  if(p.showNodes)for(const line of nodalPaths)path3(line.map(v=>({...v,z:.035})),'#ffe191',1.3,[5,4]);
  if(p.showRays&&p.lightOn)for(const x of [-20,-10,0,10,20]){
    const r=O.traceRay(p,time,x,10),end={x,y:10,z:r.entry.z*p.exaggeration};
    path3([{x,y:10,z:13},end],'#f9dc8ad0',1);
    const arrow=project(x,10,10);ctx.fillStyle='#f9dc8a';ctx.beginPath();ctx.moveTo(arrow.x-3,arrow.y-4);ctx.lineTo(arrow.x+3,arrow.y-4);ctx.lineTo(arrow.x,arrow.y+3);ctx.fill();
    // Actual optical entry stays physical; connect to the enlarged surface as a dashed display guide.
    if(p.exaggeration!==1)path3([end,r.entry],'#f9dc8a70',1,[2,3]);
  }
  const s1=M.field(p,time,-p.separation/2,0),s2=M.field(p,time,p.separation/2,0);
  if(p.sources!=='s2')marker(-p.separation/2,0,s1.height*p.exaggeration,'S₁','#82eeed');
  if(p.sources!=='s1')marker(p.separation/2,0,s2.height*p.exaggeration,'S₂','#ffb39c');
  const sample=M.state(p,time);marker(p.probeX,p.probeY,sample.height*p.exaggeration,'P','#fff');
  const waterLabel=project(-30,-30,0),screenLabel=project(-30,30,zScreen),lightLabel=project(-20,10,14);
  label('水面 · 起伏 ×'+p.exaggeration,waterLabel.x-8,waterLabel.y-17);
  label('接收屏 · 光影投影',screenLabel.x,screenLabel.y+22);
  if(p.lightOn&&p.showRays)label('↓ 垂直平行光',lightLabel.x,lightLabel.y-10,'#f4d67c');
  if(elevation>1.45)label('俯視時屏幕被水面遮住 → 請看右側屏幕',12,h-48);
}
function updateTexture(){
  frame=O.frame(p,time,N,2);
  for(let i=0;i<N*N;i++){
    // Fixed photographic response, I=1 maps to 128; no automatic contrast normalization.
    const level=Math.round(255*(1-Math.exp(-Math.LN2*frame.intensity[i])));
    image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=level;image.data[i*4+3]=255;
  }
  tc.putImageData(image,0,0);
}
function drawScreen(){
  const {w,h}=fit(screen,sc);sc.clearRect(0,0,w,h);
  if(mode==='optical')sc.drawImage(texture,0,0,w,h);
  else{
    const ampImage=sc.createImageData(N,N);
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const v=p.amplitude?M.field(p,0,-30+(i+.5)*60/N,-30+(j+.5)*60/N).envelope/(2*p.amplitude):0;
      const low=[18,36,52],mid=[83,213,212],high=[250,230,163],a=v<.5?low:mid,b=v<.5?mid:high,f=v<.5?v*2:v*2-1,idx=(j*N+i)*4;
      for(let c=0;c<3;c++)ampImage.data[idx+c]=Math.round(a[c]+(b[c]-a[c])*f);
      ampImage.data[idx+3]=255;
    }
    const temp=document.createElement('canvas');temp.width=temp.height=N;temp.getContext('2d').putImageData(ampImage,0,0);sc.drawImage(temp,0,0,w,h);
  }
  if(p.showNodes){
    sc.strokeStyle='#ffe191b0';sc.lineWidth=1;sc.setLineDash([4,4]);
    for(const line of nodalPaths){sc.beginPath();line.forEach((v,i)=>{const x=(v.x+30)*w/60,y=(v.y+30)*h/60;i?sc.lineTo(x,y):sc.moveTo(x,y);});sc.stroke();}
    sc.setLineDash([]);
  }
  // Source positions are alignment references, not literal shadows.
  for(const [x,name,color,active] of [[-p.separation/2,'S₁','#82eeed',p.sources!=='s2'],[p.separation/2,'S₂','#ffb39c',p.sources!=='s1']]){
    if(!active)continue;const xx=(x+30)*w/60;
    sc.fillStyle=color;sc.beginPath();sc.arc(xx,h/2,3,0,Math.PI*2);sc.fill();
    sc.font='11px sans-serif';sc.strokeStyle='#10212d';sc.lineWidth=3;sc.strokeText(name,xx+6,h/2-6);sc.fillText(name,xx+6,h/2-6);
  }
  const px=(p.probeX+30)*w/60,py=(p.probeY+30)*h/60;
  sc.strokeStyle='#fff';sc.lineWidth=1.5;sc.beginPath();sc.arc(px,py,6,0,Math.PI*2);sc.moveTo(px-10,py);sc.lineTo(px-3,py);sc.moveTo(px+3,py);sc.lineTo(px+10,py);sc.moveTo(px,py-10);sc.lineTo(px,py-3);sc.moveTo(px,py+3);sc.lineTo(px,py+10);sc.stroke();
  sc.fillStyle='#fff';sc.font='11px sans-serif';sc.fillText('P',clamp(px+9,5,w-12),clamp(py-9,14,h-8));
}
function drawChart(){
  const {w,h}=fit(chart,cc),left=35,right=w-12,top=12,bottom=h-19,mid=(top+bottom)/2;
  cc.clearRect(0,0,w,h);cc.font='10px sans-serif';cc.lineWidth=1;
  for(let i=0;i<=4;i++){const x=left+(right-left)*i/4;cc.strokeStyle='#2d414d';cc.beginPath();cc.moveTo(x,top);cc.lineTo(x,bottom);cc.stroke();}
  cc.strokeStyle='#48606b';cc.beginPath();cc.moveTo(left,mid);cc.lineTo(right,mid);cc.stroke();
  cc.fillStyle='#8fa9b7';cc.fillText('η / cm',0,9);cc.fillText('0',16,mid+3);
  const max=Math.max(.2,2*p.amplitude),yscale=(bottom-top)/2/max;
  cc.fillText(max.toFixed(1),5,top+5);cc.fillText((-max).toFixed(1),1,bottom+4);
  const start=time-1/p.frequency,end=time+1/p.frequency;
  for(const [key,color,width] of [['first','#70dbdc',1.3],['second','#f6a68d',1.3],['height','#fff',2]]){
    cc.strokeStyle=color;cc.lineWidth=width;cc.beginPath();
    for(let i=0;i<=240;i++){const s=M.state(p,start+(end-start)*i/240),x=left+(right-left)*i/240,y=mid-s[key]*yscale;i?cc.lineTo(x,y):cc.moveTo(x,y);}
    cc.stroke();
  }
  const x=(left+right)/2;cc.setLineDash([3,3]);cc.strokeStyle='#f4d67c';cc.lineWidth=1;cc.beginPath();cc.moveTo(x,top);cc.lineTo(x,bottom);cc.stroke();cc.setLineDash([]);
  cc.fillStyle='#8fa9b7';cc.fillText('t − T',left,bottom+15);cc.fillStyle='#f4d67c';cc.fillText('現在',x-10,bottom+15);cc.fillStyle='#8fa9b7';cc.fillText('t + T',right-24,bottom+15);
}
function readouts(){
  const s=M.state(p,time);$('clock').textContent='t = '+time.toFixed(2)+' s';
  $('path-value').textContent=s.pathDifference.toFixed(2)+' cm';$('envelope-value').textContent=s.envelope.toFixed(2)+' cm';
  let text=p.amplitude===0?'振幅為零：平靜水面。':p.sources!=='both'?'單一波源：沒有雙源干涉。':s.envelope<.001?'破壞性干涉：這個位置始終不振動。':Math.abs(s.envelope-2*p.amplitude)<.001?'建設性干涉：合成振幅為 2A。':'部分相長／相消：合成振幅介於 0 與 2A。';
  $('probe-description').textContent=text;
}
function draw(){updateTexture();drawScene();drawScreen();drawChart();readouts();dirty=false;}
function tick(now){
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;accumulator+=dt;
  if(playing&&!document.hidden){time+=dt*speed;dirty=true;}
  // Keep all views at the same simulation time. Limit expensive ray tracing to 24 fps.
  if(dirty&&accumulator>=1/24){draw();accumulator=0;}
  requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{last=0;});
syncControls();draw();requestAnimationFrame(tick);
})();
