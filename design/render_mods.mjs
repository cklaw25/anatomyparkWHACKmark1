// Renders design/mods_preview.html: amputations + things put on the body (same renderer as the game).
import { drawPatient } from '../frontend/src/patient.js';
import { applyChanges, inferChanges } from '../frontend/src/mods.js';
import { writeFileSync } from 'fs';
const M = (list) => applyChanges([], list.map(([change, part]) => ({ change, part })));
const T = (name, kind, part) => applyChanges([], inferChanges({ name, kind }, part));
const states = [
  ['"Amputate left arm" (scalpel)', T('Amputate left arm', 'surgery', 'left_arm')],
  ['Above-knee amputation + prosthetic', M([['amputate', 'right_leg'], ['prosthetic', 'right_leg']])],
  ['IV line + O2 mask + defib pads', M([['iv_line', 'left_arm'], ['oxygen_mask', 'face'], ['defib_pads', 'chest']])],
  ['Cast + sling + neck brace', M([['cast', 'right_arm'], ['sling', 'right_arm'], ['neck_brace', 'neck']])],
  ['Trauma: tourniquet, chest tube, catheter', M([['tourniquet', 'left_leg'], ['chest_tube', 'chest'], ['catheter', 'pelvis'], ['dressing', 'abdomen']])],
  ['Laparotomy stitches + leg bandage', M([['stitches', 'abdomen'], ['bandage', 'left_leg']])],
];
const inner = `<style>.fx-label{font:bold 26px Bahnschrift,sans-serif;fill:#fff}</style>`;
const cards = states.map(([title, mods]) => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 0 480 880" width="330" height="605">${inner}${drawPatient([], { mods })}</svg>`; return `<figure><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"><figcaption>${title}</figcaption></figure>`; }).join('');
const css = `body{margin:0;background:radial-gradient(ellipse at center,#1d2a3a,#080c12 70%);color:#e6eef5;font:16px Bahnschrift,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;gap:4px;padding:12px;width:2040px}figure{margin:0;text-align:center}figcaption{color:#ffb43c}`;
writeFileSync(new URL('./mods_preview.html', import.meta.url), `<!doctype html><meta charset="utf-8"><style>${css}</style>${cards}`);
console.log('ok');
