/* Copy this config and replace the example model and drawing for a new lesson.
 * Draw in CSS pixels. Classroom owns resize, DPR, playback and all event handlers.
 * display:true means a control redraws without resetting physical time.
 */
(() => {
 const C=LessonColors,M=PhysicsModel;
 function draw(a,s){
  const end=M.state(a.p,a.duration),min=Math.min(a.p.x0,end.x)-3,max=Math.max(a.p.x0,end.x)+3;
  const X=x=>50+(x-min)/(max-min)*(a.width-100),y=a.height*.52;
  a.text('等速直線運動',16,30,C.ink,24);
  a.line(25,y,a.width-25,y,C.ink);
  if(a.p.trail)for(let t=0;t<=s.t+1e-9;t+=.1)a.dot(X(M.state(a.p,t).x),y,3,C.blue);
  a.dot(X(s.x),y,15,C.blue);
  if(a.p.vectors)a.arrow(X(s.x),y-48,s.v*15,0,C.orange,'v');
  a.text(`x = ${s.x.toFixed(2)} m`,a.width/2,y+55,C.ink,24,'center');
 }
 window.lesson=new Classroom({
  title:'等速運動',
  defaults:{x0:0,velocity:2,trail:true,vectors:true,speed:1},
  controls:[
   {key:'x0',label:'初始位置 x₀',min:-5,max:5,step:.5,unit:'m'},
   {key:'velocity',label:'速度 v',min:-5,max:5,step:.5,unit:'m/s'},
   {key:'trail',label:'等時距軌跡',type:'check',display:true},
   {key:'vectors',label:'速度向量',type:'check',display:true}
  ],
  state:M.state,
  duration:()=>10,
  step:.05,
  views:[
   {label:'運動演示',draw},
   {label:'位置－時間',draw:(a,s)=>{const end=M.state(a.p,a.duration);a.graph({xmax:a.duration,ymin:Math.min(a.p.x0,end.x)-2,ymax:Math.max(a.p.x0,end.x)+2,ylabel:'x (m)',series:[{color:C.blue,data:[{x:0,y:a.p.x0},{x:s.t,y:s.x}]}]});}}
  ],
  metrics:(p,s)=>[['時間',s.t.toFixed(2),'s'],['位置',s.x.toFixed(2),'m'],['速度',s.v.toFixed(2),'m/s'],['加速度',s.a.toFixed(2),'m/s²']],
  note:()=> '向右為正；模型假設無外力。軌跡每 0.1 s 取樣。',
  presets:[
   {label:'① 向右等速',values:{},question:'相同時間間隔內，位移是否相等？',answer:'速度固定，因此等時間內位移相同。'},
   {label:'② 只反轉速度',values:{velocity:-2},question:'速度變成負值後，位置－時間圖的斜率如何改變？',answer:'斜率變成負值，代表物體向左移動。'},
   {label:'③ 速度為零',values:{velocity:0},question:'速度為零時，位置會改變嗎？',answer:'位置固定，位置－時間圖為水平線。'}
  ]
 });
})();
