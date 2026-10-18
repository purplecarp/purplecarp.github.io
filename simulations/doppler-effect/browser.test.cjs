/* Dependency-free browser QA: Node 22+ and locally installed Chrome or Edge. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!browser)throw Error('Set CHROME_PATH to a Chrome or Edge executable.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'doppler-qa-'));
let connection;
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
    let stderr='';child.stderr.on('data',d=>stderr+=d);
    for(let i=0;i<100&&!/DevTools listening on (ws:\/\/[^\s]+)/.test(stderr);i++)await delay(100);
    const address=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(!address)throw Error('Browser did not start: '+stderr);
    const ws=new WebSocket(address);connection=ws;await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    let next=0;const pending=new Map(),errors=[];
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}};
    function cmd(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{} )}));});}
    const {targetId}=await cmd('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await cmd('Target.attachToTarget',{targetId,flatten:true});
    const send=(method,params={})=>cmd(method,params,sessionId);
    await send('Runtime.enable');await send('Page.enable');
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'index.html')).href});
    for(let i=0;i<100;i++){if(await evaluate('Boolean(window.lesson && lesson.audio)'))break;await delay(100);}
    assert.equal(await evaluate('Boolean(window.lesson && lesson.audio)'),true);
    assert.equal(await evaluate('lesson.p.offset'),0);
    assert.equal(await evaluate('document.getElementById("offset").min'),'0');
    assert.equal(await evaluate('lesson.state.sy===lesson.state.oy'),true);
    assert.equal(await evaluate('lesson.comparisons.length'),1);
    await evaluate(`window.chartTimes=[];const chart=lesson.config.comparisonViews[0],draw=chart.draw;chart.draw=(a,s)=>{chartTimes.push(s.t);draw(a,s);};`);
    for(const time of [0,5.99,6,6.01,12,2]){
     await evaluate(`lesson.time=${time};lesson.render();`);
     assert.equal(await evaluate('chartTimes.at(-1)'),time);
    }
    await evaluate('document.getElementById("offset").value=60;document.getElementById("offset").dispatchEvent(new Event("input"));');
    assert.equal(await evaluate('lesson.p.offset'),60);
    assert.equal(await evaluate('lesson.time'),0);
    await evaluate('document.getElementById("defaults").click()');
    assert.equal(await evaluate('lesson.p.offset'),0);
    const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))');
    const result={sizes:[],checks:[],screenshots:[]};
    for(const [width,height] of [[1024,768],[1180,820],[1366,768],[768,1024],[390,844],[320,640]]){
     await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
     for(const presenting of [false,true]){
      await evaluate(`document.body.classList.toggle('is-presenting',${presenting}); if(${width}<=900&&!document.getElementById('controls').hidden)document.getElementById('controlToggle').click();`);
      await settle();
      const size=await evaluate(`(()=>{const c=document.getElementById('scene').getBoundingClientRect(),b=document.getElementById('play').getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:c.height,playBottom:b.bottom,presenting:document.body.classList.contains('is-presenting')};})()`);
      assert.ok(size.scroll<=width+1,JSON.stringify(size));assert.ok(size.canvas>=130,JSON.stringify(size));
      if(presenting)assert.ok(size.playBottom<=height,JSON.stringify(size));
      result.sizes.push(size);
     }
     await evaluate("document.body.classList.remove('is-presenting')");
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1180,height:820,deviceScaleFactor:2,mobile:false});
    await evaluate("if(document.getElementById('controls').hidden)document.getElementById('controlToggle').click(); document.getElementById('defaults').click();");
    await settle();
    const capture=async name=>{await settle();const {data}=await send('Page.captureScreenshot',{format:'png'});const file=path.join(temp,name+'.png');fs.writeFileSync(file,Buffer.from(data,'base64'));result.screenshots.push(file);};
    await capture('doppler-desktop');
    assert.equal(await evaluate('document.getElementById("answer").hidden'),true);
    await evaluate('document.getElementById("reveal").click()');assert.equal(await evaluate('document.getElementById("answer").hidden'),false);
    await evaluate('document.getElementById("play").click()');await delay(250);await evaluate('document.getElementById("play").click()');
    const t=await evaluate('lesson.time');assert.ok(t>0);await delay(100);assert.equal(await evaluate('lesson.time'),t);
    await evaluate('document.getElementById("speed").value="2";document.getElementById("speed").dispatchEvent(new Event("input"));document.getElementById("waves").click();');
    assert.equal(await evaluate('lesson.time'),t);
    await evaluate('document.getElementById("step").click()');assert.ok(Math.abs(await evaluate('lesson.time')-t-.05)<1e-8);
    await evaluate('document.getElementById("reset").click()');assert.equal(await evaluate('lesson.time'),0);
    await evaluate('document.getElementById("time").value=750;document.getElementById("time").dispatchEvent(new Event("input"));');assert.equal(await evaluate('lesson.time'),9);
    await evaluate('document.getElementById("time").value=250;document.getElementById("time").dispatchEvent(new Event("input"));');assert.equal(await evaluate('lesson.time'),3);
    await evaluate('document.getElementById("sourceSpeed").value=200;document.getElementById("sourceSpeed").dispatchEvent(new Event("input"));');assert.equal(await evaluate('lesson.time'),0);assert.equal(await evaluate('lesson.running'),false);
    for(const mode of ['source','observer','both','stationary']){
     await evaluate(`document.getElementById('mode').value='${mode}';document.getElementById('mode').dispatchEvent(new Event('change'));`);
     assert.equal(await evaluate('document.getElementById("sourceSpeed").disabled'),mode==='observer'||mode==='stationary');
     assert.equal(await evaluate('document.getElementById("observerSpeed").disabled'),mode==='source'||mode==='stationary');
    }
    for(let i=0;i<5;i++){await evaluate(`document.querySelector('[data-preset="${i}"]').click();`);assert.equal(await evaluate('lesson.time'),0);}
    result.checks.push('play, pause, step, replay, rewind, defaults, presets, disabled controls, display parameters preserve time');
    await evaluate('document.getElementById("defaults").click();document.getElementById("speed").value=".25";document.getElementById("speed").dispatchEvent(new Event("input"));');
    // User-gesture evaluation permits the same AudioContext activation as a button click.
    await send('Runtime.evaluate',{expression:'document.getElementById("soundToggle").click()',userGesture:true});await delay(400);
    assert.equal(await evaluate('lesson.audio.context.state'),'running');assert.equal(await evaluate('lesson.audio.enabled'),true);assert.ok(await evaluate('lesson.audio.targetGain>0'));
    await evaluate('window.analyser=lesson.audio.context.createAnalyser();analyser.fftSize=32768;lesson.audio.gain.connect(analyser);');await delay(800);
    const signal=await evaluate('(()=>{const d=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(d);let n=0,peak=0;for(let i=1;i<d.length;i++){if(d[i-1]<0&&d[i]>=0)n++;peak=Math.max(peak,Math.abs(d[i]));}return {hz:n*lesson.audio.context.sampleRate/d.length,peak,expected:lesson.state.frequency};})()');
    assert.ok(signal.peak>0.001,JSON.stringify(signal));assert.ok(Math.abs(signal.hz-signal.expected)<4,JSON.stringify(signal));result.audioSignal=signal;
    await evaluate('document.getElementById("soundMode").value="source";document.getElementById("soundMode").dispatchEvent(new Event("change"));');assert.equal(await evaluate('lesson.audio.targetFrequency'),440);
    await evaluate('lesson.pause()');assert.equal(await evaluate('lesson.audio.targetGain'),0);await delay(150);
    assert.ok(await evaluate('lesson.audio.gain.gain.value<.0001'));
    await evaluate('lesson.play();Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));delete document.hidden;');assert.equal(await evaluate('lesson.running'),false);assert.equal(await evaluate('lesson.audio.targetGain'),0);
    await evaluate('document.getElementById("defaults").click()');assert.equal(await evaluate('lesson.audio.enabled'),false);
    await evaluate('document.getElementById("time").value=1000;document.getElementById("time").dispatchEvent(new Event("input"));');
    assert.equal(await evaluate('document.getElementById("step").disabled'),true);
    await capture('doppler-frequency');
    await evaluate('document.querySelectorAll("[data-view]")[0].click();document.getElementById("presentation").click();document.getElementById("large").click();document.getElementById("reset").click();');await capture('doppler-presentation');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await evaluate('document.getElementById("large").click();document.getElementById("controlToggle").click();');await settle();await capture('doppler-mobile');
    await evaluate('document.getElementById("time").value=1000;document.getElementById("time").dispatchEvent(new Event("input"));document.getElementById("comparison-0").scrollIntoView({block:"center"});');await capture('doppler-mobile-frequency');
    result.checks.push('real Web Audio signal frequency and amplitude, original-tone comparison, pause/background mute, end state, graph, large text, presentation');
    assert.deepEqual(errors,[]);result.consoleErrors=errors;console.log(JSON.stringify(result,null,2));
    await cmd('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(connection)connection.close();child.kill();});
