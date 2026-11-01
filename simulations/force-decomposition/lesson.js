/* The shared Classroom shell owns playback, resize and touch-friendly controls. */
(() => {
 'use strict';
 const C = {...LessonColors, purple:'#c6a6ff'}, M = PhysicsModel;
 const defaults = {scenario:'incline', mass:2, inclineAngle:30, muS:.6, muK:.4,
  pendulumAngle:35, length:2, decompose:false, showWeight:true, showSupport:true,
  showFriction:true, axes:true, speed:1, angleSweep:false};
 let legend;
 function updateUI(a,s) {
  if(!legend) {
   legend=document.createElement('div'); legend.className='force-legend';
   legend.setAttribute('aria-label','力的圖例與重力分量');
   document.querySelector('.lesson-timeline').before(legend);
  }
  const pend=s.kind==='pendulum';
  if(!pend)a.displayedInclineAngle=s.theta*180/Math.PI;
  const sweepButton=document.querySelector('[data-action="0"]');
  sweepButton.hidden=pend;
  sweepButton.textContent=s.phase==='sliding'?'角度已固定':a.p.angleSweep?'固定目前角度':'開始逐漸改變角度';
  sweepButton.setAttribute('aria-pressed',String(a.p.angleSweep));
  const angleLocked=Boolean(s.sweeping);
  a.$('inclineAngle').disabled=angleLocked;
  document.querySelectorAll('[data-adjust="inclineAngle"]').forEach(button=>button.disabled=angleLocked);
  if(s.sweepSequence) {
   a.$('inclineAngle').value=s.theta*180/Math.PI;
   a.$('inclineAngleValue').textContent=(s.theta*180/Math.PI).toFixed(1)+' °';
  }
  const timelineLabel=document.querySelector('label[for="time"]');
  timelineLabel.firstChild.textContent=s.sweepSequence?'漸變＋下滑時間 ':'時間 ';
  for(const key of ['inclineAngle','muS','muK','showFriction']) a.$(key).closest('.lesson-control').hidden=pend;
  for(const key of ['pendulumAngle','length']) a.$(key).closest('.lesson-control').hidden=!pend;
  let content='<span class="weight">W 重力 ↓</span><span class="support">'+(pend?'T 繩張力':'N 正向力')+'</span>';
  if(!pend) {
   content+='<span class="friction">f '+(s.stuck?'靜摩擦力':'動摩擦力')+'</span>';
   content+='<span>'+(s.stuck?'C 質心 · P 鉛直投影接觸點':'C 質心 · P 鉛直投影 · Q 接觸力作用點')+'</span>';
  }
  if(a.p.decompose) {
   content+='<span class="parallel">'+(pend?'W⊥ 垂直繩子':'W∥ 沿斜面')+' = '+Math.abs(s.parallel).toFixed(2)+' N</span>';
   content+='<span class="perpendicular">'+(pend?'W∥ 沿繩子（向外）':'W⊥ 垂直斜面')+' = '+s.perpendicular.toFixed(2)+' N</span>';
   content+='<span class="decomposition-note">兩個分量合起來就是重力，不是新增的力。</span>';
  }
  if(legend.innerHTML!==content)legend.innerHTML=content;
 }
 // Short symbols stay legible; full names and values are in the adjacent legend/readouts.
 function force(a,b,v,k,color,label,boxes,component=false) {
  const dx=v.x*k,dy=v.y*k,len=Math.hypot(dx,dy);
  if(len<.5)return;
  const x=b.x+dx,y=b.y+dy,c=a.ctx,angle=Math.atan2(dy,dx),head=Math.min(12,len*.6);
  a.line(b.x,b.y,x,y,color,component?3:4,component?[7,4]:[]);
  c.fillStyle=color;c.beginPath();c.moveTo(x,y);
  c.lineTo(x-head*Math.cos(angle-.48),y-head*Math.sin(angle-.48));
  c.lineTo(x-head*Math.cos(angle+.48),y-head*Math.sin(angle+.48));c.closePath();c.fill();
  c.font='700 '+(a.large?28.8:24)+'px system-ui,sans-serif';
  const width=c.measureText(label).width+10,height=a.large?36:31;
  const candidates=[[x+10,y-17],[x-width-10,y-17],[x-width/2,y+12],[x-width/2,y-height-12],
   [x+14,y+16],[x-width-14,y-height-18],[b.x+dx*.6+12,b.y+dy*.6-17]];
  let best,score=Infinity;
  for(const [rawX,rawY] of candidates) {
   const r={x:Math.max(5,Math.min(a.width-width-5,rawX)),y:Math.max(45,Math.min(a.height-height-35,rawY)),w:width,h:height};
   const overlap=boxes.reduce((n,q)=>n+(r.x<q.x+q.w&&r.x+r.w>q.x&&r.y<q.y+q.h&&r.y+r.h>q.y?1:0),0);
   if(overlap<score){best=r;score=overlap;}
  }
  boxes.push(best);c.fillStyle='#101e2ee8';c.fillRect(best.x,best.y,best.w,best.h);
  a.text(label,best.x+5,best.y+height-7,color,24);
 }
 function drawAxes(a,b,s,size) {
  for(const v of [s.tangent,s.radial])a.line(b.x-v.x*size,b.y-v.y*size,b.x+v.x*size,b.y+v.y*size,C.ink,1,[4,6]);
 }
 function draw(a,s,isolated=false) {
  updateUI(a,s);
  const w=a.width,h=a.height,c=a.ctx,pend=s.kind==='pendulum';
  a.text((pend?'單擺':'斜面上的物體')+(isolated?' · 受力圖':''),14,30,C.ink,24);
  // b locates the bottom-edge midpoint B; C and contact points are computed below.
  let b={x:w*.5,y:h*(pend?.48:.54)};
  const bodySize=pend?Math.min(54,w*.12,h*.13):Math.min(72,w*.14,(b.y-50)/2.4);
  const maxForce=pend?a.p.mass*M.G*(3-2*Math.cos(a.p.pendulumAngle*Math.PI/180)):s.weight;
  const geometry=pend?null:M.inclineGeometry(s.theta,b,2*bodySize,2*bodySize,s.friction/s.normal);
  const weightOrigin=pend?null:geometry.C;
  // Only static equilibrium makes the three lines of action concurrent at P.
  const contact=pend?null:(s.stuck?geometry.P:geometry.Q);
  let k=Math.min(w*(pend?.30:.25),h*(pend?.38:.29))/maxForce;
  if(!pend&&s.stuck&&geometry.inside)k=Math.max(k,(geometry.lambda+30)/s.weight);
  if(!isolated && pend) {
   const origin={x:w*.5,y:70},length=Math.min(w*.28,h*.34);
   b={x:origin.x+length*Math.sin(s.theta),y:origin.y+length*Math.cos(s.theta)};
   a.line(origin.x,origin.y,origin.x,origin.y+length+20,C.ink,1.5,[5,6]);
   c.strokeStyle=C.grid;c.lineWidth=2;c.beginPath();
   c.arc(origin.x,origin.y,length,Math.PI/2-70*Math.PI/180,Math.PI/2+70*Math.PI/180);c.stroke();
   a.line(origin.x-35,origin.y-10,origin.x+35,origin.y-10,C.ink,5);
   a.line(origin.x,origin.y,b.x,b.y,C.ink,3);a.dot(origin.x,origin.y,5,C.ink);
   if(Math.abs(s.theta)>.02){c.strokeStyle=C.yellow;c.beginPath();c.arc(origin.x,origin.y,32,Math.PI/2-Math.max(0,s.theta),Math.PI/2-Math.min(0,s.theta));c.stroke();}
  } else if(!isolated) {
   const u={x:-s.tangent.x,y:-s.tangent.y},q=s.radial,span=Math.hypot(w,h);
   c.fillStyle='#203448';c.beginPath();
   c.moveTo(b.x-u.x*span,b.y-u.y*span);c.lineTo(b.x+u.x*span,b.y+u.y*span);
   c.lineTo(b.x+u.x*span+q.x*span,b.y+u.y*span+q.y*span);
   c.lineTo(b.x-u.x*span+q.x*span,b.y-u.y*span+q.y*span);c.closePath();c.fill();
   a.line(b.x-u.x*span,b.y-u.y*span,b.x+u.x*span,b.y+u.y*span,C.ink,3);
   const offset=(s.distance*35)%42;
   for(let n=-Math.ceil(span/42);n<=Math.ceil(span/42);n++){
    const x=b.x+u.x*(n*42+offset),y=b.y+u.y*(n*42+offset);
    a.line(x,y,x+q.x*12-u.x*7,y+q.y*12-u.y*7,'#49627a',2);
   }
   const corner={x:35,y:h-50},r=42;
   a.line(corner.x,corner.y,corner.x+80,corner.y,C.ink,1.5,[4,5]);
   a.line(corner.x,corner.y,corner.x+80*Math.cos(s.theta),corner.y-80*Math.sin(s.theta),C.ink,2);
   c.strokeStyle=C.yellow;c.beginPath();c.arc(corner.x,corner.y,r,-s.theta,0);c.stroke();
  }
  if(pend) {
   const gradient=c.createRadialGradient(b.x-bodySize*.3,b.y-bodySize*.35,3,b.x,b.y,bodySize);
   gradient.addColorStop(0,'#608fb4');gradient.addColorStop(1,'#244663');
   a.dot(b.x,b.y,bodySize,gradient);
   c.strokeStyle='#87abc8';c.lineWidth=2;c.beginPath();c.arc(b.x,b.y,bodySize,0,2*Math.PI);c.stroke();
  } else {
   // Uniform square: its centre, not its contact point, is the centre of mass.
   c.save();c.translate(b.x,b.y);c.rotate(-s.theta);
   c.fillStyle='#345774';c.strokeStyle='#87abc8';c.lineWidth=2;
   c.fillRect(-bodySize,-bodySize*2,bodySize*2,bodySize*2);
   c.strokeRect(-bodySize,-bodySize*2,bodySize*2,bodySize*2);c.restore();
  }
  const gravityAt=pend?b:weightOrigin,contactAt=pend?b:contact;
  if(a.p.axes)drawAxes(a,gravityAt,s,Math.min(w*.32,h*.35));
  const v=M.vectors(s),boxes=[];
  if(!pend) {
   // CP is the geometric construction, with the solid W shaft drawn over it.
   a.line(geometry.C.x,geometry.C.y,geometry.P.x,geometry.P.y,C.yellow,1.5,[3,5]);
   boxes.push({x:geometry.C.x+8,y:geometry.C.y-33,w:32,h:29});
   if(s.stuck&&geometry.inside)boxes.push({x:geometry.P.x+8,y:geometry.P.y+6,w:32,h:29});
   else boxes.push({x:geometry.Q.x+8,y:geometry.Q.y+6,w:32,h:29});
  }
  boxes.push({x:gravityAt.x-8,y:gravityAt.y-8,w:16,h:16});
  if(a.p.decompose) {
   const end={x:gravityAt.x,y:gravityAt.y+s.weight*k};
   a.line(gravityAt.x+v.parallel.x*k,gravityAt.y+v.parallel.y*k,end.x,end.y,C.purple,1.5,[5,5]);
   a.line(gravityAt.x+v.perpendicular.x*k,gravityAt.y+v.perpendicular.y*k,end.x,end.y,C.orange,1.5,[5,5]);
   force(a,gravityAt,v.parallel,k,C.orange,pend?'W⊥':'W∥',boxes,true);
   force(a,gravityAt,v.perpendicular,k,C.purple,pend?'W∥':'W⊥',boxes,true);
  }
  if(a.p.showWeight)force(a,gravityAt,v.weight,k,C.red,'W',boxes);
  if(a.p.showSupport)force(a,contactAt,v.support,k,C.blue,pend?'T':'N',boxes);
  if(!pend&&a.p.showFriction)force(a,contactAt,v.friction,k,C.green,'f',boxes);
  if(pend)a.dot(b.x,b.y,4,'#e7f0fa');
  else {
   a.dot(geometry.C.x,geometry.C.y,5,C.yellow);
   a.text('C',geometry.C.x+12,geometry.C.y-10,C.yellow,24);
   a.dot(contactAt.x,contactAt.y,5,'#e7f0fa');
   a.text(s.stuck?'P':'Q',contactAt.x+12,contactAt.y+28,'#e7f0fa',24);
   if(!s.stuck) {
    // P remains the vertical projection; do not falsely place contact forces there.
    a.dot(geometry.P.x,geometry.P.y,3,C.yellow);
    a.text('P',geometry.P.x-12,geometry.P.y+28,C.yellow,24,'right');
   }
  }
  const angleText='θ = '+(s.theta*180/Math.PI).toFixed(1)+'°';
  if(pend||isolated)a.text(angleText,14,h-12,C.yellow,24);
  else a.text(angleText,128,h-12,C.yellow,24);
  if(w>530)a.text(isolated?'同一時刻的受力':pend?'由靜止釋放':s.sweeping?'逐漸增加傾角':'視角跟隨物體',w-14,h-12,C.ink,24,'right');
 }
 function toggleAngleSweep(a) {
  if(a.p.angleSweep) {
   const angle=M.sweepAngle(a.p,a.time);
   a.pause();a.p.angleSweep=false;
   a.p.inclineAngle=angle;a.reset();a.sync();
  } else {
   a.pause();a.p.angleSweep=true;a.reset();a.sync();a.play();
  }
 }
 window.lesson=new Classroom({
  title:'力的分解：斜面與單擺的受力與重力分量', defaults,
  controls:[
   {key:'scenario',label:'選擇情境',type:'select',options:[['incline','斜面上的物體'],['pendulum','單擺']]},
   {key:'decompose',label:'分解重力',type:'check',display:true},
   {key:'mass',label:'物體質量 m',min:.5,max:5,step:.5,unit:'kg'},
   {key:'inclineAngle',label:'斜面傾角 θ',min:0,max:70,step:.1,digits:1,unit:'°',disabled:p=>p.angleSweep},
   {key:'muS',label:'靜摩擦係數 μₛ',min:0,max:1,step:.05,unit:''},
   {key:'muK',label:'動摩擦係數 μₖ',min:0,max:1,step:.05,unit:''},
   {key:'pendulumAngle',label:'初始擺角 θ₀',min:-70,max:70,step:1,unit:'°'},
   {key:'length',label:'繩長 L',min:.5,max:3,step:.1,unit:'m'},
   {key:'showWeight',label:'顯示重力 W',type:'check',display:true},
   {key:'showSupport',label:'顯示正向力／繩張力',type:'check',display:true},
   {key:'showFriction',label:'顯示摩擦力 f',type:'check',display:true},
   {key:'axes',label:'顯示分解方向輔助軸',type:'check',display:true}
  ],
  normalize(p,key){
   if(p.angleSweep && ['scenario','mass','inclineAngle','muS','muK','pendulumAngle','length'].includes(key)) {
    if(key!=='inclineAngle')p.inclineAngle=window.lesson?.displayedInclineAngle??M.sweepAngle(p,0);
    p.angleSweep=false;
   }
   if(p.muK>p.muS){if(key==='muK')p.muS=p.muK;else p.muK=p.muS;}
  },
  state:M.state, duration:M.duration, step:.05,
  views:[{label:'情境受力圖',draw:(a,s)=>draw(a,s)},{label:'獨立受力圖',draw:(a,s)=>draw(a,s,true)}],
  metrics:(p,s)=>s.kind==='pendulum'?
   [['重力 W',s.weight.toFixed(2),'N'],['繩張力 T',s.tension.toFixed(2),'N'],['速率',s.speed.toFixed(2),'m/s'],['當前擺角 θ',(s.theta*180/Math.PI).toFixed(1),'°']]:
   [['重力 W',s.weight.toFixed(2),'N'],['正向力 N',s.normal.toFixed(2),'N'],[s.stuck?'靜摩擦力 fₛ':'動摩擦力 fₖ',s.friction.toFixed(2),'N'],['沿斜面加速度',s.acceleration.toFixed(2),'m/s²']],
  actions:[{label:'開始逐漸改變角度',run:toggleAngleSweep,
   disabled:a=>a.p.scenario!=='incline'||a.state.phase==='sliding'}],
  note:(p,s)=>s.sweeping?
   '正以 3°/s 增加傾角；臨界角約 '+s.criticalAngle.toFixed(2)+'°。超過最大靜摩擦力後，自動固定角度並下滑。':
   s.phase==='sliding'?
   '已突破靜摩擦上限，傾角固定於 '+s.stopAngle.toFixed(2)+'°；下滑 '+s.slideTime.toFixed(2)+' s，位移 '+s.distance.toFixed(2)+' m。視角跟隨物體。':
   s.kind==='pendulum'?
   'θ 以鉛直向下為 0°；張力含向心運動所需的作用。力箭頭共用比例，隨設定自動縮放。':
   (s.stuck?'保持靜止：fₛ ≤ μₛN。':'向下滑動：fₖ = μₖN；位移 '+s.distance.toFixed(2)+' m。')+(s.stuck?' W 從 C 出發；N、f 從 P 出發，三作用線交於 P。':' W 從 C 出發；N、f 從 Q 出發，滑動時三作用線不必共點。'),
  presets:[
   {label:'① 斜面：靜摩擦平衡',values:{decompose:true},question:'30° 斜面上，摩擦力等於 μₛN 嗎？哪些力互相平衡？',answer:'靜摩擦力為 9.80 N，小於上限約 10.18 N；它平衡沿斜面的重力分量。正向力平衡垂直斜面的重力分量。'},
   {label:'② 只增加斜面角度',values:{inclineAngle:45,decompose:true},question:'只把斜面從 30° 調成 45°，為何物體開始下滑？',answer:'沿斜面的重力分量變大、正向力變小，所需靜摩擦力超過上限；下滑後改由動摩擦力阻礙運動。'},
   {label:'③ 水平面：摩擦力為零',values:{inclineAngle:0,decompose:true},question:'表面粗糙，物體就一定受到摩擦力嗎？',answer:'沒有水平外力，也沒有滑動或滑動趨勢，因此摩擦力為零。重力與正向力平衡。'},
   {label:'④ 單擺：張力會改變',values:{scenario:'pendulum',pendulumAngle:35,decompose:true},question:'從右側釋放後，最低點的張力會等於重力嗎？',answer:'最低點有速率，需要向上的向心加速度，因此 T = mg + mv²/L > mg；最高點速率為零，T = mg cosθ。'},
   {label:'⑤ 單擺：從左側釋放',values:{scenario:'pendulum',pendulumAngle:-35,decompose:true},question:'改從左側釋放，垂直繩子的重力分量會指向哪一邊？',answer:'垂直繩子的重力分量沿擺動切線朝最低點方向；左右兩側方向相反。張力始終指向懸點，重力始終鉛直向下。'}
  ]
 });
 // Keep the angle action beside the views, reachable while the parameter panel is closed.
 const sweepButton=document.querySelector('[data-action="0"]');
 sweepButton.id='angleSweep';
 sweepButton.title='從目前角度以 3°/s 增加，突破最大靜摩擦力後自動固定角度並下滑';
 document.querySelector('.lesson-views').append(sweepButton);
 window.lesson.render();
})();

