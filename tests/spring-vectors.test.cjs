const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../simulations/spring-shm/model.js');let config;
vm.runInNewContext(fs.readFileSync(require.resolve('../simulations/spring-shm/lesson.js'),'utf8'),{window:{},PhysicsModel:model,LessonColors:{},Classroom:function(c){config=c;}});
function vectors(params,phase=0){
 const p={...config.defaults,force:true,...params},arrows={};
 const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const state=model.state(p,phase*model.state(p,0).period);
 config.views[0].draw({p,width:800,height:450,ctx,text(){},line(){},dot(){},arrow(x,y,dx,dy,color,label){arrows[label]={dx,dy};}},state);
 return arrows;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('spring arrows: doubling k doubles force and acceleration at the same phase',()=>{
 for(const phase of [0,.125,.5,.625]){
  const first=vectors({k:5},phase),second=vectors({k:10},phase);
  for(const label of ['F','aₓ','a']){near(second[label].dx,2*first[label].dx);near(second[label].dy,2*first[label].dy);}
 }
});
test('spring arrows: doubling mass halves acceleration and preserves force',()=>{
 for(const phase of [0,.125,.5,.625]){
  const first=vectors({m:2},phase),second=vectors({m:4},phase);
  near(second.F.dx,first.F.dx);
  for(const label of ['aₓ','a']){near(second[label].dx,first[label].dx/2);near(second[label].dy,first[label].dy/2);}
 }
});
test('spring arrows: circle acceleration projects to spring acceleration and arrows stay bounded',()=>{
 for(const k of [1,10])for(const m of [.5,10])for(const amplitude of [.5,5])for(const phase of [0,.125,.25,.5,.75]){
  const arrows=vectors({k,m,amplitude},phase);
  near(arrows.a.dx,arrows['aₓ'].dx);
  for(const label of ['F','aₓ','a'])assert.ok(Math.hypot(arrows[label].dx,arrows[label].dy)<=(label==='F'?80:1200)+1e-9);
 }
});

test('spring arrows: default k=5 and m=5 acceleration remains clearly visible',()=>{
 assert.equal(config.defaults.k,5);assert.equal(config.defaults.m,5);
 const arrows=vectors({});
 near(Math.abs(arrows['aₓ'].dx),48);
 near(arrows.a.dx,arrows['aₓ'].dx);
});
