// The ward around the patient, seen from above: the patient lies on a hospital bed in a bay.
// Drawn in the same 600x880 space as patient.js, and wider than it so it fills the stage.
// Flat colours only, so it sits behind both the main and the design-clinical themes.

const C = {
  floor: '#262b30', tile: '#2d3338', wall: '#1c2024', wallEdge: '#3a4148',
  frame: '#59616a', frameDark: '#40474f', rail: '#7c858e', mattress: '#aab4bc',
  sheet: '#c3ccd3', sheetFold: '#b0bac2', pillow: '#dfe4e8', pillowFold: '#c8cfd5',
  blanket: '#5d7f99', blanketFold: '#4f6f88', curtain: '#4d6b78', curtainFold: '#3f5a66',
  cabinet: '#6f6658', cabinetTop: '#857b6b', metal: '#8d969e', dark: '#14181c',
};

function floor() {
  let lines = '';
  for (let x = -600; x <= 1200; x += 60) lines += `<path d="M${x} -300 V1200"/>`;
  for (let y = -300; y <= 1200; y += 60) lines += `<path d="M-600 ${y} H1200"/>`;
  return `<rect x="-600" y="-300" width="1800" height="1500" fill="${C.floor}"/>
    <g stroke="${C.tile}" stroke-width="2">${lines}</g>`;
}

// the wall behind the bed head, with the bed-head service panel (gases, lights, call point)
function wall() {
  return `<rect x="-600" y="-300" width="1800" height="226" fill="${C.wall}"/>
    <path d="M-600 -74 H1200" stroke="${C.wallEdge}" stroke-width="3"/>
    <rect x="150" y="-118" width="300" height="36" rx="3" fill="#2b3137" stroke="${C.wallEdge}" stroke-width="1.5"/>
    <circle cx="186" cy="-100" r="8" fill="#e8ecef" stroke="${C.dark}" stroke-width="1.5"/><circle cx="186" cy="-100" r="3" fill="${C.dark}"/>
    <circle cx="214" cy="-100" r="8" fill="#e8ecef" stroke="${C.dark}" stroke-width="1.5"/><circle cx="214" cy="-100" r="3" fill="${C.dark}"/>
    <rect x="240" y="-108" width="22" height="16" rx="2" fill="#f2f2f2" stroke="${C.dark}"/>
    <rect x="338" y="-108" width="22" height="16" rx="2" fill="#f2f2f2" stroke="${C.dark}"/>
    <circle cx="392" cy="-100" r="7" fill="#b03a32" stroke="${C.dark}"/><rect x="408" y="-106" width="30" height="12" rx="2" fill="#3c444c"/>`;
}

// a cubicle curtain hanging along the left of the bay, and its ceiling track
function curtain() {
  let folds = '';
  for (let y = -60; y < 1100; y += 44) folds += `<path d="M-108 ${y} q-14 22 0 44" stroke="${C.curtainFold}" stroke-width="5" fill="none"/>`;
  return `<path d="M-120 -74 V1200" stroke="${C.metal}" stroke-width="3" stroke-dasharray="2 10"/>
    <rect x="-130" y="-70" width="44" height="1270" fill="${C.curtain}"/>${folds}`;
}

// bedside cabinet with a water jug and cup, on the right
function cabinet() {
  return `<rect x="500" y="10" width="96" height="96" rx="4" fill="${C.cabinet}" stroke="${C.dark}" stroke-width="2"/>
    <rect x="506" y="16" width="84" height="84" rx="3" fill="${C.cabinetTop}"/>
    <circle cx="530" cy="46" r="14" fill="#cfe3ee" stroke="${C.dark}" stroke-width="1.5"/><circle cx="530" cy="46" r="9" fill="#9fc6dc"/>
    <circle cx="564" cy="74" r="9" fill="#f2f2f2" stroke="${C.dark}" stroke-width="1.5"/>
    <rect x="548" y="22" width="34" height="22" rx="2" fill="#e6e1d6" stroke="${C.dark}"/>`;
}

// vital-signs monitor on a wheeled stand, and a visitor chair
function kit() {
  return `<g>
    <circle cx="560" cy="250" r="34" fill="${C.frameDark}" stroke="${C.dark}" stroke-width="2"/>
    <circle cx="560" cy="250" r="6" fill="${C.metal}"/>
    <rect x="510" y="196" width="100" height="62" rx="5" fill="#2a3036" stroke="${C.dark}" stroke-width="2"/>
    <rect x="516" y="202" width="88" height="44" rx="2" fill="#0b0d0f"/>
    <path d="M520 226 h14 l4 -10 l5 18 l4 -8 h22 l4 -10 l5 18 l4 -8 h18" stroke="#5fbf72" stroke-width="1.6" fill="none"/>
    <rect x="530" y="250" width="60" height="5" rx="2" fill="#3a4148"/>
    <rect x="520" y="560" width="90" height="86" rx="10" fill="#4a5560" stroke="${C.dark}" stroke-width="2"/>
    <rect x="528" y="568" width="74" height="62" rx="8" fill="#5b6873"/>
    <rect x="520" y="560" width="90" height="16" rx="6" fill="#3d4750"/>
    <rect x="512" y="580" width="10" height="56" rx="4" fill="#3d4750"/><rect x="608" y="580" width="10" height="56" rx="4" fill="#3d4750"/>
    <rect x="510" y="760" width="40" height="40" rx="3" fill="#e2b33a" stroke="${C.dark}" stroke-width="2"/><rect x="516" y="766" width="28" height="10" fill="#c23a2e"/>
  </g>`;
}

// the bed: frame, head and foot boards, side rails, mattress, sheet, pillow, folded blanket
function bed() {
  return `<g>
    <rect x="122" y="-30" width="356" height="940" rx="16" fill="${C.frameDark}"/>
    <rect x="130" y="-22" width="340" height="924" rx="12" fill="${C.frame}"/>
    <rect x="128" y="-52" width="344" height="30" rx="8" fill="${C.frameDark}" stroke="${C.dark}" stroke-width="2"/>
    <rect x="128" y="896" width="344" height="30" rx="8" fill="${C.frameDark}" stroke="${C.dark}" stroke-width="2"/>
    <rect x="250" y="902" width="100" height="18" rx="2" fill="#e8ecef"/><path d="M262 911 h76" stroke="#9aa3ab" stroke-width="2"/>
    <rect x="140" y="-14" width="320" height="902" rx="10" fill="${C.mattress}"/>
    <rect x="146" y="-8" width="308" height="890" rx="8" fill="${C.sheet}"/>
    <g stroke="${C.sheetFold}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M168 200 q14 60 2 130"/><path d="M432 240 q-14 70 -2 140"/><path d="M200 640 q30 30 70 36"/><path d="M400 610 q-24 40 -66 52"/>
    </g>
    <rect x="212" y="4" width="176" height="96" rx="30" fill="${C.pillow}" stroke="${C.pillowFold}" stroke-width="3"/>
    <path d="M232 30 q20 -10 46 -4 M330 80 q20 4 40 -6" stroke="${C.pillowFold}" stroke-width="3" fill="none"/>
    <rect x="148" y="862" width="304" height="26" rx="6" fill="${C.blanket}"/>
    <path d="M152 872 H448" stroke="${C.blanketFold}" stroke-width="3"/>
    ${rail(108)}${rail(470)}
  </g>`;
}
function rail(x) {
  return `<g><rect x="${x}" y="120" width="22" height="330" rx="10" fill="${C.frameDark}" stroke="${C.dark}" stroke-width="2"/>
    <rect x="${x + 6}" y="132" width="10" height="306" rx="5" fill="${C.rail}"/>
    <path d="M${x + 4} 220 h14 M${x + 4} 320 h14" stroke="${C.dark}" stroke-width="3"/></g>`;
}

export function drawRoom() {
  return `<g id="room">${floor()}${wall()}${curtain()}${cabinet()}${kit()}${bed()}</g>`;
}
