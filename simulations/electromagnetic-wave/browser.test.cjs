/* Node 22+, local Chrome/Edge. No package installation or network required. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!browser)throw Error('Set CHROME_PATH to Chrome or Edge.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'em-wave-qa-'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const [,file] of html.matchAll(/(?:src|href)="([^"]+)"/g))if(!/^https?:/.test(file))assert.ok(fs.existsSync(path.resolve(__dirname,file)),`Missing resource: ${file}`);
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
 assert.ok(await evaluate('lesson instanceof Classroom'));assert.equal(await evaluate('lesson.state.ey'),3);
 await capture('desktop-wave');
 // Mouse dragging rotates the camera without touching the clock or physical field state.
 const fieldBefore=await evaluate('lesson.state');
 const dragPoint=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...dragPoint});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:dragPoint.x+100,y:dragPoint.y+55});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:dragPoint.x+100,y:dragPoint.y+55});await settle();
 assert.notEqual(await evaluate('lesson.p.azimuth'),-25);assert.notEqual(await evaluate('lesson.p.elevation'),20);
 assert.deepEqual(await evaluate('lesson.state'),fieldBefore);await capture('rotated-wave');
 await click('[data-action="0"]');assert.equal(await evaluate('lesson.p.azimuth'),-25);assert.deepEqual(await evaluate('lesson.state'),fieldBefore);
 // Wheel zoom affects only the camera, stays bounded, and leaves page scroll untouched.
 const scrollBefore=await evaluate('scrollY');
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',...dragPoint,deltaX:0,deltaY:-240});await settle();
 assert.ok(await evaluate('lesson.p.zoom')>1);assert.equal(await evaluate('scrollY'),scrollBefore);
 assert.deepEqual(await evaluate('lesson.state'),fieldBefore);await capture('wheel-zoom');
 const enlarged=await evaluate('lesson.p.zoom');
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',...dragPoint,deltaX:0,deltaY:120});await settle();assert.ok(await evaluate('lesson.p.zoom')<enlarged);
 for(const [delta,expected] of [[-10000,3],[10000,.5]]){
  await evaluate(`for(let i=0;i<5;i++)lesson.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:${delta},cancelable:true}))`);assert.equal(await evaluate('lesson.p.zoom'),expected);
 }
 await input('zoom',2);assert.deepEqual(await evaluate('lesson.state'),fieldBefore);
 await click('[data-action="0"]');assert.equal(await evaluate('lesson.p.zoom'),1);
 await click('[data-view="1"]');
 assert.equal(await evaluate('lesson.canvas.dispatchEvent(new WheelEvent("wheel",{deltaY:-200,cancelable:true}))'),true);
 assert.equal(await evaluate('lesson.p.zoom'),1);await click('[data-view="0"]');
 // Continuous time crosses multiple former endpoints at a frequency with a non-integral period.
 await input('frequency',70);
 for(const boundary of [30,60,90]){
  await evaluate(`lesson.time=${boundary}-.05;lesson.play();lesson.previous=1000;lesson.tick(1020);lesson.pause()`);
  assert.ok(await evaluate('lesson.time')>boundary);assert.equal(await evaluate('lesson.unlimited'),true);
  assert.equal(await evaluate('lesson.duration'),boundary+30);
  await click('[data-view="2"]');await capture('continuous-graph-'+boundary);
 }
 await click('#defaults');await click('[data-view="0"]');
 await click('#play');await delay(220);await click('#play');const time=await evaluate('lesson.time');assert.ok(time>0);
 await input('speed',.5);assert.equal(await evaluate('lesson.time'),time);
 await click('#step');assert.ok(Math.abs(await evaluate('lesson.time')-time-.25)<1e-9);
 await input('time',500);assert.equal(await evaluate('lesson.time'),15);await input('time',100);assert.equal(await evaluate('lesson.time'),3);
 await input('probe',1.5);assert.equal(await evaluate('lesson.time'),3);
 await click('#showE');assert.equal(await evaluate('lesson.time'),3);assert.equal(await evaluate('lesson.p.showE'),false);
 await click('#showE');await click('#showB');await click('#showB');await click('#vectors');await click('#vectors');
 await input('frequency',150);assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.state.lambda'),2);
 await input('time',100);await click('#reset');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.p.frequency'),150);
 await click('#defaults');assert.equal(await evaluate('lesson.p.frequency'),100);
 await click('[data-preset="2"]');assert.equal(await evaluate('lesson.state.bnT'),-10);await click('[data-view="1"]');await capture('reverse-direction');
 await click('#reveal');assert.equal(await evaluate('document.getElementById("answer").hidden'),false);
 await click('[data-preset="3"]');assert.equal(await evaluate('lesson.state.ey'),0);assert.equal(await evaluate('lesson.state.bnT'),0);
 await capture('zero-field');await click('[data-view="2"]');await capture('zero-amplitude-graph');await click('#defaults');await click('[data-view="2"]');await input('time',500);await capture('phase-graph');
 // Every screen size, view, and presentation mode must fit horizontally and retain controls.
 const sizes=[];
 for(const [width,height] of [[1024,768],[1180,820],[1366,768],[768,1024],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
  for(const presenting of [false,true]){
   await evaluate(`document.body.classList.toggle('is-presenting',${presenting})`);await settle();
   if(width<=900&&presenting&&await evaluate('!document.getElementById("controls").hidden'))await click('#controlToggle');
   for(const view of [0,1,2]){
    await click(`[data-view="${view}"]`);
    const size=await evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,controlsBottom:document.getElementById("controlToggle").getBoundingClientRect().bottom,canvasBottom:lesson.canvas.getBoundingClientRect().bottom,canvasHeight:lesson.height,playBottom:document.getElementById("play").getBoundingClientRect().bottom})');
    assert.equal(size.overflow,false,JSON.stringify({width,height,presenting,...size}));assert.ok(size.canvasHeight>=200,JSON.stringify(size));
    if(presenting){assert.ok(size.controlsBottom<=height);assert.ok(size.playBottom<=height);assert.ok(size.canvasBottom<=height,JSON.stringify(size));}
    if(width===390||width===1024)await capture(`${width}-${presenting?'presentation':'normal'}-view${view}`);
    sizes.push({width,height,presenting,view,canvasHeight:size.canvasHeight});
   }
  }
  await evaluate("document.body.classList.remove('is-presenting')");if(await evaluate('document.getElementById("controls").hidden'))await click('#controlToggle');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});await click('#defaults');await click('[data-view="0"]');await click('#large');await click('#presentation');await settle();await capture('large-presentation');await click('#large');await click('#presentation');
 // Single-finger camera rotation on a mobile viewport.
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('document.body.classList.add("is-presenting")');await click('#controlToggle');await settle();
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2,configuration:'mobile'});
 const touchCanvas=await evaluate('(()=>{const r=lesson.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()'),beforeTouch=await evaluate('lesson.p.azimuth');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchCanvas,id:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchCanvas.x+70,y:touchCanvas.y+25,id:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 assert.notEqual(await evaluate('lesson.p.azimuth'),beforeTouch);assert.equal(await evaluate('lesson.time'),0);
 const pinchAngles=await evaluate('[lesson.p.azimuth,lesson.p.elevation]');
 const fingers=gap=>[{x:touchCanvas.x-gap,y:touchCanvas.y,id:1},{x:touchCanvas.x+gap,y:touchCanvas.y,id:2}];
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:fingers(40)});
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(75)});await settle();
 assert.ok(await evaluate('lesson.p.zoom')>1.7);assert.deepEqual(await evaluate('[lesson.p.azimuth,lesson.p.elevation]'),pinchAngles);
 assert.equal(await evaluate('lesson.time'),0);await capture('mobile-pinch-zoom');
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(10)});await settle();assert.equal(await evaluate('lesson.p.zoom'),.5);
 await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();assert.equal(await evaluate('lesson.canvas.classList.contains("dragging")'),false);
 await click('[data-action="0"]');assert.equal(await evaluate('lesson.p.zoom'),1);
 await click('[data-view="1"]');assert.equal(await evaluate('lesson.canvas.classList.contains("rotatable")'),false);
 await click('[data-view="0"]');assert.equal(await evaluate('lesson.canvas.classList.contains("rotatable")'),true);
 await click('#play');await delay(150);assert.equal(await evaluate('lesson.running'),true);
 await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden;');assert.equal(await evaluate('lesson.running'),false);
 await send('Runtime.evaluate',{expression:'document.getElementById("fullscreen").click()',userGesture:true});await delay(100);assert.ok(await evaluate('Boolean(document.fullscreenElement)||document.body.classList.contains("is-presenting")'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'wheel zoom and bounds, two-finger pinch in/out and cancellation, continuous playback, mouse and touch rotation, camera reset preserves physics, playback controls, responsive layouts',sizes,screenshots},null,2));
 await cmd('Browser.close');ws.close();
})().catch(e=>{console.error(e);console.error('QA screenshots: '+temp);process.exitCode=1;}).finally(()=>{clearTimeout(timeout);if(connection)connection.close();child.kill();});
