// Permanent physical changes to the patient's body: amputations and things you've put on them
// (casts, lines, masks, drains...). These stay on the body for the rest of the case.
// Positions use the same 600x880 viewBox as patient.js. 'left' = the limb on the LEFT of the screen.

export const CHANGES = ['amputate', 'prosthetic', 'cast', 'bandage', 'stitches', 'sling', 'tourniquet', 'iv_line',
  'oxygen_mask', 'chest_tube', 'defib_pads', 'neck_brace', 'dressing', 'catheter', 'remove'];
export const PARTS = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'face', 'neck', 'chest', 'abdomen', 'pelvis'];
const LIMBS = ['left_arm', 'right_arm', 'left_leg', 'right_leg'];

// where each part is drawn: centre, plus a "lower" point for casts/bandages on limbs
const AT = {
  left_arm: { x: 176, y: 330, lo: [168, 400], cut: 300 }, right_arm: { x: 424, y: 330, lo: [432, 400], cut: 300 },
  left_leg: { x: 266, y: 650, lo: [262, 760], cut: 690 }, right_leg: { x: 334, y: 650, lo: [338, 760], cut: 690 },
  head: { x: 300, y: 50 }, face: { x: 300, y: 108 }, neck: { x: 300, y: 148 },
  chest: { x: 300, y: 262 }, abdomen: { x: 300, y: 430 }, pelvis: { x: 300, y: 560 },
};
export const partXY = (p) => AT[p] || AT.chest;

// which body part a drop at (x, y) lands on
export function partAt(x, y) {
  if (y > 600) return x < 300 ? 'left_leg' : 'right_leg';
  if (y > 190 && (x < 205 || x > 395)) return x < 300 ? 'left_arm' : 'right_arm';
  if (y < 96) return 'head';
  if (y < 132) return 'face';
  if (y < 170) return 'neck';
  if (y < 360) return 'chest';
  if (y < 520) return 'abdomen';
  return 'pelvis';
}

// apply a list of changes to the current mods (dedupe; 'remove' takes additions off a part; nothing regrows)
export function applyChanges(mods, changes) {
  for (const c of changes || []) {
    if (!CHANGES.includes(c.change) || !PARTS.includes(c.part)) continue;
    if (c.change === 'remove') { for (let i = mods.length - 1; i >= 0; i--) if (mods[i].part === c.part && mods[i].change !== 'amputate') mods.splice(i, 1); continue; }
    if (c.change === 'amputate' && !LIMBS.includes(c.part)) continue; // no head amputations
    if (c.change === 'prosthetic' && !isGone(mods, c.part)) continue;
    if (isGone(mods, c.part) && !['amputate', 'prosthetic', 'bandage', 'dressing', 'tourniquet'].includes(c.change)) continue; // nothing to put a cast on
    if (c.change === 'amputate') for (let i = mods.length - 1; i >= 0; i--) if (mods[i].part === c.part && ['cast', 'iv_line', 'sling'].includes(mods[i].change)) mods.splice(i, 1);
    if (!mods.some(m => m.change === c.change && m.part === c.part)) mods.push({ change: c.change, part: c.part, t: Date.now() });
  }
  return mods;
}
export const isGone = (mods, part) => mods.some(m => m.change === 'amputate' && m.part === part);

// what the treatment physically does to the body, decided in code (so an amputation ALWAYS shows)
export function inferChanges(tr, dropPart) {
  const s = `${tr.name} ${tr.detail || ''}`.toLowerCase();
  const side = /\bleft\b/.test(s) ? 'left' : /\bright\b/.test(s) ? 'right' : null;
  const four = /all (four|limbs)|quadruple|every limb|\blimbs\b/.test(s);
  const limb = /\b(legs?|feet|foot|knees?|thighs?|shins?|ankles?)\b/.test(s) ? 'leg' : /\b(arms?|hands?|wrists?|elbows?|forearms?|fingers?)\b/.test(s) ? 'arm' : null;
  const both = /\bboth\b|bilateral|\b(legs|arms|feet|hands)\b/.test(s);
  let part = dropPart;
  if (limb) part = `${side || (dropPart?.startsWith('right') ? 'right' : 'left')}_${limb}`;
  const out = [];
  const add = (change, p = part) => out.push({ change, part: p });
  if (/amputat|remove (the |his |her |both )?(arms?|legs?|hands?|feet|foot)|cut (off )?(the |his |her |both )?(arms?|legs?)|chop/.test(s)) {
    if (four) LIMBS.forEach(l => add('amputate', l));
    else if (both && limb) { add('amputate', `left_${limb}`); add('amputate', `right_${limb}`); }
    else add('amputate', LIMBS.includes(part) ? part : 'left_arm');
  }
  else if (/prosthe/.test(s)) add('prosthetic');
  if (/\bcast\b|splint|plaster/.test(s)) add('cast');
  if (/sling/.test(s)) add('sling', part?.includes('right') ? 'right_arm' : 'left_arm');
  if (/tourniquet/.test(s)) add('tourniquet', LIMBS.includes(part) ? part : 'left_arm');
  if (/bandage|gauze|wrap|packing|pressure dressing/.test(s)) add('bandage');
  if (/suture|stitch|clos(e|ure) the wound/.test(s)) add('stitches');
  if (/chest (tube|drain)|thoracostomy|needle decompress/.test(s)) add('chest_tube', 'chest');
  if (/c-?collar|neck brace|cervical collar|c-spine/.test(s)) add('neck_brace', 'neck');
  if (/catheter/.test(s) && !/central/.test(s)) add('catheter', 'pelvis');
  if (/take off|remove the (mask|cast|bandage|line|pads|collar)/.test(s)) out.length = 0, add('remove');
  // by delivery kind
  if (tr.kind === 'iv_drip') add('iv_line', part === 'right_arm' ? 'right_arm' : 'left_arm');
  if (tr.kind === 'oxygen') add('oxygen_mask', 'face');
  if (tr.kind === 'defibrillator') add('defib_pads', 'chest');
  if (tr.kind === 'surgery' && !out.some(c => c.change === 'amputate')) add(LIMBS.includes(part) ? 'stitches' : 'dressing');
  return out;
}

// ---------- drawing ----------
// returns { mask: <mask> defs that hide amputated limbs, under: drawn behind gown, over: drawn on top }
export function drawMods(mods) {
  if (!mods?.length) return { mask: '', over: '', masked: false };
  let hide = '', over = '';
  const has = (c, p) => mods.some(m => m.change === c && (!p || m.part === p));
  const O = 'stroke="#14202c" stroke-width="1.6"';
  for (const m of mods) {
    const a = AT[m.part] || AT.chest, L = m.part.startsWith('left'), arm = m.part.endsWith('arm');
    const fresh = Date.now() - (m.t || 0) < 25000; // a fresh stump still oozes
    switch (m.change) {
      case 'amputate': {
        // hide the limb below the cut, then draw a bandaged stump
        hide += arm ? `<rect x="${L ? 0 : 395}" y="${a.cut}" width="205" height="320" fill="#000"/>`
          : `<rect x="${L ? 220 : 300}" y="${a.cut}" width="${L ? 80 : 80}" height="220" fill="#000"/>`;
        const cx = arm ? (L ? 182 : 418) : (L ? 266 : 334), cy = a.cut, rx = arm ? 15 : 25;
        over += `<g class="stump"><path d="M${cx - rx} ${cy - 14} L${cx + rx} ${cy - 14} L${cx + rx} ${cy} Q${cx} ${cy + 18} ${cx - rx} ${cy} Z" fill="#f4f4f0" ${O}/>
          <path d="M${cx - rx} ${cy - 7} L${cx + rx} ${cy - 4} M${cx - rx} ${cy - 1} L${cx + rx} ${cy + 2}" stroke="#c9c9c0" stroke-width="1.2"/>
          <ellipse cx="${cx}" cy="${cy + 4}" rx="${rx * 0.6}" ry="5" fill="#b0141a" opacity="${fresh ? 0.85 : 0.45}"/>
          ${fresh ? `<path class="drip" d="M${cx} ${cy + 9} q-3 8 0 12 q3 -4 0 -12z" fill="#b0141a"/>` : ''}</g>`;
        break;
      }
      case 'prosthetic': {
        if (arm) { const x = L ? 182 : 418, d = L ? -1 : 1;
          over += `<g><rect x="${x - 9}" y="${a.cut + 4}" width="18" height="120" rx="7" fill="#9aa6b2" ${O}/><rect x="${x - 6}" y="${a.cut + 60}" width="12" height="8" fill="#5b6672"/>
            <path d="M${x + d * 2} ${a.cut + 124} q${d * -16} 18 ${d * -4} 40 q${d * 10} 6 ${d * 14} -6" fill="none" stroke="#5b6672" stroke-width="5" stroke-linecap="round"/></g>`; }
        else { const x = L ? 266 : 334;
          over += `<g><path d="M${x - 18} ${a.cut + 6} L${x + 18} ${a.cut + 6} L${x + 8} ${a.cut + 40} L${x - 8} ${a.cut + 40} Z" fill="#3d4650" ${O}/>
            <rect x="${x - 5}" y="${a.cut + 40}" width="10" height="${826 - a.cut - 40}" fill="#b8c2cc" ${O}/>
            <path d="M${x - 22} 848 Q${x - 20} 828 ${x} 828 L${x + 16} 832 Q${x + 24} 842 ${x + 18} 850 Z" fill="#2c333a" ${O}/></g>`; }
        break;
      }
      case 'cast': {
        const [x, y] = a.lo;
        over += arm ? `<path d="M${x - 15} ${y - 50} L${x + 15} ${y - 48} L${x + 12} ${y + 66} L${x - 14} ${y + 64} Z" fill="#f2f2ea" ${O}/><path d="M${x - 14} ${y - 20} l28 2 M${x - 13} ${y + 10} l27 2 M${x - 13} ${y + 40} l26 2" stroke="#d0d0c4" stroke-width="2"/><text x="${x - 9}" y="${y + 2}" style="font:8px Consolas;fill:#3060c0">♥</text>`
          : `<path d="M${x - 20} ${y - 60} L${x + 20} ${y - 60} L${x + 16} ${y + 62} L${x - 14} ${y + 62} Z" fill="#f2f2ea" ${O}/><path d="M${x - 19} ${y - 30} l38 0 M${x - 17} ${y} l34 0 M${x - 16} ${y + 30} l32 0" stroke="#d0d0c4" stroke-width="2"/>`;
        break;
      }
      case 'bandage': case 'dressing': {
        const [x, y] = LIMBS.includes(m.part) ? (isGone(mods, m.part) ? [a.x, a.cut - 26] : a.lo) : [a.x + (m.part === 'chest' ? 30 : 0), a.y];
        if (LIMBS.includes(m.part)) over += `<g>${[0, 1, 2].map(i => `<path d="M${x - 17} ${y - 14 + i * 10} l34 4" stroke="#f6f6f0" stroke-width="8" stroke-linecap="round"/>`).join('')}<path d="M${x - 17} ${y - 14} l34 4" stroke="#c9c9c0" stroke-width="1"/></g>`;
        else over += `<g><rect x="${x - 22}" y="${y - 16}" width="44" height="32" rx="3" fill="#fbfbf6" ${O}/><rect x="${x - 12}" y="${y - 7}" width="24" height="14" fill="${m.change === 'dressing' ? '#e8d0c8' : '#f0e8e0'}"/>
          <path d="M${x - 30} ${y - 12} l12 2 M${x + 18} ${y - 10} l12 -2 M${x - 30} ${y + 12} l12 -2 M${x + 18} ${y + 10} l12 2" stroke="#d8d0b8" stroke-width="5"/>
          ${m.change === 'dressing' ? `<circle cx="${x + 3}" cy="${y}" r="4" fill="#b0141a" opacity=".6"/>` : ''}</g>`;
        break;
      }
      case 'stitches': {
        const [x, y] = LIMBS.includes(m.part) ? a.lo : [a.x, a.y];
        let st = `<path d="M${x - 26} ${y + 4} Q${x} ${y - 6} ${x + 26} ${y + 4}" stroke="#7a2020" stroke-width="2.2" fill="none"/>`;
        for (let i = -3; i <= 3; i++) st += `<path d="M${x + i * 7 - 2} ${y - 5 + Math.abs(i)} l4 9" stroke="#14202c" stroke-width="1.6"/>`;
        over += `<g>${st}</g>`;
        break;
      }
      case 'sling': {
        const x = L ? 172 : 428;
        over += `<g><path d="M${L ? 360 : 240} 172 L${L ? 210 : 390} 380 L${x} 420" stroke="#3d5a8a" stroke-width="10" fill="none" stroke-linejoin="round" opacity=".95"/>
          <path d="M${x - 22} 360 Q${x} 440 ${x + 22} 360 L${x + 18} 420 Q${x} 450 ${x - 18} 420 Z" fill="#4f6fa8" ${O}/></g>`;
        break;
      }
      case 'tourniquet': {
        const x = arm ? (L ? 184 : 416) : (L ? 268 : 332), y = arm ? 272 : 640, w = arm ? 34 : 54;
        over += `<g><rect x="${x - w / 2}" y="${y - 6}" width="${w}" height="12" rx="3" fill="#1d1d1d" ${O}/><rect x="${x + w / 2 - 4}" y="${y - 10}" width="12" height="20" rx="2" fill="#d23"/><text x="${x - 8}" y="${y + 24}" style="font:bold 9px Consolas;fill:#fff">T ${new Date(m.t || Date.now()).toTimeString().slice(0, 5)}</text></g>`;
        break;
      }
      case 'iv_line': {
        const x = L ? 166 : 434, y = 452, bx = L ? 96 : 504;
        over += `<g><rect x="${x - 7}" y="${y - 5}" width="14" height="10" rx="2" fill="#f6f6ff" ${O}/><circle cx="${x}" cy="${y}" r="3" fill="#e0a020"/>
          <path d="M${x} ${y - 5} C${x} 320 ${bx} 260 ${bx} 120" stroke="#cfe3f2" stroke-width="2.5" fill="none" opacity=".9"/>
          <line x1="${bx}" y1="20" x2="${bx}" y2="870" stroke="#8a96a2" stroke-width="3"/>
          <path d="M${bx - 18} 40 h36 v56 q0 12 -12 12 h-12 q-12 0 -12 -12z" fill="#dff2fb" ${O}/><path d="M${bx - 16} 66 h32 v30 q0 10 -10 10 h-12 q-10 0 -10 -10z" fill="#8fd3f0"/>
          <rect x="${bx - 3}" y="108" width="6" height="12" fill="#cfe3f2" ${O}/></g>`;
        break;
      }
      case 'oxygen_mask':
        over += `<g><path d="M276 102 Q300 84 324 102 L320 130 Q300 142 280 130 Z" fill="#d8f3ea" opacity=".78" stroke="#3a8a70" stroke-width="1.6"/>
          <path d="M254 96 L276 108 M346 96 L324 108" stroke="#5aa0d0" stroke-width="1.5"/><circle cx="300" cy="118" r="5" fill="#9ad8c4" stroke="#3a8a70"/>
          <path d="M300 136 C300 200 470 200 520 860" stroke="#b8e8d8" stroke-width="4" fill="none" opacity=".85"/></g>`;
        break;
      case 'chest_tube':
        over += `<g><circle cx="${L ? 222 : 380}" cy="300" r="5" fill="#fff" ${O}/><path d="M380 300 C440 320 470 500 480 790" stroke="#e6eef4" stroke-width="5" fill="none" opacity=".9"/>
          <path d="M380 300 C440 320 470 500 480 790" stroke="#b03030" stroke-width="2" fill="none" stroke-dasharray="3 9" opacity=".7"/>
          <rect x="454" y="790" width="54" height="64" rx="5" fill="#eef4f8" ${O}/><rect x="458" y="822" width="46" height="28" fill="#c04040" opacity=".7"/></g>`;
        break;
      case 'defib_pads':
        over += `<g><rect x="316" y="214" width="40" height="30" rx="5" fill="#fafafa" ${O} transform="rotate(-12 336 229)"/><rect x="236" y="300" width="40" height="30" rx="5" fill="#fafafa" ${O} transform="rotate(14 256 315)"/>
          <path d="M336 216 C350 160 420 150 470 130 M256 330 C230 380 220 420 240 470" stroke="#e05040" stroke-width="2" fill="none"/></g>`;
        break;
      case 'neck_brace':
        over += `<path d="M276 130 Q300 140 324 130 L328 168 Q300 178 272 168 Z" fill="#f2f0e6" ${O}/><path d="M290 140 v24 M310 140 v24" stroke="#c8c4b0" stroke-width="2"/><rect x="294" y="146" width="12" height="10" fill="#8a96a2"/>`;
        break;
      case 'catheter':
        over += `<g><path d="M300 588 Q330 640 372 616" stroke="#d9c88a" stroke-width="3" fill="none"/><rect x="362" y="612" width="40" height="56" rx="8" fill="#f2efe4" ${O}/><rect x="365" y="640" width="34" height="25" rx="5" fill="#d6be50"/></g>`;
        break;
    }
  }
  if (!hide) return { mask: '', over, masked: false };
  const mask = `<mask id="ampMask" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="880"><rect width="600" height="880" fill="#fff"/>${hide}</mask>`;
  return { mask, over, masked: true };
}
