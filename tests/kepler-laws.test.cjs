const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../simulations/kepler-laws/model.js');
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('Kepler: circular hand calculation and full-period return',()=>{
 const s=M.orbit(1,0,1,0),q=M.orbit(1,0,1,.25);
 near(s.period,1);near(s.r,1);near(s.speed,2*Math.PI);near(q.x,0);near(q.y,1);
 for(const e of [0,.5,.85]){const start=M.orbit(1,e,1,0),end=M.orbit(1,e,1,1);near(start.x,end.x);near(start.y,end.y);}
});
test('Kepler: perihelion, aphelion and speed ratio',()=>{
 const p=M.orbit(2,.5,1,0),q=M.orbit(2,.5,1,p.period/2);
 near(p.r,1);near(q.r,3);near(p.speed/q.speed,3);
});
test('Kepler: ellipse, vis-viva, energy and angular momentum at all parameter extremes',()=>{
 for(const a of [.5,1.5,4])for(const e of [0,.5,.85])for(const mass of [.5,1,2]){
  const T=M.period(a,mass),mu=4*Math.PI*Math.PI*mass;
  for(const fraction of [0,.001,.1,.25,.5,.9,1,2.75,-.1]){
   const s=M.orbit(a,e,mass,T*fraction);
   near(Math.hypot(s.x,s.y)+Math.hypot(s.x+2*a*e,s.y),2*a);
   near(s.speed*s.speed,mu*(2/s.r-1/a));near(s.speed*s.speed/2-mu/s.r,s.energy);
   near(s.x*s.vy-s.y*s.vx,s.angularMomentum);
   near(s.areaRate,s.angularMomentum/2);assert.ok(Object.values(s).every(Number.isFinite));
  }
 }
});
test('Kepler: independent polygon integration gives equal areas near both apsides, including wraparound',()=>{
 function area(points){let sum=0;for(let i=1;i<points.length;i++)sum+=points[i-1].x*points[i].y-points[i].x*points[i-1].y;return sum/2;}
 for(const e of [0,.5,.85])for(const divisions of [8,12,16]){
  const T=M.period(1.5,1),dt=T/divisions;
  const peri=area(M.sector(1.5,e,1,-dt/2,dt,4000));
  const apo=area(M.sector(1.5,e,1,T/2-dt/2,dt,4000));
  near(peri,apo,2e-6);near(peri,M.sweptArea(1.5,e,1,dt),2e-6);
 }
});
test('Kepler: third law uses semimajor axis, independent of eccentricity',()=>{
 for(const mass of [.5,1,2])for(const a of [.5,4])for(const e of [0,.85])near(M.orbit(a,e,mass,.5).ratio,1/mass);
 near(M.period(3,1)/M.period(1.5,1),Math.sqrt(8));near(M.period(1,2),1/Math.sqrt(2));
});
test('Kepler: both planets share time, and rewinding has no stored future state',()=>{
 const p={a:1.5,a2:2.5,e:.5,mass:1,divisions:'12'};
 const first=M.state(p,.4);M.state(p,20);assert.deepEqual(M.state(p,.4),first);
 near(first.secondary.t,first.t);near(first.interval,first.period/12);
});
test('Kepler: acceleration points toward the sun and matches the velocity derivative',()=>{
 for(const e of [0,.5,.85])for(const mass of [.5,2])for(const fraction of [0,.15,.5,.9]){
  const a=1.5,T=M.period(a,mass),t=T*fraction,s=M.orbit(a,e,mass,t),dt=T*1e-6;
  const before=M.orbit(a,e,mass,t-dt),after=M.orbit(a,e,mass,t+dt);
  near(s.ax*s.y-s.ay*s.x,0);assert.ok(s.ax*s.x+s.ay*s.y<0);
  near(Math.hypot(s.ax,s.ay),4*Math.PI*Math.PI*mass/(s.r*s.r));
  near((after.vx-before.vx)/(2*dt),s.ax,1e-6);near((after.vy-before.vy)/(2*dt),s.ay,1e-6);
 }
});
