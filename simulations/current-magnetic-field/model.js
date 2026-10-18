/* SI units. Air-core, steady currents. Circular turns lie in the yz plane. */
(function (root) {
    'use strict';
    const MU0 = 4 * Math.PI * 1e-7;
    const EXCLUSION = 0.008;
    const cosines = Array.from({ length: 128 }, (_, k) => Math.cos((k + 0.5) * 2 * Math.PI / 128));
    function centers(p) {
        return p.mode === 'loop' ? [0] : Array.from({ length: p.turns }, (_, k) => ((k + 0.5) / p.turns - 0.5) * p.length);
    }
    function excluded(p, x, y) {
        if (p.mode === 'wire') return Math.hypot(x, y) < EXCLUSION;
        return centers(p).some(c => Math.hypot(x - c, Math.abs(y) - p.radius) < EXCLUSION);
    }
    function field(p, x, y) {
        if (p.current === 0) return { bx: 0, by: 0, magnitude: 0, excluded: false };
        if (excluded(p, x, y)) return { bx: NaN, by: NaN, magnitude: NaN, excluded: true };
        let bx = 0, by = 0;
        if (p.mode === 'wire') {
            const factor = MU0 * p.current / (2 * Math.PI * (x * x + y * y));
            bx = -factor * y; by = factor * x;
        } else {
            const r = p.radius, factor = 1e-7 * p.current * 2 * Math.PI / cosines.length;
            for (const center of centers(p)) {
                const dx = x - center;
                for (const c of cosines) {
                    const d2 = dx * dx + y * y + r * r - 2 * y * r * c;
                    const weight = factor / (d2 * Math.sqrt(d2));
                    bx += (r * r - r * y * c) * weight;
                    by += r * c * dx * weight;
                }
            }
        }
        return { bx, by, magnitude: Math.hypot(bx, by), excluded: false };
    }
    function axis(p, x) {
        return centers(p).reduce((sum, c) => sum + MU0 * p.current * p.radius ** 2 / (2 * ((x - c) ** 2 + p.radius ** 2) ** 1.5), 0);
    }
    function trace(p, seed, extent, direction) {
        const points = [], h = extent / 95;
        let [x, y] = seed;
        function unit(a, b) {
            const f = field(p, a, b);
            return f.magnitude > 1e-15 ? [direction * f.bx / f.magnitude, direction * f.by / f.magnitude] : null;
        }
        for (let i = 0; i < 650; i++) {
            if (Math.abs(x) > extent * 1.3 || Math.abs(y) > extent || excluded(p, x, y)) break;
            points.push([x, y]);
            const a = unit(x, y); if (!a) break;
            const b = unit(x + h * a[0] / 2, y + h * a[1] / 2); if (!b) break;
            x += h * b[0]; y += h * b[1];
            if (i > 30 && Math.hypot(x - seed[0], y - seed[1]) < h) break;
        }
        return points;
    }
    // Classroom controls use centimetres; the field solver always uses SI units.
    function parameters(p) {
        return { mode: p.mode, current: p.current, radius: p.radius / 100, turns: p.turns, length: p.length / 100 };
    }
    function state(p, t) {
        const physical = parameters(p), x = p.probeX / 100, y = p.probeY / 100;
        return { t, physical, x, y, field: field(physical, x, y),
            center: p.mode === 'wire' ? NaN : axis(physical, 0),
            ideal: p.mode === 'solenoid' ? MU0 * physical.turns * physical.current / physical.length : NaN };
    }
    // Axisymmetric extension used to verify the three-dimensional field geometry.
    function field3D(p, x, y, z) {
        if (p.mode === 'wire') return { ...field(p, x, y), bz: 0 };
        const rho = Math.hypot(y, z), f = field(p, x, rho);
        return { bx: f.bx, by: rho ? f.by * y / rho : 0, bz: rho ? f.by * z / rho : 0,
            magnitude: f.magnitude, excluded: f.excluded };
    }
    // Orthographic camera: a rigid rotation preserves lengths before projection.
    function rotate(point, azimuth, elevation) {
        const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
        const x = point[0] * Math.cos(a) + point[2] * Math.sin(a);
        const z = -point[0] * Math.sin(a) + point[2] * Math.cos(a);
        return [x, point[1] * Math.cos(e) - z * Math.sin(e), point[1] * Math.sin(e) + z * Math.cos(e)];
    }
    const api = { MU0, EXCLUSION, centers, field, field3D, axis, trace, parameters, state, rotate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PhysicsModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
