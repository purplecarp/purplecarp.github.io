const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const sandbox={window:{},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
vm.runInNewContext(fs.readFileSync(require.resolve('../js/classroom.js'),'utf8'),sandbox);
const model=require('../simulations/spring-shm/model.js');
function app(mode,params={}){
 return Object.assign(Object.create(sandbox.window.Classroom.prototype),{config:{playbackPeriod:p=>model.state(p,0).period},p:{k:10,m:2,amplitude:2,speed:1,...params},playbackMode:mode,time:0,running:true,previous:0,render(){}});
}
test('fixed playback stops exactly at one or three periods for different parameters',()=>{
 for(const mode of ['1','3'])for(const m of [.5,2,10]){
  const a=app(mode,{m,speed:2}),end=Number(mode)*model.state(a.p,0).period;
  a.time=end-.01;a.tick(100);
  assert.equal(a.time,end);assert.equal(a.running,false);
  a.play();assert.equal(a.time,0);assert.equal(a.running,true);
 }
});
test('infinite playback crosses period boundaries without resetting time or stopping',()=>{
 const a=app('infinite'),period=model.state(a.p,0).period;
 for(const cycles of [1,3,6,30]){
  const before=cycles*period-.01;a.time=before;a.previous=0;a.tick(100);
  assert.ok(Math.abs(a.time-(before+.1))<1e-10);assert.equal(a.running,true);
  assert.ok(a.duration>a.time);assert.ok(Number.isFinite(a.duration));
 }
});
test('other lessons retain their configured finite duration',()=>{
 const a=app('infinite');a.config={duration:()=>2};a.time=1.99;a.tick(100);
 assert.equal(a.unlimited,false);assert.equal(a.time,2);assert.equal(a.running,false);
});

test('photoelectric playback continues past 12 seconds and supports pause, resume and replay',()=>{
 let config;
 const photo=require('../simulations/photoelectric-effect/model.js');
 vm.runInNewContext(fs.readFileSync(require.resolve('../simulations/photoelectric-effect/lesson.js'),'utf8'),{
  PhysicsModel:photo,LessonColors:{},window:{},Classroom:function(c){config=c;}
 });
 const a=app('infinite');a.config=config;a.p={...config.defaults};a.records=[{frequency:1000,maxKE:2}];
 assert.equal(a.unlimited,true);
 for(const boundary of [12,24,120,3600]){
  a.time=boundary-.01;a.previous=0;a.tick(100);
  assert.ok(a.time>boundary);assert.equal(a.running,true);
  assert.ok(Number.isFinite(a.duration)&&a.duration>a.time);
  assert.ok(photo.events(a.p,a.time).length<=500);
 }
 a.pause();const paused=a.time;a.tick(200);assert.equal(a.time,paused);assert.equal(a.running,false);
 a.play();assert.equal(a.time,paused);assert.equal(a.running,true);
 a.tick(300);a.tick(400);assert.ok(a.time>paused);
 a.reset();assert.equal(a.time,0);assert.equal(a.running,false);assert.equal(a.records.length,1);
});

test('live wavelength input keeps playback and frame timing while updating emission',()=>{
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{
   value:'',listeners:{},classList:{add(){}},parentElement:{},
   addEventListener(type,fn){this.listeners[type]=fn;},getContext(){return {};},
   querySelector(){return node('charts');},insertBefore(){}
  });
  return nodes.get(id);
 };
 const photo=require('../simulations/photoelectric-effect/model.js');
 const env={window:{addEventListener(){}},document:{
  getElementById:node,querySelector:node,querySelectorAll:()=>[],addEventListener(){}
 },ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
 PhysicsModel:photo};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/classroom.js'),'utf8'),env);
 env.LessonColors=env.window.LessonColors;
 env.Classroom=class extends env.window.Classroom{
  sync(){} resize(){} render(){this.lastState=this.state;}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../simulations/photoelectric-effect/lesson.js'),'utf8'),env);
 const a=env.window.lesson,input=node('wavelength');
 a.time=20;a.play();a.previous=1000;a.records=[{wavelength:250}];
 for(const [wavelength,emitting] of [[400,true],[550,true],[700,false],[250,true]]){
  input.value=String(wavelength);input.listeners.input();
  assert.equal(a.running,true);assert.equal(a.time,20);assert.equal(a.previous,1000);
  assert.equal(a.lastState.emitting,emitting);
  assert.equal(a.lastState.energy,photo.HC/wavelength);
  assert.equal(a.records.length,1);
 }
 a.tick(1050);assert.ok(a.time>20);
 a.pause();const paused=a.time;input.value='450';input.listeners.input();
 assert.equal(a.running,false);assert.equal(a.time,paused);
});
