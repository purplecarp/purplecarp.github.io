/* Exact traveling waves for a lossless string with one scattering boundary. */
(function (root) {
    'use strict';
    const LENGTH = 128; // m; drawing coordinates are independent of the model.
    const TENSION = 0.016; // N; density controls use g/m.

    function speed(density) {
        if (!Number.isFinite(density) || density <= 0) throw new RangeError('Density must be positive.');
        return Math.sqrt(TENSION / (density * 0.001));
    }

    function coefficients(incidentSpeed, transmittedSpeed) {
        return {
            r: (transmittedSpeed - incidentSpeed) / (transmittedSpeed + incidentSpeed),
            tau: 2 * transmittedSpeed / (transmittedSpeed + incidentSpeed)
        };
    }

    // Compact raised-cosine pulse: displacement AND velocity vanish at both ends.
    function source(time, { waveType = 'pulse', duration = 7.2, frequency = 0.045 } = {}) {
        if (time <= 0) return 0;
        if (waveType === 'sine') return Math.sin(2 * Math.PI * frequency * time);
        if (time >= duration) return 0;
        return Math.sin(Math.PI * time / duration) ** 2;
    }

    function createScenario(type, slowSpeed, fastSpeed, length = LENGTH) {
        const joined = type === 'heavy-to-light' || type === 'light-to-heavy';
        if (!joined && type !== 'fixed' && type !== 'free') throw new RangeError('Unknown boundary.');
        const vi = type === 'light-to-heavy' ? fastSpeed : slowSpeed;
        const vt = joined ? (type === 'heavy-to-light' ? fastSpeed : slowSpeed) : null;
        const { r, tau } = joined ? coefficients(vi, vt) : { r: type === 'fixed' ? -1 : 1, tau: 0 };
        return { type, length, boundary: joined ? length / 2 : length, vi, vt, r, tau };
    }

    // Retarded times encode the full source-to-boundary-to-observer path.
    // The left edge and the transmitted right edge are open observation windows.
    function sample(scenario, x, time, options) {
        const { boundary: b, vi, vt, r, tau } = scenario;
        let incident = 0, reflected = 0, transmitted = 0;
        if (x <= b) {
            incident = source(time - x / vi, options);
            reflected = r * source(time - (2 * b - x) / vi, options);
        } else if (vt !== null) {
            transmitted = tau * source(time - b / vi - (x - b) / vt, options);
        }
        return { incident, reflected, transmitted, total: incident + reflected + transmitted };
    }

    function fill(scenario, time, options, values) {
        for (let i = 0; i < values.length; i++) {
            values[i] = sample(scenario, scenario.length * i / (values.length - 1), time, options).total;
        }
    }

    // Last trailing edge to leave the displayed interval; no artificial repeats.
    function pulseEndTime(scenario, duration) {
        const { boundary: b, length, vi, vt, r, tau } = scenario;
        const reflectedExit = r === 0 ? 0 : 2 * b / vi;
        const transmittedExit = tau === 0 ? 0 : b / vi + (length - b) / vt;
        return duration + Math.max(reflectedExit, transmittedExit);
    }

    const api = { LENGTH, TENSION, speed, coefficients, source, createScenario, sample, fill, pulseEndTime };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RopeWaveModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
