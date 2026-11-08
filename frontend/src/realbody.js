// Near-realistic body rendering. No hard outlines or flat fills: bodies are shaded with soft inner shadows,
// and each scan layer borrows the look of a real imaging modality (radiograph, angiogram, bronchogram, atlas plate).
// Everything is procedural and seeded, so it is identical every time and needs no image assets.
// Coordinates share the 600x880 viewBox and the SITES map in anatomy.js. Viewer-left = the patient's right.

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f = (n) => n.toFixed(1);

// Catmull-Rom through the points, as cubic Beziers
export function curve(pts, closed = false) {
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const flip = (s) => `<g transform="translate(600 0) scale(-1 1)">${s}</g>`;
const both = (s) => s + flip(s);

// ---- the body outline: viewer-left half, head to crotch; the right half is mirrored into one seamless path ----
const HALF = [[300, 24], [274, 29], [258, 50], [254, 82], [258, 106], [270, 124], [283, 136], [283, 156], [262, 167], [226, 173], [197, 180], [178, 199], [170, 238],
  [165, 276], [157, 330], [152, 392], [150, 436], [147, 464], [142, 486], [146, 508], [160, 516], [174, 506], [181, 474], [186, 432], [195, 362], [204, 296], [207, 264],
  [209, 306], [216, 362], [222, 410], [216, 462], [206, 524], [208, 586], [216, 640], [228, 692], [230, 730], [240, 790], [244, 824], [232, 850], [272, 856], [282, 830], [288, 760], [290, 700], [294, 640], [299, 604]];
const FULL = [...HALF, [300, 601], ...HALF.slice(1).reverse().map(([x, y]) => [600 - x, y])];
export const BODY = curve(FULL, true);

export const FILTERS = `
  <filter id="b1" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation="1.1"/></filter>
  <filter id="b3" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="b7" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="b12" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="neon" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation="3.2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="xray" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><feGaussianBlur stdDeviation=".45" result="s"/><feGaussianBlur stdDeviation="4" result="h"/><feComponentTransfer in="h" result="h2"><feFuncA type="linear" slope=".75"/></feComponentTransfer><feMerge><feMergeNode in="h2"/><feMergeNode in="s"/></feMerge></filter>`;

// The translucent body every scan sits inside (the illustrators' "ghosting": faint surface, bold deep structures)
export function ghost(tint = '#6fd0ff') {
  return `<defs>${FILTERS}<clipPath id="ghostClip"><path d="${BODY}"/></clipPath>
      <linearGradient id="ghostF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2134"/><stop offset=".5" stop-color="#0c1a2a"/><stop offset="1" stop-color="#0a1522"/></linearGradient></defs>
    <g id="holo">
      <path d="${BODY}" fill="${tint}" opacity=".16" filter="url(#b12)"/>
      <path d="${BODY}" fill="url(#ghostF)" opacity=".94"/>
      <g clip-path="url(#ghostClip)"><path d="${BODY}" fill="none" stroke="${tint}" stroke-width="10" opacity=".3" filter="url(#b7)"/></g>
      <path d="${BODY}" fill="none" stroke="${tint}" stroke-width="1" opacity=".5"/>
    </g>`;
}

// ---- generic tissue helpers ----
let uid = 0;
function organ(d, light, mid, dark, extra = '') {
  const id = `og${uid++}`;
  return `<radialGradient id="${id}" cx=".4" cy=".32" r=".85"><stop offset="0" stop-color="${light}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
    <path d="${d}" fill="url(#${id})" stroke="${dark}" stroke-width=".8" ${extra}/>`;
}
const sheen = (x, y, rx, ry, o = .35, rot = 0) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" filter="url(#b3)" transform="rotate(${rot} ${x} ${y})"/>`;

// A branching vessel/nerve/airway tree. `keep` optionally restricts where it may grow.
function tree(out, r, x, y, a, len, w, depth, col, spread = .55, keep = null) {
  if (depth <= 0 || w < .22) return;
  const pts = [[x, y]]; let cx = x, cy = y, ca = a;
  for (let i = 0; i < 3; i++) { ca += (r() - .5) * .34; cx += Math.cos(ca) * len / 3; cy += Math.sin(ca) * len / 3; if (keep && !keep(cx, cy)) return; pts.push([cx, cy]); }
  out.push(`<path d="${curve(pts)}" stroke="${col}" stroke-width="${f(w)}" opacity="${f(Math.min(1, .35 + w * .5))}"/>`);
  tree(out, r, cx, cy, ca + spread * (.5 + r() * .6), len * (.68 + r() * .14), w * .68, depth - 1, col, spread, keep);
  tree(out, r, cx, cy, ca - spread * (.5 + r() * .6), len * (.68 + r() * .14), w * .68, depth - 1, col, spread, keep);
}
const line = (pts, w, col, extra = '') => `<path d="${curve(pts)}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" ${extra}/>`;

// ---- SKELETAL: a full-body radiograph ----
function longBone(x0, y0, x1, y1, w, flareA = 1, flareB = 1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, N = 18;
  const prof = (t, k) => w * k * (1 + flareA * Math.exp(-((t / .07) ** 2)) + flareB * Math.exp(-(((1 - t) / .07) ** 2)));
  const side = (s, k) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N, p = prof(t, k) * s; return [x0 + dx * t + nx * p, y0 + dy * t + ny * p]; });
  const outer = [...side(1, 1), ...side(-1, 1).reverse()];
  const inner = [...side(1, .42).slice(3, -3), ...side(-1, .42).slice(3, -3).reverse()];
  return `<path d="${curve(outer, true)}" fill="#d7ecfa" fill-opacity=".62" stroke="#f2fbff" stroke-width="1.1"/>
    <path d="${curve(inner, true)}" fill="#0d1a28" opacity=".62"/>`;
}
const bone = (d, o = .55) => `<path d="${d}" fill="#d7ecfa" fill-opacity="${o}" stroke="#f2fbff" stroke-width="1"/>`;

function hand() {
  let s = ''; const carp = [[150, 454], [159, 451], [168, 454], [152, 463], [161, 461], [170, 464]];
  carp.forEach(([x, y]) => { s += `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="3.9" fill="#d7ecfa" fill-opacity=".6" stroke="#f2fbff" stroke-width=".7"/>`; });
  [[147, 468, 142, 488], [153.5, 468, 151, 491], [160, 469, 160, 492], [166.5, 469, 169, 489]].forEach(([a, b, c, d], i) => {
    s += longBone(a, b, c, d, 1.5, .5, .5);
    const seg = [10, 6.5, 5], dirx = (c - a) / 22; let x = c, y = d + 1.5;
    seg.forEach((l) => { s += longBone(x, y, x + dirx * l, y + l, 1.05, .4, .4); x += dirx * l; y += l + 1.2; });
  });
  s += longBone(172, 463, 180, 478, 1.7, .5, .5) + longBone(181, 480, 184, 490, 1.2, .4, .4) + longBone(184.5, 492, 186, 499, 1.05, .4, .4);
  return s;
}
function foot() {
  let s = `<ellipse cx="258" cy="832" rx="11" ry="6" fill="#d7ecfa" fill-opacity=".6" stroke="#f2fbff" stroke-width=".8"/>`;
  [240, 247, 254, 261, 268].forEach((x, i) => { s += longBone(x + 2, 836, x - 1, 847, 1.3, .5, .5) + longBone(x - 1, 848.5, x - 2, 854, 1, .4, .4); });
  return s;
}

function skeletal() {
  // skull
  let s = `<path d="${curve([[300, 26], [270, 32], [255, 56], [256, 84], [266, 96], [334, 96], [344, 84], [345, 56], [330, 32]], true)}" fill="#d7ecfa" fill-opacity=".5" stroke="#f2fbff" stroke-width="1.8"/>
    <path d="${curve([[300, 32], [275, 38], [262, 60], [263, 82]])}" fill="none" stroke="#0d1a28" stroke-width="3.5" opacity=".5"/>
    <path d="${curve([[300, 32], [325, 38], [338, 60], [337, 82]])}" fill="none" stroke="#0d1a28" stroke-width="3.5" opacity=".5"/>`;
  s += both(`<path d="${curve([[272, 79], [283, 73], [293, 79], [293, 91], [281, 95], [271, 90]], true)}" fill="#04080e" stroke="#f2fbff" stroke-width="1.1"/>
    <path d="${curve([[264, 94], [258, 104], [268, 112], [276, 104]])}" fill="none" stroke="#f2fbff" stroke-width="2.4" opacity=".85"/>`);
  s += `<path d="M300 92 C294 98 290 106 292 112 C296 115 304 115 308 112 C310 106 306 98 300 92Z" fill="#04080e" stroke="#f2fbff" stroke-width="1"/>
    <line x1="300" y1="93" x2="300" y2="113" stroke="#f2fbff" stroke-width="1"/>
    <path d="${curve([[258, 108], [262, 134], [282, 152], [300, 155], [318, 152], [338, 134], [342, 108], [334, 116], [326, 134], [300, 142], [274, 134], [266, 116]], true)}" fill="#d7ecfa" fill-opacity=".55" stroke="#f2fbff" stroke-width="1.2"/>`;
  for (let i = -6; i <= 6; i++) s += `<rect x="${300 + i * 4.7 - 2}" y="118" width="4" height="7.5" rx="1" fill="#eaf7ff" opacity=".9"/><rect x="${300 + i * 4.5 - 2}" y="127" width="4" height="7" rx="1" fill="#eaf7ff" opacity=".85"/>`;
  s += `<path d="M262 50 l6 3 l-2 6 l7 3 l-2 7 M338 50 l-6 3 l2 6 l-7 3 l2 7" fill="none" stroke="#0d1a28" stroke-width="1" opacity=".7"/>`;

  // spine: C1-7, T1-12, L1-5
  let y = 150;
  for (let i = 0; i < 24; i++) {
    const h = i < 7 ? 6.6 : i < 19 ? 13.2 : 18, w = i < 7 ? 11 : i < 19 ? 13 + (i - 7) * .55 : 22 + (i - 19);
    s += `<rect x="${f(300 - w)}" y="${f(y)}" width="${f(w * 2)}" height="${f(h)}" rx="${f(h * .3)}" fill="#d7ecfa" fill-opacity=".58" stroke="#f2fbff" stroke-width=".8"/>
      <ellipse cx="${f(300 - w * .55)}" cy="${f(y + h * .45)}" rx="${f(w * .14)}" ry="${f(h * .26)}" fill="none" stroke="#f2fbff" stroke-width=".7" opacity=".85"/>
      <ellipse cx="${f(300 + w * .55)}" cy="${f(y + h * .45)}" rx="${f(w * .14)}" ry="${f(h * .26)}" fill="none" stroke="#f2fbff" stroke-width=".7" opacity=".85"/>
      <path d="M${f(300 - w * .16)} ${f(y + h)} L300 ${f(y + h * .4)} L${f(300 + w * .16)} ${f(y + h)}" fill="#eaf7ff" opacity=".65"/>`;
    y += h + 1.6;
  }

  // ribs, as on a frontal film: posterior arc out, anterior arc sweeping down and medially
  let ribs = '';
  for (let i = 0; i < 12; i++) {
    const yb = 172 + i * 15.2, reach = 34 + Math.min(i, 6) * 10 + (i > 8 ? -(i - 8) * 8 : 0), w = 3.8 + Math.min(i, 5) * .5;
    if (i < 10) {
      const sy = 196 + i * 13, sx = 300 - 13 - Math.max(0, i - 6) * 7;
      ribs += line([[288, yb], [300 - reach * .75, yb - 8], [300 - reach - 6, yb + 12], [300 - reach - 2, yb + 34]], w, '#dcefff', 'opacity=".85"');
      ribs += line([[300 - reach - 2, yb + 34], [300 - reach * .72, yb + 50], [sx - 26, sy + 22], [sx - 10, sy + 12]], w * .8, '#dcefff', 'opacity=".78"');
      ribs += line([[sx - 10, sy + 12], [sx, sy + 6]], w * .7, '#9fc6e0', 'opacity=".45"');
    } else {
      ribs += line([[288, yb], [300 - reach * .6, yb + 8], [300 - reach * .95, yb + 24]], w * .85, '#dcefff', 'opacity=".78"');
    }
  }
  s += both(ribs);
  s += `<path d="${curve([[282, 184], [318, 184], [320, 200], [309, 214], [291, 214], [280, 200]], true)}" fill="#d7ecfa" fill-opacity=".62" stroke="#f2fbff" stroke-width="1"/>
    <path d="${curve([[290, 216], [310, 216], [313, 270], [310, 306], [290, 306], [287, 270]], true)}" fill="#d7ecfa" fill-opacity=".58" stroke="#f2fbff" stroke-width="1"/>
    <path d="M294 308 L306 308 L300 330Z" fill="#d7ecfa" fill-opacity=".4" stroke="#f2fbff" stroke-width=".8"/>`;

  // shoulder girdle
  const limbs = `<path d="${curve([[286, 188], [262, 176], [238, 180], [212, 172], [206, 178], [236, 188], [260, 186], [284, 196]], true)}" fill="#d7ecfa" fill-opacity=".62" stroke="#f2fbff" stroke-width="1"/>
    <path d="${curve([[204, 176], [254, 196], [244, 248], [218, 292], [206, 240], [200, 200]], true)}" fill="#d7ecfa" fill-opacity=".24" stroke="#f2fbff" stroke-width=".9"/>
    <circle cx="198" cy="192" r="15" fill="#d7ecfa" fill-opacity=".5" stroke="#f2fbff" stroke-width="1.2"/>
    ${longBone(197, 200, 177, 330, 5.8, .95, 1.5)}
    ${longBone(172, 338, 155, 447, 3.4, .95, .95)}${longBone(180, 336, 169, 447, 3.5, 1.3, .55)}
    ${hand()}
    ${/* pelvis */ ''}
    <path d="${curve([[290, 512], [254, 500], [214, 512], [212, 544], [232, 566], [260, 570], [270, 610], [286, 618], [294, 596], [284, 566], [292, 540]], true)}" fill="#d7ecfa" fill-opacity=".48" stroke="#f2fbff" stroke-width="1.5"/>
    <ellipse cx="271" cy="592" rx="10" ry="15" fill="#04080e" stroke="#f2fbff" stroke-width=".9" transform="rotate(-14 271 592)"/>
    <circle cx="248" cy="558" r="15" fill="#d7ecfa" fill-opacity=".6" stroke="#f2fbff" stroke-width="1.1"/>
    ${longBone(237, 566, 257, 694, 7.6, .55, 1.65)}
    <path d="${curve([[250, 560], [232, 552], [226, 566], [240, 578]], true)}" fill="#d7ecfa" fill-opacity=".55" stroke="#f2fbff" stroke-width=".9"/>
    <ellipse cx="258" cy="694" rx="11" ry="12.5" fill="#eaf7ff" fill-opacity=".36" stroke="#f2fbff" stroke-width=".9"/>
    ${longBone(259, 707, 259, 824, 5.2, 1.5, .85)}${longBone(238, 712, 244, 826, 1.8, 1.3, 1.1)}
    ${foot()}`;
  s += both(limbs);
  s += `<path d="${curve([[276, 512], [324, 512], [316, 554], [300, 572], [284, 554]], true)}" fill="#d7ecfa" fill-opacity=".55" stroke="#f2fbff" stroke-width="1.1"/>`;
  for (let i = 0; i < 4; i++) s += both(`<circle cx="${288 + i * 1.6}" cy="${524 + i * 10}" r="2.6" fill="#04080e" stroke="#f2fbff" stroke-width=".6"/>`);
  return `<g filter="url(#xray)">${s}</g>`;
}

// ---- CIRCULATORY: an angiogram ----
const HEART = curve([[290, 246], [312, 234], [340, 248], [357, 278], [347, 306], [326, 314], [300, 306], [284, 284], [282, 262]], true);
function heart(rim = '#ff9a9a') {
  const r = rng(90), cor = [];
  tree(cor, r, 310, 248, 1.3, 20, 1.5, 4, '#ffe0d8', .5, (x, y) => x > 280 && x < 356 && y > 236 && y < 314);
  tree(cor, r, 332, 256, 2.1, 18, 1.2, 4, '#ffe0d8', .5, (x, y) => x > 280 && x < 356 && y > 236 && y < 314);
  return organ(HEART, '#ff8a78', '#d92c38', '#6a0f1e', `stroke-opacity=".9"`) + sheen(306, 262, 15, 9, .32, -28) +
    `<g fill="none" stroke-linecap="round" opacity=".85">${cor.join('')}</g>` + `<path d="${HEART}" fill="none" stroke="${rim}" stroke-width="1" opacity=".75"/>`;
}
function circulatory() {
  const A = '#ff2b45', V = '#3f8bff', paths = [], r = rng(7);
  const artery = (p, w) => paths.push(line(p, w, A));
  const vein = (p, w) => paths.push(line(p, w, V, 'opacity=".92"'));
  const lift = (arr, dx) => arr.map(([x, y]) => [x + dx, y]);
  const armA = [[276, 196], [232, 184], [204, 196], [190, 250], [180, 326]], foreR = [[180, 326], [168, 390], [156, 450]], foreU = [[180, 326], [180, 390], [172, 450]];
  const legA = [[296, 512], [262, 546], [246, 600], [254, 690], [254, 760], [258, 826]];
  // veins first, so arteries read on top
  const veins = [lift(armA, 6), lift(foreR, 6), lift(foreU, -5), lift(legA, 8)];
  veins.forEach((p, i) => { vein(p, [3, 1.8, 1.8, 3.4][i]); vein(p.map(([x, y]) => [600 - x, y]), [3, 1.8, 1.8, 3.4][i]); });
  vein([[290, 240], [290, 180], [283, 150], [280, 82]], 3.4); vein([[290, 240], [292, 172], [318, 150], [320, 84]], 3);
  vein([[310, 310], [312, 400], [310, 512]], 6);
  vein([[310, 512], [264, 548]], 4); vein([[310, 512], [344, 548]], 4);
  // trunk arteries
  artery([[310, 236], [292, 210], [316, 190], [340, 212], [326, 244]], 8);
  artery([[326, 244], [318, 320], [302, 420], [298, 512]], 6.6);
  artery([[300, 196], [288, 150], [282, 112]], 3); artery([[314, 192], [318, 150], [322, 112]], 3);
  [[armA, 3.6], [foreR, 2], [foreU, 2], [legA, 4.2]].forEach(([p, w]) => { artery(p, w); artery(p.map(([x, y]) => [600 - x, y]), w); });
  artery([[304, 420], [262, 424]], 3); artery([[304, 420], [344, 424]], 3);
  artery([[312, 342], [284, 346], [258, 346]], 2.6); artery([[310, 346], [342, 346], [372, 356]], 2.4);
  artery([[300, 440], [282, 470], [296, 500]], 2);

  // fine branches
  const fine = [], veinsFine = [];
  const grow = (x, y, a, l, w, d, col = A, out = fine, sp = .6) => tree(out, r, x, y, a, l, w, d, col, sp);
  [[282, 112, -1.9], [322, 112, -1.2], [300, 66, 1.4]].forEach(([x, y, a]) => { grow(x, y, a, 18, 1.6, 6, A, fine, .75); });
  for (const m of [1, -1]) {
    const X = (x) => m === 1 ? x : 600 - x, S = (a) => m === 1 ? a : Math.PI - a;
    [[204, 200, 2.6], [190, 250, 2.6], [186, 290, .5], [180, 326, 2.2], [168, 390, 2.6], [180, 390, .5]].forEach(([x, y, a]) => grow(X(x), y, S(a), 14, 1.2, 4));
    [[156, 450, 1.75], [172, 450, 1.45]].forEach(([x, y, a]) => grow(X(x), y, S(a), 11, 1.3, 6, A, fine, .28));
    [[248, 590, .35], [246, 620, 2.7], [250, 660, .4], [254, 700, 2.6], [254, 740, .4], [256, 790, 2.2]].forEach(([x, y, a]) => grow(X(x), y, S(a), 16, 1.5, 5));
    [[258, 826, 1.55]].forEach(([x, y, a]) => grow(X(x), y, S(a), 10, 1.2, 5, A, fine, .4));
    [[252, 610, .4], [256, 720, 2.6]].forEach(([x, y, a]) => grow(X(x) + 6 * m, y, S(a), 15, 1.1, 4, V, veinsFine));
  }
  [[262, 424, 2.6], [344, 424, .5], [258, 346, 2.8], [372, 356, .6], [282, 470, 2.4], [296, 500, .7]].forEach(([x, y, a]) => grow(x, y, a, 15, 1.4, 5));
  for (let i = 0; i < 5; i++) grow(305, 330 + i * 34, i % 2 ? .3 : 2.8, 22, 1.2, 4);
  return `<g fill="none" stroke-linecap="round" opacity=".7" filter="url(#b1)">${veinsFine.join('')}${fine.join('')}</g>
    <g fill="none" stroke-linecap="round" filter="url(#neon)">${paths.join('')}</g>${heart()}`;
}

// ---- RESPIRATORY: a bronchogram inside translucent lungs ----
const LUNG_R = curve([[292, 208], [252, 204], [222, 244], [208, 304], [212, 346], [240, 340], [272, 336], [293, 346], [296, 280]], true);
const LUNG_L = curve([[314, 212], [350, 204], [380, 244], [392, 304], [388, 346], [364, 340], [336, 338], [352, 306], [340, 268], [316, 252]], true);
function respiratory() {
  const col = '#49dcff', r = rng(21), out = [];
  const inR = (x, y) => x > 210 && x < 294 && y > 212 && y < 340 + (x > 250 ? -2 : 4), inL = (x, y) => x > 322 && x < 390 && y > 212 && y < 340;
  let s = `<path d="${LUNG_R}" fill="#1caad8" fill-opacity=".22" stroke="${col}" stroke-width="1.5" filter="url(#b1)"/>
    <path d="${LUNG_L}" fill="#1caad8" fill-opacity=".22" stroke="${col}" stroke-width="1.5" filter="url(#b1)"/>`;
  s += `<path d="${curve([[214, 282], [246, 266], [292, 288]])}" fill="none" stroke="${col}" stroke-width=".9" opacity=".55" stroke-dasharray="3 3"/>
    <path d="${curve([[232, 324], [260, 296], [291, 298]])}" fill="none" stroke="${col}" stroke-width=".9" opacity=".55" stroke-dasharray="3 3"/>
    <path d="${curve([[390, 322], [358, 284], [324, 262]])}" fill="none" stroke="${col}" stroke-width=".9" opacity=".55" stroke-dasharray="3 3"/>`;
  [[286, 236, 2.7, 18], [282, 244, 2.2, 17], [280, 250, 1.8, 18], [278, 252, 2.9, 15]].forEach(([x, y, a, l]) => tree(out, r, x, y, a, l, 2.9, 7, col, .5, inR));
  [[316, 236, .4, 18], [322, 244, .95, 17], [328, 262, 1.3, 16], [322, 240, .1, 15]].forEach(([x, y, a, l]) => tree(out, r, x, y, a, l, 2.7, 7, col, .5, inL));
  for (let i = 0; i < 520; i++) {
    const left = r() < .54, x = left ? 212 + r() * 82 : 322 + r() * 68, y = 212 + r() * 128;
    if (left ? inR(x, y) : inL(x, y)) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.5 + r() * .8)}" fill="${col}" opacity="${f(.14 + r() * .3)}"/>`;
  }
  const trunk = [line([[300, 146], [300, 228]], 11, col, 'opacity=".35"'),
    line([[300, 228], [283, 243], [276, 254]], 7.5, col, 'opacity=".5"'), line([[300, 228], [319, 241], [328, 254]], 7, col, 'opacity=".5"')];
  let rings = ''; for (let i = 0; i < 12; i++) rings += `<path d="M294 ${150 + i * 6.3} Q300 ${153 + i * 6.3} 306 ${150 + i * 6.3}" stroke="#d9f6ff" stroke-width="1.6" fill="none"/>`;
  const dia = `<path d="${curve([[208, 352], [240, 334], [290, 346], [316, 348], [360, 336], [392, 352]])}" fill="none" stroke="${col}" stroke-width="2.2" opacity=".65"/>`;
  const nose = `<path d="${curve([[288, 100], [296, 88], [304, 88], [312, 100], [306, 124], [300, 146], [294, 124]], true)}" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width="1.2"/>`;
  return s + `<g fill="none" stroke-linecap="round" filter="url(#b1)">${out.join('')}</g><g filter="url(#neon)" stroke-linecap="round">${trunk.join('')}${rings}${dia}${nose}</g>`;
}

// ---- NERVOUS: brain, cord, roots and peripheral trees ----
function brainFolds(col) {
  const r = rng(33); let s = '';
  for (let i = 0; i < 34; i++) {
    const a = r() * 6.283, d = 6 + r() * 34, x = 300 + Math.cos(a) * d, y = 66 + Math.sin(a) * d * .85, pts = [[x, y]]; let cx = x, cy = y, ca = r() * 6.283;
    for (let j = 0; j < 6; j++) { ca += (j % 2 ? 1 : -1) * (.8 + r() * .9); cx += Math.cos(ca) * 7; cy += Math.sin(ca) * 7; pts.push([Math.min(340, Math.max(260, cx)), Math.min(106, Math.max(30, cy))]); }
    s += `<path d="${curve(pts)}" stroke="${col}" stroke-width="1.1" fill="none" opacity=".62"/>`;
  }
  return s;
}
function nervous() {
  const col = '#ffb02e', hot = '#ffe39a', r = rng(47), fine = [];
  const brain = curve([[300, 28], [270, 33], [256, 56], [258, 90], [278, 108], [300, 112], [322, 108], [342, 90], [344, 56], [330, 33]], true);
  let s = organ(brain, '#ffd887', '#c97f1f', '#5a3208') + `<g filter="url(#b1)">${brainFolds('#3f2204')}</g>` + `<path d="M300 30 L300 110" stroke="#3a2005" stroke-width="2"/>` + `<path d="${brain}" fill="none" stroke="${hot}" stroke-width="1" opacity=".7"/>`;
  const trunks = [line([[300, 110], [300, 500]], 5.2, hot), line([[300, 500], [298, 545]], 2.6, hot)];
  for (let i = 0; i < 31; i++) {
    const y = 134 + i * 12.4, out = 36 + (i < 8 ? i * 5 : 40 + (i % 3) * 7);
    for (const m of [-1, 1]) {
      trunks.push(line([[300, y], [300 + m * 14, y + 4], [300 + m * (14 + out * .5), y + 14]], 1.5, col));
      tree(fine, r, 300 + m * (14 + out * .5), y + 14, m === 1 ? .35 : Math.PI - .35, out * .4, .95, 4, col, .55, (x, yy) => x > 200 && x < 400);
    }
  }
  for (const m of [1, -1]) {
    const X = (x) => m === 1 ? x : 600 - x;
    const arm = [[282, 196], [232, 196], [200, 226], [180, 326], [162, 446]], ul = [[200, 226], [190, 330], [172, 446]], leg = [[296, 540], [258, 570], [250, 700], [256, 824]], per = [[250, 690], [236, 760], [240, 826]];
    [[arm, 2.6], [ul, 1.8], [leg, 3.6], [per, 1.9]].forEach(([p, w]) => trunks.push(line(p.map(([x, y]) => [X(x), y]), w, hot)));
    for (const [x, y, a, d] of [[210, 214, 2.5, 4], [192, 270, .3, 4], [180, 326, 2.4, 4], [172, 390, 2.4, 4], [162, 446, 1.72, 6], [172, 446, 1.45, 6], [254, 610, .3, 5], [252, 650, 2.8, 5], [250, 700, .4, 4], [254, 760, .4, 5], [256, 824, 1.55, 5], [240, 826, 1.7, 5]])
      tree(fine, r, X(x), y, m === 1 ? a : Math.PI - a, d > 5 ? 11 : 17, 1.2, d, col, d > 5 ? .3 : .55);
  }
  for (const [x, y, a] of [[270, 96, 2.4], [330, 96, .7], [286, 112, 1.9], [314, 112, 1.2]]) tree(fine, r, x, y, a, 14, 1.2, 4, col, .6);
  return `<g fill="none" stroke-linecap="round" opacity=".85" filter="url(#b1)">${fine.join('')}</g><g fill="none" stroke-linecap="round" filter="url(#neon)">${trunks.join('')}</g>${s}`;
}

// ---- shared abdominal organs (atlas plate shading) ----
const LIVER = curve([[222, 330], [260, 316], [316, 322], [348, 336], [336, 354], [296, 366], [272, 388], [240, 392], [220, 368]], true);
const STOMACH = curve([[322, 330], [352, 322], [374, 342], [376, 376], [354, 402], [316, 406], [296, 396], [312, 382], [336, 376], [340, 356], [328, 346]], true);
const SPLEEN = curve([[378, 336], [394, 348], [396, 378], [384, 390], [378, 372]], true);
const PANCREAS = curve([[272, 392], [296, 384], [330, 392], [370, 384], [376, 392], [334, 406], [298, 408], [276, 408]], true);
const KIDNEY = curve([[252, 392], [266, 400], [268, 416], [260, 424], [266, 436], [258, 448], [240, 442], [234, 418], [240, 398]], true);
const BLADDER = curve([[300, 526], [326, 534], [326, 556], [300, 568], [274, 556], [274, 534]], true);
const liver = () => organ(LIVER, '#d8705a', '#8c2c2a', '#3f0f14') + sheen(258, 342, 28, 12, .28, -14) + `<path d="${curve([[292, 322], [286, 346], [290, 364]])}" fill="none" stroke="#3f0f14" stroke-width="1.2" opacity=".7"/>`;
const gall = () => organ(curve([[286, 372], [300, 374], [302, 392], [290, 398], [282, 386]], true), '#a8d86a', '#4f8a2a', '#1f3f10');
function stomach() {
  let s = organ(STOMACH, '#ffc0a8', '#e0786a', '#7a2a30') + sheen(350, 350, 12, 22, .3, 20);
  for (let i = 0; i < 6; i++) s += `<path d="${curve([[330 + i * 6, 340 + i * 3], [336 + i * 6, 362], [326 + i * 7, 388 - i]])}" fill="none" stroke="#8c3440" stroke-width="1.2" opacity=".55"/>`;
  return s;
}
const spleen = () => organ(SPLEEN, '#a0506a', '#5a1a3a', '#260816') + sheen(386, 360, 3, 12, .3);
const pancreas = () => { const r = rng(5); let s = organ(PANCREAS, '#ffe2a0', '#d8a050', '#7a4f18'); for (let i = 0; i < 38; i++) s += `<circle cx="${f(278 + r() * 92)}" cy="${f(390 + r() * 15)}" r="${f(.7 + r())}" fill="#7a4f18" opacity=".35"/>`; return s; };
const kidneys = () => both(organ(KIDNEY, '#c86a50', '#7a2a24', '#320e0c') + sheen(247, 412, 5, 11, .3) + `<path d="${curve([[264, 420], [254, 424], [250, 436]])}" fill="none" stroke="#f0d8a0" stroke-width="1.6" opacity=".85"/><path d="${curve([[258, 436], [270, 490], [282, 536]])}" fill="none" stroke="#f0d8a0" stroke-width="1.4" opacity=".75"/>`);
const bladder = () => organ(BLADDER, '#ffe6a8', '#d8a848', '#7a5418') + sheen(292, 540, 10, 7, .4);
function intestines(thin = 9) {
  // a smooth coiled small bowel, framed by the colon with its haustral folds
  const colon = curve([[252, 512], [248, 478], [248, 442], [262, 424], [298, 420], [336, 422], [352, 442], [352, 478], [346, 512], [322, 524], [312, 534]]);
  const pts = [], rows = 5;
  for (let i = 0; i < rows; i++) {
    const y = 447 + i * 15, l = 274, h = 328, n = 12;
    for (let j = 0; j <= n; j++) { const u = j / n, x = i % 2 ? h - (h - l) * u : l + (h - l) * u; pts.push([x, y + Math.sin(u * 9.4 + i) * 2.4]); }
  }
  const d = curve(pts);
  return `<path d="${colon}" fill="none" stroke="#5a2c1e" stroke-width="21" stroke-linecap="round"/><path d="${colon}" fill="none" stroke="#c87858" stroke-width="18" stroke-linecap="round"/>
    <path d="${colon}" fill="none" stroke="#f0b090" stroke-width="7" opacity=".55" stroke-linecap="round"/>
    <path d="${colon}" fill="none" stroke="#6a3020" stroke-width="18" stroke-dasharray="1.8 11"/>
    <path d="${d}" fill="none" stroke="#5a2233" stroke-width="${thin + 2}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#e8949a" stroke-width="${thin}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#ffd6d6" stroke-width="${thin * .28}" opacity=".65" transform="translate(-.8 -1.8)"/>`;
}
function esophagus() {
  return `<path d="${curve([[300, 150], [298, 240], [304, 300], [324, 340]])}" fill="none" stroke="#6a2a2a" stroke-width="8.6" stroke-linecap="round"/><path d="${curve([[300, 150], [298, 240], [304, 300], [324, 340]])}" fill="none" stroke="#e08a7a" stroke-width="6" stroke-linecap="round"/>`;
}
const duodenum = () => `<path d="${curve([[300, 398], [272, 392], [262, 412], [280, 426], [300, 420]])}" fill="none" stroke="#7a4228" stroke-width="10" stroke-linecap="round"/><path d="${curve([[300, 398], [272, 392], [262, 412], [280, 426], [300, 420]])}" fill="none" stroke="#e6a07e" stroke-width="7" stroke-linecap="round"/>`;
const glow = (s, c) => `<g style="filter:drop-shadow(0 0 3.5px ${c})">${s}</g>`;

function digestive() {
  const rect = `<path d="${curve([[312, 534], [304, 556], [300, 580]])}" fill="none" stroke="#b06248" stroke-width="9" stroke-linecap="round"/>`;
  return `<defs></defs>` + glow(esophagus() + intestines() + rect + duodenum() + stomach() + pancreas() + liver() + gall(), '#ff9a4a');
}
function organs() {
  const brain = curve([[300, 28], [270, 33], [256, 56], [258, 90], [278, 108], [300, 112], [322, 108], [342, 90], [344, 56], [330, 33]], true);
  const thyroid = curve([[300, 170], [314, 164], [324, 174], [316, 188], [300, 182], [284, 188], [276, 174], [286, 164]], true);
  const lungsPink = organ(LUNG_R, '#ffb4c4', '#d06a86', '#5a2238') + organ(LUNG_L, '#ffb4c4', '#d06a86', '#5a2238') + sheen(244, 262, 18, 40, .26, 12) + sheen(362, 272, 14, 36, .26, -14);
  const brainS = organ(brain, '#ffc8c8', '#d98a92', '#6a3a46') + `<g filter="url(#b1)">${brainFolds('#5a2a38')}</g><path d="M300 30 L300 110" stroke="#5a2a38" stroke-width="2"/>`;
  const vessels = `<path d="${curve([[310, 236], [292, 210], [316, 190], [340, 212], [326, 244]])}" fill="none" stroke="#c91f33" stroke-width="10" stroke-linecap="round"/>
    <path d="${curve([[290, 240], [290, 196]])}" fill="none" stroke="#3a62c8" stroke-width="9" stroke-linecap="round"/>`;
  return glow(brainS, '#ff9ac0') + glow(organ(thyroid, '#ff9c9c', '#b83a52', '#5a1426') + lungsPink + vessels + heart() + intestines(8) + duodenum() + stomach() + spleen() + pancreas() + kidneys() + liver() + gall() + bladder(), '#ff6ac0');
}

const DRAW = { skeletal, circulatory, respiratory, nervous, digestive, organs };
const TINT = { skeletal: '#a8dcff', circulatory: '#ff4a64', respiratory: '#49dcff', nervous: '#ffb02e', digestive: '#ff9a4a', organs: '#ff6ac0' };
const cache = {};
export function scan(mode) { return (cache[mode] ||= DRAW[mode]()); }
export const tintFor = (mode) => TINT[mode] || '#6fd0ff';
