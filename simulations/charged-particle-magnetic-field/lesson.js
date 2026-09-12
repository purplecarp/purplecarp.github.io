(() => {
 const C=LessonColors,M=PhysicsModel;
 function draw(a,s){
  const W=a.width,H=a.height,p=a.p;
  for(let x=35;x<W;x+=70)for(let y=60;y<H-25;y+=70)a.text(p.direction==='out'?'⊙':'⊗',x,y,'#354a61',24,'center');
  a.text(p.direction==='out'?'B：出紙面 ⊙':'B：入紙面 ⊗',16,30,C.ink,24);
  const start=M.state(p,0),end=M.state(p,a.duration),straight=!Number.isFinite(s.radius);
  let xmin,xmax,ymin,ymax;
  if(straight){xmin=Math.min(start.x,end.x);xmax=Math.max(start.x,end.x);ymin=Math.min(start.y,end.y);ymax=Math.max(start.y,end.y);}
  else{xmin=s.cx-s.radius;xmax=s.cx+s.radius;ymin=s.cy-s.radius;ymax=s.cy+s.radius;}
  const span=Math.max(xmax-xmin,ymax-ymin,.005),scale=Math.min((W-210)/span,(H-160)/span),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const X=x=>W/2+(x-cx)*scale,Y=y=>H/2-(y-cy)*scale;
  if(p.orbit&&!straight){a.ctx.beginPath();a.ctx.arc(X(s.cx),Y(s.cy),s.radius*scale,0,Math.PI*2);a.ctx.strokeStyle='#53718d';a.ctx.lineWidth=2;a.ctx.setLineDash([5,6]);a.ctx.stroke();a.ctx.setLineDash([]);}
  if(p.trail){const dt=a.duration/160;for(let i=0;i<=Math.floor(s.t/dt);i++){const z=M.state(p,i*dt);a.dot(X(z.x),Y(z.y),3,C.blue);}}
  const color=p.charge>0?C.red:p.charge<0?C.blue:C.ink;
  a.dot(X(s.x),Y(s.y),11,color);a.text(p.charge===0?'0':p.charge>0?'+':'−',X(s.x),Y(s.y)+7,'#101e2e',20,'center');
  if(p.vectors){const vscale=80/s.speed;a.arrow(X(s.x),Y(s.y),s.vx*vscale,-s.vy*vscale,C.yellow,'v');const f=Math.hypot(s.fx,s.fy);if(f>0)a.arrow(X(s.x),Y(s.y),s.fx/f*70,-s.fy/f*70,C.green,'F');}
  a.text(straight?'qB = 0：等速直線':`r = ${(s.radius*100).toFixed(2)} cm`,16,H-45,C.ink,24);
  a.text('視野自動縮放；v、F 箭頭僅示方向',16,H-16,C.ink,W<500?14:18);
 }
 window.lesson=new Classroom({title:'帶電粒子在磁場中的運動',defaults:{field:1,direction:'out',charge:1.6,mass:1.67,velocity:5,angle:90,position:'right',speed:1,trail:true,vectors:true,orbit:false},
 controls:[{key:'field',label:'磁場 B',min:0,max:5,step:.1,unit:'T'},{key:'direction',label:'磁場方向',type:'select',options:[['out','⊙ 出紙面'],['in','⊗ 入紙面']]},{key:'charge',label:'電荷 q',min:-5,max:5,step:.1,unit:'×10⁻¹⁹ C'},{key:'mass',label:'質量 m',min:.5,max:10,step:.01,unit:'×10⁻²⁷ kg'},{key:'velocity',label:'初速 v',min:.5,max:10,step:.5,unit:'×10⁶ m/s'},{key:'angle',label:'初速仰角',min:0,max:360,step:5,unit:'°'},{key:'position',label:'起點',type:'select',options:[['right','右方'],['left','左方'],['top','上方'],['bottom','下方']]},{key:'trail',label:'等時距軌跡',type:'check',display:true},{key:'vectors',label:'速度 v 與磁力 F',type:'check',display:true},{key:'orbit',label:'預測完整圓軌道',type:'check',display:true}],
 state:M.state,duration:p=>{const T=M.state(p,0).period;return Number.isFinite(T)?Math.min(2*T,400):100;},timeUnit:'ns',timeRate:()=>20,step:1,
 views:[{label:'磁場運動',draw}],
 metrics:(p,s)=>[['速率',(s.speed/1e6).toFixed(2),'×10⁶ m/s'],['半徑',Number.isFinite(s.radius)?(s.radius*100).toFixed(2):'∞','cm'],['週期',Number.isFinite(s.period)?s.period.toFixed(2):'—','ns'],['磁力',(Math.hypot(s.fx,s.fy)*1e12).toFixed(2),'pN']],
 note:()=> '速度位於紙面內，始終垂直磁場。1× 播放每秒推進 20 ns；磁力不做功。',
 presets:[{label:'① 正電荷、磁場向外',values:{},question:'向上運動的正電荷，磁力指向哪裡？',answer:'v × B 向右，正電荷向右彎；磁力與速度始終垂直。'},
 {label:'② 只反轉電荷',values:{charge:-1.6},question:'只把電荷反號，半徑與轉向各如何改變？',answer:'半徑不變，彎曲方向相反。'},
 {label:'③ 電荷為零',values:{charge:0},question:'沒有電荷的粒子還會被磁場偏轉嗎？',answer:'磁力為零，粒子做等速直線運動，不具有有限圓周半徑。'}]});
})();
