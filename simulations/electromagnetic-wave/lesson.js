(() => {
 'use strict';
 const C=LessonColors,M=PhysicsModel;
 const probeColors={electric:'#c084fc',magnetic:C.red};
 const cameraDefaults={azimuth:-25,elevation:20,zoom:1};
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const direction=(v,axis)=>v===0?'0（無方向）':`${v>0?'+':'−'}${axis}`;
 const magnetic=v=>v===0?'B = 0':v>0?'B：⊙ 出紙面（+z）':'B：⊗ 入紙面（−z）';
 function label(a,text,x,y,color=C.ink,size=24,align='left'){
  a.text(text,x,y,color,size,align);
 }
 function path(a,points,color,dash=[]){
  const c=a.ctx;c.strokeStyle=color;c.lineWidth=3;c.setLineDash(dash);c.beginPath();
  points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();c.setLineDash([]);
 }
 function thickArrow(a,start,end,color){
  const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
  if(length<.5)return;
  const c=a.ctx,angle=Math.atan2(dy,dx),head=Math.min(16,length*.65);
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=7;
  c.beginPath();c.moveTo(...start);c.lineTo(...end);c.stroke();
  c.beginPath();c.moveTo(...end);
  c.lineTo(end[0]-head*Math.cos(angle-.5),end[1]-head*Math.sin(angle-.5));
  c.lineTo(end[0]-head*Math.cos(angle+.5),end[1]-head*Math.sin(angle+.5));
  c.closePath();c.fill();c.restore();
 }
 function propagation(a,s,y){
  const left=a.width*.28,right=a.width*.72;
  a.arrow(s.direction>0?left:right,y,(right-left)*s.direction,0,C.green);
  label(a,`${a.p.amplitude===0?'方向設定':'傳播'} ${s.direction>0?'+x →':'−x ←'}`,a.width/2,y-12,C.green,24,'center');
 }
 function headers(a){
  label(a,'電場 E · y 軸',16,32,C.blue);
  label(a,'磁場 B · z 軸',a.width<550?16:a.width/2,a.width<550?64:32,C.orange);
 }
 function spatial(a,s){
  a.canvas.classList.add('rotatable');
  headers(a);
  const w=a.width,h=a.height,az=a.p.azimuth*Math.PI/180,el=a.p.elevation*Math.PI/180;
  // Orthographic rotation of a right-handed frame; every field, axis and arrow uses it.
  const rotate=(x,y,z)=>{
   const u=x*Math.cos(az)+z*Math.sin(az),depth=-x*Math.sin(az)+z*Math.cos(az);
   return [u,-y*Math.cos(el)+depth*Math.sin(el),y*Math.sin(el)+depth*Math.cos(el)];
  };
  const corners=[];
  for(const x of [-7,7])for(const y of [-2,2])for(const z of [-2,2])corners.push(rotate(x,y,z));
  const halfW=Math.max(...corners.map(v=>Math.abs(v[0]))),halfH=Math.max(...corners.map(v=>Math.abs(v[1])));
  const top=w<550?94:72,bottom=h-88;
  const scale=Math.min((w-70)/(2*halfW),(bottom-top)/(2*halfH))*a.p.zoom;
  const point=(x,e,b)=>{const q=rotate(x-6,e*1.6,b*1.6);return [w/2+q[0]*scale,(top+bottom)/2+q[1]*scale,q[2]];};
  const arrow=(start,end,color)=>a.arrow(start[0],start[1],end[0]-start[0],end[1]-start[1],color);
  // Magnify only the scene; keep the field legend and propagation readout unobscured.
  a.ctx.save();a.ctx.beginPath();a.ctx.rect(0,top,w,bottom-top+24);a.ctx.clip();
  const origin=point(0,0,0),end=point(12,0,0);
  a.line(origin[0],origin[1],end[0],end[1],C.ink,1.5);
  const axes=[[point(13,0,0),'+x'],[point(0,1.25,0),'+y'],[point(0,0,1.25),'+z']];
  for(const [q] of axes)arrow(origin,q,C.ink);
  for(let x=0;x<=12;x+=3){const q=point(x,0,0);a.dot(q[0],q[1],2,C.ink);label(a,String(x),q[0],q[1]+22,C.ink,16,'center');}
  const e=[],b=[];
  for(let i=0;i<=360;i++){
   const x=12*i/360,f=M.field(a.p,x,s.t);
   e.push(point(x,f.ey/3,0).slice(0,2));b.push(point(x,0,f.bnT/10).slice(0,2));
  }
  if(a.p.showB)path(a,b,C.orange,[8,5]);
  if(a.p.showE)path(a,e,C.blue);
  if(a.p.vectors)for(let x=0;x<=12+1e-9;x+=.5){
   const f=M.field(a.p,x,s.t),base=point(x,0,0);
   if(a.p.showB)arrow(base,point(x,0,f.bnT/10),C.orange);
   if(a.p.showE)arrow(base,point(x,f.ey/3,0),C.blue);
  }
  const probe=point(a.p.probe,0,0);
  if(a.p.showE){const q=point(a.p.probe,s.ey/3,0);thickArrow(a,probe,q,probeColors.electric);a.dot(q[0],q[1],4,probeColors.electric);}
  if(a.p.showB){const q=point(a.p.probe,0,s.bnT/10);thickArrow(a,probe,q,probeColors.magnetic);a.dot(q[0],q[1],4,probeColors.magnetic);}
  thickArrow(a,probe,point(a.p.probe+s.direction*1.5,0,0),C.green);
  a.dot(probe[0],probe[1],6,C.yellow);
  // Draw axis labels last, with a backing plate so the moving fields cannot cover them.
  for(const [q,name] of axes){
   const x=clamp(q[0]+(q[0]<origin[0]?-35:8),8,w-44);
   const y=clamp(q[1]+(q[1]>origin[1]?25:-10),top+25,bottom+20);
   a.ctx.fillStyle='#101e2e';a.ctx.fillRect(x-3,y-23,42,30);label(a,name,x,y,C.ink,20);
  }
  a.ctx.restore();
  // A separate screen-space arrow uses the rotated +x vector, never a fixed screen direction.
  const axis=rotate(s.direction,0,0),length=Math.hypot(axis[0],axis[1]);
  if(length>.04)a.arrow(w/2-24*axis[0]/length,h-28-24*axis[1]/length,48*axis[0]/length,48*axis[1]/length,C.green);
  else label(a,axis[2]>0?'⊙':'⊗',w/2,h-10,C.green,28,'center');
  label(a,`● x = ${a.p.probe.toFixed(2)} m · ${a.p.amplitude===0?'方向設定':'傳播'} ${s.direction>0?'+x':'−x'}`,w/2,h-60,C.yellow,w<550?20:24,'center');
  label(a,`拖曳旋轉 · 滾輪／兩指縮放 ${Math.round(a.p.zoom*100)}%`,w-12,w<550?88:58,C.ink,16,'right');
 }
 function symbol(a,x,y,value,r=21){
  if(value===0){label(a,'B = 0',x,y,probeColors.magnetic,24,'center');return;}
  const c=a.ctx;c.strokeStyle=probeColors.magnetic;c.lineWidth=3;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();
  if(value>0)a.dot(x,y,4,probeColors.magnetic);
  else {a.line(x-r*.45,y-r*.45,x+r*.45,y+r*.45,probeColors.magnetic,3);a.line(x-r*.45,y+r*.45,x+r*.45,y-r*.45,probeColors.magnetic,3);}
 }
 function closeup(a,s){
  a.canvas.classList.remove('rotatable');
  const w=a.width,h=a.height,cx=w/2,cy=h*.47;
  label(a,'方向特寫 · 面向 x–y 平面',w/2,32,C.ink,w<550?20:24,'center');
  label(a,`觀察點 x = ${a.p.probe.toFixed(2)} m`,w/2,62,C.yellow,20,'center');
  const r=Math.min(w*.32,h*.20,110);
  a.arrow(cx-r,cy,2*r,0,C.ink);label(a,'+x',cx+r-5,cy+28,C.ink,20,'right');
  a.arrow(cx,cy+r,0,-2*r,C.ink);label(a,'+y',cx+12,cy-r+8,C.ink,20);
  if(a.p.showE){a.arrow(cx,cy,0,-r*s.ey/3,probeColors.electric);label(a,s.ey===0?'E = 0':s.ey>0?'E ↑ +y':'E ↓ −y',16,cy-r*.4,probeColors.electric,24);}
  thickArrow(a,[cx,cy],[cx+s.direction*r*.85,cy],C.green);
  // Dot/cross expresses direction only; magnitude is stated in the numeric readout.
  if(a.p.showB)symbol(a,cx,cy,s.bz);
  a.dot(cx,cy,3,C.yellow);
  label(a,a.p.showB?magnetic(s.bz):'磁場已隱藏',w/2,h-90,probeColors.magnetic,w<550?20:24,'center');
  label(a,'⊙ 朝向你　⊗ 遠離你',w/2,h-60,C.ink,20,'center');
  propagation(a,s,h-14);
 }
 function phaseGraph(a,s){
  a.canvas.classList.remove('rotatable');
  if(a.p.amplitude===0){
   label(a,'E = 0，B = 0',a.width/2,a.height*.40,C.ink,28,'center');
   label(a,'振幅為零，沒有電磁波',a.width/2,a.height*.53,C.ink,20,'center');
   label(a,'無法除以零振幅作正規化',a.width/2,a.height*.64,C.ink,20,'center');
   return;
  }
  const electric=[],magneticCurve=[],start=30*Math.floor(s.t/30),end=start+30;
  for(let i=0;i<=300;i++){
   const t=start+30*i/300,f=M.field(a.p,a.p.probe,t);
   electric.push({x:t,y:a.p.amplitude?f.ey/a.p.amplitude:0});
   magneticCurve.push({x:t,y:s.b0?f.bnT/s.b0:0});
  }
  const series=[];
  if(a.p.showE)series.push({color:C.blue,data:electric});
  if(a.p.showB)series.push({color:C.orange,data:magneticCurve,dash:[9,7]});
  a.graph({xmin:start,xmax:end,ymin:-1.25,ymax:1.25,xlabel:'t (ns)',ylabel:'Eᵧ / E₀  與  B𝓏 / B₀',series});
  const X=t=>64+(t-start)/30*(a.width-88),Y=v=>a.height-48-(v+1.25)/2.5*(a.height-100);
  a.line(X(s.t),52,X(s.t),a.height-48,C.yellow,2,[3,5]);
  if(a.p.showE)a.dot(X(s.t),Y(a.p.amplitude?s.ey/a.p.amplitude:0),7,C.blue);
  if(a.p.showB){const y=Y(s.b0?s.bnT/s.b0:0);a.ctx.strokeStyle=C.orange;a.ctx.lineWidth=3;a.ctx.beginPath();a.ctx.arc(X(s.t),y,10,0,Math.PI*2);a.ctx.stroke();}
  label(a,'E 實線 · B 虛線',a.width-12,49,C.ink,17,'right');
 }
 window.lesson=new Classroom({
  title:'電磁波：藍色電場沿 y 軸，橙色磁場沿 z 軸，綠色箭頭表示沿 x 軸傳播',
  defaults:{frequency:100,amplitude:3,direction:'1',probe:.75,showE:true,showB:true,vectors:true,speed:1,...cameraDefaults},
  controls:[
   {key:'frequency',label:'頻率 f',min:50,max:150,step:10,unit:'MHz'},
   {key:'amplitude',label:'電場振幅 E₀',min:0,max:3,step:.25,unit:'V/m'},
   {key:'direction',label:'傳播方向（空間座標）',type:'select',options:[['1','沿 +x 傳播'],['-1','沿 −x 傳播']]},
   {key:'probe',label:'黃色觀察點 x',min:0,max:12,step:.25,unit:'m',display:true},
   {key:'showE',label:'顯示電場 E（藍色實線）',type:'check',display:true},
   {key:'showB',label:'顯示磁場 B（橙色虛線）',type:'check',display:true},
   {key:'vectors',label:'沿波顯示場向量箭頭',type:'check',display:true},
   {key:'azimuth',label:'視角方位',min:-180,max:180,step:1,unit:'°',display:true},
   {key:'elevation',label:'視角仰角',min:-80,max:80,step:1,unit:'°',display:true},
   {key:'zoom',label:'視角縮放',min:.5,max:3,step:.05,unit:'×',digits:2,display:true}
  ],
  state:M.state,duration:()=>30,infinitePlayback:true,step:.25,timeUnit:'ns',timeRate:()=>5,
  actions:[{label:'回到預設視角',run:a=>{Object.assign(a.p,cameraDefaults);syncCamera(a);}}],
  views:[{label:'立體波形',draw:spatial},{label:'方向特寫',draw:closeup},{label:'同相對照',draw:phaseGraph}],
  metrics:(p,s)=>[['波長 λ',s.lambda.toFixed(2),'m'],['週期 T',s.period.toFixed(2),'ns'],['觀察點電場 Eᵧ',s.ey.toFixed(2),`V/m · ${direction(s.ey,'y')}`],['觀察點磁場 B𝓏',s.bnT.toFixed(2),`nT · ${direction(s.bz,'z')}`]],
  note:(p,s)=>`持續循環 · ${s.ey===0?'此刻觀察點 E、B 與能流皆為零':`此刻 E × B 朝 ${s.direction>0?'+x':'−x'}`}。E、B 分別縮放；1×：每秒播放 5 ns。${p.amplitude===0?'振幅為零，沒有電磁波。':''}`,
  presets:[
   {label:'① 基本：向右傳播',values:{},question:'觀察 0.75 m 處：經過半個週期（5 ns），E、B 與傳播方向如何改變？',answer:'E 從 +y 變成 −y，B 從 +z 變成 −z；兩者同時反向，E × B 仍朝 +x。'},
   {label:'② 只提高頻率',values:{frequency:150},question:'頻率由 100 增至 150 MHz，波長與波速如何改變？',answer:'波長由 3.00 m 縮短至 2.00 m，週期由 10.00 ns 縮短至約 6.67 ns；真空光速保持 3.00 × 10⁸ m/s。'},
   {label:'③ 反向傳播',values:{direction:'-1'},question:'比較 t = 0、x = 0.75 m 的場方向：要使波朝 −x 傳播，哪一個場反向？',answer:'此例 E 仍朝 +y，B 改朝 −z（入紙面）；右手定則得到 E × B 朝 −x。兩個場的大小仍同步變化。'},
   {label:'④ 零振幅',values:{amplitude:0},question:'振幅為零時，座標軸和綠色傳播設定箭頭代表存在電磁波嗎？',answer:'不代表。此時 E = B = 0，沒有電磁波與能量傳遞；灰色線只是座標軸，綠色箭頭只保留傳播方向設定。'}
  ]
 });
 function syncCamera(a){
  for(const key of ['azimuth','elevation']){a.$(key).value=a.p[key];a.$(key+'Value').textContent=`${a.p[key]} °`;}
  a.$('zoom').value=a.p.zoom;a.$('zoomValue').textContent=`${a.p.zoom.toFixed(2)} ×`;
 }
 const a=window.lesson,canvas=a.canvas;
 canvas.tabIndex=0;
 canvas.setAttribute('aria-label',a.config.title+'；單指拖曳或方向鍵旋轉，滾輪或兩指捏合縮放');
 const pointers=new Map();
 let drag=null;
 const distance=()=>{const [p,q]=[...pointers.values()];return Math.hypot(p.x-q.x,p.y-q.y);};
 function rebase(){
  if(pointers.size===2)drag={mode:'zoom',distance:Math.max(1,distance()),zoom:a.p.zoom};
  else if(pointers.size===1){const [p]=pointers.values();drag={mode:'rotate',x:p.x,y:p.y,az:a.p.azimuth,el:a.p.elevation};}
  else drag=null;
  canvas.classList.toggle('dragging',pointers.size>0);
 }
 function finish(e){
  const ids=e?[e.pointerId]:[...pointers.keys()];
  for(const id of ids){
   if(!pointers.delete(id))continue;
   if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  }
  rebase();
 }
 canvas.addEventListener('pointerdown',e=>{
  if(a.view!==0||pointers.size>=2||e.button!==0)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase();
  canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
  if(e.pointerType==='mouse')e.preventDefault();
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||!pointers.has(e.pointerId))return;
  if(a.view!==0){finish();return;}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(drag.mode==='zoom')a.p.zoom=clamp(drag.zoom*distance()/drag.distance,.5,3);
  else {
   const degrees=drag.az+(e.clientX-drag.x)*.45;
   a.p.azimuth=Math.round(((degrees+180)%360+360)%360-180);
   a.p.elevation=Math.round(clamp(drag.el+(e.clientY-drag.y)*.35,-80,80));
  }
  syncCamera(a);a.render();
 });
 canvas.addEventListener('wheel',e=>{
  if(a.view!==0)return;
  e.preventDefault();
  const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?a.height:1);
  a.p.zoom=clamp(a.p.zoom*Math.exp(-clamp(pixels,-600,600)*.002),.5,3);
  rebase();syncCamera(a);a.render();
 },{passive:false});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,finish);
 for(const button of document.querySelectorAll('[data-view], [data-action], [data-preset], #defaults'))button.addEventListener('click',()=>finish());
 window.addEventListener('blur',()=>finish());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
 canvas.addEventListener('keydown',e=>{
  if(a.view!==0||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();
  if(e.key==='ArrowLeft'||e.key==='ArrowRight')a.p.azimuth=((a.p.azimuth+(e.key==='ArrowRight'?5:-5)+540)%360)-180;
  else a.p.elevation=clamp(a.p.elevation+(e.key==='ArrowDown'?5:-5),-80,80);
  syncCamera(a);a.render();
 });
})();
