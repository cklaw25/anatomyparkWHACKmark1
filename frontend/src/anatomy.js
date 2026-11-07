// The body map: 17 sites the engine (and Claude) know about, drawn as layered SVG "scan modes".
export const SITES = {
  brain:       { x: 300, y: 78,  label: 'Brain' },
  thyroid:     { x: 300, y: 178, label: 'Thyroid' },
  heart:       { x: 316, y: 268, label: 'Heart' },
  lungs:       { x: 262, y: 250, label: 'Lungs' },
  liver:       { x: 345, y: 352, label: 'Liver' },
  stomach:     { x: 268, y: 360, label: 'Stomach' },
  pancreas:    { x: 300, y: 392, label: 'Pancreas' },
  kidneys:     { x: 352, y: 418, label: 'Kidneys' },
  intestines:  { x: 290, y: 470, label: 'Intestines' },
  bladder:     { x: 300, y: 545, label: 'Bladder' },
  spinal_cord: { x: 300, y: 320, label: 'Spinal cord' },
  blood:       { x: 205, y: 330, label: 'Blood' },
  bone_marrow: { x: 338, y: 640, label: 'Bone marrow' },
  joints:      { x: 196, y: 455, label: 'Joints' },
  skin:        { x: 404, y: 360, label: 'Skin' },
  left_leg:    { x: 262, y: 760, label: 'Left leg' },
  right_leg:   { x: 338, y: 760, label: 'Right leg' },
};

export const MODES = [
  { id: 'skeletal',    label: 'SKELETAL',    color: '#e8e4cf' },
  { id: 'circulatory', label: 'CIRCULATORY', color: '#ff4b4b' },
  { id: 'respiratory', label: 'RESPIRATORY', color: '#5ad8ff' },
  { id: 'nervous',     label: 'NERVOUS',     color: '#ffb43c' },
  { id: 'digestive',   label: 'DIGESTIVE',   color: '#d08c5a' },
  { id: 'organs',      label: 'ORGANS',      color: '#d278c8' },
];

// which sites "belong" to a scan mode (they are drawn bright in that mode; every site is always clickable)
export const MODE_SITES = {
  skeletal: ['brain', 'spinal_cord', 'bone_marrow', 'joints', 'left_leg', 'right_leg'],
  circulatory: ['heart', 'blood', 'brain', 'lungs', 'kidneys', 'liver', 'left_leg', 'right_leg', 'intestines'],
  respiratory: ['lungs', 'brain', 'blood', 'heart'],
  nervous: ['brain', 'spinal_cord', 'left_leg', 'right_leg', 'skin', 'joints'],
  digestive: ['stomach', 'liver', 'pancreas', 'intestines'],
  organs: ['heart', 'lungs', 'liver', 'stomach', 'pancreas', 'kidneys', 'bladder', 'thyroid', 'skin', 'brain'],
};

const SIL = '#22384a', EDGE = '#3f6a88';

export function silhouette() {
  return `
  <g id="silhouette" fill="${SIL}" stroke="${EDGE}" stroke-width="2">
    <ellipse cx="300" cy="80" rx="52" ry="60"/>
    <rect x="282" y="135" width="36" height="34"/>
    <rect x="186" y="160" width="228" height="330" rx="64"/>
    <path d="M196 180 L160 186 L150 445 L176 448 Z"/><path d="M404 180 L440 186 L450 445 L424 448 Z"/>
    <path d="M212 470 L296 480 L288 840 L236 840 Z"/><path d="M388 470 L304 480 L312 840 L364 840 Z"/>
  </g>`;
}

export function layer(mode) {
  const c = MODES.find(m => m.id === mode).color;
  const L = {
    skeletal: `
      <g stroke="${c}" stroke-width="3" fill="none" opacity=".95">
        <ellipse cx="300" cy="78" rx="44" ry="52"/><path d="M276 120 Q300 140 324 120"/>
        <line x1="300" y1="168" x2="300" y2="520" stroke-dasharray="6 4" stroke-width="6"/>
        ${[0,1,2,3,4,5].map(i => `<path d="M300 ${205+i*26} Q${240-i*2} ${200+i*26} ${212+i*3} ${232+i*26}"/><path d="M300 ${205+i*26} Q${360+i*2} ${200+i*26} ${388-i*3} ${232+i*26}"/>`).join('')}
        <path d="M238 520 Q300 575 362 520 Q350 560 300 565 Q250 560 238 520"/>
        <line x1="262" y1="560" x2="262" y2="690" stroke-width="7"/><line x1="338" y1="560" x2="338" y2="690" stroke-width="7"/>
        <line x1="262" y1="700" x2="262" y2="830" stroke-width="5"/><line x1="338" y1="700" x2="338" y2="830" stroke-width="5"/>
        <line x1="175" y1="190" x2="166" y2="320" stroke-width="5"/><line x1="425" y1="190" x2="434" y2="320" stroke-width="5"/>
        <line x1="166" y1="330" x2="160" y2="440" stroke-width="4"/><line x1="434" y1="330" x2="440" y2="440" stroke-width="4"/>
        <circle cx="166" cy="325" r="8"/><circle cx="434" cy="325" r="8"/><circle cx="262" cy="695" r="9"/><circle cx="338" cy="695" r="9"/>
      </g>`,
    circulatory: `
      <g fill="none" stroke-linecap="round" opacity=".95">
        <g stroke="#ff4b4b" stroke-width="5">
          <path d="M316 268 Q306 210 300 170 L300 70"/>
          <path d="M310 285 Q296 360 296 450 Q262 500 262 620 L262 830"/>
          <path d="M296 450 Q338 500 338 620 L338 830"/>
          <path d="M316 262 Q370 200 425 200 Q440 320 444 440"/><path d="M308 262 Q230 200 175 200 Q160 320 156 440"/>
          <path d="M300 300 Q350 340 352 418"/><path d="M300 300 Q250 340 248 418"/>
        </g>
        <g stroke="#5a78ff" stroke-width="4">
          <path d="M326 258 L326 330 Q322 450 340 520 L346 830"/>
          <path d="M310 255 Q270 238 250 262"/><path d="M318 255 Q350 238 360 262"/>
        </g>
        <ellipse cx="316" cy="268" rx="26" ry="23" fill="#c42838" stroke="#ff9a9a" stroke-width="2"/>
      </g>`,
    respiratory: `
      <g stroke="${c}" stroke-width="3" fill="rgba(90,216,255,.08)">
        <path d="M300 150 L300 225" stroke-width="7" fill="none"/>
        <path d="M300 225 Q275 235 262 250 M300 225 Q325 235 338 250" fill="none" stroke-width="5"/>
        <path d="M290 230 Q220 230 214 320 Q222 345 292 330 Z"/><path d="M310 230 Q380 230 386 320 Q378 345 308 330 Z"/>
        <path d="M258 260 L240 300 M262 270 L270 310 M342 260 L360 300 M338 270 L330 310" fill="none" stroke-width="2"/>
        <path d="M220 360 Q300 330 380 360" fill="none" stroke-dasharray="5 4"/>
      </g>`,
    nervous: `
      <g stroke="${c}" stroke-width="2.5" fill="none" opacity=".95">
        <path d="M262 72 Q300 30 338 72 Q352 110 300 118 Q248 110 262 72" stroke-width="3" fill="rgba(255,180,60,.12)"/>
        <line x1="300" y1="118" x2="300" y2="540" stroke-width="5"/>
        ${[0,1,2,3,4,5,6,7].map(i => `<path d="M300 ${190+i*40} Q${255-i*4} ${200+i*40} ${200+i*2} ${215+i*44}"/><path d="M300 ${190+i*40} Q${345+i*4} ${200+i*40} ${400-i*2} ${215+i*44}"/>`).join('')}
        <path d="M300 540 Q262 600 262 830"/><path d="M300 540 Q338 600 338 830"/>
        <path d="M300 200 Q190 210 162 440"/><path d="M300 200 Q410 210 438 440"/>
      </g>`,
    digestive: `
      <g stroke="${c}" stroke-width="3" fill="rgba(208,140,90,.10)">
        <path d="M300 160 L292 330" fill="none" stroke-width="4"/>
        <path d="M292 330 Q240 330 246 370 Q262 400 300 380 Q320 360 300 340"/>
        <path d="M330 330 Q395 335 380 372 Q350 392 322 372 Z" fill="rgba(160,90,60,.25)"/>
        <path d="M270 392 Q300 384 330 395" stroke-width="7" fill="none"/>
        <path d="M250 430 L350 430 L350 520 L250 520 Z" fill="none" stroke-width="5" rx="20"/>
        <path d="M265 445 Q300 470 335 445 Q300 495 265 470 Q300 520 335 500" fill="none"/>
      </g>`,
    organs: `
      <g stroke="${c}" stroke-width="2.5" fill="rgba(210,120,200,.14)">
        <path d="M262 72 Q300 30 338 72 Q352 110 300 118 Q248 110 262 72"/>
        <path d="M286 172 Q300 186 314 172 Q314 186 300 190 Q286 186 286 172"/>
        <path d="M290 230 Q220 230 214 320 Q222 345 292 330 Z"/><path d="M310 230 Q380 230 386 320 Q378 345 308 330 Z"/>
        <ellipse cx="316" cy="268" rx="24" ry="22" fill="rgba(255,75,75,.4)"/>
        <path d="M322 330 Q395 335 380 372 Q350 392 318 372 Z"/>
        <path d="M290 335 Q240 330 246 370 Q262 400 300 380 Q320 360 300 340"/>
        <path d="M272 392 Q300 384 330 395" stroke-width="6" fill="none"/>
        <ellipse cx="248" cy="418" rx="12" ry="20"/><ellipse cx="352" cy="418" rx="12" ry="20"/>
        <path d="M252 440 Q300 430 348 440 L348 520 Q300 530 252 520 Z"/>
        <ellipse cx="300" cy="545" rx="20" ry="15"/>
      </g>`,
  };
  return L[mode];
}

// bloodstream travel: everything routes through the heart unless the two sites are close
export function route(from, to) {
  const a = SITES[from], b = SITES[to];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 110) return [a, b];
  return [a, SITES.heart, b];
}
