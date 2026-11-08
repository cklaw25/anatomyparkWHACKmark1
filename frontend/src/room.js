// The ward around the patient, seen from above: a curtained bay with the bed at its centre.
// Drawn in the same 600x880 space as patient.js, and much wider so it fills any stage.
// Everything here stays dark and low-contrast: the patient must remain the brightest thing on screen.
// Shading uses gradients rather than blur filters, because this sits behind a constantly animating patient.

const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const L = -900, R = 1500, W = R - L;   // far edges of the room, wide enough for ultrawide screens
const CURTAIN_L = -240, CURTAIN_R = 840;

const DEFS = `<defs>
  <radialGradient id="rmLight" gradientUnits="userSpaceOnUse" cx="300" cy="430" r="720"><stop offset="0" stop-color="#9cc4dc" stop-opacity=".2"/><stop offset=".55" stop-color="#7fa8c4" stop-opacity=".07"/><stop offset="1" stop-color="#7fa8c4" stop-opacity="0"/></radialGradient>
  <linearGradient id="rmGlare" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#cfe6f4" stop-opacity="0"/><stop offset=".5" stop-color="#cfe6f4" stop-opacity=".07"/><stop offset="1" stop-color="#cfe6f4" stop-opacity="0"/></linearGradient>
  <radialGradient id="rmShadow"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".7" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="rmWall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0d141c"/><stop offset="1" stop-color="#18222d"/></linearGradient>
  <linearGradient id="rmMatt" x1="0" x2="1"><stop offset="0" stop-color="#3f4b58"/><stop offset=".12" stop-color="#6d7a88"/><stop offset=".88" stop-color="#6d7a88"/><stop offset="1" stop-color="#3f4b58"/></linearGradient>
  <linearGradient id="rmFrame" x1="0" x2="1"><stop offset="0" stop-color="#1b2229"/><stop offset=".5" stop-color="#39434e"/><stop offset="1" stop-color="#1b2229"/></linearGradient>
  <radialGradient id="rmPillow" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#b3bdc8"/><stop offset="1" stop-color="#7c8896"/></radialGradient>
  <linearGradient id="rmBlanket" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b5870"/><stop offset="1" stop-color="#22374a"/></linearGradient>
  <linearGradient id="rmCart" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#70252f"/><stop offset="1" stop-color="#3c121a"/></linearGradient>
  <linearGradient id="rmSteel" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3d4752"/><stop offset="1" stop-color="#1f262e"/></linearGradient>
  <linearGradient id="rmWood" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4c4438"/><stop offset="1" stop-color="#2d2822"/></linearGradient>
  <linearGradient id="rmSeat" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#2f4656"/><stop offset="1" stop-color="#1a2a36"/></linearGradient>
  <linearGradient id="rmFold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1c4048"/><stop offset=".5" stop-color="#3a7079"/><stop offset="1" stop-color="#17343b"/></linearGradient>
  <pattern id="rmPleat" width="34" height="42" patternUnits="userSpaceOnUse"><rect width="34" height="42" fill="url(#rmFold)"/></pattern>
</defs>`;

const shadow = (x, y, rx, ry, o = 1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#rmShadow)" opacity="${o}"/>`;
const box = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const wheel = (x, y) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#0b0f13" stroke="#333d47" stroke-width="1.5"/>`;

function floor() {
  const r = rng(11); let lines = '', specks = '';
  for (let x = L; x <= R; x += 80) lines += `<path d="M${x} 0 V900"/>`;
  for (let y = 0; y <= 900; y += 80) lines += `<path d="M${L} ${y} H${R}"/>`;
  for (let i = 0; i < 260; i++) specks += `<circle cx="${Math.round(-520 + r() * 1640)}" cy="${Math.round(r() * 880)}" r="${(.7 + r() * 1.1).toFixed(1)}" fill="${r() > .5 ? '#2a3744' : '#05080c'}" opacity=".55"/>`;
  return `${box(L, -300, W, 1500, 0, '#0c1219')}<g stroke="#131c26" stroke-width="1.5">${lines}</g>${specks}
    ${box(L, -300, W, 1500, 0, 'url(#rmLight)')}
    ${box(-120, 120, 170, 620, 0, 'url(#rmGlare)')}${box(550, 120, 170, 620, 0, 'url(#rmGlare)')}
    <rect x="86" y="58" width="428" height="870" rx="8" fill="none" stroke="#8a7426" stroke-width="2.5" stroke-dasharray="16 12" opacity=".3"/>`;
}

// the head wall: services rail, gas outlets, hand gel, sharps bin
function wall() {
  const outlet = (x, c) => `<circle cx="${x}" cy="23" r="7.5" fill="#28323c" stroke="#0a0e12" stroke-width="1.5"/><circle cx="${x}" cy="23" r="3" fill="${c}"/>`;
  return `${box(L, -300, W, 346, 0, 'url(#rmWall)')}<path d="M${L} 46 H${R}" stroke="#2e6a78" stroke-width="2" opacity=".55"/>
    ${box(-180, 8, 250, 30, 3, '#1b242e', 'stroke="#2a3540" stroke-width="1.5"')}${outlet(-155, '#d8dde2')}${outlet(-128, '#4a78b8')}${outlet(-101, '#c9b04a')}
    ${box(-82, 15, 24, 15, 2, '#2f3a45')}${box(-52, 15, 24, 15, 2, '#2f3a45')}<circle cx="44" cy="23" r="5" fill="#7a2730"/>
    ${box(560, 7, 38, 32, 3, '#6c5a1a')}${box(560, 7, 38, 9, 3, '#8a7420')}
    ${box(620, 10, 24, 28, 3, '#26303a')}${box(626, 30, 12, 5, 1, '#3f7f8e')}`;
}

// a neighbouring bay glimpsed past the curtain, dark enough to read as depth
function neighbour(x) {
  return `${shadow(x + 90, 450, 150, 470, .8)}${box(x, 70, 180, 760, 12, '#1a2129')}${box(x + 12, 82, 156, 736, 8, '#262f39')}${box(x + 44, 96, 92, 52, 18, '#37424e')}${box(x + 16, 690, 148, 122, 6, '#1c2b38')}`;
}
function curtain(x, side) {
  const dark = side < 0 ? box(L, -300, x - L, 1500, 0, '#000', 'opacity=".5"') : box(x, -300, R - x, 1500, 0, '#000', 'opacity=".5"');
  let scallop = '';
  for (let y = 46; y < 880; y += 42) scallop += `<path d="M${x + 17} ${y} q${side * 16} 21 0 42" stroke="#0e2228" stroke-width="2" fill="none" opacity=".75"/>`;
  return `${dark}${shadow(x + 17 - side * 26, 470, 44, 520, .75)}${box(x, 46, 34, 860, 0, 'url(#rmPleat)')}${scallop}
    <path d="M${x + 17} 46 V900" stroke="#7d8a96" stroke-width="1.5" stroke-dasharray="2 12" opacity=".6"/>`;
}

function crashCart() {
  return `<g>${shadow(4, 668, 100, 92)}
    ${[[-74, 590], [80, 590], [-74, 746], [80, 746]].map(([a, b]) => wheel(a, b)).join('')}
    ${box(-78, 586, 164, 164, 7, 'url(#rmCart)')}${box(-70, 594, 148, 148, 5, '#55212a')}
    ${box(-62, 744, 132, 6, 2, '#8a8f96')}
    ${box(-58, 606, 96, 72, 5, '#12171d')}${box(-52, 612, 56, 40, 2, '#061712')}
    <path d="M-48 634 h9 l3 -9 l4 16 l3 -7 h15 l3 -9 l4 16 l3 -7 h6" stroke="#46c98f" stroke-width="1.4" fill="none" opacity=".85"/>
    <circle cx="20" cy="622" r="7.5" fill="#2a323b"/><circle cx="20" cy="643" r="7.5" fill="#2a323b"/><circle cx="-44" cy="666" r="2.6" fill="#cf9a30"/><circle cx="-34" cy="666" r="2.6" fill="#3dcf8a"/>
    ${box(-58, 690, 134, 40, 3, '#1b2229')}<path d="M-58 710 H76 M-14 690 V730 M32 690 V730" stroke="#3a4450" stroke-width="1.3"/>
    ${box(50, 612, 20, 54, 3, '#b9b2a2', 'opacity=".5"')}</g>`;
}
function linenTrolley() {
  const fold = (y) => `<path d="M-178 ${y} H-74" stroke="#5c6875" stroke-width="1.5"/>`;
  return `<g>${shadow(-126, 408, 90, 104)}${[[-186, 332], [-66, 332], [-186, 478], [-66, 478]].map(([a, b]) => wheel(a, b)).join('')}
    ${box(-190, 328, 128, 154, 5, 'url(#rmSteel)')}${box(-182, 336, 112, 138, 3, '#7b8794', 'opacity=".55"')}${[364, 396, 428, 456].map(fold).join('')}</g>`;
}
function overbedTable() {
  return `<g>${shadow(26, 244, 78, 74)}
    ${box(-46, 288, 150, 10, 3, '#29313a')}${wheel(-46, 293)}${wheel(104, 293)}${box(-32, 190, 12, 100, 3, '#333d48')}
    ${box(-50, 182, 150, 104, 6, 'url(#rmWood)')}
    <g transform="rotate(-7 46 234)">${box(14, 196, 60, 76, 3, '#2a3139')}${box(20, 204, 48, 62, 1, '#8a929b', 'opacity=".62"')}<path d="M26 216 h36 M26 226 h36 M26 236 h28 M26 246 h32" stroke="#3e4750" stroke-width="1.6"/>${box(36, 193, 16, 7, 2, '#99a2ab')}</g>
    <circle cx="-20" cy="214" r="13" fill="#7f8c98" opacity=".5"/><circle cx="-20" cy="214" r="9" fill="#35586c"/>
    <path d="M-40 254 q18 -16 40 0 q-18 20 -40 0z" fill="#8c95a0" opacity=".55"/></g>`;
}
function cabinet() {
  return `<g>${shadow(556, 102, 72, 62)}${box(506, 56, 100, 94, 5, 'url(#rmWood)')}${box(513, 63, 86, 80, 3, '#5a5244')}
    <circle cx="537" cy="93" r="15" fill="#778a98" opacity=".65"/><circle cx="537" cy="93" r="10" fill="#37566b"/>
    <circle cx="572" cy="124" r="9" fill="#8e969e" opacity=".7"/><circle cx="572" cy="124" r="5.5" fill="#46535e"/>
    ${box(556, 70, 36, 22, 2, '#7b8088', 'opacity=".7"')}<path d="M566 81 q8 -8 16 0" stroke="#d0d4d8" stroke-width="2" fill="none" opacity=".6"/></g>`;
}
function ventilator() {
  return `<g>${shadow(708, 322, 100, 104)}
    ${[[640, 400], [776, 400], [652, 246], [764, 246]].map(([a, b]) => wheel(a, b)).join('')}
    ${box(644, 240, 128, 164, 9, 'url(#rmSteel)')}${box(652, 248, 112, 86, 4, '#04161e')}
    <path d="M658 278 q10 -26 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#3dbbd8" stroke-width="1.8" fill="none" opacity=".8"/>
    <path d="M658 312 h14 l6 -12 l6 12 h18 l6 -12 l6 12 h18 l6 -12 l6 12 h10" stroke="#c9a53c" stroke-width="1.5" fill="none" opacity=".75"/>
    ${[662, 682, 702, 722, 742].map((x, i) => `<circle cx="${x}" cy="356" r="6.5" fill="#29323b" stroke="#475360" stroke-width="1.2"/><circle cx="${x}" cy="356" r="1.7" fill="${i === 1 ? '#3dcf8a' : '#5b6875'}"/>`).join('')}
    ${box(660, 376, 96, 16, 3, '#1a2128')}</g>`;
}
function chair() {
  return `<g>${shadow(640, 612, 82, 78)}${box(584, 552, 112, 16, 6, '#1d2c37')}${box(588, 566, 104, 92, 12, 'url(#rmSeat)')}
    ${box(576, 562, 16, 96, 7, '#223340')}${box(688, 562, 16, 96, 7, '#223340')}
    <path d="M612 590 q28 22 58 2" stroke="#16242e" stroke-width="2.5" fill="none" opacity=".8"/></g>`;
}
function bins() {
  return `<g>${shadow(732, 94, 60, 50)}<circle cx="706" cy="94" r="26" fill="#5f4e16"/><circle cx="706" cy="94" r="21" fill="#7a651c"/><circle cx="706" cy="94" r="6" fill="#5f4e16"/>
    <circle cx="768" cy="92" r="23" fill="#20272f"/><circle cx="768" cy="92" r="18.5" fill="#2e3741"/></g>`;
}
function ivStand() {
  const X = 700, Y = 700;
  return `<g>${shadow(X, Y, 62, 58)}${[0, 72, 144, 216, 288].map((a) => { const t = (a - 90) * Math.PI / 180, x = X + Math.cos(t) * 38, y = Y + Math.sin(t) * 38; return `<path d="M${X} ${Y} L${x.toFixed(1)} ${y.toFixed(1)}" stroke="#3f4a55" stroke-width="5.5" stroke-linecap="round"/>${wheel(x.toFixed(1), y.toFixed(1))}`; }).join('')}
    <circle cx="${X}" cy="${Y}" r="9" fill="#67727e"/>${box(X - 24, Y - 13, 48, 26, 4, '#1b232b')}${box(X - 19, Y - 9, 24, 13, 1, '#1b1404')}<circle cx="${X + 13}" cy="${Y - 3}" r="2.5" fill="#d29a34"/><circle cx="${X + 13}" cy="${Y + 6}" r="2.5" fill="#3dcf8a"/></g>`;
}

function bed() {
  return `<g>${shadow(300, 440, 300, 540)}
    ${box(122, -30, 356, 940, 16, 'url(#rmFrame)')}
    ${box(128, 896, 344, 30, 8, '#1a2027')}${box(250, 902, 100, 18, 2, '#7f8891')}<path d="M262 911 h76" stroke="#3f4851" stroke-width="2"/>
    ${box(140, -14, 320, 902, 10, 'url(#rmMatt)')}
    <g stroke="#566371" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"><path d="M168 200 q14 60 2 130"/><path d="M432 240 q-14 70 -2 140"/><path d="M200 640 q30 30 70 36"/><path d="M400 610 q-24 40 -66 52"/></g>
    ${box(212, 4, 176, 96, 30, 'url(#rmPillow)')}<path d="M232 30 q20 -10 46 -4 M330 80 q20 4 40 -6" stroke="#67737f" stroke-width="3" fill="none"/>
    ${box(146, 846, 308, 42, 6, 'url(#rmBlanket)')}<path d="M152 860 H448 M152 874 H448" stroke="#1b2d3c" stroke-width="2.5"/>
    ${rail(108)}${rail(470)}</g>`;
}
function rail(x) {
  return `<g>${box(x, 120, 22, 330, 10, '#171d24', 'stroke="#0a0d11" stroke-width="2"')}${box(x + 6, 132, 10, 306, 5, '#46525f')}<path d="M${x + 4} 220 h14 M${x + 4} 320 h14" stroke="#0a0d11" stroke-width="3"/></g>`;
}

let cached = '';
export function drawRoom() {
  // built once: the room never changes, and this is re-inserted whenever the patient changes
  return (cached ||= `<g id="room">${DEFS}${floor()}${neighbour(-470)}${neighbour(890)}${curtain(CURTAIN_L, -1)}${curtain(CURTAIN_R, 1)}${wall()}${linenTrolley()}${overbedTable()}${crashCart()}${cabinet()}${bins()}${ventilator()}${chair()}${ivStand()}${bed()}</g>`);
}
