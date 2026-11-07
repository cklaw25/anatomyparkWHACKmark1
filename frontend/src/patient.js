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
  brain: [300, 62], thyroid: [300, 150], heart: [322, 262], lungs: [272, 250], liver: [338, 345], stomach: [282, 352],
  pancreas: [300, 385], kidneys: [368, 410], intestines: [300, 455], bladder: [300, 540], spinal_cord: [300, 300],
  blood: [176, 360], bone_marrow: [336, 650], joints: [190, 440], skin: [414, 360], left_leg: [266, 740], right_leg: [334, 740],
};
import { drawMods } from './mods.js';
export const MOUTH = { x: 300, y: 114 };

// a few deterministic random numbers so rashes don't flicker
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- body shapes (shared by the outside view and the scan-mode hologram) ----
const P = {
  legL: 'M246 596 C240 680 246 760 250 826 L276 826 C280 760 290 684 292 600 Z',
  legR: 'M354 596 C360 680 354 760 350 826 L324 826 C320 760 310 684 308 600 Z',
  armL: 'M212 172 C188 178 176 204 172 244 L156 460 L180 464 L196 262 C200 232 206 216 216 206 Z',
  armR: 'M388 172 C412 178 424 204 428 244 L444 460 L420 464 L404 262 C400 232 394 216 384 206 Z',
  neck: 'M284 124 L282 168 L318 168 L316 124 Z',
  gown: 'M214 166 Q300 150 386 166 Q406 174 412 196 L418 254 L394 262 L392 300 Q398 450 388 604 Q300 618 212 604 Q202 450 208 300 L206 262 L182 254 L188 196 Q194 174 214 166 Z',
};
export function hologram() {
  return `<g id="holo" fill="#13263a" stroke="#3f6a88" stroke-width="2" opacity=".9">
    <path d="${P.legL}"/><path d="${P.legR}"/><path d="${P.armL}"/><path d="${P.armR}"/>
    <ellipse cx="166" cy="482" rx="15" ry="21"/><ellipse cx="434" cy="482" rx="15" ry="21"/>
    <path d="M206 170 Q300 150 394 170 L398 600 Q300 616 202 600 Z"/><path d="${P.neck}"/>
    <ellipse cx="300" cy="82" rx="46" ry="56"/><ellipse cx="258" cy="842" rx="20" ry="9"/><ellipse cx="342" cy="842" rx="20" ry="9"/></g>`;
}

// active effects -> {type: [{site, side, k}]}
function group(effects) { const g = {}; for (const e of effects) (g[e.type] ||= []).push(e); return g; }
const maxK = (arr) => arr ? Math.max(...arr.map(e => e.k)) : 0;

function face(g, skin, lipCol) {
  const droop = g.face_droop?.[0], dk = droop ? droop.k : 0, dl = droop && droop.side === 'right' ? 1 : -1; // -1 = viewer-left side
  const unconscious = maxK(g.unconscious) > 0.25, seizing = maxK(g.seizure) > 0.25, confused = maxK(g.confused) > 0.25;
  const eye = (x, side) => {
    const droopy = droop && side === dl ? dk : 0;
    if (unconscious) return `<path d="M${x - 9} 82 Q${x} ${87 + droopy * 3} ${x + 9} 82" stroke="#3a2418" stroke-width="2.5" fill="none"/>`;
    const irisY = seizing ? 74 : 81, irisX = confused ? x + (side < 0 ? -3 : 4) : x;
    const sclera = g.jaundice ? rgb(mix([250, 250, 245], [236, 210, 90], maxK(g.jaundice))) : '#f8f6f0';
    return `<ellipse cx="${x}" cy="81" rx="10" ry="6.5" fill="${sclera}" stroke="#3a2418" stroke-width="1.5"/>
      <circle cx="${irisX}" cy="${irisY}" r="4.2" fill="#4a3020"/><circle cx="${irisX}" cy="${irisY}" r="1.8" fill="#000"/>
      <circle cx="${irisX + 1.5}" cy="${irisY - 1.5}" r="1" fill="#fff"/>
      ${droopy > 0.1 ? `<path d="M${x - 11} 76 Q${x} ${74 + droopy * 9} ${x + 11} 76 L${x + 11} 74 L${x - 11} 74 Z" fill="${skin}"/>` : ''}`;
  };
  const m0 = 300 - 14, m1 = 300 + 14;
  const yL = 115 + (droop && dl < 0 ? dk * 8 : 0), yR = 115 + (droop && dl > 0 ? dk * 8 : 0);
  const pain = maxK(g.pain) > 0.5 || seizing;
  const mouth = pain ? `<path d="M${m0} ${yL} Q300 108 ${m1} ${yR}" stroke="${lipCol}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : `<path d="M${m0} ${yL} Q300 ${120} ${m1} ${yR}" stroke="${lipCol}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const brows = pain ? 'M272 68 Q282 63 292 70 M308 70 Q318 63 328 68' : 'M271 69 Q282 63 293 67 M307 67 Q318 63 329 69';
  return `
    <path d="${brows}" stroke="#2b1d16" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    ${eye(282, -1)}${eye(318, 1)}
    <path d="M300 86 Q296 98 293 101 Q300 105 307 101" stroke="${rgb(mix(BASE_SKIN, [120, 70, 50], 0.6))}" stroke-width="2" fill="none"/>
    ${mouth}
    ${g.flushed ? `<ellipse cx="274" cy="100" rx="11" ry="6" fill="#e85a50" opacity="${0.45 * maxK(g.flushed)}"/><ellipse cx="326" cy="100" rx="11" ry="6" fill="#e85a50" opacity="${0.45 * maxK(g.flushed)}"/>` : ''}`;
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

  return `
  <defs>
    <linearGradient id="skinG" x1="0" x2="1"><stop offset="0" stop-color="${shade}"/><stop offset=".35" stop-color="${skinC}"/><stop offset=".7" stop-color="${skinC}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
    <linearGradient id="gownG" x1="0" x2="1"><stop offset="0" stop-color="#6e9fb0"/><stop offset=".45" stop-color="#9cc9d6"/><stop offset="1" stop-color="#6a98a8"/></linearGradient>
    <pattern id="gownDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2" fill="#5f8fa0" opacity=".7"/><path d="M14 14 l4 4 m0 -4 l-4 4" stroke="#5f8fa0" stroke-width="1.2" opacity=".6"/></pattern>
    <radialGradient id="bruiseG"><stop offset="0" stop-color="#4a1850"/><stop offset=".55" stop-color="#7a3a6a"/><stop offset=".85" stop-color="#9a9a40" stop-opacity=".6"/><stop offset="1" stop-color="#9a9a40" stop-opacity="0"/></radialGradient>
    <radialGradient id="swellG"><stop offset="0" stop-color="${rgb(mix(skin, [240, 140, 120], 0.35))}"/><stop offset="1" stop-color="${skinC}"/></radialGradient>
    ${md.mask}
    <radialGradient id="floorG"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="300" cy="852" rx="120" ry="16" fill="url(#floorG)"/>
  <g id="patient" class="${cls}"><g ${md.masked ? 'mask="url(#ampMask)"' : ''}>
    <g stroke="#3a2418" stroke-width="1.6">
      <path d="${P.legL}" fill="url(#skinG)"/><path d="${P.legR}" fill="url(#skinG)"/>
      <path d="M232 836 Q236 822 252 822 L276 824 Q284 836 278 848 L238 850 Q228 846 232 836Z" fill="#e8e8ee"/>
      <path d="M368 836 Q364 822 348 822 L324 824 Q316 836 322 848 L362 850 Q372 846 368 836Z" fill="#e8e8ee"/>
      <path d="${P.armL}" fill="url(#skinG)"/><path d="${P.armR}" fill="url(#skinG)"/>
      <path d="M152 462 Q150 488 160 502 Q170 508 178 498 Q184 480 180 462 Z" fill="${skinC}"/>
      <path d="M448 462 Q450 488 440 502 Q430 508 422 498 Q416 480 420 462 Z" fill="${skinC}"/>
      <path d="${P.neck}" fill="${shade}"/>
    </g>
    <path d="M166 470 l-4 30 M434 470 l4 30" stroke="#7a4a3a" stroke-width="1" opacity=".5"/>
    <rect x="150" y="440" width="34" height="9" rx="3" fill="#f0f0f0" stroke="#999"/><text x="153" y="447.5" style="font:6px Consolas;fill:#c03030">ID</text>
    <g class="${breath > 0.25 ? 'breathe-fast' : 'breathe'}" style="transform-origin:300px 300px">
      <path d="${P.gown}" fill="url(#gownG)" stroke="#2e5060" stroke-width="2"/>
      <path d="${P.gown}" fill="url(#gownDots)"/>
      <path d="M282 162 Q300 198 318 162 Z" fill="${skinC}" stroke="#3a2418" stroke-width="1.2"/>
      <path d="M282 162 Q300 202 318 162" stroke="#2e5060" stroke-width="4" fill="none"/>
      <path d="M248 250 Q252 420 240 596 M352 250 Q348 420 360 596 M300 220 L300 600" stroke="#4e7a8a" stroke-width="1.4" fill="none" opacity=".55"/>
      <path d="M206 262 L182 254 M394 262 L418 254" stroke="#2e5060" stroke-width="3"/>
      <path d="M190 236 Q200 248 206 262 M410 236 Q400 248 394 262" stroke="#2e5060" stroke-width="1.5" fill="none" opacity=".6"/>
    </g>
    <g stroke="#3a2418" stroke-width="1.6">
      <ellipse cx="254" cy="88" rx="8" ry="13" fill="${skinC}"/><ellipse cx="346" cy="88" rx="8" ry="13" fill="${skinC}"/>
      <ellipse cx="300" cy="82" rx="46" ry="56" fill="url(#skinG)"/>
    </g>
    <path d="M252 84 C244 36 286 14 318 22 C352 30 358 64 348 86 C344 62 330 46 304 44 C286 44 268 50 262 64 C258 70 255 78 252 84 Z" fill="#2b1d16"/>
    <path d="M262 64 C270 48 296 40 318 46" stroke="#4a3426" stroke-width="2" fill="none"/>
    ${face(g, skinC, lipC)}
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
