// The OUTSIDE view: a detailed 2D patient + the visual-effects renderer.
// Pipeline: Claude decides WHAT is visible for each symptom (effect type + body site + side, from a fixed vocabulary);
// this file draws it, scaled by the live severity from the simulation. So any symptom Claude invents gets a real picture.
import { SITES } from './anatomy.js';

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const BASE_SKIN = [226, 176, 146];
const TINTS = { pallor: [236, 226, 214], cyanosis: [150, 160, 200], jaundice: [222, 196, 92], flushed: [232, 128, 112] };

// where an effect shows on the OUTSIDE for each internal site
const OUT = {
  brain: [300, 62], thyroid: [300, 150], heart: [322, 262], lungs: [272, 250], liver: [262, 345], stomach: [340, 352],
  pancreas: [300, 385], kidneys: [368, 410], intestines: [300, 455], bladder: [300, 540], spinal_cord: [300, 300],
  blood: [176, 360], bone_marrow: [336, 650], joints: [190, 440], skin: [414, 360], left_leg: [266, 740], right_leg: [334, 740],
};
import { drawMods } from './mods.js';
import { drawRoom } from './room.js';
import { BODY, FILTERS, ghost, tintFor, curve } from './realbody.js';
const both = (x) => x + `<g transform="translate(600 0) scale(-1 1)">${x}</g>`;
export const MOUTH = { x: 300, y: 114 };

// a few deterministic random numbers so rashes don't flicker
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- body shapes (shared by the outside view and the scan-mode hologram) ----
const P = {
  legL: 'M208 596 C212 680 230 730 244 826 L282 826 C288 760 290 684 298 600 Z',
  legR: 'M392 596 C388 680 370 730 356 826 L318 826 C312 760 310 684 302 600 Z',
  armL: 'M212 172 C188 178 176 204 172 244 L156 460 L180 464 L196 262 C200 232 206 216 216 206 Z',
  armR: 'M388 172 C412 178 424 204 428 244 L444 460 L420 464 L404 262 C400 232 394 216 384 206 Z',
  neck: 'M284 124 L282 168 L318 168 L316 124 Z',
  gown: 'M214 166 Q300 150 386 166 Q406 174 412 196 L418 254 L394 262 L392 300 Q398 450 388 604 Q300 618 212 604 Q202 450 208 300 L206 262 L182 254 L188 196 Q194 174 214 166 Z',
};
export const hologram = (mode) => ghost(tintFor(mode));

// active effects -> {type: [{site, side, k}]}
function group(effects) { const g = {}; for (const e of effects) (g[e.type] ||= []).push(e); return g; }
const maxK = (arr) => arr ? Math.max(...arr.map(e => e.k)) : 0;

function face(g, skinC, lipCol, skin) {
  const tone = (c, k) => rgb(mix(skin, c, k));
  const sh = tone([104, 54, 50], .5), deep = tone([56, 26, 28], .78), lt = tone([255, 240, 226], .55);
  const droop = g.face_droop?.[0], dk = droop ? droop.k : 0, dl = droop && droop.side === 'right' ? 1 : -1; // -1 = viewer-left side
  const unconscious = maxK(g.unconscious) > 0.25, seizing = maxK(g.seizure) > 0.25, confused = maxK(g.confused) > 0.25;
  const pain = maxK(g.pain) > 0.5 || seizing;
  const eye = (x, side) => {
    const droopy = droop && side === dl ? dk : 0;
    const shape = `M${x - 11.5} 82.5 C${x - 7} 76 ${x + 4} 74.5 ${x + 11.5} 82 C${x + 6} 87.5 ${x - 6} 88 ${x - 11.5} 82.5Z`;
    const lid = `M${x - 12.5} 83 C${x - 7} 74.5 ${x + 4} 73 ${x + 12.5} 82.5 C${x + 4} 76.5 ${x - 6} 77.5 ${x - 12.5} 83Z`;
    if (unconscious) return `<path d="M${x - 12} 82 C${x - 6} 88 ${x + 6} 88 ${x + 12} 82 C${x + 6} 78 ${x - 6} 78 ${x - 12} 82Z" fill="${tone([180, 120, 110], .3)}"/>
      <path d="M${x - 12} 82 Q${x} ${88 + droopy * 3} ${x + 12} 82" stroke="${deep}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    const irisY = seizing ? 76 : 81.3, irisX = confused ? x + (side < 0 ? -3.2 : 4) : x;
    const sclera = g.jaundice ? rgb(mix([250, 248, 240], [236, 210, 90], maxK(g.jaundice))) : '#f6f2ea';
    const id = side < 0 ? 'eyeA' : 'eyeB';
    return `<clipPath id="${id}"><path d="${shape}"/></clipPath>
      <path d="M${x - 14} 74 Q${x} 68 ${x + 14} 74" stroke="${sh}" stroke-width="1" fill="none" opacity=".7"/>
      <path d="${shape}" fill="${sclera}"/>
      <g clip-path="url(#${id})">
        <circle cx="${irisX}" cy="${irisY}" r="5.6" fill="url(#irisG)"/><circle cx="${irisX}" cy="${irisY}" r="5.6" fill="none" stroke="#1d120c" stroke-width=".9"/>
        <circle cx="${irisX}" cy="${irisY}" r="2.3" fill="#050403"/><circle cx="${irisX + 1.8}" cy="${irisY - 1.9}" r="1.2" fill="#fff" opacity=".95"/>
        <path d="M${x - 12} 76 L${x + 12} 76 L${x + 12} 81 Q${x} 76 ${x - 12} 82Z" fill="#1a0d08" opacity=".32"/>
        <circle cx="${x + side * 9}" cy="83" r="1.7" fill="#d88a84" opacity=".7"/>
      </g>
      <path d="${lid}" fill="#22130d"/>
      <path d="M${x - 10} 88.5 Q${x} 92 ${x + 10} 88" stroke="${sh}" stroke-width="1" fill="none" opacity=".6"/>
      ${droopy > 0.1 ? `<path d="M${x - 13} 76 Q${x} ${74 + droopy * 11} ${x + 13} 76 L${x + 13} 72 L${x - 13} 72 Z" fill="${skinC}"/><path d="M${x - 13} 76 Q${x} ${74 + droopy * 11} ${x + 13} 76" stroke="#22130d" stroke-width="1.4" fill="none"/>` : ''}`;
  };
  const brow = (x0, dir) => {
    const r = rng(x0); let h = '';
    for (let i = 0; i < 18; i++) { const u = i / 17, x = x0 + dir * u * 25, y = 68.5 - Math.sin(u * 2.7) * 3.6 + (pain ? (1 - u) * 3.4 : 0);
      h += `<path d="M${x.toFixed(1)} ${(y + 2).toFixed(1)} l${(dir * (2.5 + r() * 2)).toFixed(1)} ${(-2.6 - r() * 2).toFixed(1)}" stroke="#241811" stroke-width="${(.8 + r() * .5).toFixed(2)}" stroke-linecap="round" opacity=".85"/>`; }
    return h;
  };
  const yL = 115 + (droop && dl < 0 ? dk * 8 : 0) + (pain ? 2 : 0), yR = 115 + (droop && dl > 0 ? dk * 8 : 0) + (pain ? 2 : 0), yC = pain ? 113 : 114.5;
  const upper = `M285 ${yL} C291 ${yC - 3} 295 ${yC - 5} 297 ${yC - 4} Q300 ${yC - 2.4} 303 ${yC - 4} C305 ${yC - 5} 309 ${yC - 3} 315 ${yR} C308 ${yC + 1.8} 292 ${yC + 1.8} 285 ${yL}Z`;
  const lower = `M286 ${yL + .4} C292 ${yC + 2.2} 308 ${yC + 2.2} 314 ${yR + .4} C310 ${yC + 9} 305 ${yC + 10.5} 300 ${yC + 10.5} C295 ${yC + 10.5} 290 ${yC + 9} 286 ${yL + .4}Z`;
  return `
    <path d="M262 110 C272 128 286 140 300 142 C314 140 328 128 338 110 L352 170 L248 170Z" fill="${deep}" opacity="0" />
    <g filter="url(#b3)">
      <ellipse cx="282" cy="79" rx="16" ry="9" fill="${sh}" opacity=".5"/><ellipse cx="318" cy="79" rx="16" ry="9" fill="${sh}" opacity=".5"/>
      <path d="M293 76 L291 100 M307 76 L309 100" stroke="${sh}" stroke-width="5" opacity=".42" stroke-linecap="round"/>
      <ellipse cx="271" cy="101" rx="11" ry="7" fill="${lt}" opacity=".6"/><ellipse cx="329" cy="101" rx="11" ry="7" fill="${lt}" opacity=".6"/>
      <ellipse cx="300" cy="50" rx="27" ry="10" fill="${lt}" opacity=".55"/>
      <ellipse cx="262" cy="108" rx="5" ry="16" fill="${sh}" opacity=".35"/><ellipse cx="338" cy="108" rx="5" ry="16" fill="${sh}" opacity=".35"/>
      <ellipse cx="300" cy="126" rx="12" ry="5.5" fill="${lt}" opacity=".5"/>
      <ellipse cx="300" cy="124" rx="11" ry="2.4" fill="${sh}" opacity=".3"/>
      <ellipse cx="300" cy="107.5" rx="9" ry="2.6" fill="${sh}" opacity=".55"/>
      <rect x="298" y="82" width="4.5" height="20" rx="2.2" fill="${lt}" opacity=".8"/>
      <circle cx="300" cy="100" r="4.5" fill="${lt}" opacity=".7"/>
      ${g.flushed ? `<ellipse cx="272" cy="101" rx="14" ry="9" fill="#e8413c" opacity="${0.6 * maxK(g.flushed)}"/><ellipse cx="328" cy="101" rx="14" ry="9" fill="#e8413c" opacity="${0.6 * maxK(g.flushed)}"/>` : ''}
    </g>
    ${brow(270, 1)}${brow(330, -1)}
    ${eye(282, -1)}${eye(318, 1)}
    <path d="M290.5 101 C289 106 293 107.5 295 106 M309.5 101 C311 106 307 107.5 305 106" stroke="${sh}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="295.6" cy="105.4" rx="2.5" ry="1.4" fill="${deep}"/><ellipse cx="304.4" cy="105.4" rx="2.5" ry="1.4" fill="${deep}"/>
    <path d="M298 109 L297 ${yC - 5} M302 109 L303 ${yC - 5}" stroke="${sh}" stroke-width=".8" opacity=".5"/>
    <path d="${upper}" fill="${lipCol}"/><path d="${lower}" fill="${lipCol}" opacity=".9"/>
    <path d="M285 ${yL} C292 ${yC + 2.4} 308 ${yC + 2.4} 315 ${yR}" stroke="${deep}" stroke-width="1.15" fill="none" stroke-linecap="round"/>
    <ellipse cx="300" cy="${yC + 6}" rx="6" ry="1.5" fill="#fff" opacity=".3" filter="url(#b1)"/>`;
}

function siteXY(e) {
  const [x, y] = OUT[e.site] || [SITES[e.site]?.x || 300, SITES[e.site]?.y || 300];
  return [e.side === 'left' && x > 300 ? 600 - x : e.side === 'right' && x < 300 ? 600 - x : x, y];
}

function local(e, i) {
  const [x, y] = siteXY(e), k = Math.min(1, e.k), r = rng(i * 97 + x * 13 + y);
  switch (e.type) {
    case 'rash': case 'petechiae': {
      const n = Math.round(10 + 40 * k), col = e.type === 'rash' ? '#d8403c' : '#6a1530', sz = e.type === 'rash' ? 3.2 : 1.6;
      let s = ''; for (let j = 0; j < n; j++) { const a = r() * 6.28, d = r() * (28 + 26 * k); s += `<circle cx="${x + Math.cos(a) * d}" cy="${y + Math.sin(a) * d}" r="${sz * (0.6 + r())}" fill="${col}" opacity="${0.55 + 0.4 * r()}"/>`; }
      return s;
    }
    case 'bruise':
      return `<ellipse cx="${x}" cy="${y}" rx="${16 + 20 * k}" ry="${12 + 14 * k}" fill="url(#bruiseG)" opacity="${0.5 + 0.45 * k}"/>`;
    case 'bleeding': {
      const head = e.site === 'brain';
      const [bx, by] = head ? [306, 102] : [x, y];  // a head bleed shows at the nose
      return `<path d="M${bx - 14 * k - 6} ${by} q${6 + 14 * k} ${-10 - 6 * k} ${12 + 28 * k} 0 q-4 ${10 + 8 * k} ${-6 - 14 * k} ${8 + 6 * k} q-10 0 ${-6 - 14 * k} ${-8 - 6 * k}z" fill="#9c0d12" opacity=".92"/>
        <path class="drip" d="M${bx} ${by + 4} l0 ${18 + 30 * k}" stroke="#b0141a" stroke-width="${2 + 2 * k}" stroke-linecap="round"/>
        <circle class="drip" cx="${bx}" cy="${by + 24 + 30 * k}" r="${2.5 + 2 * k}" fill="#b0141a"/>`;
    }
    case 'swelling':
      if (e.site === 'left_leg' || e.site === 'right_leg') return `<ellipse cx="${x}" cy="${y + 10}" rx="${24 + 10 * k}" ry="${70}" fill="url(#swellG)" stroke="#b46a5a" stroke-width="1.5" opacity=".95"/>`;
      if (e.site === 'thyroid') return `<ellipse cx="300" cy="150" rx="${18 + 8 * k}" ry="${9 + 4 * k}" fill="url(#swellG)" stroke="#b46a5a" stroke-width="1.5"/>`;
      return `<ellipse cx="${x}" cy="${y}" rx="${18 + 16 * k}" ry="${14 + 12 * k}" fill="url(#swellG)" stroke="#b46a5a" stroke-width="1.5" opacity=".9"/>`;
    case 'pain': {
      let s = ''; for (let j = 0; j < 6; j++) { const a = j / 6 * 6.28 + 0.3, r0 = 16, r1 = 24 + 14 * k;
        s += `<path d="M${x + Math.cos(a) * r0} ${y + Math.sin(a) * r0} L${x + Math.cos(a + 0.18) * (r0 + r1) / 2} ${y + Math.sin(a + 0.18) * (r0 + r1) / 2} L${x + Math.cos(a) * r1} ${y + Math.sin(a) * r1}" stroke="#ff3b3b" stroke-width="2.5" fill="none"/>`; }
      return `<g class="pulse-fx">${s}</g>`;
    }
    case 'limb_weak': {
      const legs = e.site === 'left_leg' || e.site === 'right_leg';
      const left = e.side === 'left' || (e.side === 'none' && x < 300);
      const d = legs ? (left ? P.legL : P.legR) : (left ? P.armL : P.armR);
      const ax = legs ? (left ? 262 : 338) : (left ? 168 : 432), ay = legs ? 700 : 360;
      return `<path d="${d}" fill="#7a8ca0" opacity="${0.25 + 0.35 * k}"/><text x="${ax - 8}" y="${ay}" class="fx-label">⬇</text>`;
    }
    case 'blood_urine':
      return `<g><path d="M300 560 Q330 600 372 616" stroke="#d9c88a" stroke-width="3" fill="none"/>
        <rect x="362" y="612" width="40" height="56" rx="8" fill="#f2efe4" stroke="#14202c" stroke-width="2"/>
        <rect x="365" y="${640 - 20 * k}" width="34" height="${25 + 20 * k}" rx="5" fill="${rgb(mix([214, 190, 80], [150, 20, 24], k))}"/></g>`;
    default: return '';
  }
}

export function drawPatient(effects, opts = {}) {
  const g = group(effects);
  let skin = BASE_SKIN;
  for (const t in TINTS) if (g[t]) skin = mix(skin, TINTS[t], 0.75 * maxK(g[t]));
  const skinC = rgb(skin), shade = rgb(mix(skin, [90, 50, 40], 0.35)), lipC = g.cyanosis ? rgb(mix([170, 80, 80], [70, 80, 170], maxK(g.cyanosis))) : '#a85a52';
  const seize = maxK(g.seizure), tremor = maxK(g.tremor), breath = Math.max(maxK(g.fast_breathing), opts.breathFast || 0);
  const cls = seize > 0.25 ? 'seize' : tremor > 0.25 ? 'tremor' : '';
  const md = drawMods(opts.mods);
  let fx = ''; effects.forEach((e, i) => { fx += local(e, i); });
  // whole-body extras
  if (g.sweating) { const k = maxK(g.sweating); for (let j = 0; j < 3 + Math.round(5 * k); j++) fx += `<path class="sweat" style="animation-delay:${j * 0.37}s" d="M${266 + j * 11} ${50 + (j % 3) * 8} q-3 6 0 8 q3 -2 0 -8z" fill="#bfe6ff" stroke="#6aa8d0" stroke-width=".8"/>`; }
  if (g.vomiting) fx += `<path d="M290 122 q10 30 -6 60 q20 10 36 -4 q-14 -24 -14 -56z" fill="#9aa83c" opacity="${0.5 + 0.4 * maxK(g.vomiting)}"/><circle cx="292" cy="196" r="5" fill="#9aa83c" opacity=".7"/>`;
  if (g.coughing || g.coughing_blood) fx += `<g class="cough"><path d="M332 108 q10 6 0 14 M342 102 q14 10 0 24 M352 96 q18 14 0 36" stroke="#cfe3f2" stroke-width="2.5" fill="none"/></g>`;
  if (g.coughing_blood) fx += `<circle cx="336" cy="120" r="3" fill="#b0141a"/><circle cx="348" cy="128" r="2.4" fill="#b0141a"/><circle cx="342" cy="138" r="2" fill="#b0141a"/><path d="M290 118 q10 4 20 0" stroke="#b0141a" stroke-width="2.5"/>`;
  if (g.confused) fx += `<text x="340" y="40" class="fx-label q">?</text><text x="250" y="34" class="fx-label q" style="animation-delay:.6s">?</text>`;
  if (g.unconscious) fx += `<text x="338" y="44" class="fx-label z">z</text><text x="352" y="28" class="fx-label z" style="animation-delay:.5s">Z</text>`;

  const tone = (c, k) => rgb(mix(skin, c, k));
  const sh = tone([104, 54, 50], .5), deep = tone([56, 26, 28], .78), lt = tone([255, 240, 226], .55);
  const hr = rng(4); let strands = '';
  for (let i = 0; i < 130; i++) { const x = 256 + hr() * 90, y = 22 + hr() * 24, lean = (x - 300) * .22 + (hr() - .5) * 8, len = Math.min(14 + hr() * 26, 44 + Math.abs((x - 300) / 46) ** 3 * 38 - y);
    if (len < 3) continue;
    strands += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(lean * .5).toFixed(1)} ${(len * .5).toFixed(1)} ${lean.toFixed(1)} ${len.toFixed(1)}" stroke="${['#4a3323', '#120b07', '#6a4a30'][i % 3]}" stroke-width="${(.7 + hr()).toFixed(2)}" fill="none" stroke-linecap="round" opacity=".75"/>`; }
  const limbs = both(`
    <ellipse cx="184" cy="298" rx="9" ry="34" fill="${lt}" opacity=".5" transform="rotate(10 184 298)"/>
    <path d="M198 270 C196 300 190 322 183 338" stroke="${sh}" stroke-width="6" fill="none" opacity=".45"/>
    <ellipse cx="172" cy="338" rx="12" ry="5" fill="${sh}" opacity=".45" transform="rotate(-10 172 338)"/>
    <ellipse cx="171" cy="374" rx="10" ry="32" fill="${lt}" opacity=".55" transform="rotate(7 171 374)"/>
    <path d="M186 380 C182 410 176 440 170 460" stroke="${sh}" stroke-width="7" fill="none" opacity=".35"/>
    <ellipse cx="258" cy="654" rx="22" ry="44" fill="${lt}" opacity=".5" transform="rotate(-6 258 654)"/>
    <path d="M292 620 C288 660 286 690 284 712" stroke="${sh}" stroke-width="10" fill="none" opacity=".4"/>
    <path d="M226 650 C232 680 240 690 244 706" stroke="${sh}" stroke-width="8" fill="none" opacity=".32"/>
    <ellipse cx="260" cy="698" rx="14" ry="15" fill="${lt}" opacity=".62"/>
    <path d="M246 716 Q260 724 275 716" stroke="${sh}" stroke-width="5" fill="none" opacity=".55"/>
    <path d="M262 724 C262 760 258 790 258 816" stroke="${lt}" stroke-width="6" fill="none" opacity=".55"/>
    <ellipse cx="244" cy="752" rx="7" ry="32" fill="${sh}" opacity=".32"/>`);
  const details = both(`
    <path d="M170 464 C169 476 167 486 165 494" stroke="${sh}" stroke-width="1" fill="none" opacity=".5"/>
    <path d="M152 494 L151 513 M160 497 L160 516 M168 494 L170 512" stroke="${deep}" stroke-width="1.1" stroke-linecap="round" opacity=".62"/>
    <ellipse cx="147" cy="505" rx="2.2" ry="3" fill="${lt}" opacity=".85"/><ellipse cx="155.5" cy="510" rx="2.2" ry="3" fill="${lt}" opacity=".85"/><ellipse cx="164.5" cy="510" rx="2.2" ry="3" fill="${lt}" opacity=".85"/><ellipse cx="172.5" cy="504" rx="2.2" ry="3" fill="${lt}" opacity=".85"/>
    <path d="M174 470 C182 476 186 486 183 498 C181 503 176 503 175 497" fill="${skinC}" stroke="${sh}" stroke-width=".8" opacity=".95"/>
    <path d="M150 482 q5 3 9 0 q5 3 10 -1" stroke="${sh}" stroke-width=".8" fill="none" opacity=".55"/>
    <path d="M232 836 C234 820 252 820 278 824 C286 834 282 850 276 854 C262 858 238 858 232 850Z" fill="url(#sockG)"/>
    <path d="M238 846 q18 5 38 0" stroke="#7f92a4" stroke-width="1" fill="none" opacity=".7"/>`);
  return `
  <defs>
    ${FILTERS}
    <radialGradient id="irisG"><stop offset="0" stop-color="#b98a52"/><stop offset=".55" stop-color="#6a4426"/><stop offset="1" stop-color="#2a180c"/></radialGradient>
    <linearGradient id="gownG" x1="0" x2="1"><stop offset="0" stop-color="#3f9ec2"/><stop offset=".3" stop-color="#6fd0e8"/><stop offset=".55" stop-color="#8fe0f2"/><stop offset=".8" stop-color="#62c4e0"/><stop offset="1" stop-color="#3a94b8"/></linearGradient>
    <linearGradient id="sockG" x1="0" x2="1"><stop offset="0" stop-color="#a9b6c2"/><stop offset=".5" stop-color="#f4f7fa"/><stop offset="1" stop-color="#b6c2ce"/></linearGradient>
    <linearGradient id="hairG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a281c"/><stop offset="1" stop-color="#150d08"/></linearGradient>
    <pattern id="gownDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.7" fill="#2d7f9e" opacity=".55"/><path d="M14 14 l4 4 m0 -4 l-4 4" stroke="#2d7f9e" stroke-width="1" opacity=".45"/></pattern>
    <radialGradient id="bruiseG"><stop offset="0" stop-color="#4a1850"/><stop offset=".55" stop-color="#7a3a6a"/><stop offset=".85" stop-color="#9a9a40" stop-opacity=".6"/><stop offset="1" stop-color="#9a9a40" stop-opacity="0"/></radialGradient>
    <radialGradient id="swellG"><stop offset="0" stop-color="${rgb(mix(skin, [240, 140, 120], 0.35))}"/><stop offset="1" stop-color="${skinC}"/></radialGradient>
    <clipPath id="bodyClip"><path d="${BODY}"/></clipPath>
    ${md.mask}
    <radialGradient id="floorG"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  ${opts.room === false ? '' : drawRoom()}
  <g id="patient" class="${cls}"><g ${md.masked ? 'mask="url(#ampMask)"' : ''}>
    <path d="${BODY}" fill="#000" opacity=".42" filter="url(#b7)" transform="translate(5 8)"/>
    <ellipse cx="253" cy="89" rx="8.5" ry="14" fill="${skinC}"/><ellipse cx="347" cy="89" rx="8.5" ry="14" fill="${skinC}"/>
    <path d="M250 80 q-3 9 2 18 M350 80 q3 9 -2 18" stroke="${deep}" stroke-width="1.2" fill="none" opacity=".6"/>
    <path d="${BODY}" fill="${skinC}"/>
    <g clip-path="url(#bodyClip)">
      <path d="${BODY}" fill="none" stroke="${deep}" stroke-width="24" opacity=".55" filter="url(#b7)"/>
      <path d="${BODY}" fill="none" stroke="${sh}" stroke-width="8" opacity=".7" filter="url(#b3)"/>
      <g filter="url(#b3)">${limbs}
        <path d="M262 112 C272 132 288 146 300 148 C312 146 328 132 338 112 L346 172 L254 172Z" fill="${deep}" opacity=".62"/>
        <path d="M284 146 L296 176 M316 146 L304 176" stroke="${lt}" stroke-width="4" opacity=".4"/>
      </g>
    </g>
    <path d="${BODY}" fill="none" stroke="${deep}" stroke-width=".7" opacity=".55"/>
    ${details}
    <rect x="148" y="442" width="36" height="9" rx="2" fill="#f4f6f8"/><rect x="151" y="445" width="20" height="3" fill="#8fa2b4"/><rect x="174" y="444" width="7" height="5" fill="#ff4a5a"/>
    <g class="${breath > 0.25 ? 'breathe-fast' : 'breathe'}" style="transform-origin:300px 300px">
      <path d="${P.gown}" fill="url(#gownG)"/>
      <path d="${P.gown}" fill="url(#gownDots)"/>
      <path d="M282 162 Q300 198 318 162 Z" fill="${tone([120, 66, 58], .25)}"/>
      <path d="M282 162 Q300 202 318 162" stroke="#1f6d8c" stroke-width="3.2" fill="none"/>
      ${[[240, 250, 234, 600], [262, 240, 262, 610], [338, 240, 338, 610], [360, 250, 366, 600], [212, 292, 222, 470], [388, 292, 378, 470], [300, 214, 296, 606]].map(([a, b, c, d], i) => { const m = `M${a} ${b} C${a + (i % 2 ? 6 : -5)} ${b + 130} ${c + (i % 2 ? -7 : 6)} ${d - 130} ${c} ${d}`; return `<path d="${m}" stroke="#1d6f90" stroke-width="7" fill="none" opacity=".16"/><path d="${m}" stroke="#1d6f90" stroke-width="2.6" fill="none" opacity=".3"/><path d="${m}" stroke="#d2f6ff" stroke-width="1.6" fill="none" opacity=".5" transform="translate(4 0)"/>`; }).join('')}
      <path d="${P.gown}" fill="none" stroke="#1a6a8a" stroke-width="5" opacity=".28"/><path d="${P.gown}" fill="none" stroke="#135673" stroke-width="1" opacity=".75"/>
      <path d="M206 262 L182 254 M394 262 L418 254" stroke="#135673" stroke-width="2.6"/>
      <path d="M190 236 Q200 248 206 262 M410 236 Q400 248 394 262" stroke="#135673" stroke-width="1.5" fill="none" opacity=".55"/>
    </g>
    <path d="M252 86 C243 36 286 13 318 21 C354 29 358 64 348 88 C345 64 331 47 304 44 C286 44 268 50 262 64 C258 72 255 80 252 86 Z" fill="url(#hairG)"/>
    <g>${strands}</g>
    ${face(g, skinC, lipC, skin)}
    <g id="fx">${fx}</g>
  </g>
    <g id="mods">${md.over}</g>
  </g>`;
}

// keyword fallback when the backend is offline (Claude normally does this mapping)
export function guessEffects(text, site) {
  const t = (text || '').toLowerCase(), out = [], add = (type, s = site, side = 'none') => out.push({ type, site: s, side });
  if (/droop|slurred|stroke|facial weak/.test(t)) { add('face_droop', 'brain', 'left'); }
  if (/weak|numb|paraly/.test(t)) add('limb_weak', site === 'brain' ? 'left_leg' : site, 'left');
  if (/seiz|convuls|fit/.test(t)) add('seizure', 'brain');
  if (/tremor|shak/.test(t)) add('tremor', site);
  if (/confus|drows|disorient|delir/.test(t)) add('confused', 'brain');
  if (/unconscious|unresponsive|collapse|faint/.test(t)) add('unconscious', 'brain');
  if (/vomit|nause/.test(t)) add('vomiting', 'stomach');
  if (/cough/.test(t)) add(/blood|haemopt|hemopt/.test(t) ? 'coughing_blood' : 'coughing', 'lungs');
  if (/breath|dyspn|wheez|short of/.test(t)) add('fast_breathing', 'lungs');
  if (/blue|cyan/.test(t)) add('cyanosis', 'lungs');
  if (/pale|pallor|clammy|shock/.test(t)) add('pallor', site);
  if (/sweat|clammy|diaphor/.test(t)) add('sweating', site);
  if (/yellow|jaund/.test(t)) add('jaundice', 'liver');
  if (/flush|fever|hot/.test(t)) add('flushed', site);
  if (/rash|hives/.test(t)) add('rash', 'skin');
  if (/petech|purpur|spots/.test(t)) add('petechiae', 'skin');
  if (/bruis/.test(t)) add('bruise', site);
  if (/bleed|blood/.test(t) && !/cough/.test(t)) add(site === 'bladder' || site === 'kidneys' ? 'blood_urine' : 'bleeding', site);
  if (/swell|swollen|oedema|edema/.test(t)) add('swelling', site);
  if (!out.length || /pain|ache|tender|cramp/.test(t)) add('pain', site);
  return out;
}
