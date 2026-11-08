// The body map: 17 sites the engine (and Claude) know about, drawn as layered SVG "scan modes".
import { scan } from './realbody.js';

export const SITES = {
  brain:       { x: 300, y: 78,  label: 'Brain' },
  thyroid:     { x: 300, y: 178, label: 'Thyroid' },
  heart:       { x: 316, y: 268, label: 'Heart' },
  lungs:       { x: 262, y: 250, label: 'Lungs' },
  liver:       { x: 262, y: 352, label: 'Liver' },
  stomach:     { x: 346, y: 362, label: 'Stomach' },
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
  { id: 'skeletal',    label: 'SKELETAL',    color: '#a8dcff' },
  { id: 'circulatory', label: 'CIRCULATORY', color: '#ff4a64' },
  { id: 'respiratory', label: 'RESPIRATORY', color: '#49dcff' },
  { id: 'nervous',     label: 'NERVOUS',     color: '#ffb02e' },
  { id: 'digestive',   label: 'DIGESTIVE',   color: '#ff9a4a' },
  { id: 'organs',      label: 'ORGANS',      color: '#ff6ac0' },
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

export const layer = (mode) => scan(mode);

// bloodstream travel: everything routes through the heart unless the two sites are close
export function route(from, to) {
  const a = SITES[from], b = SITES[to];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 110) return [a, b];
  return [a, SITES.heart, b];
}
