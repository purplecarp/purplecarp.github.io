/* Equal-amplitude, monochromatic outgoing circular waves. Distances in cm. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RippleModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = 2 * Math.PI;
  function field(p, t, x, y) {
    const r1 = Math.hypot(x + p.separation / 2, y);
    const r2 = Math.hypot(x - p.separation / 2, y);
    const k = TAU / p.wavelength, phase = p.phase * Math.PI / 180;
    const a1 = p.sources === 's2' ? 0 : p.amplitude;
    const a2 = p.sources === 's1' ? 0 : p.amplitude;
    const first = a1 * Math.cos(k * r1 - TAU * p.frequency * t);
    const second = a2 * Math.cos(k * r2 - TAU * p.frequency * t + phase);
    const delta = k * (r2 - r1) + phase;
    // Complex amplitude avoids loss of precision near exact cancellation.
    const envelope = Math.hypot(a1 + a2 * Math.cos(delta), a2 * Math.sin(delta));
    return {r1, r2, pathDifference:r2-r1, first, second, height:first+second, envelope, delta};
  }
  function state(p,t) {
    return {...field(p,t,p.probeX || 0,p.probeY || 0), waveSpeed:p.frequency*p.wavelength, period:1/p.frequency};
  }
  function nodes(p) {
    if (p.sources !== 'both' || p.amplitude === 0) return [];
    const paths = [], d = p.separation;
    for (let m = -Math.ceil(d/p.wavelength)-2; m <= Math.ceil(d/p.wavelength)+2; m++) {
      const diff = p.wavelength * (m + .5 - p.phase/360);
      if (Math.abs(diff) >= d-1e-9) continue;
      const path = [];
      for (let y = -30; y <= 30; y += .5) {
        const a = Math.abs(diff)/2, b2 = (d*d-diff*diff)/4;
        const x = Math.abs(diff)<1e-9 ? 0 : -Math.sign(diff)*a*Math.sqrt(1+y*y/b2);
        if (Math.abs(x)<=30) path.push({x,y});
      }
      if(path.length>1) paths.push(path);
    }
    return paths;
  }
  return {field,state,nodes};
});
