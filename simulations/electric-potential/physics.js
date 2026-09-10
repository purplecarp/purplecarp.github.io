/* SI electrostatics. Charge inputs: nC; sheet density inputs: nC/m². */
(function (root) {
    'use strict';
    const EPSILON = 8.8541878128e-12;
    const K = 1 / (4 * Math.PI * EPSILON);
    const EXCLUSION = 0.12; // A display hole, never a softened Coulomb law.
    function normal(source) {
        const a = source.angle * Math.PI / 180, b = source.tilt * Math.PI / 180;
        return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
    }
    function sample(sources, x, y, z) {
        let v = 0, ex = 0, ey = 0, ez = 0, singular = false, onSheet = false;
        for (const s of sources) {
            if (s.value === 0) continue;
            const dx = x - s.x, dy = y - s.y, dz = z - s.z;
            if (s.type === 'point') {
                const r = Math.hypot(dx, dy, dz);
                if (r < 1e-10) { singular = true; continue; }
                const q = K * s.value * 1e-9;
                v += q / r;
                const f = q / (r * r * r);
                ex += f * dx; ey += f * dy; ez += f * dz;
            } else {
                const n = normal(s), d = dx * n[0] + dy * n[1] + dz * n[2];
                const f = s.value * 1e-9 / (2 * EPSILON);
                // Each sheet contribution chooses V = 0 on that sheet.
                v -= f * Math.abs(d);
                if (Math.abs(d) < 1e-9) onSheet = true;
                ex += f * Math.sign(d) * n[0]; ey += f * Math.sign(d) * n[1]; ez += f * Math.sign(d) * n[2];
            }
        }
        return { v: singular ? NaN : v, ex: singular ? NaN : ex, ey: singular ? NaN : ey,
            ez: singular ? NaN : ez, singular, onSheet };
    }
    function excluded(sources, x, y, z) {
        return sources.some(s => s.type === 'point' && s.value !== 0 && Math.hypot(x-s.x, y-s.y, z-s.z) < EXCLUSION);
    }
    function trace(sources, seed, z, extent, direction = 1) {
        const points = [], step = 0.065;
        function unit(x,y) {
            const f = sample(sources,x,y,z), m = Math.hypot(f.ex,f.ey);
            if (!Number.isFinite(m) || m < 1e-9 || f.onSheet) return null;
            return [direction*f.ex/m, direction*f.ey/m];
        }
        let [x,y] = seed;
        for (let i=0;i<650;i++) {
            if (Math.abs(x)>extent || Math.abs(y)>extent || excluded(sources,x,y,z)) break;
            points.push([x,y]);
            const a=unit(x,y); if(!a) break;
            const b=unit(x+step*a[0]/2,y+step*a[1]/2); if(!b) break;
            const c=unit(x+step*b[0]/2,y+step*b[1]/2); if(!c) break;
            const d=unit(x+step*c[0],y+step*c[1]); if(!d) break;
            const nx=x+step*(a[0]+2*b[0]+2*c[0]+d[0])/6, ny=y+step*(a[1]+2*b[1]+2*c[1]+d[1])/6;
            const crosses=sources.some(s=>{
                if(s.type!=='sheet'||s.value===0) return false;
                const n=normal(s), p=(x-s.x)*n[0]+(y-s.y)*n[1]+(z-s.z)*n[2];
                return p*((nx-s.x)*n[0]+(ny-s.y)*n[1]+(z-s.z)*n[2])<=0;
            });
            if(crosses) break;
            x=nx; y=ny;
        }
        return direction===1?points:points.reverse();
    }
    const api={EPSILON,K,EXCLUSION,normal,sample,excluded,trace};
    if(typeof module!=='undefined' && module.exports) module.exports=api;
    else root.Electrostatics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
