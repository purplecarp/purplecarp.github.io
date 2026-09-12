const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const model=require('../simulations/spring-shm/model.js');
let config;
vm.runInNewContext(fs.readFileSync(require.resolve('../simulations/spring-shm/lesson.js'),'utf8'),{
 window:{},PhysicsModel:model,LessonColors:{},Classroom:function(value){config=value;}
});
function trail(t,params={}){
 const dots=[],p={...config.defaults,...params};
 const ctx=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
 config.views[0].draw({p,width:800,height:450,ctx,text(){},line(){},arrow(){},dot(x,y,r){if(r===2)dots.push([x,y]);}},model.state(p,t));
 return dots;
}
test('spring trails: new frames preserve every previously generated circle and spring dot',()=>{
 let previous=trail(0);
 for(const time of [.016,.049,.051,.073,.099,.101,1.237,10.123,10.177,20.019]){
  const current=trail(time);
  assert.deepEqual(current.slice(0,previous.length),previous);
  previous=current;
 }
 assert.ok(previous.length>402,'retain samples beyond the former 200-step window');
});
test('spring trails: playback speed and display toggles preserve positions',()=>{
 const original=trail(1.237);
 assert.deepEqual(trail(1.237,{speed:2,velocity:false,acceleration:false,force:true}),original);
 assert.deepEqual(trail(1.237,{trail:false}),[]);
 assert.deepEqual(trail(1.237),original);
});
test('spring trails: seeking back and replay rebuild the same fixed history',()=>{
 const later=trail(2.237),earlier=trail(.237);
 assert.deepEqual(later.slice(0,earlier.length),earlier);
 assert.equal(trail(0).length,2);
 assert.deepEqual(trail(2.237),later);
});
