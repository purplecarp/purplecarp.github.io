(() => {
 const M=PhysicsModel,C=LessonColors;
 function ring(a,s){
  const W=a.width,H=a.height,R=Math.max(25,Math.min(W/2-65,(H-100)/2)-a.p.amplitude),cx=W/2,cy=H/2+10,color=s.allowed?C.blue:C.red;
  a.text(s.allowed?'整數波長：首尾同相':'非整數波長：無法平滑閉合',W/2,30,color,W<500?20:24,'center');
  a.ctx.strokeStyle=C.grid;a.ctx.lineWidth=2;a.ctx.beginPath();a.ctx.arc(cx,cy,R,0,2*Math.PI);a.ctx.stroke();
  a.ctx.beginPath();for(let i=0;i<=720;i++){const angle=i/720*2*Math.PI,r=R+a.p.amplitude*Math.sin(s.ratio*angle)*s.phase,x=cx+r*Math.cos(angle),y=cy-r*Math.sin(angle);if(i===0)a.ctx.moveTo(x,y);else a.ctx.lineTo(x,y);}a.ctx.strokeStyle=color;a.ctx.lineWidth=3.5;a.ctx.stroke();
  a.dot(cx,cy,9,C.yellow);
  if(a.p.nodes&&s.allowed)for(let i=0;i<2*s.n;i++){const theta=i*Math.PI/s.n;a.dot(cx+R*Math.cos(theta),cy-R*Math.sin(theta),5,C.green);}
  a.line(cx+R-35,cy,cx+R+a.p.amplitude+12,cy,C.yellow,2,[4,5]);
  if(a.p.marker){const theta=s.t*1.3%(2*Math.PI),r=R+a.p.amplitude*Math.sin(s.ratio*theta)*s.phase;a.dot(cx+r*Math.cos(theta),cy-r*Math.sin(theta),7,C.yellow);}
  a.text(`繞一圈的相位差 ${(s.mismatch*180/Math.PI).toFixed(1)}°`,W/2,H-16,C.ink,W<500?18:22,'center');
 }
 function unfold(a,s){
  const data=Array.from({length:501},(_,i)=>({x:i/500,y:Math.sin(s.ratio*2*Math.PI*i/500)*s.phase}));
  a.graph({xmax:1,ymin:-1.25,ymax:1.25,xlabel:'沿圓周的位置 s / (2πr)',ylabel:'波幅（相對值）',series:[{color:s.allowed?C.blue:C.red,data}],points:[{x:0,y:0,color:C.yellow},{x:1,y:data.at(-1).y,color:C.orange}]});
 }
 window.lesson=new Classroom({title:'氫原子軌道物質波駐波',defaults:{n:2,radius:4,wavelength:4*Math.PI,amplitude:24,lock:true,nodes:true,marker:false,speed:1},
 controls:[{key:'lock',label:'鎖定波耳量子化條件',type:'check'},{key:'n',label:'主量子數 n',min:1,max:7,step:1,unit:'',disabled:p=>!p.lock},{key:'radius',label:'軌道半徑 r',min:1,max:49,step:.01,unit:'a₀',disabled:p=>p.lock},{key:'wavelength',label:'物質波波長 λ',min:.5,max:45,step:.01,unit:'a₀',disabled:p=>p.lock},{key:'amplitude',label:'波形放大幅度',min:4,max:36,step:1,unit:'px',display:true},{key:'nodes',label:'標示駐波節點',type:'check',display:true},{key:'marker',label:'相位追蹤點（非電子）',type:'check',display:true}],
 normalize:p=>{if(p.lock){p.radius=p.n*p.n;p.wavelength=2*Math.PI*p.n;}},state:M.state,duration:()=>4,timeUnit:'示意秒',
 views:[{label:'環形物質波',draw:ring}],
 comparisonLayout:'paired',comparisonTitle:'圓周展開圖',comparisonViews:[{label:'圓周展開圖',draw:unfold}],
 metrics:(p,s)=>[['周長／波長',s.ratio.toFixed(3),'個波長'],['相位差',(s.mismatch*180/Math.PI).toFixed(1),'°'],['半徑 r',s.radius.toFixed(2),'a₀'],['波耳能量',s.energy===null?'—':s.energy.toFixed(2),'eV']],
 note:p=>p.lock?'環形駐波為量子化的教學類比；波形位移與播放時間皆為示意。':'自由設定僅檢查環形波的週期邊界；不代表真實氫原子允許態。',
 presets:[{label:'① n = 2，整數波長',values:{},question:'繞一圈恰好容納幾個波長？',answer:'n = 2 時容納兩個波長，環形正弦駐波有四個不同的節點。'},
 {label:'② n = 3，下一個允許態',values:{n:3},question:'升到 n = 3，半徑與能量如何變化？',answer:'波耳半徑為 9a₀，能量約 −1.51 eV；容納三個波長。'},
 {label:'③ 約 2.5 個波長',values:{lock:false,radius:4,wavelength:10.05},question:'即使兩端瞬間同高，這個波能平滑閉合嗎？',answer:'不能。半整數附近的相位差約 180°，兩端斜率不匹配；不能只比較某一瞬間的端點高度。'}]});
})();
