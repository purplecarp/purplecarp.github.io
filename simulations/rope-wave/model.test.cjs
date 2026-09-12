const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('./model.js');
const near = (actual, expected, tolerance = 1e-9) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' != ' + expected);
const types = ['heavy-to-light', 'light-to-heavy', 'fixed', 'free'];
const options = { waveType: 'pulse', duration: 7.2, frequency: 0.045 };
const scenario = type => M.createScenario(type, 2, 4);

test('density uses SI units and boundary coefficients conserve energy across the slider range', () => {
    near(M.speed(1), 4); near(M.speed(4), 2); near(M.speed(16), 1);
    assert.throws(() => M.speed(0), RangeError);
    for (let heavy = 2; heavy <= 16; heavy++) {
        for (let light = 1; light < heavy; light++) {
            for (const type of types.slice(0, 2)) {
                const s = M.createScenario(type, M.speed(heavy), M.speed(light));
                near(1 + s.r, s.tau);
                near(s.r ** 2 + s.vi / s.vt * s.tau ** 2, 1);
                assert.equal(s.r > 0, type === 'heavy-to-light');
            }
        }
    }
    const equal = M.coefficients(2, 2);
    near(equal.r, 0); near(equal.tau, 1);
});

test('pulse is causal, single peaked and has zero endpoint velocity at every width', () => {
    for (let level = 1; level <= 5; level++) {
        const duration = level * 2.4, opt = { ...options, duration }, h = 1e-6;
        for (const t of [-100, 0, duration, duration + 1, 1000]) near(M.source(t, opt), 0);
        near(M.source(duration / 2, opt), 1);
        near(M.source(h, opt) / h, 0, 2e-6);
        near(M.source(duration - h, opt) / h, 0, 2e-6);
        let previous = 0;
        for (let i = 1; i <= 50; i++) {
            const value = M.source(duration * i / 100, opt);
            assert.ok(value >= previous);
            near(value, M.source(duration * (1 - i / 100), opt));
            previous = value;
        }
    }
});

test('nothing appears before the incident, reflected or transmitted arrival', () => {
    for (const type of types) {
        const s = scenario(type), x = 12;
        near(M.sample(s, x, x / s.vi - 0.01, options).total, 0);
        near(M.sample(s, x, (2 * s.boundary - x) / s.vi - 0.01, options).reflected, 0);
        if (s.vt) {
            const xt = 100, arrival = s.boundary / s.vi + (xt - s.boundary) / s.vt;
            near(M.sample(s, xt, arrival - 0.01, options).total, 0);
            assert.ok(M.sample(s, xt, arrival + 0.1, options).transmitted > 0);
        }
    }
});

test('an incident pulse translates at vi without amplitude loss or dispersion', () => {
    const s = scenario('heavy-to-light');
    for (let level = 1; level <= 5; level++) {
        const opt = { ...options, duration: level * 2.4 };
        for (const x of [8, 20, 40]) {
            near(M.sample(s, x, x / s.vi + opt.duration / 2, opt).incident, 1);
            for (const age of [0.2, 0.6, 0.9]) {
                const time = x / s.vi + age * opt.duration;
                near(M.sample(s, x, time, opt).incident, M.sample(s, x + 4, time + 2, opt).incident);
            }
        }
    }
});

test('separated reflected and transmitted peaks have the theoretical signed amplitudes', () => {
    for (const type of types) {
        const s = scenario(type), x = s.boundary - 20;
        const peak = (2 * s.boundary - x) / s.vi + options.duration / 2;
        near(M.sample(s, x, peak, options).reflected, s.r);
        near(M.sample(s, x, peak, options).total, s.r);
        if (s.vt) {
            const xt = s.boundary + 20;
            near(M.sample(s, xt, s.boundary / s.vi + 20 / s.vt + options.duration / 2, options).total, s.tau);
        }
    }
});

test('transmitted pulse FWHM scales with wave speed and its temporal duration is unchanged', () => {
    for (const type of types.slice(0, 2)) {
        const s = scenario(type), center = 96;
        const time = s.boundary / s.vi + (center - s.boundary) / s.vt + options.duration / 2;
        const halfWidth = s.vt * options.duration / 4;
        near(M.sample(s, center - halfWidth, time, options).total, s.tau / 2);
        near(M.sample(s, center + halfWidth, time, options).total, s.tau / 2);
        near(M.sample(s, center, time - options.duration / 4, options).total, s.tau / 2);
        near(M.sample(s, center, time + options.duration / 4, options).total, s.tau / 2);
    }
});

test('junction displacement and transverse force are continuous throughout scattering', () => {
    const h = 1e-4;
    for (const type of types.slice(0, 2)) {
        const s = scenario(type), b = s.boundary;
        for (let j = 1; j < 20; j++) {
            const t = b / s.vi + options.duration * j / 20;
            const at = M.sample(s, b, t, options).total;
            const left = M.sample(s, b - h, t, options).total;
            const right = M.sample(s, b + h, t, options).total;
            near(left, right, 5e-5);
            near((at - left) / h, (right - at) / h, 2e-5);
        }
    }
});

test('fixed end stays at zero; free end has zero slope and a doubled peak', () => {
    const fixed = scenario('fixed'), free = scenario('free'), h = 1e-4;
    for (let j = 0; j <= 100; j++) {
        const t = 55 + j * 0.3;
        near(M.sample(fixed, 128, t, options).total, 0);
        near((M.sample(free, 128, t, options).total - M.sample(free, 128 - h, t, options).total) / h, 0, 1e-5);
    }
    near(M.sample(free, 128, 64 + options.duration / 2, options).total, 2);
});

test('sampled fields satisfy the wave equation away from the wavefront and junction', () => {
    const h = 0.001;
    for (const type of types) {
        const s = scenario(type);
        for (const [x, t] of [[20, 13], [s.boundary - 10, (s.boundary + 10) / s.vi + 3], ...(s.vt ? [[90, s.boundary / s.vi + 26 / s.vt + 3]] : [])]) {
            const y = (px, pt) => M.sample(s, px, pt, options).total;
            const dtt = (y(x, t + h) - 2 * y(x, t) + y(x, t - h)) / h ** 2;
            const dxx = (y(x + h, t) - 2 * y(x, t) + y(x - h, t)) / h ** 2;
            const v = x <= s.boundary ? s.vi : s.vt;
            near(dtt, v * v * dxx, 1e-6);
        }
    }
});

test('integrated pulse energy is conserved before and after a junction', () => {
    // Independently integrate 1/2 mu*y_t^2 + 1/2 T*y_x^2 over the visible rope.
    function energy(s, time) {
        const dx = 0.02, h = 0.0001;
        let sum = 0;
        for (let x = dx / 2; x < s.length; x += dx) {
            const y = (px, pt) => M.sample(s, px, pt, options).total;
            const v = x <= s.boundary ? s.vi : s.vt;
            const dyT = (y(x, time + h) - y(x, time - h)) / (2 * h);
            const dyX = (y(x + h, time) - y(x - h, time)) / (2 * h);
            sum += 0.5 * M.TENSION * (dyT ** 2 / v ** 2 + dyX ** 2) * dx;
        }
        return sum;
    }
    for (const type of types.slice(0, 2)) {
        const s = scenario(type);
        const before = energy(s, 12), after = energy(s, s.boundary / s.vi + 10);
        near(after / before, 1, 1e-5);
    }
});

test('all pulses leave exactly once; periodic waves keep propagating', () => {
    for (const type of types) {
        const s = scenario(type), values = new Float64Array(1025);
        for (const time of [M.pulseEndTime(s, options.duration) + 1e-9, 1000]) {
            M.fill(s, time, options, values);
            assert.ok(values.every(value => Math.abs(value) < 1e-20));
        }
    }
    const opt = { waveType: 'sine', frequency: 0.05 };
    near(M.source(-1, opt), 0);
    near(M.source(25, opt), 1);
    const s = scenario('heavy-to-light');
    near(M.sample(s, 96, 32 + 8 + 25, opt).total, 4 / 3);
});

function makeUI() {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    const elements = new Map();
    const ctx = new Proxy({}, { get: (o, key) => o[key] || (() => {}), set: (o, key, value) => (o[key] = value, true) });
    for (const match of html.matchAll(/id="([^"]+)"/g)) {
        elements.set(match[1], { value: '', textContent: '', style: {}, handlers: {}, width: 900, height: 480,
            getContext: () => ctx, addEventListener(type, fn) { this.handlers[type] = fn; } });
    }
    let id = 0;
    const callbacks = new Map();
    const sandbox = { RopeWaveModel: M, window: { devicePixelRatio: 1, addEventListener() {} },
        document: { getElementById: key => { assert.ok(elements.has(key), key); return elements.get(key); } },
        requestAnimationFrame: fn => { callbacks.set(++id, fn); return id; },
        cancelAnimationFrame: key => callbacks.delete(key) };
    vm.createContext(sandbox);
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    vm.runInContext(inline + '\nglobalThis.sim = new RopeWaveSimulation();', sandbox);
    const event = (key, type, value) => elements.get(key).handlers[type]({ target: { value } });
    const frame = timestamp => {
        const jobs = [...callbacks.values()]; callbacks.clear();
        jobs.forEach(fn => fn(timestamp));
    };
    return { sim: sandbox.sim, elements, event, frame, callbacks };
}

test('page controls integrate with the model, pause/resume, density constraints and replay', () => {
    const { sim, elements, event, frame, callbacks } = makeUI();
    event('waveTypeSelect', 'change', 'pulse');
    assert.equal(sim.waveType, 'pulse');
    near(Number(elements.get('freqValue').textContent), 7.2);
    event('freqSlider', 'input', '5'); near(sim.pulseDuration, 12);
    event('mu2Slider', 'input', '15'); near(sim.mu1, 16); near(sim.mu2, 15);
    event('mu1Slider', 'input', '2'); near(sim.mu1, 2); near(sim.mu2, 1);
    event('ampSlider', 'input', '35'); near(sim.time, 0);
    event('startBtn', 'click'); frame(0); frame(20);
    near(sim.time, 0.1);
    event('pauseBtn', 'click'); assert.equal(callbacks.size, 0);
    event('startBtn', 'click'); frame(1000); near(sim.time, 0.1);
    event('speedSlider', 'input', '3'); frame(1020); near(sim.time, 0.4);
    sim.time = sim.pulseEndTime - 0.01; frame(1040);
    assert.equal(sim.isRunning, false); assert.equal(callbacks.size, 0);
    assert.ok(sim.scenarios.every(s => s.y.every(y => Math.abs(y) < 1e-20)));
    event('startBtn', 'click'); near(sim.time, 0); assert.equal(sim.isRunning, true);
    event('resetBtn', 'click'); assert.equal(sim.isRunning, false);
    event('waveTypeSelect', 'change', 'sine'); assert.equal(sim.waveType, 'sine');
});

test('different frame partitions and playback speeds produce the same state at equal simulated time', () => {
    const a = makeUI(), b = makeUI();
    a.event('waveTypeSelect', 'change', 'pulse'); b.event('waveTypeSelect', 'change', 'pulse');
    a.event('startBtn', 'click'); b.event('startBtn', 'click');
    a.frame(0); b.frame(0);
    for (let i = 1; i <= 100; i++) a.frame(i * 20);
    b.event('speedSlider', 'input', '2');
    for (let i = 1; i <= 25; i++) b.frame(i * 40);
    near(a.sim.time, b.sim.time);
    for (let k = 0; k < 4; k++) {
        for (let i = 0; i < 1025; i++) near(a.sim.scenarios[k].y[i], b.sim.scenarios[k].y[i], 1e-12);
    }
});

