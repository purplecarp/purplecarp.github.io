(() => {
 const M=PhysicsModel,C=LessonColors,experiment=new M.Experiment();
 const color=lambda=>lambda<380?'#b69cff':lambda<490?'#72aaff':lambda<570?'#83dfac':lambda<620?'#efdb72':'#ff8f9e';
 function draw(a,s){
  const W=a.width,H=a.height,p=a.p,sx=W*.16,sy=H*.2,ex=W*.46,ey=H*.73;
  a.text(p.mode==='all'?'所有波段：200–800 nm':p.mode==='white'?'白光：380–750 nm':`單色光：${p.wavelength} nm`,16,30,C.ink,W<500?20:24);
  a.ctx.fillStyle='#718aa4';a.ctx.fillRect(sx-24,sy-15,48,30);a.text('光源',sx,sy+43,C.ink,20,'center');
  a.line(sx,sy,ex,ey,'#354a61',2,[6,6]);
  for(const photon of s.photons){const progress=(s.t-photon.born)/.45;a.dot(sx+(ex-sx)*progress,sy+(ey-sy)*progress,5,color(photon.lambda));}
  const metalY=H*.74;a.ctx.fillStyle='#b3bec9';a.ctx.fillRect(W*.22,metalY,W*.6,23);a.text(`${p.metal}：φ = ${s.phi.toFixed(2)} eV`,W*.52,metalY+54,C.ink,W<500?18:24,'center');
  const emitted=s.activeElectrons;
  for(const e of emitted){const age=s.t-e.emittedAt;const velocity=55*Math.sqrt(e.energy),angle=-Math.PI/2+(((e.index*.31)%1)-.5)*.7,x=ex+Math.cos(angle)*velocity*age,y=metalY-5+Math.sin(angle)*velocity*age;if(y>45)a.dot(x,y,5,C.blue);}
  a.text(s.emitting?'光子能量足夠：可產生光電子':p.intensity===0?'光源關閉：無入射光子':'光子能量不足：無光電子',W/2,H-14,s.emitting?C.green:C.red,W<500?16:21,'center');
 }
 // Approximate visible-light colors; use the lesson's 380–750 nm spectrum.
 function pointColor(lambda){
  if(lambda<380||lambda>750)return '#000000';
  let r=0,g=0,b=0;
  if(lambda<440){r=(440-lambda)/60;b=1;}
  else if(lambda<490){g=(lambda-440)/50;b=1;}
  else if(lambda<510){g=1;b=(510-lambda)/20;}
  else if(lambda<580){r=(lambda-510)/70;g=1;}
  else if(lambda<645){r=1;g=(645-lambda)/65;}
  else r=1;
  return '#'+[r,g,b].map(v=>Math.round(255*v).toString(16).padStart(2,'0')).join('');
 }
 function chart(a,s){
  const series=[];
  if(a.p.theory){const f=s.threshold;series.push({color:C.red,dash:[7,6],data:[{x:0,y:-s.phi},{x:f,y:0}]},{color:C.green,data:[{x:f,y:0},{x:1600,y:M.H*1600e12-s.phi}]});}
  const points=s.data.map(e=>({x:e.frequency,y:e.energy,color:pointColor(e.lambda),stroke:e.lambda<380||e.lambda>750?C.ink:undefined}));
  for(const r of a.records)if(r.metal===a.p.metal)points.push({x:r.frequency,y:r.maxKE,color:pointColor(r.wavelength),radius:7,stroke:C.ink});
  a.graph({xmax:1600,ymin:-6,ymax:5,xlabel:'光頻率 f (THz)',ylabel:'電子動能 (eV)',series,points});
 }
 window.lesson=new Classroom({title:'光電效應模擬器',defaults:{wavelength:250,intensity:60,metal:'Cs',mode:'laser',theory:false,speed:1},
 controlsHelp:'單色光波長可在播放中即時調整，不暫停或重設時間，已有數據保留；光源模式、強度與金屬改變後回到起點。',
 controls:[{key:'mode',label:'光源模式',type:'select',options:[['laser','單色光'],['white','白光（380–750 nm）'],['all','所有波段（200–800 nm）']]},{key:'wavelength',label:'波長 λ',min:200,max:800,step:1,unit:'nm',live:true,disabled:p=>p.mode!=='laser'},{key:'intensity',label:'光強度',min:0,max:100,step:1,unit:'%'},{key:'metal',label:'金屬（功函數 φ）',type:'select',clearRecords:true,options:Object.entries(M.metals).map(([key,value])=>[key,`${key}：${value.toFixed(2)} eV`])},{key:'theory',label:'最大動能理論線',type:'check',display:true}],
 state:(p,t)=>({...M.state(p,t),...experiment.update(p,t)}),onReset:()=>experiment.reset(),duration:()=>12,infinitePlayback:true,views:[{label:'光電子演示',draw}],
 comparisonLayout:'side',comparisonTitle:'動能－頻率同步對照',
 comparisonViews:[{label:'點色對應入射色光；黑點：不可見光；外框大點：記錄的 Kmax',draw:chart}],
 metrics:(p,s)=>[['入射光子能量',p.mode!=='laser'?`${s.minEnergy.toFixed(2)}–${s.energy.toFixed(2)}`:s.energy.toFixed(2),'eV'],['功函數 φ',s.phi.toFixed(2),'eV'],['最大動能 Kmax',s.maxKE.toFixed(2),'eV（有入射光時）'],['截止頻率',s.threshold.toFixed(0),'THz']],
 note:()=> '無限播放；數據保留產生時的波長與動能，重播開始新一輪實驗。粒子數量與飛行時間為示意；動能由 hf − φ 計算。強度改變不影響最大動能。',
 actions:[{label:'記錄本次最大動能',disabled:a=>a.p.mode!=='laser'||!a.state.emitting,run:a=>{const s=a.state;if(a.p.mode==='laser'&&s.emitting){a.records.push({metal:a.p.metal,wavelength:a.p.wavelength,intensity:a.p.intensity,frequency:s.frequency,maxKE:s.maxKE});if(a.records.length>100)a.records.shift();}}},{label:'清空已記錄數據',run:a=>{a.records=[];experiment.clearData(a.time);}}],
 presets:[{label:'① 短波長，觀察出射',values:{},question:'把光強度降低，單顆光子的能量會變小嗎？',answer:'不會。相同波長的光子能量不變，強度主要影響數量。'},
 {label:'② 只增加光強度',values:{intensity:100},question:'強度增加後，最大動能會增加嗎？',answer:'光子與光電子數量增加，但 Kmax 不變。'},
 {label:'③ 長波長也加強光',values:{wavelength:700,intensity:100},question:'光子能量低於功函數，增加強度能打出電子嗎？',answer:'理想單光子光電效應中不能；必須提高頻率，使 hf 超過功函數。'}]});
})();
