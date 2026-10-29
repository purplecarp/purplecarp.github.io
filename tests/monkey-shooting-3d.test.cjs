const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../simulations/monkey-shooting/model.js');
const R = require('../simulations/monkey-shooting/scene3d.js');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('monkey camera falls with the monkey and observes a fixed relative approach direction', () => {
  for (const v0 of [5, 10, M.MIN_SPEED, 22, 40]) {
    const duration=M.events({v0}).duration;
    for (const t of [0, duration/2, duration*.999]) {
      const s=M.state({v0},t), c=R.cameraFor('monkey',s);
      assert.deepEqual(c.eye,[24,s.monkey.y,0]);
      const q=R.cameraPoint([s.bullet.x,s.bullet.y,0],c);
      near(q[0],0); near(q[1],0); near(q[2],s.separation);
    }
  }
});
test('arrow camera stays at the arrow tip and keeps the monkey in view', () => {
  for (const v0 of [0,5,22,40]) for (const fraction of [0,.5,1]) {
    const s=M.state({v0},M.events({v0}).duration*fraction),c=R.cameraFor('arrow',s);
    assert.deepEqual(c.eye,[s.bullet.x,s.bullet.y,0]);
    for (const basis of [c.forward,c.up,c.right]) { near(Math.hypot(...basis),1);assert.ok(basis.every(Number.isFinite)); }
    const target=R.cameraPoint([s.monkey.x,s.monkey.y,0],c);
    near(target[0],0);near(target[1],0);near(target[2],s.separation);
  }
});
test('all camera frames remain finite at exact encounter and ground events', () => {
  for(const v0 of [0,5,M.MIN_SPEED,22,40])for(const mode of ['orbit','monkey','arrow']){
    const s=M.state({v0},100), c=R.cameraFor(mode,s);
    for(const vector of Object.values(c))assert.ok(vector.every(Number.isFinite));
    near(c.forward.reduce((n,v,i)=>n+v*c.up[i],0),0);
    near(c.right.reduce((n,v,i)=>n+v*c.up[i],0),0);
  }
});
test('near-plane clipping removes geometry behind the viewer and clips crossing faces',()=>{
  assert.deepEqual(R.clipPolygon([[0,0,-2],[1,0,-2],[0,1,-2]]),[]);
  const points=R.clipPolygon([[0,0,-1],[1,0,1],[0,1,1]]);
  assert.equal(points.length,4);
  for(const p of points)assert.ok(p.every(Number.isFinite)&&p[2]>=R.NEAR-1e-10);
});
