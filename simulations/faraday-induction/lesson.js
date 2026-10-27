/* Canvas 2D projection of actual 3D geometry; no network or WebGL dependency.
 * Classroom owns the only animation loop. Manual dragging uses pointer samples.
 */
(() => {
 'use strict';
 const M=PhysicsModel,C=LessonColors,TAU=M.TAU;
 const defaults={...M.defaults,signal:'current'};
 const names={magnet:'磁鐵與環形線圈',ac:'交流發電機',dc:'直流發電機'};
 const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
 const fmt=x=>Math.abs(x)<.0005?'0.000':x.toFixed(3);
 let history=[],drag=null,idle=null,manualStart=0,lastManual=null,lesson;
 const manual=p=>p.mode==='magnet'&&p.motion==='manual';
 const rotate=(v,t)=>[v[0]*Math.cos(t)-v[1]*Math.sin(t),v[0]*Math.sin(t)+v[1]*Math.cos(t),v[2]];
 function projection(a,region){
  const az=a.p.azimuth*Math.PI/180,el=a.p.elevation*Math.PI/180;
  const scale=Math.max(60,Math.min((a.width-38)/1.23,(region-50)/.87));
  const project=([x,y,z])=>{const u=x*Math.cos(az)+z*Math.sin(az),d=-x*Math.sin(az)+z*Math.cos(az);return [a.width/2+u*scale,region/2+25-(y*Math.cos(el)-d*Math.sin(el))*scale,y*Math.sin(el)+d*Math.cos(el)];};
  return {project,scale};
 }
 function sceneRenderer(a,project){
  const objects=[];
  function path(points,color,width=3,cap='round'){
   const v=points.map(project);
   for(let i=1;i<v.length;i++)objects.push({depth:(v[i-1][2]+v[i][2])/2,draw:()=>{a.ctx.lineCap=cap;a.line(v[i-1][0],v[i-1][1],v[i][0],v[i][1],color,width);a.ctx.lineCap='round';}});
  }
  function face(points,color){const v=points.map(project);objects.push({depth:v.reduce((s,p)=>s+p[2],0)/v.length,draw:()=>{const c=a.ctx;c.beginPath();v.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#ffffff25';c.lineWidth=1;c.stroke();}});}
  function box(center,size,color){
   const v=Array.from({length:8},(_,i)=>center.map((x,j)=>x+size[j]*((i>>j)&1?1:-1)/2));
   for(const f of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])face(f.map(i=>v[i]),color);
  }
  function arrow(start,end,color){const b=project(start),e=project(end);objects.push({depth:Math.max(b[2],e[2])+.005,draw:()=>a.arrow(b[0],b[1],e[0]-b[0],e[1]-b[1],color)});}
  return {path,face,box,arrow,paint:()=>objects.sort((x,y)=>x.depth-y.depth).forEach(o=>o.draw())};
 }
 function ringX(x,r,start=0,end=TAU){return Array.from({length:65},(_,i)=>[x,r*Math.cos(start+(end-start)*i/64),r*Math.sin(start+(end-start)*i/64)]);}
 function ringZ(z,r,start=0,end=TAU){return Array.from({length:65},(_,i)=>[r*Math.cos(start+(end-start)*i/64),r*Math.sin(start+(end-start)*i/64),z]);}
 function label(a,project,pos,text,color=C.ink,size=22){const p=project(pos);a.text(text,p[0],p[1],color,size,'center');}
 function currentArrow(r,points,current){
  if(Math.abs(current)<1e-7)return;
  const sign=Math.sign(current),start=points[0],end=points[1];r.arrow(sign>0?start:end,sign>0?end:start,C.yellow);
 }
 function drawMagnet(a,s,region){
  // Fixed oblique view keeps the common x axis directly draggable.
  const proxy=Object.assign(Object.create(a),{p:{...a.p,azimuth:-18,elevation:18}}),{project,scale}=projection(proxy,region),r=sceneRenderer(a,project);
  a.hit={project,scale,magnet:project([s.magnet,0,0]),coil:project([s.coil,.12,0])};
  r.path([[-.56,-.16,0],[.56,-.16,0]],C.grid,2);
  for(let x=-.5;x<=.5;x+=.1)r.path([[x,-.15,0],[x,-.17,0]],C.ink,1);
  const north=a.p.polarity>0;
  r.box([s.magnet-.045,0,0],[.09,.07,.07],north?'#3379b0':'#be4659');
  r.box([s.magnet+.045,0,0],[.09,.07,.07],north?'#be4659':'#3379b0');
  if(a.p.lines&&a.p.field>0){
   const direction=a.p.polarity;
   for(const side of [-1,1])for(const height of [.065,.13]){
    const points=Array.from({length:65},(_,i)=>{const q=i/64;return [s.magnet+.09-.18*q,side*height*Math.sin(Math.PI*q),0];});
    r.path(points,'#65dcaf88',1.8);
    const k=32;r.arrow(direction>0?points[k-5]:points[k+5],direction>0?points[k+5]:points[k-5],C.green);
   }
   const start=[s.coil-.065,0,0],end=[s.coil+.065,0,0];r.arrow(direction>0?start:end,direction>0?end:start,C.green);
  }
  // Representative turns, continuous leads and a closed resistive circuit.
  for(let i=0;i<4;i++)r.path(ringX(s.coil+(i-1.5)*.009,.1,.10,TAU-.10),i%2?'#d28647':C.orange,3.5);
  const upper=[s.coil,.1*Math.cos(.10),.1*Math.sin(.10)],lower=[s.coil,.1*Math.cos(-.10),.1*Math.sin(-.10)];
  r.path([upper,[s.coil+.075,.15,.04],[s.coil+.075,.22,.04],[s.coil-.075,.22,.04],[s.coil-.075,.15,-.04],lower],C.ink,2.5);
  r.box([s.coil,.22,.04],[.075,.028,.028],'#657c92');
  const q=.95;currentArrow(r,[[s.coil,.1*Math.cos(q),.1*Math.sin(q)],[s.coil,.1*Math.cos(q+.65),.1*Math.sin(q+.65)]],s.current);
  if(a.p.normal)r.arrow([s.coil,.14,-.10],[s.coil+.10,.14,-.10],C.blue);
  r.paint();
  label(a,project,[s.magnet-.045,.055,.025],north?'S':'N','#fff',24);
  label(a,project,[s.magnet+.045,.055,.025],north?'N':'S','#fff',24);
  label(a,project,[s.coil,.255,.04],'R',C.ink,20);
  // Handles remain 48 px touch targets even on small screens.
  const handles=[['magnet',s.magnet,'↔ 磁鐵',C.red],['coil',s.coil,'↔ 線圈',C.orange]];
  a.handles={};
  for(const [key,x,text,color] of handles){const point=project([x,-.12,key==='coil'?.07:0]);const y=region-28+(key==='coil'?0:-42);const px=clamp(point[0],55,a.width-55);a.line(point[0],point[1],px,y-12,color,1);a.ctx.fillStyle='#1d3046';a.ctx.fillRect(px-52,y-27,104,42);a.text(text,px,y+2,color,20,'center');a.handles[key]={x:px,y:y-5};}
 }
 function generatorGeometry(a,s,r){
  const t=s.theta,rot=v=>rotate(v,t),z1=.255,z2=.325;
  r.box([0,-.205,.02],[.94,.025,.68],'#23384b');
  r.box([-.37,0,0],[.13,.25,.30],'#b4485b');r.box([.37,0,0],[.13,.25,.30],'#326e9c');
  if(a.p.lines&&a.p.field>0)for(const y of [-.07,.07])for(const z of [-.10,.1])r.arrow([-.28,y,z],[.28,y,z],C.green);
  r.path([[0,0,-.25],[0,0,.38]],'#869bad',6);
  // The two coil ends are separated near the shaft and connected to separate contacts.
  const coil=[[0,-.025,.15],[0,-.13,.15],[0,-.13,-.15],[0,.13,-.15],[0,.13,.15],[0,.025,.15]];
  for(let i=0;i<3;i++)r.path(coil.map(v=>rot([v[0]+(i-1)*.007,v[1],v[2]])),i===1?C.orange:'#b97942',3.5);
  if(a.p.normal)r.arrow([0,0,0],rot([.18,0,0]),C.blue);
  const internal=s.emf/a.p.resistance;
  currentArrow(r,[rot([0,-.13,.045]),rot([0,-.13,-.045])],internal);
  currentArrow(r,[rot([0,.13,-.045]),rot([0,.13,.045])],internal);
  if(a.p.mode==='ac'){
   r.path(ringZ(z1,.05),C.orange,6);r.path(ringZ(z2,.05),C.blue,6);
   r.path([rot([0,.025,.15]),rot([0,.05,z1])],C.orange,3);
   r.path([rot([0,-.025,.15]),rot([0,-.05,z2])],C.blue,3);
  }else{
   for(const [offset,color] of [[0,C.orange],[Math.PI,C.blue]])r.path(ringZ(z1,.05,t+offset+.22,t+offset+Math.PI-.22),color,7,'butt');
   r.path([rot([0,.025,.15]),rot([0,.05,z1])],C.orange,3);
   r.path([rot([0,-.025,.15]),rot([0,-.05,z1])],C.blue,3);
  }
  const b1=[.078,0,z1],b2=[-.078,0,a.p.mode==='ac'?z2:z1];
  r.box(b1,[.05,.035,.035],'#c3cbd2');r.box(b2,[.05,.035,.035],'#c3cbd2');
  const wire=[b1,[.22,0,z1],[.22,0,.44],[-.22,0,.44],[-.22,0,b2[2]],b2];r.path(wire,C.ink,3);
  r.box([0,0,.44],[.10,.035,.035],'#6c8294');
  currentArrow(r,[[.18,0,.44],[.08,0,.44]],s.current);
 }
 function drawGenerator(a,s,region){
  const {project}=projection(a,region),r=sceneRenderer(a,project);generatorGeometry(a,s,r);r.paint();
  label(a,project,[-.37,.16,0],'N',C.red,28);label(a,project,[.37,.16,0],'S',C.blue,28);
  label(a,project,[.23,-.04,.43],'R',C.ink,22);
  a.text(`θ = ${((s.theta*180/Math.PI%360+360)%360).toFixed(0)}°`,a.width-12,58,C.blue,20,'right');
  a.text(a.p.mode==='ac'?'兩個完整滑環':'分裂環 · 每半圈換向',14,58,C.orange,a.width<460?18:22);
 }
 function samples(a,s){
  if(manual(a.p))return history.length?history:[{...s,t:0}];
  const end=a.time,start=Math.max(0,end-10),n=Math.max(1,Math.ceil((end-start)*100));
  return Array.from({length:n+1},(_,i)=>M.state(a.p,start+(end-start)*i/n));
 }
 function smallWave(a,s,y){
  const w=a.width,h=a.height-y,points=samples(a,s),end=manual(a.p)?Math.max(10,points.at(-1).t):Math.max(10,a.time),start=end-10;
  const peak=Math.max(.02,...points.map(p=>Math.abs(p.current)),s.peak?s.peak/a.p.resistance:0);
  const x0=w<480?130:170,x1=w-16,Y=v=>y+h*.51-v/peak*h*.28,X=t=>x0+(t-start)/10*(x1-x0);
  a.ctx.fillStyle='#14283b';a.ctx.fillRect(0,y,w,h);
  a.text('負載電流 I',12,y+22,C.ink,16);a.text(`${fmt(s.current)} A`,12,y+53,C.yellow,w<480?23:28);
  a.line(x0,Y(0),x1,Y(0),C.grid,1);a.text('0',x0-8,Y(0)+5,C.ink,13,'right');
  for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];if(p.t>=start)a.line(X(p.t),Y(p.current),X(q.t),Y(q.current),C.yellow,2);}
  const p=points.at(-1);a.dot(X(p.t),Y(p.current),4,C.yellow);
  a.text('最近 10 s · 自動刻度',x1,y+h-8,C.ink,13,'right');
 }
 function drawScene(a,s){
  const region=a.height-86;
  a.text(names[a.p.mode],14,29,C.ink,a.width<450?22:26);
  a.canvas.setAttribute('aria-label',names[a.p.mode]+(a.p.mode==='magnet'?'；拖曳磁鐵或線圈把手':'；拖曳旋轉視角')+'；讀值在下方');
  a.ctx.save();a.ctx.beginPath();a.ctx.rect(0,40,a.width,region-40);a.ctx.clip();
  if(a.p.mode==='magnet')drawMagnet(a,s,region);else drawGenerator(a,s,region);
  a.ctx.restore();smallWave(a,s,region);
 }
 function drawGraph(a,s){
  const signal=a.p.signal,data=samples(a,s),isManual=manual(a.p),end=isManual?Math.max(10,data.at(-1).t):a.duration,start=Math.max(0,end-10);
  const factor=signal==='phi'?1000:1,quantity=signal==='phi'?'每匝 Φ (mWb)':signal==='emf'?'線圈 ε (V)':'負載 I (A)';
  const color=signal==='phi'?C.green:signal==='emf'?C.orange:C.yellow;
  const get=q=>q[signal==='phi'?'phi':signal==='emf'?'emf':'current']*factor;
  const theoretical=a.p.mode==='magnet'?a.p.field*M.area*(signal==='phi'?1000:a.p.turns*3/M.length*(a.p.amplitude/100*TAU*a.p.frequency)/(signal==='current'?a.p.resistance:1)):(signal==='phi'?a.p.field*.04*1000:s.peak/(signal==='current'?a.p.resistance:1));
  const limit=Math.max(signal==='phi'?.1:.01,Math.abs(theoretical),...data.map(q=>Math.abs(get(q))))*1.15;
  const series=[{color,data:data.map(q=>({x:q.t,y:get(q)}))}];
  if(a.p.mode==='dc'&&signal==='current')series.unshift({color:C.blue,dash:[7,5],data:data.map(q=>({x:q.t,y:q.emf/a.p.resistance}))});
  a.graph({xmin:start,xmax:end,ymin:-limit,ymax:limit,ylabel:quantity,xlabel:isManual?'操作時間 (s)':'t (s)',series,points:[{x:data.at(-1).t,y:get(s),color}]});
  if(a.p.mode==='dc'&&signal==='current')a.text('黃：直流輸出　藍虛線：交流參考',a.width/2,50,C.ink,a.width<460?14:18,'center');
 }
 function drawContacts(a,s){
  if(a.p.mode==='magnet'){
   const cx=a.width/2,cy=a.height*.45,r=Math.min(a.width*.24,(a.height-140)*.35);
   a.text('從線圈右側看向左',a.width/2,32,C.ink,24,'center');
   a.ctx.strokeStyle=C.orange;a.ctx.lineWidth=7;a.ctx.beginPath();a.ctx.arc(cx,cy,r,0,TAU);a.ctx.stroke();
   if(Math.abs(s.current)>1e-7){const sign=Math.sign(s.current);a.arrow(cx+r,cy+sign*30,0,-sign*60,C.yellow);}
   a.text(Math.abs(s.current)<1e-7?'電流為零':s.current>0?'正電流：逆時針 ↺':'負電流：順時針 ↻',cx,a.height-62,C.yellow,24,'center');
   a.text('正法向量朝向觀察者 ⊙',cx,a.height-25,C.blue,20,'center');return;
  }
  const cx=a.width/2,cy=a.height*.44,r=Math.min(a.width*.24,Math.max(24,(a.height-150)*.45)),c=a.ctx;
  a.text(a.p.mode==='ac'?'滑環：兩條獨立通路':'換向器：兩片半環',cx,32,C.ink,a.width<460?22:26,'center');
  const arc=(rr,start,end,color)=>{c.beginPath();c.arc(cx,cy,rr,start,end);c.strokeStyle=color;c.lineWidth=14;c.lineCap='butt';c.stroke();c.lineCap='round';};
  if(a.p.mode==='ac'){
   arc(r,0,TAU,C.orange);arc(r*.65,0,TAU,C.blue);
   a.text('軸向錯開，投影為內外環',cx,60,C.ink,17,'center');
  }else{
   arc(r,-s.theta+.10,-s.theta+Math.PI-.10,C.blue);arc(r,-s.theta+Math.PI+.10,-s.theta+TAU-.10,C.orange);
  }
  a.dot(cx,cy,12,'#70869b');
  for(const [sign,color,rr] of [[1,C.orange,r],[-1,C.blue,a.p.mode==='ac'?r*.65:r]]){
   const theta=-s.theta-sign*Math.PI/2;a.line(cx,cy,cx+rr*Math.cos(theta),cy+rr*Math.sin(theta),color,3);
  }
  const left=a.p.mode==='ac'?r*.65:r;
  c.fillStyle='#d4dce4';c.fillRect(cx+r-7,cy-14,44,28);c.fillRect(cx-left-37,cy-14,44,28);
  a.text('電刷',cx+r+15,cy-24,C.ink,18,'center');a.text('電刷',cx-left-15,cy-24,C.ink,18,'center');
  const bottom=cy+r+22;
  a.line(cx+r+35,cy,cx+r+35,bottom,C.ink,3);a.line(cx-left-35,cy,cx-left-35,bottom,C.ink,3);a.line(cx-left-35,bottom,cx+r+35,bottom,C.ink,3);
  c.fillStyle='#617c92';c.fillRect(cx-25,bottom-10,50,20);
  if(Math.abs(s.current)>1e-7)a.arrow(cx+65,bottom,-Math.sign(s.current)*40,0,C.yellow);
  a.text(a.p.mode==='dc'?'每半圈交換接點 → 外部電流同向':'線圈兩端各接一個環 → 電流交替',cx,a.height-42,C.yellow,a.width<460?16:21,'center');
  a.text('白色電刷固定；彩色接環與引線隨轉子旋轉',cx,a.height-15,C.ink,a.width<460?13:16,'center');
 }
 function stopManual(){clearTimeout(idle);idle=null;if(!lesson)return;lesson.p.manualVelocity=0;recordManual();lesson.render();}
 function recordManual(){
  if(!lesson||!manual(lesson.p))return;
  const t=(performance.now()-manualStart)/1000,s=M.state(lesson.p,0);history.push({...s,t});history=history.filter(q=>q.t>=t-10).slice(-600);
 }
 function clearManual(){clearTimeout(idle);idle=null;history=[];manualStart=performance.now();lastManual=null;}
 function moveObject(key,value){
  const a=lesson,now=performance.now();
  if(!manual(a.p)){
   const s=a.state;a.pause();a.p.magnetX=s.magnet*100;a.p.coilX=s.coil*100;a.p.motion='manual';a.time=0;clearManual();
  }
  if(!history.length)recordManual();
  const before=a.p[key],dt=lastManual?clamp((now-lastManual)/1000,.016,.15):.05;
  a.p[key]=clamp(value,-48,48);a.p.manualVelocity=(a.p[key]-before)/100/dt*(key==='magnetX'?-1:1);lastManual=now;
  recordManual();clearTimeout(idle);idle=setTimeout(stopManual,120);a.sync();a.render();
 }
 function updateUI(a){
  const p=a.p,isMagnet=p.mode==='magnet',hand=manual(p);
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===p.mode)));
  for(const key of ['motion','magnetX','coilX','amplitude','frequency'])a.$(key).closest('.lesson-control').hidden=!isMagnet;
  for(const key of ['rpm','angle','azimuth','elevation'])a.$(key).closest('.lesson-control').hidden=isMagnet;
  a.$('play').disabled=hand;a.$('step').disabled=hand||a.running||a.time>=a.duration;a.$('time').disabled=hand;
  a.$('speed').closest('.lesson-control').hidden=hand;
  a.$('hint').textContent=isMagnet?'拖曳磁鐵／線圈把手；停手後電流歸零。自動演示請選往復方式再播放。':'拖曳模型改變視角；播放觀察旋轉，切換「接環／方向」看電刷如何接通。';
 }
 const config={
  title:'法拉第電磁感應：磁鐵線圈及交流／直流發電機',defaults,
  controlsHelp:'磁鐵可直接拖曳。物理設定更改後暫停回起點；視角與波形選項保留時間。',
  controls:[
   {key:'motion',label:'磁鐵實驗操作',type:'select',options:[['manual','手動拖曳'],['magnet','磁鐵自動往復'],['coil','線圈自動往復'],['together','磁鐵與線圈一起移動']]},
   {key:'magnetX',label:'磁鐵位置',min:-48,max:48,step:1,unit:'cm',live:true},
   {key:'coilX',label:'線圈位置',min:-48,max:48,step:1,unit:'cm',live:true},
   {key:'amplitude',label:'往復振幅',min:0,max:28,step:1,unit:'cm',disabled:manual},
   {key:'frequency',label:'往復頻率',min:.1,max:1,step:.1,unit:'Hz',disabled:manual},
   {key:'rpm',label:'轉速',min:0,max:120,step:5,unit:'rpm'},
   {key:'angle',label:'初始角度 θ₀',min:0,max:360,step:5,unit:'°'},
   {key:'field',label:'磁場參數 B₀ / B',min:0,max:.5,step:.05,unit:'T'},
   {key:'turns',label:'線圈匝數 N',min:1,max:100,step:1,unit:'匝'},
   {key:'resistance',label:'總電阻 R',min:1,max:50,step:1,unit:'Ω'},
   {key:'signal',label:'波形頁顯示',type:'select',display:true,options:[['current','負載電流 I'],['emf','線圈電動勢 ε'],['phi','每匝磁通量 Φ']]},
   {key:'azimuth',label:'視角方位',min:-65,max:65,step:5,unit:'°',display:true},
   {key:'elevation',label:'視角仰角',min:5,max:65,step:5,unit:'°',display:true},
   {key:'lines',label:'顯示外加磁場（綠）',type:'check',display:true},
   {key:'normal',label:'顯示線圈正法向量（藍）',type:'check',display:true}
  ],
  normalize:(p,key)=>{if(!['azimuth','elevation','lines','normal','speed','signal','magnetX','coilX'].includes(key)){p.manualVelocity=0;clearManual();}},
  state:M.state,duration:()=>10,step:.025,
  onReset:a=>{a.p.manualVelocity=0;clearManual();},
  views:[{label:'立體實驗',draw:drawScene},{label:'同步波形',draw:drawGraph},{label:'接環／方向',draw:drawContacts}],
  metrics:(p,s)=>[[p.mode==='magnet'?'相對速度':'轉子角度',p.mode==='magnet'?fmt(s.relative):((s.theta*180/Math.PI%360+360)%360).toFixed(1),p.mode==='magnet'?'m/s':'°'],['每匝磁通量 Φ',fmt(s.phi*1000),'mWb'],[p.mode==='dc'?'輸出電動勢 |ε|':'感應電動勢 ε',fmt(s.output),'V'],['負載電流 I',fmt(s.current),'A']],
  note:(p,s)=>p.mode==='magnet'?(manual(p)?'手動操作 · 向右為正法向量；正電流從右側看為逆時針。':'往復運動 · 暫停凍結瞬時讀值；同速同向移動不改變磁通量。'):(p.mode==='dc'?'換向器使外部電流保持同方向；輸出為脈動直流。':'滑環保持各端連接；每半圈電流反向。'),
  presets:[
   {label:'① 移動磁鐵',values:{motion:'magnet'},question:'磁鐵接近與遠離時，電流方向相同嗎？',answer:'不相同。磁通量的變化方向相反，所以感應電動勢與電流反向。'},
   {label:'② 改成移動線圈',values:{motion:'coil'},question:'改成只移動線圈，也會產生電流嗎？',answer:'會。關鍵是穿過線圈的磁通量是否變化；相同相對運動會有相同感應效果。'},
   {label:'③ 磁鐵與線圈一起移動',values:{motion:'together'},question:'兩者都在移動，為什麼電流仍為零？',answer:'兩者同速同向，相對距離固定，磁通量不變，因此感應電動勢為零。'},
   {label:'④ 交流與直流比較',values:{mode:'ac'},question:'改成分裂環後，是線圈內不再產生交流嗎？',answer:'線圈內的感應電動勢仍交替；換向器每半圈交換接點，使外部負載得到脈動直流。'}
  ],
  actions:[
   {label:'反轉磁鐵 N／S',disabled:a=>a.p.mode!=='magnet',run:a=>{a.p.polarity*=-1;a.reset();a.sync();}},
   {label:'回到預設視角',disabled:a=>a.p.mode==='magnet',run:a=>{a.p.azimuth=defaults.azimuth;a.p.elevation=defaults.elevation;a.sync();}}
  ]
 };
 lesson=window.lesson=new Classroom(config);
 const stage=document.querySelector('.lesson-stage'),tabs=document.createElement('div'),hint=document.createElement('p');
 tabs.className='experiment-tabs';tabs.setAttribute('aria-label','實驗情境');
 tabs.innerHTML='<button data-mode="magnet">磁鐵與線圈</button><button data-mode="ac">交流發電機</button><button data-mode="dc">直流發電機</button>';
 hint.className='experiment-hint';hint.id='hint';stage.prepend(hint);stage.prepend(tabs);
 const baseRender=lesson.render.bind(lesson);lesson.render=()=>{baseRender();updateUI(lesson);};
 tabs.addEventListener('click',e=>{const mode=e.target.dataset.mode;if(!mode)return;const wasGenerator=lesson.p.mode!=='magnet';stopManual();lesson.p.mode=mode;if(!wasGenerator||mode==='magnet')lesson.reset();lesson.sync();lesson.render();});
 // Capture the position input before Classroom's generic listener mutates it.
 for(const key of ['magnetX','coilX'])lesson.$(key).addEventListener('input',e=>{e.stopImmediatePropagation();moveObject(key,Number(e.target.value));},true);
 lesson.canvas.tabIndex=0;
 const location=e=>{const rect=lesson.canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
 lesson.canvas.addEventListener('pointerdown',e=>{
  if(lesson.view!==0)return;const p=location(e);let target='camera';
  if(lesson.p.mode==='magnet'){
   const candidates=Object.entries(lesson.handles||{}).map(([key,h])=>({key,d:Math.hypot(h.x-p.x,h.y-p.y)})).sort((a,b)=>a.d-b.d);
   if(candidates[0]?.d<=65)target=candidates[0].key;else{
    const dM=Math.hypot(lesson.hit.magnet[0]-p.x,lesson.hit.magnet[1]-p.y),dC=Math.hypot(lesson.hit.coil[0]-p.x,lesson.hit.coil[1]-p.y);
    if(Math.min(dM,dC)>60)return;target=dM<dC?'magnet':'coil';
   }
   const s=lesson.state,wasManual=manual(lesson.p);lesson.pause();lesson.p.magnetX=s.magnet*100;lesson.p.coilX=s.coil*100;lesson.p.motion='manual';lesson.p.manualVelocity=0;lesson.time=0;if(!wasManual)clearManual();lesson.sync();lastManual=performance.now();
  }
  drag={target,x:p.x,y:p.y,value:target==='camera'?0:lesson.p[target+'X'],az:lesson.p.azimuth,el:lesson.p.elevation};
  lesson.canvas.setPointerCapture(e.pointerId);lesson.canvas.focus();lesson.render();e.preventDefault();
 });
 lesson.canvas.addEventListener('pointermove',e=>{
  if(!drag)return;const p=location(e);
  if(drag.target==='camera'){lesson.p.azimuth=clamp(drag.az+(p.x-drag.x)*.4,-65,65);lesson.p.elevation=clamp(drag.el+(p.y-drag.y)*.3,5,65);lesson.sync();lesson.render();}
  else moveObject(drag.target+'X',drag.value+(p.x-drag.x)/lesson.hit.scale/Math.cos(-18*Math.PI/180)*100);
 });
 const release=()=>{if(drag&&drag.target!=='camera')stopManual();drag=null;};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])lesson.canvas.addEventListener(event,release);
 lesson.canvas.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
  if(lesson.p.mode==='magnet'){const key=e.shiftKey?'coilX':'magnetX';moveObject(key,lesson.p[key]+(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1));}
  else{const horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight',key=horizontal?'azimuth':'elevation';lesson.p[key]=clamp(lesson.p[key]+(e.key==='ArrowLeft'||e.key==='ArrowDown'?-5:5),horizontal?-65:5,65);lesson.sync();lesson.render();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){release();stopManual();}});
 clearManual();lesson.render();
})();
