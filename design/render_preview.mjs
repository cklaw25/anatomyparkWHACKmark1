// Renders design/patient_preview.html: the bedside patient in several symptom states (same renderer as the game).
import { drawPatient } from '../frontend/src/patient.js';
import { writeFileSync } from 'fs';

const fx = (list) => list.map(([type, site, side = 'none', k = 0.9]) => ({ type, site, side, k }));
const states = [
  ['Healthy (before onset)', []],
  ['Stroke: face droop + weak left side', fx([['face_droop', 'brain', 'left'], ['limb_weak', 'left_leg', 'left'], ['confused', 'brain']])],
  ['Kidney bleed: flank bruise, blood in urine, pale', fx([['bruise', 'kidneys', 'right'], ['blood_urine', 'bladder'], ['pallor', 'blood', 'none', 0.8], ['sweating', 'skin'], ['pain', 'kidneys', 'right']])],
  ['Seizure + hypoxia', fx([['seizure', 'brain'], ['cyanosis', 'lungs'], ['fast_breathing', 'lungs']])],
  ['Meningococcal sepsis', fx([['petechiae', 'skin'], ['petechiae', 'right_leg'], ['flushed', 'skin'], ['sweating', 'skin'], ['unconscious', 'brain']])],
  ['DVT + coughing blood (PE)', fx([['swelling', 'left_leg', 'left'], ['coughing_blood', 'lungs'], ['pain', 'lungs']])],
];
const inner = `<style>.fx-label{font:bold 26px Bahnschrift,sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px}.fx-label.q{fill:#ffd24a}.fx-label.z{fill:#9fc8ff}</style>`;
const cards = states.map(([title, e]) => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="120 0 360 880" width="300" height="733">${inner}${drawPatient(e)}</svg>`; return `<figure><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"><figcaption>${title}</figcaption></figure>`; }).join('');
const css = `body{margin:0;background:radial-gradient(ellipse at center,#1d2a3a,#080c12 70%);color:#e6eef5;font:16px Bahnschrift,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;gap:6px;padding:16px;width:1900px}
figure{margin:0;text-align:center} figcaption{margin-top:-10px;font-size:15px;color:#ffb43c}
.drip,.sweat,.cough,.pulse-fx,.fx-label{opacity:1}`;
writeFileSync(new URL('./patient_preview.html', import.meta.url), `<!doctype html><meta charset="utf-8"><style>${css}</style>${cards}`);
console.log('ok');
