(() => {
 const C=LessonColors,M=PhysicsModel;
 function draw(a,s){
  const p=a.p,W=a.width,H=a.height,eq=W*.46,sy=H-82,cy=(sy-40)/2,maxRadius=Math.max(25,Math.min(W*.23,cy-68,sy-cy-70)),scale=maxRadius/5,R=p.amplitude*scale;
  const px=eq+s.x*scale,py=cy-s.circleY*scale;
  a.text('圓周運動與水平投影',16,28,C.ink,W<500?20:24);
  a.text(`已經過 ${(s.t/s.period).toFixed(2)} 個週期`,16,55,C.yellow,18);
  a.ctx.strokeStyle=C.grid;a.ctx.lineWidth=2;a.ctx.beginPath();a.ctx.arc(eq,cy,R,0,Math.PI*2);a.ctx.stroke();
  a.line(eq-R-25,cy,eq+R+25,cy,C.grid);a.line(eq,cy-R-10,eq,sy+14,C.ink,1.5,[4,5]);
  if(p.trail){
   // Anchor samples to the start so later frames only add dots, never move old ones.
   const interval=.05,count=Math.floor(s.t/interval);
   for(let i=0;i<=count;i++){
    const z=M.state(p,i*interval);
    a.dot(eq+z.x*scale,cy-z.circleY*scale,2,C.blue);
    a.dot(eq+z.x*scale,sy+19,2,C.blue);
   }
  }
  a.line(px,py,px,sy,C.blue,2,[5,6]);a.dot(px,py,8,C.blue);
  const wall=20,end=px-17;
  a.line(wall,sy-23,wall,sy+23,C.ink,4);a.line(wall,sy,end,sy,C.grid);
  a.ctx.beginPath();a.ctx.moveTo(wall,sy);for(let i=1;i<=32;i++)a.ctx.lineTo(wall+(end-wall)*i/32,sy+(i===32?0:i%2?9:-9));a.ctx.strokeStyle=C.blue;a.ctx.lineWidth=2.5;a.ctx.stroke();
  a.ctx.fillStyle=C.blue;a.ctx.fillRect(px-17,sy-17,34,34);
  a.text('x = 0',eq+7,sy+22,C.ink,16);
  // Fixed scales: the default 4 m/s² spans 48 px; 50 N spans 80 px.
  // Do not normalize by the current k or m: their effect must remain visible.
  const vScale=Math.min(80,R*.95)/(p.amplitude*s.omega),aScale=48/4,forceScale=80/50;
  if(p.velocity){a.arrow(px,py,s.v*vScale,-s.circleVY*vScale,C.red,'v');a.arrow(px,sy-38,s.v*vScale,0,C.red,'vₓ');}
  if(p.acceleration){a.arrow(px,py,s.a*aScale,-s.circleAY*aScale,C.orange,'a');a.arrow(px,sy+37,s.a*aScale,0,C.orange,'aₓ');}
  if(p.force)a.arrow(px,sy+66,s.force*forceScale,0,C.green,'F');
 }
 function graph(key,label,color){return(a)=>{const s=M.state(a.p,0),bound=key==='x'?a.p.amplitude:key==='v'?a.p.amplitude*s.omega:a.p.amplitude*s.omega*s.omega;const data=Array.from({length:361},(_,i)=>{const t=a.time*i/360;return{x:t,y:M.state(a.p,t)[key]};});a.graph({xmax:a.duration,ymin:-bound*1.15,ymax:bound*1.15,ylabel:label,series:[{color,data}],points:[{x:a.time,y:M.state(a.p,a.time)[key],color}]});};}
 window.lesson=new Classroom({title:'彈簧與圓周運動',defaults:{k:5,m:5,amplitude:4,speed:1,trail:true,velocity:true,acceleration:true,force:false},
 controls:[{key:'k',label:'彈簧常數 k',min:1,max:10,step:1,unit:'N/m'},{key:'m',label:'質量 m',min:.5,max:10,step:.5,unit:'kg'},{key:'amplitude',label:'振幅 A',min:.5,max:5,step:.1,unit:'m'},{key:'trail',label:'等時距軌跡',type:'check',display:true},{key:'velocity',label:'速度與水平分量',type:'check',display:true},{key:'acceleration',label:'加速度與水平分量',type:'check',display:true},{key:'force',label:'彈簧回復力 F',type:'check',display:true}],
 state:M.state,duration:p=>3*M.state(p,0).period,playbackPeriod:p=>M.state(p,0).period,
 views:[{label:'圓周與彈簧',draw}],
 comparisonLayout:'side',
 comparisonViews:[{label:'位移－時間',draw:graph('x','x (m)',C.blue)},{label:'速度－時間',draw:graph('v','v (m/s)',C.red)},{label:'加速度－時間',draw:graph('a','a (m/s²)',C.orange)}],
 metrics:(p,s)=>[['位移 x',s.x.toFixed(2),'m'],['速度 vₓ',s.v.toFixed(2),'m/s'],['加速度 aₓ',s.a.toFixed(2),'m/s²'],['週期 T',s.period.toFixed(2),'s']],
 note:()=> '理想彈簧、無阻尼。圓周向量的水平分量與木塊同步；不同物理量的箭頭比例各自設定。',
 presets:[{label:'① 基本簡諧運動',values:{},question:'木塊通過平衡點時，速度與加速度各為多少？',answer:'通過平衡點時速率最大，加速度為零；在兩端反過來。'},
 {label:'② 只增加質量',values:{m:10},question:'質量變成兩倍，週期會如何變化？',answer:'T = 2π√(m/k)，質量兩倍時週期變成 √2 倍。'},
 {label:'③ 只將振幅減半',values:{amplitude:2},question:'振幅減半會改變理想彈簧的週期嗎？',answer:'週期不變，最大速率與最大加速度減半。'}]});
})();
