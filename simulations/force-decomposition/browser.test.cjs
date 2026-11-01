/* Node 22+, local Chrome/Edge. No package installation or network required. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!browser)throw Error('Set CHROME_PATH to Chrome or Edge.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'force-decomposition-qa-'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const [,file] of html.matchAll(/(?:src|href)="([^"]+)"/g))if(!/^https?:/.test(file))assert.ok(fs.existsSync(path.resolve(__dirname,file.split('#')[0])),`Missing resource: ${file}`);
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let connection;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=setTimeout(()=>{child.kill();process.exitCode=1;if(connection)connection.close();console.error('Browser QA timed out');},90000);
(async()=>{
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 for(let i=0;i<100&&!/DevTools listening on (ws:\/\/[^\s]+)/.test(stderr);i++)await delay(100);
 const address=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(!address)throw Error(stderr);
 const ws=new WebSocket(address);connection=ws;await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let next=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}};
 function cmd(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 const {targetId}=await cmd('Target.createTarget',{url:'about:blank'}),{sessionId}=await cmd('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p={})=>cmd(m,p,sessionId);await send('Runtime.enable');await send('Page.enable');
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle();};
 const input=async(id,value,event='input')=>{await evaluate(`document.getElementById('${id}').value=${JSON.stringify(value)};document.getElementById('${id}').dispatchEvent(new Event('${event}'));`);await settle();};
 const screenshots=[];async function capture(name){const {data}=await send('Page.captureScreenshot',{format:'png'});const file=path.join(temp,name+'.png');fs.writeFileSync(file,Buffer.from(data,'base64'));screenshots.push(file);}
 await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'index.html')).href});
 for(let i=0;i<100;i++){if(await evaluate('Boolean(window.lesson)'))break;await delay(100);}await settle();
 assert.ok(await evaluate('lesson instanceof Classroom'));
 assert.equal(await evaluate('lesson.state.stuck'),true);
 // Inspect actual canvas strokes, independently deriving C/P from the drawn square.
 await input('muS',1);
 for(const angle of [0,15,30,40]) {
  await input('inclineAngle',angle);
  const geometry=await evaluate(`(()=>{
   const a=lesson,lines=[],rects=[],line=a.line,strokeRect=a.ctx.strokeRect;
   a.line=function(...args){lines.push(args);return line.apply(this,args);};
   a.ctx.strokeRect=function(x,y,w,h){
    const m=this.getTransform(),scale=devicePixelRatio||1;
    const point=(px,py)=>({x:(m.a*px+m.c*py+m.e)/scale,y:(m.b*px+m.d*py+m.f)/scale});
    rects.push({width:w,height:h,B:point(x+w/2,y+h),C:point(x+w/2,y+h/2),u:{x:m.a/scale,y:m.b/scale}});
    return strokeRect.call(this,x,y,w,h);
   };
   try{a.render();}finally{a.line=line;a.ctx.strokeRect=strokeRect;}
   const forces=lines.filter(v=>v[5]===4&&['#ff8f9e','#62b9fa','#65dcaf'].includes(v[4]));
   return {rect:rects[0],forces};
  })()`);
  const rect=geometry.rect,C=rect.C,u=rect.u;
  const P={x:C.x,y:rect.B.y+(C.x-rect.B.x)*u.y/u.x};
  assert.ok(rect.width>100);assert.ok(rect.height>100);assert.equal(rect.width,rect.height);
  assert.equal(geometry.forces.length,angle===0?2:3);
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,a+' != '+b);
  const W=geometry.forces.find(f=>f[4]==='#ff8f9e');
  near(W[0],C.x);near(W[1],C.y);near(W[0],W[2]);assert.ok(W[3]>P.y+15);
  for(const f of geometry.forces) {
   const dx=f[2]-f[0],dy=f[3]-f[1],length=Math.hypot(dx,dy);
   // Signed perpendicular distance from P to each line must be zero.
   near(((P.x-f[0])*dy-(P.y-f[1])*dx)/length,0);
   if(f[4]==='#ff8f9e')continue;
   near(f[0],P.x);near(f[1],P.y);
   if(f[4]==='#62b9fa') {
    near((dx*u.x+dy*u.y)/length,0);assert.ok(dy<0);
    if(angle>0)assert.ok(Math.abs(((C.x-P.x)*dy-(C.y-P.y)*dx)/length)>1);
   } else {near((dx*u.y-dy*u.x)/length,0);assert.ok(dx>0);}
  }
  assert.ok(Math.abs((P.x-rect.B.x)*u.x+(P.y-rect.B.y)*u.y)<=rect.width/2+1e-4);
  if(angle>0)assert.ok(Math.hypot(P.x-rect.B.x,P.y-rect.B.y)>1);
 }
 await click('#defaults');
 await input('inclineAngle',10);
 await click('#angleSweep');assert.equal(await evaluate('lesson.p.angleSweep'),true);
 assert.equal(await evaluate('lesson.running'),true);assert.equal(await evaluate('document.getElementById("inclineAngle").disabled'),true);
 await delay(120);await click('#play');
 assert.equal(await evaluate('lesson.state.phase'),'raising');
 const sweptTime=await evaluate('lesson.time');
 await click('#decompose');assert.equal(await evaluate('lesson.time'),sweptTime);
 await input('speed',.5);assert.equal(await evaluate('lesson.time'),sweptTime);
 await input('time',200);assert.equal(await evaluate('lesson.state.phase'),'raising');
 assert.equal(await evaluate('lesson.state.distance'),0);await capture('angle-raising');
 await input('time',800);assert.equal(await evaluate('lesson.state.phase'),'sliding');
 const slide=await evaluate('lesson.state');
 assert.ok(slide.distance>0);assert.ok(slide.speed>0);assert.ok(slide.parallel>slide.maxStatic);
 assert.equal(await evaluate('document.getElementById("angleSweep").textContent'),'角度已固定');
 assert.equal(await evaluate('document.getElementById("angleSweep").disabled'),true);
 assert.equal(await evaluate('document.getElementById("inclineAngle").disabled'),false);
 await capture('angle-locked-and-sliding');
 await input('time',900);assert.equal(await evaluate('lesson.state.theta'),slide.theta);
 assert.ok(await evaluate('lesson.state.distance')>slide.distance);
 await input('time',100);assert.equal(await evaluate('lesson.state.phase'),'raising');
 assert.equal(await evaluate('lesson.state.distance'),0);
 assert.equal(await evaluate('document.getElementById("inclineAngle").disabled'),true);
 await click('#reset');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.p.angleSweep'),true);
 // Let the actual animation clock cross the event without another button press.
 await input('speed',1);
 await evaluate('lesson.time=PhysicsModel.sweepPlan(lesson.p).releaseTime-.06;lesson.render();');
 await click('#play');await delay(220);await click('#play');
 assert.equal(await evaluate('lesson.state.phase'),'sliding');assert.ok(await evaluate('lesson.state.distance')>0);
 const stoppedAngle=await evaluate('lesson.state.theta*180/Math.PI');
 await input('muS',.2);
 assert.equal(await evaluate('lesson.p.angleSweep'),false);
 assert.ok(Math.abs(await evaluate('lesson.p.inclineAngle')-stoppedAngle)<1e-8);
 assert.equal(await evaluate('lesson.time'),0);
 // Starting beyond the threshold slides immediately without changing the angle.
 await input('inclineAngle',50);await click('#angleSweep');await delay(100);await click('#play');
 assert.equal(await evaluate('lesson.state.phase'),'sliding');
 assert.ok(Math.abs(await evaluate('lesson.state.theta*180/Math.PI')-50)<1e-8);
 assert.ok(await evaluate('lesson.state.distance')>0);
 await input('inclineAngle',20);assert.equal(await evaluate('lesson.p.angleSweep'),false);
 // Manual early stop remains available while the object is still static.
 await click('#defaults');await input('inclineAngle',10);await click('#angleSweep');await input('time',100);
 const manualAngle=await evaluate('lesson.state.theta*180/Math.PI');
 await click('#angleSweep');assert.equal(await evaluate('lesson.p.angleSweep'),false);
 assert.ok(Math.abs(await evaluate('lesson.p.inclineAngle')-manualAngle)<1e-8);
 assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.running'),false);
 await click('#angleSweep');await input('scenario','pendulum','change');
 assert.equal(await evaluate('lesson.p.angleSweep'),false);assert.equal(await evaluate('document.getElementById("angleSweep").hidden'),true);
 await click('#defaults');
 await capture('desktop-incline');
 await click('#decompose');await capture('desktop-components');
 await input('inclineAngle',45);assert.equal(await evaluate('lesson.state.stuck'),false);
 await click('#play');await delay(230);await click('#play');
 const time=await evaluate('lesson.time');assert.ok(time>0);
 await input('speed',.5);assert.equal(await evaluate('lesson.time'),time);
 await click('#decompose');assert.equal(await evaluate('lesson.time'),time);
 await click('#decompose');await click('#showWeight');assert.equal(await evaluate('lesson.time'),time);
 await click('#showWeight');await click('#step');assert.ok(Math.abs(await evaluate('lesson.time')-time-.05)<1e-9);
 await input('time',500);assert.equal(await evaluate('lesson.time'),3);
 await input('time',100);assert.ok(Math.abs(await evaluate('lesson.time')-.6)<1e-9);
 await input('muS',.2);assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.p.muK'),.2);
 await input('muK',.8);assert.equal(await evaluate('lesson.p.muS'),.8);
 await input('time',100);await click('#reset');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.p.muS'),.8);
 await click('#defaults');assert.equal(await evaluate('lesson.p.decompose'),false);
 await click('[data-preset="2"]');assert.equal(await evaluate('lesson.state.friction'),0);
 await capture('horizontal-zero-friction');
 await click('[data-preset="3"]');assert.equal(await evaluate('lesson.p.scenario'),'pendulum');
 assert.equal(await evaluate('document.getElementById("muS").closest(".lesson-control").hidden'),true);
 assert.equal(await evaluate('document.getElementById("length").closest(".lesson-control").hidden'),false);
 await capture('pendulum-release');await input('time',200);await capture('pendulum-swing');
 const pendTime=await evaluate('lesson.time'),pendState=await evaluate('lesson.state');
 await click('[data-view="1"]');assert.equal(await evaluate('lesson.time'),pendTime);
 assert.deepEqual(await evaluate('lesson.state'),pendState);await capture('pendulum-free-body');
 await click('#reveal');assert.equal(await evaluate('document.getElementById("answer").hidden'),false);
 await click('[data-preset="4"]');assert.ok(await evaluate('lesson.state.theta')<0);
 await input('pendulumAngle',0);assert.equal(await evaluate('lesson.state.parallel'),0);
 assert.equal(await evaluate('lesson.state.tension'),await evaluate('lesson.state.weight'));
 // Basic touch interaction uses the same accessible controls as a pointer.
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await evaluate('document.getElementById("decompose").scrollIntoView({block:"center"})');await settle();
 const tap=await evaluate('(()=>{const r=document.getElementById("decompose").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 const beforeTap=await evaluate('lesson.p.decompose');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...tap,id:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 assert.equal(await evaluate('lesson.p.decompose'),!beforeTap);
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await evaluate('scrollTo(0,0)');
 await input('pendulumAngle',35);
 const sizes=[];
 for(const [width,height] of [[1024,768],[1180,820],[1366,768],[768,1024],[390,844]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
  for(const presenting of [false,true]) {
   await evaluate(`document.body.classList.toggle('is-presenting',${presenting});scrollTo(0,0)`);await settle();
   if(width<=900&&presenting&&await evaluate('!document.getElementById("controls").hidden'))await click('#controlToggle');
   for(const scenario of ['incline','pendulum']) {
    await input('scenario',scenario,'change');await evaluate('lesson.p.decompose=true;lesson.sync();lesson.render()');await settle();
    for(const view of [0,1]) {
     await click(`[data-view="${view}"]`);
     const size=await evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,controlsBottom:document.getElementById("controlToggle").getBoundingClientRect().bottom,canvasBottom:lesson.canvas.getBoundingClientRect().bottom,canvasHeight:lesson.height,playBottom:document.getElementById("play").getBoundingClientRect().bottom})');
     assert.equal(size.overflow,false,JSON.stringify({width,height,presenting,scenario,...size}));
     assert.ok(size.canvasHeight>=200,JSON.stringify({width,height,presenting,...size}));
     if(presenting){assert.ok(size.controlsBottom<=height);assert.ok(size.playBottom<=height);assert.ok(size.canvasBottom<=height);}
     if((width===390||width===1024)&&view===0)await capture(`${width}-${presenting?'presentation':'normal'}-${scenario}`);
     sizes.push({width,height,presenting,scenario,view,canvasHeight:size.canvasHeight});
    }
   }
  }
  await evaluate("document.body.classList.remove('is-presenting')");
  if(await evaluate('document.getElementById("controls").hidden'))await click('#controlToggle');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
 await click('#defaults');await click('#decompose');await click('[data-view="0"]');await click('#large');await click('#presentation');await settle();
 await capture('large-presentation-incline');
 await input('scenario','pendulum','change');await input('pendulumAngle',70);await capture('large-presentation-pendulum');
 await click('#large');await click('#presentation');
 await click('#play');await delay(150);assert.equal(await evaluate('lesson.running'),true);
 await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden');
 assert.equal(await evaluate('lesson.running'),false);
 await send('Runtime.evaluate',{expression:'document.getElementById("fullscreen").click()',userGesture:true});await delay(100);
 assert.ok(await evaluate('Boolean(document.fullscreenElement)||document.body.classList.contains("is-presenting")'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks:'resources, forces and decomposition, time preservation, playback, rewind, friction normalization, zero cases, presets, touch toggle, five screen sizes and presentation modes, fullscreen, no JavaScript exceptions',sizes,screenshots},null,2));
 await send('Emulation.setDeviceMetricsOverride',{width:900,height:620,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'static-forces.svg')).href});await delay(150);await settle();await capture('static-forces-diagram');
 console.log('Static diagram screenshot: '+screenshots.at(-1));
 await cmd('Browser.close');ws.close();
})().catch(e=>{console.error(e);console.error('QA screenshots: '+temp);process.exitCode=1;}).finally(()=>{clearTimeout(timeout);if(connection)connection.close();child.kill();});
