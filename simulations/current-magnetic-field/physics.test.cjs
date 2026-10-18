'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), M=require('./model.js');
const base={mode:'wire',current:5,radius:.08,turns:20,length:.5};
function near(actual,expected,tolerance=1e-9){assert.ok(Math.abs(actual-expected)<=Math.max(1e-14,Math.abs(expected)*tolerance),`${actual} != ${expected}`);}
test('wire: Ampere law, inverse distance, right-hand rule',()=>{
  const f=M.field(base,.1,0);near(f.by,1e-5);near(f.bx,0);near(M.field(base,.2,0).magnitude,f.magnitude/2);
  assert.ok(M.field(base,0,.1).bx<0);assert.ok(M.field(base,-.1,0).by<0);
});
test('all geometries: zero field, current linearity and reversal',()=>{
  for(const mode of ['wire','loop','solenoid']){
    const p={...base,mode},a=M.field(p,.13,.04),b=M.field({...p,current:10},.13,.04),c=M.field({...p,current:-5},.13,.04);
    near(b.bx,2*a.bx);near(b.by,2*a.by);near(c.bx,-a.bx);near(c.by,-a.by);
    assert.equal(M.field({...p,current:0},0,0).magnitude,0);
  }
});
test('loop numerical integration matches analytic axis field and radius scaling',()=>{
  const p={...base,mode:'loop'};
  for(const x of [0,.02,.1,.5]){near(M.field(p,x,0).bx,M.axis(p,x));near(M.field(p,x,0).by,0);}
  near(M.field(p,0,0).bx,M.MU0*5/(2*.08));near(M.field({...p,radius:.16},0,0).bx,M.field(p,0,0).bx/2);
  assert.ok(M.field(p,0,.2).bx<0,'outside field returns opposite the center field');
});
test('solenoid finite length has nonzero exterior field; long limit and endpoints',()=>{
  const p={...base,mode:'solenoid',radius:.04,length:.8,turns:40};
  for(const x of [0,.2,.4,.7])near(M.field(p,x,0).bx,M.axis(p,x));
  const ideal=M.MU0*p.turns*p.current/p.length;
  near(M.axis(p,0),ideal,.006);near(M.axis(p,.4),ideal/2,.004);
  assert.ok(M.field(p,0,.12).bx<0);assert.ok(M.axis(p,.6)>0);
});
test('mirror symmetry and exclusion region',()=>{
  for(const mode of ['loop','solenoid']){
    const p={...base,mode},f=M.field(p,.12,.04),a=M.field(p,-.12,.04),b=M.field(p,.12,-.04);
    near(f.bx,a.bx);near(f.by,-a.by);near(f.bx,b.bx);near(f.by,-b.by);
    assert.equal(M.field(p,M.centers(p)[0],p.radius).excluded,true);
  }
  assert.equal(M.field(base,0,0).excluded,true);
});
test('field tracing yields finite samples aligned with local field',()=>{
  const p={...base,mode:'loop'},points=M.trace(p,[0,.03],.35,1);
  assert.ok(points.length>20);for(const xy of points)assert.ok(xy.every(Number.isFinite));
  const f=M.field(p,...points[0]);assert.ok((points[1][0]-points[0][0])*f.bx+(points[1][1]-points[0][1])*f.by>0);
});
test('3D fields preserve rotational symmetry and current direction',()=>{
  for(const mode of ['loop','solenoid']){
    const p={...base,mode},a=M.field3D(p,.13,.06,0),b=M.field3D(p,.13,0,.06);
    near(a.bx,b.bx);near(a.by,b.bz);near(a.bz,0);near(b.by,0);near(a.magnitude,b.magnitude);
    const c=M.field3D({...p,current:-5},.13,0,.06);near(c.bx,-b.bx);near(c.bz,-b.bz);
  }
  near(M.field3D(base,.1,0,2).by,M.field(base,.1,0).by);
});
test('classroom state uses cm inputs, is time independent, and camera preserves lengths',()=>{
  const p={mode:'loop',current:5,radius:8,turns:20,length:50,probeX:0,probeY:0};
  const a=M.state(p,0),b=M.state(p,12);near(a.field.bx,M.MU0*5/.16);near(a.field.bx,b.field.bx);
  for(const azimuth of [-180,-32,0,90,180])for(const elevation of [-75,0,24,75]){
    const v=M.rotate([.12,-.03,.4],azimuth,elevation);near(Math.hypot(...v),Math.hypot(.12,-.03,.4));
  }
});
test('control extremes retain finite, analytic center fields',()=>{
  for(const mode of ['loop','solenoid'])for(const radius of [.04,.16])for(const length of [.2,.8])for(const turns of [4,40])for(const current of [-10,0,10]){
    const p={mode,radius,length,turns,current},f=M.field(p,0,0);
    assert.ok(Number.isFinite(f.magnitude));near(f.bx,M.axis(p,0));near(f.by,0);
  }
});
