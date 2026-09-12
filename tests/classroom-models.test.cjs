const {test}=require('node:test');const assert=require('node:assert/strict');
const collision=require('../simulations/elastic-collision/model.js');
const spring=require('../simulations/spring-shm/model.js');
const magnetic=require('../simulations/charged-particle-magnetic-field/model.js');
const hydrogen=require('../simulations/hydrogen-standing-wave/model.js');
const photo=require('../simulations/photoelectric-effect/model.js');
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('collision: equal mass exchange and unequal mass hand calculation',()=>{assert.deepEqual(collision.velocities(2,2,5,-1),[-1,5]);const v=collision.velocities(2,4,4,-4);near(v[0],-20/3);near(v[1],4/3);});
test('collision: energy, isolated momentum, and non-overlap at parameter extremes',()=>{
 for(const m1 of [.5,2,10])for(const m2 of [.5,4,10])for(const u1 of [-8,0,8])for(const u2 of [-8,0,8])for(const walls of [false,true]){
 const p={m1,m2,u1,u2,walls},start=collision.state(p,0);
 for(const t of [.1,1,4,8]){const s=collision.state(p,t);near(s.energy,start.energy);if(!walls)near(s.momentum,start.momentum);assert.ok(s.x2-s.x1>=s.r1+s.r2-1e-8);if(walls){assert.ok(s.x1>=s.r1-1e-8);assert.ok(s.x2<=20-s.r2+1e-8);}}
 }});
test('collision: equal velocities cannot collide without walls',()=>{assert.equal(collision.state({m1:2,m2:2,u1:3,u2:3,walls:false},8).count,0);});
test('spring: quarter-period, circle projection, and conserved energy',()=>{
 for(const k of [1,10])for(const m of [.5,2,10])for(const amplitude of [.5,2,5]){const p={k,m,amplitude},initial=spring.state(p,0),s=spring.state(p,initial.period/4);near(s.x,0);near(s.v,-amplitude*Math.sqrt(k/m));near(s.a,0);for(const t of [.12,.8,2]){const z=spring.state(p,t);near(z.a,-k/m*z.x);near(.5*m*z.v*z.v+.5*k*z.x*z.x,initial.energy);near(z.x*z.x+z.circleY*z.circleY,amplitude*amplitude);}}
});
const mag={charge:1.6,mass:1.67,field:1,direction:'out',velocity:5,angle:90,position:'right'};
test('magnetic: correct SI radius, direction and full-period return',()=>{const s=magnetic.state(mag,0);near(s.radius,.0521875);assert.ok(s.fx>0);const end=magnetic.state(mag,s.period);near(end.x,s.x);near(end.y,s.y);near(end.vx,s.vx,1e-6);near(end.vy,s.vy);assert.ok(magnetic.state({...mag,charge:-1.6},0).fx<0);assert.ok(magnetic.state({...mag,direction:'in'},0).fx<0);});
test('magnetic: charge and field zero give a straight line',()=>{for(const p of [{...mag,charge:0},{...mag,field:0}]){const s=magnetic.state(p,10);near(s.x,.05);near(s.y,.05);near(s.fx,0);assert.equal(s.radius,Infinity);}});
test('magnetic: speed and perpendicular force at extremes',()=>{for(const charge of [-5,.1,5])for(const mass of [.5,10])for(const field of [.1,5]){const p={...mag,charge,mass,field},s=magnetic.state(p,50);near(s.speed,5e6);near((s.fx*s.vx+s.fy*s.vy)/Math.max(1,Math.hypot(s.fx,s.fy)*s.speed),0);}});
test('hydrogen: integer wavelengths and Bohr radii',()=>{for(let n=1;n<=7;n++){const s=hydrogen.state({lock:true,n},0);near(s.radius,n*n);near(s.ratio,n);near(s.mismatch,0);assert.equal(s.allowed,true);near(s.energy,-13.6/(n*n));}});
test('hydrogen: matching endpoint heights at half-integer still fail phase closure',()=>{const p={lock:false,radius:4,wavelength:8*Math.PI/2.5};near(hydrogen.wave(p,0,0),hydrogen.wave(p,0,2*Math.PI));assert.equal(hydrogen.state(p,0).allowed,false);near(Math.abs(hydrogen.state(p,0).mismatch),Math.PI);assert.equal(hydrogen.state(p,0).energy,null);});
const pe={metal:'Cs',mode:'laser',wavelength:250,intensity:60};
test('photoelectric: photon energy, threshold and intensity independence',()=>{const s=photo.state(pe,1);near(s.energy,photo.HC/250);near(s.maxKE,s.energy-2.14);near(photo.state({...pe,intensity:100},1).maxKE,s.maxKE);assert.equal(photo.state({...pe,wavelength:700,intensity:100},1).emitting,false);});
test('photoelectric: dark source produces no photons or electrons in all modes',()=>{for(const mode of ['laser','white','all']){const p={...pe,mode,intensity:0};assert.equal(photo.state(p,12).rate,0);assert.equal(photo.state(p,12).emitting,false);assert.deepEqual(photo.events(p,12),[]);}});
test('photoelectric: white light is visible and individual energies stay below maximum',()=>{for(let i=1;i<=100;i++){const e=photo.sample({...pe,mode:'white'},i);assert.ok(e.lambda>=380&&e.lambda<=750);assert.ok(e.energy>=0&&e.energy<=Math.max(0,e.maximum));}assert.deepEqual(photo.events({...pe,mode:'white',metal:'Pt'},12),[]);assert.ok(photo.events(pe,3).every(e=>e.age>=0));});

test('photoelectric: all-band light covers UV, visible and IR with consistent energy bounds',()=>{
 const p={...pe,mode:'all'},s=photo.state(p,0);
 near(s.energy,photo.HC/200);near(s.minEnergy,photo.HC/800);
 near(s.maxKE,photo.HC/200-photo.metals.Cs);
 assert.equal(photo.state({...p,wavelength:800},0).energy,s.energy);
 const samples=Array.from({length:1000},(_,i)=>photo.sample(p,i+1));
 assert.ok(samples.every(e=>e.lambda>=200&&e.lambda<=800&&e.energy>=0&&e.energy<=s.maxKE));
 assert.ok(samples.some(e=>e.lambda<380));assert.ok(samples.some(e=>e.lambda>=380&&e.lambda<=750));assert.ok(samples.some(e=>e.lambda>750));
 const electrons=photo.events({...p,metal:'Pt'},12);
 assert.ok(electrons.length>0);
 assert.ok(electrons.every(e=>e.maximum>0&&e.energy<=photo.HC/e.lambda-photo.metals.Pt&&e.age>=0));
});
