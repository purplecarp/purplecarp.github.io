'use strict';
const assert = require('node:assert/strict');
const P = require('./physics.js');
const point = (q=1,x=0,y=0,z=0)=>({type:'point',value:q,x,y,z});
const sheet = (value=0.1,x=0,y=0,z=0,angle=0,tilt=0)=>({type:'sheet',value,x,y,z,angle,tilt});
const close = (a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);
let f = P.sample([point()],1,0,0);
close(f.v,8.9875517923);close(f.ex,8.9875517923);close(f.ey,0);
const far = P.sample([point()],2,0,0);close(far.v,f.v/2);close(far.ex,f.ex/4);
const doubled = P.sample([point(2)],1,0,0);close(doubled.v,2*f.v);close(doubled.ex,2*f.ex);
const negative = P.sample([point(-1)],1,0,0);close(negative.v,-f.v);close(negative.ex,-f.ex);
const dipole=P.sample([point(1,-1),point(-1,1)],0,0,0);close(dipole.v,0);assert.ok(dipole.ex>0);
const off=P.sample([point(1,0,0,1)],0,0,0);close(off.ez,-P.K*1e-9);close(off.ex,0);
const sheets=[sheet(.1,-2),sheet(-.1,2)],inside=P.sample(sheets,0,0,0),outside=P.sample(sheets,3,0,0);
close(inside.ex,.1e-9/P.EPSILON);close(outside.ex,0);close(inside.v,0);
close(P.sample([sheet()],1,0,0).ex,P.sample([sheet()],4,0,0).ex);
assert.equal(P.sample([sheet()],0,0,0).onSheet,true);
assert.equal(P.sample([point()],0,0,0).singular,true);
assert.equal(P.excluded([point()],.05,0,0),true);
close(P.sample([point(0)],0,0,0).v,0);
const tilted=[point(2,-1,.5,.7),sheet(.2,.5,1,-.3,35,28)];
const r=[1.7,-.2,.9],h=1e-5,field=P.sample(tilted,...r);
for(let axis=0;axis<3;axis++){const a=r.slice(),b=r.slice();a[axis]+=h;b[axis]-=h;const gradient=(P.sample(tilted,...a).v-P.sample(tilted,...b).v)/(2*h);close(-gradient,[field.ex,field.ey,field.ez][axis],1e-6);}
for(const configuration of [[point(20)], [point(-20)], [sheet(2,1,1,1,180,90)], [sheet(-2,-20,-20,-20,-180,-90)]]) {
    const f=P.sample(configuration,2,3,4);assert.ok([f.v,f.ex,f.ey,f.ez].every(Number.isFinite));
}
const line=P.trace([point()], [.2,0],0,5);assert.ok(line.length>30);assert.ok(line.every(p=>Math.abs(p[1])<1e-9));assert.ok(line.at(-1)[0]>line[0][0]);
const sink=P.trace([point(-1)], [.2,0],0,5,-1);assert.ok(sink[0][0]>sink.at(-1)[0]);
const crossing=P.trace([sheet(-.1)], [1,0],0,5);assert.ok(crossing.every(p=>p[0]>0));
console.log('PASS: Coulomb law, inverse-distance scaling, doubling, signs, dipole, off-slice field, infinite sheets, singularities, E = -grad(V), extrema and field-line direction.');
