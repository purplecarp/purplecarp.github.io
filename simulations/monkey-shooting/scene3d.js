/* Small, dependency-free 3D scene: world-space meshes, perspective camera and near-plane clipping. */
(function (root) {
  'use strict';
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, k) => a.map(v => v * k);
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
  const NEAR = .08;
  const DEFAULT_ORBIT = { yaw: .28, pitch: .25, distance: 48 };
  function cameraFor(mode, s, orbit = DEFAULT_ORBIT, aspect = 1.6) {
    let eye, forward;
    if (mode === 'monkey') {
      eye = [s.monkey.x, s.monkey.y, 0];
      // Fixed orientation in the falling frame: relative acceleration is zero.
      forward = unit([-24, -16, 0]);
    } else if (mode === 'arrow') {
      eye = [s.bullet.x, s.bullet.y, 0];
      forward = unit([s.monkey.x - s.bullet.x, s.monkey.y - s.bullet.y, 0]);
      if (s.separation < 1e-6) forward = unit([24, 16, 0]);
    } else {
      const radius = orbit.distance * Math.max(1, 1 / aspect);
      const offset = [Math.sin(orbit.yaw)*Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw)*Math.cos(orbit.pitch)];
      eye = add([12, 10, 0], mul(offset, radius));
      forward = mul(offset, -1);
    }
    const reference = Math.abs(forward[1]) > .995 ? [0, 0, 1] : [0, 1, 0];
    const right = unit(cross(forward, reference)), up = cross(right, forward);
    return { eye, forward, right, up };
  }
  function cameraPoint(p, camera) {
    const d = sub(p, camera.eye);
    return [dot(d, camera.right), dot(d, camera.up), dot(d, camera.forward)];
  }
  function clipPolygon(points) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (a[2] >= NEAR) out.push(a);
      if ((a[2] >= NEAR) !== (b[2] >= NEAR)) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push(add(a, mul(sub(b, a), t)));
      }
    }
    return out;
  }
  const light = unit([-1, 2, 3]);
  function shade(color, normal) {
    const amount = .56 + .44 * Math.max(0, dot(unit(normal), light));
    return `rgb(${color.map(v => Math.round(v * amount)).join(',')})`;
  }
  class Scene {
    constructor() { this.faces = []; this.lines = []; }
    face(points, color) {
      this.faces.push({ points, color: shade(color, cross(sub(points[1], points[0]), sub(points[2], points[0]))) });
    }
    line(a, b, color, width = 1.5, dash = []) { this.lines.push({ a, b, color, width, dash }); }
    sphere(center, radii, color, rings = 6, segments = 10) {
      const at = (i, j) => {
        const v = Math.PI * i / rings, u = 2 * Math.PI * j / segments;
        return add(center, [radii[0]*Math.sin(v)*Math.cos(u), radii[1]*Math.cos(v), radii[2]*Math.sin(v)*Math.sin(u)]);
      };
      for (let i = 0; i < rings; i++) for (let j = 0; j < segments; j++) {
        this.face([at(i,j), at(i,j+1), at(i+1,j+1), at(i+1,j)], color);
      }
    }
    rod(a, b, radius, color, endRadius = radius) {
      const axis = unit(sub(b, a));
      const u = unit(cross(axis, Math.abs(axis[1]) > .9 ? [1,0,0] : [0,1,0])), v = cross(axis,u);
      const ring = (center, r, j) => add(center, add(mul(u,r*Math.cos(j*Math.PI/4)),mul(v,r*Math.sin(j*Math.PI/4))));
      for (let j = 0; j < 8; j++) this.face([ring(a,radius,j),ring(a,radius,j+1),ring(b,endRadius,j+1),ring(b,endRadius,j)],color);
      this.face(Array.from({length:8},(_,j)=>ring(b,endRadius,j)),color);
      this.face(Array.from({length:8},(_,j)=>ring(a,radius,7-j)),color);
    }
    render(a, camera) {
      const c = a.ctx, focal = Math.min(a.width, a.height) * 1.12;
      const project = p => [a.width/2 + focal*p[0]/p[2], a.height/2 - focal*p[1]/p[2]];
      const queue = [];
      for (const face of this.faces) {
        const points = clipPolygon(face.points.map(p => cameraPoint(p,camera)));
        if (points.length >= 3) queue.push({ ...face, points, depth: points.reduce((n,p)=>n+p[2],0)/points.length });
      }
      for (const line of this.lines) {
        let p = cameraPoint(line.a,camera), q = cameraPoint(line.b,camera);
        if (p[2] < NEAR && q[2] < NEAR) continue;
        if (p[2] < NEAR) p = add(p,mul(sub(q,p),(NEAR-p[2])/(q[2]-p[2])));
        if (q[2] < NEAR) q = add(q,mul(sub(p,q),(NEAR-q[2])/(p[2]-q[2])));
        queue.push({...line, points:[p,q], depth:(p[2]+q[2])/2, isLine:true});
      }
      queue.sort((a,b)=>b.depth-a.depth);
      c.save(); c.beginPath(); c.rect(0,0,a.width,a.height); c.clip();
      for (const item of queue) {
        c.beginPath();
        item.points.forEach((p,i)=>{const xy=project(p);i?c.lineTo(...xy):c.moveTo(...xy);});
        if (item.isLine) { c.strokeStyle=item.color;c.lineWidth=item.width;c.setLineDash(item.dash);c.stroke(); }
        else { c.closePath();c.fillStyle=item.color;c.fill(); }
      }
      c.restore(); c.setLineDash([]);
      return p => { const q=cameraPoint(p,camera);return q[2]>=NEAR?project(q):null; };
    }
  }
  function environment() {
    const scene = new Scene();
    // Small ground tiles preserve depth ordering when a first-person camera approaches the ground.
    for(let x=-20;x<60;x+=4) for(let z=-32;z<36;z+=4) {
      scene.face([[x,0,z],[x,0,z+4],[x+4,0,z+4],[x+4,0,z]], ((x+z)/4)%2 ? [38,65,64]:[42,70,68]);
    }
    for(let x=-20;x<=60;x+=4) scene.line([x,.015,-32],[x,.015,36],'#4b7574',.7);
    for(let z=-32;z<=36;z+=4) scene.line([-20,.015,z],[60,.015,z],'#4b7574',.7);
    scene.rod([27,0,-1],[27,22,-1],.52,[147,108,77],.3);
    scene.rod([27,20,-1],[23,20,0],.25,[160,117,79],.16);
    scene.sphere([27,23,-1],[3.8,3,3.2],[52,123,100]);
    scene.sphere([23.8,22.6,-1.5],[2.5,2.1,2.4],[65,143,107]);
    scene.sphere([29.8,22,-.5],[2.6,2.4,2.5],[44,109,89]);
    // Bow and tripod at the launch position.
    scene.rod([-1,0,-.7],[0,2,0],.1,[175,192,202]);
    scene.rod([-1,0,.7],[0,2,0],.1,[175,192,202]);
    scene.rod([1,0,0],[0,2,0],.1,[175,192,202]);
    const up=unit([-16,24,0]), forward=unit([24,16,0]), origin=[0,2,0];
    let prev;
    for(let i=0;i<=12;i++) {
      const t=-1.1+i*2.2/12, p=add(origin,add(mul(up,Math.sin(t)*1.3),mul(forward,Math.cos(t)*.65-.4)));
      if(prev)scene.rod(prev,p,.06,[221,177,104]);prev=p;
    }
    scene.line(add(origin,mul(up,-1.16)),add(origin,mul(up,1.16)),'#dedbc4',1.5);
    return scene;
  }
  function addMonkey(scene, p) {
    const fur=[184,128,80], face=[248,209,151], dark=[34,34,42];
    scene.sphere(add(p,[0,-.32,0]),[.48,.7,.45],fur);
    scene.sphere(add(p,[0,.62,0]),[.53,.51,.55],fur);
    scene.sphere(add(p,[-.43,.64,0]),[.18,.36,.4],face);
    for(const z of [-.53,.53])scene.sphere(add(p,[0,.68,z]),[.2,.24,.2],face,4,8);
    for(const z of [-.19,.19])scene.sphere(add(p,[-.59,.78,z]),[.06,.07,.065],dark,4,6);
    scene.sphere(add(p,[-.6,.51,0]),[.15,.14,.22],face,4,8);
    for(const side of [-1,1]) {
      scene.rod(add(p,[0,-.1,side*.32]),add(p,[0,.95,side*.85]),.12,fur);
      scene.rod(add(p,[0,-.75,side*.25]),add(p,[-.15,-1.15,side*.48]),.15,fur);
    }
    let prev=add(p,[.3,-.55,0]);
    for(let i=1;i<=12;i++) {const t=i/12*Math.PI*1.5, q=add(p,[.6+.55*Math.sin(t),-.55-.55*(1-Math.cos(t)),.15]);scene.rod(prev,q,.08,fur);prev=q;}
    scene.sphere(p,[.11,.11,.11],[255,225,103],4,6);
  }
  function addArrow(scene,s) {
    const p=[s.bullet.x,s.bullet.y,0], direction=unit([s.bullet.vx,s.bullet.vy,0]);
    const back=add(p,mul(direction,-1.35));
    scene.rod(back,add(p,mul(direction,-.28)),.075,[133,207,255]);
    scene.rod(add(p,mul(direction,-.35)),p,.2,[151,220,255],0);
    const side=unit(cross(direction,[0,0,1]));
    for(const wing of [side,mul(side,-1),[0,0,1],[0,0,-1]])scene.face([back,add(back,mul(direction,.4)),add(back,mul(wing,.23))],[74,170,240]);
  }
  const scenery = environment();
  function draw(a,s,mode,orbit) {
    const c=a.ctx, sky=c.createLinearGradient(0,0,0,a.height);
    sky.addColorStop(0,'#10263e');sky.addColorStop(1,'#38636c');c.fillStyle=sky;c.fillRect(0,0,a.width,a.height);
    const scene=new Scene();scene.faces=scenery.faces.slice();scene.lines=scenery.lines.slice();
    const monkey=[s.monkey.x,s.monkey.y,0], arrow=[s.bullet.x,s.bullet.y,0];
    if(a.p.aim)scene.line([0,2,0],[24,18,0],'#c6d8e8',1.5,[7,7]);
    if(a.p.trail)for(let t=0;t<s.t;t+=.05){
      const q=root.PhysicsModel.state(a.p,t);
      scene.sphere([q.bullet.x,q.bullet.y,0],[.07,.07,.07],[98,185,250],3,4);
      scene.sphere([24,q.monkey.y,0],[.07,.07,.07],[239,219,114],3,4);
    }
    if(a.p.drop){
      scene.line([s.ghost.x,s.ghost.y,0],arrow,'#ffb66a',2,[5,5]);
      scene.line([24,18,0],monkey,'#ffb66a',2,[5,5]);
      if(mode==='orbit'){
        scene.sphere([s.ghost.x,s.ghost.y,0],[.13,.13,.13],[255,182,106],4,6);
        scene.sphere([24,18,0],[.13,.13,.13],[255,182,106],4,6);
      }
    }
    if(mode!=='monkey')addMonkey(scene,monkey);
    if(mode!=='arrow')addArrow(scene,s);
    const project=scene.render(a,cameraFor(mode,s,orbit,a.width/a.height));
    if(mode==='orbit'){
      for(const [label,p,color] of [['發射點',[0,3.8,0],'#9ed9ff'],['猴子',[24,s.monkey.y+2,0],'#ffe58b']]){
        const xy=project(p);if(xy&&xy[0]>25&&xy[0]<a.width-25&&xy[1]>60&&xy[1]<a.height-20){
          c.save();c.shadowColor='#10263e';c.shadowBlur=5;a.text(label,...xy,color,18,'center');c.restore();
        }
      }
    }else{
      const x=a.width/2,y=a.height/2;
      a.line(x-10,y,x-4,y,'#ffffff99',1);a.line(x+4,y,x+10,y,'#ffffff99',1);
      a.line(x,y-10,x,y-4,'#ffffff99',1);a.line(x,y+4,x,y+10,'#ffffff99',1);
    }
    c.fillStyle='#0c1b2cd9';c.fillRect(0,0,a.width,49);
    a.text({orbit:'3D 全景',monkey:'猴子視角 · 隨猴子下落',arrow:'箭矢視角 · 追蹤猴子'}[mode],14,32,'#eff6ff',a.width<420?18:22);
    if(s.status!=='flight'){
      const label=s.status==='hit'?'箭矢與猴子相遇':s.status==='bullet-ground'?'箭矢先落地，未相遇':'猴子先落地，未相遇';
      c.fillStyle='#0c1b2ce6';c.fillRect(0,a.height-62,a.width,62);
      a.text(label,a.width/2,a.height-24,s.status==='hit'?'#78efc1':'#ffdb87',a.width<420?20:24,'center');
    }
  }
  const api={cameraFor,cameraPoint,clipPolygon,DEFAULT_ORBIT,NEAR,draw};
  if(typeof module!=='undefined')module.exports=api;else root.MonkeyScene3D=api;
})(globalThis);
