const test = require('node:test');
const assert = require('node:assert/strict');
const { RippleTankModel } = require('./model.js');
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, String(a) + ' ≠ ' + String(b));

test('flat water keeps vertical rays vertical and screen illumination at one', () => {
    const model = new RippleTankModel();
    model.amplitude = 0;
    for (const gap of [2, 12, 24]) {
        model.screenGap = gap;
        for (const x of [0, 12.4, 30, 60]) {
            const ray = model.traceRay(x);
            near(ray.bottomX, x);
            near(ray.hitX, x);
            near(ray.water.z, 1);
            near(ray.air.z, 1);
        }
        for (const value of model.computeFrame().intensity) near(value, 1, 1e-8);
    }
});

test('both interfaces satisfy Snell law and return unit propagation vectors', () => {
    const model = new RippleTankModel();
    for (const x of [1, 2, 3, 7]) {
        const ray = model.traceRay(x);
        const slope = model.slope(x);
        const nx = -slope / Math.hypot(slope, 1), nz = -1 / Math.hypot(slope, 1);
        const sinAir = Math.abs(nx);
        const sinWater = Math.abs(ray.water.x * nz - ray.water.z * nx);
        near(sinAir, model.nWater * sinWater);
        near(model.nWater * ray.water.x, ray.air.x);
        near(Math.hypot(ray.water.x, ray.water.z), 1);
        near(Math.hypot(ray.air.x, ray.air.z), 1);
        assert.ok(ray.water.z > 0 && ray.air.z > 0);
    }
});

test('total internal reflection does not produce a transmitted direction', () => {
    assert.equal(RippleTankModel.refract({ x: Math.sin(Math.PI / 3), z: Math.cos(Math.PI / 3) }, { x: 0, z: -1 }, 1.333, 1), null);
});

test('travelling waves translate in the selected direction, standing nodes stay fixed', () => {
    const model = new RippleTankModel();
    const dt = 0.17, x = 4.7, distance = model.wavelength * model.frequency * dt;
    near(model.height(x, dt), model.height(x - distance, 0));
    model.mode = 'travelingLeft';
    near(model.height(x, dt), model.height(x + distance, 0));
    model.mode = 'standing';
    for (const t of [0, .125, .25, .77, 1]) near(model.height(model.wavelength / 4, t), 0);
    near(model.height(0, 0), model.amplitude);
});

test('periodic wave redistributes energy without per-frame normalization', () => {
    const model = new RippleTankModel();
    for (const mode of ['traveling', 'travelingLeft', 'standing']) {
        model.mode = mode;
        for (const time of [0, .13, .25]) {
            model.time = time;
            const values = model.computeFrame().intensity;
            const mean = values.slice(0, -1).reduce((sum, value) => sum + value, 0) / (values.length - 1);
            near(mean, 1, .005);
        }
    }
    model.mode = 'traveling';
    assert.ok(Math.max(...model.computeFrame().intensity) > 1.1);
});

test('brightness converges with denser rays and remains finite at control extremes', () => {
    const model = new RippleTankModel();
    const coarse = model.computeFrame().intensity;
    model.raySpacing /= 2;
    const dense = model.computeFrame().intensity;
    const meanError = coarse.reduce((sum, value, i) => sum + Math.abs(value - dense[i]), 0) / coarse.length;
    assert.ok(meanError < .02);
    for (const wavelength of [6, 20]) for (const amplitude of [0, .8]) for (const gap of [2, 24]) {
        Object.assign(model, { wavelength, amplitude, screenGap: gap, time: .137 });
        for (const value of model.computeFrame().intensity) assert.ok(Number.isFinite(value) && value >= 0);
    }
});
