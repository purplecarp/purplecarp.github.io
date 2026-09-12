
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../simulations/photoelectric-effect/model.js');
const defaults={metal:'Cs',mode:'laser',wavelength:250,intensity:60};
test('wavelength changes preserve old photons, electron energies and graph point colors',()=>{
 let config;
 vm.runInNewContext(fs.readFileSync(require.resolve('../simulations/photoelectric-effect/lesson.js'),'utf8'),{
  PhysicsModel:M,LessonColors:{ink:'outline'},window:{},Classroom:function(c){config=c;}
 });
 const p={...defaults};config.state(p,0);
 const old=config.state(p,2),frozen=JSON.parse(JSON.stringify(old.data));
 let plotted;const a={p,time:2,records:[],graph:g=>plotted=g};
 config.comparisonViews[0].draw(a,old);const originalPoints=JSON.parse(JSON.stringify(plotted.points));
 p.wavelength=450;
 const changed=config.state(p,2);
 assert.deepEqual(JSON.parse(JSON.stringify(changed.data)),frozen);
 assert.deepEqual(changed.photons,old.photons);
 const next=config.state(p,4);
 assert.deepEqual(JSON.parse(JSON.stringify(next.data.slice(0,frozen.length))),frozen);
 assert.ok(next.data.some(e=>e.lambda===450));
 config.comparisonViews[0].draw(a,next);
 assert.deepEqual(JSON.parse(JSON.stringify(plotted.points.slice(0,frozen.length))),originalPoints);
 assert.ok(plotted.points.some(e=>e.color!=='#000000'));
 p.wavelength=700;config.state(p,4);
 const drained=config.state(p,5),later=config.state(p,7);
 assert.deepEqual(later.data,drained.data);
 p.wavelength=250;config.state(p,7);assert.ok(config.state(p,8).data.length>later.data.length);
});
test('new wavelength affects only photons launched after the change and arrival takes 0.45 seconds',()=>{
 const ex=new M.Experiment(),p={...defaults};ex.update(p,0);const before=ex.update(p,2);
 const pending=before.photons[0];p.wavelength=450;ex.update(p,2);
 const arrived=ex.update(p,2.4);
 assert.ok(arrived.data.some(e=>e.index===pending.index&&e.lambda===250));
 assert.ok(arrived.data.every(e=>e.lambda===250));
 assert.ok(ex.update(p,3).data.some(e=>e.lambda===450));
});
test('history is retained beyond 500 points; repeated rendering, clear, seek and reset are consistent',()=>{
 const ex=new M.Experiment(),p={...defaults};ex.update(p,0);
 const full=ex.update(p,50);assert.ok(full.data.length>500);
 assert.deepEqual(ex.update(p,50).data,full.data);
 ex.clearData(50);assert.equal(ex.update(p,50).data.length,0);
 const fresh=ex.update(p,51);assert.ok(fresh.data.length>0);assert.ok(fresh.data.every(e=>e.emittedAt>50));
 ex.update(p,10);const resumed=ex.update(p,11);
 assert.ok(resumed.data.every(e=>e.emittedAt>10&&e.emittedAt<=11));
 assert.equal(new Set(resumed.data.map(e=>e.index)).size,resumed.data.length);
 ex.reset();assert.equal(ex.update(p,0).data.length,0);
});
test('rewinding branches from historical photons without changing their captured wavelength',()=>{
 const ex=new M.Experiment(),p={...defaults};ex.update(p,0);ex.update(p,2);
 p.wavelength=450;ex.update(p,2);ex.update(p,4);
 const past=ex.update(p,1);assert.ok(past.data.every(e=>e.lambda===250));
 const resumed=ex.update(p,3);
 assert.ok(resumed.data.some(e=>e.lambda===250));assert.ok(resumed.data.some(e=>e.lambda===450));
 assert.equal(new Set(resumed.data.map(e=>e.index)).size,resumed.data.length);
});
