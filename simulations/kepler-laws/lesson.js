(() => {
 'use strict';
 const C=LessonColors,M=PhysicsModel,TAU=2*Math.PI;
 const fmt=x=>x.toFixed(2);
 function frame(a,maxA,top=100,bottom=70){
  const p=a.p,scale=Math.min((a.width-90)/(2*maxA),Math.max(20,a.height-top-bottom)/(2*maxA*Math.sqrt(1-p.e*p.e)));
  const cx=a.width/2,cy=(a.height+top-bottom)/2;
  return {scale,X:x=>cx+(x+maxA*p.e)*scale,Y:y=>cy-y*scale};
 }
 function ellipse(a,f,orb,color,dash=[]){
  const c=a.ctx;c.beginPath();c.ellipse(f.X(-orb.a*orb.e),f.Y(0),orb.a*f.scale,orb.b*f.scale,0,0,TAU);
  c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dash);c.stroke();c.setLineDash([]);
 }
 function star(a,f){
  a.dot(f.X(0),f.Y(0),15,'#efdb7224');a.dot(f.X(0),f.Y(0),9,C.yellow);
 }
 function body(a,f,s,color,label){
  a.dot(f.X(s.x),f.Y(s.y),8,color);
  if(label)a.text(label,Math.min(a.width-38,f.X(s.x)+13),f.Y(s.y)-12,color,24);
 }
 function trail(a,f,s,color){
  if(!a.p.trail)return;
  const dt=s.period/48,last=Math.floor(a.time/dt+1e-9),first=Math.max(0,last-48);
  for(let i=first;i<=last;i++){const q=M.orbit(s.a,s.e,a.p.mass,i*dt);a.dot(f.X(q.x),f.Y(q.y),2.5,color);}
 }
 function heading(a,title,subtitle){
  a.text(title,16,32,C.ink,24);
  a.text(subtitle,16,64,C.yellow,24);
 }
 function drawOrbit(a,s){
  const f=frame(a,a.p.a),p=a.p,cy=f.Y(0),cx=f.X(-p.a*p.e);
  heading(a,'Ⅰ  橢圓定律',`e = ${fmt(p.e)} · a = ${fmt(p.a)} AU`);
  ellipse(a,f,s,C.blue);
  if(p.geometry){
   a.line(f.X(-p.a*(1+p.e)),cy,f.X(p.a*(1-p.e)),cy,C.grid,1.5,[5,5]);
   a.line(cx-5,cy-5,cx+5,cy+5,C.ink);a.line(cx-5,cy+5,cx+5,cy-5,C.ink);
   if(p.e>0){
    a.dot(f.X(-2*p.a*p.e),cy,4,C.green);
    a.line(f.X(s.x),f.Y(s.y),f.X(-2*p.a*p.e),cy,C.green,1,[5,4]);
    a.line(f.X(s.x),f.Y(s.y),f.X(0),cy,C.yellow,1,[5,4]);
   }
   const rulerY=cy+s.b*f.scale+28;
   a.line(cx,rulerY,cx+p.a*f.scale,rulerY,C.ink,2);
   a.line(cx,rulerY-5,cx,rulerY+5,C.ink,2);
   a.line(cx+p.a*f.scale,rulerY-5,cx+p.a*f.scale,rulerY+5,C.ink,2);
   a.text('a',cx+p.a*f.scale/2,rulerY-7,C.ink,24,'center');
  }
  trail(a,f,s,C.blue);star(a,f);body(a,f,s,C.blue);
  a.text(p.e===0?'e = 0：兩焦點重合':'黃／綠：兩個焦點',16,a.height-15,C.ink,24);
 }
 function fillSector(a,f,points,color){
  const c=a.ctx;c.beginPath();c.moveTo(f.X(0),f.Y(0));
  for(const q of points)c.lineTo(f.X(q.x),f.Y(q.y));
  c.closePath();c.fillStyle=color+'44';c.fill();c.strokeStyle=color;c.lineWidth=2;c.stroke();
 }
 function vector(a,x,y,dx,dy,color,label){
  const length=Math.hypot(dx,dy);if(length<.5)return;
  a.line(x,y,x+dx,y+dy,color,5);
  const angle=Math.atan2(dy,dx),head=Math.min(18,length*.65),c=a.ctx;
  c.beginPath();c.moveTo(x+dx,y+dy);
  c.lineTo(x+dx-head*Math.cos(angle-.5),y+dy-head*Math.sin(angle-.5));
  c.lineTo(x+dx-head*Math.cos(angle+.5),y+dy-head*Math.sin(angle+.5));
  c.closePath();c.fillStyle=color;c.fill();
  a.text(label,Math.max(12,Math.min(a.width-38,x+dx+12)),Math.max(28,Math.min(a.height-44,y+dy-12)),color,28);
 }
 function drawAreas(a,s){
  const compact=a.width<600,top=compact?180:145;
  const f=frame(a,a.p.a,top,90),p=a.p,dt=s.interval;
  a.text('Ⅱ  等時等面積',16,32,C.ink,24);
  a.text(`t = ${fmt(s.t)} 年`,a.width-18,compact?78:40,C.yellow,36,'right');
  a.text(`Δt = ${fmt(dt)} 年`,a.width-18,compact?114:76,C.ink,28,'right');
  fillSector(a,f,M.sector(p.a,p.e,p.mass,-dt/2,dt),C.orange);
  fillSector(a,f,M.sector(p.a,p.e,p.mass,s.period/2-dt/2,dt),C.green);
  ellipse(a,f,s,C.blue);trail(a,f,s,C.blue);
  a.line(f.X(0),f.Y(0),f.X(s.x),f.Y(s.y),C.ink,2);
  star(a,f);body(a,f,s,C.blue);
  // Separate fixed scales per run: velocity and acceleration have different units.
  const peri=M.orbit(p.a,p.e,p.mass,0);
  if(p.velocity){
   const k=Math.min(110,f.scale*s.b*1.5)/peri.speed;
   vector(a,f.X(s.x),f.Y(s.y),s.vx*k,-s.vy*k,C.red,'v');
  }
  if(p.acceleration){
   const k=Math.min(90,f.scale*s.perihelion*.85)/peri.acceleration;
   vector(a,f.X(s.x),f.Y(s.y),s.ax*k,-s.ay*k,C.yellow,'a');
  }
  a.text(`兩區面積皆 ${s.sectorArea.toFixed(3)} AU²`,16,a.height-15,C.ink,24);
 }
 function drawCompare(a,s){
  const f=frame(a,Math.max(a.p.a,a.p.a2)),q=s.secondary;
  heading(a,'Ⅲ  週期定律',`Tᴬ = ${fmt(s.period)} · Tᴮ = ${fmt(q.period)} 年`);
  ellipse(a,f,q,C.orange,[7,5]);ellipse(a,f,s,C.blue);
  trail(a,f,s,C.blue);trail(a,f,q,C.orange);star(a,f);
  body(a,f,q,C.orange,'B');body(a,f,s,C.blue,'A');
  a.text(`A ${fmt(s.t/s.period)} 圈 · B ${fmt(s.t/q.period)} 圈`,16,a.height-15,C.ink,24);
 }
 function drawRelation(a,s){
  const W=a.width,H=a.height,max=Math.max(a.p.a,a.p.a2)**3*1.2;
  const left=65,right=W-35,top=100,bottom=H-60;
  const X=x=>left+x/max*(right-left),Y=y=>bottom-y/(max/a.p.mass)*(bottom-top);
  heading(a,'Ⅲ  T² 與 a³ 成正比',`T²/a³ = ${fmt(1/a.p.mass)} 年²/AU³`);
  for(let i=0;i<=4;i++){
   const x=max*i/4,y=x/a.p.mass;
   a.line(X(x),top,X(x),bottom,C.grid);a.line(left,Y(y),right,Y(y),C.grid);
   a.text(Number(x.toPrecision(2)).toString(),X(x),bottom+24,C.ink,18,'center');
   a.text(Number(y.toPrecision(2)).toString(),left-8,Y(y)+5,C.ink,18,'right');
  }
  a.line(left,top,left,bottom,C.ink);a.line(left,bottom,right,bottom,C.ink);
  a.line(X(0),Y(0),X(max),Y(max/a.p.mass),C.green,3);
  a.text('T² (年²)',left,top-10,C.ink,24);a.text('a³ (AU³)',right,H-8,C.ink,24,'right');
  for(const [q,color,label,offset] of [[s,C.blue,'A',-15],[s.secondary,C.orange,'B',25]]){
   const x=X(q.a**3),y=Y(q.period**2);a.dot(x,y,8,color);a.text(label,x+12,y+offset,color,24);
  }
 }
 window.lesson=new Classroom({
  title:'克卜勒三大定律：橢圓、等時等面積、週期平方與半長軸立方',
  defaults:{a:1.5,e:.5,mass:1,a2:2.5,divisions:'12',geometry:true,trail:true,velocity:true,acceleration:true,speed:1},
  controls:[
   {key:'a',label:'行星 A 半長軸 a',min:.5,max:4,step:.1,unit:'AU'},
   {key:'e',label:'離心率 e（A、B 共用）',min:0,max:.85,step:.05},
   {key:'mass',label:'中心星質量 M',min:.5,max:2,step:.1,unit:'M☉'},
   {key:'a2',label:'行星 B 半長軸 a',min:.5,max:4,step:.1,unit:'AU'},
   {key:'divisions',label:'等面積時間窗 Δt',type:'select',display:true,options:[['8','T/8'],['12','T/12'],['16','T/16']]},
   {key:'geometry',label:'焦點與半長軸（第一定律）',type:'check',display:true},
   {key:'trail',label:'等時間間隔軌跡點',type:'check',display:true},
   {key:'velocity',label:'速度箭頭 v（第二定律）',type:'check',display:true},
   {key:'acceleration',label:'加速度箭頭 a（指向太陽）',type:'check',display:true}
  ],
  state:M.state,duration:p=>2*Math.max(M.period(p.a,p.mass),M.period(p.a2,p.mass)),
  timeUnit:'年',timeRate:()=>.25,step:.01,
  views:[{label:'Ⅰ 橢圓軌道',draw:drawOrbit},{label:'Ⅱ 等時面積',draw:drawAreas},{label:'Ⅲ 週期比較',draw:drawCompare},{label:'T²－a³ 圖',draw:drawRelation}],
  metrics:(p,s)=>window.lesson?.view>=2?
   [['A 週期',fmt(s.period),'年'],['B 週期',fmt(s.secondary.period),'年'],['A：T²/a³',fmt(s.ratio),'年²/AU³'],['B：T²/a³',fmt(s.secondary.ratio),'年²/AU³']]:
   [['A 距中心星 r',fmt(s.r),'AU'],['A 速率 v',fmt(s.speed),'AU/年'],['A 公轉週期 T',fmt(s.period),'年'],['每區掃掠面積',s.sectorArea.toFixed(3),'AU²']],
  note:()=> (window.lesson?.view===1?'橘區：近日點；綠區：遠日點。t 為累積時間，Δt 為每區時間窗。紅 v：速度；黃 a：指向太陽的加速度，兩種箭頭各用獨立比例。 ':window.lesson?.view>=2?'A、B 共用中心星、時鐘與距離比例。 ':'中心星位於黃焦點；綠焦點沒有星體。 ')+'1×：每秒 0.25 年。星體大小為示意；視野隨參數調整。',
  presets:[
   {label:'① 橢圓：近快遠慢',values:{},question:'切到等時面積：比較近日點與遠日點，哪裡走得快？兩區面積呢？',answer:'中心星位於焦點。近日點速率較大、遠日點較小，但相等時間掃掠面積相等。'},
   {label:'② 只將 A 半長軸加倍',values:{a:3},question:'A 從 1.5 AU 變成 3 AU，週期也加倍嗎？切到週期比較驗證。',answer:'週期變成 2^(3/2) ≈ 2.83 倍，從約 1.84 年變成 5.20 年；T²/a³ 維持 1 年²/AU³。'},
   {label:'③ 圓軌道：e = 0',values:{e:0},question:'只把離心率設為零，速率與週期如何改變？',answer:'行星做等速圓周運動，等時點間距相等。半長軸與中心星質量未改變，因此週期不變。'},
   {label:'④ 只將中心星質量加倍',values:{mass:2},question:'中心星質量加倍後，兩顆行星的 T²/a³ 還是 1 嗎？',answer:'兩顆行星週期都縮短為原來的 1/√2；T²/a³ 都變成 0.50 年²/AU³。第三定律的比例常數與中心星質量有關。'}
  ]
 });
 // The shared shell's visible step text only includes s/ns; label years locally.
 const baseRender=window.lesson.render;
 window.lesson.render=function(){baseRender.call(this);this.$('step').textContent='+ 0.01 年';};
 window.lesson.render();
})();
