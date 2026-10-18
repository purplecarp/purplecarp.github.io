(() => {
 'use strict';
 const M=PhysicsModel,C=LessonColors;
 function drawScene(a,s){
  const end=M.state(a.p,M.DURATION),left=Math.min(-300,300,end.sx,end.ox)-160,right=Math.max(-300,300,end.sx,end.ox)+160;
  const scale=(a.width-48)/(right-left),X=x=>24+(x-left)*scale,Y=y=>a.height*.5+y*scale;
  const ctx=a.ctx;
  // Real spatial scale is shared by x, y and all wavefront radii.
  ctx.save();ctx.beginPath();ctx.rect(0,88,a.width,Math.max(1,a.height-145));ctx.clip();
  a.line(0,Y(s.sy),a.width,Y(s.sy),C.grid,1,[6,8]);
  a.line(0,Y(s.oy),a.width,Y(s.oy),C.grid,1,[6,8]);
  if(a.p.waves){
   ctx.lineWidth=1.5;ctx.strokeStyle=C.blue;ctx.globalAlpha=.45;
   for(const w of M.wavefronts(a.p,s.t)){
    ctx.beginPath();ctx.arc(X(w.x),Y(w.y),w.radius*scale,0,Math.PI*2);ctx.stroke();
   }
   ctx.globalAlpha=1;
  }
  if(a.p.ray){
   a.line(X(s.emissionX),Y(s.sy),X(s.ox),Y(s.oy),C.yellow,2,[6,6]);
   a.dot(X(s.emissionX),Y(s.sy),4,C.yellow);
  }
  ctx.restore();
  a.text('聲源 S',16,30,C.blue,24);
  a.text('觀察者 O',a.width-16,30,C.green,24,'right');
  a.text(`接收 ${s.frequency.toFixed(1)} Hz`,a.width/2,69,C.green,32,'center');
  a.dot(X(s.sx),Y(s.sy),13,C.blue);a.dot(X(s.ox),Y(s.oy),11,C.green);
  const labelX=x=>Math.max(28,Math.min(a.width-28,x));
  a.text('S',labelX(X(s.sx)),Y(s.sy)-23,C.blue,24,'center');
  a.text('O',labelX(X(s.ox)),Y(s.oy)+40,C.green,24,'center');
  if(a.p.vectors){
   const vectorScale=Math.min(.28,(4+160*scale)/200);
   a.arrow(X(s.sx)+Math.sign(s.vs)*18,Y(s.sy),s.vs*vectorScale,0,C.blue);
   a.arrow(X(s.ox)+Math.sign(s.vo)*16,Y(s.oy),s.vo*vectorScale,0,C.green);
  }
  const meters=(right-left)>1700?500:100,bar=meters*scale;
  a.line(20,a.height-35,20+bar,a.height-35,C.ink,3);
  a.text(`${meters} m`,20,a.height-9,C.ink,24);
  const label=s.ratio>1.002?'音高升高':s.ratio<.998?'音高降低':'接近原音';
  a.text(label,a.width-16,a.height-18,s.ratio>1.002?C.orange:C.green,24,'right');
 }
 function drawFrequency(a,s){
  const ctx=a.ctx,l=76,r=a.width-20,top=60,b=a.height-55;
  const font=a.width<420?16:20;
  const data=Array.from({length:241},(_,i)=>M.state(a.p,i*M.DURATION/240));
  const max=Math.max(...data.map(x=>Math.max(x.sourceFrequency,x.frequency)))*1.15;
  const X=t=>l+t/M.DURATION*(r-l),Y=f=>b-f/max*(b-top);
  a.text('頻率 (Hz)',14,28,C.ink,font);
  a.text(`${s.frequency.toFixed(1)} Hz`,r,28,C.green,font,'right');
  a.text('原音',l,51,C.blue,14);a.text('接收',l+55,51,C.green,14);
  for(let i=0;i<=2;i++){
   const f=max*i/2,y=Y(f);a.line(l,y,r,y,C.grid);
   a.text(f.toFixed(0),l-8,y+7,C.ink,font,'right');
   const t=M.DURATION*i/2,x=X(t);a.line(x,top,x,b,C.grid);
   a.text(String(t),x,b+29,C.ink,font,'center');
  }
  a.text('t (s)',r,a.height-4,C.ink,font,'right');
  a.line(l,top,l,b,C.ink);a.line(l,b,r,b,C.ink);
  ctx.strokeStyle=C.blue;ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.beginPath();
  data.forEach((d,i)=>i?ctx.lineTo(X(d.t),Y(d.sourceFrequency)):ctx.moveTo(X(d.t),Y(d.sourceFrequency)));
  ctx.stroke();ctx.setLineDash([]);
  const visible=data.filter(d=>d.t<s.t);visible.push(s);
  const crossing=s.vs>s.vo?600/(s.vs-s.vo):Infinity;
  if(a.p.offset===0 && crossing<=s.t){
   // End the approach branch at its left limit; do not interpolate across the jump.
   const before=M.state(a.p,crossing-1e-7);
   visible.push({...before,t:crossing,leftLimit:true});
   if(!visible.some(d=>d.t===crossing&&!d.leftLimit))visible.push(M.state(a.p,crossing));
   visible.sort((a,b)=>a.t-b.t || Number(Boolean(b.leftLimit))-Number(Boolean(a.leftLimit)));
  }
  a.line(X(s.t),top,X(s.t),b,C.yellow,1,[4,4]);
  ctx.strokeStyle=C.green;ctx.lineWidth=3;ctx.beginPath();
  visible.forEach((d,i)=>{
   const newBranch=i===0 || (a.p.offset===0 && d.t===crossing && !d.leftLimit);
   if(newBranch)ctx.moveTo(X(d.t),Y(d.frequency));else ctx.lineTo(X(d.t),Y(d.frequency));
  });ctx.stroke();
  a.dot(X(s.t),Y(s.frequency),6,C.green);
 }
 class DopplerLesson extends Classroom {
  play(){
   super.play();
   if(!this.p.soundEnabled||!this.audio)return;
   this.audioError=false;
   // Start/resume only in a playback gesture; async completion never restarts a paused lesson.
   this.audio.enable().then(()=>this.render()).catch(error=>{
    this.audio.disable();this.audioError=true;this.$('soundStatus').textContent=error.message;this.render();
   });
  }
  render(){
   super.render();
   if(!this.audio)return;
   this.audio.update(this.p,this.state,this.running,document.hidden);
   const button=this.$('soundToggle'),status=this.$('soundStatus');
   button.textContent=this.p.soundEnabled?'關閉聲音':'開啟聲音';
   button.setAttribute('aria-pressed',String(this.p.soundEnabled));
   if(!this.audioError){
    const which=this.p.soundMode==='source'?'聲源原音':'觀察者接收音';
    const type=this.p.soundType==='ambulance'?'救護車警笛':'純音';
    const text=this.p.soundEnabled?(this.running&&this.audio.context?.state==='running'?`正在播放${type}（${which}）；音量 ${this.p.volume}%`:'聲音已開啟；按「播放」發聲，暫停時靜音。'):'聲音已關閉。';
    if(status.textContent!==text)status.textContent=text;
   }
  }
 }
 const lesson=new DopplerLesson({
  title:'都卜勒效應的移動聲源、觀察者與波前',
  defaults:{mode:'source',frequency:440,sourceSpeed:100,observerSpeed:-100,offset:0,waves:true,vectors:true,ray:false,soundMode:'observer',soundType:'ambulance',soundEnabled:true,volume:20,speed:1},
  controls:[
   {key:'mode',label:'移動方式',type:'select',options:[['source','聲源移動／觀察者靜止'],['observer','觀察者移動／聲源靜止'],['both','兩者都移動'],['stationary','兩者都靜止']]},
   {key:'soundType',label:'聲音種類',type:'select',options:[['ambulance','救護車警笛'],['tone','純音（固定頻率）']]},
   {key:'frequency',label:'聲源基準頻率 f₀',min:100,max:1000,step:10,unit:'Hz'},
   {key:'sourceSpeed',label:'聲源速度（右為正）',min:-200,max:200,step:10,unit:'m/s',disabled:p=>p.mode==='observer'||p.mode==='stationary'},
   {key:'observerSpeed',label:'觀察者速度（右為正）',min:-200,max:200,step:10,unit:'m/s',disabled:p=>p.mode==='source'||p.mode==='stationary'},
   {key:'offset',label:'兩條路徑的間隔',min:0,max:200,step:10,unit:'m'},
   {key:'soundMode',label:'聆聽對象',type:'select',display:true,options:[['observer','觀察者聽到的聲音'],['source','聲源原音（比較）']]},
   {key:'volume',label:'音量',min:0,max:100,step:5,unit:'%',display:true},
   {key:'waves',label:'顯示抽樣波前',type:'check',display:true},
   {key:'vectors',label:'顯示速度箭頭（同一比例）',type:'check',display:true},
   {key:'ray',label:'顯示接收聲音的傳播路徑',type:'check',display:true}
  ],
  state:M.state,duration:()=>M.DURATION,step:.05,
  views:[{label:'波前與運動',draw:drawScene}],
  comparisonLayout:'paired',
  comparisonTitle:'觀察者接收頻率與時間',
  comparisonViews:[{label:'綠線：接收頻率；藍虛線：聲源原頻率',draw:drawFrequency}],
  metrics:(p,s)=>[['聲源此刻頻率',s.sourceFrequency.toFixed(1),'Hz'],['觀察者聽到',s.frequency.toFixed(1),'Hz'],['都卜勒頻移比',s.ratio.toFixed(3),'f觀 / 發聲時頻率'],['傳播延遲',s.delay.toFixed(3),'s']],
  note:()=> '聲速 343 m/s；每圈抽樣 100 週期；聲音播放真實 Hz。向右為正，12 s 後演示結束。',
  onReset:a=>{a.audio?.silence();a.audioError=false;},
  presets:[
   {label:'① 聲源駛近，再經過',values:{},question:'聲源從左側接近，經過觀察者後遠離。試聽並觀察頻率如何改變？',answer:'接近時波前較密、接收頻率較高；遠離時較低。間隔為 0 時，交會前後的頻率跳變；增加間隔後，音高平滑變化。'},
   {label:'② 只改為觀察者移動',values:{mode:'observer'},question:'接近速率同為 100 m/s，改成觀察者移動，接收頻率會完全相同嗎？',answer:'不會。聲源移動改變空氣中的波長；觀察者移動改變遇到波前的速率。兩者的都卜勒公式不同。'},
   {label:'③ 同向同速',values:{mode:'both',sourceSpeed:100,observerSpeed:100},question:'兩者相對空氣都在移動，但同向同速，還會有頻率差嗎？',answer:'沒有都卜勒頻移。兩者距離保持固定；警笛仍會升降音高，接收的是傳播延遲之前的聲源頻率。'},
   {label:'④ 兩者相向移動',values:{mode:'both'},question:'聲源向右、觀察者向左時，頻率偏移會比只移動一方更大嗎？',answer:'接近時兩項效應一起提高接收頻率；經過彼此後，接收頻率轉為降低。'},
   {label:'⑤ 兩者靜止',values:{mode:'stationary'},question:'只有聲波在傳播時，觀察者聽到多少 Hz？',answer:'兩者速度皆為零，沒有都卜勒頻移。純音為 440 Hz；救護車警笛在 440–660 Hz 間變化，觀察者延遲聽見。'}
  ]
 });
 window.lesson=lesson;
 const bar=document.createElement('div');bar.className='audio-bar';
 bar.innerHTML='<button id="soundToggle" aria-pressed="true">關閉聲音</button><p id="soundStatus" role="status"></p>';
 document.querySelector('.lesson-toolbar').after(bar);
 lesson.audio=new DopplerAudio();
 lesson.$('soundToggle').onclick=async()=>{
  lesson.audioError=false;
  lesson.p.soundEnabled=!lesson.p.soundEnabled;
  if(!lesson.p.soundEnabled)lesson.audio.disable();else lesson.play();
  lesson.render();
 };
 window.addEventListener('pagehide',()=>{lesson.pause();lesson.audio.disable();});
 lesson.render();
})();
