/* Template and 3D browser QA: Node 22+ and a locally installed Chrome or Edge. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!browser)throw Error('Set CHROME_PATH to a Chrome or Edge executable.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'magnetic-template-qa-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let connection;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=setTimeout(()=>{child.kill();process.exitCode=1;console.error('Browser QA timed out');if(connection)connection.close();},90000);
(async()=>{
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 for(let i=0;i<100&&!/DevTools listening on (ws:\/\/[^\s]+)/.test(stderr);i++)await delay(100);
 const address=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(!address)throw Error('Browser did not start: '+stderr);
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
 await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'index.html')).href});
 for(let i=0;i<100;i++){if(await evaluate('Boolean(window.lesson)'))break;await delay(100);}await settle();
 assert.ok(await evaluate('lesson instanceof Classroom'));assert.equal(await evaluate('document.querySelectorAll("[data-view]").length'),3);
 assert.ok(await evaluate('["play","step","reset","time","speed"].every(id=>document.getElementById(id).getClientRects().length===0)'));
 assert.equal(await evaluate('document.getElementById("flow")'),null);
 await evaluate('lesson.play()');await delay(80);assert.equal(await evaluate('lesson.running'),false);assert.equal(await evaluate('lesson.frame'),null);assert.equal(await evaluate('lesson.time'),0);
 assert.equal(await evaluate('document.getElementById("answer").hidden'),true);await click('#reveal');assert.equal(await evaluate('document.getElementById("answer").hidden'),false);
 const screenshots=[];async function capture(name){const {data}=await send('Page.captureScreenshot',{format:'png'});const file=path.join(temp,name+'.png');fs.writeFileSync(file,Buffer.from(data,'base64'));screenshots.push(file);}
 for(const mode of ['wire','loop','solenoid']){
  await input('mode',mode,'change');await input('current',5);await click('[data-action="3"]');
  const magnitude=await evaluate('lesson.state.field.magnitude');assert.ok(magnitude>0);
  for(const view of [0,1,2]){await click(`[data-view="${view}"]`);assert.equal(await evaluate('lesson.state.field.magnitude'),magnitude);await capture(mode+'-view-'+view);}
  await click('[data-view="1"]');const time=await evaluate('lesson.time');
  await input('azimuth',75);await input('elevation',50);await input('zoom',1.2);
  assert.equal(await evaluate('lesson.time'),time);assert.equal(await evaluate('lesson.state.field.magnitude'),magnitude);
  await click('[data-action="3"]');assert.equal(await evaluate('lesson.p.azimuth'),-40);assert.equal(await evaluate('lesson.time'),time);
  const r=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5};})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:r.x+60,y:r.y+20});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:r.x+60,y:r.y+20});await settle();
  assert.ok(Math.abs(await evaluate('lesson.p.azimuth')+10)<1);assert.equal(await evaluate('lesson.state.field.magnitude'),magnitude);assert.equal(await evaluate('lesson.time'),time);
  await click('[data-action="0"]');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.p.current'),-5);
  await click('[data-action="1"]');assert.equal(await evaluate('lesson.state.field.magnitude'),0);
  await input('current',10);assert.ok(Math.abs(await evaluate('lesson.state.field.magnitude')/magnitude-2)<1e-10);
  await input('radius',16);if(mode!=='wire')assert.equal(await evaluate('lesson.state.physical.radius'),.16);await input('radius',8);
  if(mode==='solenoid'){await input('turns',40);await input('length',80);assert.equal(await evaluate('lesson.p.turns'),40);await input('turns',20);await input('length',50);}
 }
 await click('#defaults');await click('[data-view="0"]');
 assert.equal(await evaluate('lesson.p.mode'),'wire');assert.equal(await evaluate('lesson.p.current'),5);
 await input('probeX',0);await input('probeY',0);assert.equal(await evaluate('lesson.state.field.excluded'),true);await click('[data-action="2"]');
 await evaluate('lesson.canvas.focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});assert.equal(await evaluate('lesson.p.probeX'),13);
 await click('#vectors');await input('current',6);assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.running'),false);
 assert.ok(await evaluate('!document.getElementById("status").textContent.includes("暫停")'));
 for(let i=0;i<3;i++){await click(`[data-preset="${i}"]`);assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('document.getElementById("answer").hidden'),true);}
 await click('#defaults');await input('mode','solenoid','change');await click('[data-view="1"]');
 const sizes=[];
 for(const [width,height] of [[1024,768],[1180,820],[1366,768],[768,1024],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
  for(const presenting of [false,true]){
   await evaluate(`document.body.classList.toggle('is-presenting',${presenting})`);await settle();
   if(width<=900&&presenting&&await evaluate('!document.getElementById("controls").hidden'))await click('#controlToggle');
   const size=await evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,controlsBottom:document.getElementById("controlToggle").getBoundingClientRect().bottom,canvasBottom:lesson.canvas.getBoundingClientRect().bottom,canvasHeight:lesson.height})');
   assert.equal(size.overflow,false,JSON.stringify({width,height,presenting,...size}));assert.ok(size.canvasHeight>=140);
   if(presenting){assert.ok(size.controlsBottom<=height);assert.ok(size.canvasBottom<=height,JSON.stringify({width,height,...size}));}
   sizes.push({width,height,presenting,...size});
  }
  if(width===1024||width===390)await capture('presentation-'+width);
  await evaluate("document.body.classList.remove('is-presenting')");if(await evaluate('document.getElementById("controls").hidden'))await click('#controlToggle');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});await click('#large');await click('#presentation');await settle();await capture('large-presentation');
 await click('#large');await click('#presentation');await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden;');assert.equal(await evaluate('lesson.running'),false);
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const touch=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()'),beforeTouch=await evaluate('lesson.p.azimuth');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x+40,y:touch.y+10,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 assert.notEqual(await evaluate('lesson.p.azimuth'),beforeTouch);
 await send('Runtime.evaluate',{expression:'document.getElementById("fullscreen").click()',userGesture:true});await delay(100);
 assert.ok(await evaluate('Boolean(document.fullscreenElement)||document.body.classList.contains("is-presenting")'));
 await evaluate('document.fullscreenElement?document.exitFullscreen():document.body.classList.remove("is-presenting")');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'Static Classroom shell; playback/timeline/speed hidden; no animation loop; all 3 geometries × 3 views; enlarged arrows; 3D pointer rotation; invariant measurements; current reversal/zero; presets; responsive presentation',sizes,screenshots},null,2));
 await cmd('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearTimeout(timeout);if(connection)connection.close();child.kill();});
