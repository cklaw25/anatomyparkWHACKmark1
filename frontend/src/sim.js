// The live body: our own simulation (not the AI). Problems live at sites with a severity 0..1;
// severity drives the vitals through per-site physiology weights. Claude only decides WHICH problems exist.
const BASE = { hr: 72, sys: 120, dia: 78, spo2: 98, temp: 36.8, rr: 14 };

// how a problem at each site pushes the vitals at severity 1.0
const W = {
  brain:       { hr: 10, sys: 18, rr: -2, spo2: -3 },
  spinal_cord: { sys: -25, hr: -10 },
  thyroid:     { hr: 48, temp: 1.6, sys: 10 },
  heart:       { hr: 50, sys: -40, spo2: -7 },
  lungs:       { spo2: -16, rr: 18, hr: 32 },
  liver:       { temp: 0.8, sys: -12, hr: 12 },
  stomach:     { hr: 14, sys: -16 },
  pancreas:    { hr: 26, sys: -24, temp: 1.1 },
  intestines:  { hr: 16, sys: -16, temp: 1.0 },
  kidneys:     { sys: 14, hr: 10 },
  bladder:     { temp: 0.9, hr: 6 },
  blood:       { hr: 42, sys: -40, temp: 2.4, spo2: -5, rr: 8 },
  bone_marrow: { hr: 30, spo2: -9, temp: 1.0 },
  joints:      { hr: 6, temp: 0.8 },
  skin:        { temp: 1.1, hr: 6 },
  left_leg:    { hr: 8 },
  right_leg:   { hr: 8 },
};

export class Body {
  constructor() {
    this.problems = new Map();   // site -> {severity, texts:[], root:bool, rate}
    this.v = { ...BASE };
    this.stabilising = false;
    this.critTime = 0;
  }

  add(site, text, severity, root = false) {
    const p = this.problems.get(site) || { severity: 0, texts: [], root: false, rate: 0.012 };
    p.severity = Math.min(1, Math.max(p.severity, severity));
    if (text && !p.texts.includes(text)) p.texts.push(text);
    p.root = p.root || root;
    // EASY tuning: untreated, the root cause takes ~5 min to become critical, side problems ~7 min
    p.rate = root ? 0.0032 : 0.0022;
    this.problems.set(site, p);
  }

  // a treatment that helps: knock severity down and slow the decline
  heal(site, factor = 0.5) {
    const p = this.problems.get(site); if (!p) return;
    p.severity *= factor; p.rate *= 0.4;
    if (p.severity < 0.03 && !p.root) this.problems.delete(site);
  }

  totalSeverity() { let s = 0; for (const p of this.problems.values()) s += p.severity; return s; }

  tick(dt, t) {
    for (const [site, p] of this.problems) {
      if (this.stabilising) p.severity = Math.max(0, p.severity - 0.12 * dt);
      else p.severity = Math.min(1, p.severity + p.rate * dt);
      if (p.severity <= 0.001 && this.stabilising) this.problems.delete(site);
    }
    // vitals = baseline + physiology weights * severity + a little noise, smoothed
    const target = { ...BASE };
    for (const [site, p] of this.problems) {
      const w = W[site] || {};
      for (const k in w) target[k] += w[k] * p.severity;
    }
    target.dia = target.sys * 0.64;
    target.spo2 = Math.min(100, target.spo2);
    const n = (a) => (Math.random() - 0.5) * a;
    const s = Math.min(1, dt * 1.5);
    this.v.hr += (target.hr + n(3) - this.v.hr) * s;
    this.v.sys += (target.sys + n(2) - this.v.sys) * s;
    this.v.dia += (target.dia + n(2) - this.v.dia) * s;
    this.v.spo2 += (target.spo2 + n(0.6) - this.v.spo2) * s;
    this.v.temp += (target.temp - this.v.temp) * s * 0.5;
    this.v.rr += (target.rr + n(1) - this.v.rr) * s;
    const crit = this.v.spo2 < 80 || this.v.sys < 72 || this.v.hr > 172 || this.v.temp > 41.2 || this.totalSeverity() > 4.8;
    this.critTime = crit ? this.critTime + dt : Math.max(0, this.critTime - dt);
    return this.critTime > 20; // true = the patient codes (game over): 20 s of critical vitals
  }

  status() {
    const v = this.v;
    if (this.critTime > 0) return 'CRITICAL';
    if (v.spo2 < 90 || v.sys < 90 || v.hr > 125 || v.temp > 38.6) return 'DETERIORATING';
    if (this.problems.size === 0) return 'STABLE';
    return 'UNWELL';
  }
}
