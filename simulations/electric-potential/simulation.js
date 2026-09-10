/* Canvas 2D terrain renderer; physical coordinates and CSS pixels stay separate. */
'use strict';
const P = Electrostatics;
const $ = id => document.getElementById(id);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const copy = value => JSON.parse(JSON.stringify(value));
const lessons = {
    single: { question:'離正電荷愈遠，電位與電場如何改變？', observation:'將探針放在距離 1 m、2 m 處，比較電位與電場。', conclusion:'距離加倍，點電荷電位變為 1/2，電場大小變為 1/4。' },
    double: { question:'只把電量加倍，同一位置的地形高度會如何改變？', observation:'與情境①比較：位置、尺度不變，只將 +1 nC 改成 +2 nC。', conclusion:'相同位置的電位與電場皆加倍；等位線形狀仍為同心圓。' },
    capacitor: { question:'兩片等量異號平板的板間、板外，電場會一樣嗎？', observation:'開啟電力線，以探針比較 x = 0 m 與 x = 3 m 處。', conclusion:'板間場強為 |σ|/ε₀、電位呈線性變化；板外電場相互抵銷。' },
    custom: { question:'先預測你的配置會形成什麼電位地形？', observation:'固定一個探針位置，只改變單一參數，觀察地形與電場。', conclusion:'總電位以純量相加，總電場以向量相加；電位為零不代表電場為零。' }
};
class PotentialSimulation {
    constructor() {
        this.canvas=$('potentialCanvas'); this.ctx=this.canvas.getContext('2d');
        this.buffer=document.createElement('canvas');
        this.sources=[]; this.nextId=1; this.selected=null; this.probe={x:1,y:0};
        this.view='terrain'; this.yaw=-0.62; this.pitch=0.62;
        this.extent=5; this.slice=0; this.limit=20; this.interval=5; this.height=1;
        this.time=0; this.speed=1; this.running=false; this.frameId=null; this.lastTime=null;
        this.physicsDirty=true; this.sceneDirty=true; this.lines=[]; this.grid=[];
        this.comparison=null; this.showingA=false; this.drag=null; this.noticeTimer=null;
        this.bind(); this.createControls(); this.setPreset('single');
        if(matchMedia('(orientation:portrait), (max-width:760px)').matches) this.togglePanel(false);
        this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(this.canvas.parentElement);
        this.resize();
    }
    makeSource(type,x=0,y=0,z=this.slice,value=type==='point'?1:0.1) {
        return {id:this.nextId++,type,x,y,z,value,angle:0,tilt:0};
    }
    notify(message) {
        $('notice').textContent=message; clearTimeout(this.noticeTimer);
        this.noticeTimer=setTimeout(()=>$('notice').textContent='',4500);
    }
    param(container,id,label,value,min,max,step,unit,handler,slider=false) {
        const box=document.createElement('div'); box.className='ep-param';
        box.innerHTML=`<label for="${id}">${label}<span>${unit}</span></label><div class="ep-stepper"><button type="button" aria-label="減少${label}">−</button><input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"><button type="button" aria-label="增加${label}">＋</button></div>${slider?`<input type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}滑桿">`:''}<div class="ep-range-note">${min} ～ ${max} ${unit}</div>`;
        container.append(box); const number=box.querySelector('input[type=number]'), range=box.querySelector('input[type=range]');
        let previous=value;
        const commit=(raw)=>{
            if(raw===''||!Number.isFinite(Number(raw))) { number.value=previous; return; }
            const v=Number(clamp(Number(raw),min,max).toFixed(6)); previous=v; number.value=v; if(range) range.value=v; handler(v);
        };
        number.addEventListener('change',()=>commit(number.value));
        if(range) range.addEventListener('input',()=>commit(range.value));
        const buttons=box.querySelectorAll('button');
        buttons[0].onclick=()=>commit(previous-step); buttons[1].onclick=()=>commit(previous+step);
    }
    createControls() {
        const d=$('displayControls'); d.replaceChildren();
        const choice=(id,label,values,current,handler)=>{
            const l=document.createElement('label'); l.htmlFor=id; l.textContent=label;
            const s=document.createElement('select'); s.id=id;
            values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v+' V'; s.append(o); });
            s.value=current; s.onchange=()=>handler(Number(s.value)); d.append(l,s);
        };
        choice('potentialLimit','電位範圍 ±（超出時截頂）',[20,50,100,200,500],this.limit,v=>{this.limit=v;this.invalidate(true);});
        choice('contourInterval','等位線間距 ΔV',[1,2,5,10,20,50],this.interval,v=>{this.interval=v;this.invalidate(true);});
        this.param(d,'heightScale','地形高度倍率',this.height,0.25,2,0.25,'×',v=>{this.height=v;this.invalidate();},true);
        const v=$('viewControls'); v.replaceChildren();
        this.param(v,'sliceZ','觀察切面 z',this.slice,-10,10,0.1,'m',x=>{this.slice=x;this.resetTime();this.invalidate(true);},true);
        this.param(v,'extent','視野半寬',this.extent,2,10,1,'m',x=>{this.extent=x;this.invalidate(true);},true);
        this.param(v,'yaw','旋轉方位',Math.round(this.yaw*180/Math.PI),-180,180,5,'°',x=>{this.yaw=x*Math.PI/180;this.invalidate();},true);
        this.param(v,'pitch','俯視角',Math.round(this.pitch*180/Math.PI),15,80,5,'°',x=>{this.pitch=x*Math.PI/180;this.invalidate();},true);
        this.param(v,'probeX','探針 x',this.probe.x,-20,20,0.1,'m',x=>{this.probe.x=x;this.invalidate();});
        this.param(v,'probeY','探針 y',this.probe.y,-20,20,0.1,'m',y=>{this.probe.y=y;this.invalidate();});
    }
    updateSourceList() {
        const list=$('sourceList'); list.replaceChildren();
        for(const s of this.sources) {
            const o=document.createElement('option');o.value=s.id;
            o.textContent=`${s.type==='point'?'點電荷':'平板'} ${s.id}：${s.value>0?'+':''}${s.value} ${s.type==='point'?'nC':'nC/m²'}`;list.append(o);
        }
        if(!this.sources.length) { const o=document.createElement('option');o.textContent='尚無電荷，請新增';list.append(o); }
        list.value=this.selected; list.disabled=!this.sources.length;
        $('removeBtn').disabled=!this.sources.length;
    }
    renderEditor() {
        this.updateSourceList(); const editor=$('sourceEditor');editor.replaceChildren();
        const s=this.sources.find(s=>s.id===this.selected); if(!s) return;
        const apply=(key,v)=>{s[key]=v;this.markCustom();this.resetTime();this.updateSourceList();this.updateCompare();this.invalidate(true);};
        this.param(editor,'chargeValue',s.type==='point'?'電量 q':'面電荷密度 σ',s.value,s.type==='point'?-20:-2,s.type==='point'?20:2,s.type==='point'?0.1:0.01,s.type==='point'?'nC':'nC/m²',v=>apply('value',v),true);
        ['x','y','z'].forEach(k=>this.param(editor,'source'+k.toUpperCase(),s.type==='sheet'?'平板定位 '+k:'位置 '+k,s[k],-20,20,0.1,'m',v=>apply(k,v)));
        if(s.type==='sheet') {
            this.param(editor,'sheetAngle','法向方位角',s.angle,-180,180,5,'°',v=>apply('angle',v),true);
            this.param(editor,'sheetTilt','法向仰角',s.tilt,-90,90,5,'°',v=>apply('tilt',v),true);
        }
    }
    markCustom() { $('preset').value='custom'; this.lesson('custom'); }
    lesson(name) {
        this.lessonName=name; $('prediction').textContent=lessons[name].question;
        $('observation').textContent=lessons[name].observation;
        $('conclusion').textContent=lessons[name].conclusion; $('conclusion').hidden=true;
        $('revealBtn').textContent='揭示結論';$('revealBtn').setAttribute('aria-expanded','false');
    }
    setPreset(name) {
        this.resetTime(); clearTimeout(this.noticeTimer);notice.textContent='';this.comparison=null;this.showingA=false;this.nextId=1;if(name==="capacitor")this.limit=50;
        this.sources=name==='capacitor'?[this.makeSource('sheet',-2,0,0,0.1),this.makeSource('sheet',2,0,0,-0.1)]:[this.makeSource('point',0,0,0,name==='double'?2:1)];
        this.slice=0; this.selected=this.sources[0].id; this.probe={x:1,y:0};
        $('preset').value=name;this.lesson(name);this.createControls();this.renderEditor();this.updateCompare();this.invalidate(true);
    }
    addSource(type,x=0,y=0) {
        const s=this.makeSource(type,x,y);this.sources.push(s);this.selected=s.id;
        this.markCustom();this.resetTime();this.renderEditor();this.updateCompare();this.invalidate(true);
    }
    bind() {
        $('preset').onchange=e=>this.setPreset(e.target.value);
        $('revealBtn').onclick=()=>{ const show=$('conclusion').hidden;$('conclusion').hidden=!show;$('revealBtn').textContent=show?'收起結論':'揭示結論';$('revealBtn').setAttribute('aria-expanded',String(show)); };
        $('modeBtn').onclick=()=>{const classroom=document.body.classList.toggle('classroom');$('modeBtn').textContent=classroom?'詳細說明':'課堂演示';};
        $('largeBtn').onclick=()=>{const large=document.body.classList.toggle('large');$('largeBtn').setAttribute('aria-pressed',String(large));this.invalidate();};
        $('panelBtn').onclick=()=>this.togglePanel($('controlPanel').hidden);
        $('fullBtn').onclick=async()=>{
            try { if(document.fullscreenElement) await document.exitFullscreen();
                else if(document.documentElement.requestFullscreen) {document.body.classList.add('classroom');$('modeBtn').textContent='詳細說明';await document.documentElement.requestFullscreen();}
                else this.notify('此瀏覽器不支援全螢幕，仍可使用課堂演示模式。');
            } catch {this.notify('無法進入全螢幕，仍可使用課堂演示模式。');}
        };
        document.addEventListener('fullscreenchange',()=>{$('fullBtn').textContent=document.fullscreenElement?'退出全螢幕':'全螢幕';this.resize();});
        $('terrainBtn').onclick=()=>this.setView('terrain');$('mapBtn').onclick=()=>this.setView('map');
        $('homeBtn').onclick=()=>{this.yaw=-0.62;this.pitch=0.62;this.createControls();this.invalidate();};
        document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{this.addSource(b.dataset.add);this.setView('map');});
        $('editTool').onchange=()=>this.setView('map');
        $('sourceList').onchange=e=>{this.selected=Number(e.target.value);this.renderEditor();this.invalidate();};
        $('removeBtn').onclick=()=>{this.sources=this.sources.filter(s=>s.id!==this.selected);this.selected=this.sources[0]?.id??null;this.changedSources();};
        $('clearBtn').onclick=()=>{this.sources=[];this.selected=null;this.changedSources();};
        ['surfaceToggle','contourToggle','fieldToggle','sourceToggle'].forEach(id=>$(id).onchange=()=>this.invalidate(id==='fieldToggle'));
        $('probeBtn').onclick=()=>{$('editTool').value='probe';this.setView('map');this.togglePanel(false);};
        $('playBtn').onclick=()=>{
            if(this.running) this.pause(); else {if(!$('fieldToggle').checked){$('fieldToggle').checked=true;this.physicsDirty=true;}this.running=true;this.lastTime=null;$('playBtn').textContent='⏸ 暫停';$('stepBtn').disabled=true;this.invalidate();}
        };
        $('replayBtn').onclick=()=>this.resetTime();
        $('stepBtn').onclick=()=>{if(!this.running){this.time+=0.1;this.invalidate();}};
        $('speed').onchange=e=>{this.speed=Number(e.target.value);};
        $('defaultsBtn').onclick=()=>this.defaults();
        $('saveABtn').onclick=()=>{this.comparison={a:copy(this.sources),b:copy(this.sources)};this.showingA=false;this.updateCompare();this.notify('已儲存 A；現在調整配置 B，再切換比較。');};
        $('compareBtn').onclick=()=>{
            if(!this.comparison)return;
            this.comparison[this.showingA?'a':'b']=copy(this.sources);this.showingA=!this.showingA;
            this.sources=copy(this.comparison[this.showingA?'a':'b']);this.selected=this.sources[0]?.id??null;
            this.resetTime();this.renderEditor();this.markCustom();this.updateCompare();this.invalidate(true);
        };
        document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
        window.addEventListener('resize',()=>this.resize());
        this.canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
        this.canvas.addEventListener('pointermove',e=>this.pointerMove(e));
        const end=e=>{if(this.drag?.id!==e.pointerId)return;this.drag=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);this.createControls();this.renderEditor();};
        this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
        this.canvas.addEventListener('lostpointercapture',()=>{this.drag=null;});
    }
    changedSources() {this.markCustom();this.resetTime();this.renderEditor();this.updateCompare();this.invalidate(true);}
    defaults() {
        this.limit=20;this.interval=5;this.extent=5;this.height=1;this.yaw=-0.62;this.pitch=0.62;this.speed=1;$('speed').value=1;
        ['surfaceToggle','contourToggle','sourceToggle'].forEach(id=>$(id).checked=true);$('fieldToggle').checked=false;
        $('editTool').value='select';document.body.classList.remove('large');$('largeBtn').setAttribute('aria-pressed','false');
        this.setView('terrain');this.setPreset('single');
    }
    updateCompare() {
        $('compareBtn').disabled=!this.comparison;
        $('compareBtn').textContent=this.showingA?'返回 B':'查看 A';
        if(!this.comparison){$('compareInfo').textContent='儲存基準 A，再調整 B。切換時共用切面、座標範圍與電位尺度。';return;}
        this.comparison[this.showingA?'a':'b']=copy(this.sources);
        const description=s=>s.length?s.map(o=>`${o.type==='point'?'q':'σ'}=${o.value} ${o.type==='point'?'nC':'nC/m²'} @ (${o.x}, ${o.y}, ${o.z}) m${o.type==='sheet'?`，法向 ${o.angle}° / ${o.tilt}°`:''}`).join('；'):'空配置';
        $('compareInfo').textContent=`目前 ${this.showingA?'A':'B'}。A：${description(this.comparison.a)}。B：${description(this.comparison.b)}。共用相同尺度與切面。`;
    }
    togglePanel(open) {$('controlPanel').hidden=!open;document.body.classList.toggle('panel-hidden',!open);$('panelBtn').textContent=open?'收合控制':'開啟控制';$('panelBtn').setAttribute('aria-expanded',String(open));}
    setView(view) {
        this.view=view;this.drag=null;
        ['terrain','map'].forEach(v=>{const b=$(v+'Btn');b.classList.toggle('active',v===view);b.setAttribute('aria-pressed',String(v===view));});
        $('viewCaption').textContent=view==='terrain'?'高度 = 電位 V':'俯視 x–y 切面';
        $('gestureHint').textContent=view==='terrain'?'單指拖曳旋轉；切換「俯視配置」放置電荷、平板或探針。':'單指點選／拖曳物件；可在控制面板選擇連續放置或移動探針。';
        this.invalidate();
    }
    pause() {this.running=false;this.lastTime=null;if(this.frameId!==null){cancelAnimationFrame(this.frameId);this.frameId=null;}$('playBtn').textContent='▶ 播放示意';$('stepBtn').disabled=false;this.invalidate();}
    resetTime() {this.pause();this.time=0;this.invalidate();}
    resize() {
        const r=this.canvas.parentElement.getBoundingClientRect();
        this.width=Math.max(1,r.width);this.heightPx=Math.max(1,r.height);this.dpr=window.devicePixelRatio||1;
        this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.heightPx*this.dpr);
        this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
        this.buffer.width=this.canvas.width;this.buffer.height=this.canvas.height;this.invalidate();
    }
    invalidate(physics=false) {this.physicsDirty ||= physics;this.sceneDirty=true;if(this.frameId===null)this.frameId=requestAnimationFrame(t=>this.frame(t));}
    frame(timestamp) {
        this.frameId=null;
        if(this.running){if(this.lastTime!==null)this.time+=Math.min((timestamp-this.lastTime)/1000,0.1)*this.speed;this.lastTime=timestamp;}
        if(this.physicsDirty){this.rebuild();this.physicsDirty=false;this.sceneDirty=true;}
        if(this.sceneDirty){this.drawScene();const b=this.buffer.getContext('2d');b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,this.buffer.width,this.buffer.height);b.drawImage(this.canvas,0,0);this.sceneDirty=false;}
        else {this.ctx.setTransform(1,0,0,1,0,0);this.ctx.drawImage(this.buffer,0,0);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
        this.drawMovingDots();$('animationStatus').textContent=`場線光點示意 · ${this.time.toFixed(1)} s`;
        if(this.running&&this.frameId===null)this.frameId=requestAnimationFrame(t=>this.frame(t));
    }
    rebuild() {
        const n=76,e=this.extent;this.n=n;this.grid=[];this.clipped=false;
        for(let j=0;j<=n;j++)for(let i=0;i<=n;i++) {
            const x=-e+2*e*i/n,y=-e+2*e*j/n,f=P.sample(this.sources,x,y,this.slice),valid=!f.singular&&!P.excluded(this.sources,x,y,this.slice);
            if(valid&&Math.abs(f.v)>this.limit)this.clipped=true;
            this.grid.push({x,y,v:f.v,valid});
        }
        this.contours=[];const count=Math.floor(this.limit/this.interval);
        this.contourLimited=count>60;
        if(!this.contourLimited) {
            for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
                const a=this.grid[j*(n+1)+i],b=this.grid[j*(n+1)+i+1],c=this.grid[(j+1)*(n+1)+i+1],d=this.grid[(j+1)*(n+1)+i];
                for(const triangle of [[a,b,c],[a,c,d]]) {
                    if(triangle.some(p=>!p.valid))continue;
                    const low=Math.max(-count,Math.ceil(Math.min(...triangle.map(p=>p.v))/this.interval));
                    const high=Math.min(count,Math.floor(Math.max(...triangle.map(p=>p.v))/this.interval));
                    for(let k=low;k<=high;k++) {
                        const level=k*this.interval,points=[];
                        for(let t=0;t<3;t++) {const p=triangle[t],q=triangle[(t+1)%3];if((p.v<=level&&q.v>level)||(q.v<=level&&p.v>level)){const f=(level-p.v)/(q.v-p.v);points.push([p.x+f*(q.x-p.x),p.y+f*(q.y-p.y)]);}}
                        if(points.length===2)this.contours.push({level,points});
                    }
                }
            }
        }
        this.lines=[];
        if($('fieldToggle').checked) {
            const occupied=new Set();
            const add=(seed,direction,force=false)=>{
                const key=p=>`${Math.round(p[0]/0.27)},${Math.round(p[1]/0.27)}`;
                if(!force&&occupied.has(key(seed)))return;
                const line=P.trace(this.sources,seed,this.slice,e,direction);
                if(line.length<4)return;
                line.forEach(p=>occupied.add(key(p)));
                this.lines.push(line.map(([x,y])=>({x,y,v:P.sample(this.sources,x,y,this.slice).v})));
            };
            this.sources.forEach(s=>{
                if(s.type==='point'&&s.value!==0&&Math.abs(s.z-this.slice)<0.15)for(let i=0;i<16;i++){const a=2*Math.PI*i/16;add([s.x+0.18*Math.cos(a),s.y+0.18*Math.sin(a)],Math.sign(s.value),true);}
                if(s.type==='sheet'&&s.value!==0){const n=P.normal(s),h=Math.hypot(n[0],n[1]);if(h<1e-6)return;const shift=-(this.slice-s.z)*n[2]/(h*h);for(let t=-e*1.5;t<=e*1.5;t+=e/5)for(const side of [-1,1])add([s.x+shift*n[0]-t*n[1]/h+side*.08*n[0]/h,s.y+shift*n[1]+t*n[0]/h+side*.08*n[1]/h],Math.sign(s.value));}
            });
            const needExtraSeeds=!this.lines.length||this.sources.some(s=>Math.abs(s.x)>e||Math.abs(s.y)>e||(s.type==='point'&&Math.abs(s.z-this.slice)>.15));
            if(needExtraSeeds) for(let t=-e+.1;t<e;t+=e/7)for(const seed of [[t,-e+.02],[t,e-.02],[-e+.02,t],[e-.02,t]]) {add(seed,1);add(seed,-1);}
            // Also seed interiors for off-slice sources and fields isolated by sheets.
            if(needExtraSeeds) for(let y=-e+.5;y<e;y+=e/2)for(let x=-e+.5;x<e;x+=e/2){add([x,y],1);add([x,y],-1);}
        }
    }
    color(v) {
        const t=clamp(v/this.limit,-1,1),a=t<0?[55,122,220]:[237,105,76],b=[198,230,229],f=Math.abs(t);
        return `rgb(${a.map((c,i)=>Math.round(b[i]+(c-b[i])*f)).join(',')})`;
    }
    project(x,y,v=0) {
        const e=this.extent;
        if(this.view==='map') {const s=Math.max(1,Math.min(this.width-100,this.heightPx-80))/(2*e);return {x:this.width/2+x*s,y:this.heightPx/2-y*s,depth:y};}
        const c=Math.cos(this.yaw),s=Math.sin(this.yaw),u=x*c-y*s,w=x*s+y*c;
        const scale=Math.max(1,Math.min((this.width-120)/(2.85*e),(this.heightPx-65)/(2.85*e*Math.sin(this.pitch)+1.3*e*this.height*Math.cos(this.pitch))));
        const z=clamp(v/this.limit,-1,1)*e*.65*this.height;
        return {x:this.width/2+u*scale,y:this.heightPx*.51+(w*Math.sin(this.pitch)-z*Math.cos(this.pitch))*scale,depth:w*Math.cos(this.pitch)+z*Math.sin(this.pitch)};
    }
    path(points,color,width=1,close=false) {
        if(!points.length)return;const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);if(close)c.closePath();c.strokeStyle=color;c.lineWidth=width;c.stroke();
    }
    label(text,x,y,color='#edf7ff',size=24,align='left') {
        const c=this.ctx;c.font=`600 ${size}px "Microsoft JhengHei", sans-serif`;c.textAlign=align;c.textBaseline='middle';
        c.lineWidth=4;c.strokeStyle='#102131';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);
    }
    drawScene() {
        const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#102131';c.fillRect(0,0,this.width,this.heightPx);
        const e=this.extent,n=this.n,surface=$('surfaceToggle').checked;
        const step=e<=2?1:e<=5?2:5;
        for(let t=-Math.floor(e/step)*step;t<=e;t+=step){this.path([this.project(t,-e),this.project(t,e)],'#486071',1);this.path([this.project(-e,t),this.project(e,t)],'#486071',1);}
        if(surface) {
            const faces=[];
            for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
                const vertices=[this.grid[j*(n+1)+i],this.grid[j*(n+1)+i+1],this.grid[(j+1)*(n+1)+i+1],this.grid[(j+1)*(n+1)+i]];
                if(vertices.some(p=>!p.valid))continue;
                const points=vertices.map(p=>this.project(p.x,p.y,p.v));
                faces.push({points,v:vertices.reduce((sum,p)=>sum+p.v,0)/4,depth:points.reduce((sum,p)=>sum+p.depth,0)/4});
            }
            faces.sort((a,b)=>a.depth-b.depth);
            for(const f of faces){c.beginPath();c.moveTo(f.points[0].x,f.points[0].y);f.points.slice(1).forEach(p=>c.lineTo(p.x,p.y));c.closePath();c.fillStyle=this.color(f.v);c.fill();c.strokeStyle=c.fillStyle;c.lineWidth=.5;c.stroke();}
        }
        const lineHeight=v=>this.view==='terrain'?v:0;
        if($('contourToggle').checked&&!this.contourLimited) {
            for(const segment of this.contours)this.path(segment.points.map(([x,y])=>this.project(x,y,lineHeight(segment.level))),segment.level===0?'#172d45':'#243d58',segment.level===0?2.6:1.5);
        }
        if($('fieldToggle').checked) {
            for(const line of this.lines) {
                const pts=line.filter((_,i)=>i%2===0).map(p=>this.project(p.x,p.y,lineHeight(p.v)));
                this.path(pts,'#18364b',4);this.path(pts,'#fff4a3',2);
                for(let i=20;i<line.length-2;i+=65){const a=this.project(line[i-2].x,line[i-2].y,lineHeight(line[i-2].v)),b=this.project(line[i+2].x,line[i+2].y,lineHeight(line[i+2].v));this.arrow(a,b,'#fff4a3');}
            }
        }
        this.drawAxes(step);
        if($('sourceToggle').checked)this.drawSources();
        this.drawProbe();this.updateReadings();
        const font=document.body.classList.contains('large')?27:24;
        this.label(`z = ${this.slice.toFixed(1)} m`,14,24,'#e5f2fa',font);
        let status=[];if(this.clipped&&surface)status.push('超出色階已截頂／截底');if(this.contourLimited&&$('contourToggle').checked)status.push('等位線過密，請增大間距');
        if(!this.sources.length)status.push('空配置：V = 0，E = 0');
        if(status.length)this.label(status.join('；'),14,this.heightPx-18,'#ffe39a',18);
        $('scaleLabel').textContent=`−${this.limit} ～ +${this.limit} V · ΔV = ${this.interval} V${this.showingA?' · A':this.comparison?' · B':''}`;
        const offSlice=this.sources.some(s=>s.value!==0&&(s.type==='point'?Math.abs(s.z-this.slice)>1e-8:Math.abs(P.normal(s)[2])>1e-8));
        $('fieldNote').textContent=offSlice?'目前場線為切面內分量的積分曲線；完整三維電場可能離開切面。箭頭指向低電位，線數僅示意。':'電力線位於切面中，箭頭指向低電位；線數與光點速度僅示意。';
    }
    drawAxes(step) {
        const e=this.extent;
        this.path([this.project(-e,-e),this.project(e,-e),this.project(e,e),this.project(-e,e),this.project(-e,-e)],'#9bbbd0',1.5);
        if(this.view==='map') {
            for(let t=-Math.floor(e/step)*step;t<=e;t+=step){const p=this.project(t,-e);this.label(String(t),p.x,p.y+20,'#e5f2fa',18,'center');const q=this.project(-e,t);this.label(String(t),q.x-10,q.y,'#e5f2fa',18,'right');}
            const x=this.project(e,-e),y=this.project(-e,e);
            this.label('x (m)',clamp(x.x+10,60,this.width-70),clamp(x.y+36,20,this.heightPx-12),'#fff',24,'center');
            this.label('y (m)',clamp(y.x-10,55,this.width-60),clamp(y.y-22,20,this.heightPx-12),'#fff',24,'center');
            return;
        }
        // Put spatial axes on the two foreground edges, outside the terrain.
        const frontX=Math.sin(this.yaw)>=0?e:-e,frontY=Math.cos(this.yaw)>=0?e:-e;
        const origin=this.project(0,0),outward=p=>{const m=Math.hypot(p.x-origin.x,p.y-origin.y)||1;return {x:(p.x-origin.x)/m,y:(p.y-origin.y)/m};};
        const ox=outward(this.project(0,frontY)),oy=outward(this.project(frontX,0));
        for(let t=-Math.floor(e/step)*step;t<=e;t+=step) {
            const p=this.project(t,frontY),q=this.project(frontX,t);
            this.label(String(t),p.x+ox.x*18,p.y+ox.y*18,'#e5f2fa',18,'center');
            this.label(String(t),q.x+oy.x*18,q.y+oy.y*18,'#e5f2fa',18,'center');
        }
        const mx=this.project(0,frontY),my=this.project(frontX,0);
        this.label('x (m)',clamp(mx.x+ox.x*48,60,this.width-60),clamp(mx.y+ox.y*48,20,this.heightPx-28),'#fff',24,'center');
        this.label('y (m)',clamp(my.x+oy.x*48,60,this.width-60),clamp(my.y+oy.y*48,20,this.heightPx-28),'#fff',24,'center');
        const corner=[[-e,-e],[e,-e],[-e,e],[e,e]].sort((a,b)=>this.project(...a).x-this.project(...b).x)[0];
        const a=this.project(...corner,-this.limit),b=this.project(...corner,this.limit);this.path([a,b],'#cce3f2',2);
        for(const v of [-this.limit,0,this.limit]){const p=this.project(...corner,v);this.label(String(v),p.x-8,p.y,'#fff',18,'right');}
        this.label('V (V)',clamp(b.x,50,this.width-50),Math.max(18,b.y-24),'#fff',24,'center');
    }
    arrow(a,b,color) {
        const dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy);if(m<.2)return;const ux=dx/m,uy=dy/m,c=this.ctx;
        c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-ux*11-uy*5,b.y-uy*11+ux*5);c.lineTo(b.x-ux*11+uy*5,b.y-uy*11-ux*5);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#18364b';c.lineWidth=1;c.stroke();
    }
    sheetSegment(s) {
        const n=P.normal(s),e=this.extent,constant=n[0]*s.x+n[1]*s.y+n[2]*(s.z-this.slice),pts=[];
        if(Math.abs(n[1])>1e-8)for(const x of [-e,e]){const y=(constant-n[0]*x)/n[1];if(Math.abs(y)<=e+1e-8)pts.push([x,y]);}
        if(Math.abs(n[0])>1e-8)for(const y of [-e,e]){const x=(constant-n[1]*y)/n[0];if(Math.abs(x)<=e+1e-8)pts.push([x,y]);}
        const unique=pts.filter((p,i)=>!pts.slice(0,i).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7));return unique.slice(0,2);
    }
    sourceScreen(s) {
        let v=P.sample(this.sources,s.x,s.y,this.slice).v;
        if(!Number.isFinite(v))v=Math.sign(s.value)*this.limit;
        return this.project(s.x,s.y,this.view==='terrain'?v:0);
    }
    drawSources() {
        const c=this.ctx;
        for(const s of this.sources) {
            const color=s.value>0?'#ed695b':s.value<0?'#54a4ff':'#a3adb8';
            if(s.type==='sheet') {
                const segment=this.sheetSegment(s);
                if(segment.length===2) {
                    const points=[];for(let i=0;i<=80;i++){const t=i/80,x=segment[0][0]*(1-t)+segment[1][0]*t,y=segment[0][1]*(1-t)+segment[1][1]*t;const v=P.sample(this.sources,x,y,this.slice).v;points.push(this.project(x,y,this.view==='terrain'&&Number.isFinite(v)?v:0));}
                    this.path(points,'#102131',9);this.path(points,color,5);
                    for(const index of [15,65])this.label(s.value>0?'+':s.value<0?'−':'0',points[index].x,points[index].y,color,28,'center');
                } else if(Math.abs(Math.abs(s.tilt)-90)<1e-8&&Math.abs(s.z-this.slice)<1e-8) {
                    this.label(`平板 ${s.id} 與切面重合`,this.width/2,60,color,24,'center');
                }
            }
            if(Math.abs(s.x)>this.extent||Math.abs(s.y)>this.extent)continue;
            const p=this.sourceScreen(s);c.beginPath();c.arc(p.x,p.y,16,0,Math.PI*2);c.fillStyle=color;c.fill();c.lineWidth=s.id===this.selected?4:2;c.strokeStyle=s.id===this.selected?'#fff5aa':'#102131';c.stroke();
            this.label(s.type==='point'?(s.value>0?'+':s.value<0?'−':'0'):'↔',p.x,p.y,'#102131',24,'center');
            this.label(`${s.type==='point'?'q':'σ'}${s.id}`,p.x-24,p.y-28,color,24,'right');
            if(s.type==='sheet'){c.setLineDash([4,4]);this.path([{x:p.x-24,y:p.y},{x:p.x+24,y:p.y}],color,1);c.setLineDash([]);}
        }
    }
    drawProbe() {
        if(Math.abs(this.probe.x)>this.extent||Math.abs(this.probe.y)>this.extent)return;
        const f=P.sample(this.sources,this.probe.x,this.probe.y,this.slice),v=Number.isFinite(f.v)?f.v:0;
        const p=this.project(this.probe.x,this.probe.y,this.view==='terrain'?v:0),c=this.ctx;
        c.beginPath();c.arc(p.x,p.y,9,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.strokeStyle='#142a3d';c.lineWidth=3;c.stroke();
        this.path([{x:p.x-16,y:p.y},{x:p.x+16,y:p.y}],'#fff',2);this.path([{x:p.x,y:p.y-16},{x:p.x,y:p.y+16}],'#fff',2);
        this.label('探針',p.x+19,p.y+22,'#fff',24);
    }
    updateReadings() {
        const f=P.sample(this.sources,this.probe.x,this.probe.y,this.slice);
        const fmt=x=>Math.abs(x)<1e-9?'0':Math.abs(x)>=1e4||Math.abs(x)<.01?x.toExponential(2):x.toFixed(2);
        $('probeV').textContent=f.singular?'不定義':fmt(f.v)+' V';
        $('probeE').textContent=f.singular||f.onSheet?'不定義':fmt(Math.hypot(f.ex,f.ey,f.ez))+' N/C';
        $('probeEz').textContent=f.singular||f.onSheet?'不定義':fmt(f.ez)+' N/C';
        $('probePosition').textContent=`探針 (${this.probe.x.toFixed(2)}, ${this.probe.y.toFixed(2)}, ${this.slice.toFixed(2)}) m${Math.abs(this.probe.x)>this.extent||Math.abs(this.probe.y)>this.extent?'，位於目前視野外':''}`;
    }
    drawMovingDots() {
        if(!$('fieldToggle').checked||this.time===0)return;
        const c=this.ctx;c.fillStyle='#fff';
        for(const line of this.lines) {const index=Math.floor((this.time*.8/.065)%(line.length-1));const p=line[index],q=this.project(p.x,p.y,this.view==='terrain'?p.v:0);c.beginPath();c.arc(q.x,q.y,4,0,Math.PI*2);c.fill();}
    }
    eventPoint(e) {const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
    mapPoint(p) {const s=Math.max(1,Math.min(this.width-100,this.heightPx-80))/(2*this.extent);return {x:clamp((p.x-this.width/2)/s,-this.extent,this.extent),y:clamp((this.heightPx/2-p.y)/s,-this.extent,this.extent)};}
    pointerDown(e) {
        if(this.drag||e.button!==0)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);
        const p=this.eventPoint(e);this.drag={id:e.pointerId,start:p,yaw:this.yaw,pitch:this.pitch,type:'rotate'};
        if(this.view==='terrain')return;
        const world=this.mapPoint(p),tool=$('editTool').value;
        if(tool==='point'||tool==='sheet'){this.addSource(tool,Number(world.x.toFixed(2)),Number(world.y.toFixed(2)));this.drag.type='source';this.drag.source=this.sources.find(s=>s.id===this.selected);return;}
        if(tool==='probe'){this.probe=world;this.drag.type='probe';this.invalidate();return;}
        let nearest=null,distance=28;
        if($('sourceToggle').checked)for(const s of this.sources){const q=this.sourceScreen(s),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<distance){nearest=s;distance=d;}}
        if(nearest){this.selected=nearest.id;this.drag.type='source';this.drag.source=nearest;this.renderEditor();this.invalidate();}
        else {this.drag.type='probe';this.probe=world;this.invalidate();}
    }
    pointerMove(e) {
        if(!this.drag||this.drag.id!==e.pointerId)return;e.preventDefault();const p=this.eventPoint(e),d=this.drag;
        if(d.type==='rotate') {this.yaw=d.yaw+(p.x-d.start.x)*.008;this.yaw=((this.yaw+3*Math.PI)%(2*Math.PI))-Math.PI;this.pitch=clamp(d.pitch+(p.y-d.start.y)*.006,Math.PI/12,Math.PI*80/180);this.invalidate();return;}
        const world=this.mapPoint(p);
        if(d.type==='source'){d.source.x=Number(world.x.toFixed(2));d.source.y=Number(world.y.toFixed(2));this.markCustom();this.resetTime();this.updateCompare();this.invalidate(true);}
        else {this.probe=world;this.invalidate();}
    }
}
window.simulation=new PotentialSimulation();
