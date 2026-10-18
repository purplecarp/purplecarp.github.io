/* Classroom owns the only animation loop, clock, canvas size and DPR transform. */
(() => {
 'use strict';
 const M=PhysicsModel,C=LessonColors;
 const defaults={mode:'wire',current:5,radius:8,turns:20,length:50,probeX:12,probeY:0,
  azimuth:-40,elevation:24,zoom:1,lines:true,vectors:false,plane:true,speed:1};
 const names={wire:'長直導線',loop:'環形線圈',solenoid:'螺線管'};
 const number=v=>Number.isFinite(v)?(Math.abs(v)<.0005?'0.000':v.toFixed(3)):'—';
 let geometryKey='',geometry=null;
 function extent(p){return p.mode==='wire'?.32:Math.max(.3,p.radius*2.4,p.mode==='solenoid'?p.length*.8:0);}
 function ring(x,r){return Array.from({length:97},(_,i)=>{const t=i*Math.PI/48;return [x,r*Math.cos(t),r*Math.sin(t)];});}
 function getGeometry(p){
  const key=[p.mode,p.radius,p.turns,p.length].join(':');if(key===geometryKey)return geometry;
  geometryKey=key;const e=extent(p),unit={...p,current:1},flat=[],spatial=[],conductors=[];
  if(p.mode==='wire'){
   for(const r of [.055,.1,.16,.24,.31]){
    const circle=Array.from({length:97},(_,i)=>[r*Math.cos(i*Math.PI/48),r*Math.sin(i*Math.PI/48),0]);flat.push(circle);
    if(r===.055||r===.16||r===.31)for(const z of [-e*.65,0,e*.65])spatial.push(circle.map(v=>[v[0],v[1],z]));
   }
   conductors.push(Array.from({length:49},(_,i)=>[0,0,-e+i*e/24]));
  }else{
   for(const fraction of [.25,.55,.8]){
    const seed=[0,fraction*p.radius],raw=[...M.trace(unit,seed,e,-1).reverse(),...M.trace(unit,seed,e,1).slice(1)];
    const path=raw.filter((_,i)=>i%3===0||i===raw.length-1);
    for(const sign of [-1,1])flat.push(path.map(v=>[v[0],v[1]*sign,0]));
    for(const phi of [0,Math.PI/2,Math.PI,3*Math.PI/2])spatial.push(path.map(v=>[v[0],v[1]*Math.cos(phi),v[1]*Math.sin(phi)]));
   }
   const axis=[[-e*1.2,0,0],[e*1.2,0,0]];flat.push(axis);spatial.push(axis);
   for(const x of M.centers(p))conductors.push(ring(x,p.radius));
  }
  const vectors=[];
  for(let ix=-4;ix<=4;ix++)for(let iy=-3;iy<=3;iy++){
   const x=ix*e/4,y=iy*e/4,f=M.field(unit,x,y);
   if(f.magnitude>1e-15)vectors.push({point:[x,y,0],unit:[f.bx/f.magnitude,f.by/f.magnitude,0]});
  }
  geometry={flat,spatial,conductors,vectors,e};return geometry;
 }
 function projector(a,p,spatial){
  const e=extent(p),scale=Math.min((a.width-60)/(e*2.9),(a.height-100)/(e*2.35))*a.p.zoom;
  const center=[a.width/2,a.height/2+4];
  const project=v=>{const r=spatial?M.rotate(v,a.p.azimuth,a.p.elevation):v;return [center[0]+r[0]*scale,center[1]-r[1]*scale,r[2]];};
  return {project,scale,center,e};
 }
 function head(a,x,y,dx,dy,color,size=18){
  if(Math.hypot(dx,dy)<.01)return;const angle=Math.atan2(dy,dx);
  const c=a.ctx,h=size*(a.large?1.2:1);
  c.fillStyle=color;c.beginPath();c.moveTo(x,y);
  c.lineTo(x-h*Math.cos(angle-.48),y-h*Math.sin(angle-.48));
  c.lineTo(x-h*Math.cos(angle+.48),y-h*Math.sin(angle+.48));c.closePath();c.fill();
 }
 function arrow(a,x,y,dx,dy,color,size=20){
  if(Math.hypot(dx,dy)<.5)return;
  a.line(x,y,x+dx,y+dy,color,4.5);head(a,x+dx,y+dy,dx,dy,color,size);
 }
 function crossSection(a,project,x,y,sign,r){
  const [px,py]=project([x,y,0]);a.dot(px,py,r+2,C.orange);a.dot(px,py,r,'#263747');
  if(sign>0)a.dot(px,py,Math.max(1.8,r*.25),C.orange);
  if(sign<0){const d=r*.45;a.line(px-d,py-d,px+d,py+d,C.orange,1.8);a.line(px+d,py-d,px-d,py+d,C.orange,1.8);}
 }
 function drawScene(a,s,spatial){
  const p=s.physical,g=getGeometry(p),{project,scale,center,e}=projector(a,p,spatial),sign=Math.sign(p.current),ctx=a.ctx;
  a.canvas.dataset.spatial=String(spatial);
  a.canvas.setAttribute('aria-label',names[p.mode]+(spatial?'立體視角；拖曳旋轉，方向鍵旋轉。':'平面視角；拖曳測量點，方向鍵移動。'));
  // The measured point is shared between views and always belongs to z = 0.
  if(a.p.plane){
   const corners=[[-e,-e*.8,0],[e,-e*.8,0],[e,e*.8,0],[-e,e*.8,0]].map(project);
   ctx.beginPath();corners.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle='#62b9fa08';ctx.fill();
   for(let i=-4;i<=4;i++){
    const v=i*e/4;for(const points of [[[v,-e,0],[v,e,0]],[[-e,v,0],[e,v,0]]]){const b=project(points[0]),c=project(points[1]);a.line(b[0],b[1],c[0],c[1],C.grid,.7);}
   }
  }
  // Painter-sort small segments, so crossing rings and field lines retain depth cues.
  const segments=[];
  function addPath(path,color,width,arrowSpacing){
   const points=path.map(project);
   for(let i=1;i<points.length;i++)segments.push({a:points[i-1],b:points[i],color,width,arrow:sign&&i%arrowSpacing===0});
  }
  if(sign&&a.p.lines)for(const path of spatial?g.spatial:g.flat)addPath(path,C.green,2,22);
  if(spatial)g.conductors.forEach((path,i)=>{
   const marked=p.mode!=='solenoid'||i%Math.ceil(g.conductors.length/5)===0;
   addPath(path,C.orange,p.mode==='wire'?6:3,marked?(p.mode==='wire'?16:48):Infinity);
  });
  if(spatial)segments.sort((a,b)=>(a.a[2]+a.b[2])-(b.a[2]+b.b[2]));
  ctx.save();ctx.beginPath();ctx.rect(0,44,a.width,a.height-80);ctx.clip();
  for(const line of segments){
   ctx.globalAlpha=spatial?Math.max(.3,Math.min(1,.68+(line.a[2]+line.b[2])/(e*4))):.85;
   a.line(line.a[0],line.a[1],line.b[0],line.b[1],line.color,line.width);
   if(line.arrow)head(a,line.b[0],line.b[1],(line.b[0]-line.a[0])*sign,(line.b[1]-line.a[1])*sign,line.color);
  }
  ctx.globalAlpha=1;
  if(sign&&a.p.vectors){
   for(const v of g.vectors){
    const b=project(v.point),c=project(v.point.map((value,j)=>value+v.unit[j]*sign*.05));
    arrow(a,b[0],b[1],c[0]-b[0],c[1]-b[1],C.green,14);
   }
  }
  if(!spatial){
   if(p.mode==='wire')crossSection(a,project,0,0,sign,12);
   else for(const x of M.centers(p))crossSection(a,project,x,p.radius,sign,p.mode==='loop'?10:4),crossSection(a,project,x,-p.radius,-sign,p.mode==='loop'?10:4);
  }
  const f=s.field,P=project([s.x,s.y,0]);
  if(f.magnitude>0){const tip=project([s.x+f.bx/f.magnitude*.11,s.y+f.by/f.magnitude*.11,0]);arrow(a,P[0],P[1],tip[0]-P[0],tip[1]-P[1],C.yellow,23);}
  a.dot(P[0],P[1],8,C.yellow);a.dot(P[0],P[1],4,'#101e2e');
  ctx.restore();
  if(P[0]>8&&P[0]<a.width-25&&P[1]>62&&P[1]<a.height-40)a.text('P',P[0]+11,P[1]-9,C.yellow,24);
  else a.text('P 在畫面外；可按測量點歸位',a.width/2,a.height-45,C.yellow,18,'center');
  if(p.mode==='solenoid'&&sign){
   for(const side of [-1,1]){const v=project([side*(p.length/2+.035),p.radius+.025,0]);a.text(side*sign>0?'N':'S',v[0],v[1],C.orange,24,'center');}
  }
  // A separate orientation triad remains readable at every camera angle.
  const origin=[a.width-82,a.height-78];
  for(const [v,label] of [[[.075,0,0],'x'],[[0,.075,0],'y'],[[0,0,.075],'z']]){
   if(!spatial&&label==='z')continue;const r=spatial?M.rotate(v,a.p.azimuth,a.p.elevation):v;
   arrow(a,origin[0],origin[1],r[0]*650,-r[1]*650,C.ink,20);a.text(label,origin[0]+r[0]*850,origin[1]-r[1]*850,C.ink,22,'center');
  }
  a.text(names[p.mode]+(spatial?' · 立體':' · 平面'),14,31,C.ink,24);
  if(!sign)a.text('I = 0：B = 0',a.width/2,62,C.yellow,24,'center');
  const hint=spatial?'拖曳旋轉 · P 固定於 xy 平面':p.mode==='wire'?'拖曳 P 測量 · ⊙ 出紙面／⊗ 入紙面':'拖曳 P 測量 · 上下截面為同一匝';
  a.text(hint,a.width/2,a.height-12,C.ink,a.width<480?16:20,'center');
  a.line(18,a.height-57,18+scale*.1,a.height-57,C.ink,2);a.text('10 cm',18,a.height-68,C.ink,18);
 }
 function drawGraph(a,s){
  const component=a.p.mode==='wire'?'by':'bx',f=M.field({...s.physical,current:1},s.x,s.y),slope=f[component]*1e6;
  const limit={wire:50,loop:200,solenoid:1500}[a.p.mode];
  a.graph({xmin:-10,xmax:10,ymin:-limit,ymax:limit,xlabel:'I (A)',ylabel:(component==='bx'?'Bₓ':'Bᵧ')+' (μT)',
   series:Number.isFinite(slope)?[{color:C.green,data:[{x:-10,y:-10*slope},{x:10,y:10*slope}]}]:[],
   points:Number.isFinite(slope)?[{x:a.p.current,y:slope*a.p.current,color:C.yellow,radius:7}]:[]});
  const text=!Number.isFinite(slope)?'P 太靠近導線，請移開':Math.abs(slope*a.p.current)>limit?`讀值超出 ±${limit} μT 圖界`:`固定尺度 ±${limit} μT；黃點為目前電流`;
  a.text(text,a.width/2,56,C.yellow,a.width<480?18:24,'center');
 }
 const config={
  title:'電流的磁效應：平面與立體觀察',defaults,
  controlsHelp:'調整電流或導線形狀，即時觀察磁場。平面圖可移動測量點，立體圖可拖曳旋轉。',
  controls:[
   {key:'mode',label:'導線形狀',type:'select',options:[['wire','長直導線'],['loop','環形線圈'],['solenoid','螺線管']]},
   {key:'current',label:'電流 I',min:-10,max:10,step:.5,unit:'A',digits:1},
   {key:'radius',label:'線圈半徑 R',min:4,max:16,step:1,unit:'cm',disabled:p=>p.mode==='wire'},
   {key:'turns',label:'總匝數 N',min:4,max:40,step:1,unit:'匝',disabled:p=>p.mode!=='solenoid'},
   {key:'length',label:'螺線管長度 L',min:20,max:80,step:2,unit:'cm',disabled:p=>p.mode!=='solenoid'},
   {key:'probeX',label:'測量位置 x',min:-70,max:70,step:1,unit:'cm',display:true},
   {key:'probeY',label:'測量位置 y',min:-50,max:50,step:1,unit:'cm',display:true},
   {key:'azimuth',label:'立體方位角',min:-180,max:180,step:5,unit:'°',display:true},
   {key:'elevation',label:'立體仰角',min:-75,max:75,step:5,unit:'°',display:true},
   {key:'zoom',label:'視圖縮放',min:.6,max:1.6,step:.1,unit:'×',display:true,digits:1},
   {key:'lines',label:'顯示磁力線（綠）',type:'check',display:true},
   {key:'vectors',label:'顯示磁場方向箭頭',type:'check',display:true},
   {key:'plane',label:'顯示 xy 測量平面',type:'check',display:true}
  ],
  normalize(p,key){if(key==='mode'){p.probeX=p.mode==='wire'?12:0;p.probeY=0;}},
  state:p=>M.state(p,0),duration:()=>1,
  views:[{label:'平面視角',draw:(a,s)=>drawScene(a,s,false)},{label:'立體視角',draw:(a,s)=>drawScene(a,s,true)},{label:'電流－磁場',draw:drawGraph}],
  metrics:(p,s)=>[['磁場大小 |B|',number(s.field.magnitude*1e6),'μT'],['磁場分量 Bₓ',number(s.field.bx*1e6),'μT'],['磁場分量 Bᵧ',number(s.field.by*1e6),'μT'],['電流 I',p.current.toFixed(1),'A']],
  note(p,s){
   const location=`P = (${p.probeX.toFixed(0)}, ${p.probeY.toFixed(0)}, 0) cm。`;
   const value=s.field.excluded?'距導線小於 0.8 cm，請移開 P。':p.current===0?'電流為零，磁場方向未定。':p.mode==='wire'?(p.current>0?'正電流沿 +z，平面磁場逆時針。':'負電流沿 −z，平面磁場順時針。'):`中心磁場朝${p.current>0?'右（+x）':'左（−x）'}；中心 |B| = ${number(Math.abs(s.center)*1e6)} μT。`;
   return location+value+(p.mode==='solenoid'?`長管近似 ${number(Math.abs(s.ideal)*1e6)} μT。`:'')+'綠：磁場；橙：電流。箭頭只表示方向，強度請讀數值。';
  },
  presets:[
   {label:'① 基本現象：長直導線',values:{},question:'正電流沿 +z。先預測磁場方向，再切到立體視角，觀察磁力線和導線的夾角。',answer:'磁場環繞導線，位於垂直導線的平面；從 +z 看，磁場逆時針。'},
   {label:'② 只改電流：加倍比較',values:{current:10},question:'與情境①相比，只將電流從 5 A 加倍至 10 A。P 點磁場大小如何變化？',answer:'形狀及 P 點不變時，磁場加倍。r = 12 cm 時，由 8.333 μT 增為 16.667 μT。'},
   {label:'③ 邊界情況：線圈無電流',values:{mode:'loop',current:0,probeX:0},question:'完整線圈仍在，沒有電流時是否還有本模型的磁場？再調成正、負電流比較。',answer:'本模型忽略地磁與磁性材料，零電流時 B = 0，方向未定；電流反向，磁場也反向。'}
  ],
  actions:[
   {label:'反轉電流',run(a){a.p.current=-a.p.current;a.reset();a.sync();}},
   {label:'電流歸零',run(a){a.p.current=0;a.reset();a.sync();}},
   {label:'測量點歸位',run(a){a.p.probeX=a.p.mode==='wire'?12:0;a.p.probeY=0;a.sync();}},
   {label:'立體視角歸位',run(a){a.p.azimuth=defaults.azimuth;a.p.elevation=defaults.elevation;a.p.zoom=1;a.sync();}}
  ]
 };
 // This lesson is static; retain the shared shell without starting its clock.
 class StaticClassroom extends Classroom {
  play() {}
  render(){super.render();if(this.ctx&&this.width)this.$('status').textContent=this.config.note(this.p,this.state);}
 }
 const lesson=window.lesson=new StaticClassroom(config),canvas=lesson.canvas;
 for(const id of ['play','step','reset'])lesson.$(id).hidden=true;
 document.querySelector('.lesson-timeline').hidden=true;
 lesson.$('speed').closest('.lesson-control').hidden=true;
 canvas.tabIndex=0;canvas.setAttribute('role','application');
 document.querySelector('.lesson-stage').setAttribute('aria-label','電流磁場演示');
 let drag=null;
 canvas.addEventListener('pointerdown',event=>{
  if(lesson.view===2)return;drag={x:event.clientX,y:event.clientY,azimuth:lesson.p.azimuth,elevation:lesson.p.elevation};
  canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});if(lesson.view===0)move(event);
 });
 function move(event){
  if(!drag)return;
  if(lesson.view===1){lesson.p.azimuth=((drag.azimuth+(event.clientX-drag.x)*.5+540)%360)-180;lesson.p.elevation=Math.max(-75,Math.min(75,drag.elevation+(event.clientY-drag.y)*.4));}
  else if(lesson.view===0){const r=canvas.getBoundingClientRect(),v=projector(lesson,lesson.state.physical,false);
   lesson.p.probeX=Math.max(-70,Math.min(70,Math.round((event.clientX-r.left-v.center[0])/v.scale*100)));
   lesson.p.probeY=Math.max(-50,Math.min(50,Math.round((v.center[1]-event.clientY+r.top)/v.scale*100)));}
  lesson.sync();lesson.render();
 }
 canvas.addEventListener('pointermove',move);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
 canvas.addEventListener('keydown',event=>{
  const d={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];if(!d||lesson.view===2)return;event.preventDefault();
  if(lesson.view===1){lesson.p.azimuth=((lesson.p.azimuth+d[0]*5+540)%360)-180;lesson.p.elevation=Math.max(-75,Math.min(75,lesson.p.elevation+d[1]*5));}
  else{lesson.p.probeX=Math.max(-70,Math.min(70,lesson.p.probeX+d[0]));lesson.p.probeY=Math.max(-50,Math.min(50,lesson.p.probeY+d[1]));}
  lesson.sync();lesson.render();
 });
})();
