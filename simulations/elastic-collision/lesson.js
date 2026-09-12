(() => {
 const C=LessonColors,M=PhysicsModel;
 const controls=[
  {key:'mode',label:'碰撞模式',type:'select',options:[['instant','瞬時彈性碰撞'],['spring','兩球夾彈簧']]},
  {key:'k',label:'彈簧常數 k',min:100,max:500,step:25,unit:'N/m',disabled:p=>p.mode!=='spring'},
  {key:'m1',label:'A 質量',min:.5,max:10,step:.5,unit:'kg'},
  {key:'m2',label:'B 質量',min:.5,max:10,step:.5,unit:'kg'},
  {key:'u1',label:'A 初速度',min:-8,max:8,step:.5,unit:'m/s'},
  {key:'u2',label:'B 初速度',min:-8,max:8,step:.5,unit:'m/s'},
  {key:'walls',label:'牆壁彈性反彈（瞬時模式）',type:'check',disabled:p=>p.mode==='spring'},
  {key:'vectors',label:'速度向量',type:'check',display:true},
  {key:'trail',label:'等時距軌跡',type:'check',display:true}
 ];
 function draw(a,s){
  const p=a.p,W=a.width,H=a.height;
  const end=M.state(p,a.duration),min=Math.min(0,end.x1,end.x2)-2,max=Math.max(20,end.x1,end.x2)+2;
  const X=x=>70+(x-min)/(max-min)*(W-140),y=H*.48;
  a.line(30,y,W-30,y,C.ink);
  a.text('A',20,32,C.blue,24);a.text('B',66,32,C.orange,24);
  a.text('向右為正',W-20,32,C.ink,18,'right');
  if(p.mode==='spring'){
   const left=X(s.x1+s.r1),right=X(s.x1+s.r1+s.springLength-s.compression),color=s.compression>0?C.yellow:C.ink;
   let px=left,py=y;
   for(let i=1;i<=20;i++){const nx=left+(right-left)*i/20,ny=i===20?y:y+(i%2?10:-10);a.line(px,py,nx,ny,color,2.5);px=nx;py=ny;}
   a.text(s.stage,20,65,C.yellow,18);
   a.text(`壓縮 ${s.compression.toFixed(2)} m · 彈力 ${s.force.toFixed(1)} N`,20,H-78,C.yellow,W<500?14:18);
  }
  if(p.walls){a.line(X(0),y-75,X(0),y+80,C.ink,5);a.line(X(20),y-75,X(20),y+80,C.ink,5);}
  if(p.trail)for(let t=0;t<=s.t+1e-9;t+=.1){const z=M.state(p,t);a.dot(X(z.x1),y+65,2.5,C.blue);a.dot(X(z.x2),y+85,2.5,C.orange);}
  for(const [x,v,r,color,label] of [[s.x1,s.v1,s.r1,C.blue,'A'],[s.x2,s.v2,s.r2,C.orange,'B']]){
   const radius=r*(W-140)/(max-min);a.dot(X(x),y,radius,color);a.text(label,X(x),radius<14?y-radius-10:y+7,radius<14?color:'#101e2e',radius<14?18:24,'center');
   a.text(`${v.toFixed(2)} m/s`,Math.max(65,Math.min(W-65,X(x))),y+radius+29,color,20,'center');
  }
  if(p.vectors){const bound=Math.sqrt(2*s.totalEnergy/Math.min(p.m1,p.m2)),factor=105/Math.max(bound,1);a.arrow(X(s.x1),y-55,s.v1*factor,0,C.blue,'v₁');a.arrow(X(s.x2),y-105,s.v2*factor,0,C.orange,'v₂');}
  a.text(`${p.mode==='spring'?'彈簧接觸':'球－球碰撞'} ${s.count} 次`,20,H-44,C.green,22);
  a.text(p.mode==='spring'?'動能 ⇄ 彈性位能；總機械能守恆':p.walls?'牆壁施加外力：兩球總動量可改變':'無外力：兩球總動量與總動能守恆',20,H-16,C.ink,W<500?14:18);
 }
 function graph(kind){return(a)=>{
  const p=a.p,spring=p.mode==='spring'&&kind==='e';
  const keys=kind==='v'?['v1','v2']:kind==='p'?['p1','p2','momentum']:spring?['e1','e2','energy','potential','totalEnergy']:['e1','e2','energy'];
  const initial=M.state(p,0),times=Array.from({length:301},(_,i)=>a.time*i/300);
  // Include contact samples even for very short, stiff-spring collisions.
  if(p.mode==='spring'&&Number.isFinite(initial.contactTime))for(let i=0;i<=60;i++){const t=initial.contactTime+initial.contactDuration*i/60;if(t<=a.time)times.push(t);}
  times.sort((a,b)=>a-b);
  const data=times.map(t=>M.state(p,t)),energy=initial.totalEnergy;
  const bound=Math.max(1,kind==='e'?energy:kind==='v'?Math.sqrt(2*energy/Math.min(p.m1,p.m2)):Math.sqrt(2*energy*(p.m1+p.m2)))*1.15;
  a.graph({xmax:a.duration,ymin:kind==='e'?0:-bound,ymax:bound,ylabel:kind==='v'?'v (m/s)':kind==='p'?'p (kg·m/s)':'K (J)',series:keys.map((k,i)=>({color:[C.blue,C.orange,C.green,C.yellow,C.ink][i],dash:i===4?[5,4]:[],data:data.map(s=>({x:s.t,y:s[k]}))}))});
  a.text(spring?'藍 A｜橘 B｜綠總 K':kind==='v'?'A：藍　B：橘':'A：藍　B：橘　總量：綠',a.width-15,22,C.ink,a.width<500?12:15,'right');
  if(spring)a.text('黃彈性位能｜虛線總機械能',a.width-15,42,C.ink,a.width<500?12:15,'right');
 };}
 window.lesson=new Classroom({title:'一維彈性碰撞',defaults:{mode:'instant',k:100,m1:2,m2:4,u1:5,u2:-1.5,walls:false,vectors:true,trail:false,speed:1},controls,normalize:p=>{if(p.mode==='spring')p.walls=false;},duration:()=>8,state:M.state,
 views:[{label:'碰撞演示',draw}],
 comparisonLayout:'side',
 comparisonTitle:'v–t、p–t、K–t 同步對照',
 comparisonViews:[{label:'速度－時間 v–t',draw:graph('v')},{label:'動量－時間 p–t',draw:graph('p')},{label:'動能－時間 K–t',draw:graph('e')}],
 metrics:(p,s)=>[['A 速度',s.v1.toFixed(2),'m/s'],['B 速度',s.v2.toFixed(2),'m/s'],['總動量',s.momentum.toFixed(2),'kg·m/s'],['總動能',s.energy.toFixed(2),'J'],...(p.mode==='spring'?[['彈性位能',s.potential.toFixed(2),'J'],['總機械能',s.totalEnergy.toFixed(2),'J']]:[])],
 note:p=>p.mode==='spring'?'無牆壁；無質量彈簧只推不拉，回到原長即分離。可用慢速或時間軸觀察壓縮與回彈。':p.walls?'牆壁屬於兩球系統的外界；視野隨參數調整。':'無摩擦、瞬時彈性碰撞；視野隨參數調整。',
 presets:[{label:'① 同質量交換速度',values:{m1:2,m2:2,u1:5,u2:-1},question:'碰撞後，兩球的速度會如何分配？',answer:'同質量的一維彈性碰撞會交換速度。'},
 {label:'② B 質量加倍',values:{m1:2,m2:4,u1:5,u2:-1},question:'只把 B 的質量加倍，A 還會得到原本 B 的速度嗎？',answer:'不同質量不再直接交換速度，但總動量與總動能仍守恆。'},
 {label:'③ 同速，會追上嗎？',values:{m1:2,m2:2,u1:3,u2:3},question:'兩球都向右且同速，距離會改變嗎？',answer:'相對速度為零，兩球保持距離，不發生碰撞。'},{label:'彈簧碰撞：慢速觀察',values:{mode:'spring',k:100,m1:2,m2:4,u1:5,u2:-1.5,speed:.25},question:'彈簧壓縮到最短時，兩球速度與動能如何改變？',answer:'壓縮最大時兩球速度相同，總動能最小、彈性位能最大；回到原長後分離，總動能恢復。'}]});
})();
