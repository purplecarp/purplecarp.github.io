/* Lengths are in centimetres, time in seconds. No rendering coordinates enter the model. */
class RippleTankModel {
    constructor() {
        this.width = 60;
        this.depth = 4;
        this.nWater = 1.333;
        this.wavelength = 12;
        this.amplitude = 0.35;
        this.frequency = 1;
        this.screenGap = 12;
        this.mode = 'traveling';
        this.time = 0;
        this.binSize = 0.1;
        this.blurSigma = 0.12;
        this.raySpacing = 0.05;
    }

    height(x, time = this.time) {
        const phase = 2 * Math.PI * this.frequency * time;
        const kx = 2 * Math.PI * x / this.wavelength;
        if (this.mode === 'standing') return this.amplitude * Math.cos(kx) * Math.cos(phase);
        return this.amplitude * Math.cos(kx + (this.mode === 'travelingLeft' ? phase : -phase));
    }

    slope(x, time = this.time) {
        const k = 2 * Math.PI / this.wavelength;
        const phase = 2 * Math.PI * this.frequency * time;
        if (this.mode === 'standing') return -this.amplitude * k * Math.sin(k * x) * Math.cos(phase);
        return -this.amplitude * k * Math.sin(k * x + (this.mode === 'travelingLeft' ? phase : -phase));
    }

    // I follows propagation; N is a unit normal pointing back into the incident medium.
    // Snell vector form: https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission
    static refract(direction, normal, n1, n2) {
        const cosI = -(direction.x * normal.x + direction.z * normal.z);
        const ratio = n1 / n2;
        const discriminant = 1 - ratio * ratio * Math.max(0, 1 - cosI * cosI);
        if (cosI < 0 || discriminant < 0) return null;
        const term = ratio * cosI - Math.sqrt(discriminant);
        return { x: ratio * direction.x + term * normal.x, z: ratio * direction.z + term * normal.z };
    }

    traceRay(x) {
        const surfaceZ = -this.height(x); // z increases downward, mean water surface is z = 0.
        const slope = this.slope(x);
        const norm = Math.hypot(slope, 1);
        const water = RippleTankModel.refract({ x: 0, z: 1 }, { x: -slope / norm, z: -1 / norm }, 1, this.nWater);
        if (!water || water.z <= 0) return null;
        const bottomX = x + water.x / water.z * (this.depth - surfaceZ);
        const air = RippleTankModel.refract(water, { x: 0, z: -1 }, this.nWater, 1);
        // Totally internally reflected rays do not arrive at the screen.
        if (!air || air.z <= 0) return { x, surfaceZ, bottomX, hitX: null, water, air: null };
        return { x, surfaceZ, bottomX, hitX: bottomX + air.x / air.z * this.screenGap, water, air };
    }

    computeFrame() {
        // Trace an extended plane wave to avoid artificial dim borders in the central view.
        const padding = this.width;
        const start = -padding;
        const end = this.width + padding;
        const bins = Math.round((end - start) / this.binSize) + 1;
        const energy = new Float64Array(bins);
        const rays = [];
        const rayCount = Math.round((end - start) / this.raySpacing);
        const spacing = (end - start) / rayCount;
        let transmitted = 0;
        for (let i = 0; i < rayCount; i++) {
            const x = start + (i + 0.5) * spacing;
            const ray = this.traceRay(x);
            if (i % 24 === 0 && x >= 0 && x <= this.width) rays.push(ray);
            if (!ray || ray.hitX === null) continue;
            transmitted++;
            const bin = (ray.hitX - start) / this.binSize;
            const left = Math.floor(bin);
            const fraction = bin - left;
            const weight = spacing / this.binSize;
            if (left >= 0 && left < bins) energy[left] += (1 - fraction) * weight;
            if (left + 1 >= 0 && left + 1 < bins) energy[left + 1] += fraction * weight;
        }
        // A fixed, normalized point-spread kernel preserves energy and a flat-water level of 1.
        const radius = Math.ceil(3 * this.blurSigma / this.binSize);
        const kernel = [];
        let kernelSum = 0;
        for (let j = -radius; j <= radius; j++) {
            const weight = Math.exp(-0.5 * (j * this.binSize / this.blurSigma) ** 2);
            kernel.push(weight);
            kernelSum += weight;
        }
        const count = Math.round(this.width / this.binSize) + 1;
        const intensity = new Float64Array(count);
        const offset = Math.round(padding / this.binSize);
        for (let i = 0; i < count; i++) {
            for (let j = -radius; j <= radius; j++) intensity[i] += energy[offset + i + j] * kernel[j + radius] / kernelSum;
        }
        return { intensity, rays: rays.filter(Boolean), transmittedFraction: transmitted / rayCount };
    }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { RippleTankModel };
