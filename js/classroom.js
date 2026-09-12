/* Reusable classroom shell. Each lesson supplies a pure state(p,t) and drawing functions. */
(() => {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palette = { blue:'#62b9fa', orange:'#ffb66a', green:'#65dcaf', red:'#ff8f9e', yellow:'#efdb72', ink:'#b9ccdf', grid:'#283c52' };
  class Classroom {
    constructor(config) {
      this.config = config;
      this.playbackMode = 'infinite';
      this.p = { ...config.defaults }; this.time = 0; this.running = false; this.frame = null; this.previous = null;
      this.view = 0; this.large = false; this.records = []; this.presetIndex = 0;
      const controls = [...config.controls, {key:'speed',label:'播放速度',min:0.25,max:2,step:0.25,unit:'×',display:true}];
      this.controls = controls;
      document.getElementById('lesson').innerHTML = `
        <div class="lesson-grid"><section class="lesson-panel lesson-stage" aria-label="運動演示">
        <div class="lesson-toolbar"><button id="play" class="primary">▶ 開始</button>${config.playbackPeriod?`<select id="playbackMode" aria-label="播放週期"><option value="infinite">無限播放</option><option value="1">一個週期</option><option value="3">三個週期</option></select>`:''}<button id="step">單步</button><button id="reset">↻ 重播</button>
        <div class="tools"><button id="presentation" aria-pressed="false">課堂演示</button><button id="controlToggle" aria-expanded="true" aria-controls="controls">參數</button><button id="large" aria-pressed="false">大字</button><button id="fullscreen">全螢幕</button></div></div>
        <div class="lesson-views" ${config.views.length===1?'hidden':''} aria-label="圖表選擇">${config.views.map((v,i)=>`<button data-view="${i}" aria-pressed="${i===0}">${escape(v.label)}</button>`).join('')}</div>
        <div class="canvas-box"><canvas id="scene" role="img" aria-label="${escape(config.title)}；即時數據列於下方"></canvas></div>
        <div class="lesson-timeline"><label for="time">時間 <output id="timeValue"></output></label><input id="time" type="range" min="0" max="1000" step="1" value="0"><span id="duration"></span></div>
        ${config.comparisonViews?.length?`<section class="lesson-comparisons" aria-label="${escape(config.comparisonTitle||'同步時間對照圖')}"><h2>${escape(config.comparisonTitle||'x–t、v–t、a–t 同步對照')}</h2><div class="comparison-grid">${config.comparisonViews.map((v,i)=>`<div class="comparison-chart"><h3>${escape(v.label)}</h3><div class="comparison-canvas-box"><canvas id="comparison-${i}" role="img" aria-label="${escape(v.label)}；與模擬同步，即時數據列於模擬區"></canvas></div></div>`).join('')}</div></section>`:''}
        <div class="lesson-readouts" aria-label="即時數據"></div><p class="lesson-status" id="status" role="status"></p>
        </section><aside class="lesson-panel lesson-controls" id="controls" aria-label="實驗參數"><h2>實驗設定</h2><p class="help">${escape(config.controlsHelp||'物理參數改變後回到起點；速度與顯示選項保留進度。')}</p>
        ${controls.map(c=>this.controlHTML(c)).join('')}
        <div class="lesson-presets"><h3>預測與比較</h3>${config.presets.map((p,i)=>`<button data-preset="${i}">${escape(p.label)}</button>`).join('')}<button id="defaults">恢復預設</button>${(config.actions||[]).map((a,i)=>`<button data-action="${i}">${escape(a.label)}</button>`).join('')}</div>
        <div class="question-box"><p id="question"></p><button id="reveal">揭示結論</button><p id="answer" hidden></p></div></aside></div>`;
      if(config.comparisonLayout==='side' && config.comparisonViews?.length){
        const grid=document.querySelector('.lesson-grid'),charts=grid.querySelector('.lesson-comparisons');
        grid.classList.add('comparisons-side');
        charts.classList.add('lesson-panel');
        grid.insertBefore(charts,document.getElementById('controls'));
      }
      if(config.comparisonLayout==='paired' && config.comparisonViews?.length){
        const stage=document.querySelector('.lesson-stage'),scene=stage.querySelector('.canvas-box'),charts=stage.querySelector('.lesson-comparisons');
        const pair=document.createElement('div'),primary=document.createElement('section'),heading=document.createElement('h2');
        pair.className='lesson-paired-views';
        primary.className='paired-primary';
        heading.textContent=config.views[0].label;
        stage.insertBefore(pair,scene);
        primary.append(heading,scene);
        pair.append(primary,charts);
        this.view=0;
      }
      this.canvas = document.getElementById('scene'); this.ctx = this.canvas.getContext('2d');
      this.comparisons = (config.comparisonViews||[]).map((view,i)=>{const canvas=document.getElementById(`comparison-${i}`);return {view,canvas,ctx:canvas.getContext('2d')};});
      this.$ = id => document.getElementById(id);
      this.$('play').onclick = () => this.running ? this.pause() : this.play();
      if(config.playbackPeriod)this.$('playbackMode').onchange=e=>{this.playbackMode=e.target.value;this.reset();};
      this.$('reset').onclick = () => this.reset();
      this.$('step').onclick = () => { this.pause(); this.time = this.unlimited ? this.time + this.stepSize : Math.min(this.duration, this.time + this.stepSize); this.render(); };
      this.$('time').oninput = e => { const nextTime = Number(e.target.value)/1000*this.duration; this.pause(); this.time = nextTime; this.render(); };
      this.$('defaults').onclick = () => { this.p = {...config.defaults}; this.records=[]; this.presetIndex=0; this.reset(); this.sync(); };
      controls.forEach(c=>{
        const input=this.$(c.key);
        input.addEventListener(c.type==='check'||c.type==='select'?'change':'input',()=>{
          this.p[c.key]=c.type==='check'?input.checked:c.type==='select'?input.value:Number(input.value);
          if(config.normalize) config.normalize(this.p,c.key);
          if(!c.display&&!c.live) { this.reset(); if(c.clearRecords) this.records=[]; }
          if(!c.live)this.previous=null; this.sync(); this.render();
        });
      });
      document.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>{const input=this.$(b.dataset.adjust); if(input.disabled)return; b.dataset.direction==='1'?input.stepUp():input.stepDown(); input.dispatchEvent(new Event('input'));});
      document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{this.view=Number(b.dataset.view); document.querySelectorAll('[data-view]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));this.render();});
      document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{this.presetIndex=Number(b.dataset.preset);this.p={...config.defaults,...config.presets[this.presetIndex].values};if(config.normalize)config.normalize(this.p,'preset');this.records=[];this.reset();this.sync();});
      document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{config.actions[Number(b.dataset.action)].run(this);this.render();});
      this.$('reveal').onclick=()=>{this.$('answer').hidden=!this.$('answer').hidden;this.$('reveal').textContent=this.$('answer').hidden?'揭示結論':'收起結論';};
      this.$('controlToggle').onclick=()=>{const hide=!this.$('controls').hidden;this.$('controls').hidden=hide;document.querySelector('.lesson-grid').classList.toggle('controls-hidden',hide);this.$('controlToggle').setAttribute('aria-expanded',String(!hide));};
      this.$('presentation').onclick=()=>{const active=document.body.classList.toggle('is-presenting');this.$('presentation').textContent=active?'詳細說明':'課堂演示';this.$('presentation').setAttribute('aria-pressed',String(active));};
      this.$('large').onclick=()=>{this.large=!this.large;document.body.classList.toggle('large-type',this.large);this.$('large').setAttribute('aria-pressed',String(this.large));this.render();};
      this.$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('unsupported');}catch{this.$('fullscreen').textContent='使用演示模式';if(!document.body.classList.contains('is-presenting'))this.$('presentation').click();}};
      document.addEventListener('fullscreenchange',()=>{this.$('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕';});
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
      new ResizeObserver(()=>this.resize()).observe(this.canvas.parentElement);
      this.comparisons.forEach(chart=>new ResizeObserver(()=>this.render()).observe(chart.canvas.parentElement));
      window.addEventListener('resize',()=>this.resize());
      if(config.normalize)config.normalize(this.p,'init');this.sync();this.resize();
    }
    controlHTML(c) {
      const label=escape(c.label),key=escape(c.key);
      if(c.type==='check')return `<div class="lesson-control"><label for="${key}">${label}<input id="${key}" type="checkbox"></label></div>`;
      if(c.type==='select')return `<div class="lesson-control"><label for="${key}">${label}</label><select id="${key}">${c.options.map(o=>`<option value="${escape(o[0])}">${escape(o[1])}</option>`).join('')}</select></div>`;
      return `<div class="lesson-control"><label for="${key}">${label}<output id="${key}Value" for="${key}"></output></label><div class="range-controls"><button data-adjust="${key}" data-direction="-1" aria-label="減少${label}">−</button><input id="${key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}"><button data-adjust="${key}" data-direction="1" aria-label="增加${label}">＋</button></div></div>`;
    }
    get unlimited(){return Boolean(this.config.infinitePlayback) || (Boolean(this.config.playbackPeriod) && this.playbackMode==='infinite');}
    get duration(){
      if(this.config.infinitePlayback){
        const span=this.config.duration(this.p);
        return span*(Math.floor(this.time/span)+1);
      }
      if(!this.config.playbackPeriod)return this.config.duration(this.p);
      const period=this.config.playbackPeriod(this.p);
      // Infinite playback keeps cumulative time; extend the visible range in three-period blocks.
      return this.unlimited ? 3*period*(Math.floor(this.time/(3*period))+1) : Number(this.playbackMode)*period;
    }
    get stepSize(){return this.config.step||0.05;}
    get state(){return this.config.state(this.p,this.time);}
    sync(){
      for(const c of this.controls){const input=this.$(c.key);if(c.type==='check')input.checked=this.p[c.key];else input.value=this.p[c.key];const disabled=c.disabled?c.disabled(this.p):false;input.disabled=disabled;document.querySelectorAll(`[data-adjust="${c.key}"]`).forEach(b=>b.disabled=disabled);if(this.$(c.key+'Value'))this.$(c.key+'Value').textContent=`${Number(this.p[c.key]).toFixed(c.digits??(c.step<1?2:0))} ${c.unit||''}`;}
      const preset=this.config.presets[this.presetIndex];this.$('question').textContent=preset.question;this.$('answer').textContent=preset.answer;this.$('answer').hidden=true;this.$('reveal').textContent='揭示結論';
    }
    play(){if(this.running)return;if(this.time>=this.duration)this.time=0;this.running=true;this.previous=null;this.frame=requestAnimationFrame(t=>this.tick(t));this.render();}
    pause(){this.running=false;cancelAnimationFrame(this.frame);this.frame=null;this.previous=null;this.render();}
    reset(){this.pause();this.time=0;if(this.config.onReset)this.config.onReset(this);this.render();}
    tick(timestamp){
      if(!this.running)return;
      if(this.previous!==null){
        const next=this.time+Math.min((timestamp-this.previous)/1000,.1)*this.p.speed*(this.config.timeRate?this.config.timeRate(this.p):1);
        this.time=this.unlimited?next:Math.min(this.duration,next);
      }
      this.previous=timestamp;
      if(!this.unlimited && this.time>=this.duration){this.running=false;this.previous=null;}
      this.render();if(this.running)this.frame=requestAnimationFrame(t=>this.tick(t));
    }
    resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.width=r.width;this.height=r.height;const dpr=window.devicePixelRatio||1;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.render();}
    render(){if(!this.ctx||!this.width)return;const s=this.state,unit=this.config.timeUnit||'s';document.querySelectorAll('[data-action]').forEach(b=>{const action=this.config.actions[Number(b.dataset.action)];b.disabled=action.disabled? action.disabled(this):false;});this.$('timeValue').textContent=`${this.time.toFixed(2)} ${unit}`;this.$('duration').textContent=`${this.duration.toFixed(2)} ${unit}`;this.$('time').value=this.time/this.duration*1000;this.$('time').setAttribute('aria-valuetext',`${this.time.toFixed(2)} ${unit}`);this.$('play').textContent=this.running?'Ⅱ 暫停':this.time>=this.duration?'↻ 再播放':'▶ 播放';this.$('step').disabled=this.running||this.time>=this.duration;this.$('step').textContent=`+ ${this.stepSize} ${unit==='s'?'s':unit==='ns'?'ns':''}`;this.$('step').title=`前進 ${this.stepSize} ${unit}`;this.$('step').setAttribute('aria-label',`前進 ${this.stepSize} ${unit}`);
      document.querySelector('.lesson-readouts').innerHTML=this.config.metrics(this.p,s).map(m=>`<div class="lesson-readout"><span>${escape(m[0])}</span><strong>${escape(m[1])}</strong><small>${escape(m[2])}</small></div>`).join('');
      const status=(this.running?'播放中':this.time>=this.duration?'本次演示結束':'已暫停')+' · '+this.config.note(this.p,s);if(this.$('status').textContent!==status)this.$('status').textContent=status;
      this.ctx.clearRect(0,0,this.width,this.height);this.ctx.fillStyle='#101e2e';this.ctx.fillRect(0,0,this.width,this.height);this.ctx.lineCap='round';this.ctx.lineJoin='round';this.config.views[this.view].draw(this,s);
      for(const chart of this.comparisons){
        const rect=chart.canvas.parentElement.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
        if(!rect.width||!rect.height)continue;
        const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
        if(chart.canvas.width!==width||chart.canvas.height!==height){chart.canvas.width=width;chart.canvas.height=height;}
        const a=Object.assign(Object.create(this),{canvas:chart.canvas,ctx:chart.ctx,width:rect.width,height:rect.height});
        a.ctx.setTransform(dpr,0,0,dpr,0,0);a.ctx.clearRect(0,0,a.width,a.height);a.ctx.fillStyle='#101e2e';a.ctx.fillRect(0,0,a.width,a.height);a.ctx.lineCap='round';a.ctx.lineJoin='round';chart.view.draw(a,s);
      }
    }
    text(label,x,y,color=palette.ink,size=20,align='left'){const c=this.ctx;c.font=`${size>=24?'700 ':''}${size*(this.large?1.2:1)}px system-ui,sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=color;c.fillText(label,x,y);}
    line(x1,y1,x2,y2,color=palette.grid,width=1.5,dash=[]){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.setLineDash([]);}
    dot(x,y,r,color){this.ctx.beginPath();this.ctx.arc(x,y,r,0,2*Math.PI);this.ctx.fillStyle=color;this.ctx.fill();}
    arrow(x,y,dx,dy,color,label){const len=Math.hypot(dx,dy);if(len<.5)return;this.line(x,y,x+dx,y+dy,color,3.5);const c=this.ctx,a=Math.atan2(dy,dx),h=Math.min(13,len*.65);c.fillStyle=color;c.beginPath();c.moveTo(x+dx,y+dy);c.lineTo(x+dx-h*Math.cos(a-.5),y+dy-h*Math.sin(a-.5));c.lineTo(x+dx-h*Math.cos(a+.5),y+dy-h*Math.sin(a+.5));c.closePath();c.fill();if(label)this.text(label,Math.max(8,Math.min(this.width-46,x+dx+9)),Math.max(27,Math.min(this.height-10,y+dy-10)),color,24);}
    graph({xmin=0,xmax,ymin,ymax,xlabel='t (s)',ylabel,series,points=[]}){
      const l=64,r=this.width-24,t=52,b=this.height-48,X=x=>l+(x-xmin)/(xmax-xmin)*(r-l),Y=y=>b-(y-ymin)/(ymax-ymin)*(b-t);
      const nice=range=>{const p=10**Math.floor(Math.log10(range/5));return [1,2,5,10].find(n=>n*p>=range/5)*p;};
      for(let x=Math.ceil(xmin/nice(xmax-xmin))*nice(xmax-xmin);x<=xmax+1e-9;x+=nice(xmax-xmin)){this.line(X(x),t,X(x),b);this.text(Number(x.toPrecision(3)).toString(),X(x),b+24,palette.ink,15,'center');}
      for(let y=Math.ceil(ymin/nice(ymax-ymin))*nice(ymax-ymin);y<=ymax+1e-9;y+=nice(ymax-ymin)){this.line(l,Y(y),r,Y(y));this.text(Number(y.toPrecision(3)).toString(),l-8,Y(y)+5,palette.ink,15,'right');}
      this.line(l,t,l,b,palette.ink);this.line(l,b,r,b,palette.ink);this.text(ylabel,12,29,palette.ink,20);this.text(xlabel,r,this.height-9,palette.ink,18,'right');
      this.ctx.save();this.ctx.beginPath();this.ctx.rect(l,t,r-l,b-t);this.ctx.clip();
      for(const s of series){this.ctx.strokeStyle=s.color;this.ctx.lineWidth=3;this.ctx.setLineDash(s.dash||[]);this.ctx.beginPath();let started=false;for(const p of s.data){if(!Number.isFinite(p.y)){started=false;continue;}if(!started){this.ctx.moveTo(X(p.x),Y(p.y));started=true;}else this.ctx.lineTo(X(p.x),Y(p.y));}this.ctx.stroke();this.ctx.setLineDash([]);}
      for(const p of points){
        const radius=p.radius||5;
        if(p.stroke)this.dot(X(p.x),Y(p.y),radius+2,p.stroke);
        this.dot(X(p.x),Y(p.y),radius,p.color||palette.yellow);
      }
      this.ctx.restore();
    }
  }
  window.Classroom=Classroom;window.LessonColors=palette;
})();
