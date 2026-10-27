/* Run with Node 22+ and a local Chrome/Edge. Opens only local files. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!browser)throw Error('Set CHROME_PATH to Chrome or Edge.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'faraday-qa-'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const [,file] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(!/^https?:/.test(file))assert.ok(fs.existsSync(path.resolve(__dirname,file)),`Missing local resource: ${file}`);
}
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
 assert.ok(await evaluate('lesson instanceof Classroom'));assert.equal(await evaluate('lesson.state.current'),0);assert.equal(await evaluate('document.getElementById("play").disabled'),true);
 await capture('magnet');
 // Genuine mouse input: drag each handle, verify current while moving and zero on release.
 for(const key of ['magnet','coil']){
  const point=await evaluate(`(()=>{const r=lesson.canvas.getBoundingClientRect(),p=lesson.handles.${key};return {x:r.x+p.x,y:r.y+p.y};})()`);
  const before=await evaluate(`lesson.p.${key}X`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:point.x+35,y:point.y});
  assert.notEqual(await evaluate('lesson.state.current'),0);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x+35,y:point.y});await settle();
  assert.ok(await evaluate(`lesson.p.${key}X`)>before);assert.equal(await evaluate('lesson.state.current'),0);
 }
 await input('magnetX',-15);assert.notEqual(await evaluate('lesson.state.current'),0);await delay(160);assert.equal(await evaluate('lesson.state.current'),0);
 await click('[data-view="1"]');await capture('manual-history');await click('[data-view="0"]');
 await click('[data-preset="0"]');assert.equal(await evaluate('document.getElementById("play").disabled'),false);
 await click('#play');await delay(180);await click('#play');const time=await evaluate('lesson.time');assert.ok(time>0);
 await input('speed',.5);assert.equal(await evaluate('lesson.time'),time);
 await click('#step');assert.ok(Math.abs(await evaluate('lesson.time')-time-.025)<1e-9);
 await input('time',500);assert.equal(await evaluate('lesson.time'),5);await input('time',100);assert.equal(await evaluate('lesson.time'),1);
 await click('#reset');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.running'),false);
 await click('[data-preset="2"]');await click('#step');assert.equal(await evaluate('lesson.state.current'),0);
 for(const mode of ['ac','dc']){
  await click(`[data-mode="${mode}"]`);await input('time',75);const state=await evaluate('lesson.state');assert.ok(Math.abs(state.current)>0);
  for(const view of [0,1,2]){await click(`[data-view="${view}"]`);await capture(mode+'-'+view);}
  await click('[data-view="0"]');const before=await evaluate('lesson.p.azimuth');
  const point=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:point.x+40,y:point.y+20});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x+40,y:point.y+20});
  assert.notEqual(await evaluate('lesson.p.azimuth'),before);assert.equal(await evaluate('lesson.state.current'),state.current);
  await input('rpm',0);assert.equal(await evaluate('lesson.state.current'),0);assert.equal(await evaluate('lesson.time'),0);
  await input('rpm',30);
 }
 await click('[data-mode="ac"]');await input('time',150);const ac=await evaluate('lesson.state');assert.ok(ac.current<0);
 await click('[data-mode="dc"]');const dc=await evaluate('lesson.state');assert.equal(dc.theta,ac.theta);assert.equal(dc.current,-ac.current);
 for(const signal of ['phi','emf','current']){await input('signal',signal,'change');await click('[data-view="1"]');await settle();}
 await click('[data-view="0"]');
 const sizes=[];
 for(const [width,height] of [[1024,768],[1180,820],[1366,768],[768,1024],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
  for(const presenting of [false,true]){
   await evaluate(`document.body.classList.toggle('is-presenting',${presenting})`);await settle();
   if(width<=900&&presenting&&await evaluate('!document.getElementById("controls").hidden'))await click('#controlToggle');
   const size=await evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,controlsBottom:document.getElementById("controlToggle").getBoundingClientRect().bottom,canvasBottom:lesson.canvas.getBoundingClientRect().bottom,canvasHeight:lesson.height,playBottom:document.getElementById("play").getBoundingClientRect().bottom})');
   assert.equal(size.overflow,false,JSON.stringify({width,height,presenting,...size}));assert.ok(size.canvasHeight>=200);
   if(presenting){assert.ok(size.controlsBottom<=height);assert.ok(size.playBottom<=height);assert.ok(size.canvasBottom<=height,JSON.stringify({width,height,...size}));}
   sizes.push({width,height,presenting,...size});
  }
  await capture('presentation-'+width);
  for(const view of [1,2]){await click(`[data-view="${view}"]`);if(width===390)await capture('mobile-view-'+view);}
  await click('[data-view="0"]');
  await evaluate("document.body.classList.remove('is-presenting')");if(await evaluate('document.getElementById("controls").hidden'))await click('#controlToggle');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});await click('#large');await click('#presentation');await settle();await capture('large-presentation');await click('#large');await click('#presentation');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await click('#defaults');await click('[data-view="0"]');await settle();
 const touch=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect(),h=lesson.handles.magnet;return {x:r.x+h.x,y:r.y+h.y};})()'),beforeTouch=await evaluate('lesson.p.magnetX');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x+40,y:touch.y,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 assert.notEqual(await evaluate('lesson.p.magnetX'),beforeTouch);assert.equal(await evaluate('lesson.state.current'),0);
 await click('[data-mode="ac"]');await click('#play');await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden;');assert.equal(await evaluate('lesson.running'),false);
 await send('Runtime.evaluate',{expression:'document.getElementById("fullscreen").click()',userGesture:true});await delay(100);assert.ok(await evaluate('Boolean(document.fullscreenElement)||document.body.classList.contains("is-presenting")'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'mouse + touch drag, stop current, live sliders, playback, step, seek, reset, AC/DC phase comparison, 3D camera, all views, responsive presentation, fullscreen, background pause',sizes,screenshots},null,2));
 await cmd('Browser.close');ws.close();
})().catch(e=>{console.error(e);console.error('QA screenshots: '+temp);process.exitCode=1;}).finally(()=>{clearTimeout(timeout);if(connection)connection.close();child.kill();});
