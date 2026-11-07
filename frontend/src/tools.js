// Treatment items. Every treatment the fellow invents gets: (1) an instant built-in icon for its delivery kind,
// (2) a Claude-drawn SVG of that exact item a few seconds later (POST /art), and (3) a physical interaction.
const O = 'stroke="#14202c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
export const ICONS = {
  injection: `<svg viewBox="0 0 120 120"><g ${O}><path d="M18 102 L36 84" stroke-width="3"/><rect x="34" y="46" width="58" height="26" rx="4" transform="rotate(-45 63 59)" fill="#e9f3f8"/><rect x="40" y="56" width="30" height="14" transform="rotate(-45 55 63)" fill="#6fd0a0" stroke="none"/><path d="M84 36 L100 20 M92 12 L108 28" fill="none"/></g></svg>`,
  iv_drip: `<svg viewBox="0 0 120 120"><g ${O}><path d="M38 14 h44 v58 q0 12 -12 12 h-20 q-12 0 -12 -12z" fill="#dff2fb"/><path d="M40 44 h40 v28 q0 10 -10 10 h-20 q-10 0 -10 -10z" fill="#8fd3f0" stroke="none"/><path d="M60 84 v12 q0 14 -18 18" fill="none"/><circle cx="60" cy="8" r="5" fill="#fff"/></g></svg>`,
  oral: `<svg viewBox="0 0 120 120"><g ${O}><rect x="22" y="44" width="76" height="32" rx="16" transform="rotate(-30 60 60)" fill="#fff"/><path d="M60 37 L60 83" transform="rotate(-30 60 60)"/><path d="M60 37 h22 a16 16 0 0 1 0 32 h-22z" transform="rotate(-30 60 60) translate(0 7)" fill="#ff7a6a" stroke="none"/></g></svg>`,
  defibrillator: `<svg viewBox="0 0 120 120"><g ${O}><rect x="12" y="34" width="40" height="30" rx="8" fill="#f2c94c"/><rect x="68" y="34" width="40" height="30" rx="8" fill="#f2c94c"/><rect x="24" y="64" width="16" height="22" fill="#333"/><rect x="80" y="64" width="16" height="22" fill="#333"/><path d="M32 86 q28 30 56 0" fill="none" stroke="#c0392b"/><path d="M58 20 l-8 14 h10 l-6 14" fill="none" stroke="#ff5a3c"/></g></svg>`,
  cpr: `<svg viewBox="0 0 120 120"><g ${O}><path d="M30 70 q0 -26 30 -26 q30 0 30 26 v10 h-60z" fill="#e2b092"/><path d="M36 56 q0 -20 24 -20 q24 0 24 20" fill="#d9a080"/><path d="M60 92 v18 M44 100 l-8 10 M76 100 l8 10" stroke="#ff5a3c"/></g></svg>`,
  surgery: `<svg viewBox="0 0 120 120"><g ${O}><path d="M20 100 L64 56 L74 66 L30 110 Z" fill="#7f8c99"/><path d="M64 56 Q96 20 108 14 Q102 34 74 66 Z" fill="#dfe8ef"/><path d="M80 44 L98 24" stroke="#fff" stroke-width="2"/></g></svg>`,
  oxygen: `<svg viewBox="0 0 120 120"><g ${O}><path d="M30 40 Q60 10 90 40 L84 82 Q60 100 36 82 Z" fill="#cfeee6" opacity=".95"/><circle cx="60" cy="62" r="10" fill="#7fd0b8"/><path d="M60 92 q0 18 30 22" fill="none"/><path d="M28 46 q-14 4 -12 20 M92 46 q14 4 12 20" fill="none" stroke="#2a8a70"/></g></svg>`,
  apply: `<svg viewBox="0 0 120 120"><g ${O}><rect x="16" y="42" width="88" height="36" rx="14" transform="rotate(-20 60 60)" fill="#f3d9b8"/><rect x="42" y="46" width="36" height="28" rx="4" transform="rotate(-20 60 60)" fill="#fff"/><path d="M52 60 h16 M60 52 v16" stroke="#e04848" transform="rotate(-20 60 60)"/></g></svg>`,
};

// how each kind is delivered once the item is dropped on the patient
export const ACTIONS = {
  injection:     { verb: 'HOLD to push the plunger', hold: 1.4 },
  iv_drip:       { verb: 'HOLD to run the line', hold: 1.0 },
  oral:          { verb: 'HOLD to give it', hold: 0.7, hint: 'drop it on the mouth' },
  oxygen:        { verb: 'HOLD to fit the mask', hold: 0.8, hint: 'drop it on the face' },
  apply:         { verb: 'HOLD to apply', hold: 1.0 },
  defibrillator: { verb: 'HOLD to CHARGE, release to SHOCK', hold: 1.6, release: true, hint: 'paddles on the chest' },
  cpr:           { verb: 'CLICK rhythmically to compress', clicks: 12, hint: 'hands on the chest' },
  surgery:       { verb: 'DRAG along the dotted line to cut', cut: 90 },
};

export function guessKind(name) {
  const n = (name || '').toLowerCase();
  if (/defib|shock|cardiover/.test(n)) return 'defibrillator';
  if (/cpr|compress/.test(n)) return 'cpr';
  if (/surg|incis|excis|drain|ectomy|otomy|laparo|scalpel|decompress/.test(n)) return 'surgery';
  if (/oxygen|o2|mask|ventil|cpap|intubat/.test(n)) return 'oxygen';
  if (/fluid|drip|saline|transfus|infusion|\biv\b/.test(n)) return 'iv_drip';
  if (/tablet|oral|pill|capsule|by mouth/.test(n)) return 'oral';
  if (/bandage|pressure|tourniquet|ice|pack|cool|splint|compress/.test(n)) return 'apply';
  return 'injection';
}

// strip anything active from model-drawn SVG before it touches the DOM
export function safeSvg(svg) {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    root.querySelectorAll('script,foreignObject,image,iframe,use[href^="http"],a').forEach(n => n.remove());
    root.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
      if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !a.value.startsWith('#'))) n.removeAttribute(a.name);
    }));
    [...root.attributes].forEach(a => { if (/^on/i.test(a.name)) root.removeAttribute(a.name); });
    root.setAttribute('viewBox', root.getAttribute('viewBox') || '0 0 120 120');
    root.removeAttribute('width'); root.removeAttribute('height');
    return new XMLSerializer().serializeToString(root);
  } catch { return null; }
}
