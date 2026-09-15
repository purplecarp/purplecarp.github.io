(() => {
 'use strict';
 const C=LessonColors,M=PhysicsModel;
 const rangeFor=p=>{
  const times=[0,p.duration];
  if(p.acceleration!==0){const turn=-p.v0/p.acceleration;if(turn>0&&turn<p.duration)times.push(turn);}
  const xs=times.map(t=>M.position(p,t)),min=Math.min(...xs),max=Math.max(...xs),span=Math.max(.3,max-min);
  return {min:min-.1*span,max:max+.1*span};
 };
 const format=value=>value===null?'—':value.toFixed(2);
 function cart(a,s){
  const W=a.width,H=a.height,p=a.p,range=rangeFor(p),left=70,right=W-35,X=x=>left+(x-range.min)/(range.max-range.min)*(right-left);
  const trackY=H*.52,cartX=X(s.x),compact=W<520;
  a.text('固定頻率打點',20,32,C.ink,compact?20:24);
  a.text(`f = ${s.frequency} Hz　Δt = ${(1000*s.interval).toFixed(1)} ms`,W-18,compact?56:32,C.yellow,compact?14:18,'right');
  a.line(left,trackY,right,trackY,C.ink,3);
  for(let i=0;i<=5;i++){const px=left+(right-left)*i/5;a.line(px,trackY-7,px,trackY+8,C.grid,2);}
  const timerX=compact?26:38,tapeY=trackY+46;
  a.line(5,tapeY,Math.max(timerX,cartX),tapeY,'#e8dcc0',13);
  if(p.showDots)for(const hole of s.holes){
   const hx=timerX+(X(s.x)-X(hole.x)),grouped=hole.index%s.groupSize===0;
   if(hx>=4&&hx<=cartX+2)a.dot(hx,tapeY,grouped?5:2.7,grouped?C.red:'#26384b');
  }
  a.arrow(timerX+12,tapeY+29,compact?52:75,0,C.green);
  a.text('紙帶',timerX+(compact?72:96),tapeY+20,C.green,compact?16:20,'right');
  a.text(compact?'舊孔隨紙帶移動；撞針固定':'小車拉動紙帶：舊孔隨紙帶移動，撞針位置固定',left,tapeY+68,C.ink,compact?13:17);
  const c=a.ctx,cw=compact?48:64,ch=compact?25:32,cx=Math.max(left+cw/2,Math.min(right-cw/2,cartX)),cy=trackY-ch/2-9;
  c.fillStyle=C.blue;c.fillRect(cx-cw/2,cy-ch/2,cw,ch);a.dot(cx-cw*.3,trackY-6,compact?6:8,C.ink);a.dot(cx+cw*.3,trackY-6,compact?6:8,C.ink);
  a.text('小車',cx,cy+7,'#101e2e',compact?15:19,'center');
  if(Math.abs(s.v)>.005)a.arrow(cx,cy-ch/2-22,Math.sign(s.v)*Math.min(110,28+Math.abs(s.v)*34),0,C.orange,'v');
  const timerY=trackY-85;
  c.fillStyle='#233b52';c.fillRect(timerX-20,timerY-28,40,56);a.line(timerX,timerY+28,timerX,tapeY,C.orange,3);
  const phase=(s.t*s.frequency)%1,pulse=phase<.18;
  a.dot(timerX,timerY,pulse?10:5,pulse?C.yellow:C.orange);a.text('打點器',timerX,timerY-38,C.ink,compact?13:16,'center');
  if(pulse)a.dot(timerX,tapeY,5,C.red);
  a.text(`第 ${s.lastTick} 點　x = ${s.x.toFixed(2)} m`,W/2,H-18,C.ink,compact?18:24,'center');
 }
 function analysis(a,s){
  const W=a.width,H=a.height,p=a.p,range=rangeFor(p),l=54,r=W-24,X=x=>l+(x-range.min)/(range.max-range.min)*(r-l),tapeY=H*.25,compact=W<520;
  a.text('取下攤平的紙帶（紙帶座標）',16,30,C.ink,compact?18:23);
  const c=a.ctx;c.fillStyle='#e8dcc0';c.fillRect(l,tapeY-22,r-l,44);
  if(p.showRuler){
   const span=range.max-range.min,raw=span/6,pow=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].find(n=>n*pow>=raw)*pow;
   for(let x=Math.ceil(range.min/step)*step;x<=range.max+1e-9;x+=step){const px=X(x);a.line(px,tapeY+24,px,tapeY+35,C.ink,1.5);a.text(`${x.toFixed(step<.1?2:1)} m`,px,tapeY+53,C.ink,12,'center');}
  }
  let lastLabelX=-Infinity;
  for(const dot of s.dots){
   const grouped=dot.index%s.groupSize===0,px=X(dot.x);a.dot(px,tapeY,grouped?5:2.5,grouped?C.red:'#26384b');
   if(grouped&&p.showLabels&&px-lastLabelX>=30){a.text(String(dot.index),px,tapeY-30,C.red,12,'center');lastLabelX=px;}
  }
  if(s.latestGroup){
   const g=s.latestGroup,x0=M.position(p,g.t0),x1=M.position(p,g.t1),y=tapeY+72;
   a.line(X(x0),y,X(x1),y,C.green,4);a.line(X(x0),y-7,X(x0),y+7,C.green,2);a.line(X(x1),y-7,X(x1),y+7,C.green,2);
   a.text(`最近完整一組：Δx = ${g.dx.toFixed(3)} m，Δt = ${(g.t1-g.t0).toFixed(3)} s`,W/2,y+29,C.green,compact?13:17,'center');
  }
  const chart={l:58,r:W-24,t:H*.62,b:H-42},end=Math.max(.01,p.duration),states=Array.from({length:81},(_,i)=>{const time=end*i/80;return {x:time,y:M.velocity(p,time)};}),velocities=states.map(q=>q.y),minV=Math.min(0,...velocities),maxV=Math.max(0,...velocities),pad=Math.max(.2,(maxV-minV)*.12),ymin=minV-pad,ymax=maxV+pad;
  const TX=t=>chart.l+t/end*(chart.r-chart.l),VY=v=>chart.b-(v-ymin)/(ymax-ymin)*(chart.b-chart.t);
  a.text('速度分析',16,chart.t-15,C.ink,compact?18:21);a.line(chart.l,chart.t,chart.l,chart.b,C.ink);a.line(chart.l,chart.b,chart.r,chart.b,C.ink);
  if(ymin<0&&ymax>0)a.line(chart.l,VY(0),chart.r,VY(0),C.grid,1.5,[5,4]);
  c.save();c.beginPath();c.rect(chart.l,chart.t,chart.r-chart.l,chart.b-chart.t);c.clip();
  for(let i=1;i<states.length;i++)a.line(TX(states[i-1].x),VY(states[i-1].y),TX(states[i].x),VY(states[i].y),C.orange,2);
  for(const g of s.groups)a.dot(TX(g.midTime),VY(g.averageVelocity),5,C.green);
  c.restore();a.text('橘：真實 v(t)　綠：紙帶分組估計',chart.r,chart.t-15,C.ink,compact?11:14,'right');a.text('t (s)',chart.r,H-10,C.ink,14,'right');a.text('v',20,chart.t+8,C.ink,16);
 }
 window.lesson=new Classroom({
  title:'打點計時器、小車與紙帶點距分析',
  defaults:{v0:.6,acceleration:.8,frequency:'60',groupSize:'6',duration:2,showDots:true,showLabels:true,showRuler:true,speed:1},
  controls:[
   {key:'v0',label:'小車初速度 v₀',min:0,max:2,step:.1,unit:'m/s'},
   {key:'acceleration',label:'加速度 a（僅正值）',min:.1,max:2,step:.1,unit:'m/s²'},
   {key:'frequency',label:'打點頻率 f',type:'select',options:[['10','10 Hz（慢速示意）'],['50','50 Hz'],['60','60 Hz（臺灣市電）']]},
   {key:'groupSize',label:'每組打點間隔 N',type:'select',display:true,options:[['1','1 個間隔'],['5','5 個間隔'],['6','6 個間隔'],['10','10 個間隔']]},
   {key:'duration',label:'演示時間',min:1,max:4,step:.25,unit:'s'},
   {key:'showDots',label:'顯示等時位置點',type:'check',display:true},
   {key:'showLabels',label:'標示分組點編號',type:'check',display:true},
   {key:'showRuler',label:'顯示紙帶比例尺',type:'check',display:true}
  ],
  state:M.state,duration:p=>p.duration,step:.1,
  views:[{label:'打點過程',draw:cart}],
  comparisonLayout:'paired',comparisonTitle:'紙帶與速度分析',comparisonViews:[{label:'紙帶與速度分析',draw:analysis}],
  metrics:(p,s)=>[['已打點數',String(s.dotCount),'點'],['當前速度',s.v.toFixed(2),'m/s'],['分組平均速度',format(s.estimatedVelocity),'m/s'],['加速度估計',format(s.estimatedAcceleration),'m/s²']],
  note:(p,s)=>`加速度限制為正值；打點器固定，紙帶與既有孔洞隨小車移動。每 ${s.groupSize} 個間隔為 ${(s.groupTime).toFixed(3)} s。`,
  presets:[
   {label:'① 正加速度：點距增加',values:{v0:.6,acceleration:.4,frequency:'60',groupSize:'6',duration:2},question:'每個打點的時間間隔相同；小車具有正加速度時，紙帶點距如何變化？',answer:'速度持續增加，因此沿拉動方向的相鄰點距逐漸增加。'},
   {label:'② 只增加加速度',values:{v0:.6,acceleration:1.2,frequency:'60',groupSize:'6',duration:2},question:'只把正加速度從 0.4 增至 1.2 m/s²，點距拉大的速率如何改變？',answer:'點距增加得更快；相鄰分組平均速度的差也變成原來的三倍。'},
   {label:'③ 同運動，只降低頻率',values:{v0:.6,acceleration:.4,frequency:'10',groupSize:'1',duration:2},question:'運動參數不變，只把 60 Hz 改成 10 Hz，點距變大是否代表小車更快？',answer:'不是。頻率降低使每段時間變長，所以點距自然較大；必須用 Δx/Δt 比較速度，不能只看點距。'}
  ]
 });
})();
